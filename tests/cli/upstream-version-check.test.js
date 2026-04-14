const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  UPSTREAM_TRACKING_MANIFEST,
  assertUpstreamTrackingManifest,
  getUpstreamTrackingManifest,
} = require('../../lib/upstream-manifest');
const {
  checkUpstreamVersions,
  extractVersionFromKnowledgeTable,
  extractDependencyDeclaration,
  resolveCurrentVersion,
} = require('../../lib/upstream-version-check');

const repoRoot = path.resolve(__dirname, '..', '..');

function createTempRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-upstream-'));

  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, content);
    }
    return root;
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

test('upstream manifest points at existing repository files', () => {
  const manifest = getUpstreamTrackingManifest(repoRoot);
  assert.doesNotThrow(() => assertUpstreamTrackingManifest(repoRoot, manifest));

  assert.equal(manifest.length, UPSTREAM_TRACKING_MANIFEST.length);
  for (const entry of manifest) {
    assert.equal(Boolean(entry.dependencyName), true, `${entry.upstreamName} has dependencyName`);
    assert.equal(Boolean(entry.upstreamName), true, `${entry.dependencyName} has upstreamName`);
    assert.equal(Array.isArray(entry.sources), true, `${entry.dependencyName} has sources`);
  }
});

test('upstream versions resolve for the repository manifest', () => {
  const result = checkUpstreamVersions(repoRoot);
  assert.deepEqual(result.errors, []);
  assert.ok(result.entries.length >= 8);

  const pinocchio = result.entries.find((entry) => entry.dependencyName === 'pinocchio');
  const mollusk = result.entries.find((entry) => entry.dependencyName === 'mollusk-svm');
  const litesvm = result.entries.find((entry) => entry.dependencyName === 'litesvm');

  assert.equal(pinocchio.currentVersion.startsWith('0.11'), true);
  assert.equal(mollusk.currentVersion, '0.12');
  assert.equal(litesvm.currentVersion, '0.11');
});

test('resolveCurrentVersion prefers lock versions matching cargo constraints', () => {
  const root = createTempRepo({
    'Cargo.toml': '[package]\nname="temp"\nversion="0.1.0"\n\n[dependencies]\npinocchio="0.11"\n',
    'Cargo.lock': [
      'version = 3\n',
      '[[package]]\nname = "pinocchio"\nversion = "0.10.5"\n',
      '[[package]]\nname = "pinocchio"\nversion = "0.11.2"\n',
      '[[package]]\nname = "pinocchio"\nversion = "0.11.0"\n',
    ].join('\n'),
    'src/lib.rs': '//! placeholder',
  });

  try {
    const manifest = [
      {
        upstreamName: 'pinocchio',
        dependencyName: 'pinocchio',
        description: 'temp',
        sources: [
          {
            sourceType: 'cargo',
            relativePath: 'Cargo.toml',
            section: 'dependencies',
            dependencyName: 'pinocchio',
            sourcePath: path.join(root, 'Cargo.toml'),
            label: 'temp',
          },
          {
            sourceType: 'cargo-lock',
            relativePath: 'Cargo.lock',
            packageName: 'pinocchio',
            sourcePath: path.join(root, 'Cargo.lock'),
            label: 'temp',
          },
        ],
      },
    ];

    const result = checkUpstreamVersions(root, manifest);
    assert.deepEqual(result.errors, []);
    assert.equal(result.entries[0].currentVersion, '0.11.2');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('extractVersionFromKnowledgeTable can parse markdown ecosystem rows', () => {
  const content = [
    '# Testing Utilities',
    '| crate | version | note |',
    '| --- | --- | --- |',
    '| `pinocchio-system` | 0.6.x | helper |',
    '',
  ].join('\n');

  const versions = extractVersionFromKnowledgeTable(content, 'pinocchio-system');
  assert.deepEqual(versions, ['0.6.x']);
});

test('extractDependencyDeclaration supports inline and string forms', () => {
  const section = [
    'pinocchio = { version = "0.11", optional = true }',
    'mollusk-svm = "0.12"',
  ].join('\n');

  assert.equal(extractDependencyDeclaration(section, 'pinocchio'), '0.11');
  assert.equal(extractDependencyDeclaration(section, 'mollusk-svm'), '0.12');
});

test('resolveCurrentVersion falls back to highest available when no lock constraint match', () => {
  const cargoVersions = ['0.10'];
  const lockVersions = ['0.9.9', '0.11.1'];
  const allVersions = ['0.11.1'];

  const current = resolveCurrentVersion(cargoVersions, lockVersions, allVersions);
  assert.equal(current, '0.11.1');
});

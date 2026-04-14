const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  KNOWLEDGE_HEADER_TARGETS,
  assertKnowledgeHeaderManifest,
  getKnowledgeHeaderTargets,
  getKnowledgeManifestRoot,
} = require('../../lib/knowledge-manifest');
const { checkKnowledgeHeaders } = require('../../lib/knowledge-check');

const repoRoot = path.resolve(__dirname, '..', '..');

function createTempRepo({ cargoToml, files }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-knowledge-'));

  try {
    fs.writeFileSync(
      path.join(root, 'Cargo.toml'),
      cargoToml || `[package]\nname = "temp"\nversion = "0.1.0"\n\n[dependencies]\npinocchio = { version = "0.11", features = ["cpi"] }\n`,
    );

    for (const [relativePath, content] of Object.entries(files || {})) {
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

function createManifest(root, relativePath, ecosystem = 'pinocchio') {
  return [{
    relativePath,
    sourcePath: path.join(root, relativePath),
    ecosystem,
  }];
}

test('knowledge manifest points at existing repository files', () => {
  assert.equal(getKnowledgeManifestRoot(), repoRoot);
  assert.doesNotThrow(() => assertKnowledgeHeaderManifest(repoRoot));

  const targets = getKnowledgeHeaderTargets(repoRoot);
  assert.equal(targets.length, KNOWLEDGE_HEADER_TARGETS.length);

  for (const target of targets) {
    assert.equal(fs.existsSync(target.sourcePath), true, `${target.relativePath} source is missing`);
    assert.equal(
      path.relative(repoRoot, target.sourcePath).split(path.sep).join('/'),
      target.relativePath,
      `${target.relativePath} did not resolve from the repository root`,
    );
  }
});

test('knowledge header check passes for the repository manifest', () => {
  const result = checkKnowledgeHeaders(repoRoot);
  assert.deepEqual(result.errors, []);
  assert.equal(result.checkedFiles.length, KNOWLEDGE_HEADER_TARGETS.length);
});

test('knowledge header check fails when a target is missing a header', () => {
  const root = createTempRepo({
    files: {
      'src/example.rs': 'pub fn example() {}\n',
    },
  });

  try {
    const result = checkKnowledgeHeaders(root, createManifest(root, 'src/example.rs'));
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /missing knowledge version header/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('knowledge header check fails when versions drift from Cargo.toml', () => {
  const root = createTempRepo({
    files: {
      'src/example.rs': [
        '//! # Example',
        '//!',
        '//! > **Knowledge version**: geppetto 0.2.0 | pinocchio 0.10.x | 2026-04-14',
        '//!',
        'pub fn example() {}',
        '',
      ].join('\n'),
    },
  });

  try {
    const result = checkKnowledgeHeaders(root, createManifest(root, 'src/example.rs'));
    assert.equal(result.errors.length, 2);
    assert.match(result.errors[0], /expected geppetto 0\.1\.0, found 0\.2\.0/);
    assert.match(result.errors[1], /expected pinocchio 0\.11\.x, found 0\.10\.x/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('knowledge header check fails when the date format is invalid', () => {
  const root = createTempRepo({
    files: {
      'src/example.rs': [
        '//! # Example',
        '//!',
        '//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026/04/14',
        '//!',
        'pub fn example() {}',
        '',
      ].join('\n'),
    },
  });

  try {
    const result = checkKnowledgeHeaders(root, createManifest(root, 'src/example.rs'));
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /expected ISO date YYYY-MM-DD, found 2026\/04\/14/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('knowledge header check accepts string-form dependency versions', () => {
  const root = createTempRepo({
    cargoToml: `[package]
name = "temp"
version = "0.1.0"

[dependencies]
pinocchio = "0.11"
`,
    files: {
      'src/example.rs': [
        '//! # Example',
        '//!',
        '//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-14',
        '//!',
        'pub fn example() {}',
        '',
      ].join('\n'),
    },
  });

  try {
    const result = checkKnowledgeHeaders(root, createManifest(root, 'src/example.rs'));
    assert.deepEqual(result.errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('knowledge header check accepts workspace dependency versions', () => {
  const root = createTempRepo({
    cargoToml: `[package]
name = "temp"
version = "0.1.0"

[workspace.dependencies]
pinocchio = "0.11"

[dependencies]
pinocchio = { workspace = true }
`,
    files: {
      'src/example.rs': [
        '//! # Example',
        '//!',
        '//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-14',
        '//!',
        'pub fn example() {}',
        '',
      ].join('\n'),
    },
  });

  try {
    const result = checkKnowledgeHeaders(root, createManifest(root, 'src/example.rs'));
    assert.deepEqual(result.errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

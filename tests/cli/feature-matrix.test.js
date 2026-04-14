const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { checkFeatureMatrix } = require('../../lib/feature-matrix-check');

const repoRoot = path.resolve(__dirname, '..', '..');

const TECH_SPEC_FEATURES_TEMPLATE = [
  '## 1. Cargo.toml',
  '',
  '```toml',
  '[package]',
  'name = "geppetto"',
  'version = "0.1.0"',
  '',
  '[features]',
  'default = []',
  'system = ["dep:pinocchio-system"]',
  'token = ["dep:pinocchio-token"]',
  'token-2022 = ["dep:pinocchio-token-2022"]',
  'ata = ["dep:pinocchio-associated-token-account"]',
  'memo = ["dep:pinocchio-memo"]',
  'log = ["dep:pinocchio-log"]',
  'pubkey = ["dep:pinocchio-pubkey"]',
  'token-all = ["token", "token-2022", "ata"]',
  'full = ["system", "token-all", "memo", "log", "pubkey"]',
  'test-utils = []',
  '```',
  '',
].join('\n');

function createTempRepo({ cargoToml, techSpec }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-feature-matrix-'));

  try {
    const cargoPath = path.join(root, 'Cargo.toml');
    const docsPath = path.join(root, 'docs/03-technical-spec.md');
    fs.mkdirSync(path.dirname(cargoPath), { recursive: true });
    fs.mkdirSync(path.dirname(docsPath), { recursive: true });
    fs.writeFileSync(cargoPath, cargoToml);
    fs.writeFileSync(docsPath, techSpec);
    return root;
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

test('feature matrix check passes for the repository manifest', () => {
  const result = checkFeatureMatrix(repoRoot);
  assert.deepEqual(result.errors, []);
  assert.ok(result.checkedFeatures.includes('full'));
  assert.ok(result.checkedFeatures.includes('token-all'));
  assert.ok(result.checkedFeatures.includes('test-utils'));
});

test('feature matrix check fails when spec full definition drifts', () => {
  const root = createTempRepo({
    cargoToml: fs.readFileSync(path.join(repoRoot, 'Cargo.toml'), 'utf8'),
    techSpec: [
      '## 1. Cargo.toml',
      '',
      '```toml',
      '[package]',
      'name = "geppetto"',
      'version = "0.1.0"',
      '',
      '[features]',
      'default = []',
      'system = ["dep:pinocchio-system"]',
      'token = ["dep:pinocchio-token"]',
      'token-2022 = ["dep:pinocchio-token-2022"]',
      'ata = ["dep:pinocchio-associated-token-account"]',
      'memo = ["dep:pinocchio-memo"]',
      'log = ["dep:pinocchio-log"]',
      'pubkey = ["dep:pinocchio-pubkey"]',
      'token-all = ["token", "token-2022", "ata"]',
      'full = ["system", "token-all", "memo", "log"]',
      'test-utils = []',
      '```',
      '',
    ].join('\n'),
  });

  try {
    const result = checkFeatureMatrix(root, {
      cargoTomlPath: path.join(root, 'Cargo.toml'),
      techSpecPath: path.join(root, 'docs/03-technical-spec.md'),
    });
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /Feature mismatch for full/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('feature matrix check fails when required spec feature is missing', () => {
  const root = createTempRepo({
    cargoToml: fs.readFileSync(path.join(repoRoot, 'Cargo.toml'), 'utf8'),
    techSpec: TECH_SPEC_FEATURES_TEMPLATE.replace('test-utils = []', ''),
  });

  try {
    const result = checkFeatureMatrix(root, {
      cargoTomlPath: path.join(root, 'Cargo.toml'),
      techSpecPath: path.join(root, 'docs/03-technical-spec.md'),
    });
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /docs\/03-technical-spec\.md missing feature: test-utils/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

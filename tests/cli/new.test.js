const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { NEW_PROJECT_TEMPLATE_FILES } = require('../../lib/new-manifest');

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'bin', 'geppetto-cli.js');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-new-'));
}

function removeDir(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

function runCli(cwd, args = []) {
  return execFileSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

test('new command creates expected scaffold files', () => {
  const tempDir = createTempDir();
  const projectName = 'sample-program';

  try {
    const stdout = runCli(tempDir, ['new', projectName]);
    const projectDir = path.join(tempDir, projectName);
    const createdFiles = NEW_PROJECT_TEMPLATE_FILES.map((entry) => entry.relativePath);

    for (const relativePath of createdFiles) {
      const outputPath = path.join(projectDir, relativePath);
      assert.equal(fs.existsSync(outputPath), true, `${relativePath} was not created`);
    }

    const cargo = fs.readFileSync(path.join(projectDir, 'Cargo.toml'), 'utf8');
    assert.match(cargo, /name = "sample-program"/);
    assert.match(stdout, /done new sample-program created=4 skipped=0/);
  } finally {
    removeDir(tempDir);
  }
});

test('new command requires project name', () => {
  const tempDir = createTempDir();

  try {
    assert.throws(() => {
      runCli(tempDir, ['new']);
    }, /Missing or invalid project name/);
  } finally {
    removeDir(tempDir);
  }
});

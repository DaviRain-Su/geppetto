const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { TEMPLATE_FILES } = require('../../lib/init');

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'bin', 'geppetto-cli.js');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-cli-'));
}

function removeDir(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

function runInit(cwd) {
  return execFileSync(process.execPath, [cliPath, 'init'], {
    cwd,
    encoding: 'utf8',
  });
}

function readRepoTemplate(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath));
}

test('init creates all canonical files in an empty directory', () => {
  const tempDir = createTempDir();

  try {
    const stdout = runInit(tempDir);

    for (const relativePath of TEMPLATE_FILES) {
      const outputPath = path.join(tempDir, relativePath);
      assert.equal(fs.existsSync(outputPath), true, `${relativePath} was not created`);
      assert.deepEqual(
        fs.readFileSync(outputPath),
        readRepoTemplate(relativePath),
        `${relativePath} did not match canonical template`,
      );
    }

    assert.match(stdout, /created AGENTS\.md/);
    assert.match(stdout, /created \.github\/copilot-instructions\.md/);
    assert.match(stdout, /done created=8 skipped=0/);
  } finally {
    removeDir(tempDir);
  }
});

test('init skips existing files without overwriting them', () => {
  const tempDir = createTempDir();
  const sentinel = 'keep-me\n';

  try {
    const existingFiles = ['AGENTS.md', '.cursor/rules/geppetto.md'];

    for (const relativePath of existingFiles) {
      const outputPath = path.join(tempDir, relativePath);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, sentinel);
    }

    const stdout = runInit(tempDir);

    for (const relativePath of existingFiles) {
      const outputPath = path.join(tempDir, relativePath);
      assert.equal(fs.readFileSync(outputPath, 'utf8'), sentinel);
      assert.match(stdout, new RegExp(`skipped ${relativePath.replace('.', '\\.')}`));
    }

    for (const relativePath of TEMPLATE_FILES.filter((file) => !existingFiles.includes(file))) {
      const outputPath = path.join(tempDir, relativePath);
      assert.equal(fs.existsSync(outputPath), true, `${relativePath} was not created`);
      assert.deepEqual(
        fs.readFileSync(outputPath),
        readRepoTemplate(relativePath),
        `${relativePath} did not match canonical template`,
      );
    }

    assert.match(stdout, /done created=6 skipped=2/);
  } finally {
    removeDir(tempDir);
  }
});

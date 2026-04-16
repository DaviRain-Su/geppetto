const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { TEMPLATE_FILES } = require('../../lib/templates');

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'bin', 'geppetto-cli.ts');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-cli-'));
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

function runInit(cwd, args = []) {
  return runCli(cwd, ['init', ...args]);
}

function readRepoTemplate(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath));
}

function listFilesRecursively(rootDir) {
  const results = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
      } else {
        results.push(path.relative(rootDir, absolutePath).split(path.sep).join('/'));
      }
    }
  }

  walk(rootDir);
  return results.sort();
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
    assert.deepEqual(listFilesRecursively(tempDir), [...TEMPLATE_FILES].sort());
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
    assert.deepEqual(listFilesRecursively(tempDir), [...TEMPLATE_FILES].sort());
  } finally {
    removeDir(tempDir);
  }
});

test('init --dry-run previews all canonical files in an empty directory without writing them', () => {
  const tempDir = createTempDir();

  try {
    const stdout = runInit(tempDir, ['--dry-run']);

    for (const relativePath of TEMPLATE_FILES) {
      assert.match(stdout, new RegExp(`would-create ${relativePath.replaceAll('.', '\\.')}`));
    }

    assert.match(stdout, /done dry-run would-create=8 skipped=0/);
    assert.deepEqual(listFilesRecursively(tempDir), []);
  } finally {
    removeDir(tempDir);
  }
});

test('init --dry-run preserves existing files and does not create missing ones', () => {
  const tempDir = createTempDir();
  const sentinel = 'keep-me\n';

  try {
    const existingFiles = ['AGENTS.md', '.cursor/rules/geppetto.md'];

    for (const relativePath of existingFiles) {
      const outputPath = path.join(tempDir, relativePath);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, sentinel);
    }

    const stdout = runInit(tempDir, ['--dry-run']);

    for (const relativePath of existingFiles) {
      const outputPath = path.join(tempDir, relativePath);
      assert.equal(fs.readFileSync(outputPath, 'utf8'), sentinel);
      assert.match(stdout, new RegExp(`skipped ${relativePath.replaceAll('.', '\\.')}`));
    }

    for (const relativePath of TEMPLATE_FILES.filter((file) => !existingFiles.includes(file))) {
      const outputPath = path.join(tempDir, relativePath);
      assert.equal(fs.existsSync(outputPath), false, `${relativePath} should not be created during dry-run`);
      assert.match(stdout, new RegExp(`would-create ${relativePath.replaceAll('.', '\\.')}`));
    }

    assert.match(stdout, /done dry-run would-create=6 skipped=2/);
    assert.deepEqual(listFilesRecursively(tempDir), [...existingFiles].sort());
  } finally {
    removeDir(tempDir);
  }
});

test('help output documents init --dry-run preview mode', () => {
  const tempDir = createTempDir();

  try {
    const stdout = runCli(tempDir, ['init', '--help']);
    assert.match(stdout, /Usage: geppetto-cli <command> \[options\]/);
    assert.match(stdout, /init \[--dry-run\]/);
    assert.match(stdout, /without writing files/);
  } finally {
    removeDir(tempDir);
  }
});

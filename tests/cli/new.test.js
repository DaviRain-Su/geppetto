const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { getNewProjectTemplateEntries, getTemplateRoot } = require('../../lib/new-manifest');
const { renderTemplate } = require('../../lib/new');
const { getTemplateEntries } = require('../../lib/templates');

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
    const createdFiles = getNewProjectTemplateEntries().map((entry) => entry.relativePath);

    for (const relativePath of createdFiles) {
      const outputPath = path.join(projectDir, relativePath);
      assert.equal(fs.existsSync(outputPath), true, `${relativePath} was not created`);
    }

    const cargo = fs.readFileSync(path.join(projectDir, 'Cargo.toml'), 'utf8');
    assert.match(cargo, /name = "sample_program"/);
    assert.match(stdout, /done new sample-program created=15 skipped=0/);
  } finally {
    removeDir(tempDir);
  }
});

test('new command supports template variable expansion', () => {
  const tempDir = createTempDir();
  const projectName = 'my-program';

  try {
    runCli(tempDir, ['new', projectName]);
    const projectDir = path.join(tempDir, projectName);

    const templateRoot = getTemplateRoot();
    const canonicalEntries = getTemplateEntries(templateRoot);

    for (const { relativePath } of canonicalEntries) {
      const outputPath = path.join(projectDir, relativePath);
      const expected = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
      const actual = fs.readFileSync(outputPath, 'utf8');
      assert.equal(actual, expected);
    }

    const cargo = fs.readFileSync(path.join(projectDir, 'Cargo.toml'), 'utf8');
    const processor = fs.readFileSync(path.join(projectDir, 'src/processor.rs'), 'utf8');

    assert.match(cargo, /name = "my_program"/);
    assert.match(processor, /\/\/ my_program/);
  } finally {
    removeDir(tempDir);
  }
});

test('new command normalizes crate name for hyphenated input', () => {
  const tempDir = createTempDir();
  const projectName = 'my_program';

  try {
    runCli(tempDir, ['new', projectName]);
    const projectDir = path.join(tempDir, projectName);
    const cargo = fs.readFileSync(path.join(projectDir, 'Cargo.toml'), 'utf8');
    const processor = fs.readFileSync(path.join(projectDir, 'src/processor.rs'), 'utf8');

    assert.match(cargo, /name = "my_program"/);
    assert.match(processor, /\/\/ my_program/);
  } finally {
    removeDir(tempDir);
  }
});

test('new command rejects templates with unknown variables', () => {
  assert.throws(() => {
    renderTemplate('invalid {{UNKNOWN_VARIABLE}}', {
      PROJECT_NAME: 'sample-program',
      CRATE_NAME: 'sample_program',
      PACKAGE_NAME: 'sample_program',
      PROGRAM_NAME: 'sample-program',
    });
  }, /Unknown template variables in template: UNKNOWN_VARIABLE/);
});

test('generated template files contain no unreplaced placeholders', () => {
  const tempDir = createTempDir();
  const projectName = 'templated-program';

  try {
    runCli(tempDir, ['new', projectName]);
    const projectDir = path.join(tempDir, projectName);

    const createdFiles = getNewProjectTemplateEntries().map((entry) => entry.relativePath);

    for (const relativePath of createdFiles) {
      const content = fs.readFileSync(path.join(projectDir, relativePath), 'utf8');
      assert.equal(/\{\{[A-Z0-9_]+\}\}/.test(content), false, `${relativePath} contains unresolved placeholder`);
    }
  } finally {
    removeDir(tempDir);
  }
});

test('new command allows creating into an existing empty directory', () => {
  const tempDir = createTempDir();
  const projectName = 'empty-program';
  const projectDir = path.join(tempDir, projectName);

  try {
    fs.mkdirSync(projectDir, { recursive: true });
    const stdout = runCli(tempDir, ['new', projectName]);

    assert.equal(fs.existsSync(path.join(projectDir, 'Cargo.toml')), true);
    assert.match(stdout, /done new empty-program created=15 skipped=0/);
  } finally {
    removeDir(tempDir);
  }
});

test('new command refuses existing non-empty target directory', () => {
  const tempDir = createTempDir();
  const projectName = 'occupied-program';
  const projectDir = path.join(tempDir, projectName);

  try {
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'README.md'), 'pre-existing');

    assert.throws(() => {
      runCli(tempDir, ['new', projectName]);
    }, /Target directory is not empty: occupied-program/);
  } finally {
    removeDir(tempDir);
  }
});

test('new command fails when directory already has generated files', () => {
  const tempDir = createTempDir();
  const projectName = 'sample-program';

  try {
    const projectDir = path.join(tempDir, projectName);
    const firstRun = runCli(tempDir, ['new', projectName]);
    assert.match(firstRun, /done new sample-program created=15 skipped=0/);

    assert.throws(() => {
      runCli(tempDir, ['new', projectName]);
    }, /Target directory is not empty: sample-program/);
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

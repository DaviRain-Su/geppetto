const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const { PACKAGE_REQUIRED_FILES } = require('../../lib/templates');

const repoRoot = path.resolve(__dirname, '..', '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

test('npm pack dry-run includes every required CLI template asset', () => {
  const stdout = execFileSync(npmCommand, ['pack', '--dry-run', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const [packResult] = JSON.parse(stdout);
  assert.ok(packResult, 'npm pack --dry-run returned no package metadata');

  const packagedFiles = new Set(packResult.files.map((file) => file.path));

  for (const relativePath of PACKAGE_REQUIRED_FILES) {
    assert.equal(
      packagedFiles.has(relativePath),
      true,
      `${relativePath} is missing from the packed CLI artifact`,
    );
  }
});

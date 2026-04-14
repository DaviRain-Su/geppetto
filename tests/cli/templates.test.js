const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  TEMPLATE_FILES,
  assertTemplateManifest,
  getTemplateEntries,
  getTemplateRoot,
} = require('../../lib/templates');
const { initProject } = require('../../lib/init');

const repoRoot = path.resolve(__dirname, '..', '..');

test('template manifest points at canonical repository files', () => {
  assert.equal(getTemplateRoot(), repoRoot);
  assert.doesNotThrow(() => assertTemplateManifest(repoRoot));

  const entries = getTemplateEntries(repoRoot);
  assert.deepEqual(
    entries.map((entry) => entry.relativePath),
    TEMPLATE_FILES,
  );

  for (const entry of entries) {
    assert.equal(fs.existsSync(entry.sourcePath), true, `${entry.relativePath} source is missing`);
    assert.equal(
      path.relative(repoRoot, entry.sourcePath).split(path.sep).join('/'),
      entry.relativePath,
      `${entry.relativePath} did not resolve from the canonical repository root`,
    );
  }
});

test('initProject returns the exact template manifest set', () => {
  const tempDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'geppetto-template-'));

  try {
    const results = initProject(tempDir, { templateRoot: repoRoot });
    assert.deepEqual(
      results,
      TEMPLATE_FILES.map((relativePath) => ({ path: relativePath, status: 'created' })),
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

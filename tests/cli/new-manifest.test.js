const assert = require('node:assert/strict');
const test = require('node:test');

const { NEW_PROJECT_TEMPLATE_FILES, assertNewProjectManifest } = require('../../lib/new-manifest');

test('new project manifest contains expected entries', () => {
  const snapshot = NEW_PROJECT_TEMPLATE_FILES.map((entry) => entry.relativePath);
  assert.deepEqual(snapshot, [
    'Cargo.toml',
    'src/lib.rs',
    'src/processor.rs',
    'src/state.rs',
    'src/error.rs',
    'src/instructions/mod.rs',
    'tests/svm.rs',
  ]);
});

test('new project manifest validates manifest invariants', () => {
  assert.doesNotThrow(() => {
    assertNewProjectManifest();
  });
});

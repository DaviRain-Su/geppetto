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

test('new project test template includes E5-05 svm test scaffold', () => {
  const testsTemplate = NEW_PROJECT_TEMPLATE_FILES.find(
    (entry) => entry.relativePath === 'tests/svm.rs',
  );
  assert.ok(testsTemplate);
  assert.match(testsTemplate.content, /build_ix_data/);
  assert.match(testsTemplate.content, /setup_mollusk\(\)/);
  assert.match(testsTemplate.content, /test_svm_placeholder_happy_path/);
  assert.match(testsTemplate.content, /test_svm_placeholder_error_path/);
});

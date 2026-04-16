import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NEW_PROJECT_RUST_TEMPLATE_FILES,
  assertNewProjectManifest,
  getNewProjectTemplateEntries,
  getTemplateRoot,
} from '../../lib/new-manifest'

const { getTemplateEntries } = require('../../lib/templates') as {
  getTemplateEntries: (templateRoot?: string) => Array<{ relativePath: string; sourcePath: string }>
}

test('new project manifest contains expected entries', () => {
  const templateRoot = getTemplateRoot()
  const snapshot = getNewProjectTemplateEntries(templateRoot).map((entry) => entry.relativePath)
  const expected = [
    ...NEW_PROJECT_RUST_TEMPLATE_FILES.map((entry) => entry.relativePath),
    ...getTemplateEntries(templateRoot).map((entry: { relativePath: string }) => entry.relativePath),
  ]

  assert.deepEqual(snapshot, [
    ...expected,
  ])
})

test('new project manifest validates manifest invariants', () => {
  assert.doesNotThrow(() => {
    assertNewProjectManifest()
  })
})

test('new project test template includes E5-05 svm test scaffold', () => {
  const templateRoot = getTemplateRoot()
  const testsTemplate = getNewProjectTemplateEntries(templateRoot).find(
    (entry) => entry.relativePath === 'tests/svm.rs',
  )
  assert.ok(testsTemplate)
  assert.match(testsTemplate.content, /build_ix_data/)
  assert.match(testsTemplate.content, /setup_mollusk\(\)/)
  assert.match(testsTemplate.content, /test_svm_placeholder_happy_path/)
  assert.match(testsTemplate.content, /test_svm_placeholder_error_path/)
})

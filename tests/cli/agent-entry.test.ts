import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import test from 'node:test'

import {
  AGENT_ENTRY_MIRROR_TARGETS,
  assertAgentEntryManifest,
  checkAgentEntryMirrors,
  getAgentEntryRoot,
  getAgentEntryTargets,
} from '../../lib/agent-entry-check'

const repoRoot = path.resolve(__dirname, '..', '..')

function createTempRepo(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-agent-entry-'))

  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = path.join(root, relativePath)
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
      fs.writeFileSync(absolutePath, content)
    }
    return root
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true })
    throw error
  }
}

function createManifest(root: string, relativePath: string, expectedContent = '@AGENTS.md') {
  return [{
    relativePath,
    sourcePath: path.join(root, relativePath),
    expectedContent,
  }]
}

test('agent entry manifest points at existing repository files', () => {
  assert.equal(getAgentEntryRoot(), repoRoot)
  assert.doesNotThrow(() => assertAgentEntryManifest(repoRoot))

  const targets = getAgentEntryTargets(repoRoot)
  assert.equal(targets.length, AGENT_ENTRY_MIRROR_TARGETS.length)

  for (const target of targets) {
    assert.equal(fs.existsSync(target.sourcePath), true, `${target.relativePath} source is missing`)
    assert.equal(
      path.relative(repoRoot, target.sourcePath).split(path.sep).join('/'),
      target.relativePath,
      `${target.relativePath} did not resolve from the repository root`,
    )
  }
})

test('agent entry check passes for the repository manifest', () => {
  const result = checkAgentEntryMirrors(repoRoot)
  assert.deepEqual(result.errors, [])
  assert.equal(result.checkedFiles.length, AGENT_ENTRY_MIRROR_TARGETS.length)
})

test('agent entry check fails when CLAUDE include drifts', () => {
  const root = createTempRepo({
    'CLAUDE.md': 'Read AGENTS.md manually.\n',
  })

  try {
    const result = checkAgentEntryMirrors(root, createManifest(root, 'CLAUDE.md'))
    assert.equal(result.errors.length, 1)
    assert.match(result.errors[0], /CLAUDE\.md: expected exact AGENTS mirror content/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('agent entry check fails when redirect mirrors drift', () => {
  const root = createTempRepo({
    'GEMINI.md': 'Open README.md first.\n',
  })

  try {
    const result = checkAgentEntryMirrors(
      root,
      createManifest(
        root,
        'GEMINI.md',
        'Read and follow all instructions in AGENTS.md in this repository.',
      ),
    )
    assert.equal(result.errors.length, 1)
    assert.match(result.errors[0], /GEMINI\.md: expected exact AGENTS mirror content/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('agent entry check fails when aider config drifts', () => {
  const root = createTempRepo({
    '.aider.conf.yml': 'read:\n  - README.md\n',
  })

  try {
    const result = checkAgentEntryMirrors(
      root,
      createManifest(root, '.aider.conf.yml', 'read:\n  - AGENTS.md'),
    )
    assert.equal(result.errors.length, 1)
    assert.match(result.errors[0], /\.aider\.conf\.yml: expected exact AGENTS mirror content/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

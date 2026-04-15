const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const output = require('../../lib/platform/output')

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-output-'))
}

function removeDir(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true })
}

function makeState(overrides = {}) {
  return {
    run_id: overrides.run_id || 'run_20260415_140000',
    app_name: overrides.app_name || 'escrow-demo',
    cluster: overrides.cluster || 'devnet',
    program_id: overrides.program_id !== undefined ? overrides.program_id : 'abc123',
    service_url: overrides.service_url !== undefined ? overrides.service_url : 'https://example.test',
    provider_deployment_id: overrides.provider_deployment_id !== undefined ? overrides.provider_deployment_id : 'dep_123',
    status: overrides.status || 'success',
    failure_class: overrides.failure_class !== undefined ? overrides.failure_class : null,
    steps: overrides.steps !== undefined ? overrides.steps : [
      { name: 'buildProgram', status: 'success', elapsed_ms: 100 },
    ],
  }
}

// Snapshot-like test: ensure JSON field names are stable
test('buildJsonOutput produces stable contract', () => {
  const state = makeState()
  const json = output.buildJsonOutput(state)

  assert.deepEqual(Object.keys(json).sort(), [
    'app_name',
    'cluster',
    'failure_class',
    'program_id',
    'provider_deployment_id',
    'run_id',
    'service_url',
    'status',
    'steps',
  ])

  assert.equal(json.run_id, 'run_20260415_140000')
  assert.equal(json.program_id, 'abc123')
  assert.equal(json.service_url, 'https://example.test')
  assert.equal(json.status, 'success')
})

test('buildJsonOutput converts empty strings to null', () => {
  const state = makeState({ program_id: '', service_url: '', provider_deployment_id: '' })
  const json = output.buildJsonOutput(state)

  assert.equal(json.program_id, null)
  assert.equal(json.service_url, null)
  assert.equal(json.provider_deployment_id, null)
})

test('renderDeployOutput JSON format matches contract', () => {
  const state = makeState()
  let written = ''
  const stream = { write: (s) => { written += s } }

  output.renderDeployOutput(state, 'json', stream)
  const parsed = JSON.parse(written)
  assert.equal(parsed.run_id, state.run_id)
  assert.equal(parsed.status, state.status)
})

test('renderDeployOutput table format includes icons and errors', () => {
  const state = makeState({
    status: 'failure',
    failure_class: 'build',
    steps: [
      { name: 'buildProgram', status: 'success', elapsed_ms: 50 },
      { name: 'deployProgram', status: 'failure', elapsed_ms: 200, error: 'EDEPLOY001: boom' },
    ],
  })

  let written = ''
  const stream = { write: (s) => { written += s } }

  output.renderDeployOutput(state, 'table', stream)
  assert.ok(written.includes('✓ buildProgram'))
  assert.ok(written.includes('✗ deployProgram'))
  assert.ok(written.includes('EDEPLOY001: boom'))
  assert.ok(written.includes('Failure:   build'))
})

test('writeArtifacts creates .geppetto and writes both files', () => {
  const tempDir = createTempDir()

  try {
    const state = makeState()
    output.writeArtifacts(state, tempDir)

    const jsonPath = path.join(tempDir, '.geppetto', 'deploy-output.json')
    const txtPath = path.join(tempDir, '.geppetto', 'deploy-output.txt')

    assert.ok(fs.existsSync(jsonPath), 'deploy-output.json should exist')
    assert.ok(fs.existsSync(txtPath), 'deploy-output.txt should exist')

    const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    assert.equal(jsonContent.run_id, state.run_id)
    assert.equal(jsonContent.status, state.status)

    const txtContent = fs.readFileSync(txtPath, 'utf8')
    assert.ok(txtContent.includes(state.run_id))
    assert.ok(txtContent.includes(state.app_name))
    assert.ok(txtContent.includes('✓ buildProgram'))
  } finally {
    removeDir(tempDir)
  }
})

test('writeArtifacts writes failure state correctly', () => {
  const tempDir = createTempDir()

  try {
    const state = makeState({
      status: 'failure',
      failure_class: 'deploy',
      program_id: '',
      service_url: '',
      provider_deployment_id: '',
      steps: [
        { name: 'deployProgram', status: 'failure', elapsed_ms: 300, error: 'EDEPLOY002: timeout' },
      ],
    })

    output.writeArtifacts(state, tempDir)

    const jsonPath = path.join(tempDir, '.geppetto', 'deploy-output.json')
    const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    assert.equal(jsonContent.status, 'failure')
    assert.equal(jsonContent.failure_class, 'deploy')
    assert.equal(jsonContent.program_id, null)

    const txtPath = path.join(tempDir, '.geppetto', 'deploy-output.txt')
    const txtContent = fs.readFileSync(txtPath, 'utf8')
    assert.ok(txtContent.includes('Failure:   deploy'))
    assert.ok(txtContent.includes('✗ deployProgram'))
    assert.ok(txtContent.includes('EDEPLOY002: timeout'))
  } finally {
    removeDir(tempDir)
  }
})

test('writeArtifacts overwrites existing files', () => {
  const tempDir = createTempDir()

  try {
    fs.mkdirSync(path.join(tempDir, '.geppetto'), { recursive: true })
    fs.writeFileSync(path.join(tempDir, '.geppetto', 'deploy-output.json'), 'old', 'utf8')

    const state = makeState()
    output.writeArtifacts(state, tempDir)

    const jsonContent = fs.readFileSync(path.join(tempDir, '.geppetto', 'deploy-output.json'), 'utf8')
    assert.ok(jsonContent.includes('run_20260415_140000'))
  } finally {
    removeDir(tempDir)
  }
})

test('writeArtifacts throws EDEPLOY005 when fs.writeFileSync fails', () => {
  const tempDir = createTempDir()
  const originalWriteFileSync = fs.writeFileSync

  try {
    fs.writeFileSync = () => {
      throw new Error('read-only filesystem')
    }

    const state = makeState()
    assert.throws(() => {
      output.writeArtifacts(state, tempDir)
    }, (error) => {
      assert.equal(error.code, 'EDEPLOY005')
      assert.equal(error.failureClass, 'deploy')
      assert.ok(error.message.includes('read-only filesystem'))
      return true
    })
  } finally {
    fs.writeFileSync = originalWriteFileSync
    removeDir(tempDir)
  }
})

// --- writeBackProgramId ---

function writeManifest(tempDir, programId = '') {
  const manifest = [
    'schema_version = "0.1"',
    '',
    '[app]',
    'name = "escrow-demo"',
    '',
    '[solana]',
    `program_id = "${programId}"`,
    'cluster = "devnet"',
    '',
    '[offchain]',
    'provider = "encore-cloud"',
    '',
  ].join('\n')

  fs.writeFileSync(path.join(tempDir, 'geppetto.toml'), manifest, 'utf8')
}

function writeManifestWithoutProgramId(tempDir) {
  const manifest = [
    'schema_version = "0.1"',
    '',
    '[app]',
    'name = "escrow-demo"',
    '',
    '[solana]',
    'cluster = "devnet"',
    '',
    '[offchain]',
    'provider = "encore-cloud"',
    '',
  ].join('\n')

  fs.writeFileSync(path.join(tempDir, 'geppetto.toml'), manifest, 'utf8')
}

test('writeBackProgramId updates existing program_id', () => {
  const tempDir = createTempDir()

  try {
    writeManifest(tempDir, 'old-id')
    output.writeBackProgramId(path.join(tempDir, 'geppetto.toml'), 'new-id-123')

    const content = fs.readFileSync(path.join(tempDir, 'geppetto.toml'), 'utf8')
    assert.ok(content.includes('program_id = "new-id-123"'))
    assert.ok(!content.includes('program_id = "old-id"'))
    assert.ok(content.includes('cluster = "devnet"'))
  } finally {
    removeDir(tempDir)
  }
})

test('writeBackProgramId adds program_id when missing', () => {
  const tempDir = createTempDir()

  try {
    writeManifestWithoutProgramId(tempDir)
    output.writeBackProgramId(path.join(tempDir, 'geppetto.toml'), 'new-id-123')

    const content = fs.readFileSync(path.join(tempDir, 'geppetto.toml'), 'utf8')
    assert.ok(content.includes('program_id = "new-id-123"'))
    assert.ok(content.includes('cluster = "devnet"'))
  } finally {
    removeDir(tempDir)
  }
})

test('writeBackProgramId is idempotent', () => {
  const tempDir = createTempDir()

  try {
    writeManifest(tempDir, 'old-id')
    output.writeBackProgramId(path.join(tempDir, 'geppetto.toml'), 'same-id')
    output.writeBackProgramId(path.join(tempDir, 'geppetto.toml'), 'same-id')

    const content = fs.readFileSync(path.join(tempDir, 'geppetto.toml'), 'utf8')
    const matches = content.match(/program_id = "same-id"/g)
    assert.equal(matches.length, 1)
  } finally {
    removeDir(tempDir)
  }
})

test('writeBackProgramId skips when programId is empty', () => {
  const tempDir = createTempDir()

  try {
    writeManifest(tempDir, 'old-id')
    output.writeBackProgramId(path.join(tempDir, 'geppetto.toml'), '')

    const content = fs.readFileSync(path.join(tempDir, 'geppetto.toml'), 'utf8')
    assert.ok(content.includes('program_id = "old-id"'))
  } finally {
    removeDir(tempDir)
  }
})

test('writeBackProgramId preserves inline comment on program_id line', () => {
  const tempDir = createTempDir()

  try {
    const manifest = [
      'schema_version = "0.1"',
      '',
      '[app]',
      'name = "test"',
      '',
      '[solana]',
      'cluster = "devnet"',
      'program_path = "examples/escrow"',
      'program_binary = "target/deploy/escrow.so"',
      'keypair = "~/.config/solana/id.json"',
      'program_id = "old-id" # linked after first deploy',
      '',
      '[offchain]',
      'provider = "encore-cloud"',
      'encore_app = "test-api"',
      'project_path = "examples/escrow-api"',
      '',
      '[deploy]',
      'mode = "hybrid"',
    ].join('\n')
    fs.writeFileSync(path.join(tempDir, 'geppetto.toml'), manifest, 'utf8')

    output.writeBackProgramId(path.join(tempDir, 'geppetto.toml'), 'new-id-456')

    const content = fs.readFileSync(path.join(tempDir, 'geppetto.toml'), 'utf8')
    assert.ok(content.includes('program_id = "new-id-456" # linked after first deploy'),
      'inline comment should be preserved after write-back')
  } finally {
    removeDir(tempDir)
  }
})

test('writeBackProgramId does not modify adjacent lines', () => {
  const tempDir = createTempDir()

  try {
    writeManifest(tempDir, 'old-id')
    const before = fs.readFileSync(path.join(tempDir, 'geppetto.toml'), 'utf8')
    const beforeLines = before.split('\n')

    output.writeBackProgramId(path.join(tempDir, 'geppetto.toml'), 'new-id-789')

    const after = fs.readFileSync(path.join(tempDir, 'geppetto.toml'), 'utf8')
    const afterLines = after.split('\n')

    // Same number of lines
    assert.equal(afterLines.length, beforeLines.length, 'line count should not change')

    // Only the program_id line should differ
    for (let i = 0; i < beforeLines.length; i++) {
      if (beforeLines[i].trim().startsWith('program_id')) continue
      assert.equal(afterLines[i], beforeLines[i], `line ${i + 1} should not change`)
    }
  } finally {
    removeDir(tempDir)
  }
})

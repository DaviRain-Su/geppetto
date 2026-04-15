const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  parseGeppettoToml,
  loadPlatformConfig,
} = require('../../lib/platform/config')
const {
  parseSetValues,
  applyOverrides,
} = require('../../lib/platform/overrides')

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-platform-config-'))
}

function removeDir(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true })
}

function writeManifest(root, extra = {}) {
  const programPath = extra.programPath || 'examples/escrow'
  const projectPath = extra.projectPath || 'examples/escrow-api'
  const encoreMarker = path.join(root, projectPath, 'encore.app')

  fs.mkdirSync(path.join(root, programPath), { recursive: true })
  fs.mkdirSync(path.dirname(encoreMarker), { recursive: true })
  fs.writeFileSync(encoreMarker, 'encore app')

  const manifest = [
    'schema_version = "0.1"',
    '',
    '[app]',
    'name = "escrow-demo"',
    '',
    '[solana]',
    `cluster = "${extra.cluster || 'devnet'}"`,
    `program_path = "${programPath}"`,
    'program_binary = "target/deploy/escrow.so"',
    'keypair = "~/.config/solana/id.json"',
    `program_id = "${extra.programId || ''}"`,
    '',
    '[offchain]',
    'provider = "encore-cloud"',
    'encore_app = "escrow-demo-api"',
    `project_path = "${projectPath}"`,
    '',
    '[deploy]',
    'mode = "hybrid"',
    `output = "${extra.output || 'table'}"`,
    '',
  ].join('\n')

  fs.writeFileSync(path.join(root, 'geppetto.toml'), manifest)
}

test('parseGeppettoToml reads top-level and section values', () => {
  const parsed = parseGeppettoToml([
    'schema_version = "0.1"',
    '[app]',
    'name = "escrow-demo"',
    '[solana]',
    'cluster = "devnet"',
  ].join('\n'))

  assert.equal(parsed.schema_version, '0.1')
  assert.equal(parsed.app.name, 'escrow-demo')
  assert.equal(parsed.solana.cluster, 'devnet')
})

test('loadPlatformConfig returns normalized config', () => {
  const tempDir = createTempDir()

  try {
    writeManifest(tempDir)
    const config = loadPlatformConfig({ cwd: tempDir })

    assert.equal(config.schemaVersion, '0.1')
    assert.equal(config.app.name, 'escrow-demo')
    assert.equal(config.solana.cluster, 'devnet')
    assert.equal(config.solana.programId, '')
    assert.equal(config.offchain.encoreApp, 'escrow-demo-api')
    assert.match(config.paths.encoreMarkerPath, /encore\.app$/)
  } finally {
    removeDir(tempDir)
  }
})

test('loadPlatformConfig rejects missing manifest', () => {
  const tempDir = createTempDir()

  try {
    assert.throws(() => {
      loadPlatformConfig({ cwd: tempDir })
    }, /ECFG001|Missing geppetto\.toml/)
  } finally {
    removeDir(tempDir)
  }
})

test('loadPlatformConfig rejects invalid cluster', () => {
  const tempDir = createTempDir()

  try {
    writeManifest(tempDir, { cluster: 'localnet' })

    assert.throws(() => {
      loadPlatformConfig({ cwd: tempDir })
    }, /Invalid value for solana\.cluster/)
  } finally {
    removeDir(tempDir)
  }
})

test('loadPlatformConfig rejects project path without encore.app marker', () => {
  const tempDir = createTempDir()

  try {
    writeManifest(tempDir)
    fs.rmSync(path.join(tempDir, 'examples', 'escrow-api', 'encore.app'))

    assert.throws(() => {
      loadPlatformConfig({ cwd: tempDir })
    }, /Encore app marker not found/)
  } finally {
    removeDir(tempDir)
  }
})

test('parseSetValues supports whitelist keys and values with equals', () => {
  const overrides = parseSetValues([
    'cluster=devnet',
    'service_name=escrow=api',
  ])

  assert.deepEqual(overrides, {
    cluster: 'devnet',
    service_name: 'escrow=api',
  })
})

test('parseSetValues rejects invalid keys and formats', () => {
  assert.throws(() => {
    parseSetValues(['invalid'])
  }, /Invalid --set format/)

  assert.throws(() => {
    parseSetValues(['foo=bar'])
  }, /Unsupported override key/)
})

test('applyOverrides applies allowlisted values with correct precedence shape', () => {
  const tempDir = createTempDir()

  try {
    writeManifest(tempDir)
    const config = loadPlatformConfig({ cwd: tempDir })
    const next = applyOverrides(config, {
      cluster: 'testnet',
      program_id: 'abc123',
      service_name: 'renamed-api',
      replicas: '3',
    })

    assert.equal(next.solana.cluster, 'testnet')
    assert.equal(next.solana.programId, 'abc123')
    assert.equal(next.offchain.encoreApp, 'renamed-api')
    assert.equal(next.deploy.replicas, 3)
    assert.equal(config.solana.cluster, 'devnet')
  } finally {
    removeDir(tempDir)
  }
})

test('applyOverrides rejects invalid replicas', () => {
  const tempDir = createTempDir()

  try {
    writeManifest(tempDir)
    const config = loadPlatformConfig({ cwd: tempDir })

    assert.throws(() => {
      applyOverrides(config, { replicas: '0' })
    }, /Invalid replicas override/)
  } finally {
    removeDir(tempDir)
  }
})

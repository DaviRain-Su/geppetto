const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const solana = require('../../lib/platform/adapters/solana')

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-solana-adapter-'))
}

function removeDir(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true })
}

function makeConfig(tempDir, overrides = {}) {
  const programPath = path.join(tempDir, 'program')
  fs.mkdirSync(programPath, { recursive: true })

  const binaryPath = path.join(programPath, 'target', 'deploy', 'test.so')
  fs.mkdirSync(path.dirname(binaryPath), { recursive: true })
  fs.writeFileSync(binaryPath, 'fake-so')

  return {
    solana: {
      cluster: overrides.cluster || 'devnet',
      programBinary: overrides.programBinary || 'program/target/deploy/test.so',
      programId: overrides.programId || '',
      keypair: overrides.keypair || '~/.config/solana/id.json',
    },
    paths: {
      repoRoot: tempDir,
      programPath,
    },
  }
}

function withMockRunner(mockFn, testFn) {
  const original = solana.runner.exec
  solana.runner.exec = mockFn
  return testFn()
    .finally(() => {
      solana.runner.exec = original
    })
}

test('resolveHome expands tilde to home directory', () => {
  const result = solana.resolveHome('~/.config/solana/id.json')
  assert.equal(result, path.join(os.homedir(), '.config/solana/id.json'))
  assert.equal(solana.resolveHome('/absolute/path'), '/absolute/path')
  assert.equal(solana.resolveHome('relative/path'), 'relative/path')
})

test('build runs cargo build-sbf in program directory', async () => {
  const tempDir = createTempDir()
  const mock = async (file, args, options) => {
    assert.equal(file, 'cargo')
    assert.deepEqual(args, ['build-sbf'])
    assert.equal(options.cwd, path.join(tempDir, 'program'))
    return { stdout: '', stderr: '' }
  }

  try {
    await withMockRunner(mock, async () => {
      const config = makeConfig(tempDir)
      await solana.build({}, config)
    })
  } finally {
    removeDir(tempDir)
  }
})

test('build throws EBUILD001 when cargo fails', async () => {
  const tempDir = createTempDir()
  const mock = async () => {
    throw new Error('compilation failed')
  }

  try {
    await withMockRunner(mock, async () => {
      const config = makeConfig(tempDir)
      await assert.rejects(async () => {
        await solana.build({}, config)
      }, /EBUILD001|Program build failed/)
    })
  } finally {
    removeDir(tempDir)
  }
})

test('build throws EBUILD001 when binary missing after build', async () => {
  const tempDir = createTempDir()
  const mock = async () => ({ stdout: '', stderr: '' })

  try {
    await withMockRunner(mock, async () => {
      const config = makeConfig(tempDir)
      fs.rmSync(path.join(tempDir, 'program', 'target', 'deploy', 'test.so'))

      await assert.rejects(async () => {
        await solana.build({}, config)
      }, /EBUILD001|Program binary not found after build/)
    })
  } finally {
    removeDir(tempDir)
  }
})

test('deploy runs solana program deploy and extracts program_id', async () => {
  const tempDir = createTempDir()
  const mock = async (file, args, options) => {
    assert.equal(file, 'solana')
    assert.equal(args[0], 'program')
    assert.equal(args[1], 'deploy')
    assert.equal(args[2], path.join(tempDir, 'program', 'target', 'deploy', 'test.so'))
    assert.ok(args.includes('--url'))
    assert.ok(args.includes('https://api.devnet.solana.com'))
    assert.ok(args.includes('--keypair'))
    assert.ok(args.includes(path.join(os.homedir(), '.config/solana/id.json')))
    assert.equal(options.maxBuffer, 10 * 1024 * 1024)
    return {
      stdout: 'Program Id: 6G2CCaJF9Brfd1sRtNawpWWXzm7uWc6cb8BZbTRibAKD\nSignature: abc\n',
      stderr: '',
    }
  }

  try {
    await withMockRunner(mock, async () => {
      const config = makeConfig(tempDir)
      const result = await solana.deploy({}, config)
      assert.equal(result.program_id, '6G2CCaJF9Brfd1sRtNawpWWXzm7uWc6cb8BZbTRibAKD')
      assert.equal(result.cluster, 'devnet')
    })
  } finally {
    removeDir(tempDir)
  }
})

test('deploy passes --program-id for upgrades', async () => {
  const tempDir = createTempDir()
  let receivedArgs = null
  const mock = async (_file, args) => {
    receivedArgs = args
    return {
      stdout: 'Program Id: ExistingProgId123456789012345678901234\n',
      stderr: '',
    }
  }

  try {
    await withMockRunner(mock, async () => {
      const config = makeConfig(tempDir, { programId: 'ExistingProgId123456789012345678901234' })
      const result = await solana.deploy({}, config)
      assert.ok(receivedArgs.includes('--program-id'))
      assert.ok(receivedArgs.includes('ExistingProgId123456789012345678901234'))
      assert.equal(result.program_id, 'ExistingProgId123456789012345678901234')
    })
  } finally {
    removeDir(tempDir)
  }
})

test('deploy throws EDEPLOY001 when binary not found', async () => {
  const tempDir = createTempDir()
  const config = makeConfig(tempDir)
  fs.rmSync(path.join(tempDir, 'program', 'target', 'deploy', 'test.so'))

  await assert.rejects(async () => {
    await solana.deploy({}, config)
  }, /EDEPLOY001|Program binary not found/)
})

test('deploy throws EDEPLOY001 when solana deploy fails', async () => {
  const tempDir = createTempDir()
  const mock = async () => {
    throw new Error('RPC connection failed')
  }

  try {
    await withMockRunner(mock, async () => {
      const config = makeConfig(tempDir)
      await assert.rejects(async () => {
        await solana.deploy({}, config)
      }, /EDEPLOY001|Solana deploy failed/)
    })
  } finally {
    removeDir(tempDir)
  }
})

test('deploy throws EDEPLOY001 when program id not found in output', async () => {
  const tempDir = createTempDir()
  const mock = async () => ({
    stdout: 'Some success message without program id',
    stderr: '',
  })

  try {
    await withMockRunner(mock, async () => {
      const config = makeConfig(tempDir)
      await assert.rejects(async () => {
        await solana.deploy({}, config)
      }, /EDEPLOY001|program id not found in output/)
    })
  } finally {
    removeDir(tempDir)
  }
})

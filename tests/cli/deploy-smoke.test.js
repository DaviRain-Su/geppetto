const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const solanaAdapter = require('../../lib/platform/adapters/solana')
const encoreAdapter = require('../../lib/platform/adapters/encore')
const { runDeploy } = require('../../bin/geppetto-cli')

function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-smoke-'))

  // Create Solana program directory
  const programDir = path.join(tmpDir, 'examples', 'escrow')
  fs.mkdirSync(programDir, { recursive: true })

  // Create Encore off-chain directory with encore.app marker
  const offchainDir = path.join(tmpDir, 'examples', 'escrow-api')
  fs.mkdirSync(offchainDir, { recursive: true })
  fs.writeFileSync(
    path.join(offchainDir, 'encore.app'),
    JSON.stringify({ id: 'test-app-smoke', lang: 'typescript' }, null, '\t'),
  )

  // Create geppetto.toml
  const toml = [
    'schema_version = "0.1"',
    '',
    '[app]',
    'name = "escrow-demo"',
    '',
    '[solana]',
    'cluster = "devnet"',
    'program_path = "examples/escrow"',
    'program_binary = "target/deploy/escrow.so"',
    'keypair = "~/.config/solana/id.json"',
    'program_id = ""',
    '',
    '[offchain]',
    'provider = "encore-cloud"',
    'encore_app = "escrow-demo-api"',
    'project_path = "examples/escrow-api"',
    '',
    '[deploy]',
    'mode = "hybrid"',
    'output = "table"',
  ].join('\n')
  fs.writeFileSync(path.join(tmpDir, 'geppetto.toml'), toml)

  return tmpDir
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
}

function withMockedAdapters(solanaMock, encoreMock, testFn) {
  const origSolanaBuild = solanaAdapter.build
  const origSolanaDeploy = solanaAdapter.deploy
  const origSolanaRunner = { ...solanaAdapter.runner }
  const origEncoreDeploy = encoreAdapter.deploy
  const origEncoreRunner = {
    execFile: encoreAdapter.runner.execFile,
    exec: encoreAdapter.runner.exec,
  }

  if (solanaMock.build) solanaAdapter.build = solanaMock.build
  if (solanaMock.deploy) solanaAdapter.deploy = solanaMock.deploy

  if (encoreMock.deploy) encoreAdapter.deploy = encoreMock.deploy

  return testFn()
    .finally(() => {
      solanaAdapter.build = origSolanaBuild
      solanaAdapter.deploy = origSolanaDeploy
      Object.assign(solanaAdapter.runner, origSolanaRunner)
      encoreAdapter.deploy = origEncoreDeploy
      encoreAdapter.runner.execFile = origEncoreRunner.execFile
      encoreAdapter.runner.exec = origEncoreRunner.exec
    })
}

// --- Full pipeline smoke tests ---

test('smoke: full pipeline success with mocked adapters', async () => {
  const tmpDir = createTempProject()
  const stepOrder = []

  try {
    await withMockedAdapters(
      {
        build: async () => { stepOrder.push('build') },
        deploy: async () => {
          stepOrder.push('deploy-solana')
          return { program_id: 'SmokeProgramId123456789012345678901234567', cluster: 'devnet' }
        },
      },
      {
        deploy: async () => {
          stepOrder.push('deploy-encore')
          return {
            service_url: 'https://app.encore.cloud/test/envs/staging/deploys/smoke001',
            provider_deployment_id: 'smoke001',
          }
        },
      },
      async () => {
        let stdout = ''
        let stderr = ''
        const code = await runDeploy(
          { options: { output: 'json', setValues: [], writeBack: false } },
          {
            stdout: { write: (s) => { stdout += s } },
            stderr: { write: (s) => { stderr += s } },
            cwd: tmpDir,
          },
        )

        assert.equal(code, 0, `Expected exit 0, got ${code}. stderr: ${stderr}`)
        assert.deepEqual(stepOrder, ['build', 'deploy-solana', 'deploy-encore'])

        const parsed = JSON.parse(stdout)
        assert.equal(parsed.app_name, 'escrow-demo')
        assert.equal(parsed.cluster, 'devnet')
        assert.equal(parsed.program_id, 'SmokeProgramId123456789012345678901234567')
        assert.equal(parsed.service_url, 'https://app.encore.cloud/test/envs/staging/deploys/smoke001')
        assert.equal(parsed.provider_deployment_id, 'smoke001')
        assert.equal(parsed.status, 'success')
        assert.equal(parsed.failure_class, null)
        assert.equal(parsed.steps.length, 3)

        // Verify artifacts written
        const artifactJson = path.join(tmpDir, '.geppetto', 'deploy-output.json')
        const artifactTxt = path.join(tmpDir, '.geppetto', 'deploy-output.txt')
        assert.ok(fs.existsSync(artifactJson), 'deploy-output.json should exist')
        assert.ok(fs.existsSync(artifactTxt), 'deploy-output.txt should exist')

        const artifactData = JSON.parse(fs.readFileSync(artifactJson, 'utf8'))
        assert.equal(artifactData.program_id, 'SmokeProgramId123456789012345678901234567')
      },
    )
  } finally {
    removeDir(tmpDir)
  }
})

test('smoke: pipeline fails at build step with correct failure_class', async () => {
  const tmpDir = createTempProject()

  try {
    await withMockedAdapters(
      {
        build: async () => {
          const { createPlatformError } = require('../../lib/platform/errors')
          throw createPlatformError('EBUILD001', 'cargo build-sbf failed: missing toolchain')
        },
        deploy: async () => { throw new Error('should not reach solana deploy') },
      },
      {
        deploy: async () => { throw new Error('should not reach encore deploy') },
      },
      async () => {
        let stdout = ''
        let stderr = ''
        const code = await runDeploy(
          { options: { output: 'json', setValues: [], writeBack: false } },
          {
            stdout: { write: (s) => { stdout += s } },
            stderr: { write: (s) => { stderr += s } },
            cwd: tmpDir,
          },
        )

        assert.equal(code, 1)
        assert.ok(stderr.includes('EBUILD001'))

        const parsed = JSON.parse(stdout)
        assert.equal(parsed.status, 'failure')
        assert.equal(parsed.failure_class, 'build')
        assert.equal(parsed.steps.length, 1)
        assert.equal(parsed.steps[0].name, 'buildProgram')
        assert.equal(parsed.steps[0].status, 'failure')
      },
    )
  } finally {
    removeDir(tmpDir)
  }
})

test('smoke: pipeline fails at solana deploy with correct failure_class', async () => {
  const tmpDir = createTempProject()

  try {
    await withMockedAdapters(
      {
        build: async () => {},
        deploy: async () => {
          const { createPlatformError } = require('../../lib/platform/errors')
          throw createPlatformError('EDEPLOY001', 'Solana deploy failed: insufficient SOL')
        },
      },
      {
        deploy: async () => { throw new Error('should not reach encore deploy') },
      },
      async () => {
        let stdout = ''
        let stderr = ''
        const code = await runDeploy(
          { options: { output: 'json', setValues: [], writeBack: false } },
          {
            stdout: { write: (s) => { stdout += s } },
            stderr: { write: (s) => { stderr += s } },
            cwd: tmpDir,
          },
        )

        assert.equal(code, 1)

        const parsed = JSON.parse(stdout)
        assert.equal(parsed.status, 'failure')
        assert.equal(parsed.failure_class, 'deploy')
        assert.equal(parsed.steps.length, 2)
        assert.equal(parsed.steps[0].name, 'buildProgram')
        assert.equal(parsed.steps[0].status, 'success')
        assert.equal(parsed.steps[1].name, 'deployProgram')
        assert.equal(parsed.steps[1].status, 'failure')
      },
    )
  } finally {
    removeDir(tmpDir)
  }
})

test('smoke: pipeline fails at encore deploy with correct failure_class', async () => {
  const tmpDir = createTempProject()

  try {
    await withMockedAdapters(
      {
        build: async () => {},
        deploy: async () => ({ program_id: 'TestProgramId1234567890123456789012345', cluster: 'devnet' }),
      },
      {
        deploy: async () => {
          const { createPlatformError } = require('../../lib/platform/errors')
          throw createPlatformError('EDEPLOY002', 'Encore deploy failed: git push rejected')
        },
      },
      async () => {
        let stdout = ''
        let stderr = ''
        const code = await runDeploy(
          { options: { output: 'json', setValues: [], writeBack: false } },
          {
            stdout: { write: (s) => { stdout += s } },
            stderr: { write: (s) => { stderr += s } },
            cwd: tmpDir,
          },
        )

        assert.equal(code, 1)

        const parsed = JSON.parse(stdout)
        assert.equal(parsed.status, 'failure')
        assert.equal(parsed.failure_class, 'deploy')
        assert.equal(parsed.steps.length, 3)
        assert.equal(parsed.steps[0].status, 'success')
        assert.equal(parsed.steps[1].status, 'success')
        assert.equal(parsed.steps[2].name, 'deployOffchain')
        assert.equal(parsed.steps[2].status, 'failure')
      },
    )
  } finally {
    removeDir(tmpDir)
  }
})

test('smoke: --set overrides are applied to pipeline', async () => {
  const tmpDir = createTempProject()

  try {
    await withMockedAdapters(
      {
        build: async () => {},
        deploy: async (_ctx, config) => {
          assert.equal(config.solana.cluster, 'testnet', 'cluster should be overridden to testnet')
          return { program_id: 'OverrideProgramId123456789012345678901234', cluster: 'testnet' }
        },
      },
      {
        deploy: async () => ({
          service_url: 'https://app.encore.cloud/test/envs/staging/deploys/override001',
          provider_deployment_id: 'override001',
        }),
      },
      async () => {
        let stdout = ''
        let stderr = ''
        const code = await runDeploy(
          { options: { output: 'json', setValues: ['cluster=testnet'], writeBack: false } },
          {
            stdout: { write: (s) => { stdout += s } },
            stderr: { write: (s) => { stderr += s } },
            cwd: tmpDir,
          },
        )

        assert.equal(code, 0, `Expected exit 0, stderr: ${stderr}`)

        const parsed = JSON.parse(stdout)
        assert.equal(parsed.cluster, 'testnet')
      },
    )
  } finally {
    removeDir(tmpDir)
  }
})

test('smoke: table output renders step names and status', async () => {
  const tmpDir = createTempProject()

  try {
    await withMockedAdapters(
      {
        build: async () => {},
        deploy: async () => ({ program_id: 'TableTestProgId12345678901234567890123456', cluster: 'devnet' }),
      },
      {
        deploy: async () => ({
          service_url: 'https://app.encore.cloud/test/envs/staging/deploys/table001',
          provider_deployment_id: 'table001',
        }),
      },
      async () => {
        let stdout = ''
        const code = await runDeploy(
          { options: { output: 'table', setValues: [], writeBack: false } },
          {
            stdout: { write: (s) => { stdout += s } },
            stderr: { write: () => {} },
            cwd: tmpDir,
          },
        )

        assert.equal(code, 0)
        assert.ok(stdout.includes('✓ buildProgram'))
        assert.ok(stdout.includes('✓ deployProgram'))
        assert.ok(stdout.includes('✓ deployOffchain'))
        assert.ok(stdout.includes('escrow-demo'))
        assert.ok(stdout.includes('success'))
      },
    )
  } finally {
    removeDir(tmpDir)
  }
})

test('smoke: missing geppetto.toml returns exit 1 with config error', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-smoke-empty-'))

  try {
    let stderr = ''
    const code = await runDeploy(
      { options: { output: 'json', setValues: [], writeBack: false } },
      {
        stdout: { write: () => {} },
        stderr: { write: (s) => { stderr += s } },
        cwd: tmpDir,
      },
    )

    assert.equal(code, 1)
    assert.ok(stderr.includes('ECFG001'))
  } finally {
    removeDir(tmpDir)
  }
})

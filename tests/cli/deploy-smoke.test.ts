const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { runDeploy, adapters } = require('../../bin/geppetto-cli')

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

function removeDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true })
}

interface SolanaMock {
  build?: () => Promise<void>
  deploy?: (ctx: unknown, config: any) => Promise<{ program_id: string; cluster: string }>
}

interface EncoreMock {
  deploy?: (ctx: { runId?: string }) => Promise<{ service_url: string; provider_deployment_id: string | null }>
}

function withMockedAdapters(solanaMock: SolanaMock, encoreMock: EncoreMock, testFn: () => Promise<void>): Promise<void> {
  const origSolanaBuild = adapters.solana.build
  const origSolanaDeploy = adapters.solana.deploy
  const origEncoreDeploy = adapters.encore.deploy

  if (solanaMock.build) adapters.solana.build = solanaMock.build
  if (solanaMock.deploy) adapters.solana.deploy = solanaMock.deploy
  if (encoreMock.deploy) adapters.encore.deploy = encoreMock.deploy

  return testFn()
    .finally(() => {
      adapters.solana.build = origSolanaBuild
      adapters.solana.deploy = origSolanaDeploy
      adapters.encore.deploy = origEncoreDeploy
    })
}

// --- Full pipeline smoke tests ---

test('smoke: full pipeline success with mocked adapters', async () => {
  const tmpDir = createTempProject()
  const stepOrder: string[] = []

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
            stdout: { write: (s: string) => { stdout += s } },
            stderr: { write: (s: string) => { stderr += s } },
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
            stdout: { write: (s: string) => { stdout += s } },
            stderr: { write: (s: string) => { stderr += s } },
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
            stdout: { write: (s: string) => { stdout += s } },
            stderr: { write: (s: string) => { stderr += s } },
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
            stdout: { write: (s: string) => { stdout += s } },
            stderr: { write: (s: string) => { stderr += s } },
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
            stdout: { write: (s: string) => { stdout += s } },
            stderr: { write: (s: string) => { stderr += s } },
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
            stdout: { write: (s: string) => { stdout += s } },
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

test('smoke: pipeline ctx passes run_id to encore adapter for traceability', async () => {
  const tmpDir = createTempProject()
  let capturedCtx: { runId?: string } | null = null

  try {
    await withMockedAdapters(
      {
        build: async () => {},
        deploy: async () => ({ program_id: 'CtxTestProgId1234567890123456789012345678', cluster: 'devnet' }),
      },
      {
        deploy: async (ctx: { runId?: string }) => {
          capturedCtx = ctx
          return {
            service_url: 'https://app.encore.cloud/test/envs/staging/deploys/ctx001',
            provider_deployment_id: 'ctx001',
          }
        },
      },
      async () => {
        const code = await runDeploy(
          { options: { output: 'json', setValues: [], writeBack: false } },
          {
            stdout: { write: () => {} },
            stderr: { write: () => {} },
            cwd: tmpDir,
          },
        )

        assert.equal(code, 0)
        assert.ok(capturedCtx, 'ctx should be passed to encore adapter')
        assert.ok(capturedCtx!.runId, 'ctx.runId should be set')
        assert.ok(capturedCtx!.runId!.startsWith('run_'), 'ctx.runId should have run_ prefix')
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
        stderr: { write: (s: string) => { stderr += s } },
        cwd: tmpDir,
      },
    )

    assert.equal(code, 1)
    assert.ok(stderr.includes('ECFG001'))
  } finally {
    removeDir(tmpDir)
  }
})

// --- GP-16 Part A: Full E2E mock integration ---

test('e2e: deploy --write-back full flow: config → build → deploy → artifacts → write-back → output', async () => {
  const tmpDir = createTempProject()
  const MOCK_PROGRAM_ID = 'E2eProgramId1234567890123456789012345678901'
  const MOCK_SERVICE_URL = 'https://app.encore.cloud/escrow-demo/envs/staging/deploys/e2e001'
  const MOCK_PROVIDER_ID = 'e2e001'

  try {
    await withMockedAdapters(
      {
        build: async () => {},
        deploy: async () => ({ program_id: MOCK_PROGRAM_ID, cluster: 'devnet' }),
      },
      {
        deploy: async () => ({
          service_url: MOCK_SERVICE_URL,
          provider_deployment_id: MOCK_PROVIDER_ID,
        }),
      },
      async () => {
        let stdout = ''
        let stderr = ''
        const code = await runDeploy(
          { options: { output: 'json', setValues: [], writeBack: true } },
          {
            stdout: { write: (s: string) => { stdout += s } },
            stderr: { write: (s: string) => { stderr += s } },
            cwd: tmpDir,
          },
        )

        // 1. Exit code
        assert.equal(code, 0, `Expected exit 0, stderr: ${stderr}`)

        // 2. JSON output contract
        const parsed = JSON.parse(stdout)
        assert.ok(parsed.run_id.startsWith('run_'), 'run_id should have run_ prefix')
        assert.equal(parsed.app_name, 'escrow-demo')
        assert.equal(parsed.cluster, 'devnet')
        assert.equal(parsed.program_id, MOCK_PROGRAM_ID)
        assert.equal(parsed.service_url, MOCK_SERVICE_URL)
        assert.equal(parsed.provider_deployment_id, MOCK_PROVIDER_ID)
        assert.equal(parsed.status, 'success')
        assert.equal(parsed.failure_class, null)
        assert.equal(parsed.steps.length, 3)
        assert.equal(parsed.steps[0].name, 'buildProgram')
        assert.equal(parsed.steps[1].name, 'deployProgram')
        assert.equal(parsed.steps[2].name, 'deployOffchain')
        for (const step of parsed.steps) {
          assert.equal(step.status, 'success')
          assert.ok(typeof step.elapsed_ms === 'number')
        }

        // 3. Artifact files
        const artifactJson = path.join(tmpDir, '.geppetto', 'deploy-output.json')
        const artifactTxt = path.join(tmpDir, '.geppetto', 'deploy-output.txt')
        assert.ok(fs.existsSync(artifactJson), 'deploy-output.json should exist')
        assert.ok(fs.existsSync(artifactTxt), 'deploy-output.txt should exist')

        const artifactData = JSON.parse(fs.readFileSync(artifactJson, 'utf8'))
        assert.equal(artifactData.program_id, MOCK_PROGRAM_ID)
        assert.equal(artifactData.service_url, MOCK_SERVICE_URL)
        assert.equal(artifactData.status, 'success')

        const artifactText = fs.readFileSync(artifactTxt, 'utf8')
        assert.ok(artifactText.includes(MOCK_PROGRAM_ID))
        assert.ok(artifactText.includes(MOCK_SERVICE_URL))
        assert.ok(artifactText.includes('success'))

        // 4. Write-back: geppetto.toml updated with program_id
        const manifest = fs.readFileSync(path.join(tmpDir, 'geppetto.toml'), 'utf8')
        assert.ok(manifest.includes(`program_id = "${MOCK_PROGRAM_ID}"`),
          'geppetto.toml should have program_id written back')
        // Other fields unchanged
        assert.ok(manifest.includes('cluster = "devnet"'))
        assert.ok(manifest.includes('name = "escrow-demo"'))
      },
    )
  } finally {
    removeDir(tmpDir)
  }
})

test('e2e: deploy failure does NOT write-back program_id', async () => {
  const tmpDir = createTempProject()

  try {
    await withMockedAdapters(
      {
        build: async () => {},
        deploy: async () => {
          const { createPlatformError } = require('../../lib/platform/errors')
          throw createPlatformError('EDEPLOY001', 'Solana deploy failed')
        },
      },
      {
        deploy: async () => { throw new Error('should not reach') },
      },
      async () => {
        const code = await runDeploy(
          { options: { output: 'json', setValues: [], writeBack: true } },
          {
            stdout: { write: () => {} },
            stderr: { write: () => {} },
            cwd: tmpDir,
          },
        )

        assert.equal(code, 1)

        // geppetto.toml should NOT be modified
        const manifest = fs.readFileSync(path.join(tmpDir, 'geppetto.toml'), 'utf8')
        assert.ok(manifest.includes('program_id = ""'),
          'program_id should remain empty on failure')
      },
    )
  } finally {
    removeDir(tmpDir)
  }
})

// --- Solana-only mode (no [offchain] section) ---

function createSolanaOnlyProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-solana-only-'))

  // Create Solana program directory only (no offchain)
  const programDir = path.join(tmpDir, 'examples', 'escrow')
  fs.mkdirSync(programDir, { recursive: true })

  // geppetto.toml without [offchain] section
  const toml = [
    'schema_version = "0.1"',
    '',
    '[app]',
    'name = "escrow-program"',
    '',
    '[solana]',
    'cluster = "devnet"',
    'program_path = "examples/escrow"',
    'program_binary = "target/deploy/escrow.so"',
    'keypair = "~/.config/solana/id.json"',
    'program_id = ""',
    '',
    '[deploy]',
    'mode = "solana"',
    'output = "table"',
  ].join('\n')
  fs.writeFileSync(path.join(tmpDir, 'geppetto.toml'), toml)

  return tmpDir
}

test('solana-only: pipeline runs build + deploy without offchain step', async () => {
  const tmpDir = createSolanaOnlyProject()
  const stepOrder: string[] = []

  try {
    await withMockedAdapters(
      {
        build: async () => { stepOrder.push('build') },
        deploy: async () => {
          stepOrder.push('deploy-solana')
          return { program_id: 'SolanaOnlyProgId12345678901234567890123456', cluster: 'devnet' }
        },
      },
      {
        deploy: async () => { throw new Error('offchain should not be called') },
      },
      async () => {
        let stdout = ''
        let stderr = ''
        const code = await runDeploy(
          { options: { output: 'json', setValues: [], writeBack: false } },
          {
            stdout: { write: (s: string) => { stdout += s } },
            stderr: { write: (s: string) => { stderr += s } },
            cwd: tmpDir,
          },
        )

        assert.equal(code, 0, `Expected exit 0, stderr: ${stderr}`)
        assert.deepEqual(stepOrder, ['build', 'deploy-solana'], 'only build + solana deploy steps should run')

        const parsed = JSON.parse(stdout)
        assert.equal(parsed.app_name, 'escrow-program')
        assert.equal(parsed.cluster, 'devnet')
        assert.equal(parsed.program_id, 'SolanaOnlyProgId12345678901234567890123456')
        assert.equal(parsed.service_url, null)
        assert.equal(parsed.provider_deployment_id, null)
        assert.equal(parsed.status, 'success')
        assert.equal(parsed.failure_class, null)
        assert.equal(parsed.steps.length, 2)
        assert.equal(parsed.steps[0].name, 'buildProgram')
        assert.equal(parsed.steps[1].name, 'deployProgram')
      },
    )
  } finally {
    removeDir(tmpDir)
  }
})

test('solana-only: deploy mode inferred when [offchain] absent and mode omitted', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-solana-infer-'))

  // Create program dir
  const programDir = path.join(tmpDir, 'examples', 'escrow')
  fs.mkdirSync(programDir, { recursive: true })

  // geppetto.toml without [offchain] and without deploy.mode
  const toml = [
    'schema_version = "0.1"',
    '',
    '[app]',
    'name = "escrow-infer"',
    '',
    '[solana]',
    'cluster = "devnet"',
    'program_path = "examples/escrow"',
    'program_binary = "target/deploy/escrow.so"',
    'keypair = "~/.config/solana/id.json"',
    'program_id = ""',
    '',
    '[deploy]',
    'output = "json"',
  ].join('\n')
  fs.writeFileSync(path.join(tmpDir, 'geppetto.toml'), toml)

  try {
    await withMockedAdapters(
      {
        build: async () => {},
        deploy: async () => ({ program_id: 'InferModeProgId12345678901234567890123456', cluster: 'devnet' }),
      },
      {
        deploy: async () => { throw new Error('offchain should not be called') },
      },
      async () => {
        let stdout = ''
        let stderr = ''
        const code = await runDeploy(
          { options: { output: 'json', setValues: [], writeBack: false } },
          {
            stdout: { write: (s: string) => { stdout += s } },
            stderr: { write: (s: string) => { stderr += s } },
            cwd: tmpDir,
          },
        )

        assert.equal(code, 0, `Expected exit 0, stderr: ${stderr}`)
        const parsed = JSON.parse(stdout)
        assert.equal(parsed.status, 'success')
        assert.equal(parsed.steps.length, 2, 'should only have build + deploy steps')
        assert.equal(parsed.service_url, null, 'no offchain service_url')
      },
    )
  } finally {
    removeDir(tmpDir)
  }
})

test('solana-only: --write-back works without offchain', async () => {
  const tmpDir = createSolanaOnlyProject()

  try {
    await withMockedAdapters(
      {
        build: async () => {},
        deploy: async () => ({ program_id: 'WriteBackSolanaOnlyPid123456789012345678', cluster: 'devnet' }),
      },
      {
        deploy: async () => { throw new Error('offchain should not be called') },
      },
      async () => {
        let stderr = ''
        const code = await runDeploy(
          { options: { output: 'json', setValues: [], writeBack: true } },
          {
            stdout: { write: () => {} },
            stderr: { write: (s: string) => { stderr += s } },
            cwd: tmpDir,
          },
        )

        assert.equal(code, 0, `Expected exit 0, stderr: ${stderr}`)

        const manifest = fs.readFileSync(path.join(tmpDir, 'geppetto.toml'), 'utf8')
        assert.ok(manifest.includes('program_id = "WriteBackSolanaOnlyPid123456789012345678"'),
          'program_id should be written back in solana-only mode')
      },
    )
  } finally {
    removeDir(tmpDir)
  }
})

#!/usr/bin/env bun

import * as path from 'node:path'

import { loadPlatformConfig } from '../lib/platform/config'
import { parseSetValues, applyOverrides } from '../lib/platform/overrides'
import { createDeployState } from '../lib/platform/state'
import { runPipeline, bridgeOutputs } from '../lib/platform/deploy'
import { renderDeployOutput, writeArtifacts, writeBackProgramId } from '../lib/platform/output'
import type { DeployArgs, CLIio, DeployState, PlatformConfig, OutputFormat, PipelineContext } from '../lib/platform/types'

// Non-TS modules (equivalent migration — minimal local types)
const { initProject } = require('../lib/init') as { initProject: (targetDir: string, options: { dryRun?: boolean; log?: (line: string) => void; templateRoot?: string }) => Array<{ path: string; status: string }> }
const { createProject } = require('../lib/new') as { createProject: (cwd: string, projectName: string, options: { log?: (line: string) => void }) => Array<{ path: string; status: string }> }
const { buildTestPlan, runGeppettoTest } = require('../lib/test') as {
  buildTestPlan: (options: { cwd: string; includeEscrowTests?: boolean; buildSbf?: boolean; skipBuildSbf?: boolean }) => { stepCount: number }
  runGeppettoTest: (options: { cwd: string; includeEscrowTests?: boolean; buildSbf?: boolean; skipBuildSbf?: boolean }) => { stepCount: number }
}
const { runGeppettoAudit } = require('../lib/audit') as { runGeppettoAudit: (options: { strict?: boolean }) => void }

const solanaAdapter = require('../lib/platform/adapters/solana') as {
  build: (ctx: PipelineContext, config: PlatformConfig) => Promise<void>
  deploy: (ctx: PipelineContext, config: PlatformConfig) => Promise<{ program_id: string; cluster: string }>
}
const encoreAdapter = require('../lib/platform/adapters/encore') as {
  deploy: (ctx: PipelineContext, config: PlatformConfig) => Promise<{ service_url: string; provider_deployment_id: string | null }>
}

export type OutputStream = { write: (chunk: string) => void }

export function printUsage(stream: OutputStream): void {
  stream.write('Usage: geppetto-cli <command> [options]\n\n')
  stream.write('Commands:\n')
  stream.write('  init [--dry-run]    Generate AGENTS.md and agent entry files in the current directory\n')
  stream.write('                      --dry-run previews create/skip actions without writing files\n')
  stream.write('  new <project-name>   Generate a minimal Pinocchio + Geppetto project scaffold\n')
  stream.write('  deploy [options]    Deploy Solana program + Encore off-chain service\n')
  stream.write('                      --output <table|json>  Output format (default: table)\n')
  stream.write('                      --set key=value        Override config (cluster, program_id, service_name, replicas)\n')
  stream.write('                      --write-back           Write program_id back to geppetto.toml\n')
  stream.write('  test [--skip-examples] [--build-sbf] [--skip-build-sbf]\n')
  stream.write('                      Run root tests and escrow example tests. Missing SBF artifact\n')
  stream.write('                      is auto-built unless --skip-build-sbf is passed.\n')
  stream.write('  audit [--strict]    Run minimal static audit checks (fmt/check, optional clippy)\n')
}

export function createLogger(stream: OutputStream): (line: string) => void {
  return (line: string) => {
    stream.write(`${line}\n`)
  }
}

export function parseInitArgs(args: string[]): { help?: true; error?: string; options?: { dryRun: boolean } } {
  const options = { dryRun: false }

  for (const arg of args) {
    if (arg === '--dry-run' && options.dryRun === false) {
      options.dryRun = true
      continue
    }

    if (arg === '-h' || arg === '--help') {
      return { help: true }
    }

    return { error: `Unexpected arguments: ${args.join(' ')}` }
  }

  return { options }
}

export function parseNewArgs(args: string[]): { help?: true; error?: string; projectName?: string } {
  if (args[0] === '-h' || args[0] === '--help') {
    return { help: true }
  }

  if (args.length === 0 || args[0].startsWith('-')) {
    return { error: 'Missing or invalid project name' }
  }

  if (args.length > 1) {
    return { error: `Unexpected arguments: ${args.join(' ')}` }
  }

  return { projectName: args[0] }
}

export function parseTestArgs(args: string[]): { help?: true; error?: string; includeEscrowTests?: boolean; buildSbf?: boolean; skipBuildSbf?: boolean } {
  const options = {
    includeEscrowTests: true,
    buildSbf: false,
    skipBuildSbf: false,
  }

  for (const arg of args) {
    if (arg === '-h' || arg === '--help') {
      return { help: true }
    }

    if (arg === '--skip-examples') {
      options.includeEscrowTests = false
      continue
    }

    if (arg === '--build-sbf') {
      options.buildSbf = true
      options.skipBuildSbf = false
      continue
    }

    if (arg === '--skip-build-sbf') {
      options.skipBuildSbf = true
      options.buildSbf = false
      continue
    }

    return { error: `Unexpected arguments: ${args.join(' ')}` }
  }

  return options
}

export function parseDeployArgs(args: string[]): { help?: true; error?: string; options?: DeployArgs['options'] } {
  const options: DeployArgs['options'] = { output: 'table', setValues: [], writeBack: false }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '-h' || arg === '--help') {
      return { help: true }
    }

    if (arg === '--output' || arg === '-o') {
      const value = args[++i]
      if (!value || value.startsWith('-')) {
        return { error: '--output requires a value (table or json)' }
      }
      if (value !== 'table' && value !== 'json') {
        return { error: `Invalid output format: ${value} (use table or json)` }
      }
      options.output = value as OutputFormat
      continue
    }

    if (arg === '--set') {
      const value = args[++i]
      if (!value || value.startsWith('-')) {
        return { error: '--set requires a key=value argument' }
      }
      options.setValues.push(value)
      continue
    }

    if (arg === '--write-back') {
      options.writeBack = true
      continue
    }

    return { error: `Unexpected argument: ${arg}` }
  }

  return { options }
}

export async function runDeploy(parsedArgs: { options: DeployArgs['options'] }, io: Partial<CLIio>): Promise<number> {
  const stdout = io.stdout || process.stdout as unknown as CLIio['stdout']
  const stderr = io.stderr || process.stderr as unknown as CLIio['stderr']
  const cwd = io.cwd || process.cwd()

  // Load and validate config
  let config: PlatformConfig
  try {
    config = loadPlatformConfig({ cwd })
  } catch (error) {
    stderr.write(`${(error as Error & { code?: string }).code || 'ERROR'}: ${(error as Error).message}\n`)
    return 1
  }

  // Parse and apply overrides
  let overrides: Record<string, string>
  try {
    overrides = parseSetValues(parsedArgs.options.setValues)
    if (Object.keys(overrides).length > 0) {
      const next = applyOverrides(config, overrides)
      if (next) {
        config = next
      }
    }
  } catch (error) {
    stderr.write(`${(error as Error & { code?: string }).code || 'ERROR'}: ${(error as Error).message}\n`)
    return 1
  }

  // Create initial deploy state
  const state = createDeployState(config)

  // Build pipeline steps — Solana build/deploy + optional Encore deploy
  const steps: Array<{ name: string; run: (ctx: PipelineContext, currentState: DeployState, cfg: PlatformConfig) => Promise<DeployState> }> = [
    {
      name: 'buildProgram',
      run: async (_ctx, currentState, cfg) => {
        await solanaAdapter.build(_ctx, cfg)
        return currentState
      },
    },
    {
      name: 'deployProgram',
      run: async (_ctx, currentState, cfg) => {
        const result = await solanaAdapter.deploy(_ctx, cfg)
        currentState.program_id = result.program_id
        currentState.cluster = result.cluster
        return currentState
      },
    },
  ]

  // Add offchain step only when [offchain] is configured (hybrid mode)
  if (config.offchain) {
    steps.push({
      name: 'deployOffchain',
      run: async (_ctx, currentState, cfg) => {
        const result = await encoreAdapter.deploy(_ctx, cfg)
        currentState.service_url = result.service_url
        currentState.provider_deployment_id = result.provider_deployment_id || null
        return currentState
      },
    })
  }

  // Run pipeline
  let finalState: DeployState
  try {
    finalState = await runPipeline({
      ctx: { runId: state.run_id },
      config,
      initialState: state,
      steps,
    })

    // Bridge outputs validates required fields
    finalState = bridgeOutputs(finalState, { mode: config.deploy.mode })
  } catch (error) {
    // Render partial state on failure
    const failedState = (error as Error & { state?: DeployState; failureClass?: string }).state || state
    failedState.status = 'failure'
    failedState.failure_class = ((error as Error & { failureClass?: string }).failureClass || 'deploy') as DeployState['failure_class']
    // Write artifacts even on failure (partial state is valuable)
    try {
      writeArtifacts(failedState, cwd)
    } catch (_artifactError) {
      // Suppress artifact write errors on failure path to avoid masking primary error
    }

    renderDeployOutput(failedState, parsedArgs.options.output, stdout)
    stderr.write(`${(error as Error & { code?: string }).code || 'ERROR'}: ${(error as Error).message}\n`)
    return 1
  }

  // Write artifacts
  try {
    writeArtifacts(finalState, cwd)
  } catch (error) {
    stderr.write(`${(error as Error & { code?: string }).code || 'ERROR'}: ${(error as Error).message}\n`)
    return 1
  }

  // Write-back program_id if requested
  if (parsedArgs.options.writeBack && finalState.program_id) {
    try {
      const manifestPath = path.join(cwd, 'geppetto.toml')
      writeBackProgramId(manifestPath, finalState.program_id)
    } catch (error) {
      stderr.write(`${(error as Error & { code?: string }).code || 'ERROR'}: ${(error as Error).message}\n`)
      return 1
    }
  }

  // Render success output
  renderDeployOutput(finalState, parsedArgs.options.output, stdout)
  return 0
}

export function parseAuditArgs(args: string[]): { help?: true; error?: string; strict?: boolean } {
  const options = {
    strict: false,
  }

  for (const arg of args) {
    if (arg === '-h' || arg === '--help') {
      return { help: true }
    }

    if (arg === '--strict') {
      options.strict = true
      continue
    }

    return { error: `Unexpected arguments: ${args.join(' ')}` }
  }

  return options
}

export function main(argv: string[] = process.argv.slice(2), io: Partial<CLIio> = {}): number | Promise<number> {
  const stdout = io.stdout || process.stdout as unknown as CLIio['stdout']
  const stderr = io.stderr || process.stderr as unknown as CLIio['stderr']
  const cwd = io.cwd || process.cwd()
  const [command, ...rest] = argv

  if (!command || command === '-h' || command === '--help') {
    printUsage(stdout)
    return 0
  }

  if (command === 'deploy') {
    const parsedArgs = parseDeployArgs(rest)

    if (parsedArgs.help) {
      printUsage(stdout)
      return 0
    }

    if (parsedArgs.error) {
      stderr.write(`${parsedArgs.error}\n`)
      printUsage(stderr)
      return 1
    }

    // Deploy is async — return a Promise
    return runDeploy(parsedArgs as { options: DeployArgs['options'] }, { stdout, stderr, cwd })
  }

  if (command === 'init') {
    const parsedArgs = parseInitArgs(rest)

    if (parsedArgs.help) {
      printUsage(stdout)
      return 0
    }

    if (parsedArgs.error) {
      stderr.write(`${parsedArgs.error}\n`)
      printUsage(stderr)
      return 1
    }

    try {
      const results = initProject(cwd, {
        dryRun: parsedArgs.options!.dryRun,
        log: createLogger(stdout),
      })
      const created = results.filter((result: { status: string }) => result.status === 'created' || result.status === 'would-create').length
      const skipped = results.filter((result: { status: string }) => result.status === 'skipped').length

      if (parsedArgs.options!.dryRun) {
        stdout.write(`done dry-run would-create=${created} skipped=${skipped}\n`)
        return 0
      }

      stdout.write(`done created=${created} skipped=${skipped}\n`)
      return 0
    } catch (error) {
      stderr.write(`${(error as Error).message}\n`)
      return 1
    }
  }

  if (command === 'new') {
    const parsedArgs = parseNewArgs(rest)

    if (parsedArgs.help) {
      printUsage(stdout)
      return 0
    }

    if (parsedArgs.error) {
      stderr.write(`${parsedArgs.error}\n`)
      printUsage(stderr)
      return 1
    }

    try {
      const results = createProject(cwd, parsedArgs.projectName!, {
        log: createLogger(stdout),
      })
      const created = results.filter((result: { status: string }) => result.status === 'created').length
      const skipped = results.filter((result: { status: string }) => result.status === 'skipped').length
      stdout.write(`done new ${parsedArgs.projectName} created=${created} skipped=${skipped}\n`)
      return 0
    } catch (error) {
      stderr.write(`${(error as Error).message}\n`)
      return 1
    }
  }

  if (command === 'test') {
    const parsedArgs = parseTestArgs(rest)

    if (parsedArgs.help) {
      printUsage(stdout)
      return 0
    }

    if (parsedArgs.error) {
      stderr.write(`${parsedArgs.error}\n`)
      printUsage(stderr)
      return 1
    }

    try {
      const result = runGeppettoTest({
        cwd,
        includeEscrowTests: parsedArgs.includeEscrowTests,
        buildSbf: parsedArgs.buildSbf,
        skipBuildSbf: parsedArgs.skipBuildSbf,
      })
      stdout.write(`done geppetto test completed: ${result.stepCount} steps\n`)
      return 0
    } catch (error) {
      stderr.write(`${(error as Error).message}\n`)
      return 1
    }
  }

  if (command === 'audit') {
    const parsedArgs = parseAuditArgs(rest)

    if (parsedArgs.help) {
      printUsage(stdout)
      return 0
    }

    if (parsedArgs.error) {
      stderr.write(`${parsedArgs.error}\n`)
      printUsage(stderr)
      return 1
    }

    try {
      runGeppettoAudit({
        strict: parsedArgs.strict,
      })
      stdout.write('done geppetto audit\n')
      return 0
    } catch (error) {
      stderr.write(`${(error as Error).message}\n`)
      return 1
    }
  }

  stderr.write(`Unknown command: ${command}\n`)
  printUsage(stderr)
  return 1
}

if (require.main === module) {
  const result = main()
  if (result instanceof Promise) {
    result.then((code: number) => { process.exitCode = code })
      .catch(() => { process.exitCode = 1 })
  } else {
    process.exitCode = result
  }
}

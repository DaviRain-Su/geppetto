import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const DEFAULT_ESCROW_EXAMPLES_MANIFEST = path.join(
  'examples',
  'escrow',
  'target',
  'deploy',
  'geppetto_escrow.so',
)
const DEFAULT_ESCROW_MANIFEST_PATH = path.join(
  'examples',
  'escrow',
  'Cargo.toml',
)

export interface TestPlanStep {
  label: string
  command: string
  args: string[]
}

export interface TestPlan {
  commandPlan: TestPlanStep[]
  warnings: string[]
  errors: string[]
}

export interface RunnerResult {
  status: number | null
  error?: Error
}

export type CommandRunner = (command: string, args: string[], cwd: string) => RunnerResult

export interface BuildTestPlanOptions {
  cwd?: string
  includeEscrowTests?: boolean
  buildSbf?: boolean
  skipBuildSbf?: boolean
  locked?: boolean
  includeLocked?: boolean
}

export interface RunTestPlanOptions {
  cwd?: string
  runCommand?: CommandRunner
}

export function getProjectRoot(cwd = process.cwd()): string {
  return path.resolve(cwd)
}

export function getEscrowArtifactPath(cwd = process.cwd()): string {
  return path.join(getProjectRoot(cwd), DEFAULT_ESCROW_EXAMPLES_MANIFEST)
}

export function hasEscrowArtifact(cwd = process.cwd()): boolean {
  return fs.existsSync(getEscrowArtifactPath(cwd))
}

function createRunner(): CommandRunner {
  return (command, args, cwd) => spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
  })
}

export function buildTestPlan(options: BuildTestPlanOptions = {}): TestPlan {
  const {
    cwd = process.cwd(),
    includeEscrowTests = true,
    buildSbf = false,
    skipBuildSbf = false,
    locked = false,
    includeLocked = false,
  } = options

  const resolvedRoot = getProjectRoot(cwd)
  const commandPlan: TestPlanStep[] = [{
    label: 'root crate tests',
    command: 'cargo',
    args: ['test', '--all-features', ...(includeLocked || locked ? ['--locked'] : [])],
  }]

  if (!includeEscrowTests) {
    return { commandPlan, warnings: [], errors: [] }
  }

  const warnings: string[] = []
  const errors: string[] = []
  const artifactPath = getEscrowArtifactPath(resolvedRoot)
  const alreadyBuilt = hasEscrowArtifact(resolvedRoot)

  if (buildSbf || (skipBuildSbf === false && !alreadyBuilt)) {
    if (!alreadyBuilt && !buildSbf && skipBuildSbf === false) {
      warnings.push(
        `Auto-building missing escrow SBF artifact: ${artifactPath}`,
      )
    }

    commandPlan.push({
      label: 'build escrow program',
      command: 'cargo',
      args: ['build-sbf', '--manifest-path', DEFAULT_ESCROW_MANIFEST_PATH],
    })
  } else if (!alreadyBuilt && skipBuildSbf === true) {
    errors.push(
      `Missing escrow SBF artifact at ${artifactPath}. Run`
      + ' `cargo build-sbf --manifest-path examples/escrow/Cargo.toml`'
      + ' first, or pass --build-sbf.',
    )
  }

  commandPlan.push({
    label: 'examples/escrow tests',
    command: 'cargo',
    args: [
      'test',
      '--manifest-path',
      DEFAULT_ESCROW_MANIFEST_PATH,
      '--all-features',
      ...(includeLocked || locked ? ['--locked'] : []),
    ],
  })

  return {
    commandPlan,
    warnings,
    errors,
  }
}

export function runTestPlan(plan: TestPlan, options: RunTestPlanOptions = {}): { rootDir: string; stepCount: number } {
  const {
    cwd = process.cwd(),
    runCommand = createRunner(),
  } = options

  for (const warning of plan.warnings) {
    console.log(warning)
  }

  if (plan.errors.length > 0) {
    throw new Error(plan.errors.join('\n'))
  }

  for (const step of plan.commandPlan) {
    const result = runCommand(step.command, step.args, getProjectRoot(cwd))
    const failed = result.status !== 0 || Boolean(result.error)
    if (failed) {
      const details = result.error ? ` (${result.error.message})` : ''
      throw new Error(`${step.label} failed with status ${result.status}${details}`)
    }
  }

  return {
    rootDir: getProjectRoot(cwd),
    stepCount: plan.commandPlan.length,
  }
}

export function runGeppettoTest(options: BuildTestPlanOptions & RunTestPlanOptions = {}): { rootDir: string; stepCount: number } {
  const plan = buildTestPlan(options)
  return runTestPlan(plan, options)
}


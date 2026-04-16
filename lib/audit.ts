import { spawnSync } from 'node:child_process'

export interface AuditCheck {
  label: string
  command: string
  args: string[]
}

interface RunnerResult {
  status: number | null
  error?: Error
}

type CommandRunner = (command: string, args: string[], cwd: string) => RunnerResult

export interface BuildAuditPlanOptions {
  strict?: boolean
  includeLocked?: boolean
}

export interface RunAuditPlanOptions {
  cwd?: string
  runCommand?: CommandRunner
}

function createRunner(): CommandRunner {
  return (command, args, cwd) => spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
  })
}

export function buildAuditPlan(options: BuildAuditPlanOptions = {}): AuditCheck[] {
  const {
    strict = false,
    includeLocked = false,
  } = options

  const checks: AuditCheck[] = [{
    label: 'format check',
    command: 'cargo',
    args: ['fmt', '--check'],
  }, {
    label: 'strict compile check',
    command: 'cargo',
    args: ['check', '--all-features', ...(includeLocked ? ['--locked'] : [])],
  }]

  if (strict) {
    checks.push({
      label: 'clippy',
      command: 'cargo',
      args: [
        'clippy',
        '--all-targets',
        '--all-features',
        '--',
        '-D',
        'warnings',
      ],
    })
  }

  return checks
}

export function runAuditPlan(checks: AuditCheck[] = [], options: RunAuditPlanOptions = {}): void {
  const {
    cwd = process.cwd(),
    runCommand = createRunner(),
  } = options

  for (const check of checks) {
    const result = runCommand(check.command, check.args, cwd)
    const failed = result.status !== 0 || Boolean(result.error)
    if (failed) {
      const details = result.error ? ` (${result.error.message})` : ''
      throw new Error(`${check.label} failed with status ${result.status}${details}`)
    }
  }
}

export function runGeppettoAudit(options: BuildAuditPlanOptions & RunAuditPlanOptions = {}): { checks: AuditCheck[] } {
  const checks = buildAuditPlan(options)
  runAuditPlan(checks, options)

  return {
    checks,
  }
}


import type { DeployState, StepLog, PlatformConfig } from './types'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function createRunId(date: Date = new Date()): string {
  return `run_${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}_${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
}

export function createDeployState(
  config: PlatformConfig,
  options: { runId?: string; now?: Date } = {},
): DeployState {
  const runId = options.runId || createRunId(options.now)

  return {
    run_id: runId,
    app_name: config.app.name,
    cluster: config.solana.cluster,
    program_path: config.solana.programPath,
    program_binary: config.solana.programBinary,
    program_id: config.solana.programId || '',
    service_url: null,
    provider_deployment_id: null,
    status: 'success',
    failure_class: null,
    steps: [],
  }
}

function appendStepLog(state: DeployState, stepLog: StepLog): DeployState {
  state.steps.push(stepLog)
  return state
}

export function recordStepSuccess(state: DeployState, name: string, elapsedMs: number): DeployState {
  return appendStepLog(state, {
    name,
    status: 'success',
    elapsed_ms: elapsedMs,
  })
}

export function recordStepFailure(
  state: DeployState,
  name: string,
  error: Error & { failureClass?: string },
  elapsedMs: number,
): DeployState {
  state.status = 'failure'
  state.failure_class = (error.failureClass || state.failure_class || 'deploy') as DeployState['failure_class']

  return appendStepLog(state, {
    name,
    status: 'failure',
    error: error.message,
    elapsed_ms: elapsedMs,
  })
}

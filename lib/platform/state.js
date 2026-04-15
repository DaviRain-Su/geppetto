function pad(value) {
  return String(value).padStart(2, '0')
}

function createRunId(date = new Date()) {
  return `run_${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}_${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
}

function createDeployState(config, options = {}) {
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

function appendStepLog(state, stepLog) {
  state.steps.push(stepLog)
  return state
}

function recordStepSuccess(state, name, elapsedMs) {
  return appendStepLog(state, {
    name,
    status: 'success',
    elapsed_ms: elapsedMs,
  })
}

function recordStepFailure(state, name, error, elapsedMs) {
  state.status = 'failure'
  state.failure_class = error.failureClass || state.failure_class || 'deploy'

  return appendStepLog(state, {
    name,
    status: 'failure',
    error: error.message,
    elapsed_ms: elapsedMs,
  })
}

module.exports = {
  createRunId,
  createDeployState,
  appendStepLog,
  recordStepSuccess,
  recordStepFailure,
}

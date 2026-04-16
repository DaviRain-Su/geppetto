const {
  createPlatformError,
  wrapStepError,
} = require('./errors')
const {
  recordStepSuccess,
  recordStepFailure,
} = require('./state')

async function runPipeline({ ctx = {}, config, initialState, steps }) {
  let state = initialState

  for (const step of steps) {
    const startedAt = Date.now()

    try {
      const nextState = await step.run(ctx, state, config)
      state = nextState || state
      recordStepSuccess(state, step.name, Date.now() - startedAt)
    } catch (error) {
      const wrapped = wrapStepError(step.name, error)
      recordStepFailure(state, step.name, wrapped, Date.now() - startedAt)
      wrapped.state = state
      throw wrapped
    }
  }

  return state
}

function bridgeOutputs(state, options = {}) {
  const requiredFields = [
    ['run_id', state.run_id],
    ['cluster', state.cluster],
    ['program_id', state.program_id],
  ]

  // service_url is only required in hybrid mode (offchain configured)
  if (options.mode !== 'solana') {
    requiredFields.push(['service_url', state.service_url])
  }

  for (const [fieldName, value] of requiredFields) {
    if (!value) {
      throw createPlatformError(
        'EDEPLOY003',
        `Missing required deploy output: ${fieldName}`,
        { step: 'bridgeOutputs', details: { fieldName } },
      )
    }
  }

  return {
    ...state,
    status: 'success',
    failure_class: null,
  }
}

module.exports = {
  runPipeline,
  bridgeOutputs,
}

const assert = require('node:assert/strict')
const test = require('node:test')

const { createPlatformError } = require('../../lib/platform/errors')
const { createDeployState } = require('../../lib/platform/state')
const { runPipeline, bridgeOutputs } = require('../../lib/platform/deploy')

function makeConfig() {
  return {
    app: { name: 'escrow-demo' },
    solana: {
      cluster: 'devnet',
      programPath: 'examples/escrow',
      programBinary: 'target/deploy/escrow.so',
      programId: '',
    },
  }
}

test('runPipeline executes steps sequentially and records success logs', async () => {
  const state = createDeployState(makeConfig(), { runId: 'run_fixed' })
  const order = []

  const result = await runPipeline({
    config: makeConfig(),
    initialState: state,
    steps: [
      {
        name: 'loadManifest',
        run: async (_ctx, currentState) => {
          order.push('loadManifest')
          return currentState
        },
      },
      {
        name: 'validateConfig',
        run: async (_ctx, currentState) => {
          order.push('validateConfig')
          return currentState
        },
      },
    ],
  })

  assert.deepEqual(order, ['loadManifest', 'validateConfig'])
  assert.equal(result.steps.length, 2)
  assert.equal(result.steps[0].status, 'success')
  assert.equal(result.steps[1].status, 'success')
})

test('runPipeline fails fast and attaches failed state to error', async () => {
  const state = createDeployState(makeConfig(), { runId: 'run_fixed' })

  await assert.rejects(async () => {
    await runPipeline({
      config: makeConfig(),
      initialState: state,
      steps: [
        {
          name: 'buildProgram',
          run: async () => {
            throw createPlatformError('EBUILD001', 'boom')
          },
        },
      ],
    })
  }, (error) => {
    assert.equal(error.step, 'buildProgram')
    assert.equal(error.failureClass, 'build')
    assert.equal(error.state.status, 'failure')
    assert.equal(error.state.steps.length, 1)
    assert.equal(error.state.steps[0].status, 'failure')
    return true
  })
})

test('bridgeOutputs returns success state when required fields exist', () => {
  const state = createDeployState(makeConfig(), { runId: 'run_fixed' })
  state.program_id = 'abc123'
  state.service_url = 'https://example.test'

  const result = bridgeOutputs(state)

  assert.equal(result.status, 'success')
  assert.equal(result.failure_class, null)
})

test('bridgeOutputs rejects missing required outputs', () => {
  const state = createDeployState(makeConfig(), { runId: 'run_fixed' })
  state.program_id = 'abc123'

  assert.throws(() => {
    bridgeOutputs(state)
  }, /Missing required deploy output: service_url/)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPlatformError,
  classifyError,
  wrapStepError,
} from '../../lib/platform/errors'
import {
  createRunId,
  createDeployState,
  recordStepSuccess,
  recordStepFailure,
} from '../../lib/platform/state'

function makeConfig(): any {
  return {
    schemaVersion: '0.1',
    app: { name: 'escrow-demo' },
    solana: {
      cluster: 'devnet',
      programPath: 'examples/escrow',
      programBinary: 'target/deploy/escrow.so',
      keypair: '~/.config/solana/id.json',
      programId: '',
    },
    offchain: null,
    deploy: { mode: 'solana', output: 'table' },
    paths: {
      manifestPath: 'geppetto.toml',
      repoRoot: '.',
      programPath: 'examples/escrow',
    },
  }
}

test('createRunId uses stable UTC timestamp formatting', () => {
  const date = new Date(Date.UTC(2026, 3, 15, 14, 5, 9))
  assert.equal(createRunId(date), 'run_20260415_140509')
})

test('createDeployState initializes normalized fields', () => {
  const state = createDeployState(makeConfig(), { runId: 'run_fixed' })

  assert.equal(state.run_id, 'run_fixed')
  assert.equal(state.app_name, 'escrow-demo')
  assert.equal(state.cluster, 'devnet')
  assert.equal(state.program_id, '')
  assert.equal(state.status, 'success')
  assert.deepEqual(state.steps, [])
})

test('recordStepSuccess appends a success step', () => {
  const state = createDeployState(makeConfig(), { runId: 'run_fixed' })
  recordStepSuccess(state, 'loadManifest', 12)

  assert.deepEqual(state.steps, [{
    name: 'loadManifest',
    status: 'success',
    elapsed_ms: 12,
  }])
})

test('recordStepFailure appends a failure step and marks state failed', () => {
  const state = createDeployState(makeConfig(), { runId: 'run_fixed' })
  const error = createPlatformError('EDEPLOY001', 'deploy failed')
  recordStepFailure(state, 'deployProgram', error, 25)

  assert.equal(state.status, 'failure')
  assert.equal(state.failure_class, 'deploy')
  assert.deepEqual(state.steps, [{
    name: 'deployProgram',
    status: 'failure',
    error: 'deploy failed',
    elapsed_ms: 25,
  }])
})

test('classifyError maps codes to failure classes', () => {
  assert.equal(classifyError(createPlatformError('ECFG004', 'bad config')), 'config')
  assert.equal(classifyError(createPlatformError('EBUILD001', 'bad build')), 'build')
  assert.equal(classifyError(createPlatformError('EDEPLOY004', 'bad deploy')), 'deploy')
})

test('wrapStepError injects step metadata and preserves classification', () => {
  const wrapped = wrapStepError('buildProgram', createPlatformError('EBUILD001', 'boom'))

  assert.equal(wrapped.step, 'buildProgram')
  assert.equal(wrapped.failureClass, 'build')
  assert.match(wrapped.message, /^step buildProgram: boom$/)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { main, parseDeployArgs } from '../../bin/geppetto-cli'
import { renderDeployOutput } from '../../lib/platform/output'

// --- parseDeployArgs ---

test('parseDeployArgs returns defaults with no arguments', () => {
  const result = parseDeployArgs([])
  assert.deepEqual(result, {
    options: { output: 'table', setValues: [], writeBack: false },
  })
})

test('parseDeployArgs parses --output json', () => {
  const result = parseDeployArgs(['--output', 'json'])
  assert.equal((result as any).options.output, 'json')
})

test('parseDeployArgs parses -o table', () => {
  const result = parseDeployArgs(['-o', 'table'])
  assert.equal((result as any).options.output, 'table')
})

test('parseDeployArgs rejects invalid output format', () => {
  const result = parseDeployArgs(['--output', 'xml'])
  assert.ok((result as any).error)
  assert.ok((result as any).error.includes('xml'))
})

test('parseDeployArgs rejects --output without value', () => {
  const result = parseDeployArgs(['--output'])
  assert.ok((result as any).error)
})

test('parseDeployArgs collects multiple --set values', () => {
  const result = parseDeployArgs(['--set', 'cluster=devnet', '--set', 'replicas=3'])
  assert.deepEqual((result as any).options.setValues, ['cluster=devnet', 'replicas=3'])
})

test('parseDeployArgs rejects --set without value', () => {
  const result = parseDeployArgs(['--set'])
  assert.ok((result as any).error)
})

test('parseDeployArgs parses --write-back flag', () => {
  const result = parseDeployArgs(['--write-back'])
  assert.equal((result as any).options.writeBack, true)
})

test('parseDeployArgs returns help on --help', () => {
  const result = parseDeployArgs(['--help'])
  assert.ok((result as any).help)
})

test('parseDeployArgs rejects unexpected arguments', () => {
  const result = parseDeployArgs(['--unknown'])
  assert.ok((result as any).error)
  assert.ok((result as any).error.includes('--unknown'))
})

test('parseDeployArgs handles combined flags', () => {
  const result = parseDeployArgs([
    '--output', 'json',
    '--set', 'cluster=testnet',
    '--write-back',
  ])
  assert.equal((result as any).options.output, 'json')
  assert.deepEqual((result as any).options.setValues, ['cluster=testnet'])
  assert.equal((result as any).options.writeBack, true)
})

// --- renderDeployOutput ---

test('renderDeployOutput JSON format includes all fields', () => {
  const state: any = {
    run_id: 'run_20260415_140000',
    app_name: 'escrow-demo',
    cluster: 'devnet',
    program_path: 'examples/escrow',
    program_binary: 'target/deploy/escrow.so',
    program_id: 'abc123',
    service_url: 'https://example.test',
    provider_deployment_id: null,
    status: 'success',
    failure_class: null,
    steps: [
      { name: 'buildProgram', status: 'success', elapsed_ms: 100 },
    ],
  }

  let output = ''
  const stream = { write: (s: string) => { output += s } }
  renderDeployOutput(state, 'json', stream)

  const parsed = JSON.parse(output)
  assert.equal(parsed.run_id, 'run_20260415_140000')
  assert.equal(parsed.program_id, 'abc123')
  assert.equal(parsed.service_url, 'https://example.test')
  assert.equal(parsed.status, 'success')
  assert.equal(parsed.steps.length, 1)
})

test('renderDeployOutput JSON converts empty strings to null', () => {
  const state: any = {
    run_id: 'run_test',
    app_name: 'test',
    cluster: 'devnet',
    program_path: 'examples/escrow',
    program_binary: 'target/deploy/escrow.so',
    program_id: '',
    service_url: '',
    provider_deployment_id: '',
    status: 'failure',
    failure_class: 'build',
    steps: [],
  }

  let output = ''
  const stream = { write: (s: string) => { output += s } }
  renderDeployOutput(state, 'json', stream)

  const parsed = JSON.parse(output)
  assert.equal(parsed.program_id, null)
  assert.equal(parsed.service_url, null)
  assert.equal(parsed.provider_deployment_id, null)
})

test('renderDeployOutput table format includes step icons', () => {
  const state: any = {
    run_id: 'run_test',
    app_name: 'test',
    cluster: 'devnet',
    program_path: 'examples/escrow',
    program_binary: 'target/deploy/escrow.so',
    program_id: 'abc',
    service_url: '',
    provider_deployment_id: '',
    status: 'failure',
    failure_class: 'build',
    steps: [
      { name: 'buildProgram', status: 'success', elapsed_ms: 50 },
      { name: 'deployProgram', status: 'failure', elapsed_ms: 200, error: 'EDEPLOY001: boom' },
    ],
  }

  let output = ''
  const stream = { write: (s: string) => { output += s } }
  renderDeployOutput(state, 'table', stream)

  assert.ok(output.includes('✓ buildProgram'))
  assert.ok(output.includes('✗ deployProgram'))
  assert.ok(output.includes('EDEPLOY001: boom'))
})

// --- main() deploy command ---

test('main deploy --help returns 0', () => {
  let out = ''
  const result = main(['deploy', '--help'], {
    stdout: { write: (s: string) => { out += s } },
    stderr: { write: () => {} },
    cwd: process.cwd(),
  } as any)
  assert.equal(result, 0)
  assert.ok(out.includes('deploy'))
})

test('main deploy with invalid arg returns 1', () => {
  let err = ''
  const result = main(['deploy', '--bogus'], {
    stdout: { write: () => {} },
    stderr: { write: (s: string) => { err += s } },
    cwd: process.cwd(),
  } as any)
  assert.equal(result, 1)
  assert.ok(err.includes('--bogus'))
})

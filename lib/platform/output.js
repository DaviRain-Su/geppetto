const fs = require('node:fs')
const path = require('node:path')
const { createPlatformError } = require('./errors')

function renderDeployOutput(state, format, stream) {
  if (format === 'json') {
    stream.write(JSON.stringify(buildJsonOutput(state), null, 2) + '\n')
    return
  }

  // Table format
  stream.write('\n')
  stream.write(`  Run ID:    ${state.run_id}\n`)
  stream.write(`  App:       ${state.app_name}\n`)
  stream.write(`  Cluster:   ${state.cluster}\n`)
  stream.write(`  Program:   ${state.program_id || '(not assigned)'}\n`)
  stream.write(`  Service:   ${state.service_url || '(not available)'}\n`)
  stream.write(`  Status:    ${state.status}\n`)
  if (state.failure_class) {
    stream.write(`  Failure:   ${state.failure_class}\n`)
  }
  stream.write('\n')

  // Step table
  if (state.steps.length > 0) {
    stream.write('  Steps:\n')
    for (const step of state.steps) {
      const icon = step.status === 'success' ? '✓' : '✗'
      const elapsed = step.elapsed_ms != null ? ` (${step.elapsed_ms}ms)` : ''
      stream.write(`    ${icon} ${step.name}${elapsed}\n`)
      if (step.error) {
        stream.write(`      Error: ${step.error}\n`)
      }
    }
    stream.write('\n')
  }
}

function buildJsonOutput(state) {
  return {
    run_id: state.run_id,
    app_name: state.app_name,
    cluster: state.cluster,
    program_id: state.program_id || null,
    service_url: state.service_url || null,
    provider_deployment_id: state.provider_deployment_id || null,
    status: state.status,
    failure_class: state.failure_class || null,
    steps: state.steps,
  }
}

function buildTextOutput(state) {
  const lines = []
  lines.push(`Run ID:    ${state.run_id}`)
  lines.push(`App:       ${state.app_name}`)
  lines.push(`Cluster:   ${state.cluster}`)
  lines.push(`Program:   ${state.program_id || '(not assigned)'}`)
  lines.push(`Service:   ${state.service_url || '(not available)'}`)
  lines.push(`Status:    ${state.status}`)
  if (state.failure_class) {
    lines.push(`Failure:   ${state.failure_class}`)
  }
  if (state.steps.length > 0) {
    lines.push('')
    lines.push('Steps:')
    for (const step of state.steps) {
      const icon = step.status === 'success' ? '✓' : '✗'
      const elapsed = step.elapsed_ms != null ? ` (${step.elapsed_ms}ms)` : ''
      lines.push(`  ${icon} ${step.name}${elapsed}`)
      if (step.error) {
        lines.push(`    Error: ${step.error}`)
      }
    }
  }
  lines.push('')
  return lines.join('\n')
}

function writeArtifacts(state, repoRoot) {
  const dotGeppetto = path.join(repoRoot, '.geppetto')

  try {
    fs.mkdirSync(dotGeppetto, { recursive: true })
  } catch (error) {
    throw createPlatformError(
      'EDEPLOY005',
      `Failed to create .geppetto directory: ${error.message}`,
      { cause: error },
    )
  }

  const jsonPath = path.join(dotGeppetto, 'deploy-output.json')
  const jsonContent = JSON.stringify(buildJsonOutput(state), null, 2) + '\n'

  try {
    fs.writeFileSync(jsonPath, jsonContent, 'utf8')
  } catch (error) {
    throw createPlatformError(
      'EDEPLOY005',
      `Failed to write deploy-output.json: ${error.message}`,
      { cause: error },
    )
  }

  const txtPath = path.join(dotGeppetto, 'deploy-output.txt')
  const txtContent = buildTextOutput(state)

  try {
    fs.writeFileSync(txtPath, txtContent, 'utf8')
  } catch (error) {
    throw createPlatformError(
      'EDEPLOY005',
      `Failed to write deploy-output.txt: ${error.message}`,
      { cause: error },
    )
  }
}

module.exports = {
  renderDeployOutput,
  buildJsonOutput,
  buildTextOutput,
  writeArtifacts,
}

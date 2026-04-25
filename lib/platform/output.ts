import * as fs from 'node:fs'
import * as path from 'node:path'
import { createPlatformError } from './errors'
import type { DeployState, OutputFormat, JsonOutput } from './types'

export type OutputStream = { write: (chunk: string) => void }

export function renderDeployOutput(state: DeployState, format: OutputFormat, stream: OutputStream): void {
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

export function buildJsonOutput(state: DeployState): JsonOutput {
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

function buildTextOutput(state: DeployState): string {
  const lines: string[] = []
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

export function writeBackProgramId(manifestPath: string, programId: string): void {
  if (!programId) {
    return
  }

  let content: string
  try {
    content = fs.readFileSync(manifestPath, 'utf8')
  } catch (error) {
    throw createPlatformError(
      'ECFG002',
      `Failed to read manifest for write-back: ${(error as Error).message}`,
      { cause: error as Error },
    )
  }

  const solanaSectionRegex = /(\[solana\][\s\S]*?)(^program_id\s*=\s*["'][^"'\n]*["'])([ \t]*#[^\n]*)?/m
  const hasProgramId = solanaSectionRegex.test(content)

  if (hasProgramId) {
    content = content.replace(solanaSectionRegex, (_match: string, section: string, _programLine: string, trailingComment?: string) => {
      const suffix = trailingComment || ''
      return section + `program_id = "${programId}"` + suffix
    })
  } else {
    content = content.replace(/(\[solana\]\n)/, `$1program_id = "${programId}"\n`)
  }

  try {
    fs.writeFileSync(manifestPath, content, 'utf8')
  } catch (error) {
    throw createPlatformError(
      'EDEPLOY005',
      `Failed to write manifest: ${(error as Error).message}`,
      { cause: error as Error },
    )
  }
}

export function writeArtifacts(state: DeployState, repoRoot: string): void {
  const dotGeppetto = path.join(repoRoot, '.geppetto')

  try {
    fs.mkdirSync(dotGeppetto, { recursive: true })
  } catch (error) {
    throw createPlatformError(
      'EDEPLOY005',
      `Failed to create .geppetto directory: ${(error as Error).message}`,
      { cause: error as Error },
    )
  }

  const jsonPath = path.join(dotGeppetto, 'deploy-output.json')
  const jsonContent = JSON.stringify(buildJsonOutput(state), null, 2) + '\n'

  try {
    fs.writeFileSync(jsonPath, jsonContent, 'utf8')
  } catch (error) {
    throw createPlatformError(
      'EDEPLOY005',
      `Failed to write deploy-output.json: ${(error as Error).message}`,
      { cause: error as Error },
    )
  }

  const txtPath = path.join(dotGeppetto, 'deploy-output.txt')
  const txtContent = buildTextOutput(state)

  try {
    fs.writeFileSync(txtPath, txtContent, 'utf8')
  } catch (error) {
    throw createPlatformError(
      'EDEPLOY005',
      `Failed to write deploy-output.txt: ${(error as Error).message}`,
      { cause: error as Error },
    )
  }
}

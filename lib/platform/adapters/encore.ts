import { exec, execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import type {
  CreatePlatformErrorOptions,
  EncoreDeployResult,
  PipelineContext,
  PlatformConfig,
  PlatformError,
} from '../types'

const { createPlatformError } = require('../errors') as {
  createPlatformError: (
    code: string,
    message?: string,
    options?: CreatePlatformErrorOptions,
  ) => PlatformError
}

interface ExecResult {
  stdout: string
  stderr: string
}

interface ExecOptions {
  cwd?: string
  maxBuffer?: number
}

interface EncoreRunner {
  execFile: (file: string, args: string[], options?: ExecOptions) => Promise<ExecResult>
  exec: (command: string, options?: ExecOptions) => Promise<ExecResult>
}

function execFilePromise(file: string, args: string[], options?: ExecOptions): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options ?? {}, (error, stdout, stderr) => {
      if (error) {
        reject(error)
        return
      }

      resolve({ stdout, stderr })
    })
  })
}

function execPromise(command: string, options?: ExecOptions): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    exec(command, options ?? {}, (error, stdout, stderr) => {
      if (error) {
        reject(error)
        return
      }

      resolve({ stdout, stderr })
    })
  })
}

function isPlatformError(error: unknown): error is PlatformError {
  return Boolean(
    error
      && typeof error === 'object'
      && 'code' in error
      && typeof (error as { code?: unknown }).code === 'string'
      && (error as { code: string }).code.startsWith('E'),
  )
}

export const runner: EncoreRunner = {
  execFile: execFilePromise,
  exec: execPromise,
}

function readEncoreAppId(projectPath: string): string {
  const encoreAppPath = path.join(projectPath, 'encore.app')

  try {
    const content = fs.readFileSync(encoreAppPath, 'utf8')
    const match = content.match(/"id"\s*:\s*"([^"]*)"/)
    return match ? match[1] : ''
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    throw createPlatformError(
      'ECFG008',
      `Failed to read encore.app: ${err.message}`,
    )
  }
}

export async function deploy(
  ctx: PipelineContext,
  config: PlatformConfig,
): Promise<EncoreDeployResult> {
  const projectPath = config.paths.projectPath

  if (!projectPath) {
    throw createPlatformError(
      'ECFG008',
      'Encore project path is missing from platform config',
    )
  }

  try {
    const { stdout } = await runner.execFile('encore', ['auth', 'whoami'], { cwd: projectPath })
    if (stdout.includes('not logged in')) {
      throw createPlatformError(
        'ECFG007',
        'Encore auth required: run `encore auth login` first',
      )
    }
  } catch (error) {
    if (isPlatformError(error)) {
      throw error
    }

    const err = error instanceof Error ? error : new Error(String(error))
    throw createPlatformError(
      'ECFG007',
      `Encore auth check failed: ${err.message}`,
      { cause: err },
    )
  }

  const appId = readEncoreAppId(projectPath)
  if (!appId) {
    throw createPlatformError(
      'ECFG008',
      'Encore app not linked: run `encore app link <app-id>` first',
    )
  }

  let hasRemote = false
  try {
    const { stdout } = await runner.exec('git remote get-url encore', { cwd: projectPath })
    if (stdout.trim()) {
      hasRemote = true
    }
  } catch {
    hasRemote = false
  }

  if (!hasRemote) {
    try {
      await runner.exec(`git remote add encore encore://${appId}`, { cwd: projectPath })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      throw createPlatformError(
        'ECFG008',
        `Failed to add encore remote: ${err.message}`,
        { cause: err },
      )
    }
  }

  try {
    const { stdout } = await runner.exec('git status --porcelain', { cwd: projectPath })
    if (stdout.trim()) {
      await runner.exec('git add -A', { cwd: projectPath })
      const runId = ctx.runId ?? 'unknown'
      await runner.exec(`git commit -m "geppetto deploy ${runId}"`, { cwd: projectPath })
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    throw createPlatformError(
      'EDEPLOY002',
      `Git staging failed: ${err.message}`,
      { cause: err },
    )
  }

  let pushOutput = ''
  try {
    const { stdout, stderr } = await runner.exec('git push encore', { cwd: projectPath })
    pushOutput = stdout + stderr
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    throw createPlatformError(
      'EDEPLOY002',
      `Encore deploy failed: ${err.message}`,
      { cause: err },
    )
  }

  const deployMatch = pushOutput.match(/triggered deploy (https:\/\/[^\s]+)/)
  if (!deployMatch) {
    throw createPlatformError(
      'EDEPLOY003',
      'Encore deploy succeeded but deploy URL not found in output',
      { details: { output: pushOutput } },
    )
  }

  const deployUrl = deployMatch[1]
  const urlParts = deployUrl.split('/')
  const providerDeploymentId = urlParts[urlParts.length - 1] || null

  return {
    provider_deployment_id: providerDeploymentId,
    service_url: deployUrl,
  }
}

export async function pollServiceURL(
  _ctx: PipelineContext,
  _config: PlatformConfig,
  partial: Partial<EncoreDeployResult>,
): Promise<string> {
  if (partial.service_url) {
    return partial.service_url
  }

  throw createPlatformError(
    'EDEPLOY004',
    'Service URL polling timeout',
  )
}

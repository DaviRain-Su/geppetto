import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type {
  Cluster,
  PipelineContext,
  PlatformConfig,
  PlatformError,
  SolanaDeployResult,
} from '../types'
import { createPlatformError } from '../errors'

interface ExecResult {
  stdout: string
  stderr: string
}

interface ExecOptions {
  cwd?: string
  maxBuffer?: number
}

interface SolanaRunner {
  exec: (file: string, args: string[], options?: ExecOptions) => Promise<ExecResult>
}

export const CLUSTER_URLS: Record<Cluster, string> = {
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
}

export function resolveHome(filepath: string | undefined): string | undefined {
  if (filepath && filepath.startsWith('~')) {
    return path.join(os.homedir(), filepath.slice(1))
  }

  return filepath
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

function isPlatformError(error: unknown): error is PlatformError {
  return Boolean(
    error
      && typeof error === 'object'
      && 'code' in error
      && typeof (error as { code?: unknown }).code === 'string'
      && (error as { code: string }).code.startsWith('E'),
  )
}

export const runner: SolanaRunner = {
  exec: execFilePromise,
}

export async function build(_ctx: PipelineContext, config: PlatformConfig): Promise<void> {
  const programPath = config.paths.programPath

  try {
    await runner.exec('cargo', ['build-sbf'], {
      cwd: programPath,
      maxBuffer: 10 * 1024 * 1024,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    throw createPlatformError(
      'EBUILD001',
      `Program build failed: ${err.message}`,
      { cause: err },
    )
  }

  const binaryPath = path.resolve(config.paths.repoRoot, config.solana.programBinary)
  if (!fs.existsSync(binaryPath)) {
    throw createPlatformError(
      'EBUILD001',
      `Program binary not found after build: ${config.solana.programBinary}`,
    )
  }
}

export async function deploy(
  _ctx: PipelineContext,
  config: PlatformConfig,
): Promise<SolanaDeployResult> {
  const binaryPath = path.resolve(config.paths.repoRoot, config.solana.programBinary)

  if (!fs.existsSync(binaryPath)) {
    throw createPlatformError(
      'EDEPLOY001',
      `Program binary not found: ${config.solana.programBinary}`,
    )
  }

  const args = ['program', 'deploy', binaryPath]

  if (config.solana.programId) {
    args.push('--program-id', config.solana.programId)
  }

  const keypairPath = resolveHome(config.solana.keypair)
  if (keypairPath) {
    args.push('--keypair', keypairPath)
  }

  const clusterUrl = CLUSTER_URLS[config.solana.cluster]
  if (clusterUrl) {
    args.push('--url', clusterUrl)
  }

  try {
    const { stdout, stderr } = await runner.exec('solana', args, {
      maxBuffer: 10 * 1024 * 1024,
    })

    const output = stdout + stderr
    const match = output.match(/Program Id:\s*([A-Za-z0-9]{32,44})/)

    if (!match) {
      throw createPlatformError(
        'EDEPLOY001',
        'Solana deploy succeeded but program id not found in output',
        { details: { output } },
      )
    }

    return {
      program_id: match[1],
      cluster: config.solana.cluster,
    }
  } catch (error) {
    if (isPlatformError(error)) {
      throw error
    }

    const err = error instanceof Error ? error : new Error(String(error))
    throw createPlatformError(
      'EDEPLOY001',
      `Solana deploy failed: ${err.message}`,
      { cause: err },
    )
  }
}

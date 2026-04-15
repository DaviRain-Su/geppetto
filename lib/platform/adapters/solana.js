const { execFile } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createPlatformError } = require('../errors')

const CLUSTER_URLS = {
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
}

function resolveHome(filepath) {
  if (filepath && filepath.startsWith('~')) {
    return path.join(os.homedir(), filepath.slice(1))
  }
  return filepath
}

function execFilePromise(file, args, options) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error)
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

const runner = {
  exec: execFilePromise,
}

async function build(_ctx, config) {
  const programPath = config.paths.programPath

  try {
    await runner.exec('cargo', ['build-sbf'], {
      cwd: programPath,
      maxBuffer: 10 * 1024 * 1024,
    })
  } catch (error) {
    throw createPlatformError(
      'EBUILD001',
      `Program build failed: ${error.message}`,
      { cause: error },
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

async function deploy(_ctx, config) {
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
    if (error.code && typeof error.code === 'string' && error.code.startsWith('E')) {
      throw error
    }

    throw createPlatformError(
      'EDEPLOY001',
      `Solana deploy failed: ${error.message}`,
      { cause: error },
    )
  }
}

module.exports = {
  build,
  deploy,
  resolveHome,
  CLUSTER_URLS,
  runner,
}

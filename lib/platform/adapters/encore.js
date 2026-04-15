const { execFile, exec } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { createPlatformError } = require('../errors')

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

function execPromise(command, options) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error)
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

const runner = {
  execFile: execFilePromise,
  exec: execPromise,
}

async function deploy(ctx, config) {
  const projectPath = config.paths.projectPath

  // Step A: auth check
  try {
    const { stdout } = await runner.execFile('encore', ['auth', 'whoami'], { cwd: projectPath })
    if (stdout.includes('not logged in')) {
      throw createPlatformError(
        'EDEPLOY002',
        'Encore auth required: run `encore auth login` first',
      )
    }
  } catch (error) {
    if (error.code && typeof error.code === 'string' && error.code.startsWith('E')) {
      throw error
    }

    throw createPlatformError(
      'EDEPLOY002',
      `Encore auth check failed: ${error.message}`,
      { cause: error },
    )
  }

  // Step B: encore.app link check
  const encoreAppPath = path.join(projectPath, 'encore.app')
  let appId = ''

  try {
    const content = fs.readFileSync(encoreAppPath, 'utf8')
    const match = content.match(/"id"\s*:\s*"([^"]*)"/)
    if (match) {
      appId = match[1]
    }
  } catch (error) {
    throw createPlatformError(
      'EDEPLOY002',
      `Failed to read encore.app: ${error.message}`,
    )
  }

  if (!appId) {
    throw createPlatformError(
      'EDEPLOY002',
      'Encore app not linked: run `encore app link <app-id>` first',
    )
  }

  // Step C: git remote check
  let hasRemote = false
  try {
    const { stdout } = await runner.exec('git remote get-url encore', { cwd: projectPath })
    if (stdout.trim()) {
      hasRemote = true
    }
  } catch (_error) {
    hasRemote = false
  }

  if (!hasRemote) {
    try {
      await runner.exec(`git remote add encore encore://${appId}`, { cwd: projectPath })
    } catch (addError) {
      throw createPlatformError(
        'EDEPLOY002',
        `Failed to add encore remote: ${addError.message}`,
        { cause: addError },
      )
    }
  }

  // Step D: check for changes, stage and commit if needed
  try {
    const { stdout } = await runner.exec('git status --porcelain', { cwd: projectPath })
    if (stdout.trim()) {
      await runner.exec('git add -A', { cwd: projectPath })
      const runId = (ctx && ctx.runId) ? ctx.runId : 'unknown'
      await runner.exec(`git commit -m "geppetto deploy ${runId}"`, { cwd: projectPath })
    }
  } catch (error) {
    throw createPlatformError(
      'EDEPLOY002',
      `Git staging failed: ${error.message}`,
      { cause: error },
    )
  }

  // Step E: git push encore
  let pushOutput = ''
  try {
    const { stdout, stderr } = await runner.exec('git push encore', { cwd: projectPath })
    pushOutput = stdout + stderr
  } catch (error) {
    throw createPlatformError(
      'EDEPLOY002',
      `Encore deploy failed: ${error.message}`,
      { cause: error },
    )
  }

  // Step F: extract deploy URL and provider_deployment_id
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

async function pollServiceURL(_ctx, _config, partial) {
  // MVP: deploy output already contains the URL from git push stdout
  // If already present, return immediately; otherwise timeout
  if (partial && partial.service_url) {
    return partial.service_url
  }

  throw createPlatformError(
    'EDEPLOY004',
    'Service URL polling timeout',
  )
}

module.exports = {
  deploy,
  pollServiceURL,
  runner,
}

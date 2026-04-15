const ERROR_DEFINITIONS = {
  ECFG001: { failureClass: 'config', defaultMessage: 'Missing geppetto.toml' },
  ECFG002: { failureClass: 'config', defaultMessage: 'Invalid geppetto.toml syntax' },
  ECFG003: { failureClass: 'config', defaultMessage: 'Unsupported schema_version' },
  ECFG004: { failureClass: 'config', defaultMessage: 'Missing required configuration' },
  ECFG005: { failureClass: 'config', defaultMessage: 'Invalid configuration value' },
  ECFG006: { failureClass: 'config', defaultMessage: 'Invalid override format or key' },
  ECFG007: { failureClass: 'config', defaultMessage: 'Encore auth required' },
  ECFG008: { failureClass: 'config', defaultMessage: 'Encore app not linked or remote missing' },
  EBUILD001: { failureClass: 'build', defaultMessage: 'Program build failed' },
  EDEPLOY001: { failureClass: 'deploy', defaultMessage: 'Solana deploy failed' },
  EDEPLOY002: { failureClass: 'deploy', defaultMessage: 'Encore deploy failed' },
  EDEPLOY003: { failureClass: 'deploy', defaultMessage: 'Missing required deploy output' },
  EDEPLOY004: { failureClass: 'deploy', defaultMessage: 'Service URL polling timeout' },
}

function createPlatformError(code, message, options = {}) {
  const definition = ERROR_DEFINITIONS[code]

  if (!definition) {
    throw new Error(`Unknown platform error code: ${code}`)
  }

  const error = new Error(message || definition.defaultMessage)
  error.name = 'PlatformError'
  error.code = code
  error.failureClass = definition.failureClass

  if (options.step) {
    error.step = options.step
  }

  if (options.details !== undefined) {
    error.details = options.details
  }

  if (options.cause) {
    error.cause = options.cause
  }

  return error
}

function classifyError(error) {
  if (!error) {
    return 'deploy'
  }

  if (error.failureClass) {
    return error.failureClass
  }

  if (typeof error.code === 'string') {
    if (error.code.startsWith('ECFG')) {
      return 'config'
    }

    if (error.code.startsWith('EBUILD')) {
      return 'build'
    }

    if (error.code.startsWith('EDEPLOY')) {
      return 'deploy'
    }
  }

  if (typeof error.step === 'string') {
    if (error.step === 'loadManifest' || error.step === 'validateConfig') {
      return 'config'
    }

    if (error.step === 'buildProgram') {
      return 'build'
    }
  }

  return 'deploy'
}

function wrapStepError(step, error) {
  const wrapped = error instanceof Error ? error : new Error(String(error))

  if (!wrapped.step) {
    wrapped.step = step
  }

  if (!wrapped.failureClass) {
    wrapped.failureClass = classifyError(wrapped)
  }

  wrapped.message = `step ${step}: ${wrapped.message}`
  return wrapped
}

module.exports = {
  ERROR_DEFINITIONS,
  createPlatformError,
  classifyError,
  wrapStepError,
}

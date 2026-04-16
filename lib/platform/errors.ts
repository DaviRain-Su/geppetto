import type {
  ErrorDefinition,
  PlatformError,
  FailureClass,
  CreatePlatformErrorOptions,
  DeployState,
} from './types'

export const ERROR_DEFINITIONS = {
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
  EDEPLOY005: { failureClass: 'deploy', defaultMessage: 'Artifact write failed' },
} as const satisfies Record<string, ErrorDefinition>

export function createPlatformError(
  code: string,
  message?: string,
  options: CreatePlatformErrorOptions & { state?: DeployState } = {},
): PlatformError {
  const definition = ERROR_DEFINITIONS[code as keyof typeof ERROR_DEFINITIONS]

  if (!definition) {
    throw new Error(`Unknown platform error code: ${code}`)
  }

  const error = new Error(message || definition.defaultMessage) as PlatformError
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

  if (options.state) {
    error.state = options.state
  }

  return error
}

export function classifyError(error: unknown): FailureClass {
  if (!error || typeof error !== 'object') {
    return 'deploy'
  }

  const err = error as { failureClass?: unknown; code?: unknown; step?: unknown }

  if (err.failureClass && typeof err.failureClass === 'string') {
    return err.failureClass as FailureClass
  }

  if (typeof err.code === 'string') {
    if (err.code.startsWith('ECFG')) {
      return 'config'
    }

    if (err.code.startsWith('EBUILD')) {
      return 'build'
    }

    if (err.code.startsWith('EDEPLOY')) {
      return 'deploy'
    }
  }

  if (typeof err.step === 'string') {
    if (err.step === 'loadManifest' || err.step === 'validateConfig') {
      return 'config'
    }

    if (err.step === 'buildProgram') {
      return 'build'
    }
  }

  return 'deploy'
}

export function wrapStepError(step: string, error: unknown): PlatformError {
  const wrapped = error instanceof Error ? error : new Error(String(error))
  const w = wrapped as PlatformError

  if (!w.step) {
    w.step = step
  }

  if (!w.failureClass) {
    w.failureClass = classifyError(wrapped) as 'config' | 'build' | 'deploy'
  }

  w.message = `step ${step}: ${wrapped.message}`
  return w
}

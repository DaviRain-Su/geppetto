const { createPlatformError } = require('./errors')
const { ALLOWED_CLUSTERS } = require('./config')

const ALLOWED_OVERRIDE_KEYS = new Set([
  'cluster',
  'program_id',
  'service_name',
  'replicas',
])

function parseSetValues(rawValues = []) {
  const overrides = {}

  for (const rawValue of rawValues) {
    const separatorIndex = rawValue.indexOf('=')

    if (separatorIndex <= 0) {
      throw createPlatformError('ECFG006', `Invalid --set format: ${rawValue}`)
    }

    const key = rawValue.slice(0, separatorIndex)
    const value = rawValue.slice(separatorIndex + 1)

    if (!ALLOWED_OVERRIDE_KEYS.has(key)) {
      throw createPlatformError('ECFG006', `Unsupported override key: ${key}`)
    }

    overrides[key] = value
  }

  return overrides
}

function applyOverrides(config, overrides = {}) {
  if (!config) {
    return null
  }

  const nextConfig = {
    ...config,
    app: { ...config.app },
    solana: { ...config.solana },
    offchain: { ...config.offchain },
    deploy: { ...config.deploy },
    paths: { ...config.paths },
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (!ALLOWED_OVERRIDE_KEYS.has(key)) {
      throw createPlatformError('ECFG006', `Unsupported override key: ${key}`)
    }

    if (key === 'cluster') {
      if (!ALLOWED_CLUSTERS.has(value)) {
        throw createPlatformError('ECFG005', `Invalid value for solana.cluster: ${value}`, {
          details: { fieldName: 'solana.cluster', value, allowedValues: Array.from(ALLOWED_CLUSTERS) },
        })
      }
      nextConfig.solana.cluster = value
      continue
    }

    if (key === 'program_id') {
      nextConfig.solana.programId = value
      continue
    }

    if (key === 'service_name') {
      nextConfig.offchain.encoreApp = value
      continue
    }

    if (key === 'replicas') {
      const parsed = Number.parseInt(value, 10)

      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw createPlatformError('ECFG006', `Invalid replicas override: ${value}`)
      }

      nextConfig.deploy.replicas = parsed
    }
  }

  return nextConfig
}

module.exports = {
  ALLOWED_OVERRIDE_KEYS,
  parseSetValues,
  applyOverrides,
}

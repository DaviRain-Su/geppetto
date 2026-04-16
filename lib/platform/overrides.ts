import { createPlatformError } from './errors'
import { ALLOWED_CLUSTERS } from './config'
import type { PlatformConfig } from './types'

export const ALLOWED_OVERRIDE_KEYS = new Set([
  'cluster',
  'program_id',
  'service_name',
  'replicas',
])

export function parseSetValues(rawValues: string[] = []): Record<string, string> {
  const overrides: Record<string, string> = {}

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

export function applyOverrides(config: PlatformConfig | null | undefined, overrides: Record<string, string> = {}): PlatformConfig | null {
  if (!config) {
    return null
  }

  const nextConfig: PlatformConfig = {
    ...config,
    app: { ...config.app },
    solana: { ...config.solana },
    offchain: { ...(config.offchain || ({} as object)) } as PlatformConfig['offchain'],
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
      nextConfig.solana.cluster = value as PlatformConfig['solana']['cluster']
      continue
    }

    if (key === 'program_id') {
      nextConfig.solana.programId = value
      continue
    }

    if (key === 'service_name') {
      ;(nextConfig.offchain as NonNullable<PlatformConfig['offchain']>).encoreApp = value
      continue
    }

    if (key === 'replicas') {
      const parsed = Number.parseInt(value, 10)

      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw createPlatformError('ECFG006', `Invalid replicas override: ${value}`)
      }

      ;(nextConfig.deploy as PlatformConfig['deploy'] & { replicas?: number }).replicas = parsed
    }
  }

  return nextConfig
}

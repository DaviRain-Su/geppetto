import * as fs from 'node:fs'
import * as path from 'node:path'
import { createPlatformError } from './errors'
import type { PlatformConfig, PlatformPaths } from './types'

export const SUPPORTED_SCHEMA_VERSION = '0.1'
export const ALLOWED_CLUSTERS = new Set(['devnet', 'testnet', 'mainnet-beta'])
export const ALLOWED_PROVIDERS = new Set(['encore-cloud'])
export const ALLOWED_DEPLOY_MODES = new Set(['hybrid', 'solana'])
export const ALLOWED_OUTPUTS = new Set(['table', 'json'])

type ParsedToml = Record<string, string | Record<string, string>>

function parseScalar(rawValue: string, lineNumber: number): string {
  const trimmed = rawValue.trim()

  if (trimmed.length === 0) {
    throw createPlatformError('ECFG002', `Line ${lineNumber}: missing value`)
  }

  if (trimmed.startsWith('"')) {
    if (!trimmed.endsWith('"') || trimmed.length === 1) {
      throw createPlatformError('ECFG002', `Line ${lineNumber}: unterminated string`)
    }

    return trimmed.slice(1, -1)
  }

  return trimmed
}

export function parseGeppettoToml(content: string): ParsedToml {
  const parsed: ParsedToml = {}
  let currentSection: string | null = null
  const lines = content.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1
    const rawLine = lines[index]
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    if (line.startsWith('[')) {
      if (!line.endsWith(']')) {
        throw createPlatformError('ECFG002', `Line ${lineNumber}: invalid section header`)
      }

      currentSection = line.slice(1, -1).trim()
      if (!currentSection) {
        throw createPlatformError('ECFG002', `Line ${lineNumber}: empty section header`)
      }

      if (!parsed[currentSection]) {
        parsed[currentSection] = {}
      }
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      throw createPlatformError('ECFG002', `Line ${lineNumber}: expected key=value`)
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = parseScalar(line.slice(separatorIndex + 1), lineNumber)

    if (!key) {
      throw createPlatformError('ECFG002', `Line ${lineNumber}: empty key`)
    }

    if (currentSection) {
      const section = parsed[currentSection] as Record<string, string>
      section[key] = value
    } else {
      parsed[key] = value
    }
  }

  return parsed
}

function assertRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createPlatformError('ECFG004', `Missing required field: ${fieldName}`)
  }

  return value.trim()
}

function assertAllowedValue<T extends string>(value: T, fieldName: string, allowedValues: Set<T>): T {
  if (!allowedValues.has(value)) {
    throw createPlatformError(
      'ECFG005',
      `Invalid value for ${fieldName}: ${value}`,
      { details: { fieldName, value, allowedValues: Array.from(allowedValues) } },
    )
  }

  return value
}

export function buildPlatformConfig(parsed: ParsedToml, manifestPath: string): PlatformConfig {
  const schemaVersion = assertRequiredString(parsed.schema_version, 'schema_version')
  if (schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw createPlatformError('ECFG003', `Unsupported schema_version: ${schemaVersion}`)
  }

  const app = (parsed.app || {}) as Record<string, string>
  const solana = (parsed.solana || {}) as Record<string, string>
  const offchain = parsed.offchain || null
  const deploy = (parsed.deploy || {}) as Record<string, string>

  // Infer deploy mode: if [offchain] absent and mode not set, default to 'solana'
  const defaultMode = offchain ? 'hybrid' : 'solana'
  const deployMode = deploy.mode
    ? assertAllowedValue(String(deploy.mode), 'deploy.mode', ALLOWED_DEPLOY_MODES)
    : defaultMode

  const config: PlatformConfig = {
    schemaVersion,
    app: {
      name: assertRequiredString(app.name, 'app.name'),
    },
    solana: {
      cluster: assertAllowedValue(assertRequiredString(solana.cluster, 'solana.cluster'), 'solana.cluster', ALLOWED_CLUSTERS) as PlatformConfig['solana']['cluster'],
      programPath: assertRequiredString(solana.program_path, 'solana.program_path'),
      programBinary: assertRequiredString(solana.program_binary, 'solana.program_binary'),
      keypair: assertRequiredString(solana.keypair, 'solana.keypair'),
      programId: typeof solana.program_id === 'string' ? solana.program_id : '',
    },
    offchain: offchain ? {
      provider: assertAllowedValue(assertRequiredString((offchain as Record<string, string>).provider, 'offchain.provider'), 'offchain.provider', ALLOWED_PROVIDERS) as NonNullable<PlatformConfig['offchain']>['provider'],
      encoreApp: assertRequiredString((offchain as Record<string, string>).encore_app, 'offchain.encore_app'),
      projectPath: assertRequiredString((offchain as Record<string, string>).project_path, 'offchain.project_path'),
    } : null,
    deploy: {
      mode: deployMode as PlatformConfig['deploy']['mode'],
      output: deploy.output ? assertAllowedValue(String(deploy.output), 'deploy.output', ALLOWED_OUTPUTS) as PlatformConfig['deploy']['output'] : 'table',
    },
    paths: {
      manifestPath,
      repoRoot: path.dirname(manifestPath),
    } as PlatformPaths,
  }

  const resolvedProgramPath = path.resolve(config.paths.repoRoot, config.solana.programPath)

  if (!fs.existsSync(resolvedProgramPath)) {
    throw createPlatformError('ECFG004', `Missing path: ${config.solana.programPath}`)
  }

  config.paths.programPath = resolvedProgramPath

  // Validate offchain paths only when offchain is configured
  if (config.offchain) {
    const resolvedProjectPath = path.resolve(config.paths.repoRoot, config.offchain.projectPath)
    const encoreMarkerPath = path.join(resolvedProjectPath, 'encore.app')

    if (!fs.existsSync(resolvedProjectPath)) {
      throw createPlatformError('ECFG004', `Missing path: ${config.offchain.projectPath}`)
    }

    if (!fs.existsSync(encoreMarkerPath)) {
      throw createPlatformError('ECFG004', `Encore app marker not found: ${path.relative(config.paths.repoRoot, encoreMarkerPath)}`)
    }

    config.paths.projectPath = resolvedProjectPath
    config.paths.encoreMarkerPath = encoreMarkerPath
  }

  return config
}

export function loadPlatformConfig(options: { cwd?: string; manifestPath?: string } = {}): PlatformConfig {
  const cwd = options.cwd || process.cwd()
  const manifestPath = options.manifestPath || path.join(cwd, 'geppetto.toml')

  if (!fs.existsSync(manifestPath)) {
    throw createPlatformError('ECFG001', `Missing geppetto.toml at ${manifestPath}`)
  }

  const content = fs.readFileSync(manifestPath, 'utf8')
  const parsed = parseGeppettoToml(content)
  return buildPlatformConfig(parsed, manifestPath)
}

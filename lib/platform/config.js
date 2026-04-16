const fs = require('node:fs')
const path = require('node:path')
const {
  createPlatformError,
} = require('./errors')

const SUPPORTED_SCHEMA_VERSION = '0.1'
const ALLOWED_CLUSTERS = new Set(['devnet', 'testnet', 'mainnet-beta'])
const ALLOWED_PROVIDERS = new Set(['encore-cloud'])
const ALLOWED_DEPLOY_MODES = new Set(['hybrid', 'solana'])
const ALLOWED_OUTPUTS = new Set(['table', 'json'])

function parseScalar(rawValue, lineNumber) {
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

function parseGeppettoToml(content) {
  const parsed = {}
  let currentSection = null
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
      parsed[currentSection][key] = value
    } else {
      parsed[key] = value
    }
  }

  return parsed
}

function assertRequiredString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createPlatformError('ECFG004', `Missing required field: ${fieldName}`)
  }

  return value.trim()
}

function assertAllowedValue(value, fieldName, allowedValues) {
  if (!allowedValues.has(value)) {
    throw createPlatformError(
      'ECFG005',
      `Invalid value for ${fieldName}: ${value}`,
      { details: { fieldName, value, allowedValues: Array.from(allowedValues) } },
    )
  }

  return value
}

function buildPlatformConfig(parsed, manifestPath) {
  const schemaVersion = assertRequiredString(parsed.schema_version, 'schema_version')
  if (schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw createPlatformError('ECFG003', `Unsupported schema_version: ${schemaVersion}`)
  }

  const app = parsed.app || {}
  const solana = parsed.solana || {}
  const offchain = parsed.offchain || null
  const deploy = parsed.deploy || {}

  // Infer deploy mode: if [offchain] absent and mode not set, default to 'solana'
  const defaultMode = offchain ? 'hybrid' : 'solana'
  const deployMode = deploy.mode
    ? assertAllowedValue(String(deploy.mode), 'deploy.mode', ALLOWED_DEPLOY_MODES)
    : defaultMode

  const config = {
    schemaVersion,
    app: {
      name: assertRequiredString(app.name, 'app.name'),
    },
    solana: {
      cluster: assertAllowedValue(assertRequiredString(solana.cluster, 'solana.cluster'), 'solana.cluster', ALLOWED_CLUSTERS),
      programPath: assertRequiredString(solana.program_path, 'solana.program_path'),
      programBinary: assertRequiredString(solana.program_binary, 'solana.program_binary'),
      keypair: assertRequiredString(solana.keypair, 'solana.keypair'),
      programId: typeof solana.program_id === 'string' ? solana.program_id : '',
    },
    offchain: offchain ? {
      provider: assertAllowedValue(assertRequiredString(offchain.provider, 'offchain.provider'), 'offchain.provider', ALLOWED_PROVIDERS),
      encoreApp: assertRequiredString(offchain.encore_app, 'offchain.encore_app'),
      projectPath: assertRequiredString(offchain.project_path, 'offchain.project_path'),
    } : null,
    deploy: {
      mode: deployMode,
      output: deploy.output ? assertAllowedValue(String(deploy.output), 'deploy.output', ALLOWED_OUTPUTS) : 'table',
    },
    paths: {
      manifestPath,
      repoRoot: path.dirname(manifestPath),
    },
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

function loadPlatformConfig(options = {}) {
  const cwd = options.cwd || process.cwd()
  const manifestPath = options.manifestPath || path.join(cwd, 'geppetto.toml')

  if (!fs.existsSync(manifestPath)) {
    throw createPlatformError('ECFG001', `Missing geppetto.toml at ${manifestPath}`)
  }

  const content = fs.readFileSync(manifestPath, 'utf8')
  const parsed = parseGeppettoToml(content)
  return buildPlatformConfig(parsed, manifestPath)
}

module.exports = {
  SUPPORTED_SCHEMA_VERSION,
  ALLOWED_CLUSTERS,
  ALLOWED_PROVIDERS,
  ALLOWED_DEPLOY_MODES,
  ALLOWED_OUTPUTS,
  parseGeppettoToml,
  buildPlatformConfig,
  loadPlatformConfig,
}

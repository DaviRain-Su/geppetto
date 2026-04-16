// Geppetto Platform — shared type definitions
// This file is the single source of truth for all platform types.

// --- Config types ---

export type Cluster = 'devnet' | 'testnet' | 'mainnet-beta'
export type OffchainProvider = 'encore-cloud'
export type DeployMode = 'hybrid' | 'solana'
export type OutputFormat = 'table' | 'json'

export interface AppConfig {
  name: string
}

export interface SolanaConfig {
  cluster: Cluster
  programPath: string
  programBinary: string
  keypair: string
  programId: string
}

export interface OffchainConfig {
  provider: OffchainProvider
  encoreApp: string
  projectPath: string
}

export interface DeployConfig {
  mode: DeployMode
  output: OutputFormat
}

export interface PlatformPaths {
  manifestPath: string
  repoRoot: string
  programPath: string
  projectPath?: string
  encoreMarkerPath?: string
}

export interface PlatformConfig {
  schemaVersion: string
  app: AppConfig
  solana: SolanaConfig
  offchain: OffchainConfig | null
  deploy: DeployConfig
  paths: PlatformPaths
}

// --- State types ---

export type StepStatus = 'success' | 'failure'
export type DeployStatus = 'success' | 'failure'
export type FailureClass = 'config' | 'build' | 'deploy' | null

export interface StepLog {
  name: string
  status: StepStatus
  error?: string
  elapsed_ms: number
}

export interface DeployState {
  run_id: string
  app_name: string
  cluster: string
  program_path: string
  program_binary: string
  program_id: string
  service_url: string | null
  provider_deployment_id: string | null
  status: DeployStatus
  failure_class: FailureClass
  steps: StepLog[]
}

// --- Error types ---

export interface ErrorDefinition {
  failureClass: 'config' | 'build' | 'deploy'
  defaultMessage: string
}

export interface PlatformError extends Error {
  name: 'PlatformError'
  code: string
  failureClass: 'config' | 'build' | 'deploy'
  step?: string
  details?: Record<string, unknown>
  cause?: Error
  state?: DeployState
}

export interface CreatePlatformErrorOptions {
  step?: string
  details?: Record<string, unknown>
  cause?: Error
}

// --- Pipeline types ---

export interface PipelineContext {
  runId?: string
}

export interface PipelineStep {
  name: string
  run: (ctx: PipelineContext, state: DeployState, config: PlatformConfig) => Promise<DeployState>
}

export interface PipelineInput {
  ctx?: PipelineContext
  config: PlatformConfig
  initialState: DeployState
  steps: PipelineStep[]
}

export interface BridgeOutputsOptions {
  mode?: DeployMode
}

// --- Adapter types ---

export interface SolanaDeployResult {
  program_id: string
  cluster: string
}

export interface EncoreDeployResult {
  service_url: string
  provider_deployment_id: string | null
}

export interface SolanaAdapter {
  build: (ctx: PipelineContext, config: PlatformConfig) => Promise<void>
  deploy: (ctx: PipelineContext, config: PlatformConfig) => Promise<SolanaDeployResult>
  resolveHome: (filepath: string) => string
  CLUSTER_URLS: Record<string, string>
  runner: { exec: (...args: unknown[]) => Promise<{ stdout: string; stderr: string }> }
}

export interface EncoreAdapter {
  deploy: (ctx: PipelineContext, config: PlatformConfig) => Promise<EncoreDeployResult>
  pollServiceURL: (ctx: PipelineContext, config: PlatformConfig, partial: Partial<EncoreDeployResult>) => Promise<string>
  runner: {
    execFile: (...args: unknown[]) => Promise<{ stdout: string; stderr: string }>
    exec: (...args: unknown[]) => Promise<{ stdout: string; stderr: string }>
  }
}

// --- CLI types ---

export interface DeployArgs {
  options: {
    output: OutputFormat
    setValues: string[]
    writeBack: boolean
  }
}

export interface CLIio {
  stdout: { write: (s: string) => void }
  stderr: { write: (s: string) => void }
  cwd: string
}

// --- Output types ---

export interface JsonOutput {
  run_id: string
  app_name: string
  cluster: string
  program_id: string | null
  service_url: string | null
  provider_deployment_id: string | null
  status: DeployStatus
  failure_class: FailureClass
  steps: StepLog[]
}

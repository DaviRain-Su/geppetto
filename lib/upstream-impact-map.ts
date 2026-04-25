import * as fs from 'node:fs'
import * as path from 'node:path'

import { getUpstreamTrackingManifest } from './upstream-manifest'

export type ImpactKind = 'runtime-sdk' | 'runtime-helper' | 'test-runtime' | 'knowledge-source'

export interface UpstreamImpactEntry {
  name: string
  kind: ImpactKind
  source: string
  reviewScope: string[]
  rationale: string
  requiredChecks: string[]
  sourcePath?: string
}

export const VALID_IMPACT_KINDS: readonly ImpactKind[] = Object.freeze([
  'runtime-sdk',
  'runtime-helper',
  'test-runtime',
  'knowledge-source',
])

export const UPSTREAM_IMPACT_MAP: readonly UpstreamImpactEntry[] = Object.freeze([
  {
    name: 'pinocchio',
    kind: 'runtime-sdk',
    source: 'Cargo.toml',
    reviewScope: [
      'src/lib.rs',
      'src/schema.rs',
      'src/guard.rs',
      'src/dispatch.rs',
      'src/idioms/mod.rs',
      'src/idioms/accounts.rs',
      'src/idioms/entrypoint.rs',
      'src/idioms/helpers.rs',
      'src/idioms/pda.rs',
      'src/idioms/cpi.rs',
      'src/idioms/events.rs',
      'src/idioms/architecture.rs',
      'src/client.rs',
      'src/anti_patterns.rs',
      'AGENTS.md',
      'docs/02-architecture.md',
      'docs/03-technical-spec.md',
      'docs/07-review-report.md',
      'docs/08-evolution.md',
    ],
    rationale:
      'Core Pinocchio SDK affects account model, CPI primitives, and almost all knowledge modules.',
    requiredChecks: [
      'cargo test --all-features',
      'cargo clippy --all-features -- -D warnings',
      'cargo doc --no-deps',
      'npm run docs:check',
    ],
  },
  {
    name: 'pinocchio-system',
    kind: 'runtime-helper',
    source: 'Cargo.toml',
    reviewScope: [
      'src/lib.rs',
      'src/idioms/cpi.rs',
      'examples/escrow/src/instructions/create.rs',
      'docs/03-technical-spec.md',
      'docs/07-review-report.md',
    ],
    rationale: 'System CPI helpers directly affect account creation guidance and escrow create path semantics.',
    requiredChecks: [
      'cargo test --all-features',
      'cargo test --manifest-path examples/escrow/Cargo.toml --all-features',
      'npm run docs:check',
    ],
  },
  {
    name: 'pinocchio-token',
    kind: 'runtime-helper',
    source: 'Cargo.toml',
    reviewScope: [
      'src/lib.rs',
      'src/guard.rs',
      'src/idioms/cpi.rs',
      'src/client.rs',
      'docs/03-technical-spec.md',
      'docs/08-evolution.md',
    ],
    rationale: 'Token CPI API shape and multisig semantics affect examples, guards, and public CPI guidance.',
    requiredChecks: [
      'cargo test --all-features',
      'npm run docs:check',
    ],
  },
  {
    name: 'pinocchio-token-2022',
    kind: 'runtime-helper',
    source: 'Cargo.toml',
    reviewScope: [
      'src/lib.rs',
      'src/guard.rs',
      'src/idioms/cpi.rs',
      'docs/03-technical-spec.md',
      'docs/08-evolution.md',
    ],
    rationale: 'Token-2022 support changes public CPI guidance and token program compatibility checks.',
    requiredChecks: [
      'cargo test --all-features',
      'npm run docs:check',
    ],
  },
  {
    name: 'pinocchio-associated-token-account',
    kind: 'runtime-helper',
    source: 'Cargo.toml',
    reviewScope: [
      'src/lib.rs',
      'src/guard.rs',
      'src/idioms/cpi.rs',
      'docs/03-technical-spec.md',
      'docs/07-review-report.md',
    ],
    rationale: 'ATA helper behavior directly affects assert_ata semantics and account-validation guidance.',
    requiredChecks: [
      'cargo test --all-features',
      'npm run docs:check',
    ],
  },
  {
    name: 'pinocchio-memo',
    kind: 'runtime-helper',
    source: 'Cargo.toml',
    reviewScope: [
      'src/lib.rs',
      'src/idioms/cpi.rs',
      'docs/03-technical-spec.md',
    ],
    rationale: 'Memo helper changes are mostly limited to CPI re-export and examples.',
    requiredChecks: [
      'cargo test --all-features',
      'npm run docs:check',
    ],
  },
  {
    name: 'pinocchio-log',
    kind: 'runtime-helper',
    source: 'Cargo.toml',
    reviewScope: [
      'src/lib.rs',
      'src/idioms/events.rs',
      'docs/03-technical-spec.md',
    ],
    rationale: 'Log helper changes affect facade exports and event/logging examples.',
    requiredChecks: [
      'cargo test --all-features',
      'npm run docs:check',
    ],
  },
  {
    name: 'pinocchio-pubkey',
    kind: 'runtime-helper',
    source: 'Cargo.toml',
    reviewScope: [
      'src/lib.rs',
      'src/idioms/pda.rs',
      'src/client.rs',
      'docs/03-technical-spec.md',
    ],
    rationale: 'Pubkey helper changes affect PDA derivation guidance and public facade examples.',
    requiredChecks: [
      'cargo test --all-features',
      'npm run docs:check',
    ],
  },
  {
    name: 'mollusk-svm',
    kind: 'test-runtime',
    source: 'examples/escrow/Cargo.toml',
    reviewScope: [
      'src/testing/mollusk.rs',
      'examples/escrow/tests/svm.rs',
      'docs/05-test-spec.md',
      'docs/07-review-report.md',
      'docs/08-evolution.md',
    ],
    rationale: 'Mollusk version changes affect test runtime semantics, program loading expectations, and SVM guidance.',
    requiredChecks: [
      'cargo test --manifest-path examples/escrow/Cargo.toml --all-features',
      'npm run docs:check',
    ],
  },
  {
    name: 'litesvm',
    kind: 'knowledge-source',
    source: 'src/testing/litesvm.rs',
    reviewScope: [
      'src/testing/litesvm.rs',
      'docs/05-test-spec.md',
      'docs/08-evolution.md',
    ],
    rationale:
      'Litesvm is currently tracked primarily as a knowledge/documentation source rather than a direct crate dependency.',
    requiredChecks: [
      'npm run docs:check',
    ],
  },
])

function getUpstreamImpactManifestRoot(): string {
  return path.resolve(__dirname, '..')
}

export function getUpstreamImpactMap(root = getUpstreamImpactManifestRoot()): UpstreamImpactEntry[] {
  return UPSTREAM_IMPACT_MAP.map((entry) => ({
    ...entry,
    reviewScope: [...entry.reviewScope],
    requiredChecks: [...entry.requiredChecks],
    sourcePath: path.join(root, entry.source),
  }))
}

export function assertUpstreamImpactMap(
  root = getUpstreamImpactManifestRoot(),
  impactMap = getUpstreamImpactMap(root),
): void {
  const names = new Set<string>()
  const existingDependencies = new Set(
    getUpstreamTrackingManifest(root).map((entry) => entry.dependencyName),
  )

  for (const entry of impactMap) {
    if (!entry.name) {
      throw new Error('Impact map entry missing name')
    }
    if (names.has(entry.name)) {
      throw new Error(`Duplicate impact map entry: ${entry.name}`)
    }
    if (!VALID_IMPACT_KINDS.includes(entry.kind)) {
      throw new Error(`Unsupported impact kind for ${entry.name}: ${entry.kind}`)
    }
    if (!entry.source) {
      throw new Error(`Impact map entry missing source for ${entry.name}`)
    }
    if (!Array.isArray(entry.reviewScope) || entry.reviewScope.length === 0) {
      throw new Error(`Impact scope must be non-empty for ${entry.name}`)
    }
    if (!Array.isArray(entry.requiredChecks) || entry.requiredChecks.length === 0) {
      throw new Error(`Required checks must be non-empty for ${entry.name}`)
    }

    for (const item of entry.reviewScope) {
      if (typeof item !== 'string' || !item.trim()) {
        throw new Error(`Invalid reviewScope entry in ${entry.name}`)
      }
      if (!fs.existsSync(path.join(root, item))) {
        throw new Error(`Review scope target missing: ${item} (${entry.name})`)
      }
    }

    for (const check of entry.requiredChecks) {
      if (typeof check !== 'string' || !check.trim()) {
        throw new Error(`Invalid required check for ${entry.name}`)
      }
    }

    if (!existingDependencies.has(entry.name)) {
      throw new Error(`Unknown upstream dependency in impact map: ${entry.name}`)
    }

    names.add(entry.name)
  }

  for (const dependency of existingDependencies) {
    if (!names.has(dependency)) {
      throw new Error(`Missing impact map coverage for upstream dependency: ${dependency}`)
    }
  }
}

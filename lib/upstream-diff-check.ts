#!/usr/bin/env node

import {
  checkUpstreamVersions,
  compareVersions,
  type UpstreamVersionCheckResult,
} from './upstream-version-check'
import {
  assertUpstreamImpactMap,
  getUpstreamImpactMap,
  type UpstreamImpactEntry,
} from './upstream-impact-map'
import {
  getUpstreamManifestRoot,
  getUpstreamTrackingManifest,
  type UpstreamManifestEntry,
} from './upstream-manifest'

export type DiffStatus = 'update-available' | 'up-to-date' | 'knowledge-source' | 'unknown'

export interface UpstreamDiffEntry {
  name: string
  source: string
  kind: UpstreamImpactEntry['kind']
  currentVersion: string | null
  latestVersion: string | null
  status: DiffStatus
  reviewScopeCount: number
  reviewScope: string[]
  summary: string
  rationale: string
  requiredChecks: string[]
}

export interface UpstreamDiffResult {
  checkedAt: string
  entries: UpstreamDiffEntry[]
  errors: string[]
}

export interface CheckUpstreamDiffOptions {
  root?: string
  manifest?: UpstreamManifestEntry[]
  impactMap?: UpstreamImpactEntry[]
  upstreamVersions?: UpstreamVersionCheckResult | null
  fetchLatestVersion?: (dependencyName: string) => Promise<string>
}

interface StatusResolution {
  status: DiffStatus
  latestVersion: string | null
}

export function createCratesIoFetcher(registryBase = 'https://crates.io/api/v1') {
  return async function fetchLatestVersion(dependencyName: string): Promise<string> {
    const response = await fetch(`${registryBase}/crates/${encodeURIComponent(dependencyName)}`, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error(
        `Failed to query crates.io for ${dependencyName}: ${response.status} ${response.statusText}`,
      )
    }

    const payload = await response.json() as { crate?: { max_version?: string } }
    const latest = payload?.crate?.max_version

    if (!latest || typeof latest !== 'string') {
      throw new Error(`Crates.io response missing max_version for ${dependencyName}`)
    }

    return latest
  }
}

export function buildSummary(
  status: DiffStatus,
  name: string,
  currentVersion: string | null,
  latestVersion: string | null,
  source: string,
): string {
  if (status === 'knowledge-source') {
    return `${name} tracked via docs source: ${source}`
  }

  if (status === 'update-available') {
    return `${name} ${currentVersion} -> ${latestVersion}`
  }

  if (status === 'up-to-date') {
    return `${name} ${currentVersion}`
  }

  return `${name} version status unknown (current: ${currentVersion || 'N/A'})`
}

export function resolveStatus(currentVersion: string | null, latestVersion: string | null): StatusResolution {
  if (latestVersion == null) {
    return {
      status: 'knowledge-source',
      latestVersion: null,
    }
  }

  if (!currentVersion) {
    return {
      status: 'unknown',
      latestVersion,
    }
  }

  const cmp = compareVersions(currentVersion, latestVersion)
  if (cmp === 0) {
    return {
      status: 'up-to-date',
      latestVersion,
    }
  }

  if (cmp < 0) {
    return {
      status: 'update-available',
      latestVersion,
    }
  }

  return {
    status: 'up-to-date',
    latestVersion,
  }
}

export async function checkUpstreamDiff({
  root = getUpstreamManifestRoot(),
  manifest = getUpstreamTrackingManifest(root),
  impactMap = getUpstreamImpactMap(root),
  upstreamVersions = null,
  fetchLatestVersion = createCratesIoFetcher(),
}: CheckUpstreamDiffOptions = {}): Promise<UpstreamDiffResult> {
  const errors: string[] = []
  const entries: UpstreamDiffEntry[] = []
  const manifestByName = new Map<string, UpstreamManifestEntry>(
    manifest.map((item) => [item.dependencyName, item]),
  )
  const impactByName = new Map<string, UpstreamImpactEntry>(
    impactMap.map((item) => [item.name, item]),
  )

  try {
    assertUpstreamImpactMap(root, impactMap)
  } catch (error) {
    errors.push(`Impact map validation failed: ${(error as Error).message}`)
    return {
      checkedAt: new Date().toISOString(),
      entries: [],
      errors,
    }
  }

  for (const impactEntry of impactMap) {
    const manifestEntry = manifestByName.get(impactEntry.name)
    if (!manifestEntry) {
      errors.push(`Impact map item ${impactEntry.name} has no matching upstream manifest entry`)
    }
  }

  for (const manifestEntry of manifest) {
    if (!impactByName.has(manifestEntry.dependencyName)) {
      errors.push(`Missing impact map entry for ${manifestEntry.dependencyName}`)
    }
  }

  if (errors.length > 0) {
    return {
      checkedAt: new Date().toISOString(),
      entries: [],
      errors,
    }
  }

  let versionResult = upstreamVersions
  if (!versionResult) {
    versionResult = checkUpstreamVersions(root, manifest)
    if (versionResult.errors.length > 0) {
      errors.push(...versionResult.errors)
      return {
        checkedAt: new Date().toISOString(),
        entries,
        errors,
      }
    }
  }

  const versionsByDependency = new Map<string, string | null>(
    versionResult.entries.map((item) => [item.dependencyName, item.currentVersion]),
  )

  for (const dependencyName of versionResult.checkedDependencies) {
    const impact = impactByName.get(dependencyName)
    const currentVersion = versionsByDependency.get(dependencyName) || null

    if (!impact) {
      errors.push(`Missing impact map entry for ${dependencyName}`)
      continue
    }

    let status: DiffStatus = 'unknown'
    let latestVersion: string | null = null

    if (impact.kind === 'knowledge-source') {
      status = 'knowledge-source'
      latestVersion = null
    } else {
      try {
        latestVersion = await Promise.resolve(fetchLatestVersion(dependencyName))
        const resolved = resolveStatus(currentVersion, latestVersion)
        status = resolved.status
        latestVersion = resolved.latestVersion
      } catch (error) {
        errors.push(`${dependencyName}: ${(error as Error).message}`)
        status = 'unknown'
        latestVersion = null
      }
    }

    entries.push({
      name: dependencyName,
      source: impact.source,
      kind: impact.kind,
      currentVersion,
      latestVersion,
      status,
      reviewScopeCount: impact.reviewScope.length,
      reviewScope: [...impact.reviewScope],
      summary: buildSummary(status, dependencyName, currentVersion, latestVersion, impact.source),
      rationale: impact.rationale,
      requiredChecks: [...impact.requiredChecks],
    })
  }

  return {
    checkedAt: new Date().toISOString(),
    entries,
    errors,
  }
}

export function printDiff(result: UpstreamDiffResult): void {
  for (const entry of result.entries) {
    if (entry.status === 'update-available') {
      console.log(`update-available ${entry.name} ${entry.currentVersion} -> ${entry.latestVersion}`)
    } else if (entry.status === 'up-to-date') {
      console.log(`up-to-date ${entry.name} ${entry.currentVersion}`)
    } else {
      console.log(`${entry.status} ${entry.name} ${entry.summary || ''}`.trim())
    }
  }

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(error)
    }
  }
}

export async function main(): Promise<number> {
  const args = new Set(process.argv.slice(2))
  const strict = args.has('--strict')
  const printMachineReadable = args.has('--json')

  const result = await checkUpstreamDiff()
  if (printMachineReadable) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return 0
  }

  printDiff(result)

  if (strict && result.errors.length > 0) {
    return 1
  }

  return 0
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code
  })
}

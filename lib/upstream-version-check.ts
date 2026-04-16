#!/usr/bin/env node

import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  assertUpstreamTrackingManifest,
  getUpstreamManifestRoot,
  getUpstreamTrackingManifest,
  type UpstreamManifestEntry,
  type UpstreamManifestSource,
} from './upstream-manifest'

export interface SourceVersionResult {
  label: string
  type: UpstreamManifestSource['sourceType']
  versions: string[]
  path: string
}

export interface ResolvedDependencyVersion {
  dependencyName: string
  upstreamName: string
  currentVersion: string | null
  sourceVersions: SourceVersionResult[]
}

export interface UpstreamVersionCheckResult {
  checkedDependencies: string[]
  entries: ResolvedDependencyVersion[]
  errors: string[]
}

export function extractTomlSection(content: string, sectionName: string): string | null {
  const lines = content.split(/\r?\n/)
  const collected: string[] = []
  let found = false
  let nestedDepth = 0

  for (const line of lines) {
    const sectionMatch = line.match(/^\[([^\]]+)\]\s*$/)
    if (sectionMatch) {
      const currentSection = sectionMatch[1]
      if (found && nestedDepth === 1) {
        break
      }
      nestedDepth = currentSection.includes('.') ? 2 : 1
      found = currentSection === sectionName
      continue
    }

    if (found && nestedDepth === 1) {
      collected.push(line)
    }
  }

  if (!found) {
    return null
  }

  return collected.join('\n')
}

function normalizeDependencyVersion(version: string): string {
  const normalized = version.trim().replace(/^[~^<>= ]+/, '')
  if (!normalized) {
    throw new Error(`Expected dependency version, received: ${version}`)
  }
  return normalized
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readCargoTomlSection(content: string, sectionName: string): string {
  const section = extractTomlSection(content, sectionName)
  if (!section) {
    throw new Error(`Missing TOML section: [${sectionName}]`)
  }
  return section
}

function tryReadCargoTomlSection(content: string, sectionName: string): string | null {
  try {
    return readCargoTomlSection(content, sectionName)
  } catch {
    return null
  }
}

export function extractDependencyDeclaration(sectionContent: string, dependencyName: string): string | null {
  const escaped = escapeRegExp(dependencyName)

  const stringMatch = sectionContent.match(
    new RegExp(`^${escaped}\\s*=\\s*"([^"]+)"`, 'm'),
  )
  if (stringMatch) {
    return normalizeDependencyVersion(stringMatch[1])
  }

  const inlineTableMatch = sectionContent.match(
    new RegExp(`^${escaped}\\s*=\\s*\\{[^\\n]*version\\s*=\\s*"([^"]+)"`, 'm'),
  )
  if (inlineTableMatch) {
    return normalizeDependencyVersion(inlineTableMatch[1])
  }

  const workspaceMatch = sectionContent.match(
    new RegExp(`^${escaped}\\s*=\\s*\\{[^\\n]*workspace\\s*=\\s*true`, 'm'),
  )
  if (workspaceMatch) {
    return null
  }

  return null
}

export function extractDependencyVersionFromToml(
  tomlContent: string,
  sectionName: string,
  dependencyName: string,
): string | null {
  const section = readCargoTomlSection(tomlContent, sectionName)
  return extractDependencyDeclaration(section, dependencyName)
}

function parseVersionedDependencyVersion(sectionValue: string): string {
  return normalizeDependencyVersion(sectionValue)
}

function getCargoVersionFromContent(
  content: string,
  dependencyName: string,
  source: UpstreamManifestSource,
): string[] {
  let value: string | null = null
  const primarySection = source.section ? tryReadCargoTomlSection(content, source.section) : null
  if (primarySection) {
    value = extractDependencyDeclaration(primarySection, dependencyName)
  }

  if (!value) {
    const workspaceSection = tryReadCargoTomlSection(content, 'workspace.dependencies')
    value = workspaceSection ? extractDependencyDeclaration(workspaceSection, dependencyName) : null
  }

  if (!value) {
    return []
  }

  return [parseVersionedDependencyVersion(value)]
}

export function extractLockfilePackageVersions(lockfileContent: string, packageName: string): string[] {
  const pattern = /\[\[package\]\][\s\S]*?(?=\n\[\[package\]\]|\s*$)/g
  const packageVersions: string[] = []
  const matches = [...lockfileContent.matchAll(pattern)]

  for (const match of matches) {
    const block = match[0]
    const nameMatch = block.match(/^\s*name\s*=\s*"([^"]+)"/m)
    if (!nameMatch || nameMatch[1] !== packageName) {
      continue
    }

    const versionMatch = block.match(/^\s*version\s*=\s*"([^"]+)"/m)
    if (versionMatch) {
      packageVersions.push(versionMatch[1])
    }
  }

  return packageVersions
}

function parseKnowledgeHeader(content: string): { ecosystemName: string; ecosystemVersion: string } | null {
  const match = content.match(
    /\*\*Knowledge version\*\*:\s*geppetto\s+([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^\n\r]+)/,
  )

  if (!match) {
    return null
  }

  const ecosystemPart = match[2].trim()
  const ecosystemMatch = ecosystemPart.match(/^(.+)\s+([0-9][^\s]*)$/)
  if (!ecosystemMatch) {
    return null
  }

  return {
    ecosystemName: ecosystemMatch[1].trim(),
    ecosystemVersion: ecosystemMatch[2].trim(),
  }
}

function extractVersionFromKnowledgeHeader(content: string, ecosystemName: string): string[] {
  const header = parseKnowledgeHeader(content)
  if (!header || header.ecosystemName !== ecosystemName) {
    return []
  }

  return [header.ecosystemVersion]
}

export function extractVersionFromKnowledgeTable(content: string, dependencyName: string): string[] {
  const lines = content.split(/\r?\n/)
  const target = dependencyName.trim()

  for (const line of lines) {
    if (!line.includes('|')) {
      continue
    }

    const cells = line
      .split('|')
      .map((cell) => cell.trim())

    if (cells[0] === '') {
      cells.shift()
    }
    if (cells[cells.length - 1] === '') {
      cells.pop()
    }

    if (cells.length < 2) {
      continue
    }

    const current = cells[0].replace(/`/g, '')
    if (current !== target) {
      continue
    }

    const version = (cells[1] || '').trim()
    if (!version) {
      continue
    }

    return [version]
  }

  return []
}

function splitNumericVersion(version: string): [number, number, number] {
  const normalized = version
    .replace(/[^\w.]/g, '.')
    .split('.')
    .filter(Boolean)
    .map((part) => (part.toLowerCase() === 'x' ? '0' : part))

  const major = Number.parseInt(normalized[0], 10)
  const minor = Number.parseInt(normalized[1], 10)
  const patch = Number.parseInt(normalized[2], 10)

  return [
    Number.isNaN(major) ? 0 : major,
    Number.isNaN(minor) ? 0 : minor,
    Number.isNaN(patch) ? 0 : patch,
  ]
}

export function compareVersions(left: string, right: string): number {
  const lhs = splitNumericVersion(left)
  const rhs = splitNumericVersion(right)

  for (let index = 0; index < 3; index += 1) {
    if (lhs[index] !== rhs[index]) {
      return lhs[index] > rhs[index] ? 1 : -1
    }
  }

  return 0
}

function filterVersionsByMajorMinor(versions: string[], constraint: string): string[] {
  const normalized = normalizeDependencyVersion(constraint)
  const [major, minor] = normalized.split('.')
  const expectedMajor = Number.parseInt(major, 10)
  const expectedMinor = Number.parseInt(minor, 10)

  if (Number.isNaN(expectedMajor) || Number.isNaN(expectedMinor)) {
    return versions
  }

  const filtered = versions.filter((version) => {
    const [entryMajor, entryMinor] = splitNumericVersion(version)
    return entryMajor === expectedMajor && entryMinor === expectedMinor
  })

  return filtered.length > 0 ? filtered : versions
}

export function resolveCurrentVersion(
  cargoVersions: string[],
  lockVersions: string[],
  allVersions: string[],
): string | null {
  const versionsBySource = [...lockVersions, ...allVersions]

  for (const constraint of cargoVersions) {
    if (!constraint) {
      continue
    }
    const filtered = filterVersionsByMajorMinor(versionsBySource, constraint)
    if (filtered.length > 0) {
      const sorted = [...filtered].sort(compareVersions)
      return sorted[sorted.length - 1]
    }
  }

  if (lockVersions.length > 0) {
    const sorted = [...lockVersions].sort(compareVersions)
    return sorted[sorted.length - 1]
  }

  if (allVersions.length > 0) {
    const sorted = [...allVersions].sort(compareVersions)
    return sorted[sorted.length - 1]
  }

  return null
}

function resolveDependencyVersions(
  root: string,
  item: UpstreamManifestEntry,
  contentCache: Record<string, string>,
): ResolvedDependencyVersion {
  const sourceResults: SourceVersionResult[] = []
  const allVersions: string[] = []
  const lockVersions: string[] = []
  const cargoVersions: string[] = []

  for (const source of item.sources) {
    const sourcePath = source.sourcePath || path.join(root, source.relativePath)
    const content = contentCache[sourcePath]
      || (() => {
        const fileContent = fs.readFileSync(sourcePath, 'utf8')
        contentCache[sourcePath] = fileContent
        return fileContent
      })()

    let sourceVersions: string[] = []

    switch (source.sourceType) {
      case 'cargo':
        sourceVersions = getCargoVersionFromContent(content, source.dependencyName || item.dependencyName, source)
        cargoVersions.push(...sourceVersions)
        break
      case 'cargo-lock':
        sourceVersions = extractLockfilePackageVersions(content, source.packageName || item.dependencyName)
        lockVersions.push(...sourceVersions)
        break
      case 'knowledge-header':
        sourceVersions = extractVersionFromKnowledgeHeader(content, source.ecosystemName || item.dependencyName)
        break
      case 'knowledge-table':
        sourceVersions = extractVersionFromKnowledgeTable(content, source.dependencyName || item.dependencyName)
        break
      default:
        throw new Error(`Unsupported source type: ${String(source.sourceType)}`)
    }

    sourceVersions = [...new Set(sourceVersions.filter(Boolean))]
    allVersions.push(...sourceVersions)

    sourceResults.push({
      label: source.label || source.sourceType,
      type: source.sourceType,
      versions: sourceVersions,
      path: source.relativePath,
    })
  }

  return {
    dependencyName: item.dependencyName,
    upstreamName: item.upstreamName,
    currentVersion: resolveCurrentVersion(cargoVersions, lockVersions, allVersions),
    sourceVersions: sourceResults,
  }
}

export function checkUpstreamVersions(
  root = getUpstreamManifestRoot(),
  manifest = getUpstreamTrackingManifest(root),
): UpstreamVersionCheckResult {
  assertUpstreamTrackingManifest(root, manifest)
  const contentCache: Record<string, string> = Object.create(null)
  const errors: string[] = []
  const entries: ResolvedDependencyVersion[] = []

  for (const item of manifest) {
    try {
      const resolved = resolveDependencyVersions(root, item, contentCache)
      if (!resolved.currentVersion && resolved.sourceVersions.every((source) => source.versions.length === 0)) {
        errors.push(`Unable to resolve any version for ${item.dependencyName} (${item.upstreamName})`)
      }
      entries.push(resolved)
    } catch (error) {
      errors.push((error as Error).message)
    }
  }

  return {
    checkedDependencies: manifest.map((item) => item.dependencyName),
    entries,
    errors,
  }
}

export function main(): number {
  const result = checkUpstreamVersions()
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      process.stderr.write(`${error}\n`)
    }
    return 1
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  return 0
}

if (require.main === module) {
  process.exitCode = main()
}

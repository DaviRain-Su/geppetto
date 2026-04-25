#!/usr/bin/env node

import * as fs from 'node:fs'

import { checkUpstreamDiff, type UpstreamDiffEntry, type UpstreamDiffResult } from './upstream-diff-check'

interface ParsedArgs {
  fromJson: string | null
}

export function parseArgs(argv: string[]): ParsedArgs {
  const fromJsonIndex = argv.indexOf('--from-json')
  const fromJson = fromJsonIndex >= 0 ? argv[fromJsonIndex + 1] : null
  return { fromJson }
}

async function readStdin(): Promise<UpstreamDiffResult | null> {
  const chunks: Uint8Array[] = []

  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }

  const input = Buffer.concat(chunks).toString('utf8').trim()
  if (!input) {
    return null
  }

  return JSON.parse(input) as UpstreamDiffResult
}

function loadResultFromFile(filePath: string): UpstreamDiffResult {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as UpstreamDiffResult
}

function normalizeForMarkdown(value: unknown): string {
  if (value == null) {
    return '-'
  }

  return String(value)
}

function statusBadge(status: string): string {
  const labels: Record<string, string> = {
    'update-available': '⬆️ update-available',
    'up-to-date': '✅ up-to-date',
    unknown: '⚠️ unknown',
    'knowledge-source': 'ℹ️ knowledge-source',
  }

  return labels[status] || `❓ ${normalizeForMarkdown(status)}`
}

function buildHeader({ checkedAt, entries }: UpstreamDiffResult): string {
  const updateCount = entries.filter((entry) => entry.status === 'update-available').length
  const titlePrefix = updateCount > 0
    ? `chore: upstream dependency refresh (${updateCount})`
    : 'chore: upstream dependency audit'

  return `# ${titlePrefix}\n\n`
    + `Generated at: **${checkedAt || 'unknown'}**\n`
    + `Scanned dependencies: **${entries.length}**\n`
}

export function buildSummaryStats(entries: UpstreamDiffEntry[]): string {
  const statuses = ['update-available', 'up-to-date', 'knowledge-source', 'unknown']
  const counts = statuses
    .map((status) => ({ status, count: entries.filter((entry) => entry.status === status).length }))
    .filter((item) => item.count > 0)

  const lines = counts.map((item) => `- ${statusBadge(item.status)}: ${item.count}`).join('\n')
  return `## Status\n${lines}\n`
}

export function buildUpdateTable(entries: UpstreamDiffEntry[]): string {
  const rows = entries.map((entry) => {
    const latest = normalizeForMarkdown(entry.latestVersion)
    const current = normalizeForMarkdown(entry.currentVersion)
    const source = normalizeForMarkdown(entry.source)
    const kind = normalizeForMarkdown(entry.kind)
    const cratesLink = `https://crates.io/crates/${encodeURIComponent(entry.name)}`
    return `| ${entry.name} | [${current}](${cratesLink}) | ${latest} | ${entry.status} | ${kind} | ${source} | ${normalizeForMarkdown(entry.summary)} |`
  })

  return [
    '## Dependency Matrix',
    '| Name | Current | Latest | Status | Kind | Source | Summary |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n')
}

export function buildReviewItems(entries: UpstreamDiffEntry[]): string {
  if (entries.length === 0) {
    return ''
  }

  const lines = ['## Review Scope', '']

  for (const entry of entries) {
    lines.push(`### ${entry.name}`)
    lines.push(`- Kind: ${normalizeForMarkdown(entry.kind)}`)

    if (entry.rationale) {
      lines.push(`- Rationale: ${entry.rationale}`)
    }

    if (entry.reviewScope.length > 0) {
      lines.push('- Review Scope:')
      for (const item of entry.reviewScope) {
        lines.push(`  - ${item}`)
      }
    }

    if (entry.requiredChecks.length > 0) {
      lines.push('- Required Checks:')
      for (const check of entry.requiredChecks) {
        lines.push(`  - \`${check}\``)
      }
    }

    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

export function buildRequiredChecks(entries: UpstreamDiffEntry[]): string {
  const checks = new Set<string>()
  for (const entry of entries) {
    for (const check of entry.requiredChecks) {
      checks.add(check)
    }
  }

  if (checks.size === 0) {
    return ''
  }

  return `## Required Validations\n\n${[...checks].map((check) => `- [ ] ${check}`).join('\n')}\n`
}

function buildErrors(errors: string[]): string {
  if (errors.length === 0) {
    return ''
  }

  return [
    '## Errors',
    'Detected issues during audit:',
    ...errors.map((error) => `- ${error}`),
    '',
  ].join('\n')
}

function buildMergePolicy(): string {
  return [
    '## Merge Policy',
    '- Do not auto-merge. Requires manual review and signoff.',
    '- If any dependency is marked `update-available`, validate all scoped modules before merging.',
    '',
  ].join('\n')
}

export function buildPrTemplate(result: UpstreamDiffResult): string {
  const entries = Array.isArray(result.entries) ? result.entries : []

  const sections = [
    buildHeader(result),
    buildSummaryStats(entries),
    buildUpdateTable(entries),
    buildReviewItems(entries),
    buildRequiredChecks(entries),
    buildErrors(result.errors || []),
    buildMergePolicy(),
  ]

  return sections.filter(Boolean).join('\n')
}

export async function main(): Promise<void> {
  const { fromJson } = parseArgs(process.argv.slice(2))
  let result: UpstreamDiffResult | null = null

  if (fromJson) {
    result = loadResultFromFile(fromJson)
  } else if (!process.stdin.isTTY) {
    result = await readStdin()
  } else {
    result = await checkUpstreamDiff()
  }

  if (!result || typeof result !== 'object') {
    process.stderr.write('Unable to read upstream diff result\n')
    process.exit(1)
  }

  process.stdout.write(buildPrTemplate(result))
}

if (require.main === module) {
  main().catch((error: Error) => {
    process.stderr.write(`${error.message}\n`)
    process.exit(1)
  })
}

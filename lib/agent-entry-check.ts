#!/usr/bin/env bun

import * as fs from 'node:fs'
import * as path from 'node:path'

const CLAUDE_INCLUDE = '@AGENTS.md'
const AGENTS_REDIRECT = 'Read and follow all instructions in AGENTS.md in this repository.'
const AIDER_REDIRECT = 'read:\n  - AGENTS.md'

export interface AgentEntryMirrorTarget {
  relativePath: string
  expectedContent: string
}

export interface AgentEntryTarget extends AgentEntryMirrorTarget {
  sourcePath: string
}

export interface AgentEntryCheckResult {
  errors: string[]
  checkedFiles: string[]
}

export const AGENT_ENTRY_MIRROR_TARGETS: readonly AgentEntryMirrorTarget[] = Object.freeze([
  { relativePath: 'CLAUDE.md', expectedContent: CLAUDE_INCLUDE },
  { relativePath: 'GEMINI.md', expectedContent: AGENTS_REDIRECT },
  { relativePath: '.cursor/rules/geppetto.md', expectedContent: AGENTS_REDIRECT },
  { relativePath: '.github/copilot-instructions.md', expectedContent: AGENTS_REDIRECT },
  { relativePath: '.windsurf/rules/geppetto.md', expectedContent: AGENTS_REDIRECT },
  { relativePath: '.amazonq/rules/geppetto.md', expectedContent: AGENTS_REDIRECT },
  { relativePath: '.aider.conf.yml', expectedContent: AIDER_REDIRECT },
])

export function getAgentEntryRoot(): string {
  return path.resolve(__dirname, '..')
}

export function getAgentEntryTargets(root = getAgentEntryRoot()): AgentEntryTarget[] {
  return AGENT_ENTRY_MIRROR_TARGETS.map((target) => ({
    ...target,
    sourcePath: path.join(root, target.relativePath),
  }))
}

export function assertAgentEntryManifest(root = getAgentEntryRoot(), manifest = getAgentEntryTargets(root)): void {
  const seen = new Set<string>()

  for (const target of manifest) {
    if (path.isAbsolute(target.relativePath)) {
      throw new Error(`Agent entry path must be relative: ${target.relativePath}`)
    }
    if (target.relativePath.includes('\\')) {
      throw new Error(`Agent entry path must use POSIX separators: ${target.relativePath}`)
    }
    if (seen.has(target.relativePath)) {
      throw new Error(`Duplicate agent entry path: ${target.relativePath}`)
    }
    if (!fs.existsSync(target.sourcePath)) {
      throw new Error(`Missing agent entry file: ${target.relativePath}`)
    }
    seen.add(target.relativePath)
  }
}

export function normalizeContent(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\n+$/, '')
}

function validateAgentEntryTarget(target: AgentEntryTarget): string | null {
  const actual = normalizeContent(fs.readFileSync(target.sourcePath, 'utf8'))
  const expected = normalizeContent(target.expectedContent)

  if (actual === expected) {
    return null
  }

  return `${target.relativePath}: expected exact AGENTS mirror content`
}

export function checkAgentEntryMirrors(root = getAgentEntryRoot(), manifest = getAgentEntryTargets(root)): AgentEntryCheckResult {
  assertAgentEntryManifest(root, manifest)

  const errors = manifest
    .map((target) => validateAgentEntryTarget(target))
    .filter((error): error is string => Boolean(error))

  return {
    errors,
    checkedFiles: manifest.map((target) => target.relativePath),
  }
}

export function main(): number {
  const result = checkAgentEntryMirrors(getAgentEntryRoot())

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      process.stderr.write(`${error}\n`)
    }
    return 1
  }

  process.stdout.write(`agent entry mirrors ok files=${result.checkedFiles.length}\n`)
  return 0
}

if (require.main === module) {
  process.exitCode = main()
}

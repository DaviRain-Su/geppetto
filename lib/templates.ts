import * as fs from 'node:fs'
import * as path from 'node:path'

// Canonical template sources for `geppetto-cli init`.
//
// These files live at the repository root and are the single source of truth.
// The CLI must copy them byte-for-byte into downstream projects rather than
// maintaining duplicate template content in a second location.
export const TEMPLATE_FILES = Object.freeze([
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.aider.conf.yml',
  '.amazonq/rules/geppetto.md',
  '.cursor/rules/geppetto.md',
  '.github/copilot-instructions.md',
  '.windsurf/rules/geppetto.md',
])

export const PACKAGE_REQUIRED_FILES = Object.freeze([
  'bin/geppetto-cli.ts',
  'lib/init.ts',
  'lib/templates.ts',
  'package.json',
  'LICENSE',
  'LICENSE-APACHE',
  ...TEMPLATE_FILES,
])

export interface TemplateEntry {
  relativePath: string
  sourcePath: string
}

export function getTemplateRoot(): string {
  return path.resolve(__dirname, '..')
}

export function getTemplateEntries(templateRoot = getTemplateRoot()): TemplateEntry[] {
  return TEMPLATE_FILES.map((relativePath) => ({
    relativePath,
    sourcePath: path.join(templateRoot, relativePath),
  }))
}

export function assertTemplateManifest(templateRoot = getTemplateRoot()): void {
  const seen = new Set<string>()

  for (const { relativePath, sourcePath } of getTemplateEntries(templateRoot)) {
    if (path.isAbsolute(relativePath)) {
      throw new Error(`Template path must be relative: ${relativePath}`)
    }
    if (relativePath.includes('\\')) {
      throw new Error(`Template path must use POSIX separators: ${relativePath}`)
    }
    if (seen.has(relativePath)) {
      throw new Error(`Duplicate template path: ${relativePath}`)
    }
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing template file: ${relativePath}`)
    }
    seen.add(relativePath)
  }
}

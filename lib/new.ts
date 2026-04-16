import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  assertNewProjectManifest,
  getNewProjectTemplateEntries,
} from './new-manifest'

const TEMPLATE_VARIABLE_RE = /\{\{([A-Z0-9_]+)\}\}/g

export interface CreateProjectOptions {
  dryRun?: boolean
  log?: (line: string) => void
  templateRoot?: string
}

export interface CreateProjectResult {
  path: string
  status: 'skipped' | 'would-create' | 'created'
}

export function isSafeProjectName(projectName: string): boolean {
  return typeof projectName === 'string'
    && projectName.length > 0
    && /^[a-z0-9][a-z0-9_-]*$/i.test(projectName)
}

function normalizeCrateName(projectName: string): string {
  return projectName.toLowerCase().replace(/-/g, '_')
}

function getTemplateVariables(content: string): Set<string> {
  const variables = new Set<string>()
  const matcher = new RegExp(TEMPLATE_VARIABLE_RE)
  let match: RegExpExecArray | null

  while ((match = matcher.exec(content)) !== null) {
    variables.add(match[1])
  }

  return variables
}

export function renderTemplate(content: string, variables: Record<string, string>, templatePath = 'template'): string {
  const knownVariables = new Map<string, string>(Object.entries(variables))
  const placeholders = getTemplateVariables(content)
  const missing: string[] = []

  for (const placeholder of placeholders) {
    if (!knownVariables.has(placeholder)) {
      missing.push(placeholder)
    }
  }

  if (missing.length > 0) {
    throw new Error(`Unknown template variables in ${templatePath}: ${missing.join(', ')}`)
  }

  let rendered = content

  for (const [key, value] of knownVariables.entries()) {
    if (typeof value !== 'string') {
      throw new Error(`Template variable ${key} must be a string in ${templatePath}`)
    }

    rendered = rendered.split(`{{${key}}}`).join(value)
  }

  const unresolved = new RegExp(TEMPLATE_VARIABLE_RE)
  if (unresolved.test(rendered)) {
    throw new Error(`Unresolved template variable(s) in ${templatePath}`)
  }

  return rendered
}

export function createProject(targetDir: string, projectName: string, options: CreateProjectOptions = {}): CreateProjectResult[] {
  const dryRun = options.dryRun === true
  const log = options.log || (() => {})
  const templateRoot = options.templateRoot

  assertNewProjectManifest()

  if (!isSafeProjectName(projectName)) {
    throw new Error(`Invalid project name: ${projectName}`)
  }

  const projectRoot = path.join(targetDir, projectName)
  const exists = fs.existsSync(projectRoot)
  const isDirectory = exists && fs.statSync(projectRoot).isDirectory()

  if (exists && !isDirectory) {
    throw new Error(`Target path exists and is not a directory: ${projectName}`)
  }

  if (exists) {
    const entries = fs.readdirSync(projectRoot)
    if (entries.length > 0) {
      throw new Error(`Target directory is not empty: ${projectName}`)
    }
  } else {
    fs.mkdirSync(projectRoot, { recursive: true })
  }

  const variables = {
    PROJECT_NAME: projectName,
    CRATE_NAME: normalizeCrateName(projectName),
    PACKAGE_NAME: normalizeCrateName(projectName),
    PROGRAM_NAME: projectName,
  }
  const results: CreateProjectResult[] = []

  for (const { relativePath, content } of getNewProjectTemplateEntries(templateRoot)) {
    const absolutePath = path.join(projectRoot, relativePath)

    if (fs.existsSync(absolutePath)) {
      results.push({ path: relativePath, status: 'skipped' })
      log(`skipped ${relativePath}`)
      continue
    }

    if (dryRun) {
      results.push({ path: relativePath, status: 'would-create' })
      log(`would-create ${relativePath}`)
      continue
    }

    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    fs.writeFileSync(
      absolutePath,
      renderTemplate(content, variables, relativePath),
    )
    results.push({ path: relativePath, status: 'created' })
    log(`created ${relativePath}`)
  }

  return results
}

import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  TEMPLATE_FILES,
  assertTemplateManifest,
  getTemplateEntries,
  getTemplateRoot,
} from './templates'

export interface InitProjectOptions {
  templateRoot?: string
  dryRun?: boolean
  log?: (line: string) => void
}

export interface InitProjectResult {
  path: string
  status: 'skipped' | 'would-create' | 'created'
}

export function initProject(targetDir: string, options: InitProjectOptions = {}): InitProjectResult[] {
  const templateRoot = options.templateRoot || getTemplateRoot()
  const dryRun = options.dryRun === true
  const log = options.log || (() => {})
  const results: InitProjectResult[] = []

  assertTemplateManifest(templateRoot)

  for (const { relativePath, sourcePath } of getTemplateEntries(templateRoot)) {
    const destinationPath = path.join(targetDir, relativePath)

    if (fs.existsSync(destinationPath)) {
      results.push({ path: relativePath, status: 'skipped' })
      log(`skipped ${relativePath}`)
      continue
    }

    if (dryRun) {
      results.push({ path: relativePath, status: 'would-create' })
      log(`would-create ${relativePath}`)
      continue
    }

    fs.mkdirSync(path.dirname(destinationPath), { recursive: true })
    fs.copyFileSync(sourcePath, destinationPath)
    results.push({ path: relativePath, status: 'created' })
    log(`created ${relativePath}`)
  }

  return results
}

export {
  TEMPLATE_FILES,
  getTemplateRoot,
}

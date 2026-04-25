#!/usr/bin/env bun

import fs from 'node:fs'
import path from 'node:path'

const siteRoot = path.join(process.cwd(), 'site')

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(fullPath))
      continue
    }
    files.push(fullPath)
  }

  return files
}

function isExternal(link: string): boolean {
  return /^(https?:|mailto:|tel:|#)/.test(link)
}

function stripFragmentAndQuery(link: string): string {
  return link.split('#')[0].split('?')[0]
}

function resolveSitePath(link: string, fromFile: string): string {
  const clean = stripFragmentAndQuery(link)
  if (!clean) return fromFile

  const resolved = clean.startsWith('/')
    ? path.join(siteRoot, clean)
    : path.resolve(path.dirname(fromFile), clean)

  if (resolved.endsWith(path.sep) || clean.endsWith('/')) {
    return path.join(resolved, 'index.html')
  }

  if (!path.extname(resolved)) {
    return path.join(resolved, 'index.html')
  }

  return resolved
}

function assertSite(): void {
  if (!fs.existsSync(siteRoot)) {
    throw new Error('site directory is missing')
  }

  const htmlFiles = walk(siteRoot).filter((file) => file.endsWith('.html'))
  const errors: string[] = []

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8')
    if (!/<title>[^<]+<\/title>/.test(html)) {
      errors.push(`${path.relative(siteRoot, file)} missing <title>`)
    }

    const linkPattern = /(?:href|src)="([^"]+)"/g
    for (const match of html.matchAll(linkPattern)) {
      const link = match[1]
      if (isExternal(link)) continue
      const target = resolveSitePath(link, file)
      if (!target.startsWith(siteRoot) || !fs.existsSync(target)) {
        errors.push(`${path.relative(siteRoot, file)} has broken link: ${link}`)
      }
    }
  }

  for (const required of ['index.html', 'docs/index.html', '_headers', '_redirects']) {
    const target = path.join(siteRoot, required)
    if (!fs.existsSync(target)) {
      errors.push(`missing required file: ${required}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }

  console.log(`site ok pages=${htmlFiles.length}`)
}

assertSite()

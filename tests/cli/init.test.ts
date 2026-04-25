import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import test from 'node:test'

import { TEMPLATE_FILES } from '../../lib/templates'

const repoRoot = path.resolve(__dirname, '..', '..')
const cliPath = path.join(repoRoot, 'bin', 'geppetto-cli.ts')
const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined'
const tsxPath = isBun ? '' : require.resolve('tsx')

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-cli-'))
}

function removeDir(directoryPath: string): void {
  fs.rmSync(directoryPath, { recursive: true, force: true })
}

function runCli(cwd: string, args: string[] = []): string {
  const spawnArgs = isBun ? [cliPath, ...args] : ['--import', tsxPath, cliPath, ...args]
  return execFileSync(process.execPath, spawnArgs, {
    cwd,
    encoding: 'utf8',
  })
}

function runInit(cwd: string, args: string[] = []): string {
  return runCli(cwd, ['init', ...args])
}

function readRepoTemplate(relativePath: string): Buffer {
  return fs.readFileSync(path.join(repoRoot, relativePath))
}

function listFilesRecursively(rootDir: string): string[] {
  const results: string[] = []

  function walk(currentDir: string): void {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(absolutePath)
      } else {
        results.push(path.relative(rootDir, absolutePath).split(path.sep).join('/'))
      }
    }
  }

  walk(rootDir)
  return results.sort()
}

test('init creates all canonical files in an empty directory', () => {
  const tempDir = createTempDir()

  try {
    const stdout = runInit(tempDir)

    for (const relativePath of TEMPLATE_FILES) {
      const outputPath = path.join(tempDir, relativePath)
      assert.equal(fs.existsSync(outputPath), true, `${relativePath} was not created`)
      assert.deepEqual(
        fs.readFileSync(outputPath),
        readRepoTemplate(relativePath),
        `${relativePath} did not match canonical template`,
      )
    }

    assert.match(stdout, /created AGENTS\.md/)
    assert.match(stdout, /created \.github\/copilot-instructions\.md/)
    assert.match(stdout, /done created=8 skipped=0/)
    assert.deepEqual(listFilesRecursively(tempDir), [...TEMPLATE_FILES].sort())
  } finally {
    removeDir(tempDir)
  }
})

test('init skips existing files without overwriting them', () => {
  const tempDir = createTempDir()
  const sentinel = 'keep-me\n'

  try {
    const existingFiles = ['AGENTS.md', '.cursor/rules/geppetto.md']

    for (const relativePath of existingFiles) {
      const outputPath = path.join(tempDir, relativePath)
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      fs.writeFileSync(outputPath, sentinel)
    }

    const stdout = runInit(tempDir)

    for (const relativePath of existingFiles) {
      const outputPath = path.join(tempDir, relativePath)
      assert.equal(fs.readFileSync(outputPath, 'utf8'), sentinel)
      assert.match(stdout, new RegExp(`skipped ${relativePath.replace('.', '\\.')}`))
    }

    for (const relativePath of TEMPLATE_FILES.filter((file) => !existingFiles.includes(file))) {
      const outputPath = path.join(tempDir, relativePath)
      assert.equal(fs.existsSync(outputPath), true, `${relativePath} was not created`)
      assert.deepEqual(
        fs.readFileSync(outputPath),
        readRepoTemplate(relativePath),
        `${relativePath} did not match canonical template`,
      )
    }

    assert.match(stdout, /done created=6 skipped=2/)
    assert.deepEqual(listFilesRecursively(tempDir), [...TEMPLATE_FILES].sort())
  } finally {
    removeDir(tempDir)
  }
})

test('init --dry-run previews all canonical files in an empty directory without writing them', () => {
  const tempDir = createTempDir()

  try {
    const stdout = runInit(tempDir, ['--dry-run'])

    for (const relativePath of TEMPLATE_FILES) {
      assert.match(stdout, new RegExp(`would-create ${relativePath.replaceAll('.', '\\.')}`))
    }

    assert.match(stdout, /done dry-run would-create=8 skipped=0/)
    assert.deepEqual(listFilesRecursively(tempDir), [])
  } finally {
    removeDir(tempDir)
  }
})

test('init --dry-run preserves existing files and does not create missing ones', () => {
  const tempDir = createTempDir()
  const sentinel = 'keep-me\n'

  try {
    const existingFiles = ['AGENTS.md', '.cursor/rules/geppetto.md']

    for (const relativePath of existingFiles) {
      const outputPath = path.join(tempDir, relativePath)
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      fs.writeFileSync(outputPath, sentinel)
    }

    const stdout = runInit(tempDir, ['--dry-run'])

    for (const relativePath of existingFiles) {
      const outputPath = path.join(tempDir, relativePath)
      assert.equal(fs.readFileSync(outputPath, 'utf8'), sentinel)
      assert.match(stdout, new RegExp(`skipped ${relativePath.replaceAll('.', '\\.')}`))
    }

    for (const relativePath of TEMPLATE_FILES.filter((file) => !existingFiles.includes(file))) {
      const outputPath = path.join(tempDir, relativePath)
      assert.equal(fs.existsSync(outputPath), false, `${relativePath} should not be created during dry-run`)
      assert.match(stdout, new RegExp(`would-create ${relativePath.replaceAll('.', '\\.')}`))
    }

    assert.match(stdout, /done dry-run would-create=6 skipped=2/)
    assert.deepEqual(listFilesRecursively(tempDir), [...existingFiles].sort())
  } finally {
    removeDir(tempDir)
  }
})

test('help output documents init --dry-run preview mode', () => {
  const tempDir = createTempDir()

  try {
    const stdout = runCli(tempDir, ['init', '--help'])
    assert.match(stdout, /Usage: geppetto-cli <command> \[options\]/)
    assert.match(stdout, /init \[--dry-run\]/)
    assert.match(stdout, /without writing files/)
  } finally {
    removeDir(tempDir)
  }
})

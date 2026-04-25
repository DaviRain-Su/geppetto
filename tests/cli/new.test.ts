import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import test from 'node:test'

import { getNewProjectTemplateEntries, getTemplateRoot } from '../../lib/new-manifest'
import { renderTemplate } from '../../lib/new'

const { getTemplateEntries } = require('../../lib/templates') as {
  getTemplateEntries: (templateRoot?: string) => Array<{ relativePath: string; sourcePath: string }>
}

const repoRoot = path.resolve(__dirname, '..', '..')
const cliPath = path.join(repoRoot, 'bin', 'geppetto-cli.ts')
const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined'
const tsxPath = isBun ? '' : require.resolve('tsx')

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-new-'))
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

function getSmokeTestTemplateFiles(): string[] {
  return getNewProjectTemplateEntries().map((entry) => entry.relativePath).sort()
}

test('new command creates expected scaffold files', () => {
  const tempDir = createTempDir()
  const projectName = 'sample-program'

  try {
    const stdout = runCli(tempDir, ['new', projectName])
    const projectDir = path.join(tempDir, projectName)
    const createdFiles = getNewProjectTemplateEntries().map((entry) => entry.relativePath)

    for (const relativePath of createdFiles) {
      const outputPath = path.join(projectDir, relativePath)
      assert.equal(fs.existsSync(outputPath), true, `${relativePath} was not created`)
    }

    const cargo = fs.readFileSync(path.join(projectDir, 'Cargo.toml'), 'utf8')
    assert.match(cargo, /name = "sample_program"/)
    assert.match(stdout, /done new sample-program created=15 skipped=0/)
  } finally {
    removeDir(tempDir)
  }
})

test('new command smoke test generates a complete scaffold', () => {
  const tempDir = createTempDir()
  const projectName = 'demo-program'
  const expectedTemplateFiles = getSmokeTestTemplateFiles()
  const expectedCreated = expectedTemplateFiles.length

  try {
    const stdout = runCli(tempDir, ['new', projectName])
    const projectDir = path.join(tempDir, projectName)

    assert.deepEqual(listFilesRecursively(projectDir), expectedTemplateFiles)
    assert.match(stdout, new RegExp(`done new ${projectName} created=${expectedCreated} skipped=0`))

    for (const relativePath of [
      'Cargo.toml',
      'src/lib.rs',
      'src/processor.rs',
      'src/state.rs',
      'src/error.rs',
      'src/instructions/mod.rs',
      'tests/svm.rs',
      'AGENTS.md',
      'CLAUDE.md',
      'GEMINI.md',
      '.aider.conf.yml',
      '.amazonq/rules/geppetto.md',
      '.cursor/rules/geppetto.md',
      '.windsurf/rules/geppetto.md',
      '.github/copilot-instructions.md',
    ]) {
      const outputPath = path.join(projectDir, relativePath)
      assert.equal(fs.existsSync(outputPath), true, `${relativePath} was not created`)
    }

    const cargo = fs.readFileSync(path.join(projectDir, 'Cargo.toml'), 'utf8')
    const processor = fs.readFileSync(path.join(projectDir, 'src/processor.rs'), 'utf8')
    const svmTest = fs.readFileSync(path.join(projectDir, 'tests/svm.rs'), 'utf8')

    assert.match(cargo, /name = "demo_program"/)
    assert.match(processor, /\/\/ demo_program/)
    assert.match(svmTest, /CHANGE_ME/)
    assert.equal(/\{\{[A-Z0-9_]+\}\}/.test(svmTest), false, 'generated svm test contains unresolved placeholder')
  } finally {
    removeDir(tempDir)
  }
})

test('new command supports template variable expansion', () => {
  const tempDir = createTempDir()
  const projectName = 'my-program'

  try {
    runCli(tempDir, ['new', projectName])
    const projectDir = path.join(tempDir, projectName)

    const templateRoot = getTemplateRoot()
    const canonicalEntries = getTemplateEntries(templateRoot)

    for (const { relativePath } of canonicalEntries) {
      const outputPath = path.join(projectDir, relativePath)
      const expected = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
      const actual = fs.readFileSync(outputPath, 'utf8')
      assert.equal(actual, expected)
    }

    const cargo = fs.readFileSync(path.join(projectDir, 'Cargo.toml'), 'utf8')
    const processor = fs.readFileSync(path.join(projectDir, 'src/processor.rs'), 'utf8')

    assert.match(cargo, /name = "my_program"/)
    assert.match(processor, /\/\/ my_program/)
  } finally {
    removeDir(tempDir)
  }
})

test('new command normalizes crate name for hyphenated input', () => {
  const tempDir = createTempDir()
  const projectName = 'my_program'

  try {
    runCli(tempDir, ['new', projectName])
    const projectDir = path.join(tempDir, projectName)
    const cargo = fs.readFileSync(path.join(projectDir, 'Cargo.toml'), 'utf8')
    const processor = fs.readFileSync(path.join(projectDir, 'src/processor.rs'), 'utf8')

    assert.match(cargo, /name = "my_program"/)
    assert.match(processor, /\/\/ my_program/)
  } finally {
    removeDir(tempDir)
  }
})

test('new command rejects templates with unknown variables', () => {
  assert.throws(() => {
    renderTemplate('invalid {{UNKNOWN_VARIABLE}}', {
      PROJECT_NAME: 'sample-program',
      CRATE_NAME: 'sample_program',
      PACKAGE_NAME: 'sample_program',
      PROGRAM_NAME: 'sample-program',
    })
  }, /Unknown template variables in template: UNKNOWN_VARIABLE/)
})

test('generated template files contain no unreplaced placeholders', () => {
  const tempDir = createTempDir()
  const projectName = 'templated-program'

  try {
    runCli(tempDir, ['new', projectName])
    const projectDir = path.join(tempDir, projectName)

    const createdFiles = getNewProjectTemplateEntries().map((entry) => entry.relativePath)

    for (const relativePath of createdFiles) {
      const content = fs.readFileSync(path.join(projectDir, relativePath), 'utf8')
      assert.equal(/\{\{[A-Z0-9_]+\}\}/.test(content), false, `${relativePath} contains unresolved placeholder`)
    }
  } finally {
    removeDir(tempDir)
  }
})

test('new command allows creating into an existing empty directory', () => {
  const tempDir = createTempDir()
  const projectName = 'empty-program'
  const projectDir = path.join(tempDir, projectName)

  try {
    fs.mkdirSync(projectDir, { recursive: true })
    const stdout = runCli(tempDir, ['new', projectName])

    assert.equal(fs.existsSync(path.join(projectDir, 'Cargo.toml')), true)
    assert.match(stdout, /done new empty-program created=15 skipped=0/)
  } finally {
    removeDir(tempDir)
  }
})

test('new command refuses existing non-empty target directory', () => {
  const tempDir = createTempDir()
  const projectName = 'occupied-program'
  const projectDir = path.join(tempDir, projectName)

  try {
    fs.mkdirSync(projectDir, { recursive: true })
    fs.writeFileSync(path.join(projectDir, 'README.md'), 'pre-existing')

    assert.throws(() => {
      runCli(tempDir, ['new', projectName])
    }, /Target directory is not empty: occupied-program/)
  } finally {
    removeDir(tempDir)
  }
})

test('new command fails when directory already has generated files', () => {
  const tempDir = createTempDir()
  const projectName = 'sample-program'

  try {
    const firstRun = runCli(tempDir, ['new', projectName])
    assert.match(firstRun, /done new sample-program created=15 skipped=0/)

    assert.throws(() => {
      runCli(tempDir, ['new', projectName])
    }, /Target directory is not empty: sample-program/)
  } finally {
    removeDir(tempDir)
  }
})

test('new command requires project name', () => {
  const tempDir = createTempDir()

  try {
    assert.throws(() => {
      runCli(tempDir, ['new'])
    }, /Missing or invalid project name/)
  } finally {
    removeDir(tempDir)
  }
})

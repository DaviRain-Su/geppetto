import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import * as path from 'node:path'
import test from 'node:test'

import { PACKAGE_REQUIRED_FILES } from '../../lib/templates'

const repoRoot = path.resolve(__dirname, '..', '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

test('npm pack dry-run includes every required CLI template asset', () => {
  const stdout = execFileSync(npmCommand, ['pack', '--dry-run', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  const [packResult] = JSON.parse(stdout)
  assert.ok(packResult, 'npm pack --dry-run returned no package metadata')

  const packagedFiles = new Set(packResult.files.map((file: { path: string }) => file.path))

  for (const relativePath of PACKAGE_REQUIRED_FILES) {
    assert.equal(
      packagedFiles.has(relativePath),
      true,
      `${relativePath} is missing from the packed CLI artifact`,
    )
  }
})

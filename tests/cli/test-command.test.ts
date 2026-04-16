import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import test from 'node:test'

import {
  parseTestArgs,
  parseAuditArgs,
} from '../../bin/geppetto-cli'
import {
  buildTestPlan,
  runTestPlan,
} from '../../lib/test'
import {
  buildAuditPlan,
  runAuditPlan,
} from '../../lib/audit'

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-e6-'))
}

function removeDir(directoryPath: string): void {
  fs.rmSync(directoryPath, { recursive: true, force: true })
}

function writeDummyEscrowArtifact(root: string): void {
  const artifactPath = path.join(
    root,
    'examples',
    'escrow',
    'target',
    'deploy',
    'geppetto_escrow.so',
  )
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
  fs.writeFileSync(artifactPath, 'dummy')
}

test('parseTestArgs supports test command flags', () => {
  assert.deepEqual(parseTestArgs([]), {
    includeEscrowTests: true,
    buildSbf: false,
    skipBuildSbf: false,
  })
  assert.deepEqual(parseTestArgs(['--skip-examples']), {
    includeEscrowTests: false,
    buildSbf: false,
    skipBuildSbf: false,
  })
  assert.deepEqual(parseTestArgs(['--build-sbf']), {
    includeEscrowTests: true,
    buildSbf: true,
    skipBuildSbf: false,
  })
  assert.deepEqual(parseTestArgs(['--skip-build-sbf']), {
    includeEscrowTests: true,
    buildSbf: false,
    skipBuildSbf: true,
  })
  assert.deepEqual(parseTestArgs(['--help']), { help: true })
  assert.deepEqual(parseTestArgs(['--unknown']), {
    error: 'Unexpected arguments: --unknown',
  })
})

test('parseAuditArgs supports strict mode', () => {
  assert.deepEqual(parseAuditArgs([]), { strict: false })
  assert.deepEqual(parseAuditArgs(['--strict']), { strict: true })
  assert.deepEqual(parseAuditArgs(['--help']), { help: true })
  assert.deepEqual(parseAuditArgs(['--invalid']), { error: 'Unexpected arguments: --invalid' })
})

test('buildTestPlan auto-builds escrow SBF when artifact is missing', () => {
  const tempDir = createTempDir()

  try {
    const plan = buildTestPlan({ cwd: tempDir })
    assert.equal(plan.errors.length, 0)
    assert.equal(plan.commandPlan.length, 3)
    assert.match(plan.warnings[0], /Auto-building missing escrow SBF artifact/)
    assert.equal(plan.commandPlan[1].args[0], 'build-sbf')
  } finally {
    removeDir(tempDir)
  }
})

test('buildTestPlan skips SBF build when artifact exists', () => {
  const tempDir = createTempDir()

  try {
    writeDummyEscrowArtifact(tempDir)
    const plan = buildTestPlan({ cwd: tempDir })
    assert.equal(plan.errors.length, 0)
    assert.equal(plan.warnings.length, 0)
    assert.equal(plan.commandPlan.length, 2)
    assert.equal(plan.commandPlan[1].args[0], 'test')
  } finally {
    removeDir(tempDir)
  }
})

test('buildTestPlan blocks example tests when skip build is requested but artifact missing', () => {
  const tempDir = createTempDir()

  try {
    const plan = buildTestPlan({ cwd: tempDir, skipBuildSbf: true })
    assert.equal(plan.errors.length, 1)
    assert.match(plan.errors[0], /Missing escrow SBF artifact/)
    assert.equal(plan.commandPlan.length, 2)
    assert.equal(plan.commandPlan[1].args[0], 'test')
  } finally {
    removeDir(tempDir)
  }
})

test('runTestPlan executes planned commands via injected runner', () => {
  const tempDir = createTempDir()
  const calls: Array<[string, string[]]> = []

  try {
    const plan = buildTestPlan({ cwd: tempDir, includeEscrowTests: false })
    runTestPlan(plan, {
      cwd: tempDir,
      runCommand(command, args) {
        calls.push([command, args])
        return { status: 0 }
      },
    })

    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0][0], 'cargo')
    assert.deepEqual(calls[0][1], ['test', '--all-features'])
  } finally {
    removeDir(tempDir)
  }
})

test('runTestPlan fails when runner reports command error', () => {
  const tempDir = createTempDir()

  try {
    const plan = buildTestPlan({ cwd: tempDir, includeEscrowTests: false })

    assert.throws(() => {
      runTestPlan(plan, {
        cwd: tempDir,
        runCommand() {
          return { status: null, error: new Error('command missing') }
        },
      })
    }, /command missing/)
  } finally {
    removeDir(tempDir)
  }
})

test('buildAuditPlan respects strict flag', () => {
  assert.equal(buildAuditPlan({}).length, 2)
  assert.equal(buildAuditPlan({ strict: true }).length, 3)
})

test('runAuditPlan executes audit checks via injected runner', () => {
  const calls: Array<[string, string[]]> = []
  const checks = buildAuditPlan({})

  runAuditPlan(checks, {
    runCommand(command, args) {
      calls.push([command, args])
      return { status: 0 }
    },
  })

  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0], ['cargo', ['fmt', '--check']])
})

test('runAuditPlan fails when runner reports command error', () => {
  assert.throws(() => {
    runAuditPlan([
      {
        label: 'fmt',
        command: 'cargo',
        args: ['fmt', '--check'],
      },
    ], {
      runCommand() {
        return { status: null, error: new Error('command missing') }
      },
    })
  }, /command missing/)
})

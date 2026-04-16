import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import * as encore from '../../lib/platform/adapters/encore'

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-encore-adapter-'))
}

function removeDir(directoryPath: string) {
  fs.rmSync(directoryPath, { recursive: true, force: true })
}

function initGitRepo(dir: string) {
  const { execSync } = require('node:child_process') as typeof import('node:child_process')
  execSync('git init', { cwd: dir })
  execSync('git config user.email "test@test.com"', { cwd: dir })
  execSync('git config user.name "Test"', { cwd: dir })
}

function makeConfig(tempDir: string, overrides: Record<string, string> = {}) {
  const projectPath = path.join(tempDir, 'encore-api')
  fs.mkdirSync(projectPath, { recursive: true })
  fs.writeFileSync(path.join(projectPath, 'encore.app'), JSON.stringify({
    id: overrides.appId !== undefined ? overrides.appId : 'test-app-i472',
    lang: 'typescript',
  }, null, '\t'))

  initGitRepo(projectPath)

  return {
    paths: {
      projectPath,
    },
  }
}

function withMockRunner(mockExecFile: any, mockExec: any, testFn: () => Promise<void>) {
  const originalExecFile = (encore as any).runner.execFile
  const originalExec = (encore as any).runner.exec
  ;(encore as any).runner.execFile = mockExecFile || originalExecFile
  ;(encore as any).runner.exec = mockExec || originalExec
  return testFn()
    .finally(() => {
      ;(encore as any).runner.execFile = originalExecFile
      ;(encore as any).runner.exec = originalExec
    })
}

test('deploy fails with ECFG007 when not logged in', async () => {
  const tempDir = createTempDir()
  const mockExecFile = async (file: string, args: string[]) => {
    assert.equal(file, 'encore')
    assert.deepEqual(args, ['auth', 'whoami'])
    return { stdout: 'not logged in.', stderr: '' }
  }

  try {
    await withMockRunner(mockExecFile, null, async () => {
      const config = makeConfig(tempDir)
      await assert.rejects(async () => {
        await encore.deploy({}, config as any)
      }, (error: any) => {
        assert.equal(error.code, 'ECFG007')
        assert.equal(error.failureClass, 'config')
        return true
      })
    })
  } finally {
    removeDir(tempDir)
  }
})

test('deploy fails with ECFG008 when encore.app has empty id', async () => {
  const tempDir = createTempDir()
  const mockExecFile = async () => ({ stdout: 'logged in as test', stderr: '' })
  const mockExec = async () => ({ stdout: '', stderr: '' })

  try {
    await withMockRunner(mockExecFile, mockExec, async () => {
      const config = makeConfig(tempDir, { appId: '' })
      await assert.rejects(async () => {
        await encore.deploy({}, config as any)
      }, (error: any) => {
        assert.equal(error.code, 'ECFG008')
        assert.equal(error.failureClass, 'config')
        return true
      })
    })
  } finally {
    removeDir(tempDir)
  }
})

test('deploy adds encore remote when missing and pushes successfully', async () => {
  const tempDir = createTempDir()
  const execCalls: Array<any> = []

  const mockExecFile = async (file: string, args: string[]) => {
    execCalls.push({ file, args })
    if (file === 'encore' && args[0] === 'auth' && args[1] === 'whoami') {
      return { stdout: 'logged in as test', stderr: '' }
    }
    return { stdout: '', stderr: '' }
  }

  const mockExec = async (cmd: string, options: any) => {
    execCalls.push({ cmd, options })

    if (cmd === 'git status --porcelain') {
      return { stdout: '', stderr: '' }
    }

    if (cmd === 'git remote get-url encore') {
      const err: any = new Error('exit code 1')
      err.code = 1
      throw err
    }

    if (cmd.startsWith('git remote add encore')) {
      assert.ok(cmd.includes('encore://test-app-i472'))
      return { stdout: '', stderr: '' }
    }

    if (cmd === 'git push encore') {
      return {
        stdout: 'remote: main: triggered deploy https://app.encore.cloud/test-app-i472/envs/staging/deploys/1ub2qo6agipb70en00a0\nTo encore://test-app-i472\n   abc..def  main -> main',
        stderr: '',
      }
    }

    return { stdout: '', stderr: '' }
  }

  try {
    await withMockRunner(mockExecFile, mockExec, async () => {
      const config = makeConfig(tempDir)
      const result = await encore.deploy({ runId: 'run_001' }, config as any)
      assert.equal(result.provider_deployment_id, '1ub2qo6agipb70en00a0')
      assert.equal(result.service_url, 'https://app.encore.cloud/test-app-i472/envs/staging/deploys/1ub2qo6agipb70en00a0')
    })
  } finally {
    removeDir(tempDir)
  }
})

test('deploy skips commit when working tree is clean', async () => {
  const tempDir = createTempDir()
  const execCalls: string[] = []

  const mockExecFile = async () => ({ stdout: 'logged in as test', stderr: '' })

  const mockExec = async (cmd: string) => {
    execCalls.push(cmd)

    if (cmd === 'git status --porcelain') {
      return { stdout: '', stderr: '' }
    }

    if (cmd === 'git remote get-url encore') {
      return { stdout: 'encore://test-app-i472\n', stderr: '' }
    }

    if (cmd === 'git push encore') {
      return {
        stdout: 'remote: main: triggered deploy https://app.encore.cloud/test-app-i472/envs/staging/deploys/deploy123\n',
        stderr: '',
      }
    }

    return { stdout: '', stderr: '' }
  }

  try {
    await withMockRunner(mockExecFile, mockExec, async () => {
      const config = makeConfig(tempDir)
      await encore.deploy({}, config as any)
      assert.ok(!execCalls.some(c => typeof c === 'string' && c.startsWith('git commit')))
      assert.ok(execCalls.some(c => typeof c === 'string' && c === 'git push encore'))
    })
  } finally {
    removeDir(tempDir)
  }
})

test('deploy commits changes when working tree is dirty', async () => {
  const tempDir = createTempDir()
  const execCalls: string[] = []

  const mockExecFile = async () => ({ stdout: 'logged in as test', stderr: '' })

  const mockExec = async (cmd: string) => {
    execCalls.push(cmd)

    if (cmd === 'git status --porcelain') {
      return { stdout: 'M package.json\n', stderr: '' }
    }

    if (cmd === 'git remote get-url encore') {
      return { stdout: 'encore://test-app-i472\n', stderr: '' }
    }

    if (cmd === 'git push encore') {
      return {
        stdout: 'remote: main: triggered deploy https://app.encore.cloud/test-app-i472/envs/staging/deploys/deploy123\n',
        stderr: '',
      }
    }

    return { stdout: '', stderr: '' }
  }

  try {
    await withMockRunner(mockExecFile, mockExec, async () => {
      const config = makeConfig(tempDir)
      await encore.deploy({ runId: 'run_test' }, config as any)
      assert.ok(execCalls.some(c => typeof c === 'string' && c === 'git add -A'))
      assert.ok(execCalls.some(c => typeof c === 'string' && c.includes('geppetto deploy run_test')))
    })
  } finally {
    removeDir(tempDir)
  }
})

test('deploy throws EDEPLOY003 when deploy URL not found in push output', async () => {
  const tempDir = createTempDir()
  const mockExecFile = async () => ({ stdout: 'logged in as test', stderr: '' })

  const mockExec = async (cmd: string) => {
    if (cmd === 'git status --porcelain') {
      return { stdout: '', stderr: '' }
    }

    if (cmd === 'git remote get-url encore') {
      return { stdout: 'encore://test-app-i472\n', stderr: '' }
    }

    if (cmd === 'git push encore') {
      return { stdout: 'Everything up-to-date\n', stderr: '' }
    }

    return { stdout: '', stderr: '' }
  }

  try {
    await withMockRunner(mockExecFile, mockExec, async () => {
      const config = makeConfig(tempDir)
      await assert.rejects(async () => {
        await encore.deploy({}, config as any)
      }, /EDEPLOY003|deploy URL not found in output/)
    })
  } finally {
    removeDir(tempDir)
  }
})

test('deploy throws EDEPLOY002 when git push fails', async () => {
  const tempDir = createTempDir()
  const mockExecFile = async () => ({ stdout: 'logged in as test', stderr: '' })

  const mockExec = async (cmd: string) => {
    if (cmd === 'git status --porcelain') {
      return { stdout: '', stderr: '' }
    }

    if (cmd === 'git remote get-url encore') {
      return { stdout: 'encore://test-app-i472\n', stderr: '' }
    }

    if (cmd === 'git push encore') {
      throw new Error('Connection refused')
    }

    return { stdout: '', stderr: '' }
  }

  try {
    await withMockRunner(mockExecFile, mockExec, async () => {
      const config = makeConfig(tempDir)
      await assert.rejects(async () => {
        await encore.deploy({}, config as any)
      }, /EDEPLOY002|Encore deploy failed/)
    })
  } finally {
    removeDir(tempDir)
  }
})

test('pollServiceURL returns existing service_url immediately', async () => {
  const result = await encore.pollServiceURL({}, {} as any, { service_url: 'https://example.test' })
  assert.equal(result, 'https://example.test')
})

test('pollServiceURL throws EDEPLOY004 when service_url missing', async () => {
  await assert.rejects(async () => {
    await encore.pollServiceURL({}, {} as any, {})
  }, /EDEPLOY004|Service URL polling timeout/)
})

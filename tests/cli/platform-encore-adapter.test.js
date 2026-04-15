const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const encore = require('../../lib/platform/adapters/encore')

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-encore-adapter-'))
}

function removeDir(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true })
}

function initGitRepo(dir) {
  const { execSync } = require('node:child_process')
  execSync('git init', { cwd: dir })
  execSync('git config user.email "test@test.com"', { cwd: dir })
  execSync('git config user.name "Test"', { cwd: dir })
}

function makeConfig(tempDir, overrides = {}) {
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

function withMockRunner(mockExecFile, mockExec, testFn) {
  const originalExecFile = encore.runner.execFile
  const originalExec = encore.runner.exec
  encore.runner.execFile = mockExecFile || originalExecFile
  encore.runner.exec = mockExec || originalExec
  return testFn()
    .finally(() => {
      encore.runner.execFile = originalExecFile
      encore.runner.exec = originalExec
    })
}

test('deploy fails with ECFG007 when not logged in', async () => {
  const tempDir = createTempDir()
  const mockExecFile = async (file, args) => {
    assert.equal(file, 'encore')
    assert.deepEqual(args, ['auth', 'whoami'])
    return { stdout: 'not logged in.', stderr: '' }
  }

  try {
    await withMockRunner(mockExecFile, null, async () => {
      const config = makeConfig(tempDir)
      await assert.rejects(async () => {
        await encore.deploy({}, config)
      }, (error) => {
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
        await encore.deploy({}, config)
      }, (error) => {
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
  const execCalls = []

  const mockExecFile = async (file, args) => {
    execCalls.push({ file, args })
    if (file === 'encore' && args[0] === 'auth' && args[1] === 'whoami') {
      return { stdout: 'logged in as test', stderr: '' }
    }
    return { stdout: '', stderr: '' }
  }

  const mockExec = async (cmd, options) => {
    execCalls.push({ cmd, options })

    if (cmd === 'git status --porcelain') {
      return { stdout: '', stderr: '' }
    }

    if (cmd === 'git remote get-url encore') {
      const err = new Error('exit code 1')
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
      const result = await encore.deploy({ runId: 'run_001' }, config)
      assert.equal(result.provider_deployment_id, '1ub2qo6agipb70en00a0')
      assert.equal(result.service_url, 'https://app.encore.cloud/test-app-i472/envs/staging/deploys/1ub2qo6agipb70en00a0')
    })
  } finally {
    removeDir(tempDir)
  }
})

test('deploy skips commit when working tree is clean', async () => {
  const tempDir = createTempDir()
  const execCalls = []

  const mockExecFile = async () => ({ stdout: 'logged in as test', stderr: '' })

  const mockExec = async (cmd) => {
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
      await encore.deploy({}, config)
      assert.ok(!execCalls.some(c => typeof c === 'string' && c.startsWith('git commit')))
      assert.ok(execCalls.some(c => typeof c === 'string' && c === 'git push encore'))
    })
  } finally {
    removeDir(tempDir)
  }
})

test('deploy commits changes when working tree is dirty', async () => {
  const tempDir = createTempDir()
  const execCalls = []

  const mockExecFile = async () => ({ stdout: 'logged in as test', stderr: '' })

  const mockExec = async (cmd) => {
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
      await encore.deploy({ runId: 'run_test' }, config)
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

  const mockExec = async (cmd) => {
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
        await encore.deploy({}, config)
      }, /EDEPLOY003|deploy URL not found in output/)
    })
  } finally {
    removeDir(tempDir)
  }
})

test('deploy throws EDEPLOY002 when git push fails', async () => {
  const tempDir = createTempDir()
  const mockExecFile = async () => ({ stdout: 'logged in as test', stderr: '' })

  const mockExec = async (cmd) => {
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
        await encore.deploy({}, config)
      }, /EDEPLOY002|Encore deploy failed/)
    })
  } finally {
    removeDir(tempDir)
  }
})

test('pollServiceURL returns existing service_url immediately', async () => {
  const result = await encore.pollServiceURL({}, {}, { service_url: 'https://example.test' })
  assert.equal(result, 'https://example.test')
})

test('pollServiceURL throws EDEPLOY004 when service_url missing', async () => {
  await assert.rejects(async () => {
    await encore.pollServiceURL({}, {}, {})
  }, /EDEPLOY004|Service URL polling timeout/)
})

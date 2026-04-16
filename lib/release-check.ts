#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function runStep(args: string[]): void {
  const result = spawnSync(npmCommand, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

runStep(['test'])
runStep(['run', 'docs:check'])
runStep(['run', 'geppetto:test'])
runStep(['run', 'geppetto:audit'])
runStep(['pack', '--dry-run', '--json'])

const { spawnSync } = require('node:child_process');

function createRunner() {
  return (command, args, cwd) => spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
  });
}

function buildAuditPlan(options = {}) {
  const {
    strict = false,
    includeLocked = false,
  } = options;

  const checks = [{
    label: 'format check',
    command: 'cargo',
    args: ['fmt', '--check'],
  }, {
    label: 'strict compile check',
    command: 'cargo',
    args: ['check', '--all-features', ...(includeLocked ? ['--locked'] : [])],
  }];

  if (strict) {
    checks.push({
      label: 'clippy',
      command: 'cargo',
      args: [
        'clippy',
        '--all-targets',
        '--all-features',
        '--',
        '-D',
        'warnings',
      ],
    });
  }

  return checks;
}

function runAuditPlan(checks = [], options = {}) {
  const {
    cwd = process.cwd(),
    runCommand = createRunner(),
  } = options;

  for (const check of checks) {
    const result = runCommand(check.command, check.args, cwd);
    const failed = result.status !== 0 || Boolean(result.error);
    if (failed) {
      const details = result.error ? ` (${result.error.message})` : '';
      throw new Error(`${check.label} failed with status ${result.status}${details}`);
    }
  }
}

function runGeppettoAudit(options = {}) {
  const checks = buildAuditPlan(options);
  runAuditPlan(checks, options);

  return {
    checks,
  };
}

module.exports = {
  buildAuditPlan,
  runGeppettoAudit,
  runAuditPlan,
};

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_ESCROW_EXAMPLES_MANIFEST = path.join(
  'examples',
  'escrow',
  'target',
  'deploy',
  'geppetto_escrow.so',
);
const DEFAULT_ESCROW_MANIFEST_PATH = path.join(
  'examples',
  'escrow',
  'Cargo.toml',
);

function getProjectRoot(cwd = process.cwd()) {
  return path.resolve(cwd);
}

function getEscrowArtifactPath(cwd = process.cwd()) {
  return path.join(getProjectRoot(cwd), DEFAULT_ESCROW_EXAMPLES_MANIFEST);
}

function hasEscrowArtifact(cwd = process.cwd()) {
  return fs.existsSync(getEscrowArtifactPath(cwd));
}

function createRunner() {
  return (command, args, cwd) => spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
  });
}

function buildTestPlan(options = {}) {
  const {
    cwd = process.cwd(),
    includeEscrowTests = true,
    buildSbf = false,
    skipBuildSbf = false,
    locked = false,
    includeLocked = false,
  } = options;

  const resolvedRoot = getProjectRoot(cwd);
  const commandPlan = [{
    label: 'root crate tests',
    command: 'cargo',
    args: ['test', '--all-features', ...(includeLocked || locked ? ['--locked'] : [])],
  }];

  if (!includeEscrowTests) {
    return { commandPlan, warnings: [], errors: [] };
  }

  const warnings = [];
  const errors = [];
  const artifactPath = getEscrowArtifactPath(resolvedRoot);
  const alreadyBuilt = hasEscrowArtifact(resolvedRoot);

  if (buildSbf || (skipBuildSbf === false && !alreadyBuilt)) {
    if (!alreadyBuilt && !buildSbf && skipBuildSbf === false) {
      warnings.push(
        `Auto-building missing escrow SBF artifact: ${artifactPath}`,
      );
    }

    commandPlan.push({
      label: 'build escrow program',
      command: 'cargo',
      args: ['build-sbf', '--manifest-path', DEFAULT_ESCROW_MANIFEST_PATH],
    });
  } else if (!alreadyBuilt && skipBuildSbf === true) {
    errors.push(
      `Missing escrow SBF artifact at ${artifactPath}. Run`
      + ' `cargo build-sbf --manifest-path examples/escrow/Cargo.toml`'
      + ' first, or pass --build-sbf.',
    );
  }

  commandPlan.push({
    label: 'examples/escrow tests',
    command: 'cargo',
    args: [
      'test',
      '--manifest-path',
      DEFAULT_ESCROW_MANIFEST_PATH,
      '--all-features',
      ...(includeLocked || locked ? ['--locked'] : []),
    ],
  });

  return {
    commandPlan,
    warnings,
    errors,
  };
}

function runTestPlan(plan, options = {}) {
  const {
    cwd = process.cwd(),
    runCommand = createRunner(),
  } = options;

  for (const warning of plan.warnings) {
    console.log(warning);
  }

  if (plan.errors.length > 0) {
    throw new Error(plan.errors.join('\n'));
  }

  for (const step of plan.commandPlan) {
    const result = runCommand(step.command, step.args, getProjectRoot(cwd));
    const failed = result.status !== 0 || Boolean(result.error);
    if (failed) {
      const details = result.error ? ` (${result.error.message})` : '';
      throw new Error(`${step.label} failed with status ${result.status}${details}`);
    }
  }

  return {
    rootDir: getProjectRoot(cwd),
    stepCount: plan.commandPlan.length,
  };
}

function runGeppettoTest(options = {}) {
  const plan = buildTestPlan(options);
  return runTestPlan(plan, options);
}

module.exports = {
  buildTestPlan,
  runGeppettoTest,
  runTestPlan,
  hasEscrowArtifact,
  getEscrowArtifactPath,
};

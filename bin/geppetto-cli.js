#!/usr/bin/env node

const { initProject } = require('../lib/init');
const { createProject } = require('../lib/new');
const { buildTestPlan, runGeppettoTest } = require('../lib/test');
const { runGeppettoAudit } = require('../lib/audit');
const { loadPlatformConfig } = require('../lib/platform/config');
const { parseSetValues, applyOverrides } = require('../lib/platform/overrides');
const { createDeployState } = require('../lib/platform/state');
const { runPipeline, bridgeOutputs } = require('../lib/platform/deploy');

function printUsage(stream) {
  stream.write('Usage: geppetto-cli <command> [options]\n\n');
  stream.write('Commands:\n');
  stream.write('  init [--dry-run]    Generate AGENTS.md and agent entry files in the current directory\n');
  stream.write('                      --dry-run previews create/skip actions without writing files\n');
  stream.write('  new <project-name>   Generate a minimal Pinocchio + Geppetto project scaffold\n');
  stream.write('  deploy [options]    Deploy Solana program + Encore off-chain service\n');
  stream.write('                      --output <table|json>  Output format (default: table)\n');
  stream.write('                      --set key=value        Override config (cluster, program_id, service_name, replicas)\n');
  stream.write('                      --write-back           Write program_id back to geppetto.toml\n');
  stream.write('  test [--skip-examples] [--build-sbf] [--skip-build-sbf]\n');
  stream.write('                      Run root tests and escrow example tests. Missing SBF artifact\n');
  stream.write('                      is auto-built unless --skip-build-sbf is passed.\n');
  stream.write('  audit [--strict]    Run minimal static audit checks (fmt/check, optional clippy)\n');
}

function createLogger(stream) {
  return (line) => {
    stream.write(`${line}\n`);
  };
}

function parseInitArgs(args) {
  const options = { dryRun: false };

  for (const arg of args) {
    if (arg === '--dry-run' && options.dryRun === false) {
      options.dryRun = true;
      continue;
    }

    if (arg === '-h' || arg === '--help') {
      return { help: true };
    }

    return { error: `Unexpected arguments: ${args.join(' ')}` };
  }

  return { options };
}

function parseNewArgs(args) {
  if (args[0] === '-h' || args[0] === '--help') {
    return { help: true };
  }

  if (args.length === 0 || args[0].startsWith('-')) {
    return { error: 'Missing or invalid project name' };
  }

  if (args.length > 1) {
    return { error: `Unexpected arguments: ${args.join(' ')}` };
  }

  return { projectName: args[0] };
}

function parseTestArgs(args) {
  const options = {
    includeEscrowTests: true,
    buildSbf: false,
    skipBuildSbf: false,
  };

  for (const arg of args) {
    if (arg === '-h' || arg === '--help') {
      return { help: true };
    }

    if (arg === '--skip-examples') {
      options.includeEscrowTests = false;
      continue;
    }

    if (arg === '--build-sbf') {
      options.buildSbf = true;
      options.skipBuildSbf = false;
      continue;
    }

    if (arg === '--skip-build-sbf') {
      options.skipBuildSbf = true;
      options.buildSbf = false;
      continue;
    }

    return { error: `Unexpected arguments: ${args.join(' ')}` };
  }

  return options;
}

function parseDeployArgs(args) {
  const options = { output: 'table', setValues: [], writeBack: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      return { help: true };
    }

    if (arg === '--output' || arg === '-o') {
      const value = args[++i];
      if (!value || value.startsWith('-')) {
        return { error: '--output requires a value (table or json)' };
      }
      if (value !== 'table' && value !== 'json') {
        return { error: `Invalid output format: ${value} (use table or json)` };
      }
      options.output = value;
      continue;
    }

    if (arg === '--set') {
      const value = args[++i];
      if (!value || value.startsWith('-')) {
        return { error: '--set requires a key=value argument' };
      }
      options.setValues.push(value);
      continue;
    }

    if (arg === '--write-back') {
      options.writeBack = true;
      continue;
    }

    return { error: `Unexpected argument: ${arg}` };
  }

  return { options };
}

function renderDeployOutput(state, format, stream) {
  if (format === 'json') {
    const output = {
      run_id: state.run_id,
      app_name: state.app_name,
      cluster: state.cluster,
      program_id: state.program_id || null,
      service_url: state.service_url || null,
      provider_deployment_id: state.provider_deployment_id || null,
      status: state.status,
      failure_class: state.failure_class || null,
      steps: state.steps,
    };
    stream.write(JSON.stringify(output, null, 2) + '\n');
    return;
  }

  // Table format
  stream.write('\n');
  stream.write(`  Run ID:    ${state.run_id}\n`);
  stream.write(`  App:       ${state.app_name}\n`);
  stream.write(`  Cluster:   ${state.cluster}\n`);
  stream.write(`  Program:   ${state.program_id || '(not assigned)'}\n`);
  stream.write(`  Service:   ${state.service_url || '(not available)'}\n`);
  stream.write(`  Status:    ${state.status}\n`);
  if (state.failure_class) {
    stream.write(`  Failure:   ${state.failure_class}\n`);
  }
  stream.write('\n');

  // Step table
  if (state.steps.length > 0) {
    stream.write('  Steps:\n');
    for (const step of state.steps) {
      const icon = step.status === 'success' ? '✓' : '✗';
      const elapsed = step.elapsed_ms != null ? ` (${step.elapsed_ms}ms)` : '';
      stream.write(`    ${icon} ${step.name}${elapsed}\n`);
      if (step.error) {
        stream.write(`      Error: ${step.error}\n`);
      }
    }
    stream.write('\n');
  }
}

async function runDeploy(parsedArgs, io) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const cwd = io.cwd || process.cwd();

  // Load and validate config
  let config;
  try {
    config = loadPlatformConfig({ cwd });
  } catch (error) {
    stderr.write(`${error.code || 'ERROR'}: ${error.message}\n`);
    return 1;
  }

  // Parse and apply overrides
  let overrides;
  try {
    overrides = parseSetValues(parsedArgs.options.setValues);
    if (Object.keys(overrides).length > 0) {
      config = applyOverrides(config, overrides);
    }
  } catch (error) {
    stderr.write(`${error.code || 'ERROR'}: ${error.message}\n`);
    return 1;
  }

  // Create initial deploy state
  const state = createDeployState(config);

  // Build step list — adapters plug in here (GP-05~08)
  // For now, steps are empty; real adapters will be wired in GP-05/06/07/08
  const steps = [];

  // Run pipeline
  let finalState;
  try {
    finalState = await runPipeline({
      ctx: {},
      config,
      initialState: state,
      steps,
    });

    // Bridge outputs validates required fields
    finalState = bridgeOutputs(finalState);
  } catch (error) {
    // Render partial state on failure
    const failedState = error.state || state;
    failedState.status = 'failure';
    failedState.failure_class = error.failureClass || 'deploy';
    renderDeployOutput(failedState, parsedArgs.options.output, stdout);
    stderr.write(`${error.code || 'ERROR'}: ${error.message}\n`);
    return 1;
  }

  // Render success output
  renderDeployOutput(finalState, parsedArgs.options.output, stdout);
  return 0;
}

function parseAuditArgs(args) {
  const options = {
    strict: false,
  };

  for (const arg of args) {
    if (arg === '-h' || arg === '--help') {
      return { help: true };
    }

    if (arg === '--strict') {
      options.strict = true;
      continue;
    }

    return { error: `Unexpected arguments: ${args.join(' ')}` };
  }

  return options;
}

function main(argv = process.argv.slice(2), io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const cwd = io.cwd || process.cwd();
  const [command, ...rest] = argv;

  if (!command || command === '-h' || command === '--help') {
    printUsage(stdout);
    return 0;
  }

  if (command === 'deploy') {
    const parsedArgs = parseDeployArgs(rest);

    if (parsedArgs.help) {
      printUsage(stdout);
      return 0;
    }

    if (parsedArgs.error) {
      stderr.write(`${parsedArgs.error}\n`);
      printUsage(stderr);
      return 1;
    }

    // Deploy is async — return a Promise
    return runDeploy(parsedArgs, { stdout, stderr, cwd });
  }

  if (command === 'init') {
    const parsedArgs = parseInitArgs(rest);

    if (parsedArgs.help) {
      printUsage(stdout);
      return 0;
    }

    if (parsedArgs.error) {
      stderr.write(`${parsedArgs.error}\n`);
      printUsage(stderr);
      return 1;
    }

    try {
      const results = initProject(cwd, {
        dryRun: parsedArgs.options.dryRun,
        log: createLogger(stdout),
      });
      const created = results.filter((result) => result.status === 'created' || result.status === 'would-create').length;
      const skipped = results.filter((result) => result.status === 'skipped').length;

      if (parsedArgs.options.dryRun) {
        stdout.write(`done dry-run would-create=${created} skipped=${skipped}\n`);
        return 0;
      }

      stdout.write(`done created=${created} skipped=${skipped}\n`);
      return 0;
    } catch (error) {
      stderr.write(`${error.message}\n`);
      return 1;
    }
  }

  if (command === 'new') {
    const parsedArgs = parseNewArgs(rest);

    if (parsedArgs.help) {
      printUsage(stdout);
      return 0;
    }

    if (parsedArgs.error) {
      stderr.write(`${parsedArgs.error}\n`);
      printUsage(stderr);
      return 1;
    }

    try {
      const results = createProject(cwd, parsedArgs.projectName, {
        log: createLogger(stdout),
      });
      const created = results.filter((result) => result.status === 'created').length;
      const skipped = results.filter((result) => result.status === 'skipped').length;
      stdout.write(`done new ${parsedArgs.projectName} created=${created} skipped=${skipped}\n`);
      return 0;
    } catch (error) {
      stderr.write(`${error.message}\n`);
      return 1;
    }
  }

  if (command === 'test') {
    const parsedArgs = parseTestArgs(rest);

    if (parsedArgs.help) {
      printUsage(stdout);
      return 0;
    }

    if (parsedArgs.error) {
      stderr.write(`${parsedArgs.error}\n`);
      printUsage(stderr);
      return 1;
    }

    try {
      const result = runGeppettoTest({
        cwd,
        includeEscrowTests: parsedArgs.includeEscrowTests,
        buildSbf: parsedArgs.buildSbf,
        skipBuildSbf: parsedArgs.skipBuildSbf,
      });
      stdout.write(`done geppetto test completed: ${result.stepCount} steps\n`);
      return 0;
    } catch (error) {
      stderr.write(`${error.message}\n`);
      return 1;
    }
  }

  if (command === 'audit') {
    const parsedArgs = parseAuditArgs(rest);

    if (parsedArgs.help) {
      printUsage(stdout);
      return 0;
    }

    if (parsedArgs.error) {
      stderr.write(`${parsedArgs.error}\n`);
      printUsage(stderr);
      return 1;
    }

    try {
      runGeppettoAudit({
        strict: parsedArgs.strict,
      });
      stdout.write('done geppetto audit\n');
      return 0;
    } catch (error) {
      stderr.write(`${error.message}\n`);
      return 1;
    }
  }

  stderr.write(`Unknown command: ${command}\n`);
  printUsage(stderr);
  return 1;
}

if (require.main === module) {
  const result = main();
  if (result && typeof result.then === 'function') {
    result.then((code) => { process.exitCode = code; })
      .catch(() => { process.exitCode = 1; });
  } else {
    process.exitCode = result;
  }
}

module.exports = {
  main,
  parseInitArgs,
  parseNewArgs,
  parseTestArgs,
  parseAuditArgs,
  parseDeployArgs,
  renderDeployOutput,
  runDeploy,
  printUsage,
};

#!/usr/bin/env node

const { initProject } = require('../lib/init');
const { createProject } = require('../lib/new');
const { buildTestPlan, runGeppettoTest } = require('../lib/test');
const { runGeppettoAudit } = require('../lib/audit');

function printUsage(stream) {
  stream.write('Usage: geppetto-cli <command> [options]\n\n');
  stream.write('Commands:\n');
  stream.write('  init [--dry-run]    Generate AGENTS.md and agent entry files in the current directory\n');
  stream.write('                      --dry-run previews create/skip actions without writing files\n');
  stream.write('  new <project-name>   Generate a minimal Pinocchio + Geppetto project scaffold\n');
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
  process.exitCode = main();
}

module.exports = {
  main,
  parseInitArgs,
  parseNewArgs,
  parseTestArgs,
  parseAuditArgs,
  printUsage,
};

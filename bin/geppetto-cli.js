#!/usr/bin/env node

const { initProject } = require('../lib/init');

function printUsage(stream) {
  stream.write('Usage: geppetto-cli <command> [options]\n\n');
  stream.write('Commands:\n');
  stream.write('  init [--dry-run]    Generate AGENTS.md and agent entry files in the current directory\n');
  stream.write('                      --dry-run previews create/skip actions without writing files\n');
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

function main(argv = process.argv.slice(2), io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const cwd = io.cwd || process.cwd();
  const [command, ...rest] = argv;

  if (!command || command === '-h' || command === '--help') {
    printUsage(stdout);
    return 0;
  }

  if (command !== 'init') {
    stderr.write(`Unknown command: ${command}\n`);
    printUsage(stderr);
    return 1;
  }

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

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  main,
  parseInitArgs,
  printUsage,
};

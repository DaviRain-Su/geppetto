#!/usr/bin/env node

const { initProject } = require('../lib/init');

function printUsage(stream) {
  stream.write('Usage: geppetto-cli <command>\n\n');
  stream.write('Commands:\n');
  stream.write('  init    Generate AGENTS.md and agent entry files in the current directory\n');
}

function createLogger(stream) {
  return (line) => {
    stream.write(`${line}\n`);
  };
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

  if (rest.length > 0) {
    stderr.write(`Unexpected arguments: ${rest.join(' ')}\n`);
    printUsage(stderr);
    return 1;
  }

  try {
    const results = initProject(cwd, { log: createLogger(stdout) });
    const created = results.filter((result) => result.status === 'created').length;
    const skipped = results.length - created;
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
  printUsage,
};

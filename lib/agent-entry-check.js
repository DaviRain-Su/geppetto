#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const CLAUDE_INCLUDE = '@AGENTS.md';
const AGENTS_REDIRECT = 'Read and follow all instructions in AGENTS.md in this repository.';
const AIDER_REDIRECT = 'read:\n  - AGENTS.md';

const AGENT_ENTRY_MIRROR_TARGETS = Object.freeze([
  { relativePath: 'CLAUDE.md', expectedContent: CLAUDE_INCLUDE },
  { relativePath: 'GEMINI.md', expectedContent: AGENTS_REDIRECT },
  { relativePath: '.cursor/rules/geppetto.md', expectedContent: AGENTS_REDIRECT },
  { relativePath: '.github/copilot-instructions.md', expectedContent: AGENTS_REDIRECT },
  { relativePath: '.windsurf/rules/geppetto.md', expectedContent: AGENTS_REDIRECT },
  { relativePath: '.amazonq/rules/geppetto.md', expectedContent: AGENTS_REDIRECT },
  { relativePath: '.aider.conf.yml', expectedContent: AIDER_REDIRECT },
]);

function getAgentEntryRoot() {
  return path.resolve(__dirname, '..');
}

function getAgentEntryTargets(root = getAgentEntryRoot()) {
  return AGENT_ENTRY_MIRROR_TARGETS.map((target) => ({
    ...target,
    sourcePath: path.join(root, target.relativePath),
  }));
}

function assertAgentEntryManifest(root = getAgentEntryRoot(), manifest = getAgentEntryTargets(root)) {
  const seen = new Set();

  for (const target of manifest) {
    if (path.isAbsolute(target.relativePath)) {
      throw new Error(`Agent entry path must be relative: ${target.relativePath}`);
    }
    if (target.relativePath.includes('\\')) {
      throw new Error(`Agent entry path must use POSIX separators: ${target.relativePath}`);
    }
    if (seen.has(target.relativePath)) {
      throw new Error(`Duplicate agent entry path: ${target.relativePath}`);
    }
    if (!fs.existsSync(target.sourcePath)) {
      throw new Error(`Missing agent entry file: ${target.relativePath}`);
    }
    seen.add(target.relativePath);
  }
}

function normalizeContent(content) {
  return content.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

function validateAgentEntryTarget(target) {
  const actual = normalizeContent(fs.readFileSync(target.sourcePath, 'utf8'));
  const expected = normalizeContent(target.expectedContent);

  if (actual === expected) {
    return null;
  }

  return `${target.relativePath}: expected exact AGENTS mirror content`;
}

function checkAgentEntryMirrors(root = getAgentEntryRoot(), manifest = getAgentEntryTargets(root)) {
  assertAgentEntryManifest(root, manifest);

  const errors = manifest
    .map((target) => validateAgentEntryTarget(target))
    .filter(Boolean);

  return {
    errors,
    checkedFiles: manifest.map((target) => target.relativePath),
  };
}

function main() {
  const result = checkAgentEntryMirrors(getAgentEntryRoot());

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      process.stderr.write(`${error}\n`);
    }
    return 1;
  }

  process.stdout.write(`agent entry mirrors ok files=${result.checkedFiles.length}\n`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  AGENT_ENTRY_MIRROR_TARGETS,
  assertAgentEntryManifest,
  checkAgentEntryMirrors,
  getAgentEntryRoot,
  getAgentEntryTargets,
  main,
  normalizeContent,
};

const fs = require('node:fs');
const path = require('node:path');

// Canonical template sources for `geppetto-cli init`.
//
// These files live at the repository root and are the single source of truth.
// The CLI must copy them byte-for-byte into downstream projects rather than
// maintaining duplicate template content in a second location.
const TEMPLATE_FILES = Object.freeze([
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.aider.conf.yml',
  '.amazonq/rules/geppetto.md',
  '.cursor/rules/geppetto.md',
  '.github/copilot-instructions.md',
  '.windsurf/rules/geppetto.md',
]);

const PACKAGE_REQUIRED_FILES = Object.freeze([
  'bin/geppetto-cli.js',
  'lib/init.js',
  'lib/templates.js',
  'package.json',
  'LICENSE',
  'LICENSE-APACHE',
  ...TEMPLATE_FILES,
]);

function getTemplateRoot() {
  return path.resolve(__dirname, '..');
}

function getTemplateEntries(templateRoot = getTemplateRoot()) {
  return TEMPLATE_FILES.map((relativePath) => ({
    relativePath,
    sourcePath: path.join(templateRoot, relativePath),
  }));
}

function assertTemplateManifest(templateRoot = getTemplateRoot()) {
  const seen = new Set();

  for (const { relativePath, sourcePath } of getTemplateEntries(templateRoot)) {
    if (path.isAbsolute(relativePath)) {
      throw new Error(`Template path must be relative: ${relativePath}`);
    }
    if (relativePath.includes('\\')) {
      throw new Error(`Template path must use POSIX separators: ${relativePath}`);
    }
    if (seen.has(relativePath)) {
      throw new Error(`Duplicate template path: ${relativePath}`);
    }
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing template file: ${relativePath}`);
    }
    seen.add(relativePath);
  }
}

module.exports = {
  PACKAGE_REQUIRED_FILES,
  TEMPLATE_FILES,
  assertTemplateManifest,
  getTemplateEntries,
  getTemplateRoot,
};

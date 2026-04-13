const fs = require('node:fs');
const path = require('node:path');

const TEMPLATE_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.aider.conf.yml',
  '.amazonq/rules/geppetto.md',
  '.cursor/rules/geppetto.md',
  '.github/copilot-instructions.md',
  '.windsurf/rules/geppetto.md',
];

function getTemplateRoot() {
  return path.resolve(__dirname, '..');
}

function initProject(targetDir, options = {}) {
  const templateRoot = options.templateRoot || getTemplateRoot();
  const log = options.log || (() => {});
  const results = [];

  for (const relativePath of TEMPLATE_FILES) {
    const sourcePath = path.join(templateRoot, relativePath);
    const destinationPath = path.join(targetDir, relativePath);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing template file: ${relativePath}`);
    }

    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });

    if (fs.existsSync(destinationPath)) {
      results.push({ path: relativePath, status: 'skipped' });
      log(`skipped ${relativePath}`);
      continue;
    }

    fs.copyFileSync(sourcePath, destinationPath);
    results.push({ path: relativePath, status: 'created' });
    log(`created ${relativePath}`);
  }

  return results;
}

module.exports = {
  TEMPLATE_FILES,
  getTemplateRoot,
  initProject,
};

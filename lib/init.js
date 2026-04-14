const fs = require('node:fs');
const path = require('node:path');
const { TEMPLATE_FILES, assertTemplateManifest, getTemplateEntries, getTemplateRoot } = require('./templates');

function initProject(targetDir, options = {}) {
  const templateRoot = options.templateRoot || getTemplateRoot();
  const dryRun = options.dryRun === true;
  const log = options.log || (() => {});
  const results = [];

  assertTemplateManifest(templateRoot);

  for (const { relativePath, sourcePath } of getTemplateEntries(templateRoot)) {
    const destinationPath = path.join(targetDir, relativePath);

    if (fs.existsSync(destinationPath)) {
      results.push({ path: relativePath, status: 'skipped' });
      log(`skipped ${relativePath}`);
      continue;
    }

    if (dryRun) {
      results.push({ path: relativePath, status: 'would-create' });
      log(`would-create ${relativePath}`);
      continue;
    }

    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
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

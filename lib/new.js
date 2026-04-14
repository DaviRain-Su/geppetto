const fs = require('node:fs');
const path = require('node:path');

const {
  assertNewProjectManifest,
  getNewProjectTemplateEntries,
} = require('./new-manifest');

function isSafeProjectName(projectName) {
  return typeof projectName === 'string'
    && projectName.length > 0
    && /^[a-z0-9][a-z0-9_-]*$/i.test(projectName);
}

function renderTemplate(content, variables) {
  let rendered = content;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.split(`{{${key}}}`).join(value);
  }
  return rendered;
}

function createProject(targetDir, projectName, options = {}) {
  const dryRun = options.dryRun === true;
  const log = options.log || (() => {});

  assertNewProjectManifest();

  if (!isSafeProjectName(projectName)) {
    throw new Error(`Invalid project name: ${projectName}`);
  }

  const projectRoot = path.join(targetDir, projectName);
  const exists = fs.existsSync(projectRoot);
  const isDirectory = exists && fs.statSync(projectRoot).isDirectory();

  if (exists && !isDirectory) {
    throw new Error(`Target path exists and is not a directory: ${projectName}`);
  }

  if (exists) {
    const entries = fs.readdirSync(projectRoot);
    if (entries.length > 0) {
      throw new Error(`Target directory is not empty: ${projectName}`);
    }
  } else {
    fs.mkdirSync(projectRoot, { recursive: true });
  }

  const variables = {
    PROJECT_NAME: projectName,
  };
  const results = [];

  for (const { relativePath, content } of getNewProjectTemplateEntries()) {
    const absolutePath = path.join(projectRoot, relativePath);

    if (fs.existsSync(absolutePath)) {
      results.push({ path: relativePath, status: 'skipped' });
      log(`skipped ${relativePath}`);
      continue;
    }

    if (dryRun) {
      results.push({ path: relativePath, status: 'would-create' });
      log(`would-create ${relativePath}`);
      continue;
    }

    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, renderTemplate(content, variables));
    results.push({ path: relativePath, status: 'created' });
    log(`created ${relativePath}`);
  }

  return results;
}

module.exports = {
  createProject,
  isSafeProjectName,
  renderTemplate,
};

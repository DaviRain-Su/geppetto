#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const {
  assertKnowledgeHeaderManifest,
  getKnowledgeHeaderTargets,
  getKnowledgeManifestRoot,
} = require('./knowledge-manifest');

function extractTomlSection(content, sectionName) {
  const lines = content.split(/\r?\n/);
  const collected = [];
  let found = false;

  for (const line of lines) {
    const sectionMatch = line.match(/^\[([^\]]+)\]\s*$/);
    if (sectionMatch) {
      if (found) {
        break;
      }
      found = sectionMatch[1] === sectionName;
      continue;
    }

    if (found) {
      collected.push(line);
    }
  }

  if (!found) {
    throw new Error(`Missing TOML section: [${sectionName}]`);
  }
  return collected.join('\n');
}

function extractTomlValue(sectionContent, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = sectionContent.match(new RegExp(`^${escapedKey}\\s*=\\s*"([^"]+)"`, 'm'));
  if (!match) {
    throw new Error(`Missing TOML value: ${key}`);
  }
  return match[1];
}

function normalizeDependencyVersion(version) {
  const normalized = version.trim().replace(/^[~^<>= ]+/, '');
  if (!normalized) {
    throw new Error(`Expected dependency version, received: ${version}`);
  }
  return normalized;
}

function extractDependencyDeclaration(sectionContent, dependencyName) {
  const escapedDependencyName = dependencyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stringMatch = sectionContent.match(
    new RegExp(`^${escapedDependencyName}\\s*=\\s*"([^"]+)"`, 'm'),
  );
  if (stringMatch) {
    return {
      kind: 'version',
      version: normalizeDependencyVersion(stringMatch[1]),
    };
  }

  const inlineTableMatch = sectionContent.match(
    new RegExp(`^${escapedDependencyName}\\s*=\\s*\\{[^\\n]*version\\s*=\\s*"([^"]+)"`, 'm'),
  );
  if (inlineTableMatch) {
    return {
      kind: 'version',
      version: normalizeDependencyVersion(inlineTableMatch[1]),
    };
  }

  const workspaceMatch = sectionContent.match(
    new RegExp(`^${escapedDependencyName}\\s*=\\s*\\{[^\\n]*workspace\\s*=\\s*true`, 'm'),
  );
  if (workspaceMatch) {
    return { kind: 'workspace' };
  }

  throw new Error(`Missing dependency version: ${dependencyName}`);
}

function extractDependencyVersion(cargoToml, dependencyName) {
  const dependenciesSection = extractTomlSection(cargoToml, 'dependencies');
  const declaration = extractDependencyDeclaration(dependenciesSection, dependencyName);

  if (declaration.kind === 'version') {
    return declaration.version;
  }

  if (declaration.kind === 'workspace') {
    const workspaceDependenciesSection = extractTomlSection(cargoToml, 'workspace.dependencies');
    const workspaceDeclaration = extractDependencyDeclaration(
      workspaceDependenciesSection,
      dependencyName,
    );

    if (workspaceDeclaration.kind !== 'version') {
      throw new Error(`Workspace dependency version must be explicit: ${dependencyName}`);
    }

    return workspaceDeclaration.version;
  }

  throw new Error(`Unsupported dependency declaration: ${dependencyName}`);
}

function toMajorMinorWildcard(version) {
  const [major, minor] = version.split('.');
  if (!major || !minor) {
    throw new Error(`Expected major.minor version, received: ${version}`);
  }
  return `${major}.${minor}.x`;
}

function readCargoVersions(root = getKnowledgeManifestRoot()) {
  const cargoToml = fs.readFileSync(path.join(root, 'Cargo.toml'), 'utf8');
  const packageSection = extractTomlSection(cargoToml, 'package');

  return {
    geppettoVersion: extractTomlValue(packageSection, 'version'),
    pinocchioVersion: toMajorMinorWildcard(
      extractDependencyVersion(cargoToml, 'pinocchio'),
    ),
  };
}

function parseKnowledgeHeader(content) {
  const match = content.match(
    /\*\*Knowledge version\*\*:\s*geppetto\s+([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^\n\r]+)/,
  );
  if (!match) {
    return null;
  }

  const ecosystemPart = match[2].trim();
  const ecosystemMatch = ecosystemPart.match(/^(.+)\s+([0-9][^\s]*)$/);

  if (!ecosystemMatch) {
    return {
      geppettoVersion: match[1].trim(),
      ecosystemName: null,
      ecosystemVersion: null,
      date: match[3].trim(),
    };
  }

  return {
    geppettoVersion: match[1].trim(),
    ecosystemName: ecosystemMatch[1].trim(),
    ecosystemVersion: ecosystemMatch[2].trim(),
    date: match[3].trim(),
  };
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function resolveExpectedVersion(target, cargoVersions) {
  if (target.ecosystem === 'pinocchio') {
    return cargoVersions.pinocchioVersion;
  }
  return target.expectedVersion;
}

function validateKnowledgeHeaderTarget(target, cargoVersions) {
  const content = fs.readFileSync(target.sourcePath, 'utf8');
  const header = parseKnowledgeHeader(content);
  const errors = [];

  if (!header) {
    return [`${target.relativePath}: missing knowledge version header`];
  }

  if (header.geppettoVersion !== cargoVersions.geppettoVersion) {
    errors.push(
      `${target.relativePath}: expected geppetto ${cargoVersions.geppettoVersion}, found ${header.geppettoVersion}`,
    );
  }

  if (header.ecosystemName !== target.ecosystem) {
    errors.push(
      `${target.relativePath}: expected ecosystem ${target.ecosystem}, found ${header.ecosystemName || 'none'}`,
    );
  } else {
    const expectedVersion = resolveExpectedVersion(target, cargoVersions);
    if (header.ecosystemVersion !== expectedVersion) {
      errors.push(
        `${target.relativePath}: expected ${target.ecosystem} ${expectedVersion}, found ${header.ecosystemVersion}`,
      );
    }
  }

  if (!isIsoDate(header.date)) {
    errors.push(
      `${target.relativePath}: expected ISO date YYYY-MM-DD, found ${header.date}`,
    );
  }

  return errors;
}

function checkKnowledgeHeaders(
  root = getKnowledgeManifestRoot(),
  manifest = getKnowledgeHeaderTargets(root),
) {
  assertKnowledgeHeaderManifest(root, manifest);
  const cargoVersions = readCargoVersions(root);
  const errors = [];

  for (const target of manifest) {
    errors.push(...validateKnowledgeHeaderTarget(target, cargoVersions));
  }

  return {
    cargoVersions,
    errors,
    checkedFiles: manifest.map((target) => target.relativePath),
  };
}

function main() {
  const root = getKnowledgeManifestRoot();
  const result = checkKnowledgeHeaders(root);

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      process.stderr.write(`${error}\n`);
    }
    return 1;
  }

  process.stdout.write(
    `knowledge headers ok files=${result.checkedFiles.length} geppetto=${result.cargoVersions.geppettoVersion} pinocchio=${result.cargoVersions.pinocchioVersion}\n`,
  );
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  checkKnowledgeHeaders,
  isIsoDate,
  main,
  parseKnowledgeHeader,
  readCargoVersions,
};

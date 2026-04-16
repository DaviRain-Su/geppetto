#!/usr/bin/env node
// @ts-nocheck

const fs = require('node:fs');
const path = require('node:path');

const {
  assertUpstreamTrackingManifest,
  getUpstreamTrackingManifest,
  getUpstreamManifestRoot,
} = require('./upstream-manifest');

function extractTomlSection(content, sectionName) {
  const lines = content.split(/\r?\n/);
  const collected = [];
  let found = false;
  let nestedDepth = 0;

  for (const line of lines) {
    const sectionMatch = line.match(/^\[([^\]]+)\]\s*$/);
    if (sectionMatch) {
      const currentSection = sectionMatch[1];
      if (found && nestedDepth === 1) {
        break;
      }
      nestedDepth = currentSection.includes('.') ? 2 : 1;
      found = currentSection === sectionName;
      continue;
    }

    if (found && nestedDepth === 1) {
      collected.push(line);
    }
  }

  if (!found) {
    return null;
  }

  return collected.join('\n');
}

function normalizeDependencyVersion(version) {
  const normalized = version.trim().replace(/^[~^<>= ]+/, '');
  if (!normalized) {
    throw new Error(`Expected dependency version, received: ${version}`);
  }
  return normalized;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readCargoTomlSection(content, sectionName) {
  const section = extractTomlSection(content, sectionName);
  if (!section) {
    throw new Error(`Missing TOML section: [${sectionName}]`);
  }
  return section;
}

function tryReadCargoTomlSection(content, sectionName) {
  try {
    return readCargoTomlSection(content, sectionName);
  } catch {
    return null;
  }
}

function extractDependencyDeclaration(sectionContent, dependencyName) {
  const escaped = escapeRegExp(dependencyName);

  const stringMatch = sectionContent.match(
    new RegExp(`^${escaped}\\s*=\\s*"([^"]+)"`, 'm'),
  );
  if (stringMatch) {
    return normalizeDependencyVersion(stringMatch[1]);
  }

  const inlineTableMatch = sectionContent.match(
    new RegExp(`^${escaped}\\s*=\\s*\\{[^\\n]*version\\s*=\\s*"([^"]+)"`, 'm'),
  );
  if (inlineTableMatch) {
    return normalizeDependencyVersion(inlineTableMatch[1]);
  }

  const workspaceMatch = sectionContent.match(
    new RegExp(`^${escaped}\\s*=\\s*\\{[^\\n]*workspace\\s*=\\s*true`, 'm'),
  );
  if (workspaceMatch) {
    return null;
  }

  return null;
}

function extractDependencyVersionFromToml(tomlContent, sectionName, dependencyName) {
  const section = readCargoTomlSection(tomlContent, sectionName);
  return extractDependencyDeclaration(section, dependencyName);
}

function parseVerbsedDependencyVersion(sectionValue) {
  return normalizeDependencyVersion(sectionValue);
}

function getCargoVersionFromContent(content, dependencyName, source) {
  let value = null;
  const primarySection = tryReadCargoTomlSection(content, source.section);
  if (primarySection) {
    value = extractDependencyDeclaration(primarySection, dependencyName);
  }

  if (!value) {
    const workspaceSection = tryReadCargoTomlSection(content, 'workspace.dependencies');
    value = workspaceSection ? extractDependencyDeclaration(workspaceSection, dependencyName) : null;
  }

  if (!value) {
    return [];
  }
  return [parseVerbsedDependencyVersion(value)];
}

function extractLockfilePackageVersions(lockfileContent, packageName) {
  const pattern = /\[\[package\]\][\s\S]*?(?=\n\[\[package\]\]|\s*$)/g;
  const packageVersions = [];
  const matches = [...lockfileContent.matchAll(pattern)];

  for (const match of matches) {
    const block = match[0];
    const nameMatch = block.match(/^\s*name\s*=\s*"([^"]+)"/m);
    if (!nameMatch || nameMatch[1] !== packageName) {
      continue;
    }

    const versionMatch = block.match(/^\s*version\s*=\s*"([^"]+)"/m);
    if (versionMatch) {
      packageVersions.push(versionMatch[1]);
    }
  }

  return packageVersions;
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
    return null;
  }

  return {
    ecosystemName: ecosystemMatch[1].trim(),
    ecosystemVersion: ecosystemMatch[2].trim(),
  };
}

function extractVersionFromKnowledgeHeader(content, ecosystemName) {
  const header = parseKnowledgeHeader(content);
  if (!header || header.ecosystemName !== ecosystemName) {
    return [];
  }

  return [header.ecosystemVersion];
}

function extractVersionFromKnowledgeTable(content, dependencyName) {
  const lines = content.split(/\r?\n/);
  const target = dependencyName.trim();

  for (const line of lines) {
    if (!line.includes('|')) {
      continue;
    }

    const cells = line
      .split('|')
      .map((cell) => cell.trim());

    if (cells[0] === '') {
      cells.shift();
    }
    if (cells[cells.length - 1] === '') {
      cells.pop();
    }

    if (cells.length < 2) {
      continue;
    }

    const current = cells[0].replace(/`/g, '');
    if (current !== target) {
      continue;
    }

    const version = (cells[1] || '').trim();
    if (!version) {
      continue;
    }

    return [version];
  }

  return [];
}

function splitNumericVersion(version) {
  const normalized = version
    .replace(/[^\w.]/g, '.')
    .split('.')
    .filter(Boolean)
    .map((part) => (part.toLowerCase() === 'x' ? '0' : part));

  const major = Number.parseInt(normalized[0], 10);
  const minor = Number.parseInt(normalized[1], 10);
  const patch = Number.parseInt(normalized[2], 10);

  return [
    Number.isNaN(major) ? 0 : major,
    Number.isNaN(minor) ? 0 : minor,
    Number.isNaN(patch) ? 0 : patch,
  ];
}

function compareVersions(left, right) {
  const lhs = splitNumericVersion(left);
  const rhs = splitNumericVersion(right);

  for (let i = 0; i < 3; i += 1) {
    if (lhs[i] !== rhs[i]) {
      return lhs[i] > rhs[i] ? 1 : -1;
    }
  }

  return 0;
}

function filterVersionsByMajorMinor(versions, constraint) {
  const normalized = normalizeDependencyVersion(constraint);
  const [major, minor] = normalized.split('.');
  const majorMinor = Number.parseInt(major, 10);
  const minorMinor = Number.parseInt(minor, 10);

  if (Number.isNaN(majorMinor) || Number.isNaN(minorMinor)) {
    return versions;
  }

  const filtered = versions.filter((version) => {
    const [entryMajor, entryMinor] = splitNumericVersion(version);
    return entryMajor === majorMinor && entryMinor === minorMinor;
  });

  return filtered.length > 0 ? filtered : versions;
}

function resolveCurrentVersion(cargoVersions, lockVersions, allVersions) {
  const versionsBySource = [...lockVersions, ...allVersions];
  for (const constraint of cargoVersions) {
    if (!constraint) {
      continue;
    }
    const filtered = filterVersionsByMajorMinor(versionsBySource, constraint);
    if (filtered.length > 0) {
      return [...filtered].sort(compareVersions)[filtered.length - 1];
    }
  }

  if (lockVersions.length > 0) {
    return [...lockVersions].sort(compareVersions)[lockVersions.length - 1];
  }

  if (allVersions.length > 0) {
    return [...allVersions].sort(compareVersions)[allVersions.length - 1];
  }

  return null;
}

function resolveDependencyVersions(root, item, contentCache) {
  const sourceResults = [];
  const allVersions = [];
  const lockVersions = [];
  const cargoVersions = [];

  for (const source of item.sources) {
    const content = contentCache[source.sourcePath]
      || (() => {
        const fileContent = fs.readFileSync(source.sourcePath, 'utf8');
        contentCache[source.sourcePath] = fileContent;
        return fileContent;
      })();

    let sourceVersions = [];

    switch (source.sourceType) {
      case 'cargo': {
        const cargoPath = path.join(root, source.relativePath);
        const cargoContent = contentCache[cargoPath]
          || (() => {
            const raw = fs.readFileSync(cargoPath, 'utf8');
            contentCache[cargoPath] = raw;
            return raw;
          })();
        sourceVersions = getCargoVersionFromContent(
          cargoContent,
          source.dependencyName,
          source,
        );
        break;
      }
      case 'cargo-lock':
        sourceVersions = extractLockfilePackageVersions(content, source.packageName || item.dependencyName);
        lockVersions.push(...sourceVersions);
        break;
      case 'knowledge-header': {
        const headerEcosystemName = source.ecosystemName || item.dependencyName;
        sourceVersions = extractVersionFromKnowledgeHeader(content, headerEcosystemName);
        break;
      }
      case 'knowledge-table':
        sourceVersions = extractVersionFromKnowledgeTable(content, source.dependencyName || item.dependencyName);
        break;
      default:
        throw new Error(`Unsupported source type: ${source.sourceType}`);
    }

    sourceVersions = [...new Set(sourceVersions.filter(Boolean))];
    allVersions.push(...sourceVersions);

    if (source.sourceType === 'cargo') {
      cargoVersions.push(...sourceVersions);
    }

    sourceResults.push({
      label: source.label || source.sourceType,
      type: source.sourceType,
      versions: sourceVersions,
      path: source.relativePath,
    });
  }

  const currentVersion = resolveCurrentVersion(cargoVersions, lockVersions, allVersions);

  return {
    dependencyName: item.dependencyName,
    upstreamName: item.upstreamName,
    currentVersion,
    sourceVersions: sourceResults,
  };
}

function checkUpstreamVersions(
  root = getUpstreamManifestRoot(),
  manifest = getUpstreamTrackingManifest(root),
) {
  assertUpstreamTrackingManifest(root, manifest);
  const contentCache = Object.create(null);
  const errors = [];
  const entries = [];

  for (const item of manifest) {
    try {
      const resolved = resolveDependencyVersions(root, item, contentCache);
      if (!resolved.currentVersion && resolved.sourceVersions.every((source) => source.versions.length === 0)) {
        errors.push(`Unable to resolve any version for ${item.dependencyName} (${item.upstreamName})`);
      }
      entries.push(resolved);
    } catch (error) {
      errors.push(error.message);
    }
  }

  return {
    checkedDependencies: manifest.map((item) => item.dependencyName),
    entries,
    errors,
  };
}

function main() {
  const result = checkUpstreamVersions();
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      process.stderr.write(`${error}\n`);
    }
    return 1;
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  checkUpstreamVersions,
  compareVersions,
  extractDependencyDeclaration,
  extractDependencyVersionFromToml,
  extractLockfilePackageVersions,
  extractVersionFromKnowledgeHeader,
  extractVersionFromKnowledgeTable,
  extractTomlSection,
  main,
  resolveCurrentVersion,
};
export { checkUpstreamVersions, compareVersions, extractDependencyDeclaration, extractDependencyVersionFromToml, extractLockfilePackageVersions, extractVersionFromKnowledgeHeader, extractVersionFromKnowledgeTable, extractTomlSection, main, resolveCurrentVersion };

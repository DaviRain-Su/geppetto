#!/usr/bin/env node

const { compareVersions, checkUpstreamVersions } = require('./upstream-version-check');
const { getUpstreamTrackingManifest, getUpstreamManifestRoot } = require('./upstream-manifest');
const { getUpstreamImpactMap, assertUpstreamImpactMap } = require('./upstream-impact-map');

function createCratesIoFetcher(registryBase = 'https://crates.io/api/v1') {
  return async function fetchLatestVersion(dependencyName) {
    const response = await fetch(`${registryBase}/crates/${encodeURIComponent(dependencyName)}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(
        `Failed to query crates.io for ${dependencyName}: ${response.status} ${response.statusText}`,
      );
    }

    const payload = await response.json();
    const latest = payload?.crate?.max_version;

    if (!latest || typeof latest !== 'string') {
      throw new Error(`Crates.io response missing max_version for ${dependencyName}`);
    }

    return latest;
  };
}

function buildSummary(status, name, currentVersion, latestVersion, source) {
  if (status === 'knowledge-source') {
    return `${name} tracked via docs source: ${source}`;
  }

  if (status === 'update-available') {
    return `${name} ${currentVersion} -> ${latestVersion}`;
  }

  if (status === 'up-to-date') {
    return `${name} ${currentVersion}`;
  }

  return `${name} version status unknown (current: ${currentVersion || 'N/A'})`;
}

function resolveStatus(currentVersion, latestVersion) {
  if (latestVersion == null) {
    return {
      status: 'knowledge-source',
      latestVersion: null,
    };
  }

  if (!currentVersion) {
    return {
      status: 'unknown',
      latestVersion,
    };
  }

  const cmp = compareVersions(currentVersion, latestVersion);
  if (cmp === 0) {
    return {
      status: 'up-to-date',
      latestVersion,
    };
  }

  if (cmp < 0) {
    return {
      status: 'update-available',
      latestVersion,
    };
  }

  return {
    status: 'up-to-date',
    latestVersion,
  };
}

async function checkUpstreamDiff({
  root = getUpstreamManifestRoot(),
  manifest = getUpstreamTrackingManifest(root),
  impactMap = getUpstreamImpactMap(root),
  upstreamVersions = null,
  fetchLatestVersion = createCratesIoFetcher(),
} = {}) {
  const errors = [];
  const entries = [];
  const manifestByName = new Map(manifest.map((item) => [item.dependencyName, item]));
  const impactByName = new Map(impactMap.map((item) => [item.name, item]));

  try {
    assertUpstreamImpactMap(root, impactMap);
  } catch (error) {
    errors.push(`Impact map validation failed: ${error.message}`);
    return {
      checkedAt: new Date().toISOString(),
      entries: [],
      errors,
    };
  }

  for (const impactEntry of impactMap) {
    const manifestEntry = manifestByName.get(impactEntry.name);
    if (!manifestEntry) {
      errors.push(`Impact map item ${impactEntry.name} has no matching upstream manifest entry`);
      continue;
    }
  }

  for (const manifestEntry of manifest) {
    if (!impactByName.has(manifestEntry.dependencyName)) {
      errors.push(`Missing impact map entry for ${manifestEntry.dependencyName}`);
      continue;
    }
  }

  if (errors.length > 0) {
    return {
      checkedAt: new Date().toISOString(),
      entries: [],
      errors,
    };
  }

  let versionResult = upstreamVersions;
  if (!versionResult) {
    versionResult = checkUpstreamVersions(root, manifest);
    if (versionResult.errors.length > 0) {
      errors.push(...versionResult.errors);
      return {
        checkedAt: new Date().toISOString(),
        entries,
        errors,
      };
    }
  }

  const versionsByDependency = new Map(
    versionResult.entries.map((item) => [item.dependencyName, item.currentVersion]),
  );
  for (const dependencyName of versionResult.checkedDependencies) {
    const impact = impactByName.get(dependencyName);
    const currentVersion = versionsByDependency.get(dependencyName);

    if (!impact) {
      errors.push(`Missing impact map entry for ${dependencyName}`);
      continue;
    }

    let status = 'unknown';
    let latestVersion = null;

    if (impact.kind === 'knowledge-source') {
      status = 'knowledge-source';
      latestVersion = null;
    } else {
      try {
        latestVersion = await Promise.resolve(fetchLatestVersion(dependencyName));
        const resolved = resolveStatus(currentVersion, latestVersion);
        status = resolved.status;
        latestVersion = resolved.latestVersion;
      } catch (error) {
        errors.push(`${dependencyName}: ${error.message}`);
        status = 'unknown';
        latestVersion = null;
      }
    }

    const summary = buildSummary(status, dependencyName, currentVersion, latestVersion, impact.source);

    entries.push({
      name: dependencyName,
      source: impact.source,
      kind: impact.kind,
      currentVersion: currentVersion || null,
      latestVersion,
      status,
      reviewScopeCount: impact.reviewScope.length,
      reviewScope: [...impact.reviewScope],
      summary,
      rationale: impact.rationale,
      requiredChecks: [...impact.requiredChecks],
    });
  }

  return {
    checkedAt: new Date().toISOString(),
    entries,
    errors,
  };
}

function printDiff(result) {
  for (const entry of result.entries) {
    if (entry.status === 'update-available') {
      console.log(`update-available ${entry.name} ${entry.currentVersion} -> ${entry.latestVersion}`);
    } else if (entry.status === 'up-to-date') {
      console.log(`up-to-date ${entry.name} ${entry.currentVersion}`);
    } else {
      console.log(`${entry.status} ${entry.name} ${entry.summary || ''}`.trim());
    }
  }

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(error);
    }
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const strict = args.has('--strict');
  const printMachineReadable = args.has('--json');

  const result = await checkUpstreamDiff();
  if (printMachineReadable) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }

  printDiff(result);

  if (strict && result.errors.length > 0) {
    return 1;
  }

  return 0;
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  });
}

module.exports = {
  checkUpstreamDiff,
  createCratesIoFetcher,
  printDiff,
  resolveStatus,
  buildSummary,
};

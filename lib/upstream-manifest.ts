const path = require('node:path');
const fs = require('node:fs');

const UPSTREAM_TRACKING_MANIFEST = Object.freeze([
  {
    upstreamName: 'pinocchio',
    dependencyName: 'pinocchio',
    description: 'Core pinocchio runtime',
    sources: [
      {
        sourceType: 'cargo',
        relativePath: 'Cargo.toml',
        section: 'dependencies',
        dependencyName: 'pinocchio',
        label: 'root-cargo/dependencies',
      },
      {
        sourceType: 'knowledge-table',
        relativePath: 'src/lib.rs',
        dependencyName: 'pinocchio',
        label: 'pinocchio-doc-table',
      },
    ],
  },
  {
    upstreamName: 'pinocchio-system',
    dependencyName: 'pinocchio-system',
    description: 'pinocchio-system helper crate',
    sources: [
      {
        sourceType: 'cargo',
        relativePath: 'Cargo.toml',
        section: 'dependencies',
        dependencyName: 'pinocchio-system',
        label: 'root-cargo/dependencies',
      },
      {
        sourceType: 'knowledge-table',
        relativePath: 'src/lib.rs',
        dependencyName: 'pinocchio-system',
        label: 'pinocchio-doc-table',
      },
    ],
  },
  {
    upstreamName: 'pinocchio-token',
    dependencyName: 'pinocchio-token',
    description: 'pinocchio-token helper crate',
    sources: [
      {
        sourceType: 'cargo',
        relativePath: 'Cargo.toml',
        section: 'dependencies',
        dependencyName: 'pinocchio-token',
        label: 'root-cargo/dependencies',
      },
      {
        sourceType: 'knowledge-table',
        relativePath: 'src/lib.rs',
        dependencyName: 'pinocchio-token',
        label: 'pinocchio-doc-table',
      },
    ],
  },
  {
    upstreamName: 'pinocchio-token-2022',
    dependencyName: 'pinocchio-token-2022',
    description: 'pinocchio-token-2022 helper crate',
    sources: [
      {
        sourceType: 'cargo',
        relativePath: 'Cargo.toml',
        section: 'dependencies',
        dependencyName: 'pinocchio-token-2022',
        label: 'root-cargo/dependencies',
      },
      {
        sourceType: 'knowledge-table',
        relativePath: 'src/lib.rs',
        dependencyName: 'pinocchio-token-2022',
        label: 'pinocchio-doc-table',
      },
    ],
  },
  {
    upstreamName: 'pinocchio-associated-token-account',
    dependencyName: 'pinocchio-associated-token-account',
    description: 'ATA helper crate',
    sources: [
      {
        sourceType: 'cargo',
        relativePath: 'Cargo.toml',
        section: 'dependencies',
        dependencyName: 'pinocchio-associated-token-account',
        label: 'root-cargo/dependencies',
      },
      {
        sourceType: 'knowledge-table',
        relativePath: 'src/lib.rs',
        dependencyName: 'pinocchio-associated-token-account',
        label: 'pinocchio-doc-table',
      },
    ],
  },
  {
    upstreamName: 'pinocchio-memo',
    dependencyName: 'pinocchio-memo',
    description: 'pinocchio-memo helper crate',
    sources: [
      {
        sourceType: 'cargo',
        relativePath: 'Cargo.toml',
        section: 'dependencies',
        dependencyName: 'pinocchio-memo',
        label: 'root-cargo/dependencies',
      },
      {
        sourceType: 'knowledge-table',
        relativePath: 'src/lib.rs',
        dependencyName: 'pinocchio-memo',
        label: 'pinocchio-doc-table',
      },
    ],
  },
  {
    upstreamName: 'pinocchio-log',
    dependencyName: 'pinocchio-log',
    description: 'pinocchio-log helper crate',
    sources: [
      {
        sourceType: 'cargo',
        relativePath: 'Cargo.toml',
        section: 'dependencies',
        dependencyName: 'pinocchio-log',
        label: 'root-cargo/dependencies',
      },
      {
        sourceType: 'knowledge-table',
        relativePath: 'src/lib.rs',
        dependencyName: 'pinocchio-log',
        label: 'pinocchio-doc-table',
      },
    ],
  },
  {
    upstreamName: 'pinocchio-pubkey',
    dependencyName: 'pinocchio-pubkey',
    description: 'pinocchio-pubkey helper crate',
    sources: [
      {
        sourceType: 'cargo',
        relativePath: 'Cargo.toml',
        section: 'dependencies',
        dependencyName: 'pinocchio-pubkey',
        label: 'root-cargo/dependencies',
      },
      {
        sourceType: 'knowledge-table',
        relativePath: 'src/lib.rs',
        dependencyName: 'pinocchio-pubkey',
        label: 'pinocchio-doc-table',
      },
    ],
  },
  {
    upstreamName: 'mollusk-svm',
    dependencyName: 'mollusk-svm',
    description: 'mollusk-svm example dependency',
    sources: [
      {
        sourceType: 'cargo',
        relativePath: 'examples/escrow/Cargo.toml',
        section: 'dev-dependencies',
        dependencyName: 'mollusk-svm',
        label: 'escrow-cargo/dev-dependencies',
      },
      {
        sourceType: 'knowledge-header',
        relativePath: 'src/testing/mollusk.rs',
        label: 'mollusk knowledge header',
      },
      {
        sourceType: 'knowledge-header',
        relativePath: 'src/testing/mod.rs',
        ecosystemName: 'mollusk-svm',
        label: 'testing verified-against',
      },
    ],
  },
  {
    upstreamName: 'litesvm',
    dependencyName: 'litesvm',
    description: 'litesvm knowledge doc source',
    sources: [
      {
        sourceType: 'knowledge-header',
        relativePath: 'src/testing/litesvm.rs',
        label: 'litesvm knowledge header',
      },
      {
        sourceType: 'knowledge-header',
        relativePath: 'src/testing/mod.rs',
        ecosystemName: 'litesvm',
        label: 'testing verified-against',
      },
      {
        sourceType: 'knowledge-table',
        relativePath: 'src/lib.rs',
        dependencyName: 'litesvm',
        label: 'src/lib.rs ecosystem matrix',
      },
    ],
  },
]);

const ALLOWED_SOURCE_TYPES = Object.freeze([
  'cargo',
  'cargo-lock',
  'knowledge-header',
  'knowledge-table',
]);

function getUpstreamManifestRoot() {
  return path.resolve(__dirname, '..');
}

function getUpstreamTrackingManifest(root = getUpstreamManifestRoot()) {
  return UPSTREAM_TRACKING_MANIFEST.map((item) => ({
    ...item,
    sources: item.sources.map((source) => ({
      ...source,
      sourcePath: path.join(root, source.relativePath),
    })),
  }));
}

function assertUpstreamTrackingManifest(
  root = getUpstreamManifestRoot(),
  manifest = getUpstreamTrackingManifest(root),
) {
  const names = new Set();

  for (const item of manifest) {
    if (!item.upstreamName) {
      throw new Error(`Upstream manifest entry missing upstreamName: ${item.dependencyName}`);
    }
    if (!item.dependencyName) {
      throw new Error(`Upstream manifest entry missing dependencyName for ${item.upstreamName}`);
    }
    if (names.has(item.dependencyName)) {
      throw new Error(`Duplicate dependency in upstream manifest: ${item.dependencyName}`);
    }

    names.add(item.dependencyName);

    if (!Array.isArray(item.sources) || item.sources.length === 0) {
      throw new Error(
        `Upstream manifest entry missing sources: ${item.dependencyName} (${item.upstreamName})`,
      );
    }

    for (const source of item.sources) {
      if (!ALLOWED_SOURCE_TYPES.includes(source.sourceType)) {
        throw new Error(
          `Unsupported source type ${source.sourceType} in ${item.dependencyName} (${item.upstreamName})`,
        );
      }

      if (path.isAbsolute(source.relativePath)) {
        throw new Error(`Source path must be relative: ${source.relativePath}`);
      }
      if (source.relativePath.includes('\\')) {
        throw new Error(`Source path must use POSIX separators: ${source.relativePath}`);
      }
      if (!fs.existsSync(source.sourcePath)) {
        throw new Error(`Missing source file: ${source.relativePath}`);
      }
    }
  }
}

module.exports = {
  ALLOWED_SOURCE_TYPES,
  UPSTREAM_TRACKING_MANIFEST,
  assertUpstreamTrackingManifest,
  getUpstreamManifestRoot,
  getUpstreamTrackingManifest,
};

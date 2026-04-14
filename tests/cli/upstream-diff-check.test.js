const assert = require('node:assert/strict');
const test = require('node:test');

const { checkUpstreamDiff, resolveStatus } = require('../../lib/upstream-diff-check');
const { getUpstreamTrackingManifest, getUpstreamManifestRoot } = require('../../lib/upstream-manifest');
const { getUpstreamImpactMap } = require('../../lib/upstream-impact-map');

const repoRoot = getUpstreamManifestRoot();
const fullManifest = getUpstreamTrackingManifest(repoRoot);
const fullImpactMap = getUpstreamImpactMap(repoRoot);

test('resolveStatus classifies up-to-date versions', () => {
  assert.equal(resolveStatus('0.11.1', '0.11.1').status, 'up-to-date');
  assert.equal(resolveStatus('0.11.2', '0.11.1').status, 'up-to-date');
});

test('checkUpstreamDiff returns up-to-date summary when current matches latest', async () => {
  const result = await checkUpstreamDiff({
    manifest: fullManifest,
    impactMap: fullImpactMap,
    upstreamVersions: {
      checkedDependencies: ['pinocchio'],
      entries: [{ dependencyName: 'pinocchio', currentVersion: '0.11.1' }],
    },
    fetchLatestVersion: async () => '0.11.1',
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].status, 'up-to-date');
  assert.equal(result.entries[0].currentVersion, '0.11.1');
  assert.equal(result.entries[0].latestVersion, '0.11.1');
  assert.equal(result.entries[0].summary, 'pinocchio 0.11.1');
});

test('checkUpstreamDiff reports update-available when newer crates.io version exists', async () => {
  const result = await checkUpstreamDiff({
    manifest: fullManifest,
    impactMap: fullImpactMap,
    upstreamVersions: {
      checkedDependencies: ['pinocchio'],
      entries: [{ dependencyName: 'pinocchio', currentVersion: '0.11.0' }],
    },
    fetchLatestVersion: async () => '0.11.1',
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.entries[0].status, 'update-available');
  assert.equal(result.entries[0].summary, 'pinocchio 0.11.0 -> 0.11.1');
  assert.equal(result.entries[0].latestVersion, '0.11.1');
});

test('checkUpstreamDiff marks knowledge source dependencies without crates.io query', async () => {
  let called = 0;

  const result = await checkUpstreamDiff({
    manifest: fullManifest,
    impactMap: fullImpactMap,
    upstreamVersions: {
      checkedDependencies: ['litesvm'],
      entries: [{ dependencyName: 'litesvm', currentVersion: '0.11' }],
    },
    fetchLatestVersion: () => {
      called += 1;
      return Promise.reject(new Error('unexpected crate lookup'));
    },
  });

  assert.deepEqual(result.errors, []);
  assert.equal(called, 0);
  assert.equal(result.entries[0].status, 'knowledge-source');
  assert.equal(result.entries[0].latestVersion, null);
  assert.equal(result.entries[0].summary, 'litesvm tracked via docs source: src/testing/litesvm.rs');
});

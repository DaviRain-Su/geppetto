const assert = require('node:assert/strict');
const test = require('node:test');

const {
  UPSTREAM_IMPACT_MAP,
  assertUpstreamImpactMap,
  getUpstreamImpactMap,
} = require('../../lib/upstream-impact-map');
const {
  getUpstreamTrackingManifest,
  getUpstreamManifestRoot,
} = require('../../lib/upstream-manifest');

const repoRoot = getUpstreamManifestRoot();

test('impact map has a complete and valid record for every tracked upstream dependency', () => {
  assert.doesNotThrow(() => assertUpstreamImpactMap(repoRoot, getUpstreamImpactMap(repoRoot)));

  const impactNames = new Set(UPSTREAM_IMPACT_MAP.map((entry) => entry.name));
  const manifestNames = new Set(getUpstreamTrackingManifest(repoRoot).map((entry) => entry.dependencyName));

  assert.equal(impactNames.size, manifestNames.size, 'all upstream dependencies should have impact records');
  for (const name of manifestNames) {
    assert.equal(impactNames.has(name), true, `missing impact map for ${name}`);
  }
});

import assert from 'node:assert/strict'
import test from 'node:test'

const {
  UPSTREAM_IMPACT_MAP,
  assertUpstreamImpactMap,
  getUpstreamImpactMap,
} = require('../../lib/upstream-impact-map')
const {
  getUpstreamManifestRoot,
  getUpstreamTrackingManifest,
} = require('../../lib/upstream-manifest')

const repoRoot = getUpstreamManifestRoot()

test('impact map has a complete and valid record for every tracked upstream dependency', () => {
  assert.doesNotThrow(() => assertUpstreamImpactMap(repoRoot, getUpstreamImpactMap(repoRoot)))

  const impactNames = new Set(
    UPSTREAM_IMPACT_MAP.map((entry: { name: string }) => entry.name),
  )
  const manifestNames = new Set(
    getUpstreamTrackingManifest(repoRoot).map((entry: { dependencyName: string }) => entry.dependencyName),
  )

  assert.equal(impactNames.size, manifestNames.size, 'all upstream dependencies should have impact records')
  for (const name of manifestNames) {
    assert.equal(impactNames.has(name), true, `missing impact map for ${name}`)
  }
})

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildPrTemplate,
  buildUpdateTable,
  buildSummaryStats,
  buildRequiredChecks,
  buildReviewItems,
} = require('../../lib/upstream-pr-template');

const sampleResult = {
  checkedAt: '2026-04-14T12:00:00Z',
  entries: [
    {
      name: 'pinocchio',
      source: 'Cargo.toml',
      kind: 'runtime-sdk',
      currentVersion: '0.11.0',
      latestVersion: '0.11.2',
      status: 'update-available',
      summary: 'pinocchio 0.11.0 -> 0.11.2',
      rationale: 'Core SDK change can impact account model and CPI helpers.',
      reviewScope: ['src/schema.rs', 'src/guard.rs'],
      requiredChecks: ['cargo test --all-features --locked', 'npm run docs:check'],
    },
    {
      name: 'litesvm',
      source: 'src/testing/litesvm.rs',
      kind: 'knowledge-source',
      currentVersion: '0.11',
      latestVersion: null,
      status: 'knowledge-source',
      summary: 'litesvm tracked via docs source: src/testing/litesvm.rs',
      rationale: 'Docs/source tracker only.',
      reviewScope: ['src/testing/litesvm.rs'],
      requiredChecks: ['npm run docs:check'],
    },
  ],
  errors: ['sample-check failed'],
};

test('buildPrTemplate includes update table and merge policy', () => {
  const body = buildPrTemplate(sampleResult);
  assert.match(body, /# chore: upstream dependency refresh \(1\)/);
  assert.match(body, /| pinocchio | \[0.11.0\]\(https:\/\/crates.io\/crates\/pinocchio\) | 0.11.2 | update-available |/);
  assert.match(body, /## Merge Policy/);
  assert.match(body, /Do not auto-merge/);
  assert.match(body, /Requires manual review/);
});

test('buildUpdateTable uses markdown crates links', () => {
  const text = buildUpdateTable(sampleResult.entries);
  assert.match(text, /\| pinocchio \| \[0.11.0\]\(https:\/\/crates.io\/crates\/pinocchio\) \| 0.11.2 \| update-available \| runtime-sdk \|/);
  assert.match(text, /\| litesvm \| \[0.11\]\(https:\/\/crates.io\/crates\/litesvm\) \| - \| knowledge-source \| knowledge-source \|/);
});

test('buildSummaryStats and checks render sections', () => {
  const stats = buildSummaryStats(sampleResult.entries);
  assert.match(stats, /⬆️ update-available: 1/);
  assert.match(stats, /ℹ️ knowledge-source: 1/);

  const checks = buildRequiredChecks(sampleResult.entries);
  assert.match(checks, /cargo test --all-features --locked/);
  assert.match(checks, /npm run docs:check/);
});

test('buildReviewItems includes rationale and file scope', () => {
  const body = buildReviewItems(sampleResult.entries);
  assert.match(body, /### pinocchio/);
  assert.match(body, /Core SDK change can impact/);
  assert.match(body, /- Review Scope:/);
  assert.match(body, /src\/schema.rs/);
});

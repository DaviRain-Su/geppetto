#!/usr/bin/env node

const fs = require('node:fs');

const { checkUpstreamDiff } = require('./upstream-diff-check');

function parseArgs(argv) {
  const fromJsonIndex = argv.indexOf('--from-json');
  const fromJson = fromJsonIndex >= 0 ? argv[fromJsonIndex + 1] : null;

  return { fromJson };
}

async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const input = Buffer.concat(chunks).toString('utf8').trim();
  if (!input) {
    return null;
  }

  return JSON.parse(input);
}

function loadResultFromFile(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return JSON.parse(raw);
}

function normalizeForMarkdown(value) {
  if (value == null) {
    return '-';
  }

  return String(value);
}

function statusBadge(status) {
  const labels = {
    'update-available': '⬆️ update-available',
    'up-to-date': '✅ up-to-date',
    unknown: '⚠️ unknown',
    'knowledge-source': 'ℹ️ knowledge-source',
  };

  return labels[status] || `❓ ${normalizeForMarkdown(status)}`;
}

function buildHeader({ checkedAt, entries }) {
  const updateCount = entries.filter((entry) => entry.status === 'update-available').length;
  const titlePrefix = updateCount > 0 ? `chore: upstream dependency refresh (${updateCount})` : 'chore: upstream dependency audit';

  return `# ${titlePrefix}\n\n` +
    `Generated at: **${checkedAt || 'unknown'}**\n` +
    `Scanned dependencies: **${entries.length}**\n`;
}

function buildSummaryStats(entries) {
  const statuses = ['update-available', 'up-to-date', 'knowledge-source', 'unknown'];
  const counts = statuses
    .map((status) => ({ status, count: entries.filter((entry) => entry.status === status).length }))
    .filter((item) => item.count > 0);

  const lines = counts.map((item) => `- ${statusBadge(item.status)}: ${item.count}`).join('\n');
  return `## Status\n${lines}\n`;
}

function buildUpdateTable(entries) {
  const rows = entries.map((entry) => {
    const latest = normalizeForMarkdown(entry.latestVersion);
    const current = normalizeForMarkdown(entry.currentVersion);
    const source = normalizeForMarkdown(entry.source);
    const kind = normalizeForMarkdown(entry.kind);
    const cratesLink = `https://crates.io/crates/${encodeURIComponent(entry.name)}`;
    return `| ${entry.name} | [${current}](${cratesLink}) | ${latest} | ${entry.status} | ${kind} | ${source} | ${normalizeForMarkdown(entry.summary)} |`;
  });

  return [
    '## Dependency Matrix',
    '| Name | Current | Latest | Status | Kind | Source | Summary |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

function buildReviewItems(entries) {
  if (entries.length === 0) {
    return ''; // keep concise when no updates/targets
  }

  const lines = ['## Review Scope', ''];

  for (const entry of entries) {
    lines.push(`### ${entry.name}`);
    lines.push(`- Kind: ${normalizeForMarkdown(entry.kind)}`);
    if (entry.rationale) {
      lines.push(`- Rationale: ${entry.rationale}`);
    }

    if (entry.reviewScope && entry.reviewScope.length > 0) {
      lines.push('- Review Scope:');
      for (const item of entry.reviewScope) {
        lines.push(`  - ${item}`);
      }
    }

    if (entry.requiredChecks && entry.requiredChecks.length > 0) {
      lines.push('- Required Checks:');
      for (const check of entry.requiredChecks) {
        lines.push(`  - \`${check}\``);
      }
    }

    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function buildRequiredChecks(entries) {
  const checks = new Set();
  for (const entry of entries) {
    for (const check of entry.requiredChecks || []) {
      checks.add(check);
    }
  }

  if (checks.size === 0) {
    return '';
  }

  return `## Required Validations\n\n${[...checks].map((check) => `- [ ] ${check}`).join('\n')}\n`;
}

function buildErrors(errors) {
  if (!errors || errors.length === 0) {
    return '';
  }

  return [
    '## Errors',
    'Detected issues during audit:',
    ...errors.map((error) => `- ${error}`),
    '',
  ].join('\n');
}

function buildMergePolicy() {
  return [
    '## Merge Policy',
    '- Do not auto-merge. Requires manual review and signoff.',
    '- If any dependency is marked `update-available`, validate all scoped modules before merging.',
    '',
  ].join('\n');
}

function buildPrTemplate(result) {
  const entries = Array.isArray(result.entries) ? result.entries : [];

  const sections = [
    buildHeader(result),
    buildSummaryStats(entries),
    buildUpdateTable(entries),
    buildReviewItems(entries),
    buildRequiredChecks(entries),
    buildErrors(result.errors || []),
    buildMergePolicy(),
  ];

  return sections.filter(Boolean).join('\n');
}

async function main() {
  const { fromJson } = parseArgs(process.argv.slice(2));
  let result = null;

  if (fromJson) {
    result = loadResultFromFile(fromJson);
  } else if (!process.stdin.isTTY) {
    result = await readStdin();
  } else {
    result = await checkUpstreamDiff();
  }

  if (!result || typeof result !== 'object') {
    process.stderr.write('Unable to read upstream diff result\n');
    process.exit(1);
  }

  process.stdout.write(buildPrTemplate(result));
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  buildPrTemplate,
  buildUpdateTable,
  buildSummaryStats,
  buildRequiredChecks,
  buildReviewItems,
};

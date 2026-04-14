#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_CHECKLIST_PATH = path.join('docs', '13-e7-04-send-window-checklist.md');

function normalizeDecision(raw) {
  const value = String(raw || '').toLowerCase().replace(/`/g, '').trim();

  if (/(send|发送)\s*now/.test(value) || /sendnow/.test(value)) {
    return 'send-now';
  }

  if (value.includes('hold') || value.includes('待') || value.includes('暂缓')) {
    return 'hold';
  }

  return 'unknown';
}

function parseChecklistText(content) {
  const decisionMatch = content.match(/决策[:：]\s*`?([^\n`]+)`?/);
  const decision = normalizeDecision(decisionMatch ? decisionMatch[1] : '');

  const lines = content.split(/\r?\n/);
  const conditions = [];
  let inConditionSection = false;

  for (const line of lines) {
    if (/^##\s*发送前必需条件/.test(line)) {
      inConditionSection = true;
      continue;
    }

    if (inConditionSection && /^##\s+/.test(line)) {
      inConditionSection = false;
      continue;
    }

    if (!inConditionSection) {
      continue;
    }

    const match = line.match(/^\s*-\s*\[([xX ])\]\s*(.+)/);
    if (match) {
      conditions.push({
        label: match[2].trim(),
        checked: match[1].toLowerCase() === 'x',
      });
    }
  }

  const uncheckedConditions = conditions.filter((condition) => !condition.checked);

  return {
    decision,
    conditions,
    uncheckedConditions,
  };
}

function getGitWorkingTreeState(cwd, options = {}) {
  if (typeof options.gitStatusText === 'string') {
    const statusText = options.gitStatusText || '';
    return {
      clean: statusText.trim().length === 0,
      statusText,
    };
  }

  const result = spawnSync('git', ['status', '--short'], {
    cwd,
    encoding: 'utf8',
  });

  if (result.status !== 0 || result.error) {
    const details = result.error ? ` (${result.error.message})` : '';
    throw new Error(`Failed to read git status with status ${result.status}${details}`);
  }

  const statusText = result.stdout || '';
  return {
    clean: statusText.trim().length === 0,
    statusText,
  };
}

function buildReadinessPlan(options = {}) {
  const {
    checklistPath = path.join(process.cwd(), DEFAULT_CHECKLIST_PATH),
    cwd = process.cwd(),
    strict = false,
    gitStatusText = undefined,
  } = options;

  const checklistText = fs.readFileSync(path.resolve(cwd, checklistPath), 'utf8');
  const parsed = parseChecklistText(checklistText);
  const checks = [...parsed.conditions];
  let canSendNow = parsed.decision === 'send-now' && parsed.uncheckedConditions.length === 0;
  const plan = {
    checklistPath,
    decision: parsed.decision,
    conditions: checks,
    uncheckedConditions: parsed.uncheckedConditions,
    sendConditionCount: checks.length,
    checkedSendConditionCount: checks.filter((condition) => condition.checked).length,
    canSendNow,
  };

  if (parsed.decision === 'send-now') {
    const gitState = getGitWorkingTreeState(cwd, { gitStatusText });
    plan.workingTreeClean = gitState.clean;
    plan.gitStatus = gitState.statusText.trim();
    canSendNow = canSendNow && gitState.clean;
    plan.canSendNow = canSendNow;
    if (strict && !canSendNow) {
      throw new Error('send-now readiness check failed: pre-send conditions or working tree cleanliness are not satisfied');
    }
    return plan;
  }

  plan.canSendNow = canSendNow;
  return plan;
}

function printPlan(plan) {
  const checked = plan.checkedSendConditionCount || 0;
  const total = plan.sendConditionCount || 0;
  console.log(`E7 decision: ${plan.decision}`);
  console.log(`Send checklist: ${checked}/${total} checked`);

  if (plan.decision === 'hold') {
    console.log('E7 hold is active; external send is intentionally delayed.');
    return;
  }

  if (!plan.canSendNow) {
    console.log('E7 send now is not ready. Unchecked conditions:');
    for (const condition of plan.uncheckedConditions) {
      console.log(`- ${condition.label}`);
    }
    return;
  }

  if (plan.workingTreeClean === false) {
    console.log('Working tree is not clean. Stage or revert local changes before sending.');
    return;
  }

  console.log('E7 send-now gate is clear.');
}

function parseArgv(argv) {
  const args = { strict: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--strict') {
      args.strict = true;
      continue;
    }

    if (arg === '--json') {
      args.json = true;
      continue;
    }

    if (arg === '--checklist') {
      if (i + 1 >= argv.length) {
        args.error = 'Expected path after --checklist';
        return args;
      }

      args.checklistPath = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--help') {
      args.help = true;
      return args;
    }

    args.error = `Unexpected arguments: ${arg}`;
    return args;
  }

  return args;
}

function printUsage(stream) {
  stream.write('Usage: node ./lib/e7-readiness-check.js [--json] [--strict] [--checklist path]\n');
  stream.write('Checks E7 send readiness notes from docs/13 and optional git cleanliness for send-now.\n');
}

function main(argv = process.argv.slice(2), io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const args = parseArgv(argv);

  if (args.help) {
    printUsage(stdout);
    return 0;
  }

  if (args.error) {
    stderr.write(`${args.error}\n`);
    printUsage(stderr);
    return 1;
  }

  try {
    const plan = buildReadinessPlan({
      checklistPath: args.checklistPath || DEFAULT_CHECKLIST_PATH,
      strict: args.strict,
      cwd: io.cwd || process.cwd(),
      gitStatusText: args.gitStatusText,
    });

    if (args.json) {
      stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    } else {
      printPlan(plan);
    }

    return 0;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  buildReadinessPlan,
  parseChecklistText,
  normalizeDecision,
  getGitWorkingTreeState,
};

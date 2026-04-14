#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const {
  buildReadinessPlan,
  parseChecklistText,
} = require('./e7-readiness-check');

const DEFAULT_ACTION_PLAN_PATH = path.join('docs', '11-e7-02-create-solana-dapp-action-plan.md');
const DEFAULT_DISCUSSION_DRAFT_PATH = path.join('docs', '12-e7-03-create-solana-dapp-discussion-draft.md');
const DEFAULT_CHECKLIST_PATH = path.join('docs', '13-e7-04-send-window-checklist.md');

function parseActionPlanText(content) {
  const repoMatch = content.match(/目标仓库.*[:：]\s*`([^`]+)`/);
  const actionTypeMatch = content.match(/(?:动作类型|Action Type).*[:：]\s*`([^`]+)`/i)
    || content.match(/(?:唯一动作类型).*[:：]\s*`([^`]+)`/);
  const decisionMatch = content.match(/决策：\*\*([^*]+)\*\*/);
  const prTitleMatch = content.match(/拟议 PR 标题.*[:：]\s*\n\s*[-*]\s*`([^`]+)`/i);
  const filesSection = content.match(/预期修改文件.*[:：]\s*\n((?:\s*[-*]\s*`[^`]+`\s*\n?)+)/m);
  const files = filesSection ? filesSection[1]
    .split('\n')
    .filter((line) => /^\s*[-*]\s*`/.test(line))
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .map((line) => line.replace(/`/g, ''))
    .filter(Boolean) : [];

  return {
    repository: repoMatch ? repoMatch[1].trim() : 'unknown',
    actionType: actionTypeMatch ? actionTypeMatch[1].trim() : 'unknown',
    decision: decisionMatch ? decisionMatch[1].trim() : 'unknown',
    prTitle: prTitleMatch ? prTitleMatch[1].trim() : 'unknown',
    expectedFiles: files,
  };
}

function parseDiscussionTitle(content) {
  const match = content.match(/##\s*Recommended Discussion Title\s*\n+\*{2}([^*]+)\*{2}/i)
    || content.match(/##\s*推荐讨论标题\s*\n+\*{2}([^*]+)\*{2}/i);
  if (match) {
    return match[1].trim();
  }

  return null;
}

function parseArgv(argv) {
  const args = { strict: false, json: false, validateOnly: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      args.json = true;
      continue;
    }

    if (arg === '--strict') {
      args.strict = true;
      continue;
    }

    if (arg === '--validate-only') {
      args.validateOnly = true;
      continue;
    }

    if (arg === '--out') {
      if (i + 1 >= argv.length) {
        args.error = 'Expected output path after --out';
        return args;
      }

      args.out = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--plan') {
      if (i + 1 >= argv.length) {
        args.error = 'Expected path after --plan';
        return args;
      }

      args.plan = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--draft') {
      if (i + 1 >= argv.length) {
        args.error = 'Expected path after --draft';
        return args;
      }

      args.draft = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--checklist') {
      if (i + 1 >= argv.length) {
        args.error = 'Expected path after --checklist';
        return args;
      }

      args.checklist = argv[i + 1];
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

  if (args.validateOnly && args.strict) {
    args.error = '--validate-only cannot be used with --strict';
    return args;
  }

  return args;
}

function printUsage(stream) {
  stream.write('Usage: node ./lib/e7-delivery-packet.js [--json] [--strict] [--validate-only] [--out path]\n');
  stream.write('Builds a compact external-delivery packet from E7 docs.\n');
}

function normalizeDate(value) {
  return value || new Date().toISOString();
}

function validateActionPlanSchema(content, parsed) {
  const errors = [];

  if (!/^##\s*1\.\s*目标仓库/m.test(content)) {
    errors.push('missing section "## 1. 目标仓库"');
  }

  if (parsed.repository === 'unknown') {
    errors.push('missing field "目标仓库"');
  }

  if (parsed.actionType === 'unknown') {
    errors.push('missing field "动作类型/唯一动作类型"');
  }

  if (parsed.decision === 'unknown') {
    errors.push('missing field "决策"');
  }

  if (parsed.prTitle === 'unknown') {
    errors.push('missing field "拟议 PR 标题"');
  }

  if (parsed.expectedFiles.length === 0) {
    errors.push('missing list "预期修改文件"');
  }

  return errors;
}

function validateChecklistSchema(content, parsed) {
  const errors = [];

  if (!/^##\s*发送状态/m.test(content)) {
    errors.push('missing section "## 发送状态"');
  }

  if (!/^##\s*发送前必需条件/m.test(content)) {
    errors.push('missing section "## 发送前必需条件"');
  }

  if (parsed.decision === 'unknown') {
    errors.push('missing or invalid "决策" value');
  }

  if (parsed.conditions.length === 0) {
    errors.push('missing checklist items under "发送前必需条件"');
  }

  return errors;
}

function assertDeliveryPacketSchema(input) {
  const actionErrors = validateActionPlanSchema(input.planContent, input.plan);
  const checklistErrors = validateChecklistSchema(input.checklistContent, input.checklist);
  const errors = [
    ...actionErrors.map((item) => `action plan: ${item}`),
    ...checklistErrors.map((item) => `checklist: ${item}`),
  ];

  if (errors.length > 0) {
    throw new Error(`Delivery packet schema validation failed:\n- ${errors.join('\n- ')}`);
  }
}

function resolveInputPaths(options = {}) {
  const cwd = options.cwd || process.cwd();
  const planPath = path.join(
    options.cwd || process.cwd(),
    options.plan || DEFAULT_ACTION_PLAN_PATH,
  );
  const draftPath = path.join(
    options.cwd || process.cwd(),
    options.draft || DEFAULT_DISCUSSION_DRAFT_PATH,
  );
  const checklistPath = path.join(
    options.cwd || process.cwd(),
    options.checklist || DEFAULT_CHECKLIST_PATH,
  );

  return {
    cwd,
    planPath,
    draftPath,
    checklistPath,
  };
}

function loadDeliveryInputs(options = {}) {
  const paths = resolveInputPaths(options);
  const planContent = fs.readFileSync(paths.planPath, 'utf8');
  const draftContent = fs.readFileSync(paths.draftPath, 'utf8');
  const checklistContent = fs.readFileSync(paths.checklistPath, 'utf8');
  const plan = parseActionPlanText(planContent);
  const checklist = parseChecklistText(checklistContent);

  return {
    ...paths,
    planContent,
    draftContent,
    checklistContent,
    plan,
    checklist,
  };
}

function validateDeliveryPacketInputs(options = {}) {
  const input = loadDeliveryInputs(options);
  assertDeliveryPacketSchema({
    planContent: input.planContent,
    checklistContent: input.checklistContent,
    plan: input.plan,
    checklist: input.checklist,
  });

  return {
    validatedAt: normalizeDate(options.validatedAt),
    ok: true,
    decision: input.checklist.decision,
    conditions: input.checklist.conditions.length,
    sources: {
      actionPlan: path.relative(input.cwd, path.resolve(input.planPath)),
      discussionDraft: path.relative(input.cwd, path.resolve(input.draftPath)),
      sendChecklist: path.relative(input.cwd, path.resolve(input.checklistPath)),
    },
  };
}

function buildDeliveryPacket(options = {}) {
  const input = loadDeliveryInputs(options);
  const {
    cwd,
    planPath,
    draftPath,
    checklistPath,
    draftContent,
    checklistContent,
    plan,
    checklist,
    planContent,
  } = input;

  assertDeliveryPacketSchema({
    planContent,
    checklistContent,
    plan,
    checklist,
  });

  const readiness = buildReadinessPlan({
    checklistPath,
    strict: options.strict || false,
    cwd,
    gitStatusText: options.gitStatusText,
  });
  const discussionTitle = parseDiscussionTitle(draftContent);

  return {
    generatedAt: normalizeDate(options.generatedAt),
    repository: plan.repository,
    actionType: plan.actionType,
    decision: plan.decision,
    summary: {
      sendNowGate: readiness.canSendNow,
      totalSendConditions: checklist.conditions.length,
      checkedSendConditions: checklist.conditions.filter((condition) => condition.checked).length,
      uncheckedSendConditions: checklist.uncheckedConditions.map((condition) => condition.label),
      workingTreeClean: readiness.workingTreeClean,
      gitStatus: readiness.gitStatus,
    },
    expectedFiles: plan.expectedFiles,
    prTitle: plan.prTitle,
    discussionTitle,
    sources: {
      actionPlan: path.relative(cwd, path.resolve(planPath)),
      discussionDraft: path.relative(cwd, path.resolve(draftPath)),
      sendChecklist: path.relative(cwd, path.resolve(checklistPath)),
    },
  };
}

function printPacket(packet) {
  console.log(`E7 delivery packet for ${packet.repository}`);
  console.log(`Action type: ${packet.actionType}`);
  console.log(`Decision: ${packet.decision}`);
  console.log(`Send gate: ${packet.summary.sendNowGate ? 'ready' : 'not-ready'}`);
  console.log(`Conditions: ${packet.summary.checkedSendConditions}/${packet.summary.totalSendConditions} checked`);
  if (!packet.summary.sendNowGate) {
    console.log('Unchecked conditions:');
    for (const condition of packet.summary.uncheckedSendConditions) {
      console.log(`- ${condition}`);
    }
  }

  if (packet.summary.workingTreeClean === false) {
    console.log('Working tree has uncommitted changes:');
    console.log(packet.summary.gitStatus);
  }
}

function printValidationSuccess(stream) {
  stream.write('delivery packet schema ok\n');
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
    if (args.validateOnly) {
      const result = validateDeliveryPacketInputs({
        plan: args.plan,
        draft: args.draft,
        checklist: args.checklist,
        cwd: io.cwd || process.cwd(),
      });

      if (args.json) {
        stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        printValidationSuccess(stdout);
      }

      if (args.out) {
        fs.writeFileSync(args.out, JSON.stringify(result, null, 2), 'utf8');
        console.log(`Delivery packet written to ${args.out}`);
      }

      return 0;
    }

    const packet = buildDeliveryPacket({
      plan: args.plan,
      draft: args.draft,
      checklist: args.checklist,
      strict: args.strict,
      gitStatusText: args.gitStatusText,
      cwd: io.cwd || process.cwd(),
    });

    if (args.json) {
      stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
    } else {
      printPacket(packet);
    }

    if (args.out) {
      fs.writeFileSync(args.out, JSON.stringify(packet, null, 2), 'utf8');
      console.log(`Delivery packet written to ${args.out}`);
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
  assertDeliveryPacketSchema,
  buildDeliveryPacket,
  loadDeliveryInputs,
  validateDeliveryPacketInputs,
  parseActionPlanText,
  parseDiscussionTitle,
  parseArgv,
  resolveInputPaths,
  validateActionPlanSchema,
  validateChecklistSchema,
};

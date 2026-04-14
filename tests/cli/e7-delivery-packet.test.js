const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  assertDeliveryPacketSchema,
  buildDeliveryPacket,
  parseActionPlanText,
  parseDiscussionTitle,
  validateActionPlanSchema,
  validateChecklistSchema,
} = require('../../lib/e7-delivery-packet');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-e8-'));
}

function removeDir(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
}

function writeFixtures(directory, override = {}) {
  const docsDir = path.join(directory, 'docs');
  fs.mkdirSync(docsDir, { recursive: true });

  const actionPlan = override.actionPlan || `
# E7-02 Action Plan

## 1. 目标仓库

- **目标仓库**：\`create-solana-dapp\`
- **唯一动作类型**：\`docs\`
- **预期修改文件**：
  - \`README.md\`
  - \`docs/setup.md\`
- **拟议 PR 标题**：
  - \`docs: add minimal Geppetto onboarding guidance\`

### 6.2 决策

- 决策：**Hold（待外部发送窗口确认）**
`;

  const draft = override.draft || `
# E7-03 Discussion Draft

## Recommended Discussion Title

**Proposal: lightweight Geppetto integration**
`;

  const checklist = override.checklist || `
## 发送状态

- 决策：\`Send now\`

## 发送前必需条件
- [x] docs pass
- [x] release pass
`;

  fs.writeFileSync(path.join(docsDir, '11-e7-02-create-solana-dapp-action-plan.md'), actionPlan);
  fs.writeFileSync(path.join(docsDir, '12-e7-03-create-solana-dapp-discussion-draft.md'), draft);
  fs.writeFileSync(path.join(docsDir, '13-e7-04-send-window-checklist.md'), checklist);
}

test('parseActionPlanText reads repository/action/expected files', () => {
  const parsed = parseActionPlanText(`
# E7-02

- **目标仓库**：\`create-solana-dapp\`
- **动作类型**：\`docs\`
- **预期修改文件**：
  - \`README.md\`
  - \`docs/notes.md\`
- **拟议 PR 标题**：
  - \`docs: add ...\`

### 发送决策
- 决策：**Hold**
`);

  assert.equal(parsed.repository, 'create-solana-dapp');
  assert.equal(parsed.actionType, 'docs');
  assert.equal(parsed.expectedFiles.length, 2);
  assert.equal(parsed.prTitle, 'docs: add ...');
  assert.equal(parsed.decision, 'Hold');
});

test('parseDiscussionTitle reads proposal title', () => {
  const title = parseDiscussionTitle(`
## Recommended Discussion Title

**Proposal: lightweight Geppetto agent guidance**
`);

  assert.equal(title, 'Proposal: lightweight Geppetto agent guidance');
});

test('buildDeliveryPacket includes ready-to-send summary', () => {
  const tempDir = createTempDir();

  try {
    writeFixtures(tempDir);

    const packet = buildDeliveryPacket({
      cwd: tempDir,
      strict: true,
      gitStatusText: '',
    });

    assert.equal(packet.repository, 'create-solana-dapp');
    assert.equal(packet.actionType, 'docs');
    assert.equal(packet.summary.sendNowGate, true);
    assert.equal(packet.summary.totalSendConditions, 2);
    assert.equal(packet.summary.uncheckedSendConditions.length, 0);
    assert.equal(packet.summary.workingTreeClean, true);
    assert.equal(packet.discussionTitle, 'Proposal: lightweight Geppetto integration');
  } finally {
    removeDir(tempDir);
  }
});

test('buildDeliveryPacket fails strict when send-now preconditions missing', () => {
  const tempDir = createTempDir();

  try {
    writeFixtures(tempDir, {
      checklist: `
## 发送状态

- 决策：\`Send now\`

## 发送前必需条件
- [x] docs pass
- [ ] release pass
`,
    });

    assert.throws(() => {
      buildDeliveryPacket({
        cwd: tempDir,
        strict: true,
        gitStatusText: '',
      });
    }, /pre-send conditions/);
  } finally {
    removeDir(tempDir);
  }
});

test('buildDeliveryPacket reports working tree dirty for send-now with strict=false', () => {
  const tempDir = createTempDir();

  try {
    writeFixtures(tempDir);

    const packet = buildDeliveryPacket({
      cwd: tempDir,
      strict: false,
      gitStatusText: 'M  README.md',
    });

    assert.equal(packet.summary.sendNowGate, false);
    assert.equal(packet.summary.workingTreeClean, false);
    assert.equal(packet.summary.gitStatus, 'M  README.md');
  } finally {
    removeDir(tempDir);
  }
});

test('validateActionPlanSchema reports missing required fields', () => {
  const content = `
# E7-02 Action Plan

## 1. 目标仓库

- **目标仓库**：\`create-solana-dapp\`
`;

  const parsed = parseActionPlanText(content);
  const errors = validateActionPlanSchema(content, parsed);

  assert.ok(errors.some((item) => item.includes('动作类型')));
  assert.ok(errors.some((item) => item.includes('决策')));
  assert.ok(errors.some((item) => item.includes('拟议 PR 标题')));
  assert.ok(errors.some((item) => item.includes('预期修改文件')));
});

test('validateChecklistSchema reports missing sections and items', () => {
  const content = `
# E7-04

- 决策：\`Hold\`
`;

  const parsed = {
    decision: 'hold',
    conditions: [],
  };
  const errors = validateChecklistSchema(content, parsed);

  assert.ok(errors.some((item) => item.includes('发送状态')));
  assert.ok(errors.some((item) => item.includes('发送前必需条件')));
  assert.ok(errors.some((item) => item.includes('checklist items')));
});

test('assertDeliveryPacketSchema throws on drifted inputs', () => {
  const planContent = `
# E7-02 Action Plan
`;
  const checklistContent = `
## 发送状态
- 决策：\`unknown\`
`;

  assert.throws(() => {
    assertDeliveryPacketSchema({
      planContent,
      checklistContent,
      plan: parseActionPlanText(planContent),
      checklist: {
        decision: 'unknown',
        conditions: [],
      },
    });
  }, /Delivery packet schema validation failed/);
});

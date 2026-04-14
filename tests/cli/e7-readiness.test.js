const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildReadinessPlan,
  normalizeDecision,
  parseChecklistText,
} = require('../../lib/e7-readiness-check');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'geppetto-e7-'));
}

function removeDir(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
}

function writeChecklist(directory, content) {
  const checklistPath = path.join(directory, 'docs', '13-e7-04-send-window-checklist.md');
  fs.mkdirSync(path.dirname(checklistPath), { recursive: true });
  fs.writeFileSync(checklistPath, content);
  return checklistPath;
}

test('normalizeDecision maps hold and send-now labels', () => {
  assert.equal(normalizeDecision('`Hold`'), 'hold');
  assert.equal(normalizeDecision('Send now'), 'send-now');
  assert.equal(normalizeDecision('send now'), 'send-now');
  assert.equal(normalizeDecision('Hold（待确认）'), 'hold');
});

test('parseChecklistText extracts decision and condition checks', () => {
  const parsed = parseChecklistText(`
## 发送状态

- 决策：\`Hold\`

## 发送前必需条件
- [ ] docs pass
- [x] release pass
`);

  assert.equal(parsed.decision, 'hold');
  assert.equal(parsed.conditions.length, 2);
  assert.equal(parsed.uncheckedConditions.length, 1);
  assert.equal(parsed.uncheckedConditions[0].label, 'docs pass');
});

test('buildReadinessPlan accepts hold checklist without strict checks', () => {
  const tempDir = createTempDir();

  try {
    writeChecklist(
      tempDir,
      `
## 发送状态

- 决策：\`Hold\`

## 发送前必需条件
- [ ] docs pass
- [ ] release pass
`,
    );

    const plan = buildReadinessPlan({ checklistPath: path.join(tempDir, 'docs', '13-e7-04-send-window-checklist.md') });
    assert.equal(plan.decision, 'hold');
    assert.equal(plan.canSendNow, false);
    assert.equal(plan.sendConditionCount, 2);
  } finally {
    removeDir(tempDir);
  }
});

test('buildReadinessPlan blocks strict send-now when conditions missing', () => {
  const tempDir = createTempDir();

  try {
    writeChecklist(
      tempDir,
      `
## 发送状态

- 决策：\`Send now\`

## 发送前必需条件
- [x] docs pass
- [ ] release pass
`,
    );

    assert.throws(() => {
      buildReadinessPlan({
        cwd: tempDir,
        checklistPath: path.join(tempDir, 'docs', '13-e7-04-send-window-checklist.md'),
        strict: true,
        gitStatusText: '',
      });
    }, /pre-send conditions/);
  } finally {
    removeDir(tempDir);
  }
});

test('buildReadinessPlan returns send-ready when all preconditions met', () => {
  const tempDir = createTempDir();

  try {
    writeChecklist(
      tempDir,
      `
## 发送状态

- 决策：\`Send now\`

## 发送前必需条件
- [x] docs pass
- [x] release pass
`,
    );

    const plan = buildReadinessPlan({
      cwd: tempDir,
      checklistPath: path.join(tempDir, 'docs', '13-e7-04-send-window-checklist.md'),
      gitStatusText: '',
    });
    assert.equal(plan.decision, 'send-now');
    assert.equal(plan.canSendNow, true);
    assert.equal(plan.workingTreeClean, true);
    assert.equal(plan.uncheckedConditions.length, 0);
  } finally {
    removeDir(tempDir);
  }
});

test('buildReadinessPlan blocks send-now when working tree dirty under strict', () => {
  const tempDir = createTempDir();

  try {
    writeChecklist(
      tempDir,
      `
## 发送状态

- 决策：\`Send now\`

## 发送前必需条件
- [x] docs pass
- [x] release pass
`,
    );

    const plan = buildReadinessPlan({
      cwd: tempDir,
      checklistPath: path.join(tempDir, 'docs', '13-e7-04-send-window-checklist.md'),
      strict: false,
      gitStatusText: 'M README.md',
    });

    assert.equal(plan.decision, 'send-now');
    assert.equal(plan.canSendNow, false);
    assert.equal(plan.workingTreeClean, false);
    assert.equal(plan.gitStatus, 'M README.md');
  } finally {
    removeDir(tempDir);
  }
});

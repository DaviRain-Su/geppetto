# Phase 6 Task Breakdown — Remaining Toolchain JS to TS

> 状态：草稿（待 review）
> 日期：2026-04-16
> 输入：
> - `docs/toolchain/01-prd.md`
> - `docs/toolchain/02-architecture.md`
> - `docs/toolchain/03-technical-spec.md`

---

## 任务总览

Phase 6 共拆为 **10 个任务**（P6-01 ~ P6-10），按迁移顺序排列。

每个任务控制在 4h 以内。测试迁移跟随对应源文件批次，不单独拆线。

---

## 依赖关系

```text
P6-01 (CI runner fix)
  ↓
P6-02 ~ P6-04 (Batch B: Checks/Knowledge) — 可并行
  ↓
P6-05 ~ P6-06 (Batch A: Bootstrap/Scaffold) — 可并行
  ↓
P6-07 (Batch C: Command Dispatch)
  ↓
P6-08 ~ P6-09 (Batch D: Upstream/Release/E7) — 可并行
  ↓
P6-10 (收口：删 JS、引用检查、CI 验证)
```

---

## P6-01: CI runner 切到 node --test --import tsx

**前置：无**

改动：
- `package.json` `"test"` 脚本改为 `node --test --import tsx <all test files>`
- 确认 CI 绿灯

验证：
```bash
npm test  # 本地通过
# CI push 后 release-check job 绿灯
```

预计工时：~30min

---

## P6-02: knowledge-manifest.ts + knowledge-check.ts

**前置：P6-01**

改动：
- `lib/knowledge-manifest.js` → `lib/knowledge-manifest.ts`
- `lib/knowledge-check.js` → `lib/knowledge-check.ts`
- `tests/cli/knowledge.test.js` → `tests/cli/knowledge.test.ts`
- 更新 `package.json` test 脚本中的文件名
- 更新 `docs:check` 脚本中的引用
- 删除旧 `.js`

验证：
```bash
npx tsc --noEmit
node --test --import tsx tests/cli/knowledge.test.ts
```

预计工时：~2h

---

## P6-03: agent-entry-check.ts

**前置：P6-01**

改动：
- `lib/agent-entry-check.js` → `lib/agent-entry-check.ts`
- `tests/cli/agent-entry.test.js` → `tests/cli/agent-entry.test.ts`
- 更新 `package.json` test 脚本 + `docs:check` 引用
- 删除旧 `.js`

验证：
```bash
npx tsc --noEmit
node --test --import tsx tests/cli/agent-entry.test.ts
```

预计工时：~1h

---

## P6-04: feature-matrix-check.ts

**前置：P6-01**

改动：
- `lib/feature-matrix-check.js` → `lib/feature-matrix-check.ts`
- `tests/cli/feature-matrix.test.js` → `tests/cli/feature-matrix.test.ts`
- 更新 `package.json` test 脚本 + `docs:check` 引用
- 删除旧 `.js`

验证：
```bash
npx tsc --noEmit
node --test --import tsx tests/cli/feature-matrix.test.ts
```

预计工时：~1h

---

## P6-05: templates.ts + init.ts

**前置：P6-01**

改动：
- `lib/templates.js` → `lib/templates.ts`
- `lib/init.js` → `lib/init.ts`
- `tests/cli/templates.test.js` → `tests/cli/templates.test.ts`
- `tests/cli/init.test.js` → `tests/cli/init.test.ts`
- 更新 `bin/geppetto-cli.ts` 中对 `init` / `templates` 的 require → import
- 更新 `package.json` test 脚本引用
- 删除旧 `.js`

验证：
```bash
npx tsc --noEmit
node --test --import tsx tests/cli/templates.test.ts tests/cli/init.test.ts
```

预计工时：~2h

---

## P6-06: new-manifest.ts + new.ts

**前置：P6-01**

改动：
- `lib/new-manifest.js` → `lib/new-manifest.ts`
- `lib/new.js` → `lib/new.ts`
- `tests/cli/new-manifest.test.js` → `tests/cli/new-manifest.test.ts`
- `tests/cli/new.test.js` → `tests/cli/new.test.ts`
- 更新 `bin/geppetto-cli.ts` 中对 `new` 的 require → import
- 更新 `package.json` test 脚本引用
- 删除旧 `.js`

验证：
```bash
npx tsc --noEmit
node --test --import tsx tests/cli/new-manifest.test.ts tests/cli/new.test.ts
```

预计工时：~2h

---

## P6-07: test.ts + audit.ts (Command Dispatch)

**前置：P6-05（templates 依赖）**

改动：
- `lib/test.js` → `lib/test.ts`
- `lib/audit.js` → `lib/audit.ts`
- `tests/cli/test-command.test.js` → `tests/cli/test-command.test.ts`
- 更新 `bin/geppetto-cli.ts` 中对 `test` / `audit` 的 require → import
- 更新 `package.json` test 脚本引用
- 删除旧 `.js`

验证：
```bash
npx tsc --noEmit
node --test --import tsx tests/cli/test-command.test.ts
```

预计工时：~2h

---

## P6-08: upstream-*.ts (5 files)

**前置：P6-01**

改动：
- `lib/upstream-manifest.js` → `lib/upstream-manifest.ts`
- `lib/upstream-version-check.js` → `lib/upstream-version-check.ts`
- `lib/upstream-impact-map.js` → `lib/upstream-impact-map.ts`
- `lib/upstream-diff-check.js` → `lib/upstream-diff-check.ts`
- `lib/upstream-pr-template.js` → `lib/upstream-pr-template.ts`
- `tests/cli/upstream-version-check.test.js` → `.ts`
- `tests/cli/upstream-impact-map.test.js` → `.ts`
- `tests/cli/upstream-diff-check.test.js` → `.ts`
- `tests/cli/upstream-pr-template.test.js` → `.ts`
- 更新 `package.json` 脚本引用（test + `upstream:check` + `upstream:pr-body`）
- 删除旧 `.js`

验证：
```bash
npx tsc --noEmit
node --test --import tsx tests/cli/upstream-version-check.test.ts tests/cli/upstream-impact-map.test.ts tests/cli/upstream-diff-check.test.ts tests/cli/upstream-pr-template.test.ts
```

预计工时：~3h

---

## P6-09: release-check.ts + e7-*.ts + pack.test.ts

**前置：P6-01**

改动：
- `lib/release-check.js` → `lib/release-check.ts`
- `lib/e7-readiness-check.js` → `lib/e7-readiness-check.ts`
- `lib/e7-delivery-packet.js` → `lib/e7-delivery-packet.ts`
- `tests/cli/e7-readiness.test.js` → `.ts`
- `tests/cli/e7-delivery-packet.test.js` → `.ts`
- `tests/cli/pack.test.js` → `.ts`
- 更新 `package.json` 脚本引用（`release:check`, `e7:readiness`, `e7:delivery`, test）
- 删除旧 `.js`

验证：
```bash
npx tsc --noEmit
node --test --import tsx tests/cli/e7-readiness.test.ts tests/cli/e7-delivery-packet.test.ts tests/cli/pack.test.ts
```

预计工时：~3h

---

## P6-10: 收口 — 全量验证 + 引用扫描 + CI 确认

**前置：P6-02 ~ P6-09 全部完成**

改动：
- 扫描仓库确认无残留 `.js` 工具链文件
- 扫描所有引用确认无断链（grep `.js` 路径）
- 确认 `package.json` 所有脚本指向 `.ts`
- 确认 `bin/geppetto-cli.ts` 所有 require 已切到 import

验证：
```bash
npx tsc --noEmit
npm test
bun run release:check
bun run upstream:check
# CI 全绿
```

预计工时：~1h

---

## 建议分工

| 任务 | 建议 Owner | 理由 |
|------|-----------|------|
| P6-01 | @kimi | 已在做方案 A CI fix |
| P6-02 | @kimi | knowledge 模块逻辑纯 |
| P6-03 | @codex_5_3 | agent-entry 小模块，适合 cross-review 角色兼做 |
| P6-04 | @codex_5_3 | feature-matrix 小模块 |
| P6-05 | @kimi | templates/init 是核心脚手架 |
| P6-06 | @codex_5_4 | new/manifest 独立性强 |
| P6-07 | @kimi | test/audit dispatch 依赖 templates |
| P6-08 | @codex_5_4 | upstream 家族文件多但模式统一 |
| P6-09 | @codex_5_3 | release/e7 与 CI gate 相关 |
| P6-10 | @CC-Opus | 收口验证由 Planner 统一做 |

---

## 并行策略

P6-01 必须先完成（CI 绿灯基线）。之后：

- **第一波并行**：P6-02 + P6-03 + P6-04（Batch B，三人各领一个）
- **第二波并行**：P6-05 + P6-06（Batch A，两人各领一个）
- **第三波并行**：P6-07 + P6-08 + P6-09（Batch C + D）
- **最后**：P6-10 收口

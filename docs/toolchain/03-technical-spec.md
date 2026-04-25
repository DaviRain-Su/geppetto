# Phase 6 Technical Spec — Remaining Toolchain JS to TS

> 状态：草稿（待 review）
> 日期：2026-04-16
> 输入：
> - `docs/toolchain/01-prd.md`
> - `docs/toolchain/02-architecture.md`
> - 当前仓库文件状态（Phase 5 后）

---

## 1. 目标

把剩余的非-platform 工具链从 `.js` 迁到 `.ts`，并保证：

- 行为等价
- `npx tsc --noEmit` 通过
- CI 采用方案 A：
  - `node --test --import tsx`
- 删除旧 `.js` 源文件后，仓库引用不残留断链

---

## 2. 当前剩余文件清单

### 2.1 Source files (`lib/*.js`)

总数：`18`

#### Batch A — Bootstrap / Scaffold

- `lib/init.js`
- `lib/new.js`
- `lib/templates.js`
- `lib/new-manifest.js`

#### Batch B — Checks / Knowledge

- `lib/knowledge-check.js`
- `lib/knowledge-manifest.js`
- `lib/agent-entry-check.js`
- `lib/feature-matrix-check.js`

#### Batch C — Command Dispatch

- `lib/test.js`
- `lib/audit.js`

#### Batch D — Upstream / Release / E7

- `lib/upstream-diff-check.js`
- `lib/upstream-impact-map.js`
- `lib/upstream-manifest.js`
- `lib/upstream-pr-template.js`
- `lib/upstream-version-check.js`
- `lib/release-check.js`
- `lib/e7-readiness-check.js`
- `lib/e7-delivery-packet.js`

### 2.2 Test files (`tests/cli/*.test.js`)

总数：`15`

- `tests/cli/init.test.js`
- `tests/cli/templates.test.js`
- `tests/cli/pack.test.js`
- `tests/cli/knowledge.test.js`
- `tests/cli/agent-entry.test.js`
- `tests/cli/feature-matrix.test.js`
- `tests/cli/upstream-version-check.test.js`
- `tests/cli/upstream-impact-map.test.js`
- `tests/cli/upstream-diff-check.test.js`
- `tests/cli/upstream-pr-template.test.js`
- `tests/cli/new-manifest.test.js`
- `tests/cli/new.test.js`
- `tests/cli/test-command.test.js`
- `tests/cli/e7-readiness.test.js`
- `tests/cli/e7-delivery-packet.test.js`

---

## 3. 固定 runner / CI 规格

### 3.1 测试命令

Phase 6 固定测试命令为：

```bash
node --test --import tsx <test-files...>
```

### 3.2 `package.json` `test` script

Phase 6 期间必须保持为以下形态：

```json
"test": "node --test --import tsx tests/cli/init.test.js tests/cli/templates.test.js tests/cli/pack.test.js tests/cli/knowledge.test.js tests/cli/agent-entry.test.js tests/cli/feature-matrix.test.js tests/cli/upstream-version-check.test.js tests/cli/upstream-impact-map.test.js tests/cli/upstream-diff-check.test.js tests/cli/upstream-pr-template.test.js tests/cli/new-manifest.test.js tests/cli/new.test.js tests/cli/test-command.test.js tests/cli/e7-readiness.test.js tests/cli/e7-delivery-packet.test.js tests/cli/platform-config.test.ts tests/cli/platform-state.test.ts tests/cli/platform-deploy.test.ts tests/cli/platform-solana-adapter.test.ts tests/cli/platform-encore-adapter.test.ts tests/cli/platform-output.test.ts tests/cli/deploy-command.test.ts tests/cli/deploy-smoke.test.ts"
```

说明：

- 允许后续把已迁移 `.js` 测试逐步替换为 `.ts`
- 但 runner 必须继续保持 `node --test --import tsx`

### 3.3 唯一入口约束

在 Phase 6 执行与验收期间：

- **`package.json` 当前的 `test` script 是唯一规范入口**

这意味着：

- 人工执行全量测试时，默认使用 `npm test`
- CI 全量测试时，也必须调用同一条 script
- 文档中的底层命令形态（如 `node --test --import tsx ...`）是实现说明，不是第二套验收入口

只有在做单批次局部验证时，才允许直接运行子集命令。

### 3.4 非目标

本阶段**不**把测试 runner 切回 `bun test`。

---

## 4. 迁移原则

每个文件迁移必须遵守相同的 5 步：

1. 复制 `.js` 为 `.ts`
2. 加类型注解，保证行为不变
3. 替换引用到 `.ts`
4. 跑对应测试 + `npx tsc --noEmit`
5. 删除同名 `.js`

禁止做法：

- 先删 `.js` 再补 `.ts`
- 顺手重写算法/流程
- 因为 TS 化而改变输出文案
- 把多个模块揉成一个新抽象层

---

## 5. 每批次技术规格

## 5.1 Batch A — Bootstrap / Scaffold

### 文件

- `lib/templates.js -> lib/templates.ts`
- `lib/init.js -> lib/init.ts`
- `lib/new-manifest.js -> lib/new-manifest.ts`
- `lib/new.js -> lib/new.ts`

### 技术边界

#### `templates.ts`

必须保留：

- `TEMPLATE_FILES`
- `PACKAGE_REQUIRED_FILES`
- `getTemplateRoot()`
- `getTemplateEntries()`
- `assertTemplateManifest()`

类型要求：

- `TemplateEntry`
- `TemplateManifestIssue` 若有必要可局部声明

行为要求：

- 模板文件列表顺序不变
- `PACKAGE_REQUIRED_FILES` 内容不变

#### `init.ts`

必须保留：

- `initProject(targetDir, options)`

行为要求：

- `created/skipped/would-create` 状态不变
- 文件复制行为不变
- dry-run 行为不变

#### `new-manifest.ts`

必须保留：

- 模板 manifest 列表
- `assertNewProjectManifest()`
- `getNewProjectTemplateEntries()`

行为要求：

- 模板内容字节级不变

#### `new.ts`

必须保留：

- `isSafeProjectName()`
- `normalizeCrateName()`
- 模板变量替换逻辑
- 缺变量报错逻辑

行为要求：

- 占位符规则 `{{VAR}}` 不变
- 项目名校验规则不变

### 对应测试

- `tests/cli/templates.test.js -> .ts`
- `tests/cli/init.test.js -> .ts`
- `tests/cli/new-manifest.test.js -> .ts`
- `tests/cli/new.test.js -> .ts`

### 完成判定

```bash
npx tsc --noEmit
node --test --import tsx tests/cli/templates.test.ts tests/cli/init.test.ts tests/cli/new-manifest.test.ts tests/cli/new.test.ts
```

---

## 5.2 Batch B — Checks / Knowledge

### 文件

- `lib/knowledge-manifest.js -> lib/knowledge-manifest.ts`
- `lib/knowledge-check.js -> lib/knowledge-check.ts`
- `lib/agent-entry-check.js -> lib/agent-entry-check.ts`
- `lib/feature-matrix-check.js -> lib/feature-matrix-check.ts`

### 技术边界

共同要求：

- 保留现有 regex / TOML 段提取逻辑
- 不改 manifest 内容和约束

#### `knowledge-manifest.ts`

必须保留：

- `KNOWLEDGE_HEADER_TARGETS`
- `getKnowledgeManifestRoot()`
- `getKnowledgeHeaderTargets()`
- `assertKnowledgeHeaderManifest()`

#### `knowledge-check.ts`

必须保留：

- TOML section/value 提取函数
- 头部校验流程
- 错误信息结构

#### `agent-entry-check.ts`

必须保留：

- `AGENT_ENTRY_MIRROR_TARGETS`
- mirror 路径约束
- 内容比对逻辑

#### `feature-matrix-check.ts`

必须保留：

- `FEATURE_KEYS_TO_CHECK`
- TOML section 提取逻辑
- feature matrix 校验逻辑

### 对应测试

- `tests/cli/knowledge.test.js -> .ts`
- `tests/cli/agent-entry.test.js -> .ts`
- `tests/cli/feature-matrix.test.js -> .ts`

### 完成判定

```bash
npx tsc --noEmit
node --test --import tsx tests/cli/knowledge.test.ts tests/cli/agent-entry.test.ts tests/cli/feature-matrix.test.ts
```

---

## 5.3 Batch C — Command Dispatch

### 文件

- `lib/test.js -> lib/test.ts`
- `lib/audit.js -> lib/audit.ts`

### 技术边界

#### `test.ts`

必须保留：

- `DEFAULT_ESCROW_EXAMPLES_MANIFEST`
- `DEFAULT_ESCROW_MANIFEST_PATH`
- `getProjectRoot()`
- `getEscrowArtifactPath()`
- `hasEscrowArtifact()`
- `createRunner()`
- `buildTestPlan()`

行为要求：

- test plan 顺序不变
- escrow artifact 判断逻辑不变

#### `audit.ts`

必须保留：

- `createRunner()`
- `buildAuditPlan()`

行为要求：

- `strict` / `includeLocked` 参数语义不变
- cargo 命令顺序不变

### 对应测试

- `tests/cli/test-command.test.js -> .ts`

`audit` 如果当前没有单独测试，迁移后不新增行为测试，只允许补类型相关最小测试。

### 完成判定

```bash
npx tsc --noEmit
node --test --import tsx tests/cli/test-command.test.ts
```

---

## 5.4 Batch D — Upstream / Release / E7

### 文件

- `lib/upstream-manifest.js -> lib/upstream-manifest.ts`
- `lib/upstream-version-check.js -> lib/upstream-version-check.ts`
- `lib/upstream-impact-map.js -> lib/upstream-impact-map.ts`
- `lib/upstream-diff-check.js -> lib/upstream-diff-check.ts`
- `lib/upstream-pr-template.js -> lib/upstream-pr-template.ts`
- `lib/release-check.js -> lib/release-check.ts`
- `lib/e7-readiness-check.js -> lib/e7-readiness-check.ts`
- `lib/e7-delivery-packet.js -> lib/e7-delivery-packet.ts`

### 技术边界

#### Upstream family

必须保留：

- manifest 数据结构
- version compare 逻辑
- impact map 输出结构
- PR 模板 markdown 结构

注意：

- 不因 TS 化改变 crates.io 请求逻辑
- 不改变 stdin / `--from-json` 行为

#### `release-check.ts`

必须保留：

- `npmCommand` 兼容逻辑
- `runStep()`
- 步骤顺序：
  1. `test`
  2. `docs:check`
  3. `geppetto:test`
  4. `geppetto:audit`
  5. `pack --dry-run --json`

说明：

- 虽然仓库是 Bun-first，这里仍保留 `npmCommand` 兼容逻辑，除非架构阶段单独批准修改

#### `e7-readiness-check.ts`

必须保留：

- checklist 路径
- decision 归一化
- parsing 规则

#### `e7-delivery-packet.ts`

必须保留：

- 对 `e7-readiness-check` 的调用关系
- action plan / discussion draft / checklist 解析规则

### 对应测试

- `tests/cli/upstream-version-check.test.js -> .ts`
- `tests/cli/upstream-impact-map.test.js -> .ts`
- `tests/cli/upstream-diff-check.test.js -> .ts`
- `tests/cli/upstream-pr-template.test.js -> .ts`
- `tests/cli/e7-readiness.test.js -> .ts`
- `tests/cli/e7-delivery-packet.test.js -> .ts`
- `tests/cli/pack.test.js -> .ts`

### 完成判定

```bash
npx tsc --noEmit
node --test --import tsx tests/cli/upstream-version-check.test.ts tests/cli/upstream-impact-map.test.ts tests/cli/upstream-diff-check.test.ts tests/cli/upstream-pr-template.test.ts tests/cli/e7-readiness.test.ts tests/cli/e7-delivery-packet.test.ts tests/cli/pack.test.ts
```

---

## 6. 删除 `.js` 的时机

### 规则

同名 `.js` 只能在以下条件全部满足后删除：

1. `.ts` 文件已落盘
2. 所有仓库内引用已切换
3. 对应测试通过
4. `npx tsc --noEmit` 通过

### 明确禁止

- 提前删除 `release-check.js` / `upstream-*.js` 导致 CI / scripts 断掉
- 提前删除 `templates.js` / `init.js` 导致模板检查或初始化断掉

---

## 7. 引用替换规则

### 7.1 `package.json`

允许修改：

- 指向剩余 `.js` 的 script 路径

不允许修改：

- script 名称
- script 业务顺序

### 7.2 `bin/geppetto-cli.ts`

如果仍引用剩余 `.js` 模块：

- 仅替换到对应 `.ts`
- 不在这里重构命令 dispatch 逻辑

### 7.3 tests

测试迁移时允许：

- `.js -> .ts`
- import 路径更新
- 最小类型补全

不允许：

- 顺手重写断言结构
- 改变测试语义

---

## 8. 验证矩阵

每一批完成后至少执行：

```bash
npx tsc --noEmit
npm test
```

如需缩小回归范围，还可加对应批次的单独测试命令。

### 最终收口验证

```bash
npx tsc --noEmit
npm test
bun run release:check
bun run upstream:check
```

说明：

- `npm test` 在本阶段等价于 `node --test --import tsx ...`
- `bun run` 仍用于 script 入口验证

---

## 9. 边界条件（至少 10 个）

1. `init` dry-run 不能写文件
2. `init` 遇到已存在文件仍返回 `skipped`
3. `new` 遇到非法项目名仍报原错误
4. `new` 缺模板变量仍报原错误
5. `knowledge-check` 缺 `[package.metadata.geppetto]` 段行为不变
6. `agent-entry-check` 遇绝对路径仍报错
7. `feature-matrix-check` feature key 缺失行为不变
8. `upstream-diff-check` crates.io 返回异常时错误路径不变
9. `upstream-pr-template` 读 stdin 与 `--from-json` 两路径保持一致
10. `release-check` 任一步失败仍返回对应非零 exit
11. `e7-readiness-check` 对 checklist decision 的归一化逻辑不变
12. `e7-delivery-packet` 缺文档时错误路径不变

---

## 10. 明确 deferred 的 follow-up

以下问题**不属于** Phase 6 主迁移完成标准：

1. `deploy-smoke.test.ts` 在 Bun 下的 mock 注入问题
2. nested `test()` 对 Bun 的兼容问题
3. 更换测试框架（如 `describe/it` 重构）

这些可单独立 follow-up 或纳入后续 runner 兼容线。

---

## 11. Acceptance Anchor for Next Stage

下一份文档应为：

- `docs/toolchain/04-task-breakdown.md`

应按以下维度拆任务：

- Batch A / B / C / D
- 每批 source + test 成对拆分
- 每个任务控制在 `<= 4h`
- 单独保留一个 CI / runner 收口任务

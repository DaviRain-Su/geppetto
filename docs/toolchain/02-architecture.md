# Phase 6 Architecture — Remaining Toolchain JS to TS

> 状态：草稿（待 review）
> 日期：2026-04-16
> 输入：
> - `docs/toolchain/01-prd.md`
> - 当前仓库状态：platform deploy 主链路已完成 Bun + TypeScript 迁移
> - 剩余范围：`18` 个 `lib/*.js` + `15` 个 `tests/cli/*.test.js`
> - 当前 CI 现实：仓库保持 Bun-first，但测试 runner 短期按方案 A 使用 `node --test --import tsx`

---

## 1. 架构一句话

**Phase 6 不是再做一轮平台重构，而是在保持现有命令行为不变的前提下，把剩余非-platform 工具链从 JavaScript 迁到 TypeScript，并在迁移期间显式采用“Bun 开发运行时 + Node test runner”的双轨策略保证主线稳定。**

---

## 2. Phase 6 锁定结论

### 已锁定

1. **迁移目标是“剩余工具链”，不是 platform 主链**
   - `lib/platform/*`、`lib/platform/adapters/*`、`bin/geppetto-cli.ts` 已经完成
   - Phase 6 只处理剩余非-platform 工具模块和对应测试

2. **只做等价迁移，不做行为改造**
   - 不改命令语义
   - 不改输出格式
   - 不改错误码/错误文案，除非 TypeScript 类型安全强制要求极小修正

3. **Runner / CI 策略固定为短期双轨**
   - 本地与仓库方向仍是 **Bun + TypeScript**
   - 但测试执行短期采用：
     - `node --test --import tsx`
   - 这样避免 Bun test runner 的已知兼容问题阻塞迁移主线

4. **Bun 兼容问题不混入本阶段**
   - `deploy-smoke.test.ts` mock/ESM 绑定问题
   - nested `test()` 的 Bun 限制
   - 这些作为独立 follow-up，不算 Phase 6 主交付的一部分

5. **迁移按模块族批次推进，不按文件随机推进**
   - 必须先锁模块组，再迁源文件，再迁对应测试
   - 避免多人同时改同一组入口和测试导致冲突

### 明确不做

- CLI / tool 功能 redesign
- 平台 deploy 主链路再改一遍
- 为了“代码更漂亮”引入大规模抽象重写
- 统一所有剩余工具模块到一个新的巨型 shared type system
- 为适配 Bun test runner 而重写全部测试结构

---

## 3. 剩余系统分层

剩余工具链可以稳定地分成 4 条迁移线：

```text
┌────────────────────────────────────────────────────────────┐
│  Line A: Bootstrap / Scaffold                             │
│  init / new / templates / new-manifest                    │
├────────────────────────────────────────────────────────────┤
│  Line B: Checks / Knowledge                               │
│  knowledge / manifest / agent-entry / feature-matrix      │
├────────────────────────────────────────────────────────────┤
│  Line C: Upstream / Release / E7                          │
│  upstream-* / release-check / e7-*                        │
├────────────────────────────────────────────────────────────┤
│  Line D: Test Layer                                       │
│  tests/cli/*.test.js -> .ts                               │
└────────────────────────────────────────────────────────────┘
```

### 3.1 Line A — Bootstrap / Scaffold

文件：

- `lib/init.js`
- `lib/new.js`
- `lib/templates.js`
- `lib/new-manifest.js`

职责：

- 初始化项目
- 生成模板文件
- 生成 manifest

迁移特点：

- 文件系统副作用多
- 路径处理多
- 对输出文本/模板内容的兼容性要求高

### 3.2 Line B — Checks / Knowledge

文件：

- `lib/knowledge-check.js`
- `lib/knowledge-manifest.js`
- `lib/agent-entry-check.js`
- `lib/feature-matrix-check.js`

职责：

- 文档/知识约束检查
- manifest / feature matrix 校验

迁移特点：

- 读文件、解析文本、返回错误为主
- 适合先行完成，因为逻辑相对纯

### 3.3 Line C — Upstream / Release / E7

文件：

- `lib/upstream-diff-check.js`
- `lib/upstream-impact-map.js`
- `lib/upstream-manifest.js`
- `lib/upstream-pr-template.js`
- `lib/upstream-version-check.js`
- `lib/release-check.js`
- `lib/e7-readiness-check.js`
- `lib/e7-delivery-packet.js`

职责：

- 上游同步检查
- release gate
- E7 文档/交付检查

迁移特点：

- 会直接影响 CI / release 检查
- 必须在 runner 策略固定后再推进

### 3.4 Line D — Test Layer

文件：

- `tests/cli/*.test.js` 中所有剩余未迁移测试

职责：

- 作为剩余工具链的行为锚点

迁移特点：

- 必须跟随对应模块族推进
- 不允许先把所有测试一口气改完再回头补源码

---

## 4. 迁移顺序

Phase 6 必须按以下顺序推进：

### Step 1

先固定 runner / CI 策略：

- `package.json` 的测试命令统一为：
  - `node --test --import tsx ...`
- CI 先恢复稳定绿灯

### Step 2

迁移 Line B（Checks / Knowledge）

理由：

- 纯度更高
- 依赖少
- 最容易验证“等价迁移”

### Step 3

迁移 Line A（Bootstrap / Scaffold）

理由：

- 模板/文件写入逻辑更敏感
- 但与 CI 耦合度低于 release/upstream

### Step 4

迁移 Line C（Upstream / Release / E7）

理由：

- 这组最接近 CI 和 release gate
- 需要在 runner 策略稳定后再改

### Step 5

补齐并收口 Line D（Tests）

说明：

- 测试迁移不是最后一次性做完
- 但最终收口必须把对应 `.js` 测试清掉或明确列为暂缓项

---

## 5. TypeScript 边界策略

### 5.1 不引入新的“大一统类型中心”

`lib/platform/types.ts` 只服务于 platform 主链。

Phase 6 不应强行把所有剩余工具模块都塞进 platform types；否则会把“工具链迁移”误做成“跨域重构”。

### 5.2 剩余工具链采用“模块族内局部类型”

策略：

- 简单模块：直接在 `.ts` 文件内声明局部类型
- 同组共享结构：在该模块族邻近位置定义轻量 shared types
- 仅当 3 个以上模块复用同一结构时，才抽单独类型文件

### 5.3 文件系统与命令执行要优先显式类型

必须显式类型化的边界：

- CLI args
- path / template context
- file write payload
- command result shape
- release/upstream check result object

---

## 6. 入口与引用架构

### 6.1 入口文件

保留当前 CLI 主入口：

- `bin/geppetto-cli.ts`

剩余工具模块继续作为内部调用模块存在，不新增第二个 CLI 入口体系。

### 6.2 引用替换规则

迁移时统一遵守：

1. 先新增 `.ts`
2. 再替换导入引用
3. 确认测试通过
4. 最后删除同名 `.js`

禁止：

- 在同一批次里同时删源文件和大改调用方式
- 先删 `.js` 再慢慢找断引用

### 6.3 模板引用

像 `lib/templates.js` 这类文件可能内含对 CLI 文件名或脚本扩展名的显式引用。

这类引用必须单独检查：

- CLI 路径
- shebang 目标
- 模板输出中的脚本名
- README / usage 文案中是否写死 `.js`

---

## 7. Test Runner / CI 架构

### 7.1 当前固定策略

在 Phase 6 期间，测试执行以：

- `node --test --import tsx`

为准。

目的：

- 同时运行 `.js` 与 `.ts` 测试
- 避开 Bun runner 的既知兼容限制
- 保证迁移主线不被 runner 问题污染

### 7.2 Bun 的位置

Bun 继续承担：

- package manager
- 脚本入口
- 开发运行时方向

但 **不是** 当前阶段测试兼容性的唯一判断标准。

### 7.3 CI 判定标准

本阶段 CI 需要证明：

1. `npx tsc --noEmit` 通过
2. `node --test --import tsx ...` 通过
3. release/upstream 检查在新 `.ts` 路径下仍工作

---

## 8. 风险控制点

### 风险 1：行为漂移

控制方式：

- 每个模块族迁移后跑对应测试
- review 时优先检查输出、错误路径、文件副作用

### 风险 2：路径残留

控制方式：

- 专门检查 `.js` 路径硬编码
- 包括：
  - tests
  - templates
  - release checks
  - docs/scripts

### 风险 3：把 Bun 兼容问题和迁移绑定

控制方式：

- runner 问题单独跟踪
- 不允许因为 Bun runner 问题否定整个 TS 迁移

### 风险 4：多人并行冲突

控制方式：

- 按模块族分线
- 任何人不得跨线大范围顺手改

---

## 9. MVP 级交付定义

Phase 6 完成时，最少需要满足：

1. 剩余工具链模块分批迁为 `.ts`
2. 对应测试迁移完成或被明确记录为暂缓
3. CLI / templates / checks / CI 不再依赖已删除 `.js`
4. `npx tsc --noEmit` 通过
5. `node --test --import tsx` 的 CI 主路径绿灯

---

## 10. Acceptance Anchor for Next Stage

下一份文档应为：

- `docs/toolchain/03-technical-spec.md`

必须钉死：

- 每条迁移线的文件清单
- 每批入口/输出 contract
- 引用替换规则
- 删除 `.js` 的时机
- 测试迁移策略
- CI / script 具体命令

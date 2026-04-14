# Release Notes — Geppetto

> 基线：`75e1e00`（功能基线）
> 文档收口补丁：`1a1d429`
> 标题：Phase 8 E3~E7：文档一致性、上游追踪、工具层收口与外部协同（Hold）
> 日期：2026-04-14
> 状态：可发布基线

## 摘要

此版本将 Geppetto 推进到更稳定的 Phase 8 基线，重点补齐了“代码正确”之外的三类一致性保障：

- 知识版本头一致性
- agent 入口镜像一致性
- `Cargo.toml` 与技术规格中的 feature matrix 一致性

同时，前序已完成的 escrow 示例修复、Rust ↔ TypeScript 对齐链路、CLI 模板清单与打包校验，也已纳入统一发布基线。

## 版本亮点

### 1. escrow 示例更接近真实链上语义

`examples/escrow` 已完成以下强化：

- 支持 fresh system-owned PDA 的首建路径
- 拒绝重复初始化已写入状态
- 拒绝复用已关闭/已抽干账户
- 保持 integration / svm 回归测试覆盖 create / exchange / close

这使得 escrow 示例不再只是“能跑的 demo”，而是更可信的合约侧参考实现。

### 2. Rust ↔ TypeScript 对齐已变成可执行检查

仓库现已具备最小端到端对齐链路：

- Rust 生成 binary fixture 与 layout fixture
- TypeScript 按真实 offset / type 读取 fixture
- 统一入口：

```bash
npm run test:escrow-client-alignment
```

这让 `src/client.rs` 中的客户端知识不再停留在伪代码层，而是直接绑定到可运行示例。

### 3. CLI 模板发布链路更稳健

`geppetto-cli init` 已具备：

- canonical 模板 manifest
- 默认 skip 不覆盖语义
- `--dry-run` 预览模式
- `npm pack --dry-run --json` 打包级校验
- `npm run release:check` 发布前检查入口

这降低了 CLI 发布时模板遗漏、文件漂移或错误覆盖的风险。

### 4. 文档一致性检查已落地

当前版本新增了三类可执行检查：

#### 知识版本头检查
- 校验 `geppetto` 版本
- 校验生态版本（如 `pinocchio` / `mollusk-svm` / `litesvm`）
- 校验日期格式是否为 ISO `YYYY-MM-DD`

#### agent 入口镜像检查
- 校验 `CLAUDE.md`、`GEMINI.md`、`.cursor`、`.windsurf`、`.github`、`.amazonq`、`.aider.conf.yml`
- 确保这些入口仍正确镜像/跳转到 `AGENTS.md`

#### feature matrix 检查
- 对比 `Cargo.toml` 的 feature 定义
- 校验 `docs/03-technical-spec.md` 中 canonical Cargo feature block 是否同步

统一入口：

```bash
npm run docs:check
```

### 5. `geppetto new` 脚手架交付与收口

`geppetto new` 命令完成从约定式项目生成的收口交付：

- `init` 与 `new` 的模板清单与 manifest 校验可追溯；
- 默认非覆盖语义，避免危险改写既有目录；
- 模板变量替换支持 `PROJECT_NAME` / `CRATE_NAME` / `PACKAGE_NAME` / `PROGRAM_NAME`，并要求未知变量 fail-fast；
- 生成最小 Rust 项目骨架与 `tests/svm.rs`；
- 与 `init` 共享 canonical agent 入口模板源；
- `README` / `docs/08-evolution.md` / `docs/06` / `docs/07` 完成跨文档闭环同步；

### 6. `geppetto test` / `geppetto audit` 工具层收口

命令集已扩展为开发/发布一体的最小工具层：

- `geppetto test`：统一运行 root 与 escrow 示例测试，示例测试前支持缺失 `.so` 的自动构建；
- `geppetto audit`：最小静态审查门禁，默认 `fmt/check`，`--strict` 开启 `clippy`；
- `npm run release:check` 串联文档一致性与上述两个命令，形成一次性发布前检查入口。

## Changelog

### 新增

- `lib/knowledge-manifest.js`
- `lib/knowledge-check.js`
- `lib/agent-entry-check.js`
- `lib/feature-matrix-check.js`
- `tests/cli/knowledge.test.js`
- `tests/cli/agent-entry.test.js`
- `tests/cli/feature-matrix.test.js`

### 增强

- `geppetto-cli init --dry-run`
- CLI 模板 manifest 校验
- `npm pack` 打包 smoke check
- 上游依赖追踪与更新审查链路
  - `lib/upstream-manifest.js`
  - `lib/upstream-version-check.js`
  - `lib/upstream-impact-map.js`
  - `lib/upstream-diff-check.js`
  - `lib/upstream-pr-template.js`
  - `tests/cli/upstream-*.test.js`
- escrow 示例初始化语义与防重初始化语义
- escrow SVM `.so` 运行时加载与缺失提示
- `src/client.rs` 的 Codama 指南
- `src/idioms/cpi.rs` 的 `multisig_signers: &[]` 示例补齐
- `src/testing/mollusk.rs` 的搜索路径文案准确性
- 反模式条目数与 hidden padding 文案一致性
- escrow 顶层示例说明与当前状态机实现对齐
- geppetto new 约定式脚手架与 E5 收口
- `geppetto test` 与 `geppetto audit` 最小工具层

### 更新文档

- `README.md`
- `docs/03-technical-spec.md`
- `docs/04-task-breakdown.md`
- `docs/06-implementation-log.md`
- `docs/07-review-report.md`
- `docs/10-e7-01-external-alignment.md`
- `docs/11-e7-02-create-solana-dapp-action-plan.md`
- `docs/12-e7-03-create-solana-dapp-discussion-draft.md`
- `docs/13-e7-04-send-window-checklist.md`
- `docs/08-evolution.md`
- `docs/09-release-notes.md`

这些文档现已反映：

- E1 已交付
- E2 已交付
- E3 已交付到 E3-08（文档收口已完成）
- E4 已完成到 E4-09（上游依赖追踪与审查发布门禁收口）
- E5 已完成到 E5-09（`geppetto new` 脚手架收口）
- E7 已完成到 E7-04：外部输出目标与路径已闭环，当前执行策略为 Hold（等待发送窗口确认）

## 验证状态

基于 `1a1d429` 验证（功能基线为 `75e1e00`，文档收口补丁 `1a1d429`）：

- `cargo test --all-features --locked` ✅
- `RUSTC_WRAPPER= cargo test --doc --locked` ✅
- `cargo test --manifest-path examples/escrow/Cargo.toml --all-features --locked` ✅
- `RUSTC_WRAPPER= cargo clippy --all-features --locked` ✅
- `cargo fmt --check` ✅
- `RUSTC_WRAPPER= cargo doc --no-deps --locked` ✅
- `npm test` ✅
- `npm run docs:check` ✅
- `npm run test:escrow-client-alignment` ✅
- `npm run geppetto:test` ✅
- `npm run geppetto:audit` ✅
- `npm run release:check` ✅

## 已知非阻塞项

在受限环境下，Rust 命令可能需要：

```bash
RUSTC_WRAPPER=
```

原因是本地 `sccache` 权限问题（如 `Operation not permitted`）。这属于环境噪音，不是当前仓库回归。

## 推荐发布语句

**Geppetto 0.1.0 — Phase 8 stability baseline**

- hardened escrow example initialization semantics
- added Rust ↔ TypeScript fixture alignment checks
- strengthened CLI template packaging and dry-run flow
- introduced executable docs consistency gates for knowledge headers, agent entry mirrors, and feature matrix alignment
- added `geppetto new` minimal scaffolding and E5-09 closure
- added `geppetto test` / `geppetto audit` delivery (E6)

# Phase 6: Implementation Log — Geppetto

> 状态：进行中
> 日期：2026-04-13
> 输入：Phase 5 测试规格

本阶段从 Phase 3/5 的契约开始实现。

**当前代码状态（2026-04-13）**：
- `Cargo.toml` — 完整（依赖、features、metadata 与 Phase 3 一致）
- `src/lib.rs` — 完整（`#![no_std]`、re-export、feature gates、模块声明、crate doc）
- `src/{error,schema,guard,dispatch,idioms}.rs` — 已实现并通过 `cargo check`
- `src/{anti_patterns,client,testing}.rs` — 空文件（知识文档/测试工具待后续补充）
- `src/main.rs` — 已删除（library crate 不需要 binary entrypoint）
- A-02 ~ A-13 全部已完成

## 6.0 实施原则（硬约束）

- 技术规格先行，不允许偏离；出现冲突先回到 `docs/03-technical-spec.md` 修订。
- 采用承诺型任务（Commit）执行，每项 ≤ 4 小时。
- 按 dev-lifecycle 规则执行 `Phase 6.0.1` 代理熵检查：每完成 3 个任务暂停一次；发现以下任一项达到 2 个以上立即停止实现并修复：
  - `bare catch` 分支
  - 静态默认值兜底
  - 重复语义函数
- 所有改动先通过本地最小验证（`cargo check/test/doc`）再进入下一任务。

## 6.1 承诺型任务清单（按现有拆解衔接）

- A-02：`Cargo.toml` + `src/lib.rs` 骨架（`#![no_std]`、features、模块声明）
- A-03：`error.rs`（`GeppettoError` + `From<GeppettoError> for ProgramError`）
- A-04：`schema.rs`（`AccountSchema` trait、布局常量、`assert_account_size!`）
- A-06：`guard.rs` 第一批（6 个）
- A-07：`guard.rs` 第一批测试
- A-08：`guard.rs` 第二批（6 个）
- A-09：`guard.rs` 第二批测试
- A-10：`dispatch.rs`（`split_tag`、常量、文档）
- A-11：`dispatch.rs` 测试
- A-12：`idioms.rs` 导出函数
- A-13：`idioms.rs` 函数测试
- A-14~A-19：知识模块与 `lib.rs` doc 完成（仅在实现稳定后执行）
- A-20~A-23：AGENTS 与入口文件、全量测试与文档验收

以上任务必须以 4 周里程碑（2026-05-11）为上限执行，当前优先级按关键路径：

`A-02 -> A-03 -> A-04 -> A-06 -> A-07 -> A-08 -> A-09 -> A-10 -> A-11 -> A-12 -> A-13`

## 6.2 日志（当前）

- 2026-04-13：Phase 0-5 文档全部完成，Phase 6/7/8 文档骨架创建。
- 2026-04-13：A-02 完成 — `Cargo.toml` + `src/lib.rs`（re-export + 模块声明 + crate doc）+ 9 个空模块文件。`src/main.rs` 已删除。
- 2026-04-13：Code Review 修复 — Cargo.toml license 统一为 `MIT OR Apache-2.0`；PRD 补充扩展 guard 列表；Tech Spec 多项安全文档增强。
- 2026-04-13：Codex review + 多轮 review 修复 — 文档状态与仓库同步、SYSTEM_PROGRAM_ID 注释澄清、feature default 策略统一为 `default = []`。
- 2026-04-13：`cargo check` 通过 default / test-utils / full 三种 feature 组合。
- 2026-04-13：A-03 完成 — `error.rs`（`GeppettoError` + `From` 转换）。
- 2026-04-13：A-04 完成 — `schema.rs`（`AccountSchema` trait + `assert_account_size!` 宏），修复了 `try_from_account` 中 `Ref` 生命周期与 `unsafe` 块兼容问题。
- 2026-04-13：A-06 完成 — `guard.rs` 第一批 6 个函数（`assert_signer`, `assert_writable`, `assert_owner`, `assert_pda`, `assert_discriminator`, `assert_rent_exempt`）。
- 2026-04-13：A-08 完成 — `guard.rs` 第二批 6 个函数 + 4 个 well-known 常量（`assert_readonly`, `assert_system_program`, `assert_token_program`, `assert_current_program`, `assert_account_count`, `assert_ata`）。
- 2026-04-13：A-10 完成 — `dispatch.rs`（`split_tag` + `SELF_CPI_EVENT_DISCRIMINATOR` + `BATCH_DISCRIMINATOR`）。
- 2026-04-13：A-12 完成 — `idioms.rs` 导出函数（`close_account`, `read_u64_le`, `write_u64_le`, `read_address`）。
- 2026-04-13：代理熵检查通过（bare catch / 静态默认值 / 重复语义函数 均为 0）。
- 2026-04-13：Critical bug fixes — 修复 schema.rs `try_from_account` 的 `mem::forget` 借用泄漏；修复 guard.rs `assert_pda` / `derive_ata` 的种子转换错误；修复 idioms.rs `close_account` 的 lamports 溢出保护；修复 idioms.rs 偏移计算的 `usize` 溢出保护。
- 2026-04-13：A-07/A-09 完成 — guard.rs 33 个单元测试全部通过（含 mock AccountView 辅助函数、curve25519 dev-dependency 修复）。
- 2026-04-13：A-11 完成 — dispatch.rs 5 个单元测试全部通过。
- 2026-04-13：A-13 完成 — idioms.rs 14 个单元测试全部通过。
- 2026-04-13：全量 `cargo test` 通过（64 个单元测试），`cargo doc --no-deps` 无警告，`cargo check --features full` 通过。
- 2026-04-13：A-14/A-15 完成 — idioms.rs 模块级知识文档扩展（P0: entrypoint/账户解构/TryFrom/CPI/self-CPI + P1: Token-2022/Batch/Codama/LiteSVM）。
- 2026-04-13：A-16 完成 — anti_patterns.rs 反模式文档，后续扩展为 7 项（Missing signer、Unchecked owner、PDA collision、Close drain、Catch-all dispatch、Unbounded alloc、Hidden padding）。
- 2026-04-13：A-17 完成 — client.rs 4 个客户端话题（Transaction/PDA/Deserialization/Error handling）+ fixture 测试策略。
- 2026-04-13：A-18 完成 — testing.rs 知识文档扩展（mollusk vs litesvm、CU profiling）。
- 2026-04-13：A-19 完成 — lib.rs crate 级文档补充 Feature Flags 表格。
- 2026-04-13：A-20/A-21 完成 — AGENTS.md + 7 个多 agent 入口文件（CLAUDE.md、GEMINI.md、.cursor/rules、.windsurf/rules、.github/copilot-instructions.md、.amazonq/rules、.aider.conf.yml）。
- 2026-04-13：A-22/A-23 完成 — 全量集成验证通过（`cargo test --all-features` 65/65、`cargo clippy --all-features` 0 警告、`cargo doc --no-deps` 0 警告、`cargo check --features full,test-utils` 通过）。
- 2026-04-14：Phase 8 E1-01/E1-02/E1-03 完成 — `lib/templates.js` 固化 canonical 模板 manifest，`initProject()` 改为先校验 manifest 再复制，新增 `tests/cli/templates.test.js` 与 `tests/cli/pack.test.js` 校验模板解析与 `npm pack --dry-run --json` 发布包内容。
- 2026-04-14：Phase 8 E1-04/E1-05/E1-06 完成 — `geppetto-cli init` 新增 `--dry-run` 预览模式；空目录 / 部分已有文件目录下均可输出 `would-create` / `skipped` 而不写盘；CLI help 已同步说明预览语义。
- 2026-04-14：Phase 8 E1-07/E1-08/E1-09 完成 — README 与 `docs/03-technical-spec.md` 明确模板版本映射规则；新增 `npm run release:check` 串联 CLI 测试与 pack smoke check；`docs/06` / `docs/07` / `docs/08` 与 README 已同步到 E1 delivered 状态。
- 2026-04-14：Phase 8 E2-01/E2-02/E2-03 完成 — 将 escrow fixture 对齐链路固化为 `npm run test:escrow-client-alignment`；`examples/escrow/tests/client_alignment.ts` 改为可由 `tsx` 直接执行；`src/client.rs`、`docs/03-technical-spec.md`、`docs/05-test-spec.md` 已指向真实示例路径与运行命令。
- 2026-04-14：Phase 8 E3-01/E3-02/E3-03 完成 — 新增 `lib/knowledge-manifest.js` 与 `lib/knowledge-check.js`，自动检查知识版本头的目标清单、`geppetto` / `pinocchio` 版本和日期格式；`tests/cli/knowledge.test.js` 已覆盖 happy path、缺失头、版本漂移、日期错误与常见 Cargo 依赖写法。
- 2026-04-14：Phase 8 E3-04/E3-05/E3-06 完成 — 新增 `lib/agent-entry-check.js`、`lib/feature-matrix-check.js` 与对应回归测试，自动检查 `CLAUDE.md` / `GEMINI.md` / `.cursor` / `.windsurf` / `.github` / `.amazonq` / `.aider` 是否仍正确镜像 `AGENTS.md`；并校验 `Cargo.toml` 与 `docs/03-technical-spec.md` 的 feature matrix 一致性，`npm run docs:check` 现已串联知识头、入口镜像与 feature matrix 检查。
- 2026-04-14：Phase 8 E3-07 完成 — `npm run release:check` 已接入 `npm run docs:check`，发布前检查链路统一包含 CLI 测试、文档一致性检查与 `npm pack --dry-run --json`。
- **风险说明**：PDA/ATA 测试依赖 `solana-address` 的 `curve25519` feature，已加入 dev-dependencies；后续若升级 pinocchio 版本需确认该依赖仍然有效。
- **下一步**：继续推进 Phase 8 的发布/审查收口（E3-08）。

## 6.3 验收条件（进入 Phase 7）

- [x] 关键路径任务 A-02 到 A-23 全部完成并通过。
- [x] 代码与 `docs/03-technical-spec.md` 保持 1:1 契约一致。
- [x] `cargo test` 覆盖并通过 Phase 5 定义的 happy/boundary/error 案例框架（65/65 通过）。
- [x] `cargo test --doc` 覆盖所有公开 doc 示例（ignored doctest 为预期行为）。
- [x] `cargo doc --no-deps` 0 警告，`cargo clippy --all-features` 0 警告。
- [x] 关键任务间无阻塞，执行日志持续记录并附 1 句风险说明。

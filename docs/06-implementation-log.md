# Phase 6: Implementation Log — Geppetto

> 状态：待开始（准备中）
> 日期：2026-04-13
> 输入：Phase 5 测试规格

本阶段从 Phase 3/5 的契约开始实现。

**当前代码状态（2026-04-13）**：
- `Cargo.toml` — 完整（依赖、features、metadata 与 Phase 3 一致）
- `src/lib.rs` — 完整（`#![no_std]`、re-export、feature gates、模块声明、crate doc）
- `src/{guard,schema,dispatch,error,idioms,anti_patterns,client,testing}.rs` — 空文件（骨架已创建，业务逻辑待实现）
- `src/main.rs` — 已删除（library crate 不需要 binary entrypoint）
- A-02 任务已完成，A-03 起待实现

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

- 2026-04-13：完成阶段文档自检，确认已存在 `00-05`；缺失 06-08，当前进入文档闭环准备。
- 2026-04-13：已生成 `docs/06-implementation-log.md`（本文），用于下一阶段执行记录。
- 2026-04-13：仓库当前已有 `Cargo.toml`、`.gitignore`、`README.md`、`docs/` 目录骨架，待补齐 `src/lib.rs` 与业务模块。
- 2026-04-13：Code Review 修复 — Cargo.toml license 统一为 `MIT OR Apache-2.0`；README 状态更新为 Phase 3；PRD 补充扩展 guard 列表；Tech Spec 中 assert_rent_exempt 警告增强、close_account 安全文档补充、Token/ATA 程序 ID 填充真实字节数组、unsafe 文档严格化、testing.rs feature gate 统一到 lib.rs、client fixture 测试策略补充 package.json 示例。

## 6.3 验收条件（进入 Phase 7）

- [ ] 关键路径任务 A-02 到 A-13 全部完成并通过。
- [ ] 代码与 `docs/03-technical-spec.md` 保持 1:1 契约一致。
- [ ] `cargo test` 覆盖并通过 Phase 5 定义的 happy/boundary/error 案例框架。
- [ ] `cargo test --doc` 覆盖所有公开 doc 示例。
- [ ] 关键任务间无阻塞，执行日志持续记录并附 1 句风险说明。


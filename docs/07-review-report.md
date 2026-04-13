# Phase 7: Review & Deploy — Geppetto

> 状态：已完成
> 日期：2026-04-13
> 输入：Phase 6 实现日志（A-02 ~ A-23 全部完成）
> 审查基线：Phase 7 最终已验证基线 = `85b2416`

## 7.1 审查目标

确认从 `src` 到 `tests` 的实现与以下三类目标一致：
- 功能正确性：符合 PRD 里的 FR 与技术规格的可观测行为。
- 工程一致性：与 Pinocchio 生态版本匹配、无额外运行时副作用、接口命名清晰。
- 风险可控性：高风险模块具备可复核边界行为。

## 7.2 机器审查结果

| 检查项 | 命令 | 结果 |
|--------|------|------|
| 单元测试 | `cargo test --all-features` | 65/65 通过 |
| Doctest | `cargo test --doc` | 通过（ignored 为预期行为） |
| Clippy | `cargo clippy --all-features` | 0 警告 |
| 文档 | `cargo doc --no-deps` | 0 警告，无断链 |
| 格式 | `cargo fmt --check` | 通过 |
| 编译 | `cargo check --features full,test-utils` | 通过 |

## 7.3 人工审查结果

**安全关键路径**（已复核）：
- `guard::assert_signer` / `assert_writable` / `assert_owner` / `assert_pda` / `assert_ata` — 边界条件覆盖完整，错误码与 Phase 3 一致。
- `schema::try_from_account` — owner + length + discriminator 三层校验，unsafe 块有 soundness 注释。
- `dispatch::split_tag` — 空输入返回 `InvalidInstructionData`，无 catch-all 风险。
- `idioms::close_account` — lamports 溢出保护（`checked_add`）+ 数据清零。

**知识文档**（已复核）：
- 所有模块包含标准版本头 `geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13`。
- `AGENTS.md` 包含 Mechanical Rules 和 Knowledge Freshness Rules。
- 多 agent 入口文件齐全（CLAUDE.md, GEMINI.md, .cursor/rules, .windsurf/rules, .github/copilot-instructions.md, .amazonq/rules, .aider.conf.yml）。

**审查中发现并修复的问题**：
1. `client.rs` PDA seed 示例曾使用 `Buffer.from(maker.address)`（base58 文本）→ 修复为 `getAddressEncoder().encode()`（原始 32 字节）。
2. `client.rs` 反序列化示例曾使用 `.toBase58()`（不存在的方法）→ 修复为 `encodeBase58()`。
3. `AGENTS.md` 中 `full` feature 被描述为 "Need everything"，但未包含 `test-utils` → 修复为明确区分 runtime CPI features 与 test utilities。
4. `anti_patterns.rs` 标题存在未闭合反引号 → 已修复。

## 7.4 部署前核对清单

- [x] 可复现构建：`cargo test --all-features`、`cargo doc --no-deps`
- [x] 版本号与依赖策略：`pinocchio 0.11.x` 与可选 helper 版本符合 `docs/03-technical-spec.md` 契约
- [x] 文档入口一致：`AGENTS.md` + 多入口规则文件齐全
- [x] 代码格式化：`cargo fmt` 通过

## 7.5 交付物清单

**代码模块**（`src/`）：
- `lib.rs` — crate 入口 + re-export + feature gates + crate doc
- `error.rs` — `GeppettoError`（4 个错误码 0x4700-0x4703）
- `schema.rs` — `AccountSchema` trait + `assert_account_size!` 宏 + 12 个单元测试
- `guard.rs` — 12 个 guard 函数 + 4 个 well-known 常量 + 33 个单元测试
- `dispatch.rs` — `split_tag` + 2 个 discriminator 常量 + 5 个单元测试
- `idioms.rs` — 4 个导出函数 + P0/P1 知识文档 + 14 个单元测试
- `anti_patterns.rs` — 6 个反模式文档
- `client.rs` — 4 个客户端话题 + fixture 测试策略
- `testing.rs` — 3 个测试工具函数 + 测试策略知识文档

**Agent 指引文件**（根目录）：
- `AGENTS.md` — 完整 agent 指令
- `CLAUDE.md` / `GEMINI.md` / `.cursor/rules/geppetto.md` / `.windsurf/rules/geppetto.md` / `.github/copilot-instructions.md` / `.amazonq/rules/geppetto.md` / `.aider.conf.yml`

**文档**（`docs/`）：
- `00-business-validation.md` / `01-prd.md` / `02-architecture.md` / `03-technical-spec.md` / `04-task-breakdown.md` / `05-test-spec.md` / `06-implementation-log.md` / `07-review-report.md` / `08-evolution.md`

## 7.6 风险与回滚

- **已知风险**：PDA/ATA 单元测试依赖 `solana-address` 的 `curve25519` dev-dependency。若未来升级 `pinocchio` 导致 `solana-address` major 版本变更，需重新确认该 feature 的可用性。
- **回滚条件**：若 `AccountSchema`、`assert_pda` 或 `close_account` 出现逻辑回归，优先回滚至 `85b2416`（Phase 7 最终已通过全量验证并完成审查的基线）。

## Phase 7 验收标准

- [x] 已完成的实现通过人工与机器审查并有签字记录
- [x] 无严重安全缺陷与关键错误码不一致
- [x] 可发布前置条件齐全，且有部署回退方案
- [x] 文档与代码同步，未出现技术规格偏离

# Phase 7: Review & Deploy — Geppetto

> 状态：已完成（含后续跟进审查）
> 日期：2026-04-14
> 输入：Phase 6 实现日志（A-02 ~ A-23 全部完成）+ 后续外部修改、文档收口、escrow 示例补丁与最终收尾修正
> 审查基线：Phase 7 最终已验证基线 = `85b2416`
> 当前收口基线：`825a401`

## 7.1 审查目标

确认从 `src` 到 `tests` 的实现与以下三类目标一致：
- 功能正确性：符合 PRD 里的 FR 与技术规格的可观测行为。
- 工程一致性：与 Pinocchio 生态版本匹配、无额外运行时副作用、接口命名清晰。
- 风险可控性：高风险模块具备可复核边界行为。

## 7.2 机器审查结果

| 检查项 | 命令 | 结果 |
|--------|------|------|
| 单元测试 | `RUSTC_WRAPPER= cargo test --all-features` | 65/65 通过 |
| Doctest | `RUSTC_WRAPPER= cargo test --doc` | 通过（ignored 为预期行为） |
| Clippy | `RUSTC_WRAPPER= cargo clippy --all-targets --all-features -- -D warnings` | 0 警告 |
| 文档 | `RUSTC_WRAPPER= cargo doc --no-deps` | 0 警告，无断链 |
| 格式 | `RUSTC_WRAPPER= cargo fmt --check` | 通过 |
| 编译 | `RUSTC_WRAPPER= cargo check --features full,test-utils` | 通过 |
| escrow 示例构建 | `RUSTC_WRAPPER= cargo build-sbf --manifest-path examples/escrow/Cargo.toml` | 通过 |
| escrow 示例测试 | `RUSTC_WRAPPER= cargo test --manifest-path examples/escrow/Cargo.toml --all-features` | integration 12/12 + svm 8/8 通过 |
| CLI 发布前检查 | `npm run release:check` | 通过（CLI 测试 8/8 + `npm pack --dry-run --json` 模板打包校验） |
| escrow ↔ client 对齐检查 | `npm run test:escrow-client-alignment` | 通过（Rust fixture 生成 + TypeScript 反序列化 6/6 字段对齐） |
| 知识版本头一致性检查 | `node lib/knowledge-check.js` | 通过（19 个目标文件，版本/日期格式一致） |

## 7.3 人工审查结果

**安全关键路径**（已复核）：
- `guard::assert_signer` / `assert_writable` / `assert_owner` / `assert_pda` / `assert_ata` — 边界条件覆盖完整，错误码与 Phase 3 一致。
- `schema::try_from_account` — owner + length + discriminator 三层校验，unsafe 块有 soundness 注释。
- `dispatch::split_tag` — 空输入返回 `InvalidInstructionData`，无 catch-all 风险。
- `idioms::close_account` — lamports 溢出保护（`checked_add`）+ 数据清零。

**知识文档**（已复核）：
- 所有知识模块包含标准版本头；日期已按模块更新时间分布在 `2026-04-13` / `2026-04-14`，并通过自动检查。
- `AGENTS.md` 包含 Mechanical Rules 和 Knowledge Freshness Rules。
- 多 agent 入口文件齐全（CLAUDE.md, GEMINI.md, .cursor/rules, .windsurf/rules, .github/copilot-instructions.md, .amazonq/rules, .aider.conf.yml）。

**审查中发现并修复的问题**：
1. `client.rs` PDA seed 示例曾使用 `Buffer.from(maker.address)`（base58 文本）→ 修复为 `getAddressEncoder().encode()`（原始 32 字节）。
2. `client.rs` 反序列化示例曾使用 `.toBase58()`（不存在的方法）→ 修复为 `encodeBase58()`。
3. `AGENTS.md` 中 `full` feature 被描述为 "Need everything"，但未包含 `test-utils` → 修复为明确区分 runtime CPI features 与 test utilities。
4. `anti_patterns.rs` 标题存在未闭合反引号 → 已修复。
5. `src/idioms.rs` / `src/testing.rs` 已重构为目录模块（`src/idioms/`、`src/testing/`），并保持原有导出面兼容；重构后重新通过全量机器审查。
6. 对外 idioms / public docs 一度回退为直接示范 `pinocchio::*` / `pinocchio_*` 导入，违背 `AGENTS.md` 的 facade 规则 → 已统一回 `geppetto::*`、`geppetto::token::*`、`geppetto::log::*`、`geppetto::pubkey::*`；内部实现规格文档则明确标注为底层 `pinocchio::*` 细节。
7. 文档矩阵一度与当前实现漂移：`full` feature 少写了 `log` + `pubkey`，README 把 `idioms` / `testing` 仍标成 Doc-only，且多处文案仍提 `bankrun` → 已统一为当前实现（`full = ["system", "token-all", "memo", "log", "pubkey"]`，测试能力描述为 `litesvm / mollusk-svm`）。
8. `AccountSchema::validate` 已接受严格定长语义（`data.len() == LEN`），错误码为 `InvalidAccountLen`；相关架构/技术规格/测试规格已同步，且明确声明：若账户允许 TLV / trailer bytes，应覆盖 `validate()`。
9. `examples/escrow/src/instructions/create.rs` 原实现仅接受已由本程序拥有的 escrow 账户，导致真实链上“首建 PDA + 初始化”路径不可达；现已补上 system-owned 空 PDA 的创建路径，使用 `geppetto::system::create_account_with_minimum_balance_signed(...)` 完成创建并初始化。
10. 同一 `create` 流程此前可覆盖历史状态账户；现已增加“仅未初始化可写入”保护：对 program-owned 路径要求正确长度、非零 lamports 且数据全零，否则返回 `EscrowError::AlreadyInitialized (0x102)`；同时关闭/抽干后的旧账户也不可复用。
11. `examples/escrow/tests/integration.rs` 与 `examples/escrow/tests/svm.rs` 已补充重初始化失败与 closed-account 不可重建等回归用例，确认 create 语义与错误码稳定。
12. `examples/escrow/tests/svm.rs` 原先 `include_bytes!(target/deploy/...)` 对构建产物缺失过于脆弱；现改为运行时读取 `.so`，并在缺失时给出明确提示，要求先执行 `cargo build-sbf --manifest-path examples/escrow/Cargo.toml`。
13. `src/client.rs` 中 Codama 段落已改为 CLI / 独立 generator crate 语境，不再给出与 derive 叙述不自洽的 `build-dependencies` 示例。
14. `src/idioms/cpi.rs` 中 Token `Transfer` 公共示例已补上 `multisig_signers: &[]`，与当前 CPI 结构体字段保持一致。
15. `src/testing/mollusk.rs` 对 `Mollusk::new(...)` 的说明已从“自动发现总能成功”改为更保守的表述，明确其依赖搜索路径与项目布局；同时建议在需要稳定 CI 行为时优先显式加载程序字节。
16. 多份文档仍写“6 个反模式”，但当前实现已为 7 个；相关技术规格、演进文档、任务拆解与实现日志均已同步到 7 项（新增 hidden padding 风险）。
17. `cargo fmt --check` 曾因 `src/idioms/helpers.rs` 的测试折行样式失败；现已执行 `cargo fmt`，格式检查恢复通过，避免 CI 风格噪音。
18. `examples/escrow/src/lib.rs` 顶层文案此前仍写“deposits/reclaims tokens”，与当前仅演示 escrow 状态生命周期的实现不符；现已改为准确描述 create / exchange / close 的状态语义。
19. `examples/escrow/src/lib.rs` 中 `geppetto::default_allocator!()` / `geppetto::nostd_panic_handler!()` 在当前工具链下会触发 `unexpected cfg value: solana` 警告；该示例 crate 已局部增加 `#![allow(unexpected_cfgs)]` 以消除非功能性噪音，不影响主库逻辑与安全语义。
20. `geppetto-cli init` 的模板来源此前隐含在 `lib/init.js` 内部，缺少显式 manifest 与打包级校验；现已抽出 `lib/templates.js` 作为 canonical 清单，并用 `tests/cli/templates.test.js` / `tests/cli/pack.test.js` 守住仓库源文件与 npm 包内容的一致性。
21. CLI 此前缺少预览语义，用户无法在写盘前确认 create / skip 结果；现已新增 `init --dry-run`、help 文案说明，以及“空目录 / 部分已有文件”两类回归测试，确保 dry-run 无文件系统副作用。
22. README 与 Phase 8 状态此前仍把 Evolution 描述为“已完成”，且未解释 CLI 模板版本如何映射到 crate/doc 基线；现已统一为“Phase 8 进行中，E1 已交付”，并明确模板版本锁定到同一 package/repository release。
23. escrow 的 Rust fixture 生成与 TypeScript 读取链路此前虽已存在，但缺少统一运行入口，且文档仍引用旧的 `tests/...` 路径；现已增加 `npm run test:escrow-client-alignment`，并将 `src/client.rs` / `docs/03-technical-spec.md` / `docs/05-test-spec.md` 同步到 `examples/escrow/tests/...` 的真实路径。
24. 知识版本头此前只靠人工约定维护，且 `guard.rs` / `idioms/helpers.rs` / `testing/helpers.rs` 缺少标准头；现已补齐头信息，并新增 `lib/knowledge-check.js` + `tests/cli/knowledge.test.js` 自动校验版本、日期格式与常见 Cargo 依赖声明（inline table / string / workspace）兼容性。

## 7.4 部署前核对清单

- [x] 可复现构建：`cargo test --all-features`、`cargo doc --no-deps`、`cargo build-sbf --manifest-path examples/escrow/Cargo.toml`
- [x] 版本号与依赖策略：`pinocchio 0.11.x` 与可选 helper 版本符合 `docs/03-technical-spec.md` 契约
- [x] 文档入口一致：`AGENTS.md` + 多入口规则文件齐全
- [x] 代码格式化：`cargo fmt` 通过

## 7.5 交付物清单

**代码模块**（`src/`）：
- `lib.rs` — crate 入口 + re-export + feature gates + crate doc
- `error.rs` — `GeppettoError`（4 个错误码 0x4700-0x4703）
- `schema.rs` — `AccountSchema` trait + `assert_account_size!` 宏 + 12 个单元测试
- `guard.rs` — 12 个 guard 函数 + well-known program ID 常量 + 单元测试
- `dispatch.rs` — `split_tag` + 2 个 discriminator 常量 + 单元测试
- `idioms/` — 主题化知识子模块（`accounts` / `entrypoint` / `pda` / `cpi` / `events` / `architecture`）+ `helpers.rs` 导出函数
- `anti_patterns.rs` — 7 个反模式文档（含 padding 风险）
- `client.rs` — 客户端构建 / 对齐策略 / Codama 指南 / ecosystem references
- `testing/` — `helpers.rs` + `mollusk.rs` + `litesvm.rs`，提供断言工具与测试知识文档

**Agent 指引文件**（根目录）：
- `AGENTS.md` — 完整 agent 指令
- `CLAUDE.md` / `GEMINI.md` / `.cursor/rules/geppetto.md` / `.windsurf/rules/geppetto.md` / `.github/copilot-instructions.md` / `.amazonq/rules/geppetto.md` / `.aider.conf.yml`

**CLI / 发布校验**：
- `bin/geppetto-cli.js` — `init` 命令入口、`--dry-run` 参数解析与 usage/help 输出
- `lib/init.js` / `lib/templates.js` / `lib/release-check.js` — canonical 模板复制逻辑、manifest 约束与发布前检查入口
- `tests/cli/init.test.js` / `tests/cli/templates.test.js` / `tests/cli/pack.test.js` — create/skip/dry-run 行为、manifest 对齐、npm pack smoke test

**文档一致性校验**：
- `lib/knowledge-manifest.js` / `lib/knowledge-check.js` — 知识版本头目标清单与可执行检查器
- `tests/cli/knowledge.test.js` — 知识头 happy/error/workspace 依赖写法回归测试

**示例 / 对齐校验**：
- `examples/escrow/tests/generate_fixtures.rs` — Rust fixture 生成器（导出 escrow binary + layout JSON）
- `examples/escrow/tests/client_alignment.ts` — TypeScript 侧字段反序列化校验
- `npm run test:escrow-client-alignment` — 串联 fixture 生成与 TypeScript 对齐检查

**文档**（`docs/`）：
- `00-business-validation.md` / `01-prd.md` / `02-architecture.md` / `03-technical-spec.md` / `04-task-breakdown.md` / `05-test-spec.md` / `06-implementation-log.md` / `07-review-report.md` / `08-evolution.md`

## 7.6 风险与回滚

- **已知风险**：PDA/ATA 单元测试依赖 `solana-address` 的 `curve25519` dev-dependency。若未来升级 `pinocchio` 导致 `solana-address` major 版本变更，需重新确认该 feature 的可用性。
- **语义风险**：`AccountSchema::validate` 已收紧为严格定长（`== LEN`）。这能更好表达固定布局零拷贝账户，但若未来需要支持 TLV / trailer bytes，必须由具体账户类型覆盖 `validate()` 并补充专门测试，不能默认沿用当前语义。
- **回滚条件**：若 `AccountSchema`、`assert_pda`、`assert_ata`、`close_account` 或 `examples/escrow` 的 `create` 初始化路径出现逻辑回归，优先回滚至 `85b2416`；若仅是本轮文档/知识层回归，可从当前收口基线 `825a401` 重新整理。 

## Phase 7 验收标准

- [x] 已完成的实现通过人工与机器审查并有签字记录
- [x] 无严重安全缺陷与关键错误码不一致
- [x] 可发布前置条件齐全，且有部署回退方案
- [x] 文档与代码同步，未出现技术规格偏离

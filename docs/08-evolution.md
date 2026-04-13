# Phase 8: Evolution — Geppetto

> 状态：已完成
> 日期：2026-04-13
> 输入：Phase 7 审查报告（HEAD = `85b2416`）
> 目标：把 A-02 ~ A-23 的已交付结果固化为后续演化基线，并明确子模块 B/C 的推进顺序、复杂度预算与回滚策略。

## 8.1 当前基线

截至 `85b2416`，Geppetto 已完成以下闭环：

- 核心 crate：`guard` / `schema` / `dispatch` / `error` / `idioms`
- 知识模块：`anti_patterns` / `client` / `testing` / crate-level docs
- Agent 入口：`AGENTS.md` + 7 个多 agent 入口文件
- 验证状态：`cargo test --all-features`、`cargo clippy --all-features`、`cargo doc --no-deps`、`cargo fmt --check` 全通过

这意味着 Phase 8 不再讨论“是否实现”，而是确认：

1. 哪些设计已经稳定，后续只能通过 ADR 变更；
2. 哪些能力应放到子模块 B/C 演化，而不是继续膨胀核心 crate；
3. 未来升级 `pinocchio` 或扩展 feature 时，如何保持文档、agent 指令与实现一致。

## 8.2 决策日志（ADR 风格）

### ADR-001：单 crate 继续作为 Pinocchio 透传入口

- 决策：`geppetto` 继续保持单 crate 结构；核心 SDK 直接 re-export，CPI helpers 维持 feature-gated 子模块。
- 状态：Accepted
- 理由：
  - 对 agent 最友好，入口固定为 `geppetto::*`
  - 迁移成本低，适合从官方 Pinocchio 模板逐步引入
  - 与 PRD 中 “不包装、不改 API、仅透传 + 约束” 的定位一致
- 风险：feature 组合增多后，说明文档和示例容易漂移。
- 约束：新增 helper crate 只允许通过新 feature 引入，不拆第二个核心 crate。

### ADR-002：`AccountSchema` 继续使用 trait + const，暂不引入 derive 宏

- 决策：保留当前 `AccountSchema` + `assert_account_size!` 模型，短期内不引入 proc-macro 自动派生。
- 状态：Accepted
- 理由：
  - 当前实现已经通过人工审查、单测和 doctest 验证
  - trait + const 对 agent 可见性最好，字段布局信息可直接阅读
  - 避免宏展开隐藏逻辑，降低审计成本
- 风险：调用方手写 offset 时仍可能出错。
- 缓解：
  - 继续要求 `layout()`、`LEN`、`DISCRIMINATOR` 与测试夹具同步
  - 若未来确实需要生成能力，优先放进子模块 B（CLI / codegen），而不是污染核心 runtime API

### ADR-003：知识文档与 agent 入口继续采用版本头 + 单一事实源

- 决策：所有知识模块保持 `geppetto 版本 | pinocchio 版本 | 日期` 三段版本头；`AGENTS.md` 作为所有 agent 入口文件的单一事实源。
- 状态：Accepted
- 理由：
  - 已在 Phase 7 中证明这套机制能暴露知识新鲜度并承载审查修复
  - 多入口文件只做跳转，减少规则分叉
- 风险：入口文件与 `AGENTS.md` 内容漂移。
- 缓解：子模块 B 的 `geppetto-cli init` 必须从同一模板生成所有入口文件。

### ADR-004：运行时 feature 与测试工具 feature 明确分离

- 决策：`full` 仅表示运行时 CPI helper 的全集，不包含 `test-utils`；测试工具保持独立 opt-in。
- 状态：Accepted
- 理由：
  - 避免用户误把测试能力带入运行时依赖预期
  - 与当前 `Cargo.toml` 实现保持一致：`full = ["system", "token-all", "memo"]`
  - Phase 7 review 已验证这是高频误解点，需在长期治理里固化
- 风险：用户误以为 “full = everything”。
- 缓解：所有后续文档、CLI 初始化模板、示例工程都必须显式区分 runtime features 与 test utilities。

### ADR-005：核心安全语义继续走 docs-first + review-first 变更流程

- 决策：凡是涉及 signer / owner / PDA / discriminator / rent / close 语义的变更，必须先更新 `docs/03-technical-spec.md`，再改代码，并在 Phase 7 风格报告中留痕。
- 状态：Accepted
- 理由：
  - 当前项目的价值不只是代码，还包括“agent 能读懂且不会被误导”的契约
  - 这些路径一旦漂移，会直接影响安全性或生成结果
- 风险：为了赶进度绕过规格更新，导致文档与代码脱节。
- 缓解：未来任何发布前检查都要把 spec diff、实现 diff、review report 一起核对。

## 8.3 复杂度预算（按真实状态修订）

### 运行时公开面预算

当前公开面已包含：

- 1 个核心 trait：`AccountSchema`
- 1 个编译期宏：`assert_account_size!`
- 12 个 guard helpers + 若干 well-known constants
- 1 个 dispatch helper + 2 个 discriminator constants
- 4 个 idioms helpers
- 3 个测试辅助函数（`test-utils` feature-gated）

后续预算规则：

- 在 `1.0` 前，每个新里程碑最多新增 `<= 3` 个运行时公开 API；
- 若新增 API 会改变 agent 推荐写法，必须先补 ADR；
- 能放入示例、CLI 模板、测试工具层解决的问题，不进入核心运行时模块。

### 依赖与版本预算

- `pinocchio` 主依赖短期锁定在 `0.11.x`
- 升级 `pinocchio` minor/major 前，必须完成：
  - feature matrix 复核
  - knowledge version header 更新
  - `cargo test --all-features`
  - `cargo clippy --all-features`
  - `cargo doc --no-deps`

### 文档与规则预算

- `AGENTS.md` 保持唯一源文件；其他入口文件不允许手写分叉规则
- 知识模块只在以下情况扩容：
  - 新增了真实功能
  - 审查发现高频误导点
  - `pinocchio` / Solana 官方模式发生演化

## 8.4 长期演化路径（Milestones）

### Milestone E1：子模块 B — `geppetto-cli init`

- 目标：实现 `npx geppetto-cli init`
- 范围：B-01 ~ B-03
- 交付：
  - 生成 `AGENTS.md`
  - 生成 7 个 agent 入口文件
  - 已有文件默认不覆盖
- 风险：
  - 模板内容与仓库内 `AGENTS.md` 漂移
  - CLI 初始化出的内容与最新 feature 说明不一致
- 回滚策略：
  - 若模板校验失败，停止发布 npm 包，仅保留仓库内手工入口文件为 canonical source

### Milestone E2：子模块 C — escrow demo + fixture 对齐

- 目标：提供一个从合约到 TypeScript 客户端的端到端示例
- 范围：C-01 ~ C-03
- 交付：
  - escrow 示例程序
  - litesvm 端到端测试
  - Rust fixture → TypeScript 反序列化对齐验证
- 风险：
  - 示例随着核心 crate 演化而失效
  - client 文档与真实 fixture 偏移量不一致
- 回滚策略：
  - 若示例先失稳，不回滚核心 crate；先冻结 demo 到最后一个已验证 tag，并标记示例版本

### Milestone E3：文档与规则自动化

- 目标：减少“知识对了，但入口文件或示例漂移”的维护成本
- 候选内容：
  - AGENTS 多入口文件自动生成脚本
  - knowledge version / pinocchio version 一致性检查
  - `client.rs` 示例与 fixture 存在性校验
- 风险：自动化本身成为额外维护负担
- 回滚策略：若自动化复杂度高于收益，保留人工流程，但必须保留检查清单

## 8.5 演化治理规则

- 任何关键逻辑变更都必须先更新 `docs/03-technical-spec.md` 再改代码。
- 任何新增错误码必须同步更新：
  - `src/error.rs`
  - 相关测试
  - 对应知识文档
  - 客户端错误映射示例
- `AGENTS.md` 与多入口文件必须同次变更、同次审查。
- 若 `pinocchio` 版本变化或知识头超过 3 个月未刷新，必须重新验证并更新时间戳。
- 发布前最小检查集合固定为：
  - `cargo test --all-features`
  - `cargo clippy --all-features`
  - `cargo doc --no-deps`
  - `cargo fmt --check`

## 8.6 退化与回滚原则

- 核心安全语义（`AccountSchema`、`assert_pda`、`assert_owner`、`close_account`）出现回归时，优先回滚到 `85b2416` 这一已完成 Phase 7 审查的基线。
- 子模块 B/C 允许独立冻结，不应为了示例或 CLI 问题回滚核心 crate 的已验证安全修复。
- 若出现文档/agent 入口与实现不一致：
  - 暂停新发布
  - 先修复文档与入口文件
  - 再恢复后续开发
- 遇到签名、owner、PDA、rent、close 相关高风险变更，必须先完成离线审查再合并。

## 8.7 Phase 8 验收标准

- [x] ADR 与复杂度预算更新为项目真实状态
- [x] 长期演化路径清晰，包含下一阶段里程碑与回退条件
- [x] 版本治理规则可执行，且与实际发布流程对齐
- [x] Phase 7 审查报告与变更历史可追溯


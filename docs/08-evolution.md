# Phase 8: Evolution — Geppetto

> 状态：已完成
> 日期：2026-04-13
> 输入：Phase 7 审查报告（reviewed baseline = `85b2416`）
> 目标：把 A-02 ~ A-23 的已交付结果固化为后续演化基线，并明确子模块 B/C 的推进顺序、复杂度预算与回滚策略。

## 8.1 当前基线

截至 Phase 7 最终审查基线 `85b2416`，Geppetto 已完成以下闭环：

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
  - 与当前 `Cargo.toml` 实现保持一致：`full = ["system", "token-all", "memo", "log", "pubkey"]`
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

### Milestone E4：上游变更自动追踪

- 目标：当 pinocchio / mollusk / litesvm 发布新版本时，自动检测并创建更新 PR
- 实现方案（GitHub Actions）：
  - **定期检查**（每周 cron）：对比 Cargo.toml 中的 pinned version 与 crates.io 最新版本
  - **自动 PR**：如果上游有新版本，创建 PR，内容包括：
    1. Cargo.toml 版本 bump
    2. `cargo check --all-features` 结果
    3. `cargo test --all-features` 结果
    4. 上游 CHANGELOG 链接
    5. 需要人工检查的知识模块列表（根据 lib.rs Upstream Dependency Map）
  - **标签**：`upstream-update`，不自动合并，需人工审查知识模块
- 最小 CI workflow 草案：

```yaml
# .github/workflows/upstream-check.yml
name: Check upstream versions
on:
  schedule:
    - cron: '0 0 * * 1'  # every Monday
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check pinocchio
        run: |
          CURRENT=$(grep 'pinocchio =' Cargo.toml | head -1 | grep -oP '"\K[^"]+')
          LATEST=$(cargo search pinocchio --limit 1 | grep -oP '"\K[^"]+')
          if [ "$CURRENT" != "$LATEST" ]; then
            echo "pinocchio update available: $CURRENT → $LATEST"
            echo "NEEDS_UPDATE=true" >> $GITHUB_ENV
          fi
      # Similar for mollusk-svm, litesvm
      - name: Create PR if needed
        if: env.NEEDS_UPDATE == 'true'
        uses: peter-evans/create-pull-request@v5
        with:
          title: 'deps: upstream version update available'
          labels: upstream-update
```

- 风险：上游 breaking change 可能导致大量知识模块需要重写
- 缓解：PR 模板中包含"受影响模块清单"（从 lib.rs Dependency Map 自动生成），人工逐个验证

### Milestone E5：约定层 — `geppetto new` 项目脚手架

- 目标：从"知识告诉你怎么做"升级到"约定帮你做对"
- 类比：Next.js 早期的 `pages/` 约定——不是框架魔法，是目录结构 = 行为
- 交付：
  - `geppetto new <project-name>` 命令，生成标准 Pinocchio 项目结构：
    ```
    my-program/
    ├── Cargo.toml              ← geppetto 依赖 + crate-type = ["cdylib", "lib"]
    ├── AGENTS.md               ← 自动生成
    ├── CLAUDE.md / GEMINI.md   ← 多 agent 入口
    ├── src/
    │   ├── lib.rs              ← entrypoint 骨架（program_entrypoint + nostd_panic_handler）
    │   ├── processor.rs        ← dispatch::split_tag + match 骨架
    │   ├── state.rs            ← AccountSchema 示例
    │   ├── error.rs            ← 自定义错误枚举骨架
    │   └── instructions/
    │       └── mod.rs
    └── tests/
        └── svm.rs              ← mollusk-svm 测试骨架
    ```
  - 约定规则（写入 AGENTS.md）：
    - `src/instructions/` 下每个文件 = 一条指令
    - `src/state.rs` 中每个 `impl AccountSchema` = 一个账户类型
    - `src/processor.rs` 的 match 分支 = 指令路由表
  - Agent 打开项目，读 AGENTS.md，立刻知道文件在哪、该改哪里
- 前置条件：E1（geppetto-cli）完成
- 风险：约定过死导致高级用户抵触
- 缓解：约定是建议不是强制——生成后用户可以自由修改结构
- 不做：不做 derive macro，不做代码生成，不隐藏任何逻辑

### Milestone E6：工具层 — `geppetto test` / `geppetto audit`

- 目标：从"知识教你用 mollusk"升级到"一个命令帮你跑完"
- 类比：Next.js 的 `next build` / `next lint`——底层是 webpack + eslint，但开发者不需要配置
- 交付：
  - `geppetto test`：
    1. 自动执行 `cargo build-sbf`（如果 .so 不存在或源码更新了）
    2. 执行 `cargo test --all-features`
    3. 输出 CU 消耗报告（从 mollusk 的 `compute_units_consumed` 提取）
    4. 如果有 CU 预算文件（`cu-budget.toml`），对比并报告超标
  - `geppetto audit`：
    1. 静态检查：扫描源码中是否存在 `anti_patterns.rs` 列出的 6 个反模式
    2. Guard 覆盖率：检查每条指令的 handler 是否调用了 `assert_signer` / `assert_owner` 等
    3. AccountSchema 一致性：检查 `LEN` 和 `layout()` 的偏移量是否自洽
    4. 输出报告：通过 / 警告 / 错误
  - `geppetto docs`：
    1. 执行 `cargo doc --no-deps`
    2. 验证所有知识模块的版本头是否与 Cargo.toml 匹配
    3. 检查是否有过期知识（>3 个月）
- 前置条件：E5（约定层）完成，项目结构可预测
- 风险：工具维护成本高，工具本身也需要跟随上游更新
- 缓解：工具层是薄包装，底层调用 cargo/mollusk/clippy，不重新实现
- 不做：不做 LSP 集成，不做 IDE 插件，不做实时 watch 模式（初版）

### Milestone E7：生态整合 — 官方合作

- 目标：将 Geppetto 的知识和约定回馈官方生态
- 可能的合作方式：
  1. 给 `anza-xyz/pinocchio` 提 PR：添加 AGENTS.md + 官方 skill
  2. 给 `anza-xyz/mollusk` 提 PR：添加 "Getting Started" agent 知识
  3. 给 `solana-foundation/solana-dev-skill` 提 PR：增强 Pinocchio 部分
  4. 给 `create-solana-dapp` 提 PR：添加 `pinocchio-geppetto` 模板
  5. 将 Geppetto 提交为官方推荐的 Pinocchio skill/harness
- 前置条件：E6 完成，有真实用户验证
- 指标：
  - Geppetto 被 >=3 个独立项目使用
  - escrow demo 的 A/B 对比数据有说服力
  - 官方核心贡献者认可 agent-first 方向
- 不做：不主动分裂社区，不定位为"替代 pinocchio"

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

- 核心安全语义（`AccountSchema`、`assert_pda`、`assert_owner`、`close_account`）出现回归时，优先回滚到 `85b2416` 这一最新 Phase 7 审查完成基线。
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


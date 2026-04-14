# Phase 8: Evolution — Geppetto

> 状态：进行中（E1/E2/E3/E4 已交付；E5 部分交付；E6 规划中）
> 日期：2026-04-14
> 输入：Phase 7 最终审查报告 + 已验证基线 `b7fcacc`
> 目标：以当前可发布基线为起点，明确 Geppetto 在 CLI、示例、规则自动化与上游协同上的下一阶段演化顺序，并约束新增复杂度。

## 8.1 当前基线（Phase 8 起点）

截至 `b7fcacc`，Geppetto 已具备可继续演化的稳定基线：

- **核心 crate**：`guard` / `schema` / `dispatch` / `error` / `idioms` / `anti_patterns` / `client` / `testing`
- **示例程序**：`examples/escrow/` 已覆盖 create / exchange / close 的状态流转，并通过 integration + svm 回归测试；`npm run test:escrow-client-alignment` 已打通 Rust fixture → TypeScript 反序列化对齐链路
- **CLI E1 已交付**：`geppetto-cli init` 已具备 canonical 模板 manifest、默认 skip 语义、`--dry-run` 预览、模板完整性测试、`npm pack` smoke test 与 `release:check` 发布前检查
- **多 agent 入口**：`AGENTS.md` + `CLAUDE.md` / `GEMINI.md` / `.cursor` / `.windsurf` / `.github` / `.amazonq` / `.aider`
- **文档闭环**：PRD、架构、技术规格、测试规格、实现日志、审查报告、演化文档已形成单仓库链路

当前稳定性结论：

- `cargo test --all-features --locked` 通过
- `RUSTC_WRAPPER= cargo test --doc --locked` 通过
- `RUSTC_WRAPPER= cargo test --manifest-path examples/escrow/Cargo.toml --all-features --locked` 通过
- `cargo fmt --check` 通过
- `RUSTC_WRAPPER= cargo clippy --all-features --locked` 通过
- `RUSTC_WRAPPER= cargo doc --no-deps --locked` 通过

因此，Phase 8 的核心问题不再是“补齐基础实现”，而是：

1. 如何在不破坏当前稳定契约的前提下继续扩展工具层；
2. 如何让 CLI / 示例 / 文档 / agent 入口持续同步；
3. 如何把当前已经验证过的规则沉淀为更低维护成本的流程。

## 8.2 已稳定决策（ADR 风格）

### ADR-001：公共使用面继续以 `geppetto::*` facade 为唯一教学入口

- 状态：Accepted
- 决策：所有面向用户、下游项目、agent 的公开文档与示例，统一使用 `geppetto::*`、`geppetto::token::*`、`geppetto::log::*`、`geppetto::pubkey::*`。
- 理由：
  - 这是产品契约，而非单纯实现细节；
  - 能把上游 Pinocchio 生态差异隔离在 Geppetto 的知识层中；
  - 已经在 Phase 7 中被证明是高频漂移点，必须固化。
- 约束：内部架构/技术规格允许提及 `pinocchio::*`，但必须明确标为底层实现细节。

### ADR-002：`AccountSchema` 严格定长语义保持不变

- 状态：Accepted
- 决策：`AccountSchema::validate` 继续采用 `data.len() == LEN` 的严格定长语义。
- 理由：
  - 与固定布局、零拷贝账户模型一致；
  - 能更早暴露错误布局、隐藏 padding 和错误反序列化；
  - 已完成代码、测试和文档同步。
- 约束：需要支持 TLV / trailer bytes 的账户类型，必须显式覆写 `validate()`，不能依赖默认实现。

### ADR-003：运行时 feature 与测试/工具 feature 持续分离

- 状态：Accepted
- 决策：`full` 只表示运行时 CPI helper 全集，不包含测试工具或其他开发期能力。
- 当前定义：`full = ["system", "token-all", "memo", "log", "pubkey"]`
- 理由：
  - 避免把测试能力误表述为运行时依赖；
  - 与当前 Cargo feature matrix 保持一致；
  - 已是文档漂移的历史问题之一。

### ADR-004：安全语义继续遵循 docs-first + review-first

- 状态：Accepted
- 决策：涉及 signer / owner / PDA / discriminator / rent / close / schema 长度语义的变更，必须先更新 `docs/03-technical-spec.md`，再改代码，并在审查报告中留痕。
- 理由：
  - Geppetto 的核心价值不仅是 helper API，还包括 agent 不会被错误知识误导；
  - 这类语义漂移会直接影响生成质量和安全性。

### ADR-005：escrow 示例继续作为“状态机示例”，而非盲目膨胀为全功能 token demo

- 状态：Accepted
- 决策：`examples/escrow/` 目前继续定位为最小、可审计、可回归的 escrow 状态机示例。
- 理由：
  - 当前示例的价值在于演示 `AccountSchema`、`guard::*`、`dispatch`、create 初始化语义与测试模式；
  - 若直接扩张到完整 Token CPI / TS 客户端 / 多账户复杂路径，会让示例失去“最小可验证”的属性。
- 约束：未来若要增加 token CPI 或 TS client，应以新增阶段性交付形式推进，而非破坏当前最小示例可读性。

### ADR-006：CLI 模板与仓库内 canonical 文件必须单源同步

- 状态：Accepted
- 决策：`geppetto-cli init` 生成的文件必须始终来自仓库内 canonical 模板，不允许 CLI 与仓库文档分叉维护；模板版本始终绑定到同一 package/repository release，不另起独立版本线。
- 理由：
  - 当前 CLI MVP 已验证生成与 skip 语义；
  - E1 已补上 manifest、dry-run、pack smoke test 与 release gate，证明“单源 + 自动校验”成本可控；
  - 后续复杂度主要来自模板漂移，而不是命令本身。
- 约束：所有入口模板修改必须同时更新仓库源文件与 CLI 测试。

## 8.3 复杂度预算（以当前真实状态修订）

### 运行时公开面预算

当前运行时公开面已包含：

- 1 个核心 trait：`AccountSchema`
- 1 个编译期宏：`assert_account_size!`
- 12 个 guard helpers + well-known program constants
- 1 个 dispatch helper + 2 个 discriminator constants
- 4 个 idioms helpers
- 多个 feature-gated CPI re-export 子模块

预算规则：

- 在 `0.2.x` 之前，每个里程碑最多新增 `<= 3` 个核心运行时 API；
- 能通过文档、示例、CLI、测试工具解决的问题，不新增到 runtime 核心面；
- 若新增 API 会改变 agent 推荐写法，必须先补 ADR 和技术规格。

### 示例与工具预算

- 每个示例目录必须满足：
  - 至少一个 happy-path integration test
  - 至少一个失败路径回归 test
  - 若依赖 `.so`，必须给出缺失时的可执行提示
- CLI / 脚手架层功能必须保持“薄包装”：
  - 调用 cargo / npm / mollusk / litesvm
  - 不重复发明自己的构建系统

### 文档治理预算

- `AGENTS.md` 继续为单一事实源；
- 多 agent 入口文件仅作为同步镜像，不承载独立规则；
- 知识模块只有在以下情况下扩容：
  - 新增真实功能；
  - 审查发现高频误导点；
  - 上游 Pinocchio / Solana 模式发生变化。

## 8.4 下一阶段里程碑（按优先级排序）

### Milestone E1：CLI 硬化与模板同步自动校验

- 状态：**Delivered**
- 当前已有：
  - `geppetto-cli init`
  - `lib/templates.js` canonical 模板 manifest
  - 初始化测试 + manifest 测试 + `npm pack --dry-run --json` smoke test
  - 默认不覆盖已有文件
  - `init --dry-run` 预览能力与 help 文案
  - `npm run release:check`
  - README / Tech Spec 中的模板版本映射说明
- 收口结论：
  1. CLI 模板来源已从“隐式实现细节”提升为“显式 manifest + 测试 + 打包校验”契约；
  2. 用户可先预览 create / skip 结果，再决定是否写盘；
  3. 模板版本已明确绑定到同一 package/repository release。
- 风险：模板漂移造成 agent 入口与仓库规则不一致。
- 回滚策略：若自动同步链路不稳定，保留当前 MVP，只做严格测试，不增加额外 CLI 表面。

### Milestone E2：escrow 示例扩展为“端到端对齐示例”

- 状态：**Delivered**
- 当前已有：
  - Rust 合约
  - integration / svm 测试
  - create 初始化路径和防重初始化语义
  - `examples/escrow/tests/generate_fixtures.rs` 生成 binary + layout fixtures
  - `examples/escrow/tests/client_alignment.ts` 验证字段偏移与值
  - `npm run test:escrow-client-alignment` 统一运行入口
  - `src/client.rs` / `docs/03-technical-spec.md` / `docs/05-test-spec.md` 已绑定真实示例路径
- 收口结论：
  1. escrow 示例已具备 Rust → TypeScript 的最小对齐验证链路；
  2. 客户端知识文档不再停留在“未来计划”，而是直接指向可运行示例；
  3. 未引入额外前端框架或重型客户端生成流程，仍保持最小复杂度。
- 风险：示例很容易因文档演化而失配。
- 回滚策略：若端到端 client 层先失稳，不回滚核心 crate；冻结 demo 到最后一个已验证 tag。

### Milestone E3：文档/规则自动一致性检查

- 状态：**Delivered**
- 目标：降低“代码已对，但知识入口漂移”的维护成本。
- 当前已有：
  - `lib/knowledge-manifest.js` 明确知识版本头检查目标清单；
  - `lib/knowledge-check.js` 读取 `Cargo.toml` 并校验 `geppetto` / `pinocchio` 版本与日期格式；
  - `tests/cli/knowledge.test.js` 覆盖 happy path、缺失头、版本漂移、日期格式错误，以及常见 Cargo 依赖写法（inline table / string / workspace）；
  - `lib/agent-entry-check.js` 校验 `CLAUDE.md` / `GEMINI.md` / `.cursor` / `.windsurf` / `.github` / `.amazonq` / `.aider` 是否仍正确镜像 `AGENTS.md`；
  - `tests/cli/agent-entry.test.js` 覆盖 Claude include、通用 redirect 与 aider config 漂移场景；
  - `lib/feature-matrix-check.js` 检查 `Cargo.toml` / `docs/03-technical-spec.md` 的 feature matrix 一致性；
  - `tests/cli/feature-matrix.test.js` 覆盖漂移与版本化场景；
  - `npm run docs:check` 提供独立一致性入口，可在文档更新前快速联跑知识头、入口镜像与 feature matrix 检查；
  - `release:check` 已串联执行 `docs:check`，统一打通发布前知识/入口/feature 一致性检查；
  - `npm test` 已纳入知识头与 feature matrix 回归检查；
  - `src/guard.rs`、`src/idioms/helpers.rs`、`src/testing/helpers.rs` 已补齐知识版本头。
- 收口结论：
  1. 仓库已具备首条自动文档一致性检查链路，可在知识头缺失、agent 入口漂移或 feature matrix 不一致时立即失败；
  2. 多 agent 入口镜像现在也能自动检查，不再只靠人工复核；
  3. 检查器已兼容当前仓库与常见 Cargo 依赖声明变体；
  4. E3 首轮目标已从“人工约定”提升为“可执行 gate”。
- 后续扩展：
  - E3-08 收口完成：`docs/06`、`docs/07`、`docs/08` 同步补齐，发布门职责明确（`docs:check` 接入 `release:check`）。
- 风险：检查器本身成为新的维护负担。
- 回滚策略：若自动化过重，退回人工 checklist，但保留脚本接口与最小 smoke checks。

### Milestone E4：上游依赖更新追踪

- 状态：**Delivered**
- 目标：在 pinocchio / mollusk / litesvm 更新时，自动触发版本审查流程，并输出可直接用于人工审核的 PR 草稿。
- 最小能力：
  - 定时发现新版本；
  - 支持离线运行/可手工触发的 workflow；
  - `upstream-check` + PR body 生成器产出机器可读报告；
  - 附带版本差异、scope 与 required checks；
  - 列出需要人工复核的知识模块。
- 风险：上游 minor/major 更新触发大面积知识失效。
- 回滚策略：不自动合并任何依赖更新；必须由人工完成复核、签字后再合并，并确认相关知识模块无漂移风险。

#### E4-07 人工审查门禁（已完成）

规则：

- Upstream update automation may detect and prepare review artifacts, but dependency updates must never be auto-merged without manual knowledge review.
- 审查入口要求：
  - 先跑 `npm run upstream:check -- --json` 与 `npm run upstream:pr-body -- --from-json <result.json>`；
  - 逐条确认 `reviewScope` 覆盖了所有受影响的知识模块与文档；
  - 优先人工核对 `changelog / CHANGELOG` 与破坏性变更说明；
  - 若有 `update-available`，必须确认影响范围通过后再进入更新流程。

### Milestone E5：`geppetto new` 约定式项目脚手架

- 状态：**In Progress**
- 前置条件：E1 完成并稳定。
- 目标：从“init 入口文件”升级到“生成一套标准 Pinocchio + Geppetto 结构”。
- 已完成：
  - `geppetto new` 命令与 manifest/模板清单（E5-01）
  - 非覆盖语义与目录行为（E5-02）
  - 模板变量替换（E5-03）
  - Rust 骨架与测试骨架生成（E5-04，E5-05）
  - agent 入口模板复用（E5-06）
  - 生成结果 smoke test（E5-07）
- 进行中：
  - README / 文档接线（E5-08）
- 交付方向：
  - `src/lib.rs` / `processor.rs` / `state.rs` / `error.rs` / `instructions/`
  - `tests/svm.rs`
  - `AGENTS.md` 与多 agent 入口
- 不做：derive macro、隐藏逻辑、重型框架封装。
- 下一步：
  - E5-08 完成文档接线后，直接进入 E5-09 收口闭环。
- 风险：约定过强引发高级用户抵触。
- 缓解：脚手架只负责生成起点，不限制用户后续重构。

### Milestone E6：`geppetto test` / `geppetto audit` 工具层

- 状态：**Planned**
- 目标：把当前散落的最佳实践收敛为统一命令。
- `geppetto test` 候选能力：
  - 自动判定是否需要 `cargo build-sbf`
  - 统一执行 root tests + example tests
  - 输出 compute units / budget 报告
- `geppetto audit` 候选能力：
  - 扫描 7 个已知反模式
  - 检查 handler 是否遗漏关键 guard
  - 检查 `AccountSchema::LEN` / `layout()` 自洽性
- 风险：工具本身升级维护成本过高。
- 缓解：必须建立在现有 cargo / mollusk / 文档契约之上做薄包装。

### Milestone E7：生态协同与上游反馈

- 状态：**Backlog**
- 目标：将已验证的 agent-first 规则反馈到更大的 Pinocchio / Solana 生态。
- 候选动作：
  1. 向 Pinocchio 或相关官方仓库贡献 AGENTS / skill / getting-started 资料；
  2. 向 `create-solana-dapp` 贡献 Geppetto 友好模板；
  3. 把 Geppetto 的“公共 facade + 知识约束”方法沉淀为外部可复用规范。
- 前置条件：E1~E3 至少有一项完成并获得真实项目验证。

## 8.5 Phase 8 近期执行顺序（建议）

建议按以下顺序推进，而不是并行摊大饼：

1. **先做 E1：CLI 硬化**
   - 已完成；模板漂移已被 manifest + pack smoke test 锁住；
2. **再做 E2：escrow ↔ client 对齐示例**
   - 已完成；当前已具备最小 Rust fixture ↔ TypeScript 对齐链路；
3. **然后做 E3：文档一致性检查**
   - 已完成知识头、agent 入口镜像与 feature matrix 检查；接线与收口已完成，`docs:check` 已接入 `release:check`；
4. **推进 E4：上游依赖更新追踪**
   - 已完成：manifest、版本检查、影响映射、diff 检查脚本、workflow 草案、PR 审查模板、人工审查门禁与最小验证；
   - 里程碑闭环（E4-09）已完成；
   - 下一步：转向 E5 / E6；
5. **完成 E5 收口**
   - 已在推进：E5-08 文档接线，随后执行 E5-09 跨文档闭环；
   - 完成后再进入 E6 工具化方向（`geppetto test` / `geppetto audit`）。
   - E6 工具命令应建立在稳定模板与稳定示例之上。

不建议当前阶段优先做的内容：

- 大规模扩张 runtime API
- 引入 derive macro
- 在 example 中一次性加入完整 Token CPI、前端、IDL/codegen 全家桶
- 将 Geppetto 变成重型框架

## 8.6 Phase 8 治理规则

- 任何关键逻辑变更必须先更新 `docs/03-technical-spec.md` 再改代码；
- 任何新增错误码必须同步更新：
  - `src/error.rs` 或示例错误定义
  - 相关测试
  - 相关知识文档
  - 客户端错误映射示例（若对外可见）
- `AGENTS.md` 与多入口文件必须同次变更、同次审查；
- escrow 示例若改变 create / exchange / close 语义，必须同步更新：
  - `examples/escrow/src/lib.rs`
  - integration / svm tests
  - `docs/07-review-report.md`（若为安全/契约级修正）
- 遇到本地 `sccache: Operation not permitted` 环境问题，不视为代码回归；必要时统一使用 `RUSTC_WRAPPER=` 运行 Rust 命令。

## 8.7 退化与回滚原则

- 核心安全语义（`AccountSchema`、`assert_pda`、`assert_ata`、`assert_owner`、`close_account`）出现回归时，优先回滚到当前可发布基线 `b7fcacc`；如需对照 Phase 8 起点基线可参考 `ffa5535`。
- 示例、CLI、自动化工具允许独立冻结，不应为了它们的问题回滚核心 crate 已验证语义；
- 若出现文档 / agent 入口 / 示例与实现不一致：
  1. 暂停新发布；
  2. 优先修复知识层与入口文件；
  3. 再继续功能开发；
- 涉及 signer / owner / PDA / rent / close / schema length 的高风险变更，必须重新进入 Phase 7 风格的人工审查流程。

## 8.8 Phase 8 验收标准（草案）

- [x] 至少完成 1 个工具层或模板层里程碑（优先 E1 / E2 / E3）
- [x] CLI、示例、文档三者至少建立 1 条自动一致性检查链路
- [x] 不新增未经 ADR 记录的核心运行时公开语义
- [x] 保持 `b7fcacc` 基线以来的测试/文档/格式检查可稳定复现
- [x] 所有新增演化能力都具备明确回滚策略

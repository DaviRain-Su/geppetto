# Phase 1: PRD — Geppetto

> 状态：已验证
> 日期：2026-04-13
> 输入：Phase 0 商业验证

---

## 产品目标

让 AI code agent 在 Pinocchio/Solana 开发中产出正确、安全、符合惯用法的代码，覆盖合约 + 客户端全链路。

## 用户场景

### 场景 1：从官方模板开始 + Geppetto 增强

开发者用 `npx create-solana-dapp -t pinocchio-counter` 创建项目，然后 `cargo add geppetto` + `npx geppetto-cli init`。Agent 打开项目，读到 AGENTS.md，知道从 `geppetto` 而非 `pinocchio` 导入，读 doc comments 获取知识。在官方骨架上用 Geppetto 约定填充业务逻辑。

### 场景 1b：在已有项目中添加 Geppetto

开发者在已有 Pinocchio 项目中 `cargo add geppetto` + `npx geppetto-cli init`。Agent 读到 AGENTS.md，使用 `AccountSchema` 定义账户，用 `guard::*` 做安全检查，按 `dispatch` 模式分发指令。产出代码一次通过安全审查。

### 场景 2：为已有合约写 TypeScript 客户端

合约已用 Geppetto 构建。Agent 读 `client.rs` 的 doc comments，生成与合约布局精确匹配的 TypeScript 客户端代码——PDA 推导种子一致、账户反序列化偏移量一致。

### 场景 3：排查安全漏洞

Agent 读 `anti_patterns.rs`，对照已有代码检查常见漏洞（missing signer check、PDA 种子碰撞、close account drain 等），定位问题并用 `guard::*` 修复。

### 场景 4：编写测试

Agent 读 `testing.rs`，知道用 litesvm 或 bankrun 搭建测试环境，构建交易、模拟执行、验证状态变更。

## 官方参考实现

### Pinocchio 核心生态（anza-xyz/pinocchio）

Pinocchio SDK v0.11.1 + 5 个 CPI helper 库，是 Geppetto re-export 的基础：

| crate | 版本 | 性质 | 说明 |
|---|---|---|---|
| [`pinocchio`](https://github.com/anza-xyz/pinocchio) (sdk/) | 0.11.1 | 核心 SDK | entrypoint 宏、AccountView、ProgramError、CPI 原语 |
| `pinocchio-system` | 0.6.0 | CPI helper | System program 14 个指令（Transfer、CreateAccount 等） |
| `pinocchio-token` | 0.6.0 | CPI helper | SPL Token 29 个指令 + 零拷贝状态类型（Mint、Account、Multisig） |
| `pinocchio-token-2022` | 0.3.0 | CPI helper | Token-2022 27+ 指令 + 14 种扩展（TransferHook、CpiGuard 等） |
| `pinocchio-associated-token-account` | 0.4.0 | CPI helper | ATA 3 个指令（Create、CreateIdempotent、RecoverNested） |
| `pinocchio-memo` | 0.4.0 | CPI helper | Memo v1/v2 |

**CPI 两种风格**（Geppetto 知识模块必须覆盖）：
- **简单风格**（system、ATA、memo）：栈分配数组 + `invoke_signed()`
- **优化风格**（token、token-2022）：`MaybeUninit` + `CpiWriter` trait + `invoke_signed_unchecked()`，支持 multisig 签名和 Batch CPI（discriminator 255）

### 使用 Pinocchio 的官方链上程序

以下 Solana 官方仓库均使用 Pinocchio 构建，是 Geppetto 知识提炼和 API 设计的权威来源：

| 仓库 | Pinocchio 版本 | 复杂度 | 可提炼模式 |
|---|---|---|---|
| [solana-program/memo](https://github.com/solana-program/memo) | `0.11` | 低（1 条指令） | `#![no_std]` 入门模板、`lazy_program_entrypoint!`、零堆分配、mollusk-svm 测试 |
| [solana-program/escrow](https://github.com/solana-program/escrow) | `^0.10.1` | 高（13 条指令） | 账户验证分离（accounts.rs）、TLV 扩展系统、Hook 模式、self-CPI 事件、`define_instruction!` 宏、Codama 客户端生成 |
| [solana-program/rewards](https://github.com/solana-program/rewards) | `^0.10.1` | 高（14+ 条指令） | Merkle 分发、vesting、`PdaSeeds`/`PdaAccount` trait、`assert_no_padding!`、Token-2022 支持 |
| [solana-program/token](https://github.com/solana-program/token) | `0.9.3` | 极高（27 条指令） | 零拷贝 `Transmutable`、fast-path dispatch（跳过反序列化）、`likely`/`unlikely` 分支提示、Batch 指令 |

### 从参考实现中提炼的共性模式

这些仓库反复出现以下模式，Geppetto 应将其编码为约定或知识：

1. **账户验证与业务逻辑分离** — 每条指令有独立的 `accounts.rs`，`TryFrom<&[AccountView]>` 集中做 signer/writable/owner/PDA 检查，processor 只处理业务逻辑。→ 对应 FR-3 `guard::*` 设计
2. **单字节 discriminator dispatch** — `instruction_data[0]` 做 match 分发，所有仓库一致。→ 对应 FR-4 dispatch 模式
3. **零拷贝账户访问** — `#[repr(C)]` + `assert_no_padding!` + transmute，无序列化开销。→ 对应 FR-2 `AccountSchema` 设计
4. **PDA trait 体系** — rewards 的 `PdaSeeds`/`PdaAccount` + `validate_pda()`。→ 对应 FR-2 补充
5. **self-CPI 事件发射** — discriminator 228 + event authority PDA，escrow 和 rewards 都用。→ 纳入 `idioms.rs`
6. **verify_* 命名约定** — `verify_signer`/`verify_writable`/`verify_owned_by`/`verify_token_program`。→ FR-3 guard 命名参考

### 对 Geppetto API 设计的指导

- **guard 命名**：倾向 `assert_*` 前缀——与 Pinocchio 自身风格一致（直接返回 ProgramError），且语义更强（失败即 abort）。Phase 3 技术规格最终确认。
- **AccountSchema**：应支持零拷贝（`#[repr(C)]` + size 验证），参考 token 的 `Transmutable` 和 rewards 的 `assert_no_padding!`。
- **知识模块覆盖**：`idioms.rs` 必须覆盖 self-CPI 事件、TLV 扩展、Token/Token-2022 双支持等官方生产模式。

## 功能需求

### FR-1：Pinocchio 生态透传（P0 — 必须）

| 项目 | 说明 |
|---|---|
| 描述 | `use geppetto::*` 导出 pinocchio 核心 SDK；通过子模块导出 CPI helpers |
| 透传范围 | `pinocchio`（核心）、`pinocchio-system`、`pinocchio-token`、`pinocchio-token-2022`、`pinocchio-associated-token-account`、`pinocchio-memo` |
| 导出方式 | 核心 API 直接透传；CPI helpers 作为命名子模块（`geppetto::system`、`geppetto::token`、`geppetto::token_2022`、`geppetto::ata`、`geppetto::memo`） |
| feature gates | CPI helpers 作为 optional features，默认全部启用。用户可按需关闭减少编译时间 |
| 验收标准 | `use pinocchio::X` → `use geppetto::X` 编译通过；`use pinocchio_token::X` → `use geppetto::token::X` 编译通过 |
| 约束 | 不包装、不修改任何 API，纯 re-export |

### FR-2：AccountSchema trait（P0 — 必须）

| 项目 | 说明 |
|---|---|
| 描述 | 定义账户布局的标准 trait：字段名、类型、字节偏移、大小 |
| 验收标准 | 通过 trait const/associated types 在编译期暴露布局信息（LEN、DISCRIMINATOR、字段偏移常量），doc comments 和类型系统一致，agent 可从两个渠道获得相同的布局表 |
| 约束 | 零运行时开销，编译期静态检查。不使用宏，纯 trait + const |

### FR-3：Guard helpers（P0 — 必须）

| 项目 | 说明 |
|---|---|
| 描述 | 安全检查 helper 函数，覆盖 Solana 最高频攻击面 |
| 第一批 | `assert_signer`, `assert_writable`, `assert_owner`, `assert_pda`, `assert_discriminator`, `assert_rent_exempt` |
| 验收标准 | 每个 guard 返回 `Result<(), ProgramError>`；检查失败返回明确错误码；doc comments 包含"为什么需要这个检查"的知识 |
| 约束 | 函数签名简洁，agent 无需查文档即知参数含义。展开后是标准 Pinocchio 代码 |
| 参考 | escrow/rewards 中的 `verify_signer`/`verify_writable`/`verify_owned_by`/`verify_token_program` 命名和实现模式 |

### FR-4：指令分发模式（P0 — 必须）

| 项目 | 说明 |
|---|---|
| 描述 | 标准化的 `process_instruction` 分发模式，基于第一字节 tag |
| 验收标准 | 提供可复用的分发模板/模式，agent 按模式生成一致的指令处理代码 |
| 约束 | 不使用宏。可以是函数、trait method、或纯文档模式 |

### FR-5：合约侧知识文档（P0 — 必须）

| 项目 | 说明 |
|---|---|
| 模块 | `idioms.rs` — PDA 推导、CPI 调用（简单风格 vs 优化风格）、Token/Token-2022 交互、Batch CPI、multisig 签名、self-CPI 事件发射、TLV 扩展模式 |
| 模块 | `anti_patterns.rs` — 常见漏洞 + 为什么危险 + 正确写法 |
| 知识来源 | 从 memo/escrow/rewards/token 四个官方仓库提炼共性模式 |
| 版本头 | 每个知识模块顶部标注：geppetto 版本、适用 pinocchio 版本、日期、验证的 Solana 版本。超过 3 个月或 pinocchio 版本不匹配时 agent 应先验证再使用 |
| 验收标准 | 每个知识点包含：问题描述、错误示例（标记 `should_panic` 或 `compile_fail`）、正确示例（doctest 通过）|
| 约束 | 纯 doc comments，无导出代码。`cargo test` 验证所有示例 |

### FR-6：客户端知识文档（P1 — 重要）

| 项目 | 说明 |
|---|---|
| 模块 | `client.rs` — TypeScript 客户端构建知识 |
| 版本头 | 同 FR-5：geppetto 版本、pinocchio 版本、日期、Solana 版本 |
| 覆盖 | 交易构建、PDA 推导（必须与合约侧种子匹配）、账户反序列化、错误处理 |
| 验收标准 | TypeScript 示例与合约侧 `AccountSchema` 布局精确匹配 |
| 对齐验证 | 至少一个端到端测试（ts-node 跑 PDA 推导 + 账户序列化/反序列化），锁定 client.rs 和合约侧的对齐 |
| 约束 | 纯 doc comments。TypeScript 代码示例无法 doctest，通过端到端测试保证正确性 |

### FR-7：测试知识文档（P1 — 重要）

| 项目 | 说明 |
|---|---|
| 模块 | `testing.rs` — litesvm/bankrun 测试惯用法 |
| 版本头 | 同 FR-5：geppetto 版本、pinocchio 版本、日期、Solana 版本 |
| 覆盖 | 环境搭建、交易构建与提交、状态验证、常见断言模式 |
| 验收标准 | Agent 读后能生成可运行的端到端测试 |
| 约束 | 纯 doc comments |

### FR-8：AGENTS.md（P0 — 必须）

| 项目 | 说明 |
|---|---|
| 描述 | 项目根目录的 agent 指引文件 |
| 内容 | 告诉 agent：1) 训练数据过时，读 doc comments；2) 所有账户必须实现 `AccountSchema`；3) 所有安全检查必须用 `guard::*`；4) 指令分发用标准模式；5) **Knowledge Freshness Rules**：使用前检查知识模块的版本头，版本不匹配或 >3 月过期则先验证再使用，不可沉默使用疑似过期知识 |
| 验收标准 | Claude Code / Cursor 打开项目时自动读取并遵循指引 |

### FR-9：示例程序（P1 — 重要）

| 项目 | 说明 |
|---|---|
| 描述 | 展示 Geppetto 全部约定的示例程序 |
| 自有示例 | `examples/escrow/` — 简化版 escrow，用 Geppetto 约定重写（AccountSchema + guard + dispatch） |
| 官方参考 | doc comments 中引用并解读 solana-program/{memo, escrow, rewards, token} 的关键模式 |
| 验收标准 | 自有示例 `cargo build-sbf` 编译通过，有配套测试；官方参考有链接和解读 |

### FR-10：npx geppetto-cli init（P1 — 重要）

| 项目 | 说明 |
|---|---|
| 描述 | 极轻量初始化脚本，在已有项目中生成 AGENTS.md |
| 用法 | `npx geppetto-cli init`（在 `cargo add geppetto` 之后运行） |
| 生成内容 | `AGENTS.md`（指向 geppetto crate doc comments 的 agent 指引）+ 可选 `docs/03-technical-spec.md` 模板 |
| 不做什么 | 不做项目模板、不做前端骨架、不做 CLI 框架。项目脚手架用官方 `npx create-solana-dapp -t pinocchio-counter` |
| 验收标准 | 运行后 AGENTS.md 存在且内容正确；agent 打开项目后自动读取并遵循指引 |
| 约束 | 几十行脚本，npm 包只含 init 命令 |
| 工作量 | 半天 |

## 非功能需求

### NFR-1：零运行时开销

Guard helpers 和 AccountSchema 编译后等价于手写的 Pinocchio 代码。不引入额外 CU 消耗。

### NFR-2：零外部依赖（除 pinocchio 生态）

`Cargo.toml` 的 `[dependencies]` 只有 pinocchio 生态 crate（`pinocchio`、`pinocchio-system`、`pinocchio-token` 等）。不引入 serde、borsh、thiserror 等非 Pinocchio 依赖。

### NFR-3：Agent 可读性

- 所有公开 API 的 doc comments 必须完整
- 函数签名自解释（参数名 = 含义）
- 错误信息包含"为什么检查失败"

### NFR-4：版本对齐

Geppetto 的 minor 版本跟踪 Pinocchio 的 minor 版本。`geppetto 0.3.x` 对应 `pinocchio 0.3.x`。

## 不做什么（明确排除）

| 排除项 | 理由 |
|---|---|
| 宏（proc-macro / declarative macro） | 隐藏复杂度，对 agent 不透明 |
| npm 包 `@geppetto/sdk` | 赛后做，4 周内不维护两套语言 |
| MCP server | 赛后做，复杂度过高 |
| 前端 UI 知识 | 超出 Pinocchio 程序开发范围 |
| Anchor 兼容 | Geppetto 是 Pinocchio-first，不做 Anchor 桥接 |
| 自研模板/脚手架 | 不做 monorepo 模板，用官方 `create-solana-dapp` 模板。Geppetto 只做 `npx geppetto-cli init` 生成 AGENTS.md（FR-10） |
| 自动代码生成 | 不从 IDL 生成代码，agent 本身就是代码生成器 |

## 优先级总结

| 优先级 | 功能 | 黑客松必须 |
|---|---|---|
| P0 | FR-1 Pinocchio 生态透传 | 是 |
| P0 | FR-2 AccountSchema | 是 |
| P0 | FR-3 Guard helpers | 是 |
| P0 | FR-4 指令分发模式 | 是 |
| P0 | FR-5 合约侧知识 | 是 |
| P0 | FR-8 AGENTS.md | 是 |
| P1 | FR-6 客户端知识 | 是（纯文档，工作量小） |
| P1 | FR-7 测试知识 | 是（纯文档，工作量小） |
| P1 | FR-9 示例程序 | 是（自有 escrow + 官方仓库参考解读） |
| P1 | FR-10 npx geppetto-cli init | 是（半天工作量，生成 AGENTS.md） |

## 与竞品的差异化定位

### vs solana-dev-skill（互补）

- `solana-dev-skill` = 建议（纯 markdown，广而浅，Anchor 默认）
- Geppetto = 约束（代码 + 知识合一，深而专，Pinocchio-first）
- 两者互补：项目用官方 `create-solana-dapp` 模板启动，前端知识交给 solana-dev-skill，Geppetto 专注合约侧深度知识

### vs Quasar（不同维度）

- Quasar = 框架，优化 human DX（宏隐藏复杂度，让人少写代码）
- Geppetto = 知识 SDK，优化 agent DX（显式代码，让 agent 看得懂写得对）
- Quasar 的宏展开后代码对 agent 不透明；Geppetto 的每一行 guard/schema/dispatch 都是 agent 可读可调试的
- 不直接竞争：Quasar 服务 human-first 开发，Geppetto 服务 agent-first 开发

### 黑客松叙事

> "Quasar 和 Anchor 让人类写代码更快。Geppetto 让 AI agent 写代码更可靠。随着开发从 human-first 转向 agent-first，代码的 agent 可读性比人类 DX 更重要。Geppetto 是第一个为这个转变而设计的 Solana 开发工具。"

## Phase 1 验收标准

- [x] 用户场景覆盖完整链路（合约 → 客户端 → 测试 → 安全）
- [x] 功能需求可追踪（编号 FR-1 到 FR-10）
- [x] 非功能需求明确（零开销、零依赖、agent 可读、版本对齐）
- [x] "不做什么"边界清晰
- [x] 优先级排序完成
- [x] 可进入 Phase 2: Architecture

# Phase 0: Business Validation — Geppetto

> 状态：已验证
> 日期：2026-04-13

---

## 一句话描述

Geppetto 是一个 Rust crate，让 AI code agent 立刻成为精通 Solana/Pinocchio 最佳实践的高级工程师——知识捆绑在包内，版本匹配，不依赖 web search 或过时训练数据。

## 问题定义

**Solana 开发的完整链路**

```
合约（Rust/Pinocchio）→ 客户端 SDK（TypeScript）→ 前端 UI
        ↑                        ↑                    ↑
    代码 + 知识              纯知识覆盖           赛后
```

**现状（没有 Geppetto）**

AI code agent 写 Solana 程序时：

- Web search → 找到过时信息（Anchor 旧版 API、已弃用模式）
- 训练数据 → 不包含 Pinocchio（太新）
- 产出代码 → 反模式、缺少安全检查、不符合惯用法
- 客户端代码 → 账户反序列化偏移量与合约不匹配（#1 客户端 bug）
- 人类 → 花大量时间审查修复，agent 的价值被抵消

**期望（有 Geppetto）**

- Agent 读捆绑知识 → 遵循惯用法
- 用 guard helpers → 安全检查机械化
- 客户端知识从同一 crate 获取 → 两端布局精确匹配
- 代码一次就对 → 人类只需审查业务逻辑

## 它是什么 / 不是什么

### 是什么

一个 **Pinocchio Agent Harness** —— 为 AI coding agents 构建的知识层 + 约束层 harness 组件。

在 Harness Engineering 的框架中（Agent = Model + Harness），Geppetto 是 harness 的关键部件：不改变 LLM 模型，而是**工程化地改造 agent 的环境**——通过类型约束、编译期验证、结构化知识注入，让 agent 不可能犯已知的错误。

核心做三件事：

1. **捆绑知识** — `cargo add geppetto` 后，知识以 Rust doc comments 形式内嵌在源码中。`cargo doc` 自动构建、`cargo test` 自动验证代码示例，不存在"文档过时但代码更新了"的问题。覆盖全链路：合约侧（账户模型、指令模式、安全检查、惯用法、反模式）+ 客户端侧（交易构建、PDA 推导、账户反序列化）+ 测试（litesvm/bankrun）。每次 `cargo update`，知识跟着更新。
2. **约定代码** — 在 Pinocchio 之上提供一薄层约定模式：`AccountSchema` trait 定义账户布局、标准指令分发模式、`guard::*` 安全检查 helpers。不是宏魔法，展开后就是标准 Pinocchio 代码，agent 完全看得懂。
3. **AGENTS.md 指引** — 告诉 agent："你的训练数据过时了，读 geppetto 源码的 doc comments 才是真相来源。运行 `cargo doc --open` 查看完整知识。"

### 不是什么

- 不是新的 Solana 框架（不替代 Pinocchio，而是包裹它）
- 不是脚手架（不只是生成项目模板）
- 不是静态文档站（不是给人类读的 docs，是给 agent 消费的结构化知识）
- 不是 Anchor 那样的宏魔法（不隐藏复杂度，让复杂度对 agent 可见可理解）

## 灵感来源

| 来源                                         | 借鉴了什么                                                     |
| ------------------------------------------ | --------------------------------------------------------- |
| **Harness Engineering** (2026 趋势)          | Agent = Model + Harness；工程化改造环境而非优化 prompt；编译期约束比运行期建议更可靠 |
| Next.js bundled docs                       | 知识捆绑在包内，版本匹配，agent 不需要 web search                         |
| Next.js skills (vercel-labs/next-skills)   | 结构化的最佳实践知识，可安装可更新                                         |
| Armin Ronacher "Friction Is Your Judgment" | Agent-Legible 代码库设计、机械强制执行、增加决策摩擦                         |
| dev-lifecycle                              | 开发阶段约束、技术规格先于代码                                           |
| Pinocchio                                  | 底层框架，零依赖、显式、零拷贝                                           |

**Geppetto 在 Harness Engineering 进化中的位置：**

```
Prompt Engineering → Context Engineering → Harness Engineering
  "写更好的提示"     "喂更好的上下文"       "工程化改造环境"
                                              ↑
                                          Geppetto
                                    (知识层 + 约束层 harness)
```

与纯 markdown skills（solana-dev-skill）的区别：skills 是 context engineering（喂更好的上下文），Geppetto 是 harness engineering（编译期强制约束 + 可验证知识 + 类型系统 guardrails）。Rust 的类型系统让 Geppetto 能做到比 JavaScript 生态更硬的 mechanical enforcement。

## 竞品分析

### solana-dev-skill（Solana Foundation, 2026-01）

Claude Code 官方 skill，纯 markdown 文件，覆盖 Solana 全栈（UI、SDK、Programs、Testing、Security 等）。Anchor 为默认程序框架，Pinocchio 仅作为高性能场景的备选提及。

**与 Geppetto 的核心差异：**

| 维度   | solana-dev-skill         | Geppetto                                           |
| ---- | ------------------------ | -------------------------------------------------- |
| 形态   | 纯 markdown 文件            | Rust crate（代码 + 知识合一）                              |
| 知识更新 | 手动更新，锁定在 "Jan 2026"      | `cargo update` 自动获取新版本知识                           |
| 程序框架 | Anchor 为默认，Pinocchio 是备选 | Pinocchio-first，深度覆盖                               |
| 强制力  | 零——只是建议 agent 怎么做        | 有——`guard::*` 是真实 API，`AccountSchema` 是必须实现的 trait |
| 代码验证 | 无——markdown 里的示例可能过时     | doctest 自动验证——`cargo test` 确保每个示例编译通过              |
| 覆盖策略 | 广而浅——整个 Solana 栈         | 深而专——Pinocchio 程序开发的完整实践                           |
| 安装方式 | `npx skills add` 复制文件到本地 | `cargo add geppetto` 成为项目依赖                        |

**关系：互补，不是竞争**

`solana-dev-skill` 告诉 agent **"Solana 开发该知道什么"**。Geppetto 给 agent **"写 Pinocchio 程序时必须调用的 API + 为什么这么做的知识"**。一个是建议，一个是约束。开发者完全可以同时用两者：

```bash
# 全栈知识（前端、钱包、测试工具选型）
npx skills add solana-foundation/solana-dev-skill

# Pinocchio 程序开发的深度约束
cargo add geppetto
```

### Quasar（[quasar-lang.com](https://quasar-lang.com)，[blueshift-gg/quasar](https://github.com/blueshift-gg/quasar)）

Solana 程序框架（by Blueshift），定位 "Anchor 的开发体验 + Pinocchio 的性能"。程序默认 `#![no_std]`，账户从 SVM 输入缓冲区直接指针转换，零反序列化、零堆分配。用 `#[program]`、`#[derive(Accounts)]` 等宏生成高性能代码。自带 CLI、CU profiler、flamegraph、测试框架 QuasarSVM、自动生成 TypeScript/Rust 客户端。

**与 Geppetto 的核心差异：**

| 维度        | Quasar                                          | Geppetto                         |
| --------- | ----------------------------------------------- | -------------------------------- |
| 核心思路      | 用宏隐藏复杂度，让人少写代码                                  | 让复杂度对 agent 可见，确保写对代码            |
| 哲学        | "让开发更快"（human DX）                               | "让 agent 开发更可靠"（agent DX）        |
| 宏/魔法      | 重度依赖——`#[program]`、`#[derive(Accounts)]` 生成大量代码 | 零宏魔法——展开后就是标准 Pinocchio          |
| Agent 可读性 | 宏展开后的代码 agent 看不到                               | 所有代码对 agent 完全透明                 |
| 知识载体      | 文档站（quasar-lang.com/docs）                       | 捆绑在 crate 里的 doc comments        |
| 安全强制      | 通过宏的约束属性（`has_one`、`constraint`）                | 通过显式 `guard::*` 函数调用             |
| 定位        | 全栈框架（替代 Anchor）                                 | agent-aware 知识 SDK（包裹 Pinocchio） |

**关系：不同层面的问题，不同的用户群体**

Quasar 适合：想要 Anchor 式开发体验但需要更好性能的团队。**人类开发者主导，agent 辅助。**

Geppetto 适合：用 AI agent 作为主要编码力量、需要 agent 产出可审查可信赖代码的开发者。**agent 主导，人类审查。**

核心论点来自 Armin Ronacher 演讲——"No hidden magic: if the agent can't see it, it can't respect it." 宏生成的隐式代码对人类是便利，对 agent 是黑盒。显式代码（摩擦）不是敌人，是 agent 正确工作的前提。

**未来可能的协作**：`geppetto-quasar` 变体——为 Quasar 提供 agent 知识层。Quasar 用户同样需要 agent 知道应用级知识（何时用 `init`/`close`、安全审计注意事项），这些不在 Quasar 的宏里。

### 竞品定位总结

```
            Human DX ←───────────────────────→ Agent DX
               │                                  │
  Anchor ──── Quasar ────────────── Geppetto ─────┘
  (宏,慢)    (宏,快)              (显式,agent透明)
               │                       │
               └── 竞争 ──────────── 互补 ── solana-dev-skill
                  (框架 vs 知识SDK)        (广浅 vs 深专)
```

## 目标用户

用 AI code agent（Claude Code、Codex、Cursor 等）+ Pinocchio 开发 Solana 程序的开发者。他们希望 agent 产出的代码是正确的、安全的、符合惯用法的。

## 社区验证

> 黑客松场景，社区验证通过参赛和 demo 完成，而非传统的用户访谈。

核心假设：Solana 开发者社区正在快速采用 AI code agent，但 agent 对 Pinocchio 的支持几乎为零（训练数据不包含）。Geppetto 填补这个空白。

## 手动流程（Manual → Processized → Productized）

当前手动流程（没有 Geppetto 时开发者怎么做）：

1. 打开 Pinocchio GitHub 仓库，手动读源码
2. 复制粘贴之前项目的安全检查代码
3. 在 Claude Code 对话中手动粘贴 Pinocchio 文档片段
4. Agent 产出代码后，逐行对照安全审计清单
5. 手动修复 agent 遗漏的检查

Geppetto 将步骤 1-5 自动化：agent 自动读捆绑知识，自动用 guard helpers，人类只审查业务逻辑。

## 关键设计决策

| 决策点                   | 结论                                                                                          | 理由                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Re-export 策略          | `use geppetto::*` 透传核心 SDK；CPI helpers 通过子模块按需启用（`default = []`，提供 `token-all` / `full` 预设） | 核心（guard/schema/dispatch/知识）零 CPI 依赖；CPI helpers 按需加 feature，避免不必要的编译开销               |
| 文档发现机制                | AGENTS.md + doc comments + `cargo doc` + docs.rs fallback                                   | 知识写在 .rs 文件的 doc comments 里，代码和文档合一，`cargo test` 验证示例不过时                              |
| Guard helpers 数量      | Phase 3 精确定义，第一批 6 个                                                                        | 按 Solana 安全审计清单逐条来，不拍脑袋。第一批：signer, writable, owner, pda, discriminator, rent\_exempt |
| 交付拆分                  | crate 和 demo 各走独立 Phase 3-6                                                                 | 独立工作流，防止耦合                                                                            |
| 知识覆盖策略                | 合约侧：代码 + 知识；客户端侧：纯知识（doc comments）；npm 包赛后                                                  | 4 周内不维护两套语言的代码，但知识覆盖全链路。agent 从同一 crate 读到两端知识，布局精确匹配                                 |
| 项目脚手架                 | 不做模板，用官方 `npx create-solana-dapp -t pinocchio-counter`；`npx geppetto-cli init` 生成 AGENTS.md | 官方已有 pinocchio 模板，不重复造轮子。Geppetto 做增强层，不做基础层。赛后可给官方提 PR 加 `pinocchio-geppetto` 模板     |
| 知识保鲜（Dated Knowledge） | 每个知识模块带版本号 + 时间戳 + 适用的 pinocchio/solana 版本。AGENTS.md 指示 agent 使用前检查保鲜期，过期则先验证再使用            | 开发者不一定及时 `cargo update`，agent 需要"保质期意识"。agent 自身就是更新机制——发现过期→验证→更新，零基础设施成本            |
| MCP server            | 赛后第一优先级                                                                                     | 4 周内做少做好，MCP 增加的复杂度可能导致哪边都做不好                                                         |

## 黑客松交付范围（4 周，截止 2026-05-11）

### 子模块 A：geppetto crate（核心）

- `src/lib.rs` — re-export pinocchio 生态 + crate 总览文档（doc comments）
- `src/guard.rs` — 第一批 6 个安全检查 helper + 安全知识（doc comments）
- `src/schema.rs` — `AccountSchema` trait + 账户布局惯用法（doc comments）
- `src/dispatch.rs` — 指令分发标准模式 + 文档（doc comments）
- `src/idioms.rs` — 代码 + 知识模块：导出 close\_account、read\_u64\_le 等 helper 函数，同时覆盖 PDA、CPI、Token 交互等惯用法（doc comments）[^1]
- `src/anti_patterns.rs` — 纯文档模块：常见漏洞 + 修复（doc comments，无导出代码）
- `src/client.rs` — 纯文档模块：客户端知识（交易构建、PDA 推导、账户反序列化，TypeScript 示例）
- `src/testing.rs` — 代码 + 知识模块：导出测试断言工具函数（feature-gated），同时覆盖 litesvm/bankrun 测试惯用法（doc comments）[^1]
- `examples/escrow/` — 完整 escrow 示例程序
- `AGENTS.md` — agent 指引

### 子模块 B：npx geppetto-cli init（极轻量脚本）

在已有项目中生成 AGENTS.md 和可选的 `docs/03-technical-spec.md` 模板。几十行脚本，不做模板、不做前端、不做 CLI 框架。

```bash
# 用官方模板创建项目
npx create-solana-dapp -t pinocchio-counter
# 加入 Geppetto 知识层
cd my-project/program && cargo add geppetto
# 生成 agent 指引
npx geppetto-cli init
```

### 子模块 C：escrow demo + A/B 视频

- 从官方 `pinocchio-counter` 模板开始，加 geppetto，让 Claude Code 改造成 escrow
- A/B 对比：同样的起点，一组裸跑 agent，一组加了 geppetto
- 对比维度：代码质量、安全检查覆盖率、反模式数量

## 后续演进（赛后）

按优先级排序：

1. **MCP server** — agent 通过 MCP 查询知识，比文件路径优雅
2. **@geppetto/sdk npm 包** — 将 `client.rs` 知识迁移为 TypeScript 代码，加真实类型定义和 helper 函数
3. **skills 仓库** — 独立于 crate 版本的专项知识包
4. **自动进化** — CI 追踪 Pinocchio 上游变更，自动生成知识更新 PR

[^1]: 最终设计见 Phase 3 技术规格。`idioms.rs` 和 `testing.rs` 从纯文档升级为"代码 + 知识"混合模块，导出可直接调用的 helper 函数。

## Phase 0 验收标准

- [x] 问题定义清晰
- [x] 目标用户明确
- [x] "是什么/不是什么"边界定义完成
- [x] 手动流程已描述
- [x] 关键设计决策已记录
- [x] 交付范围已确认
- [x] 可进入 Phase 1: PRD


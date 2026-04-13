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

一个 **agent-aware 的知识 SDK**，核心做三件事：

1. **捆绑知识** — `cargo add geppetto` 后，知识以 Rust doc comments 形式内嵌在源码中。`cargo doc` 自动构建、`cargo test` 自动验证代码示例，不存在"文档过时但代码更新了"的问题。覆盖全链路：合约侧（账户模型、指令模式、安全检查、惯用法、反模式）+ 客户端侧（交易构建、PDA 推导、账户反序列化）+ 测试（litesvm/bankrun）。每次 `cargo update`，知识跟着更新。

2. **约定代码** — 在 Pinocchio 之上提供一薄层约定模式：`AccountSchema` trait 定义账户布局、标准指令分发模式、`guard::*` 安全检查 helpers。不是宏魔法，展开后就是标准 Pinocchio 代码，agent 完全看得懂。

3. **AGENTS.md 指引** — 告诉 agent："你的训练数据过时了，读 geppetto 源码的 doc comments 才是真相来源。运行 `cargo doc --open` 查看完整知识。"

### 不是什么

- 不是新的 Solana 框架（不替代 Pinocchio，而是包裹它）
- 不是脚手架（不只是生成项目模板）
- 不是静态文档站（不是给人类读的 docs，是给 agent 消费的结构化知识）
- 不是 Anchor 那样的宏魔法（不隐藏复杂度，让复杂度对 agent 可见可理解）

## 灵感来源

| 来源 | 借鉴了什么 |
|---|---|
| Next.js bundled docs | 知识捆绑在包内，版本匹配，agent 不需要 web search |
| Next.js skills (vercel-labs/next-skills) | 结构化的最佳实践知识，可安装可更新 |
| Armin Ronacher "Friction Is Your Judgment" | Agent-Legible 代码库设计、机械强制执行、增加决策摩擦 |
| dev-lifecycle | 开发阶段约束、技术规格先于代码 |
| Pinocchio | 底层框架，零依赖、显式、零拷贝 |

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

| 决策点 | 结论 | 理由 |
|---|---|---|
| Re-export 策略 | `use geppetto::*` 透传，一个入口 | Geppetto 是 Pinocchio 的替代入口，不是附加工具。类比 Next.js 不需要单独装 React |
| 文档发现机制 | AGENTS.md + doc comments + `cargo doc` + docs.rs fallback | 知识写在 .rs 文件的 doc comments 里，代码和文档合一，`cargo test` 验证示例不过时 |
| Guard helpers 数量 | Phase 3 精确定义，第一批 6 个 | 按 Solana 安全审计清单逐条来，不拍脑袋。第一批：signer, writable, owner, pda, discriminator, rent_exempt |
| 交付拆分 | crate 和 demo 各走独立 Phase 3-6 | 独立工作流，防止耦合 |
| 知识覆盖策略 | 合约侧：代码 + 知识；客户端侧：纯知识（doc comments）；npm 包赛后 | 4 周内不维护两套语言的代码，但知识覆盖全链路。agent 从同一 crate 读到两端知识，布局精确匹配 |
| MCP server | 赛后第一优先级 | 4 周内做少做好，MCP 增加的复杂度可能导致哪边都做不好 |

## 黑客松交付范围（4 周，截止 2026-05-11）

### 子模块 A：geppetto crate

- `src/lib.rs` — re-export pinocchio + crate 总览文档（doc comments）
- `src/guard.rs` — 第一批 6 个安全检查 helper + 安全知识（doc comments）
- `src/schema.rs` — `AccountSchema` trait + 账户布局惯用法（doc comments）
- `src/dispatch.rs` — 指令分发标准模式 + 文档（doc comments）
- `src/idioms.rs` — 纯文档模块：PDA、CPI、Token 交互等惯用法（doc comments，无导出代码）
- `src/anti_patterns.rs` — 纯文档模块：常见漏洞 + 修复（doc comments，无导出代码）
- `src/client.rs` — 纯文档模块：客户端知识（交易构建、PDA 推导、账户反序列化，TypeScript 示例）
- `src/testing.rs` — 纯文档模块：测试惯用法（litesvm/bankrun）
- `examples/escrow/` — 完整 escrow 示例程序
- `AGENTS.md` — agent 指引

### 子模块 B：escrow demo

- 一个用 Geppetto + Claude Code 写的 escrow 程序
- A/B 对比视频（裸 Pinocchio vs Geppetto 辅助）

## 后续演进（赛后）

按优先级排序：

1. **MCP server** — agent 通过 MCP 查询知识，比文件路径优雅
2. **`@geppetto/sdk` npm 包** — 将 `client.rs` 知识迁移为 TypeScript 代码，加真实类型定义和 helper 函数
3. **skills 仓库** — 独立于 crate 版本的专项知识包
4. **自动进化** — CI 追踪 Pinocchio 上游变更，自动生成知识更新 PR

## Phase 0 验收标准

- [x] 问题定义清晰
- [x] 目标用户明确
- [x] "是什么/不是什么"边界定义完成
- [x] 手动流程已描述
- [x] 关键设计决策已记录
- [x] 交付范围已确认
- [x] 可进入 Phase 1: PRD

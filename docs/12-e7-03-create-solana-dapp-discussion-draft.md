# E7-03 Discussion Draft — create-solana-dapp

> 状态：草稿（内部暂缓）
> 目标仓库：`create-solana-dapp`
> 动作类型：Discussion 优先，必要时再转 docs-only PR
> 路径约束：本轮仅推进 `create-solana-dapp`，不并行扩展到其他上游仓库

## Recommended Discussion Title

**Proposal: lightweight Geppetto agent-guidance integration for Pinocchio templates**

---

## English Version

Hi maintainers — I’d like to propose a very small, low-risk integration path for Geppetto with the Pinocchio developer flow in `create-solana-dapp`.

### What Geppetto is

Geppetto is a lightweight “agent guidance + constraints” layer for Pinocchio-based Solana programs. It does **not** replace Pinocchio, and it does **not** introduce a framework or hidden code generation model.

Its role is to help AI coding agents produce safer and more consistent Pinocchio code by providing:

- canonical agent entry files (`AGENTS.md`, Claude/Cursor/Copilot/etc. redirects)
- explicit docs for security checks, account layout, CPI idioms, testing, and client alignment
- small CLI helpers like:
  - `npx geppetto-cli init`
  - `geppetto new`
  - `geppetto test`
  - `geppetto audit`

### Minimal integration proposal

This proposal is intentionally narrow:

#### Option A — documentation-only
Add a short note in the Pinocchio template flow saying that users who want AI-agent guidance can optionally run:

```bash
cargo add geppetto
npx geppetto-cli init
```

This would generate `AGENTS.md` and mirrored agent entry files in the project, without changing the actual program scaffold.

#### Option B — lightweight template hint
Add a small “optional next step” in the generated project README or setup output for Pinocchio templates:

> If you use AI coding agents, consider adding Geppetto:
>
> ```bash
> cargo add geppetto
> npx geppetto-cli init
> ```

### Why this may be useful

- keeps the official Pinocchio template flow unchanged
- adds optional agent-oriented guidance for teams using Claude/Cursor/Copilot/etc.
- avoids introducing a competing framework
- gives users a clearer path from “Pinocchio template” → “agent-safe project conventions”

### Why this is low risk

- Geppetto integration is opt-in
- no required runtime dependency changes for existing users
- no hidden code generation
- no automatic overwrite behavior
- no attempt to replace official project structure

### What I am **not** proposing

- not proposing a new default template
- not proposing mandatory Geppetto dependency
- not proposing framework-level abstraction over Pinocchio
- not proposing automated external PR spam or ecosystem fragmentation

### Suggested smallest next step

If this direction sounds reasonable, the smallest useful collaboration would be:

1. accept a short docs/setup note for Pinocchio templates, or
2. point to the right place where such optional agent-guidance integration should live

If helpful, I can also turn this into a very small PR with a single docs-only change.

---

## 中文版本

维护者好，我想提一个非常小、低风险的接入建议：让 `create-solana-dapp` 的 Pinocchio 使用流程里，出现一条 **可选的 Geppetto agent-guidance 集成路径**。

### Geppetto 是什么

Geppetto 是一个面向 Pinocchio 的轻量“**agent 指引 + 约束层**”。
它**不是** Pinocchio 的替代品，也**不是**新的重型框架，更不是隐藏逻辑的代码生成器。

它的目标是帮助 AI coding agent 在 Pinocchio / Solana 项目里产出更安全、更一致的代码，主要提供：

- agent 入口文件（`AGENTS.md` 及 Claude/Cursor/Copilot 等镜像入口）
- 面向 agent 的显式文档：
  - 安全检查
  - 账户布局
  - CPI 惯用法
  - 测试模式
  - 客户端对齐
- 一些轻量 CLI：
  - `npx geppetto-cli init`
  - `geppetto new`
  - `geppetto test`
  - `geppetto audit`

### 最小接入建议

这个提议刻意保持在很小的范围内：

#### 方案 A：只做文档提示
在 Pinocchio 模板的说明流程里，加一条可选说明：如果用户希望让 AI agent 更容易遵守项目约定，可以额外执行：

```bash
cargo add geppetto
npx geppetto-cli init
```

这只会在项目里生成 `AGENTS.md` 与镜像入口文件，**不会改变**官方模板本身的程序结构。

#### 方案 B：在模板输出里加“可选下一步”
在生成的 README 或 setup 输出里加一个轻量提示：

> If you use AI coding agents, consider adding Geppetto:
>
> ```bash
> cargo add geppetto
> npx geppetto-cli init
> ```

### 这件事的价值

- 不改变官方 Pinocchio 模板主流程
- 给使用 Claude/Cursor/Copilot 等 agent 的团队一个更自然的接入点
- 不引入竞争性框架定位
- 帮助用户从“官方 Pinocchio 模板”平滑进入“agent-safe 项目约定”

### 为什么风险低

- Geppetto 是 **可选接入**
- 不要求现有用户引入额外运行时依赖
- 不做隐藏代码生成
- 不做自动覆盖已有文件
- 不试图替代官方项目结构

### 我这边**不**想推动的方向

- 不提议新增默认模板
- 不提议强制依赖 Geppetto
- 不提议在 Pinocchio 之上再套一层框架
- 不提议用外部自动化去打扰多个生态仓库

### 建议的最小下一步

如果这个方向你们觉得合理，最小可行的协作方式可以是：

1. 接受一条很短的 docs/setup 提示，或
2. 指一下这类“可选 agent-guidance 集成”更适合放在哪个位置

如果有帮助，我也可以把它整理成一个非常小的 docs-only PR。

---

## Recommended Posting Strategy

建议后续按以下顺序推进：

1. 先发 Discussion
2. 如反馈正面，再转成 docs-only PR
3. 暂不扩展到 Pinocchio 核心仓库或其他 agent/skill 生态仓库

---

## Submission Checklist

- [ ] 工作树干净，仅保留本次外联相关改动
- [ ] `docs/11-e7-02-create-solana-dapp-action-plan.md` 与本草稿一致
- [ ] 决策状态保持为 `Hold（待窗口确认）`
- [ ] 本轮仅选择 `create-solana-dapp` 作为单一路径
- [ ] 如需转 PR，优先使用 docs-only 最小改动范围
- [ ] 发送窗口决策归档：`docs/13-e7-04-send-window-checklist.md`

---

## E7-03 里程碑绑定（内部）

- [x] 已完成单路径约束：当前只推进 create-solana-dapp，不并行发起 Pinocchio / agent-skill 其他外部动作。
- [x] 已完成发送策略：先从 Discussion 起步，获得反馈后再按最小 `docs-only` PR 路径推进；本阶段不在本仓库内直接发起外部变更。
- [x] 已完成文档链路：`docs/10-e7-01-external-alignment.md`、`docs/11-e7-02-create-solana-dapp-action-plan.md` 与本讨论草案保持同口径。
- [ ] 外部发送执行：在时机窗口确认后，将该草案转为 discussion / PR（当前状态：待窗口确认，暂缓）。

## 下一个内部动作

- 暂不执行外部发布。下一步回到内部迭代，优先维护 E7 规划产物与 release/check 质量底线。

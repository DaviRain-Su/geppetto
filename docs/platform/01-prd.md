# Phase 1: PRD — Geppetto Platform

> 状态：草稿（待确认）
> 日期：2026-04-15
> 输入：
> - 现有 Geppetto SDK 文档（Phase 0-3）
> - Encore 官方产品定位（code-first infra / AWS/GCP）
> - Solana / Pinocchio / create-solana-dapp 生态现状

---

## 一句话描述

**Geppetto Platform** 是一个面向 AI code agent 的 Solana 全栈工程平台：它以 Geppetto 作为 on-chain agent harness，以 Encore 作为 off-chain 基础设施与服务运行时，在两者之间建立统一的工程 contract、部署编排与环境一致性。

---

## 产品目标

让开发者或 AI agent 不再把 Solana 程序、客户端、API 服务、数据库、部署脚本视为四套割裂系统，而是把它们当成一个 **可描述、可编排、可部署、可演进** 的统一工程单元。

更具体地说：

1. **继续保留 Geppetto 现有优势**
   - Pinocchio-first
   - agent-aware knowledge
   - guardrails / schema / dispatch / testing

2. **补上 Geppetto 目前没有覆盖的工程层**
   - on-chain + off-chain 统一 contract
   - deploy orchestration
   - 环境一致性与可观测性

3. **先做全球版 MVP**
   - 不考虑中国云
   - 先建立 Solana + Encore + AI agent 的最小闭环

---

## 为什么要做这个产品

### 问题 1：AI 能写合约，但不会交付系统

今天的 AI code agent 已经能：
- 写 Rust / Pinocchio 程序
- 写 TypeScript 客户端
- 写一些 API / worker 代码

但它通常**不会自然把这些部分当成一个统一系统来交付**。结果是：
- on-chain program 有了
- off-chain 服务有了
- 但部署方式、环境变量、program id、cluster、PDA 配置、webhook/indexer 路径都靠人手 glue

这使得“AI 提升开发速度”的收益在交付阶段被抵消。

### 问题 2：Solana 真正的应用天然是 hybrid

纯 on-chain demo 可以跑，但真实产品几乎一定需要 off-chain 部分：
- API 服务
- 数据库 / 缓存 / 队列
- webhook / notification
- indexer / event consumer
- 身份、支付、分析、后台任务

Solana 本身解决的是高性能 on-chain execution，不是完整应用交付。

### 问题 3：当前工具链是分裂的

当前开发者要组合多套工具：
- 合约开发：Anchor / Pinocchio / create-solana-dapp
- 客户端与脚本：TypeScript / web3.js / kit
- 后端基础设施：Encore / 普通云后端 / serverless
- 部署：solana CLI + cloud deploy + 手工环境拼接

缺少一个“把 AI 生成代码变成可上线全栈系统”的统一控制面。

---

## 这是什么 / 不是什么

### 是什么

Geppetto Platform 是一个 **AI-native Solana engineering control plane**：

1. **Harness Layer**
   - 继续由现有 `geppetto` crate / CLI 提供
   - 解决“agent 写出来的 Solana 代码是否正确”

2. **App Contract Layer**
   - 定义统一的工程元数据
   - 把 program、cluster、program id、service、database、env、secrets、deploy outputs 描述成一个系统

3. **Orchestration Layer**
   - `geppetto deploy`
   - 把 on-chain deploy 和 off-chain deploy 串起来

4. **Runtime / Infra Layer**
   - on-chain 运行在 Solana
   - off-chain 运行在 Encore 管理的 AWS/GCP 基础设施之上

### 不是什么

- 不是“再造一个 Anchor”
- 不是“修改 Encore 内核，让它天生识别 Solana”
- 不是“新做一个通用多云平台”
- 不是“只做合约脚手架”
- 不是“只做黑客松 demo 而不考虑工程边界”

---

## 目标用户

### 用户 1：AI-native Solana builder

特征：
- 用 Claude Code / Codex / Cursor 等 agent 写代码
- 偏好 Pinocchio / 显式代码风格
- 想要快速做出可演示、可上线的 Solana app

核心诉求：
- 让 agent 写对 on-chain 代码
- 让系统能一起部署

### 用户 2：Hackathon 团队 / 小型创业团队

特征：
- 工程资源有限
- 需要快速从 idea 到 demo 到可运行 MVP
- 不想手写大量 IaC / glue code

核心诉求：
- 少写样板代码
- 少做环境拼接
- 提高上线成功率

### 用户 3：已有 Geppetto SDK 用户

特征：
- 已经接受 Geppetto 的 agent harness 价值
- 下一步自然想要“从正确代码走向正确交付”

核心诉求：
- 不要切换认知模型
- 不要被迫换框架

---

## 用户场景

### 场景 1：从 create-solana-dapp + Geppetto 出发，做一个完整 app

开发者：
1. 用官方 Pinocchio template 初始化项目
2. `cargo add geppetto`
3. 让 agent 写出 program + client + minimal backend
4. 使用 `geppetto deploy`

期望结果：
- program 部署到 devnet
- off-chain API / DB / cache 一起部署
- 输出统一环境信息（program id / service URL / env）

### 场景 2：已有 Pinocchio program，需要补一个 off-chain service

开发者已有合约，但缺少：
- webhook consumer
- API facade
- user-facing backend

期望：
- 不重写整套平台
- 在现有项目上补一层 contract + deploy orchestration

### 场景 3：AI 需要从“能写代码”变成“能交付系统”

今天 agent 能写：
- instruction handlers
- PDA logic
- TS clients

但还不能稳定处理：
- deploy target
- environment mapping
- on/off-chain output contract
- release consistency

Geppetto Platform 的目标就是把这些显式工程知识变成 agent 可消费的 contract。

---

## 产品定位

### 对外定位

> **Geppetto starts as the AI-native harness for Solana/Pinocchio development, and grows into the control plane that connects on-chain programs with off-chain infrastructure.**

### 对黑客松 / demo 的定位

不要讲：
- “我们已经是 Solana 版 Encore”

要讲：
- “我们把 Geppetto 现有的 AI harness 扩展成一个 Solana app engineering platform”
- “先打通 Solana on-chain + Encore off-chain 的最小闭环”

这样更可信，也更符合当前实现成熟度。

---

## MVP 范围（全球版，不考虑中国云）

### MVP 运行模式（先锁定一个）

为避免 Phase 2 架构分叉，MVP 先固定为：

- **on-chain**：Solana `devnet`
- **off-chain**：**Encore Cloud**
- **编排方式**：Geppetto 外层 orchestrator 调用现有 CLI / deploy 流程

当前明确 **不** 走：

- Encore self-host
- 修改 / fork Encore 内核
- 让 Encore 原生理解 Solana AST / program model

这不是长期排除，只是为了让 hackathon MVP 保持单路径。

### Source of Truth（前置锁定）

MVP 的编排真相源固定为：

- **`geppetto.toml`**

它负责描述：

- app name
- cluster
- program build / deploy 目标
- off-chain service 需求
- deploy 输出 contract

Encore 配置与 Solana deploy 输出都由 `geppetto.toml` 派生或回填，而不是反过来把 Encore 配置当作编排真相源。

### MVP 必须交付

1. **统一 app contract**
   - 至少能描述：
     - app name
     - Solana cluster
     - program build/deploy target
     - off-chain service requirements
     - deploy outputs

2. **最小 deploy orchestration**
   - 至少打通：
     - build program
     - deploy program
     - 部署一个 off-chain service
     - 输出统一 env / metadata

3. **环境一致性**
   - local / devnet / mainnet 的差异通过一个统一 contract 管理

4. **可观测的 deploy 结果**
   - 部署结束后至少要输出：
     - program id
     - cluster
     - service endpoint
     - 关键 env / metadata

### MVP 可测 DoD

为了避免验收停留在口号层，MVP 至少要满足以下可测条件：

1. **单命令 demo**
   - `geppetto deploy`（或等价单入口）可完成一次 demo 级完整发布

2. **最小完整发布**
   - 一次发布必须同时产出：
     - 一个成功部署到 `devnet` 的 Solana program
     - 一个成功可访问的 off-chain service（Encore Cloud）

3. **必出字段**
   - 发布结束后必须输出并可读取：
     - `program_id`
     - `cluster`
     - `service_url`
     - `deployment_id`

4. **最少失败分类**
   - 至少区分三类失败：
     - `build`
     - `deploy`
     - `config`

5. **Hackathon 演示约束**
   - 在可用网络与云环境前提下，单次完整 demo 发布应控制在 **15 分钟内**
   - 目标不是生产级 SLA，而是评审可演示性

### MVP 明确不做

- 中国云支持（阿里 / 腾讯 / 火山）
- 多云抽象
- 多 program monorepo 编排
- generalized indexer platform
- wallet / frontend framework
- production-grade rollback / migration / secrets rotation 全套能力
- 让 Encore 原生理解 Solana AST / parser

---

## 当前阶段最值得先做的功能边界

### P0：先建立桥，而不是先做大而全平台

最优先的不是“自动做完所有事情”，而是先建立这三样：

1. **Geppetto app contract / manifest**
2. **on-chain deploy outputs -> off-chain inputs 的桥接机制**
3. **一个可重复演示的 `geppetto deploy` demo path**

### P1：再把桥做稳

- release metadata
- environment records
- tracing / event hook
- devnet/mainnet 切换

### P2：最后再扩能力

- image-based rollback
- secrets rotation
- advanced deploy strategies
- China-market off-chain providers

---

## 核心差异化

### 与 Anchor / Quasar 的差异

Anchor / Quasar 更像：
- Solana program framework
- developer DX tooling

Geppetto Platform 要做的是：
- **agent-first engineering platform**
- 把“合约正确性”延伸到“系统交付正确性”

### 与 Encore 的关系

Encore 不是本产品要替代的对象，而是：
- **off-chain runtime / infra engine**

Geppetto Platform 位于更上层：
- 负责把 Solana program lifecycle 和 Encore off-chain lifecycle 连起来

### 与纯 Web3 builder kit 的差异

多数 Web3 工具只覆盖：
- 合约
- 客户端
- 或局部 infra

Geppetto Platform 的核心优势是：
- **agent-aware**
- **Pinocchio-first**
- **hybrid deployment aware**

---

## 成功标准

### Hackathon / MVP 成功标准

1. 开发者或 agent 可以基于 Geppetto 写出一个 Pinocchio app
2. 通过统一入口完成一次 **真实** 的 on-chain + off-chain 完整发布
3. 发布结果至少稳定产出：
   - `program_id`
   - `cluster`
   - `service_url`
   - `deployment_id`
4. 失败场景可明确归类到：
   - `build`
   - `deploy`
   - `config`
5. demo 可以清楚展示：
   - Geppetto 负责写对代码
   - Platform 负责把系统部署起来

### 产品成功标准

如果用户看到后说：
- “这不是又一个 Solana framework，而是一个 AI 时代的 Solana app control plane”

就说明定位是对的。

---

## 风险与约束

### 风险 1：产品承诺过大

风险：
- 过早宣称“Encore 自动部署 Solana program”

控制方式：
- 先把表述收敛为 orchestrator / bridge / control plane

### 风险 2：把 MVP 做成平台重写

风险：
- 试图一开始就做全新 deploy engine、多云、全功能 runtime

控制方式：
- MVP 只做桥接，不重写 Encore

### 风险 3：技术契约不明确

风险：
- source of truth 不清晰
- deploy outputs contract 不清晰

控制方式：
- 在 Phase 3 技术规格中先写死 manifest / deploy contract / outputs contract

---

## 与现有 Geppetto 仓库的关系

这个产品线不是否定现有 Geppetto，而是建立在它之上：

- 现有 `geppetto` crate = **Harness Layer**
- 新平台线 = **Platform / Control Plane Layer**

因此，后续文档应单独放在：

- `docs/platform/01-prd.md`
- `docs/platform/02-architecture.md`
- `docs/platform/03-technical-spec.md`

避免与现有 SDK 本体 PRD 混淆。

---

## 一句话结论

**Geppetto Platform 的 Phase 1 目标，不是证明“Encore 已经能原生部署 Solana”，而是定义一个可信、可实现的产品方向：在 `geppetto.toml` 作为编排真相源、Encore Cloud 作为 off-chain runtime、Geppetto 作为外层 orchestrator 的前提下，让 Geppetto 从 AI-native Solana harness，演进为连接 on-chain program 与 off-chain infrastructure 的 engineering control plane。**

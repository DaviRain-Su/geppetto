# Phase 2: Architecture — Geppetto Platform

> 状态：草稿（待 review）
> 日期：2026-04-15
> 输入：
> - `docs/platform/01-prd.md`
> - thread 共识：`geppetto.toml` / outer orchestrator / real demo path
> - 目标 deadline：2026-05-11 hackathon demo

---

## 1. 架构一句话

**Geppetto Platform v0.2.0 的架构不是“让 Encore 原生支持 Solana”，而是在 Geppetto 外层增加一个最小 orchestration / control-plane 层，用 `geppetto.toml` 作为真相源，把 Solana program deploy 与 Encore off-chain deploy 桥接成一次可重复的工程发布。**

---

## 2. Phase 2 锁定结论

### 已锁定

1. **这是新产品线，不是现有 harness 文档的延长线**
   - 现有 `geppetto` crate / CLI 继续是 harness / knowledge SDK
   - 新平台线单独落在 `docs/platform/`

2. **定位锁定为 control plane / bridge**
   - 不对外宣称 “Encore 已原生支持 Solana deploy”
   - 不承诺新的多云平台或新的 Solana framework

3. **MVP 先做 bridge，不做大平台**
   - 先证明一次真实的 on-chain + off-chain 闭环发布
   - 再考虑更重的 runtime / rollback / secrets / China cloud

4. **Source of truth 固定为 `geppetto.toml`**
   - Solana deploy 输入与 Encore deploy 输入都由它派生
   - deploy 输出也围绕它回填/关联，而不是反过来以 Encore 配置为根

5. **Deploy orchestration 放在 Geppetto 外层**
   - 通过 orchestrator 调已有 CLI / deploy flow
   - 当前不 fork Encore，不嵌入 Encore runtime

6. **MVP 运行模式固定**
   - on-chain: `Solana devnet`
   - off-chain: `Encore Cloud`
   - 单次 demo 发布目标：可用环境下 **15 分钟内**

### 明确不做

- 多云支持
- 中国云适配
- Encore 内核改造
- Encore 原生理解 Solana AST / PDA 模型
- 生产级 secrets rotation / rollback framework
- generalized indexer platform

---

## 3. 系统分层

MVP 只允许 4 层，避免概念漂移：

```text
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Harness / SDK                                    │
│  geppetto crate + existing CLI                             │
│  guard / schema / dispatch / test / agent knowledge        │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: App Contract                                     │
│  geppetto.toml                                             │
│  app/program/offchain/deploy/output contract               │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Orchestration / Control Plane                    │
│  geppetto deploy / status / future rollback                │
│  parse config -> build plan -> invoke adapters -> aggregate│
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Runtime / External Systems                       │
│  Solana devnet + Encore Cloud + build tools / CLI          │
└─────────────────────────────────────────────────────────────┘
```

### Layer 1: Harness / SDK

职责：
- 让 agent 写出正确、可测试的 Solana/Pinocchio 代码
- 提供现有 `geppetto` crate、helpers、CLI scaffolding、audit/test 知识层

不负责：
- 跨系统 deploy 编排
- off-chain infra 生命周期管理
- release output contract

### Layer 2: App Contract

职责：
- 定义一个最小、显式、可版本化的 app contract
- 把 “program / cluster / off-chain service / deploy outputs” 放到一个统一描述里

不负责：
- 真正执行部署
- 保存运行时 secrets

### Layer 3: Orchestration / Control Plane

职责：
- 读取 `geppetto.toml`
- 做配置校验与 plan 生成
- 调用：
  - Solana program build/deploy adapter
  - Encore deploy adapter
- 聚合输出，形成统一的 deployment result
- 对外输出稳定的人类可读 + 机器可读结果

不负责：
- 直接变成新的云 runtime
- 深度托管/改写 Encore 内部能力

### Layer 4: Runtime / External Systems

MVP 依赖：
- `solana` CLI / build toolchain
- Solana `devnet`
- Encore Cloud

这层只作为外部系统存在，不在 Geppetto 内重写。

---

## 4. Source of Truth：`geppetto.toml`

### 设计原则

`geppetto.toml` 必须满足 4 个要求：

1. **能描述 Solana 特有信息**
   - cluster
   - program crate / artifact
   - future PDA / account metadata 扩展位

2. **能描述 off-chain 服务需求**
   - service name
   - Encore app reference
   - deploy target metadata

3. **能承载 deploy contract**
   - 哪些输出必须回填 / 展示

4. **人类和 agent 都容易读写**
   - 明确字段
   - 少魔法推断

### MVP 最小结构

```toml
schema_version = "0.1"

[app]
name = "escrow-demo"

[solana]
cluster = "devnet"
program_path = "examples/escrow"
program_binary = "target/deploy/escrow.so"
keypair = "~/.config/solana/id.json"

[offchain]
provider = "encore-cloud"
encore_app = "escrow-demo-api"
project_path = "examples/escrow-api"

[deploy]
mode = "hybrid"
output = "table"
```

### 后续可扩展，但不进 MVP 的字段

- `pda.*`
- `secrets.*`
- `env.*`
- `override.*`
- `rollback.*`

这些在 v0.2.0 MVP 中只保留扩展空间，不要求完整实现。

---

## 5. 核心架构组件

MVP 只需要 5 个组件。

### 5.1 Config Loader

输入：
- `geppetto.toml`

职责：
- parse
- schema 校验
- 产生标准化内存模型

输出：
- `PlatformConfig`

失败分类：
- `config`

### 5.2 Deploy Planner

职责：
- 根据 `PlatformConfig` 生成一次 deploy plan
- 明确顺序：
  1. build program
  2. deploy program
  3. deploy encore service
  4. aggregate outputs

输出：
- `DeployPlan`

### 5.3 Solana Adapter

职责：
- 调 Solana 构建 / 部署入口
- 提取：
  - `program_id`
  - `cluster`
  - build/deploy status

边界：
- 通过 adapter 调现有 CLI / toolchain
- 不在 MVP 中实现自定义 Solana deploy engine

### 5.4 Encore Adapter

职责：
- 调 Encore Cloud 官方的 **git-push deploy workflow**
- 在真正 push 之前完成最小前置检查：
  - `encore auth whoami`
  - `encore.app` 已存在且已 link
  - `git remote encore` 已配置
- 提取：
  - `provider_deployment_id`（可选）
  - `service_url`
  - off-chain deploy status

边界：
- 只桥接，不改 Encore runtime

### 5.5 Output Aggregator

职责：
- 把 Solana 与 Encore 两端的输出统一成一个稳定 contract
- 提供：
  - 表格输出
  - JSON 输出

这是 MVP 必须做好的地方，因为它直接决定 demo / agent / CI 的可消费性。

---

## 6. Orchestrator Execution Layer

MVP 的执行层采用最简单、最可控的模式：

- 顺序 pipeline
- 单个共享状态对象
- step fail-fast

### 核心模式

每一步都遵循同一类签名：

```text
stepX(ctx, state) -> (state, error)
```

其中：
- `ctx`：整次 deploy 的上下文
- `state`：当前 deploy 的中间状态
- `error`：必须带 step name，便于顶层归类和输出 hint

### 建议步骤

```text
geppetto deploy
  -> Step 1: loadManifest()
  -> Step 2: validateConfig()
  -> Step 3: buildProgram()
  -> Step 4: deployProgram()
  -> Step 5: deployOffChain()
  -> Step 6: bridgeOutputs()
  -> Step 7: writeOutputs()
```

### DeployState（概念模型）

`DeployState` 至少要持有：

- `app_name`
- `cluster`
- `program_path`
- `program_id`
- `service_url`
- `run_id`
- `provider_deployment_id`
- `status`
- `failure_class`
- `steps[]`

这里不要求现在就把结构字段完全实现，但 Phase 3 必须把这个状态对象写成严格类型。

---

## 7. Deploy Contract

### 命令入口

MVP 只定义一个主入口：

```bash
geppetto deploy
```

后续扩展：
- `geppetto deploy --output json`
- `geppetto deploy --set key=value`

### 执行链路

```text
geppetto deploy
  -> load geppetto.toml
  -> validate config
  -> build deploy plan
  -> build Solana program
  -> deploy program to devnet
  -> auth/link preflight + git push encore
  -> aggregate outputs
  -> print / emit deployment result
```

### 顺序必须固定

MVP 中 deploy 顺序固定为：

1. `config`
2. `build`
3. `solana deploy`
4. `encore auth/link preflight + git push encore`
5. `output aggregation`

原因：
- program 先部署，才能让 off-chain 端消费 `program_id`
- MVP 先追求可预测性，不做并行编排

---

## 8. Output Contract

### 必出字段

无论 table 还是 machine-readable 输出，MVP 必须产出：

- `run_id`
- `program_id`
- `cluster`
- `service_url`
- `provider_deployment_id`（可选）

### 机器可读输出结构

MVP 推荐直接锁一个 JSON contract：

```json
{
  "app_name": "escrow-demo",
  "status": "success",
  "run_id": "run_20260415_001",
  "program_id": "9abc...",
  "cluster": "devnet",
  "service_url": "https://example.encore.app",
  "provider_deployment_id": "enc_abc123",
  "failure_class": null
}
```

失败时：

```json
{
  "app_name": "escrow-demo",
  "status": "failure",
  "run_id": "run_20260415_001",
  "program_id": null,
  "cluster": "devnet",
  "service_url": null,
  "provider_deployment_id": null,
  "failure_class": "deploy"
}
```

### 输出模式

MVP 锁定双模式输出：

1. **默认 table**
   - 面向人类演示
   - 适合 hackathon live demo

2. **`--output json`**
   - 面向 agent / CI
   - 字段名必须稳定

YAML 可以保留为后续兼容扩展，但 MVP 的 machine-readable contract 先以 JSON 为准。

### 失败分类（MVP 最少）

- `build`
- `deploy`
- `config`

不在 MVP 扩展：
- auth
- quota
- runtime
- network

这些可以先折叠进上述 3 类，避免过早设计复杂 taxonomy。

---

## 9. 产物与状态边界

### 推荐产物

MVP deploy 后建议至少生成：

1. `.geppetto/deploy-output.json`
   - 机器可读
   - 供 agent / CI 直接消费

2. `.geppetto/deploy-output.txt`
   - 人类可读摘要
   - 可选，但对 demo 友好

### 不建议做的事

- 不把整份 deploy 输出塞回 `geppetto.toml`

原因：
- `geppetto.toml` 是配置源
- deploy 输出应该是结果产物，而不是配置文件历史日志

如果需要轻量回填，只允许：
- `program_id`
- 最小 deploy metadata 引用

---

## 10. Override 预留位

虽然 `config override` 的完整实现属于后续功能阶段，但架构层必须提前留口子。

推荐优先级：

1. CLI `--set key=value`
2. env-specific 配置
3. file-level 默认值

MVP 最值得预留的 override 键：

- `cluster`
- `program_id`
- `service_name`
- `replicas`

这样做的原因不是“功能更多”，而是确保 demo / CI / agent 执行时不会被静态配置锁死。

---

## 11. Demo 路径（MVP 必须真实）

MVP demo 不是文档演示，而是一次真实闭环：

```text
escrow program
  + encore-backed API
  + geppetto.toml
  + single geppetto deploy
```

### Demo 成功标准

必须同时证明：

1. Solana program 成功部署到 `devnet`
2. Encore Cloud service 可访问
3. 输出统一的：
   - `run_id`
   - `program_id`
   - `cluster`
   - `service_url`
   - `provider_deployment_id`（若 Encore 不暴露稳定 ID，可为 `null`）
4. 失败时能清晰落到：
   - `build`
   - `deploy`
   - `config`

---

## 12. 关键设计选择与理由

### 选择 1：`geppetto.toml` 而不是 Encore 配置做真相源

理由：
- Solana 专有信息无法自然塞进 Encore 模型
- 平台目标是 bridge，不是 Encore-first wrapper

### 选择 2：outer orchestrator，而不是 Encore 内嵌

理由：
- 26 天 hackathon 约束下，fork / 改造 Encore 风险过高
- 外层 orchestrator 是最短路径

### 选择 3：先 machine-readable output，再做更大平台能力

理由：
- demo、agent、CI 都依赖稳定输出 contract
- 这是 bridge 是否真正 usable 的第一信号

### 选择 4：先单 program / 单 service / 单环境

理由：
- MVP 必须压缩复杂度
- 多 program / 多环境 / 多云都只会拉大失败面

---

## 13. 风险与架构约束

### 风险 1：CLI 依赖外部工具稳定性

现状：
- 依赖 `solana` CLI
- 依赖 Encore 官方 deploy 入口

控制方式：
- adapter 层隔离
- failure class 收敛

### 风险 2：输出 contract 不稳定

现状：
- 一旦字段反复变化，agent 和 demo 都会崩

控制方式：
- 从 Phase 2 就锁定最小字段集
- 在 Phase 3 写成强约束

### 风险 3：scope 重新膨胀

现状：
- 线程里已经出现 rollback / TLS / secrets / China cloud 等后续方向

控制方式：
- 全部压后
- `02-architecture` 只为 MVP bridge 服务

---

## 14. Architecture DoD

本阶段完成的标准不是“图画得漂亮”，而是为 Phase 3 提供不可歧义的输入。

必须满足：

1. 分层边界已明确
2. `geppetto.toml` 已成为单一 source of truth
3. deploy contract 已锁定执行顺序
4. output contract 已锁定最少字段与失败分类
5. MVP demo path 已具体到可实现程度
6. 任何人继续写 `03-technical-spec.md` 时，不需要再争论上述架构决策

---

## 15. 下一步（Phase 3 输入）

`docs/platform/03-technical-spec.md` 必须继续把以下内容写死：

1. `geppetto.toml` 的字段级 schema
2. `PlatformConfig` / `DeployPlan` / `DeploymentResult` 类型定义
3. `geppetto deploy` 的命令行为与错误码
4. Solana adapter / Encore adapter 的接口定义
5. machine-readable output 的严格格式
6. demo app 的最小目录与执行前提

---

## 一句话结论

**Geppetto Platform Phase 2 的核心不是构建一个新的 runtime，而是先锁定一个最小但真实的桥：以 `geppetto.toml` 为编排真相源，由 Geppetto 外层 orchestrator 串起 Solana devnet program deploy 与 Encore Cloud service deploy，并通过稳定的 deploy/output contract 把两端聚合成一次可演示、可消费、可验证的工程发布。**

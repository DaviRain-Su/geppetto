# Phase 3: Technical Spec — Geppetto Platform

> 状态：草稿（待 review）
> 日期：2026-04-15
> 输入：
> - `docs/platform/01-prd.md`
> - `docs/platform/02-architecture.md`
> 重要：后续实现必须以本规格为契约；若实现与规格冲突，先改规格。

---

## 1. 实现目标

本阶段把 Phase 2 的架构锚点转成**可编码、可测试、可拆任务**的技术契约。

MVP 目标仍然不变：

- 单入口：`geppetto deploy`
- on-chain：Solana `devnet`
- off-chain：Encore Cloud
- 真正产出统一 deploy 结果

本规格必须钉死：

1. 语言与实现载体
2. `geppetto.toml` 字段级 schema
3. CLI contract
4. Deploy pipeline 的状态模型
5. adapter 接口
6. output contract
7. 错误分类与错误码
8. 回填 / 产物策略

---

## 2. 实现语言与载体

### 2.1 语言选择

MVP 实现 **继续基于现有 Geppetto CLI 的 Node/JavaScript 栈扩展**，不新起 Rust/Go binary。

### 2.2 原因

1. 现有仓库已经存在 CLI 入口与 Node 侧分发路径
2. hackathon 时间窗口短，复用现有 CLI 发布路径成本最低
3. Phase 2 的目标是桥接，不是重写 runtime

### 2.3 约束

- 外部公开接口是 CLI，不是 SDK
- 内部实现可以使用 JSDoc typedef 或 TypeScript 风格结构说明，但 MVP 代码层不要求迁移到 TS
- 不引入新的长期 runtime（例如常驻 daemon / API server）

---

## 3. 目录与模块划分

MVP 建议新增平台线模块，但不打散现有 harness 目录。

```text
geppetto/
├── bin/
│   └── geppetto-cli.js
├── lib/
│   ├── platform/
│   │   ├── config.js
│   │   ├── deploy.js
│   │   ├── state.js
│   │   ├── output.js
│   │   ├── errors.js
│   │   ├── overrides.js
│   │   └── adapters/
│   │       ├── solana.js
│   │       └── encore.js
│   └── ...
└── docs/platform/
    ├── 01-prd.md
    ├── 02-architecture.md
    └── 03-technical-spec.md
```

### 模块职责

- `config.js`
  - load + parse + validate `geppetto.toml`
- `overrides.js`
  - parse `--set key=value`
  - apply allowlisted overrides
- `state.js`
  - `DeployState` / `StepLog` 构造与更新
- `deploy.js`
  - pipeline orchestration
- `output.js`
  - table / json 渲染
  - artifact 写入
- `errors.js`
  - error codes + `classifyError`
- `adapters/solana.js`
  - build / deploy / parse outputs
- `adapters/encore.js`
  - deploy / poll / parse outputs

---

## 4. `geppetto.toml` Schema

### 4.1 文件语义

`geppetto.toml` 是**配置源**，不是 deploy 日志库。

默认行为：
- 只读
- 不改原文件

只有显式使用 `--write-back` 时，才允许最小回填。

### 4.2 最小 schema

```toml
schema_version = "0.1"

[app]
name = "escrow-demo"

[solana]
cluster = "devnet"
program_path = "examples/escrow"
program_binary = "target/deploy/escrow.so"
keypair = "~/.config/solana/id.json"
program_id = ""

[offchain]
provider = "encore-cloud"
encore_app = "escrow-demo-api"
project_path = "examples/escrow-api"

[deploy]
mode = "hybrid"
output = "table"
```

### 4.3 字段级规则

#### 顶层

- `schema_version: string`
  - 必填
  - 当前只接受 `"0.1"`

#### `[app]`

- `name: string`
  - 必填
  - 非空
  - 用于输出与默认 run label

#### `[solana]`

- `cluster: string`
  - 必填
  - MVP allowlist:
    - `devnet`
    - `testnet`
    - `mainnet-beta`
  - MVP demo only guarantees `devnet`

- `program_path: string`
  - 必填
  - 指向 program crate / working dir

- `program_binary: string`
  - 必填
  - 指向预期产物路径

- `keypair: string`
  - 必填
  - 指向 deploy keypair

- `program_id: string`
  - 可空
  - **语义固定如下**：
    - 首次 deploy 前：可空
    - 首次 deploy 后：可作为回填位
    - 后续升级：作为输入读取

#### `[offchain]`

- `provider: string`
  - 必填
  - MVP 只允许：`encore-cloud`

- `encore_app: string`
  - 必填
  - **语义固定为 Encore Cloud app identifier / deploy target name**
  - 不表示本地目录名
  - 本地目录由 `project_path` 提供

- `project_path: string`
  - 必填
  - 指向 off-chain Encore 项目目录
  - `validateConfig` 必须进一步检查：
    - `${project_path}/encore.app` 存在
  - 如果目录存在但不是 Encore 项目：
    - 视为 `config` 类错误

#### `[deploy]`

- `mode: string`
  - 必填
  - MVP 只允许：`hybrid`

- `output: string`
  - 可选
  - allowlist:
    - `table`
    - `json`
  - 默认：`table`

### 4.4 不在 MVP 的字段

以下字段即使出现，也应在 parser 阶段拒绝或忽略并报配置错误：

- `pda.*`
- `secrets.*`
- `rollback.*`
- `provider != encore-cloud`

---

## 5. CLI Contract

### 5.1 主命令

```bash
geppetto deploy [options]
```

### 5.2 支持的参数

#### `--output <table|json>`

- 可选
- 默认 `table`
- 只允许：
  - `table`
  - `json`

#### `--set key=value`

- 可重复出现
- 用于覆盖 allowlisted config key

#### `--write-back`

- 可选
- 默认关闭
- 开启时允许最小回填 `program_id`

### 5.3 本阶段不实现

- `--output yaml`
- 任意 key override
- `rollback` 命令的完整生产版

---

## 6. Override 规格

### 6.1 优先级

从高到低：

1. CLI `--set key=value`
2. env-specific config（后续扩展位，MVP 暂无独立区块）
3. file-level value

### 6.2 Allowlist

MVP 只允许覆盖以下 key：

- `cluster` -> `[solana].cluster`
- `program_id` -> `[solana].program_id`
- `service_name` -> `[offchain].encore_app`
- `replicas` -> runtime deploy hint（不回写 toml）

### 6.3 非法 key 行为

出现未白名单 key：
- 立即失败
- 错误分类：`config`
- 错误码：`ECFG006`

### 6.4 解析规则

- 必须包含 `=`
- key 不能为空
- value 允许包含 `=`

例：

```bash
geppetto deploy --set cluster=devnet --set service_name=escrow-api
```

---

## 7. 状态模型

### 7.1 `DeployState`

```ts
type FailureClass = "build" | "deploy" | "config" | null

type StepStatus = "success" | "failure" | "skipped"

interface StepLog {
  name: string
  status: StepStatus
  error?: string
  elapsed_ms: number
}

interface DeployState {
  run_id: string
  app_name: string
  cluster: string
  program_path: string
  program_binary: string
  program_id: string
  service_url: string | null
  provider_deployment_id: string | null
  status: "success" | "failure"
  failure_class: FailureClass
  steps: StepLog[]
}
```

### 7.1.1 `program_id` 内部表示规则

为避免在实现层混用 `null` 与空字符串，内部状态统一使用：

- `program_id: string`

规则：
- 未分配：`""`
- 已分配：非空 base58 字符串

对外 JSON 输出时：
- 若内部值为 `""`，可序列化为 `null`
- 若内部值非空，则输出真实 `program_id`

### 7.2 `run_id` 与 `provider_deployment_id`

这是本阶段明确锁死的规则：

- `run_id`
  - Geppetto 自己生成
  - **必出字段**
  - 用于本次 deploy 的统一标识

- `provider_deployment_id`
  - 来自 Encore 侧
  - **可选字段**
  - provider 能稳定拿到就填，拿不到允许为空

因此，Phase 2 里概念性的 `deployment_id` 在 Phase 3 落地时拆成：
- `run_id`（强保证）
- `provider_deployment_id`（弱保证）

对外 table 输出可显示：
- `deployment_id = run_id`

对机器可读 JSON 输出必须同时给出两个字段。

---

## 8. Deploy Pipeline 规格

### 8.1 总顺序

固定顺序：

1. `loadManifest`
2. `validateConfig`
3. `buildProgram`
4. `deployProgram`
5. `deployOffChain`
6. `bridgeOutputs`
7. `writeOutputs`

### 8.2 Step contract

每个 step 满足：

```ts
type StepFn = (ctx: Context, state: DeployState, config: PlatformConfig) =>
  Promise<DeployState>
```

规则：
- 成功：返回更新后的 state
- 失败：抛错，顶层统一包裹 step name
- 每个 step 必须写 `steps[]`

### 8.3 Step 详细行为

#### Step 1 `loadManifest`

输入：
- repo cwd
- `geppetto.toml`

输出：
- `PlatformConfig`
- 初始化 `DeployState`

失败归类：
- `config`

#### Step 2 `validateConfig`

检查：
- `schema_version`
- required fields
- `provider == encore-cloud`
- `cluster` allowlist
- `program_path` / `project_path` existence
- `${project_path}/encore.app` existence

失败归类：
- `config`

#### Step 3 `buildProgram`

行为：
- 在 `solana.program_path` 下执行 Solana build 入口
- 产出/确认 `program_binary`

失败归类：
- `build`

#### Step 4 `deployProgram`

行为：
- 调 Solana deploy adapter
- 获取 `program_id`

成功后：
- `state.program_id = ...`

失败归类：
- `deploy`

#### Step 5 `deployOffChain`

行为：
- 调 Encore adapter
- 先做前置检查：
  - `encore auth whoami`
  - `encore.app` 已 link（`id` 非空）
  - `git remote encore` 已配置
- 再执行官方 cloud deploy workflow：
  - `git add -A`
  - `git commit -m "geppetto deploy <run_id>"`
  - `git push encore`
- 获取：
  - `provider_deployment_id?`
  - `service_url`

约束：
- MVP 不自动执行 `encore app link`
- 若 app 未 link，直接返回可操作的 config 错误

如果 `service_url` 非即时可得：
- 进入 polling / retry

失败归类：
- `deploy`

#### Step 6 `bridgeOutputs`

行为：
- 聚合：
  - `program_id`
  - `cluster`
  - `service_url`
  - `run_id`
  - `provider_deployment_id`

若关键字段缺失：
- 失败归类为 `deploy`

#### Step 7 `writeOutputs`

行为：
- 写 `.geppetto/deploy-output.json`
- 可选写 `.geppetto/deploy-output.txt`
- 如果启用 `--write-back`，回填最小字段

---

## 9. Adapter 接口

### 9.1 Solana Adapter

```ts
interface SolanaDeployResult {
  program_id: string
  cluster: string
}

interface SolanaAdapter {
  build(ctx: Context, cfg: PlatformConfig): Promise<void>
  deploy(ctx: Context, cfg: PlatformConfig): Promise<SolanaDeployResult>
}
```

### 9.2 Encore Adapter

```ts
interface EncoreDeployResult {
  provider_deployment_id: string | null
  service_url: string | null
}

interface EncoreAdapter {
  deploy(ctx: Context, cfg: PlatformConfig): Promise<EncoreDeployResult>
  pollServiceURL?(
    ctx: Context,
    cfg: PlatformConfig,
    partial: EncoreDeployResult
  ): Promise<string>
}
```

Encore adapter 的 MVP 内部实现假设锁定为：

1. `encore auth whoami`
2. 读取并校验 `project_path/encore.app`
3. 校验 `git remote get-url encore`
4. `git add -A && git commit -m "geppetto deploy <run_id>"`
5. `git push encore`
6. 从 push 输出和/或后续 Encore CLI 查询中提取：
   - `service_url`
   - `provider_deployment_id`（若没有稳定来源，可返回 `null`）

### 9.3 `service_url` polling / retry

如果 `git push encore` 或后续 Encore CLI 查询不直接稳定返回 URL，则必须执行 polling。

MVP 默认策略：

- interval: `5s`
- max attempts: `12`
- total timeout: `60s`

60 秒后仍拿不到 URL：
- 失败归类：`deploy`
- 错误码：`EDEPLOY004`

优先查询顺序：

1. `git push encore` stdout/stderr 解析
2. `encore namespace list -o json`
3. 其他官方 CLI 查询（若后续确认稳定）

MVP 不允许：
- 依赖 dashboard 手工复制 URL
- silent success 且 `service_url = null`

### 9.4 本阶段不实现

- Encore SDK-first integration
- provider plugin system
- local mock provider 正式模式

如需 hackathon 应急 dry-run，只能作为后续扩展，不进入本阶段 DoD。

---

## 10. Error 分类与错误码

### 10.1 顶层 failure class

- `build`
- `deploy`
- `config`

### 10.2 最小错误码集

#### Config

- `ECFG001`
  - missing `geppetto.toml`
- `ECFG002`
  - invalid TOML parse
- `ECFG003`
  - unsupported `schema_version`
- `ECFG004`
  - missing required field
- `ECFG005`
  - invalid enum / allowlist value
- `ECFG006`
  - invalid `--set` format or override key

#### Build

- `EBUILD001`
  - program build failed

#### Deploy

- `EDEPLOY001`
  - solana deploy failed
- `EDEPLOY002`
  - Encore git-push deploy failed
- `EDEPLOY003`
  - missing required deploy output after successful command
- `EDEPLOY004`
  - service URL polling timeout

### 10.3 Adapter 错误映射规则

外部工具原始错误不可直接作为唯一分类依据，必须映射：

- parser / validation 前失败 -> `config`
- build command 失败 -> `build`
- deploy command / URL retrieval / aggregation 失败 -> `deploy`

Encore 侧最小映射规则：

- `not logged in` -> `config`
- `encore.app.id` 为空 / app 未 link -> `config`
- `git remote encore` 缺失 -> `config`
- `git push encore` 失败 -> `deploy`
- `service_url` / `provider_deployment_id` 提取失败 -> `deploy`

原始 stderr：
- 保留在 `error` 文本里
- 但不替代顶层分类

---

## 11. 输出契约

### 11.1 默认 table

最少展示：

- `app_name`
- `cluster`
- `program_id`
- `service_url`
- `deployment_id`（显示 `run_id`）
- `status`

### 11.2 JSON 输出

```json
{
  "run_id": "run_20260415_001",
  "provider_deployment_id": "enc_abc123",
  "app_name": "escrow-demo",
  "status": "success",
  "program_id": "9abc...",
  "cluster": "devnet",
  "service_url": "https://example.encore.app",
  "failure_class": null,
  "steps": [
    {
      "name": "loadManifest",
      "status": "success",
      "elapsed_ms": 12
    }
  ]
}
```

### 11.3 输出稳定性规则

- JSON field 名不可随版本任意改动
- 新增字段只能 additive
- 不允许重命名 `run_id/program_id/cluster/service_url/status`

---

## 12. 写回与产物策略

### 12.1 默认行为

默认只写：

- `.geppetto/deploy-output.json`
- 可选 `.geppetto/deploy-output.txt`

默认 **不改** `geppetto.toml`

### 12.2 `--write-back`

只有显式传入：

```bash
geppetto deploy --write-back
```

才允许回填：

- `[solana].program_id`

不允许回填：
- `service_url`
- `provider_deployment_id`
- step logs

---

## 13. 边界条件（至少 12 个）

1. `geppetto.toml` 不存在
2. TOML 语法错误
3. `schema_version` 非 `0.1`
4. `solana.cluster` 非 allowlist
5. `program_path` 不存在
6. `project_path` 不存在
7. `--set` 缺少 `=`
8. `--set` key 为空
9. `--set` 使用未白名单 key
10. Solana build 成功但 `program_binary` 不存在
11. Solana deploy 成功文本中未提取到 `program_id`
12. `encore auth whoami` 返回 `not logged in`
13. URL polling 超时
14. `encore.app` 存在但 `id` 为空（未 link）
15. `git remote encore` 缺失
16. `git push encore` 成功但初始没有 `service_url`
17. `--write-back` 时原 TOML 文件不可写
18. `program_id` 为空时首次 deploy 成功，必须能继续输出而不依赖回填

---

## 14. 测试输入（给 Phase 5）

Phase 5 至少应覆盖：

### Happy path

1. `geppetto deploy --output json`
2. `geppetto deploy --set cluster=devnet`
3. `geppetto deploy --write-back`

### Boundary

1. 空 `program_id`
2. `provider_deployment_id = null`
3. `service_url` 通过 polling 才可得

### Error / attack

1. 非法 `--set`
2. 非 allowlist key
3. 缺字段 TOML
4. build 失败
5. deploy 失败
6. URL timeout

---

## 15. Phase 4 拆任务输入

Phase 4 可直接按以下 P0 切分：

1. parser + schema validation
2. override parser + whitelist
3. `DeployState` + `StepLog`
4. Solana adapter
5. Encore adapter + URL polling
6. output renderer + artifacts
7. write-back control

每个任务应控制在 `<= 4h` 粒度。

---

## 一句话结论

**Geppetto Platform Phase 3 的最核心约束是：继续沿用现有 Node CLI 作为实现载体，以 `geppetto.toml` 为配置源，以 `run_id + provider_deployment_id` 拆解 deployment identity，以 allowlisted `--set` 和默认只写结果产物的策略控制配置变异，并把 `geppetto deploy` 严格实现为一个可分类、可观测、可机器消费的单入口 hybrid deploy pipeline。**

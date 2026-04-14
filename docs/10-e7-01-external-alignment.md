# E7-01 外部对齐建议草案（最小版）

## 1. 候选目标

### A. Pinocchio 生态

- **仓库/项目名**：Pinocchio（及其相关生态仓库）
- **当前关系**：持续消费方；Geppetto 已对接其 runtime/knowledge 结构并做内部单源治理。
- **为何值得对齐**：
  - Pinocchio 是 Geppetto 的主要上游语义源，知识偏差会直接影响上手体验；
  - 生态层面如果能共识 `AGENTS / 知识头 / 单源模板` 约定，可降低双向漂移成本。

### B. create-solana-dapp

- **仓库/项目名**：create-solana-dapp
- **当前关系**：Geppetto 可在“新项目启动模板”层面对齐，但目前尚未形成固定模板入口。
- **为何值得对齐**：
  - 用户最早接触链路在项目创建阶段，和 `geppetto new` 的目标用户一致；
  - 一页建议即可带来高可见性收益，且对上游方改动成本低；
  - 与本阶段 E5 的 `geppetto new` 产物能形成天然的“交叉路径”。

### C. agent / skill 生态

- **仓库/项目名**：AGENTS / CLAUDE.md / GEMINI.md / codex/cursor/windsurf/amazonq/aider 等多 agent/skill 生态入口约定位点
- **当前关系**：Geppetto 已形成内部约束，但对外可复用模板与规范尚未外部化。
- **为何值得对齐**：
  - 规则一致性是 Geppetto 核心价值之一；
  - 外部模板可复用可减少“文档新鲜度”和“模板分叉”问题。

## 2. 建议动作（按对象）

### Pinocchio 生态（建议类别：`docs` / `workflow` / `knowledge`）

- 建议提交一份“同步建议清单”（非代码变更）：
  - Geppetto 已验证的知识头版本策略；
  - `AGENTS` 作为单一事实源的实践；
  - `feature matrix` 与上游检查链路。

### create-solana-dapp（建议类别：`template` / `getting-started` / `docs`）

- 优先建议：提供一页接入建议，包含：
  - Geppetto 的 `geppetto init` / `geppetto new` 触发时机；
  - `seed` 模板与 `agent` 入口单源化思路；
  - `docs:check` / `release:check` 中可复用的“可验证项”。

### agent / skill 生态（建议类别：`docs` / `getting-started` / `template`）

- 建议发布统一的最小接入说明：
  - 统一入口文件命名与镜像规则；
  - `docs-first` 与 `review-first` 的最小约束；
  - 建议示例（示例级模板）清单。

## 3. 预期收益

### 对 Geppetto 的收益

- 增加外部可见性，减少“只在仓内自洽”的边界风险；
- 提前让外部用户在创建阶段就理解 `agent-first` 与 `single-gate` 约定；
- 为后续 E8 外溢（更稳健的外部协作）提供可度量输入。

### 对外部生态的收益

- create-solana-dapp 用户可更早获得 Geppetto 风格的规范化起步路径；
- Pinocchio 生态可复用“版本一致性检查 / 变更说明模板 / 知识漂移提示”经验；
- 多 agent/skill 生态可减少文档镜像漂移的治理负担。

## 4. 风险 / 前置条件

- **前置条件**：当前 `docs/04-task-breakdown.md` 与 `docs/08-evolution.md` 的 E7 口径先完成统一（已完成）。
- **风险**：建议清单被误解为“要强制接入”；需在文档里明确“可选采纳、非强制”边界。
- **风险**：单点建议若没有实际案例验证，可能被认为是“理论性建议”；优先以小步、可复制建议起步。
- **风险**：过早下发多个仓库建议会带来口径偏差；本轮保留单路径。

## 5. 优先级

- **P1（现在可做）**：create-solana-dapp
- **P2（需要再准备）**：Pinocchio 生态建议清单
- **P3（先观察）**：agent / skill 生态模板提案（先沉淀成统一模板再对外推）

## 6. 单一路径选择（本轮执行口径）

- 本轮仅选 **1 个外部动作**：先对接 `create-solana-dapp`。
- 其余对象（Pinocchio / agent-skill）先进入建议池，保留到下一轮再选。

## 附：本轮行动项摘要（与 docs task 同步）

- `docs/04-task-breakdown.md` 的 E7-01 已对应到本草案；
- 下一步：按本草案起草 create-solana-dapp 的可执行提交清单（E7-01 收尾）；
- 之后再进入 E7-02（对齐文档草案）进行模板化交付前的对外摘要补充。

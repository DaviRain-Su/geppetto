# E7-02 Action Plan — create-solana-dapp 外部提交草案

## 1. 目标仓库

- **目标仓库**：`create-solana-dapp`
- **本轮目标**：给最小启动链路添加 Geppetto 友好接入建议（docs / template 提示级别）
- **范围边界**：仅做外部可吸收的文档/模板建议，不包含业务逻辑或 API 改造

## 2. 本轮单一路径（仅一项）

- **唯一外部目标**：`create-solana-dapp`
- **唯一动作类型**：`docs + template` 建议提交（不直接改动 Geppetto 运行时代码）
- **不做事项**（本轮）：
  - 不并行推进 Pinocchio 主仓库
  - 不推进 agent / skill 多仓并行对接
  - 不要求对方接入重型框架化改造

## 3. 最小提交清单（Draft）

### 3.1 建议新增内容（create-solana-dapp）

新增一个“Geppetto 快速接入段落”（位于 `README` 或 `docs` 的快速开始位置）：

1. **引导语**：说明 Geppetto 是面向 Pinocchio 的 `agent-first` 轻量规则层与 scaffold 工具。
2. **最小接入步骤**：
   - `cargo add geppetto`
   - `npx geppetto-cli init`
   或 `npx geppetto-cli new my-program`（按仓库已有模板语义）
3. **最小约束说明**：
   - 先用文档验证 + 守门模板，而不是立刻引入框架约束；
   - 支持文档与模板为后续规范来源，非强制执行项。

### 3.2 拟影响文件（对方仓库）

- `README.md`（在模板/快速上手章节）
- `docs` 下可扩展的可选“生态模板建议”文件（如存在）
- 如该仓库存在脚手架模板列表页，补一条 “Geppetto onboarding” 链接（可选）

### 3.3 不做项（明确写入 PR）

- 不要求 create-solana-dapp 引入 `geppetto` 的版本锁策略
- 不要求其复制 geppetto 内部检查脚本
- 不要求其改造现有 CLI 流程，仅补充文案/模板提示

## 4. 对外提交文案（初稿）

### PR 标题候选

- `docs: add Geppetto quick-start note for Pinocchio project bootstrap`

### PR 描述摘要（可直接粘贴）

> This PR adds a minimal, opt-in Geppetto onboarding note for users creating new programs.
> 
> - Adds a short integration hint in docs for `cargo add geppetto` + `npx geppetto-cli` flow.
> - Emphasizes minimal, non-invasive entry path for `agent-first` users.
> - No runtime behavior change required; this is docs/template-only and low-risk.

### 对方价值（提交摘要中的“Why now”）

- 更早把 Geppetto 放到“从模板到安全约束/脚手架”这一条可见路径上；
- 与 `create-solana-dapp` 的“新建即上手”模型一致，降低用户认知跳转成本；
- 以最小改动提高可见性，避免生态上出现重复说明。

### 低风险说明（提交摘要中的“Risk”）

- 修改仅限文档与可选模板提示；
- 不改变脚手架行为，不增加运行时依赖；
- 可独立回退，不影响 create-solana-dapp 核心生成逻辑。

## 5. 发送前 Checklist

- [ ] Geppetto 口径与外部建议在 `docs/04-task-breakdown.md` / `docs/08-evolution.md` 已一致；
- [ ] 本轮文档已对齐：E7-01 草案 + E7-02 action plan 都明确单一路径；
- [ ] Geppetto 链路（`init / new / test / audit`）不依赖未发布功能；
- [ ] 外部建议不要求对方做高摩擦改造（仅文档与模板提示）；
- [ ] 该提案可独立审查，并可单独接受或拒绝。

## 6. 发送决策（本轮）

### 6.1 元数据

- **目标仓库**：`create-solana-dapp`
- **动作类型**：`docs` + `template`（外部集成建议，非代码级改动）
- **预期修改文件**：
  - `README.md`（快速开始 / 模板说明区）
  - `docs/...` 下的脚手架或模板说明页（如存在）
- **拟议 PR 标题**：
  - `docs: add minimal Geppetto onboarding guidance for Pinocchio bootstrap`

### 6.2 决策

- 决策：**Hold（待外部发送窗口确认）**
- 当前依据：
  - E1~E6 已闭环；
  - E7-01 草案与 E7-02 清单已成文；
  - create-solana-dapp 单路径已明确，不涉及 Pinocchio / agent-skill 并行对接；
  - 建议保持 docs/template 级最小改动，单一文件可独立审查。
- 发送前快速校验：
  1. 对方仓库快速上手章节路径确认；
  2. 文案与现有模板术语不冲突；
  3. PR/讨论内容保持单文件或最小文件修改。

## 7. 下一步（E7-02 结项条件）

- 一旦发送前校验满足并获得窗口确认，执行：
  - 在对方仓库提交 `discussion` 或 `PR`；
  - 附上本文件中的 PR 草稿；
  - 严格保持单路径，不并行发起 Pinocchio 或 agent-skill 对接。
- 若校验不满足，继续保留内部草案并补齐冲突项后再推进。

## 7.1 E7-04 发送窗口确认（内部）

- 发送状态：`hold`
- 暂缓原因：
  - 当前优先级优先完成仓内治理与验证闭环；
  - 外部窗口与对齐联系人由内部节奏确认后再发起。
- 执行条件：
  - `docs/10`、`docs/11`、`docs/12` 与 `docs/06`、`docs/07`、`docs/08` 的口径一致；
  - `npm run docs:check` 与 `npm run release:check` 均通过；
  - 目标仓库维护者沟通窗口确认可接受的外部提交方式。

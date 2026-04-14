# E7-04 外部发送窗口确认（内部）

## 结论

E7 外部发送动作当前为 **Hold（待窗口确认）**，不执行即时对外提交。

> 目标：在满足沟通与质量条件后，才发起 `create-solana-dapp` 的外部输出。

## 发送状态

- 决策：`Hold`
- 触发条件：在窗口确认后执行 `discussion`，再按反馈择机转 `docs-only PR`
- 当前阻断项：
  - 外部沟通窗口（对接人/时段）未对齐；
  - 未完成对 `create-solana-dapp` 目标位置的最终确认（提交点/沟通口径）。

## 对外沟通入口（固定）

- 文档链路：
  - `docs/10-e7-01-external-alignment.md`（外部协同口径）
  - `docs/11-e7-02-create-solana-dapp-action-plan.md`（单路径执行计划）
  - `docs/12-e7-03-create-solana-dapp-discussion-draft.md`（discussion 草稿）

## 发送前必需条件

- [ ] `npm run docs:check` 通过
- [ ] `npm run release:check` 通过
- [ ] `git status --short` 空（或仅保留本轮外联相关改动）
- [ ] 与目标仓库约定的沟通窗口与联系人确认
- [ ] 目标仓库“可接受 discussion / PR”路径确认（discussion 优先）
- [ ] 文案与现有术语不冲突（`Pinocchio / create-solana-dapp` 文档语境）

## 发送窗口 readiness 命令（内部）

可使用以下命令快速复核该文档与工作区状态：

- `npm run e7:readiness`
- `npm run e7:readiness -- --json`（机器可读输出）
- `npm run e7:readiness -- --strict`（将 `Send now` 条件不足视为失败码）

## 决策输出

- 发送窗口仍未确认：保持内部暂缓；
- 窗口确认后：执行 `docs/12...` 草稿里的对外动作清单。

## 风险提示

- 该任务不直接改变 geppetto 运行时能力；
- 仅在时机成熟后触发外部沟通，避免草案长期发散与口径漂移。

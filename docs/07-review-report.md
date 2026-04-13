# Phase 7: Review & Deploy — Geppetto

> 状态：待启动
> 日期：2026-04-13
> 输入：Phase 6 实现日志（当前未完成）

## 7.1 审查目标

确认从 `src` 到 `tests` 的实现与以下三类目标一致：
- 功能正确性：符合 PRD 里的 FR 与技术规格的可观测行为。
- 工程一致性：与 Pinocchio 生态版本匹配、无额外运行时副作用、接口命名清晰。
- 风险可控性：高风险模块（账户解析、签名校验、PDA 派生、序列化）具备可复核边界行为。

## 7.2 人机审查分工（待进入此阶段时执行）

- 机器审查（代码层）
  - `cargo test` / `cargo test --doc` 全绿
  - `rustfmt` + `cargo clippy` 无阻塞告警
  - `cargo doc` 无断链
  - API 与 `docs/03-technical-spec.md` 的字段、签名、错误码一致性检查
- 人工审查
  - 安全关键路径：`guard` / `schema::try_from_account` / `dispatch::split_tag` / `idioms::close_account`
  - 版本头与 knowledge freshness 规则是否一致落地
  - 是否出现“可运行但不透明”的实现（例如宏隐藏逻辑超过预期）

## 7.3 部署前核对清单（未开始）

- [ ] 可复现构建：`cargo test --workspace`、`cargo doc --workspace`
- [ ] 示例程序与测试可在目标链路环境运行（litesvm / bankrun 路径已验证）
- [ ] 版本号与依赖策略：`pinocchio` 与各可选 helper 版本符合 `docs/00-05` 契约
- [ ] 文档入口一致：`AGENTS.md` + 多入口规则文件齐全或与 `geppetto-cli init` 等价
- [ ] 发布清单：更新日志与最小变更说明

## 7.4 风险与阻塞项（当前）

- 代码骨架已落地：`Cargo.toml` + `src/lib.rs`（re-export + 模块声明）+ 9 个空模块文件。A-02 完成。
- 业务逻辑尚未实现：guard/schema/dispatch/error/idioms 等模块为空文件，A-03 起待实现。
- 依赖版本锁定与特性矩阵未在实现中验证（`cargo test` 尚无测试用例）。
- `src/main.rs` 已删除，当前为纯 library crate。

## 7.5 部署策略（当前建议）

- 先执行 `A-02 -> A-04 -> A-06 -> A-10 -> A-12` 的最小可验证链路，建立第一轮绿灯（知识文档 A-14 在核心代码稳定后补充）。
- 第二轮补齐剩余 guard 与测试，形成 full MVP。
- 审查报告提交时必须把“发现 / 决策 / 回滚条件”按条目输出。

## Phase 7 验收标准

- [ ] 已完成的实现通过人工与机器审查并有签字记录
- [ ] 无严重安全缺陷与关键错误码不一致
- [ ] 可发布前置条件齐全，且有部署回退方案
- [ ] 文档与代码同步，未出现技术规格偏离


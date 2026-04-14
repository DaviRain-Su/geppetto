# Current Status Summary — Geppetto

> 日期：2026-04-14
> 状态：内部主线编码工作基本完成；外部发送动作保持 Hold

## 1. 总体结论

Geppetto 当前仓库状态可概括为：

- **内部实现闭环已完成**
- **发布前检查链路已成形**
- **外部协同材料已准备好**
- **外部发送决策当前保持 Hold**

就本仓库内部而言，主线编码工作已经基本完成；后续更偏向外部协同、反馈采集与选择性增强，而不是继续补主干能力缺口。

## 2. 已完成的主线工作

### Phase 7

- escrow 示例关键语义修正完成
- public docs / examples 与 `geppetto::*` facade 对齐
- review report、release note、基线/回滚口径完成统一
- Phase 7 审查闭环完成

### Phase 8 — E1 CLI 硬化

- `geppetto-cli init`
- canonical 模板 manifest
- `--dry-run`
- template / pack / release 检查
- `release:check` 初始链路

### Phase 8 — E2 escrow ↔ client 对齐

- Rust fixture 生成
- TypeScript 对齐验证
- `npm run test:escrow-client-alignment`
- 文档绑定到真实示例路径

### Phase 8 — E3 文档/规则一致性检查

- knowledge header check
- agent entry mirror check
- feature matrix check
- `npm run docs:check`
- `docs:check` 接入 `release:check`

### Phase 8 — E4 上游依赖更新追踪

- upstream manifest
- current version extraction
- impact map
- upstream diff check
- upstream workflow 草案
- upstream PR body 模板
- manual review gate
- E4 文档闭环

### Phase 8 — E5 `geppetto new`

- `geppetto new <project-name>` 命令入口
- 非覆盖语义
- 最小模板变量替换
- Rust 项目骨架模板
- `tests/svm.rs` 最小测试骨架
- 复用 canonical agent 模板
- smoke scaffold test
- README / docs 接线
- E5 文档闭环

### Phase 8 — E6 `geppetto test` / `geppetto audit`

- CLI 主链路可用
- 执行器错误不再误判成功
- test / audit 回归测试补齐
- 已可作为后续阶段基线

### Phase 8 — E7 外部协同准备

- 外部对齐建议草案
- create-solana-dapp 单一路径 action plan
- discussion draft（中英双语）
- E7 文档入口已接线
- **实际外部发送：Hold**

### Phase 8 — E8 delivery / gate 补强

- delivery packet 生成
- schema 校验
- `--validate-only`
- 接入 `docs:check`
- E8 文档口径同步

## 3. 当前已可用的关键命令

### 发布 / 检查链路

- `npm run docs:check`
- `npm run release:check`
- `npm test`

### 示例 / 对齐

- `npm run test:escrow-client-alignment`

### CLI

- `npx geppetto-cli init`
- `npx geppetto-cli init --dry-run`
- `npx geppetto-cli new <project-name>`
- `npx geppetto-cli test`
- `npx geppetto-cli audit`
- `npm run upstream:check`
- `npm run upstream:pr-body`
- `npm run e7:delivery -- --validate-only`

## 4. 已知但非阻塞的问题

### 环境类

- 默认 `~/.npm` 缓存权限在部分环境下可能导致 `EPERM`
  - 规避方式：

```bash
NPM_CONFIG_CACHE=/tmp/npm-cache-test npm run release:check
```

- Rust 命令在部分环境下可能需要：

```bash
RUSTC_WRAPPER=
```

以绕过本地 `sccache` 权限问题。

这些都属于**环境噪音**，不是仓库回归。

## 5. 已准备好但当前保持 Hold 的事项

### create-solana-dapp 外部动作

- action plan 已写好
- discussion draft 已写好
- 单一路径已锁定（只针对 `create-solana-dapp`）
- 当前发送决策：**Hold**

相关文档：

- `docs/11-e7-02-create-solana-dapp-action-plan.md`
- `docs/12-e7-03-create-solana-dapp-discussion-draft.md`

## 6. 目前“还没做”的事项

这些不属于当前缺陷，而是后续可选方向：

### 外部执行类

- 真正发起 `create-solana-dapp` discussion / PR
- 根据外部反馈决定是否继续推进其他上游仓库

### 产品后续类

- 继续扩展 `geppetto audit`
- 继续扩展 `geppetto test`
- 继续丰富 scaffold 模板
- 整理正式 tag / release 节奏

## 7. 当前最推荐的动作

### 方案 A：先停在这里

如果当前目标是“仓库内部工作收完”，那么现在已经可以停：

- 内部链路基本闭环
- 检查命令可用
- 外部材料也准备好了

### 方案 B：后续再发外部讨论

等准备好了再执行：

- 打开 `docs/12-e7-03-create-solana-dapp-discussion-draft.md`
- 复制 discussion 草稿
- 对外发送

## 8. 一句话结论

**现在 repo 内部该做的主线编码工作基本已经做完；当前最重要但仍保持 Hold 的，是 create-solana-dapp 的外部发送动作。**

# Phase 4: Task Breakdown — Geppetto

> 状态：已验证
> 日期：2026-04-13
> 输入：Phase 3 技术规格
> 约束：每个任务 ≤ 4 小时，可独立完成

---

## 时间线

黑客松截止：2026-05-11（4 周）

| 周 | 日期 | 重点 |
|---|---|---|
| Week 1 | 04-14 ~ 04-20 | Phase 5 测试规格 + 核心模块骨架 |
| Week 2 | 04-21 ~ 04-27 | guard + schema + dispatch + error 实现 |
| Week 3 | 04-28 ~ 05-04 | idioms + 知识模块 + AGENTS.md |
| Week 4 | 05-05 ~ 05-11 | escrow demo + geppetto-cli + 视频 |

---

## 子模块 A：geppetto crate（核心）

### Sprint 1：骨架 + 核心 trait（Week 1）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| A-01 | **按 `docs/05-test-spec.md` 执行测试实现** — 为 guard/schema/dispatch/idioms/testing 所有公开 API 编写 happy/boundary/error 测试用例并使其通过 | 4h | Phase 3, A-02~A-12 | `cargo test` 全绿 |
| A-02 | **Cargo.toml + lib.rs 骨架** — 设置 `#![no_std]`，pinocchio 依赖，feature gates，空模块声明 | 1h | 无 | 编译通过的空 crate |
| A-03 | **error.rs** — `GeppettoError` 枚举（4 个变体，0x4700-0x4703），`From<GeppettoError> for ProgramError` | 1h | A-02 | `cargo build` 通过 |
| A-04 | **schema.rs** — `AccountSchema` trait（LEN, DISCRIMINATOR, layout, validate, try_from_account, from_bytes_unchecked），`assert_account_size!` 宏 | 3h | A-03 | trait 定义 + 宏 + 单元测试 |
| A-05 | **schema.rs 测试** — validate happy/boundary/error，try_from_account 全路径 | 2h | A-04 | `cargo test` 通过 |

### Sprint 2：Guard helpers（Week 2 前半）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| A-06 | **guard.rs 第一批（6 个）** — assert_signer, assert_writable, assert_readonly, assert_owner, assert_pda, assert_discriminator | 3h | A-03 | 6 个函数 + doc comments |
| A-07 | **guard.rs 第一批测试** — 每个函数 happy/boundary/error | 2h | A-06 | `cargo test` 通过 |
| A-08 | **guard.rs 第二批（6 个）** — assert_rent_exempt, assert_system_program, assert_token_program, assert_current_program, assert_account_count, assert_ata | 3h | A-06 | 6 个函数 + 常量定义 |
| A-09 | **guard.rs 第二批测试** | 2h | A-08 | `cargo test` 通过 |

### Sprint 3：Dispatch + Idioms helpers（Week 2 后半）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| A-10 | **dispatch.rs** — `split_tag()` + 常量（SELF_CPI_EVENT_DISCRIMINATOR, BATCH_DISCRIMINATOR）+ dispatch 模式文档 | 2h | A-02 | 函数 + 常量 + doc |
| A-11 | **dispatch.rs 测试** | 1h | A-10 | `cargo test` 通过 |
| A-12 | **idioms.rs 导出函数** — close_account, read_u64_le, write_u64_le, read_address | 3h | A-06 | 4 个函数 + doc comments |
| A-13 | **idioms.rs 函数测试** | 2h | A-12 | `cargo test` 通过 |

### Sprint 4：知识文档（Week 3）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| A-14 | **idioms.rs P0 知识** — entrypoint 选择、no_allocator/nostd、账户切片解构、TryFrom accounts 模式 | 4h | A-12 | doc comments + doctest |
| A-15 | **idioms.rs P1 知识** — CPI 风格、self-CPI 事件、Token-2022 双支持、Batch CPI、Codama、LiteSVM | 4h | A-14 | doc comments |
| A-16 | **anti_patterns.rs** — 6 个反模式（missing signer、unchecked owner、PDA collision、close drain、catch-all、unbounded alloc） | 3h | A-06 | doc comments + should_panic 示例 |
| A-17 | **client.rs** — 4 个话题（transaction、PDA、deserialization、error handling）+ TypeScript 示例 | 3h | A-04 | doc comments |
| A-18 | **testing.rs** — 3 个导出函数 + 知识话题（litesvm/mollusk 选择、CU profiling） | 2h | A-12 | 函数 + doc + feature gate |
| A-19 | **lib.rs crate 级文档** — 模块总览 + Quick Start + 版本头 | 2h | A-14 | `cargo doc` 完整生成 |

### Sprint 5：AGENTS.md + 集成（Week 3 末）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| A-20 | **AGENTS.md** — 完整内容（机械规则 + feature 选择 + Knowledge Freshness）| 2h | A-19 | AGENTS.md |
| A-21 | **多 agent 入口文件** — CLAUDE.md, GEMINI.md, .cursor/rules, .windsurf/rules, .github/copilot-instructions, .amazonq/rules, .aider.conf.yml | 1h | A-20 | 7 个入口文件 |
| A-22 | **全量 `cargo test`** — 所有 doctest + 单元测试 + 编译检查 | 2h | A-18 | 全绿 |
| A-23 | **`cargo doc` 验证** — 确认所有模块文档正确渲染，链接无断 | 1h | A-22 | docs.rs 预览级质量 |

---

## 子模块 B：npx geppetto-cli init

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| B-01 | **npm 包骨架** — package.json, bin 配置, init 命令入口 | 1h | 无 | `npx geppetto-cli` 可执行 |
| B-02 | **init 命令实现** — 生成 AGENTS.md + 7 个入口文件 | 2h | A-20 | 所有文件正确生成 |
| B-03 | **测试** — 在空目录和已有项目中运行 init，验证不覆盖已有文件 | 1h | B-02 | 测试通过 |

---

## 子模块 C：escrow demo + 视频

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| C-01 | **escrow 程序** — 用 geppetto 从官方 pinocchio-counter 模板改造为 escrow（create + exchange + close） | 4h | A-22 | `cargo build-sbf` 通过 |
| C-02 | **escrow 测试** — litesvm 端到端测试（create → deposit → exchange → close） | 3h | C-01 | `cargo test` 通过 |
| C-03 | **fixture-based 客户端对齐测试** — Rust 导出 fixture → TypeScript 反序列化验证 | 2h | C-01 | ts 测试通过 |
| C-04 | **A/B 对比录屏** — 裸 Pinocchio vs Geppetto 辅助，相同任务 | 3h | C-02 | 视频文件 |
| C-05 | **README.md** — 项目介绍 + Quick Start + 与竞品对比 + harness engineering 定位 | 2h | C-04 | README |

---

## 关键路径

```
A-02 → A-03 → A-04 → A-06 → A-08 → A-12 → A-14 → A-19 → A-20 → A-22
                                                                    ↓
                                                              C-01 → C-04
```

**关键路径总工时**：约 32h（4 个工作日密集编码）

**并行任务**：
- A-05/A-07/A-09/A-11/A-13（测试）可与下一个代码任务并行
- A-16/A-17（反模式/客户端知识）与 A-14/A-15 并行
- B-01~B-03 可在 Week 3-4 任意时间段完成
- C-03（fixture 测试）可与 C-02 并行

---

## 总工时估算

| 子模块 | 任务数 | 总工时 |
|--------|--------|--------|
| A：geppetto crate | 23 | ~52h |
| B：geppetto-cli | 3 | ~4h |
| C：escrow demo + 视频 | 5 | ~14h |
| **合计** | **31** | **~70h** |

4 周 × 5 天 × 4h/天 = 80h 可用。留 10h 缓冲应对意外。

---

## Phase 4 验收标准

- [x] 每个任务 ≤ 4h
- [x] 任务间依赖关系明确
- [x] 关键路径已识别
- [x] 时间线与黑客松截止日对齐
- [x] 总工时在可用时间内（70h / 80h 可用）
- [x] 可进入 Phase 5: Test Spec

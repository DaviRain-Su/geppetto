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
| A-16 | **anti_patterns.rs** — 7 个反模式（missing signer、unchecked owner、PDA collision、close drain、catch-all、unbounded alloc、hidden padding） | 3h | A-06 | doc comments + should_panic 示例 |
| A-17 | **client.rs** — 4 个话题（transaction、PDA、deserialization、error handling）+ TypeScript 示例 | 3h | A-04 | doc comments |
| A-18 | **testing.rs** — 3 个导出函数 + 知识话题（litesvm/mollusk 选择、CU profiling） | 2h | A-12 | 函数 + doc + feature gate |
| A-19 | **lib.rs crate 级文档** — 模块总览 + Quick Start + 版本头 | 2h | A-14 | `cargo doc` 完整生成 |

### Sprint 5：AGENTS.md + 集成（Week 3 末）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| A-20 | **AGENTS.md** — 完整内容（机械规则 + feature 选择 + Knowledge Freshness）| 2h | A-19 | AGENTS.md |
| A-21 | **多 agent 入口文件** — CLAUDE.md, GEMINI.md, .cursor/rules, .windsurf/rules, .github/copilot-instructions, .amazonq/rules, .aider.conf.yml | 1h | A-20 | 7 个入口文件 |
| A-01 | **按 `docs/05-test-spec.md` 执行全量测试实现** — 补齐所有模块的 happy/boundary/error 测试用例，确保 77 个用例全绿 | 4h | A-02~A-18 | `cargo test` 全绿（77 用例） |
| A-22 | **全量集成验证** — doctest + 单元测试 + 集成测试 + 编译检查 | 2h | A-01 | 全绿 |
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

## Phase 8 增量任务：E1 CLI 硬化与模板同步

> 基线：`ffa5535`
> 前提：B-01 ~ B-03 已完成（CLI MVP 可用）
> 目标：把 `geppetto-cli init` 从“可用”提升到“可验证、可预览、可发布维护”的稳定工具层。
> 状态：已完成（E1-01 ~ E1-09 已交付并验证）

### E1 Sprint 1：模板单源同步（已完成）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E1-01 | **模板清单与单源约束落地** — 明确 CLI 生成文件的 canonical source（仓库根文件），补充模板来源说明与维护注释 | 1h | B-03 | 模板来源规则文档/注释 |
| E1-02 | **模板完整性测试** — 增加测试，确保 `TEMPLATE_FILES` 与 CLI 实际生成集一致，防止漏文件/错路径 | 2h | E1-01 | 自动化测试覆盖模板清单 |
| E1-03 | **npm 打包 smoke test** — 基于 `npm pack` 验证发布包内确实包含所有模板文件，而非仅仓库中存在 | 3h | E1-02 | pack 级别校验脚本/测试 |

### E1 Sprint 2：CLI 可预览性（已完成）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E1-04 | **`init --dry-run`** — 预览将创建/跳过哪些文件，不实际写盘 | 2h | B-03 | dry-run CLI 行为 |
| E1-05 | **dry-run 测试** — 验证空目录/已有文件目录下输出正确，且文件系统无副作用 | 2h | E1-04 | dry-run 回归测试 |
| E1-06 | **CLI 帮助文案更新** — 在 usage/help 中明确 `init` 与 `init --dry-run` 语义 | 1h | E1-04 | 更新后的帮助输出 |

### E1 Sprint 3：版本与发布治理（已完成）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E1-07 | **模板版本映射说明** — 约定 CLI 模板版本与 crate/doc 基线的对应关系，写入 README 或 CLI 文档 | 2h | E1-01 | 版本映射说明 |
| E1-08 | **发布前检查脚本** — 固化 `npm test` + `npm pack --json` + 模板校验的发布前最小检查集合 | 2h | E1-03,E1-05 | 可复用的发布检查流程 |
| E1-09 | **E1 收口审查记录** — 将 CLI 硬化结果补入 `docs/06-implementation-log.md` / `docs/07-review-report.md` / `docs/08-evolution.md` | 1h | E1-08 | 文档闭环 |

### E1 关键路径

```
E1-01 → E1-02 → E1-03 → E1-08 → E1-09
          └────→ E1-04 → E1-05 ───┘
                    └────→ E1-06
          └────→ E1-07
```

**E1 总工时**：约 16h

**E1 完成定义（DoD）**：
- [x] `geppetto-cli init` 支持预览模式；
- [x] CLI 测试覆盖 create / skip / dry-run 三类行为；
- [x] `npm pack` 能验证发布包内模板完整；
- [x] 模板来源与版本映射文档明确；
- [x] E1 结果在 Phase 6/7/8 文档中有可追溯记录。

---

## Phase 8 增量任务：E2 escrow ↔ client 对齐

> 基线：`ffa5535`
> 前提：C-01 ~ C-03 已完成，escrow 示例与 fixture 生成链路可用
> 目标：把 escrow 示例从“仅 Rust 侧示例”提升为“Rust fixture ↔ TypeScript 读取”端到端对齐示例。
> 状态：已完成（E2-01 ~ E2-06 已交付并验证）

### E2 Sprint 1：Rust fixture 与布局导出（已完成）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E2-01 | **fixture 生成器** — 为 escrow 示例增加固定测试值导出，生成二进制账户数据 fixture | 2h | C-01 | `examples/escrow/tests/generate_fixtures.rs` |
| E2-02 | **布局元数据导出** — 将 `Escrow::LEN` 与字段 offset/size/value 一并写出 JSON，供 TS 侧直接读取 | 2h | E2-01 | `escrow_layout.json` |
| E2-03 | **Rust 侧入口统一** — 固化 fixture 生成命令与目录约定，保证本地/CI 可复现 | 1h | E2-02 | 固定 fixture 产出路径与生成方式 |

### E2 Sprint 2：TypeScript 对齐验证（已完成）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E2-04 | **TS 对齐脚本** — 按真实 offset 读取 binary fixture，逐字段校验类型、偏移与值 | 3h | E2-02 | `examples/escrow/tests/client_alignment.ts` |
| E2-05 | **统一运行入口** — 用 npm script 串联 Rust fixture 生成与 TypeScript 校验 | 1h | E2-04 | `npm run test:escrow-client-alignment` |
| E2-06 | **文档绑定** — 在 README、技术规格、测试规格、演化文档中将客户端说明指向真实 escrow 对齐示例 | 2h | E2-05 | 文档闭环 |

### E2 关键路径

```
E2-01 → E2-02 → E2-03 → E2-04 → E2-05 → E2-06
```

**E2 总工时**：约 11h

**E2 完成定义（DoD）**：
- [x] Rust 侧可生成稳定的 escrow binary + layout fixtures；
- [x] TypeScript 可按真实字段偏移读取并验证 fixture；
- [x] 仓库根目录存在统一运行入口；
- [x] 客户端知识文档已绑定到真实示例，而非停留在伪代码层；
- [x] 端到端对齐链路已通过实际命令验证。

---

## Phase 8 增量任务：E3 文档/规则自动一致性检查

> 基线：`6982280`
> 前提：E1（CLI 模板单源）与 E2（escrow ↔ client 对齐）已完成
> 目标：用轻量自动化守住知识版本头、agent 入口镜像与 feature matrix，降低“代码正确但文档/入口漂移”的维护成本。
> 状态：已完成（E3-01 ~ E3-08 已交付并闭环）

### E3 Sprint 1：知识版本头检查（已完成）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E3-01 | **检查目标清单** — 明确需要校验版本头的知识模块范围（`src/idioms/*`、`src/client.rs`、`src/testing/*`、`src/anti_patterns.rs` 等） | 1h | 无 | 检查目标 manifest |
| E3-02 | **版本头解析与校验脚本** — 读取 `Cargo.toml`，校验文档头中的 `geppetto` / `pinocchio` 版本与日期格式 | 3h | E3-01 | 可执行检查脚本 |
| E3-03 | **版本头回归测试** — 覆盖 happy path / 缺失头 / 版本不匹配等场景 | 2h | E3-02 | 自动化测试 |

### E3 Sprint 2：入口与规格一致性检查（已完成）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E3-04 | **agent 入口镜像校验** — 检查 `CLAUDE.md` / `GEMINI.md` / `.cursor` / `.windsurf` / `.github` / `.amazonq` / `.aider` 是否与 canonical 规则一致 | 2h | E3-01 | 入口一致性检查（已交付） |
| E3-05 | **feature matrix 校验** — 从 `Cargo.toml` 提取 `full` / `token-all` / `test-utils` 等定义，检查 `docs/03-technical-spec.md` 关键矩阵是否同步 | 3h | E3-01 | feature matrix 检查（已交付） |
| E3-06 | **统一运行入口** — 提供 `npm run docs:check` 或等价脚本，串联 E3 检查项 | 1h | E3-03,E3-04,E3-05 | 可复用命令入口（知识头 + agent 入口 + feature matrix） |

### E3 Sprint 3：发布/审查接线与收口

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E3-07 | **发布前接线** — 评估是否将 E3 检查纳入 `release:check` 或独立 review gate，并更新 README/维护说明 | 2h | E3-06 | 发布/审查接线方案（已交付） |
| E3-08 | **E3 收口文档** — 将实现结果补入 `docs/06-implementation-log.md` / `docs/07-review-report.md` / `docs/08-evolution.md` | 1h | E3-07 | 文档闭环 |

### E3 关键路径

```
E3-01 → E3-02 → E3-03 → E3-06 → E3-07 → E3-08
          └────→ E3-04 ───┘
          └────→ E3-05 ───┘
```

**E3 总工时**：约 15h

**E3 完成定义（DoD）**：
- [x] 知识模块版本头可自动检查；
- [x] 多 agent 入口文件可自动检查是否漂移；（当前范围）
- [x] `docs/03-technical-spec.md` 的关键 feature matrix 可与 `Cargo.toml` 自动比对；
- [x] 仓库提供统一的一致性检查入口命令；（知识头 + agent entry mirrors + feature matrix）
- [x] E3 当前结果在 Phase 6/7/8 文档中可追溯（含 `release:check` 与 `docs:check`）。

---

## Phase 8 增量任务：E4 上游依赖更新追踪

> 基线：`b7fcacc`
> 前提：E1（CLI 发布链路）与 E3（文档一致性 gate）已完成
> 目标：在 `pinocchio` / `mollusk-svm` / `litesvm` 等上游发布新版本时，提供可执行、可审查、默认不自动合并的更新追踪流程。
> 状态：已完成（E4-01 ~ E4-09 已交付并验证）

### E4 Sprint 1：依赖发现与影响清单

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E4-01 | **上游依赖清单固化** — 产出机器可读 manifest（JSON/JS 常量），明确需要追踪的 crates 及来源位置：`pinocchio*` 系列来自根 `Cargo.toml`，`mollusk-svm` 来自 `examples/escrow/Cargo.toml`，`litesvm` 当前按“文档/知识版本源”记录（主要对应 `src/testing/litesvm.rs`） | 2h | 无 | 依赖追踪 manifest（含来源/上游/当前版本字段） |
| E4-02 | **版本解析脚本** — 从根 `Cargo.toml`、`examples/escrow/Cargo.toml`、lockfile 与知识头/文档源中提取当前版本，形成机器可读输出 | 2h | E4-01 | 当前版本解析脚本 |
| E4-03 | **知识影响映射** — 为每个上游依赖列出需要人工复核的知识模块/文档范围（如 `idioms`、`testing`、`client`） | 2h | E4-01 | 影响模块清单 |

### E4 Sprint 2：检查与 PR 草案自动化

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E4-04 | **上游检查脚本** — 查询 crates.io 最新版本并比较当前版本，输出“是否存在更新”与差异摘要 | 3h | E4-02 | 可执行版本发现脚本 |
| E4-05 | **GitHub Actions workflow 草案** — 新增 `.github/workflows/` 目录与最小可运行的 `upstream-check.yml`，支持手动触发 / 定时触发，执行版本发现并产生日志 | 3h | E4-04 | `.github/workflows/upstream-check.yml` 最小草案 |
| E4-06 | **PR 描述模板** — 约定上游更新 PR 需包含版本差异、测试结果、CHANGELOG 链接、知识影响模块列表 | 2h | E4-03,E4-05 | PR 模板 / 输出格式 |

### E4 Sprint 3：审查策略与收口

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E4-07 | **人工审查门禁** — 明确“自动发现/自动建 PR，但不自动合并”的规则，并接入 README / evolution 文档 | 1h | E4-05,E4-06 | 审查门禁规则 |
| E4-08 | **E4 最小验证** — 验证脚本可在本地或 CI 中识别至少 1 个模拟版本漂移场景；确认失败输出可读 | 2h | E4-04,E4-05 | 回归测试 / smoke 记录 |
| E4-09 | **E4 收口文档** — 将实现结果补入 `docs/06-implementation-log.md` / `docs/07-review-report.md` / `docs/08-evolution.md` | 1h | E4-07,E4-08 | 文档闭环 |

### E4 关键路径

```
E4-01 → E4-02 → E4-04 → E4-05 → E4-07 → E4-09
    └────→ E4-03 ───────┘   └────→ E4-06 ───┘
                     └────→ E4-08 ──────────┘
```

**E4 总工时**：约 18h

**E4 完成定义（DoD）**：
- [x] 上游依赖追踪范围明确且可机器读取（含来源位置、当前版本、上游名称）；
- [x] 能自动检测当前 pinned 版本与 crates.io 最新版本差异；
- [x] 存在可手动/定时触发的 workflow 草案；
- [x] 自动化只负责发现与建议信息，不自动合并依赖更新；
- [x] 上游更新对知识模块的人工复核范围有明确清单；
- [x] E4 结果在 Phase 6/7/8 文档中可追溯。

---

## Phase 8 增量任务：E5 `geppetto new` 约定式项目脚手架

> 基线：`1a1d429`
> 前提：E1（CLI 模板链路）与 E4（上游依赖追踪）已完成
> 目标：从 `geppetto-cli init` 升级到可生成最小 Pinocchio + Geppetto 项目结构的 `geppetto new` 脚手架，但保持“显式代码、薄包装、不隐藏逻辑”的约束。
> 状态：已完成（E5-01 ~ E5-09 已交付并验证）

### E5 Sprint 1：脚手架入口与模板清单

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E5-01 | **命令入口 + 模板 manifest + 快照测试** — 为 `geppetto new <project-name>` 增加 CLI 入口、项目模板清单与最小快照测试，确保生成结果结构稳定可复现 | 4h | E1-03 | `geppetto new` 最小入口 + 模板 manifest + snapshot tests |
| E5-02 | **目标目录与非覆盖语义** — 明确目标目录不存在/已存在时的行为，拒绝危险覆盖，并补错误路径测试 | 2h | E5-01 | 安全创建语义 + 回归测试 |
| E5-03 | **模板变量替换** — 支持项目名、crate 名、程序目录名等基础变量替换，但不引入复杂模板引擎 | 3h | E5-01 | 最小变量替换能力 |

### E5 Sprint 2：最小项目骨架生成

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E5-04 | **Rust 项目骨架模板** — 生成 `Cargo.toml`、`src/lib.rs`、`processor.rs`、`state.rs`、`error.rs`、`instructions/mod.rs` 的最小可读骨架 | 4h | E5-03 | 可生成的 Rust 项目骨架 |
| E5-05 | **测试骨架模板** — 生成最小 `tests/svm.rs` / 示例 fixture 入口，保证新项目知道测试落点 | 3h | E5-04 | 测试骨架模板 |
| E5-06 | **Agent 入口集成** — 将已有 `AGENTS.md` / 多 agent 入口生成逻辑接入 `geppetto new`，避免与 `init` 形成两套模板源 | 2h | E5-01 | `new` 与 `init` 模板源统一 |

### E5 Sprint 3：验证与收口

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E5-07 | **生成结果 smoke test** — 在临时目录运行 `geppetto new demo-program`，验证目录树、关键文件内容与 snapshot 一致 | 2h | E5-04,E5-05,E5-06 | 端到端生成测试 |
| E5-08 | **README / docs 接线** — 在 README 与 `docs/08-evolution.md` 中说明 `geppetto new` 的定位、约束与非目标 | 2h | E5-07 | 文档接线 |
| E5-09 | **E5 收口文档** — 将实现结果补入 `docs/06-implementation-log.md` / `docs/07-review-report.md` / `docs/08-evolution.md` | 1h | E5-08 | 文档闭环 |

### E5 关键路径

```
E5-01 → E5-03 → E5-04 → E5-05 → E5-07 → E5-08 → E5-09
     └────→ E5-02
     └────→ E5-06 ───────────────┘
```

**E5 总工时**：约 23h

**E5 完成定义（DoD）**：
- [x] `geppetto new <project-name>` 可生成最小约定式项目结构；
- [x] 模板源与 `init` 共用或明确复用，不引入第二套 canonical 入口模板；
- [x] 生成结果具有快照/目录树回归测试；
- [x] 默认不做危险覆盖；
- [x] README / Phase 8 文档明确 `new` 的定位、约束与非目标；
- [x] E5 结果在 Phase 6/7/8 文档中可追溯。

---

## Phase 8 增量任务：E6 geppetto test / geppetto audit

> 基线：`1a1d429`
> 前提：E1~E5 已完成，`geppetto-cli` 已具备 `init` / `new`
> 目标：把分散的验证动作集中到最小命令门禁，降低开发者“要跑哪些命令”的心智负担。
> 状态：已完成（E6-01 ~ E6-04 已交付）

### E6 Sprint 1：最小统一验证命令（已完成）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E6-01 | **`geppetto test` 命令（最小）** — 统一执行 root crate 测试 + escrow 示例测试；缺失 SBF 时给出可执行提示并按需自动构建 | 3h | E5-06 | `geppetto test` 最小执行器 |
| E6-02 | **`geppetto audit` 命令（最小静态）** — 提供命令化静态检查入口（fmt/check，默认非强制 clippy） | 2h | E6-01 | `geppetto audit` 最小静态检查 |

### E6 Sprint 2：接线与发布（已完成）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E6-03 | **命令与文档接线** — README / `docs/04/06/07/08` 说明 `test` / `audit` 的用途与边界 | 2h | E6-02 | 工具链对外文档 |
| E6-04 | **发布门禁最小扩展** — 在 `npm run release:check` 中可选纳入 `geppetto test` 或 `audit` | 1h | E6-02 | 发布流程更新 |

### E6 关键路径

```
E6-01 → E6-02 → E6-03 → E6-04
```

**E6 总工时**：约 8h

**E6 完成定义（DoD）**：
- `geppetto test` 支持 root + example 测试的一致入口；
- escrow 示例测试前可处理 SBF 构建前置；
- `geppetto audit` 至少覆盖可复用的静态检查最小集合；
- CLI 命令的行为与文档口径对齐；
- E6 关键里程碑在 `docs/06/07/08` 与 README 中一致。

---

## Phase 8 增量任务：E7 生态协同与上游反馈

> 基线：`1a1d429`
> 前提：E1~E6 已完成，`geppetto-cli`、上游跟踪与测试门禁链路稳定可复用
> 目标：把 Geppetto 已验证的 `agent-first` 规则、模板/文档策略和 Rust + JS 触达路径，以最小可复制输出同步到外部生态。
> 状态：进行中（E7-04 外部发送窗口 hold，E7-05 就绪检查已补齐）

### E7 Sprint 1：生态输出对齐（进行中）

| ID | 任务 | 预估 | 依赖 | 产出 |
|----|------|------|------|------|
| E7-01 | **外部协同目标和边界定义** — 明确 E7 的首发对齐对象（Pinocchio / create-solana-dapp / agent 模式社区），限定当前不做直接提交，只做建议级别内容产出 | 1h | 无 | `docs/10-e7-01-external-alignment.md` |
| E7-02 | **提交行动清单** — 将外部建议转成 create-solana-dapp 单路径可执行提交计划（含提交文案、范围、发送决策） | 2h | E7-01 | `docs/11-e7-02-create-solana-dapp-action-plan.md` |
| E7-03 | **最小外部动作选型与里程碑绑定** — 先选 1 个最小外部输出路径（建议先锁定 create-solana-dapp 建议项或 Pinocchio 提交流程建议），确认谁先接，谁下轮跟进 | 2h | E7-02 | E7 最小执行计划 |
| E7-04 | **对外发送窗口确认（内部）** — 将 E7-03 选型与发送决策明确为外部沟通前置动作（discussion/PR 阶段约束、单路径复用）；当前为 Hold，等待窗口与对接人确认 | 1h | E7-03 | `docs/13-e7-04-send-window-checklist.md` |
| E7-05 | **发送就绪性检查命令** — 提供 `npm run e7:readiness` 用于脚本化读取发送清单状态、工作区洁净性和可发送门禁；`--json` 与 `--strict` 提供机器可读输出与 gate 语义 | 1h | E7-04 | `lib/e7-readiness-check.js`、`tests/cli/e7-readiness.test.js` |

### E7 关键路径

```
E7-01 → E7-02 → E7-03 → E7-04 → E7-05
```

**E7 总工时**：约 6h

**E7 完成定义（DoD）**：
- 外部输出对象、范围与不做事项明确；
- 至少形成 1 个可复用的对齐建议草案；
- E7-01 至 E7-03 已完成：外部对象、提交方式与单路径接入规则已锁定；
- E7-04 已形成对外沟通窗口确认与 discussion/PR 提交顺序约束（当前处于 Hold）；
- E7-05 已补齐发送前就绪性检查脚本与测试，可在窗口确认前进行内部状态自检；
- E7 当前进展在 `docs/08-evolution.md` 与 `README` 中保持一致。

---

## 关键路径

```
A-02 → A-03 → A-04 → A-06 → A-08 → A-12 → A-14 → A-19 → A-20 → A-01 → A-22
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

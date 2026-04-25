# Geppetto

> Make AI code agents instantly fluent in Solana/Pinocchio best practices.

Geppetto is an **agent-aware knowledge SDK** for Pinocchio program development. It bundles battle-tested knowledge, guard helpers, and coding conventions into a single Rust crate—version-locked, doc-comment driven, and designed for AI agents first.

---

## The Problem

AI code agents struggle with Solana/Pinocchio because:

- **Web search returns outdated info** (old Anchor APIs, deprecated patterns)
- **Training data lacks Pinocchio** (too new)
- **Generated code misses security checks** and common idioms
- **Client-side layouts drift from on-chain programs** (the #1 client bug)

Humans end up reviewing and fixing agent output line by line, canceling out the agent's value.

## What Geppetto Does

1. **Bundled Knowledge** — Knowledge lives as Rust doc comments inside the crate. `cargo doc` builds it, and the Rust doc/test workflow checks the executable examples while keeping longer reference snippets intentionally ignored. No "docs are stale but code is updated" problem.
2. **Enforced Conventions** — `AccountSchema` trait for account layouts, `guard::*` helpers for security checks, and a standard dispatch pattern. Not macro magic—just clear, explicit Pinocchio code that agents can read and follow.
3. **AGENTS.md Guide** — Tells agents: "Your training data is outdated. Read the doc comments in `geppetto` for the source of truth."

## Quick Start

### Add to an existing project

```bash
cargo add geppetto
```

Then tell your agent to:

- Import from `geppetto` instead of `pinocchio`
- Implement `AccountSchema` for every account type
- Use `guard::*` for all security checks
- Follow the standard dispatch pattern in `dispatch.rs`

### Start from an official template + Geppetto

Use Solana's official `create-solana-dapp` template, then add Geppetto on top:

```bash
# Create project from official Pinocchio template
npx create-solana-dapp -t pinocchio-counter

# Add Geppetto to the program
cd my-project/program && cargo add geppetto

# Generate AGENTS.md for your agent
npx geppetto-cli init
```

Want to preview the generated file set first?

```bash
npx geppetto-cli init --dry-run
```

Geppetto doesn't replace the official scaffold—it adds the knowledge layer that makes agents write correct, secure Pinocchio code.

### Start a new Pinocchio + Geppetto project

`geppetto-cli` also provides a minimal project generator:

```bash
npx geppetto-cli new my-program
```

`geppetto new` is a **convention starter**, not a full framework:

- generates a minimal program skeleton: `Cargo.toml`, `src/lib.rs`, `src/processor.rs`, `src/state.rs`, `src/error.rs`, `src/instructions/mod.rs`, `tests/svm.rs`
- generates current canonical agent-entry files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursor`, `.windsurf`, `.github`, `.amazonq`, `.aider.conf.yml`)
- preserves explicit, non-hidden templates using the same placeholder-based generation path as `init`
- uses non-destructive default semantics (no overwrite by default)

After generation, users are expected to customize the skeleton directly for their domain logic; the output is intentionally small and explicit.

### Additional CLI helpers

Run unified local checks:

```bash
# Validate both crates: root + escrow example tests
npx geppetto-cli test

# Minimal static audit gate (fmt + check, add --strict for clippy)
npx geppetto-cli audit --strict
```

`geppetto test` will auto-build `examples/escrow` SBF artifact if missing.  
Use `--skip-build-sbf` only when you intentionally only want core tests.

### CLI template/version contract

- `geppetto-cli init` copies the canonical agent entry files that live at this repository root (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursor`, `.windsurf`, `.github`, `.amazonq`, `.aider.conf.yml`).
- Template versioning is locked to the package release: `geppetto-cli@0.1.0` ships the same canonical template set and knowledge baseline as the `0.1.0` repository/package release. There is no separate template version track.
- Maintainers can run `npm run release:check` before publishing to verify `docs:check`（知识头/入口镜像/feature matrix）、CLI tests 与 `npm pack --dry-run --json` 包内容，一次性打通发布前检查链路。

## Core Modules

| Module          | What it covers                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `schema`        | `AccountSchema` trait & account layout patterns (unit struct + offset constants recommended)                                     |
| `guard`         | Security helpers: `assert_signer`, `assert_writable`, `assert_owner`, `assert_pda`, `assert_discriminator`, `assert_rent_exempt` |
| `dispatch`      | Standard instruction-dispatch pattern for `process_instruction`                                                                  |
| `idioms`        | Code + knowledge: PDA derivation, CPI calls, Token/Token-2022, self-CPI events, TLV extensions, program architecture           |
| `anti_patterns` | Security review checklist: high-impact vulnerabilities and how to fix them                                                       |
| `client`        | Doc-only: TypeScript client construction, PDA derivation, account deserialization                                                |
| `testing`       | Code + knowledge: litesvm / mollusk-svm testing patterns, assertion helpers                                                      |

## Design Principles

- **Zero runtime overhead** — Guards and schemas compile to hand-written Pinocchio code
- **Zero external dependencies** — Only depends on the Pinocchio ecosystem crates
- **Zero macros** — Explicit code agents can see, understand, and debug
- **Agent-first** — If the agent can't see it, it can't respect it

## Account Schema Best Practice

Implement `AccountSchema` using **unit struct + offset constants** (avoids alignment pitfalls):

```rust
pub struct Escrow;
impl AccountSchema for Escrow {
    const LEN: usize = 74;
    const DISCRIMINATOR: Option<u8> = Some(1);
    fn layout() -> &'static [(&'static str, &'static str, usize, usize)] { ... }
}
impl Escrow {
    pub const MAKER_OFFSET: usize = 2;
    pub const AMOUNT_OFFSET: usize = 66;
}
// Read data: let maker = data[Escrow::MAKER_OFFSET..]; etc.
```

See `src/schema.rs` for detailed patterns and why `#[repr(C)]` with mixed-alignment fields is risky.

## How We Differ

### vs `solana-dev-skill`

- `solana-dev-skill` = broad advice (markdown, shallow, Anchor-first)
- **Geppetto** = deep constraints (code + knowledge, Pinocchio-first)
- **Relationship: complementary**

### vs Quasar

- Quasar = framework optimizing **human DX** with macros
- **Geppetto** = knowledge SDK optimizing **agent DX** with explicit code
- **Relationship: different dimensions**

### Tagline

> "Quasar and Anchor make humans write code faster. Geppetto makes AI agents write code more reliably."

## Project Status

| Phase                        | 状态                             |
| ---------------------------- | ------------------------------ |
| Phase 0: Business Validation | ✅ 完成                           |
| Phase 1: PRD                 | ✅ 完成                           |
| Phase 2: Architecture        | ✅ 完成                           |
| Phase 3: Technical Spec      | ✅ 完成                           |
| Phase 4: Task Breakdown      | ✅ 完成                           |
| Phase 5: Test Spec           | ✅ 完成                           |
| Phase 6: Implementation      | ✅ 完成                           |
| Phase 7: Review & Deploy     | ✅ 完成                           |
| Phase 8: Evolution           | 进行中（E1~E7 已闭环；E7-04 Hold；E8-01~E8-03 已交付，发送仍 Hold） |
| E5: geppetto new scaffolding  | 已交付（E5-01 ~ E5-09 全部完成） |

**代码状态**：A-02 ~ A-23 已完成闭环；核心 crate、知识模块、agent 入口文件均已交付并通过 `cargo test --all-features`、`cargo clippy --all-features`、`cargo doc --no-deps` 与 `cargo fmt --check`。Phase 8 已完成 E1（CLI 模板单源、`--dry-run`、`release:check`）、E2（`npm run test:escrow-client-alignment` 打通 Rust fixture ↔ TypeScript 对齐示例）与 E3（知识头 + agent 入口镜像 + feature matrix，`release:check` 已串联 `docs:check`），并完成跨文档收口；E4（上游依赖追踪 + 差异检查 + 人工审查门禁）、E5（`geppetto new` 约定式脚手架）与 E6（`geppetto test` / `geppetto audit`）均已交付。E7 文档与里程碑已对齐：E7-01~E7-03 已完成，E7-04 决策为“先不对外发送，待窗口确认后执行 discussion / PR”。E8 已完成 `e7:delivery` 命令交付与 8 系列文档口径收口，外部发送仍保持 Hold。

最新发布摘要见 [`docs/09-release-notes.md`](./docs/09-release-notes.md)。
当前仓库总状态归档见 [`docs/13-current-status-summary.md`](./docs/13-current-status-summary.md)。

Hackathon delivery target: **2026-05-11**

## License

[MIT](./LICENSE) or [Apache-2.0](./LICENSE-APACHE)

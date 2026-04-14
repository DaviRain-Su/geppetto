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

Geppetto doesn't replace the official scaffold—it adds the knowledge layer that makes agents write correct, secure Pinocchio code.

## Core Modules

| Module          | What it covers                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `guard`         | Security helpers: `assert_signer`, `assert_writable`, `assert_owner`, `assert_pda`, `assert_discriminator`, `assert_rent_exempt` |
| `schema`        | `AccountSchema` trait — zero-copy account layouts with compile-time metadata                                                     |
| `dispatch`      | Standard instruction-dispatch pattern for `process_instruction`                                                                  |
| `idioms`        | Code + knowledge: PDA derivation, CPI calls, Token/Token-2022, self-CPI events, TLV extensions, helper functions                |
| `anti_patterns` | Doc-only: common vulnerabilities and how to fix them                                                                             |
| `client`        | Doc-only: TypeScript client construction, PDA derivation, account deserialization                                                |
| `testing`       | Code + knowledge: litesvm / mollusk-svm testing patterns, assertion helpers                                                      |

## Design Principles

- **Zero runtime overhead** — Guards and schemas compile to hand-written Pinocchio code
- **Zero external dependencies** — Only depends on the Pinocchio ecosystem crates
- **Zero macros** — Explicit code agents can see, understand, and debug
- **Agent-first** — If the agent can't see it, it can't respect it

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
| Phase 8: Evolution           | ✅ 完成（ADR、复杂度预算、演化路径已固化）             |

**代码状态**：A-02 ~ A-23 已完成闭环；核心 crate、知识模块、agent 入口文件均已交付并通过 `cargo test --all-features`、`cargo clippy --all-features`、`cargo doc --no-deps` 与 `cargo fmt --check`。子模块 B 已补上 `npx geppetto-cli init` 初版脚手架。

Hackathon delivery target: **2026-05-11**

## License

[MIT](./LICENSE) or [Apache-2.0](./LICENSE-APACHE)

#![no_std]

//! # Geppetto — Pinocchio Agent Harness
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! Agent-aware harness for Solana/Pinocchio development.
//! Provides knowledge (doc comments), constraints (guard, schema),
//! and patterns (dispatch, idioms) that make AI coding agents
//! produce correct, secure, idiomatic Pinocchio programs.
//!
//! Built on top of official [Anza-xyz/pinocchio](https://github.com/anza-xyz/pinocchio)
//! and Solana Foundation patterns. All types (`AccountView`, `Address`,
//! `ProgramError`) are direct re-exports from pinocchio 0.11.x — this
//! crate adds zero wrapping, only knowledge and constraints.
//!
//! ## Quick Start
//!
//! ```toml
//! [dependencies]
//! geppetto = { version = "0.1", features = ["system", "token-all"] }
//! ```
//!
//! ```rust,ignore
//! use geppetto::*;
//! use geppetto::guard;
//! use geppetto::token;
//! ```
//!
//! ## Module Overview
//!
//! | Module | Type | Purpose |
//! |--------|------|---------|
//! | `guard` | Code + Knowledge | Security check helpers |
//! | `schema` | Code + Knowledge | Account layout trait |
//! | `dispatch` | Code + Knowledge | Instruction routing |
//! | `error` | Code | Custom error codes |
//! | `idioms` | Code + Knowledge | Common pattern helpers |
//! | `anti_patterns` | Knowledge only | What NOT to do |
//! | `client` | Knowledge only | TypeScript client patterns |
//! | `testing` | Code + Knowledge | Test utilities (feature-gated) |
//!
//! ## Feature Flags
//!
//! | Feature | Enables |
//! |---------|---------|
//! | `system` | `geppetto::system` (pinocchio-system) |
//! | `token` | `geppetto::token` (pinocchio-token) |
//! | `token-2022` | `geppetto::token_2022` (pinocchio-token-2022) |
//! | `ata` | `geppetto::ata` (pinocchio-associated-token-account) |
//! | `memo` | `geppetto::memo` (pinocchio-memo) |
//! | `token-all` | Shorthand for `token` + `token-2022` + `ata` |
//! | `log` | `geppetto::log` (pinocchio-log — program logging) |
//! | `pubkey` | `geppetto::pubkey` (pinocchio-pubkey — pubkey utilities) |
//! | `full` | Shorthand for `system` + `token-all` + `memo` + `log` + `pubkey` |
//! | `test-utils` | `geppetto::testing` module |
//!
//! ## Upstream Dependency Map
//!
//! Geppetto's knowledge is version-locked to these upstream crates.
//! When upgrading, ALL knowledge modules must be re-verified.
//!
//! | Upstream | Pinned version | Geppetto modules affected |
//! |----------|---------------|--------------------------|
//! | `pinocchio` | 0.11.x | ALL modules (re-exported types) |
//! | `pinocchio-system` | 0.6.x | `idioms` (CPI examples), `guard` (SYSTEM_PROGRAM_ID) |
//! | `pinocchio-token` | 0.6.x | `idioms` (CPI examples), `guard` (TOKEN IDs) |
//! | `pinocchio-token-2022` | 0.3.x | `idioms` (Token-2022 dual support) |
//! | `pinocchio-associated-token-account` | 0.4.x | `guard` (ATA_PROGRAM_ID, assert_ata) |
//! | `pinocchio-log` | 0.5.x | `idioms` (logging patterns) |
//! | `pinocchio-pubkey` | 0.3.x | `idioms` (pubkey utilities) |
//! | `mollusk-svm` | 0.12.x | `testing` (API reference) |
//! | `litesvm` | 0.11.x | `testing` (API reference) |
//! | `codama` | latest | `client` (IDL generation — build-dependency, not runtime) |
//!
//! ## Upgrade Protocol
//!
//! When an upstream dependency releases a new version:
//!
//! 1. **Check the CHANGELOG** — look for breaking changes in types, method
//!    signatures, or behavior.
//! 2. **Bump `Cargo.toml`** — update the version pin.
//! 3. **`cargo check --all-features`** — compilation errors reveal API breaks.
//! 4. **`cargo test --all-features`** — test failures reveal behavior changes.
//! 5. **Update affected knowledge modules** — grep for the old version in doc
//!    comments, update examples, update the version header.
//! 6. **Update the version header** in every affected module:
//!    `> Knowledge version: geppetto X.Y.Z | pinocchio A.B.x | YYYY-MM-DD`
//! 7. **Bump geppetto version** — minor bump for compatible changes, major
//!    for breaking.
//!
//! If `cargo check` passes but behavior changed (e.g. a function now returns
//! `Option` instead of panicking), the knowledge module may be silently wrong.
//! Always read the upstream CHANGELOG, don't just rely on compilation.
//!
//! ### Upstream repos to watch
//!
//! - <https://github.com/anza-xyz/pinocchio> — core SDK + CPI helpers
//! - <https://github.com/anza-xyz/mollusk> — test harness
//! - <https://github.com/LiteSVM/litesvm> — transaction simulator

// ── Pinocchio 核心 re-export ──
pub use pinocchio::*;

// ── CPI helpers（feature-gated）──
#[cfg(feature = "system")]
pub use pinocchio_system as system;

#[cfg(feature = "token")]
pub use pinocchio_token as token;

#[cfg(feature = "token-2022")]
// Note: Cargo feature name is `token-2022` (hyphen, Cargo convention),
// but Rust module alias must use underscore: `token_2022`
pub use pinocchio_token_2022 as token_2022;

#[cfg(feature = "ata")]
pub use pinocchio_associated_token_account as ata;

#[cfg(feature = "memo")]
pub use pinocchio_memo as memo;

#[cfg(feature = "log")]
pub use pinocchio_log as log;

#[cfg(feature = "pubkey")]
pub use pinocchio_pubkey as pubkey;

// ── Geppetto 自有模块 ──
pub mod anti_patterns;
pub mod client;
pub mod dispatch;
pub mod error;
pub mod guard;
pub mod idioms;
pub mod schema;

#[cfg(feature = "test-utils")]
pub mod testing;

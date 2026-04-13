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
//! | `full` | Shorthand for `system` + `token-all` + `memo` |
//! | `test-utils` | `geppetto::testing` module |

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

// ── Geppetto 自有模块 ──
pub mod guard;
pub mod schema;
pub mod dispatch;
pub mod error;
pub mod idioms;
pub mod anti_patterns;
pub mod client;

#[cfg(feature = "test-utils")]
pub mod testing;

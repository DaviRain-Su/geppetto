//! # Idioms
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-14
//! > **Verified against**: Solana 2.2.x
//!
//! Canonical patterns and helpers for Pinocchio programs.
//! Extracted from official Anza programs (escrow, rewards, token, memo).
//!
//! ## Submodules
//!
//! | Module | What you'll learn |
//! |--------|-------------------|
//! | [`entrypoint`] | Which entrypoint macro to use, Cargo.toml template |
//! | [`accounts`] | Account slice destructuring, TryFrom pattern, data parsing |
//! | [`pda`] | `derive_program_address` API, PdaSeeds/PdaAccount traits |
//! | [`cpi`] | CPI styles, concrete Transfer/CreateAccount examples, Token-2022 |
//! | [`events`] | Self-CPI event emission, program logging |
//! | [`architecture`] | Official program file structure, production conventions |
//!
//! ## Helper Functions
//!
//! This module also exports safe-by-default helper functions:
//! - [`close_account`] — drain lamports + zero data
//! - [`read_u64_le`] / [`write_u64_le`] — bounds-checked integer access
//! - [`read_address`] — bounds-checked 32-byte Address extraction

pub mod accounts;
pub mod architecture;
pub mod cpi;
pub mod entrypoint;
pub mod events;
pub mod pda;

mod helpers;
pub use helpers::*;

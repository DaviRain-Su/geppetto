//! # Official Pinocchio Program Architecture
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-14
//!
//! Patterns shared by official Anza pinocchio programs (escrow, rewards, token).
//! Scalable for small to large programs — recommendations shift by codebase size.
//!
//! ## Program Size Tiers
//!
//! | Tier | Characteristics | Structure |
//! |------|-----------------|-----------|
//! | **Tiny** | 1–2 instructions, ~100 lines | Single `src/lib.rs` or minimal modules |
//! | **Small** | 3–5 instructions, validation clear | Separate `entrypoint.rs`, `state.rs`, `errors.rs`; instructions in one module |
//! | **Medium** | 6+ instructions, complex validation | `instructions/{create,exchange,close}/` with dedicated `accounts.rs` per instruction |
//! | **Large** | Multiple feature gates, CPI, tokens | Full separation: `instructions/{*}/{mod,accounts,data,processor}.rs` + `state/`, `traits/`, `utils/` |
//!
//! **Key rule**: Validation (`accounts.rs`) and business logic (`processor.rs`) are **always** separate.
//!
//! ## File Structure Convention
//!
//! ```text
//! program/src/
//! ├── lib.rs                      ← entrypoint, module declarations
//! ├── entrypoint.rs               ← process_instruction → processor::dispatch
//! ├── errors.rs                   ← custom error enum → ProgramError::Custom
//! ├── instructions/
//! │   ├── definition.rs           ← instruction enum (Codama-annotated)
//! │   ├── mod.rs                  ← pub mod per instruction
//! │   └── create/                 ← one directory per instruction
//! │       ├── mod.rs              ← re-exports
//! │       ├── accounts.rs         ← TryFrom<&mut [AccountView]> with all guard checks
//! │       ├── data.rs             ← TryFrom<&[u8]> for instruction payload
//! │       └── processor.rs        ← business logic only (no validation here)
//! ├── state/
//! │   ├── mod.rs
//! │   └── escrow.rs               ← account struct + AccountSchema-like layout
//! ├── traits/                     ← reusable abstractions
//! │   ├── account.rs              ← account validation helpers
//! │   ├── pda.rs                  ← PdaSeeds / PdaAccount traits
//! │   └── instruction.rs          ← InstructionAccounts / InstructionData traits
//! └── utils/
//!     ├── macros.rs               ← require_len!, validate_discriminator!, etc.
//!     ├── pda_utils.rs
//!     └── token_utils.rs
//! ```
//!
//! **Key principle**: validation in `accounts.rs`, business logic in `processor.rs`.
//!
//! ## Utility Macros (escrow + rewards)
//!
//! ```rust,ignore
//! // require_len! — check account count
//! macro_rules! require_len {
//!     ($accounts:expr, $expected:expr) => {
//!         if $accounts.len() < $expected {
//!             return Err(ProgramError::NotEnoughAccountKeys);
//!         }
//!     };
//! }
//!
//! // validate_discriminator! — check first byte
//! macro_rules! validate_discriminator {
//!     ($data:expr, $expected:expr) => {
//!         if $data.is_empty() || $data[0] != $expected {
//!             return Err(ProgramError::InvalidAccountData);
//!         }
//!     };
//! }
//! ```
//!
//! Geppetto provides these as functions (`guard::assert_account_count`,
//! `guard::assert_discriminator`) instead of macros.
//!
//! ## Token-2022 Extension Support (escrow pattern)
//!
//! TLV (Type-Length-Value) format for extension storage:
//! - 1 byte: extension type discriminator
//! - 2 bytes: data length (LE)
//! - N bytes: extension data
//!
//! ## Codama (Client Generation)
//!
//! Official tool for generating TypeScript/Rust clients from Rust source.
//! See `geppetto::client` for the complete Codama guide.
//!
//! Key attributes:
//! - `#[derive(CodamaInstructions)]` on instruction enums
//! - `#[codama(...)]` on account structs
//!
//! ## Summary: What Makes a Production Pinocchio Program
//!
//! | Aspect | Convention |
//! |--------|-----------|
//! | Entrypoint | `program_entrypoint!` + `nostd_panic_handler!` |
//! | Dispatch | `split_first()` on instruction data, match on tag |
//! | Accounts | `TryFrom<&mut [AccountView]>` in dedicated `accounts.rs` |
//! | Data | `TryFrom<&[u8]>` in dedicated `data.rs` |
//! | Validation | ALL in `accounts.rs`, NONE in `processor.rs` |
//! | State | Unit struct + offset constants OR `#[repr(C)]` + explicit padding |
//! | Errors | `#[repr(u32)]` enum → `ProgramError::Custom` |
//! | PDAs | Seeds defined via trait, validated in accounts.rs |
//! | Events | Self-CPI with discriminator 228 + event authority PDA |
//! | Clients | Codama `#[derive(CodamaInstructions)]` for auto-generation |
//! | Testing | mollusk-svm for instruction tests, litesvm for e2e |
//! | Logging | `geppetto::log`, often additionally gated behind a project-specific cfg |

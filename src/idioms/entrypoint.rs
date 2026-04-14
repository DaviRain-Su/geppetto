//! # Entrypoint Selection
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-14
//!
//! CRITICAL — get this wrong and `cargo build-sbf` fails.
//!
//! ## Three entrypoint macros
//!
//! | Macro | What it sets up | When to use |
//! |-------|-----------------|-------------|
//! | `entrypoint!` | `program_entrypoint!` + `default_allocator!` + `default_panic_handler!` | Programs that need heap allocation (`Vec`, `String`, etc.) |
//! | `program_entrypoint!` | Just the entrypoint function | `#![no_std]` programs — you MUST also add allocator + panic handler manually |
//! | `lazy_program_entrypoint!` | Lazy entrypoint with `InstructionContext` | High-performance; accounts parsed on demand |
//!
//! ## WARNING: `entrypoint!` vs `program_entrypoint!` + `nostd_panic_handler!`
//!
//! `entrypoint!` calls `default_panic_handler!` which provides a `custom_panic`
//! hook — but this is NOT a `#[panic_handler]`. On some toolchain configurations,
//! `cargo build-sbf` will fail with:
//!
//! ```text
//! error: `#[panic_handler]` function required, but not found
//! ```
//!
//! **Fix**: Use `program_entrypoint!` + `default_allocator!` + `nostd_panic_handler!`
//! instead. `nostd_panic_handler!` provides the actual `#[panic_handler]` attribute.
//!
//! ## Recommended template (works reliably with `cargo build-sbf`)
//!
//! ```rust,ignore
//! #![no_std]
//!
//! geppetto::program_entrypoint!(process_instruction);
//! geppetto::default_allocator!();
//! geppetto::nostd_panic_handler!();
//!
//! pub fn process_instruction(
//!     program_id: &geppetto::address::Address,
//!     accounts: &mut [geppetto::account::AccountView],
//!     data: &[u8],
//! ) -> geppetto::ProgramResult {
//!     // dispatch here
//!     Ok(())
//! }
//! ```
//!
//! ## Zero-allocation template (no heap at all)
//!
//! ```rust,ignore
//! #![no_std]
//!
//! geppetto::program_entrypoint!(process_instruction);
//! geppetto::no_allocator!();        // panics on any heap allocation
//! geppetto::nostd_panic_handler!();
//! ```
//!
//! ## Build command
//!
//! ```bash
//! cargo build-sbf --manifest-path program/Cargo.toml
//! # Output: program/target/deploy/your_program.so
//! ```
//!
//! ## Downstream Cargo.toml template
//!
//! ```toml
//! [package]
//! name = "my-program"
//! version = "0.1.0"
//! edition = "2024"
//!
//! [dependencies]
//! geppetto = { version = "0.1", features = ["system", "token-all"] }
//!
//! [dev-dependencies]
//! pinocchio = "0.11"
//! solana-address = { version = "2", features = ["curve25519"] }
//! mollusk-svm = "0.12"
//! solana-account = "3"
//! solana-instruction = "3"
//! solana-pubkey = "4"
//! solana-program-error = "3"
//!
//! [lib]
//! crate-type = ["cdylib", "lib"]
//! # "cdylib" = produces the .so for on-chain deployment
//! # "lib" = allows cargo test to import the crate
//! # BOTH are required.
//! ```

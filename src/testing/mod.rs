//! # Testing Utilities
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-14
//! > **Verified against**: Solana 2.2.x, mollusk-svm 0.12, litesvm 0.11
//!
//! Enable with: `geppetto = { features = ["test-utils"] }`
//!
//! ## Submodules
//!
//! | Module | What you'll learn |
//! |--------|-------------------|
//! | [`mollusk`] | mollusk-svm 0.12 complete guide + API reference |
//! | [`litesvm`] | litesvm 0.11 complete guide |
//!
//! ## Testing Strategy
//!
//! Use a three-tier approach:
//!
//! 1. **Unit tests** — mock `AccountView` for pure helpers (`guard`, `idioms`).
//! 2. **mollusk-svm tests** — run compiled SBF against real Solana runtime.
//! 3. **litesvm tests** — full transaction simulation with stateful accounts.
//!
//! ## mollusk-svm vs litesvm
//!
//! | Framework | Best for | Speed | State |
//! |-----------|----------|-------|-------|
//! | mollusk-svm 0.12 | Single instruction, CU profiling | Very fast | Stateless per call |
//! | litesvm 0.11 | Multi-instruction flows, CPI chains | Fast | Stateful (accounts persist) |
//!
//! Official programs (memo, escrow, rewards) use mollusk-svm or litesvm.
//! Do **not** use `solana-program-test` — it is outdated for Pinocchio programs.
//!
//! ## CU Profiling
//!
//! Typical CU ranges for Pinocchio programs:
//! - Simple state updates (no CPI): ~500-2000 CU
//! - Token CPI (transfer/mint): ~5000-15000 CU
//! - Complex multi-CPI flows: ~15000-50000 CU
//!
//! ## Common Pitfalls
//!
//! 1. **Forgetting `cargo build-sbf`** — both frameworks need the compiled `.so`.
//! 2. **Account order mismatch** — `AccountMeta` order must match `(Pubkey, Account)` order.
//! 3. **Using `solana-program-test`** — doesn't support Pinocchio's `AccountView`.
//! 4. **PDA derivation** — use `solana_pubkey::Pubkey::find_program_address` in tests.
//! 5. **Program accounts auto-stubbed** — mollusk provides them, don't include in accounts.
//!
//! ## Helper Functions
//!
//! - [`assert_account_data`] — check bytes at offset
//! - [`assert_discriminator`] — check first byte
//! - [`assert_u64_le`] — check u64 LE value at offset

pub mod litesvm;
pub mod mollusk;

mod helpers;
pub use helpers::*;

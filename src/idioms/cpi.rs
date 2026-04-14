//! # CPI Patterns
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-14
//!
//! ## Two CPI Styles
//!
//! 1. **Simple style** — stack-allocate `InstructionAccount` array and call
//!    `invoke_signed()`. Best for system, ATA, and memo CPIs.
//! 2. **Optimized style** — use `MaybeUninit` + `CpiWriter` trait +
//!    `invoke_signed_unchecked()`. Used by `pinocchio-token` internally.
//!
//! **Rule of thumb**: for system/ATA/memo CPIs, use the simple style. For token
//! CPIs, use the typed `.invoke()` methods provided by `pinocchio-token` and
//! `pinocchio-token-2022`.
//!
//! ## Concrete CPI Examples
//!
//! **System: Transfer SOL** (requires `features = ["system"]`)
//!
//! ```rust,ignore
//! use geppetto::system::Transfer;
//!
//! Transfer {
//!     from: maker,       // &AccountView, must be signer + writable
//!     to: recipient,     // &AccountView, must be writable
//!     lamports: 1_000_000,
//! }.invoke()?;
//!
//! // With PDA signer:
//! Transfer { from: pda_account, to: recipient, lamports: 1_000_000 }
//!     .invoke_signed(&[&[b"seed", &[bump]]])?;
//! ```
//!
//! **Token: Transfer SPL tokens** (requires `features = ["token"]`)
//!
//! ```rust,ignore
//! use geppetto::token::Transfer;
//!
//! Transfer {
//!     from: source_ata,     // &AccountView
//!     to: dest_ata,         // &AccountView
//!     authority: owner,     // &AccountView, must be signer
//!     amount: 1_000_000,
//! }.invoke()?;
//! ```
//!
//! **System: Create Account** (requires `features = ["system"]`)
//!
//! ```rust,ignore
//! use geppetto::system::CreateAccount;
//!
//! // Manual lamports:
//! CreateAccount {
//!     from: payer,
//!     to: new_account,
//!     lamports: rent_lamports,
//!     space: MyAccount::LEN as u64,
//!     owner: program_id,
//! }.invoke()?;
//!
//! // Auto-calculate rent-exempt minimum (preferred):
//! CreateAccount::with_minimum_balance(
//!     payer,
//!     new_account,
//!     MyAccount::LEN as u64,
//!     program_id,
//!     None,  // None = use Rent::get() sysvar cache (no account needed)
//! )?.invoke()?;
//! ```
//!
//! `with_minimum_balance` auto-computes the minimum lamports for rent exemption.
//! Pass `None` for the rent sysvar to use the cached value (preferred).
//! Pass `Some(rent_sysvar_account)` only if you already have the sysvar account.
//!
//! ---
//!
//! ## Token-2022 Dual Support
//!
//! ### Key API difference: explicit `token_program` field
//!
//! `geppetto::token` (re-export of `pinocchio-token`) hardcodes the SPL Token
//! program ID internally for many shared instructions.
//! `geppetto::token_2022` (re-export of `pinocchio-token-2022`) exposes an
//! explicit `token_program: &Address` field, so the same instruction struct can
//! target either Token or Token-2022.
//!
//! ```rust,ignore
//! // geppetto::token (SPL Token only — token program is implicit):
//! geppetto::token::Transfer {
//!     from,
//!     to,
//!     authority,
//!     amount: 1_000,
//!     multisig_signers: &[],
//! }.invoke()?;
//!
//! // geppetto::token_2022 (caller chooses Token OR Token-2022 explicitly):
//! geppetto::token_2022::Transfer {
//!     from,
//!     to,
//!     authority,
//!     amount: 1_000,
//!     token_program: token_program.address(),
//! }.invoke()?;
//! ```
//!
//! ### Recommended pattern for dual support
//!
//! ```rust,ignore
//! geppetto::guard::assert_token_program(token_program)?;
//!
//! // For shared instructions, geppetto::token_2022 can often serve as a
//! // unified interface because the target token program is explicit.
//! geppetto::token_2022::Transfer {
//!     from: source_ata,
//!     to: dest_ata,
//!     authority: owner,
//!     amount: 1_000_000,
//!     token_program: token_program.address(),
//! }.invoke()?;
//! ```
//!
//! This removes the Token vs Token-2022 branch for many common instructions.
//! Keep explicit branching when you need SPL-only features (for example batch
//! CPI) or crate-specific APIs that are not shared.
//!
//! ---
//!
//! ## Batch CPI
//!
//! SPL Token reserves discriminator `255` for batching multiple token
//! instructions into a single CPI call. This reduces CPI overhead.
//! Use `geppetto::dispatch::BATCH_DISCRIMINATOR`.
//!
//! **Note**: Batch CPI is only supported by the original SPL Token program,
//! not Token-2022.

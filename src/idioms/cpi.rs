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
//! `pinocchio-token` structs hardcode the SPL Token program ID internally.
//! `pinocchio-token-2022` structs have an explicit `token_program: &Address`
//! field, so the SAME struct can invoke either Token or Token-2022.
//!
//! ```rust,ignore
//! // pinocchio-token (SPL Token only — token_program hardcoded):
//! pinocchio_token::Transfer {
//!     from, to, authority,
//!     amount: 1_000,
//!     multisig_signers: &[],
//! }.invoke()?;
//!
//! // pinocchio-token-2022 (EITHER program — you choose):
//! pinocchio_token_2022::Transfer {
//!     from, to, authority,
//!     amount: 1_000,
//!     token_program: token_program.address(),  // Token OR Token-2022
//! }.invoke()?;
//! ```
//!
//! ### Recommended pattern for dual support
//!
//! ```rust,ignore
//! guard::assert_token_program(token_program)?;
//!
//! // Use pinocchio-token-2022 structs for all token CPIs —
//! // they work with BOTH programs via the explicit token_program field.
//! pinocchio_token_2022::Transfer {
//!     from: source_ata,
//!     to: dest_ata,
//!     authority: owner,
//!     amount: 1_000_000,
//!     token_program: token_program.address(),
//! }.invoke()?;
//! ```
//!
//! This eliminates the if/else branch. Use `pinocchio-token-2022` structs
//! as the universal CPI interface for token operations.
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

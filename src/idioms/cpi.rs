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
//! CreateAccount {
//!     from: payer,          // &AccountView, signer + writable
//!     to: new_account,      // &AccountView, signer + writable
//!     lamports: rent_lamports,
//!     space: MyAccount::LEN as u64,
//!     owner: program_id,    // &Address
//! }.invoke()?;
//! ```
//!
//! ## Token-2022 Dual Support
//!
//! Modern Solana programs should accept both Token and Token-2022. Use
//! `guard::assert_token_program()` to validate the passed token program, then
//! branch CPI calls based on the actual address.
//!
//! ```rust,ignore
//! guard::assert_token_program(token_program)?;
//! if token_program.address() == &geppetto::token::ID {
//!     // use pinocchio_token CPI
//! } else if token_program.address() == &geppetto::token_2022::ID {
//!     // use pinocchio_token_2022 CPI
//! }
//! ```
//!
//! ## Batch CPI
//!
//! SPL Token reserves discriminator `255` for batching multiple token
//! instructions into a single CPI call. This reduces CPI overhead.
//! Use `geppetto::dispatch::BATCH_DISCRIMINATOR`.
//!
//! **Note**: Batch CPI is only supported by the original SPL Token program,
//! not Token-2022.

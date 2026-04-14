//! # Idioms
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! Canonical low-level helpers and patterns for Pinocchio programs.
//! Extracted from official Anza programs (escrow, rewards, token, memo).
//!
//! ## Why this module
//!
//! These helpers encode common safe-by-default patterns:
//!
//! - Close accounts by moving lamports and clearing data
//! - Fixed-width integer access with explicit bounds checks
//! - Fixed-width `Address` extraction
//!
//! The goal is twofold:
//!
//! - Reduce accidental UB or panics under edge inputs.
//! - Keep instruction handlers linear and consistent.
//!
//! ## Knowledge Topics
//!
//! ---
//!
//! ### Entrypoint Selection (CRITICAL — get this wrong and SBF build fails)
//!
//! Pinocchio provides three entrypoint macros:
//!
//! | Macro | What it sets up | When to use |
//! |-------|-----------------|-------------|
//! | `entrypoint!` | `program_entrypoint!` + `default_allocator!` + `default_panic_handler!` | Programs that need heap allocation (`Vec`, `String`, etc.) |
//! | `program_entrypoint!` | Just the entrypoint function | `#![no_std]` programs — you MUST also add allocator + panic handler manually |
//! | `lazy_program_entrypoint!` | Lazy entrypoint with `InstructionContext` | High-performance; accounts parsed on demand |
//!
//! #### WARNING: `entrypoint!` vs `program_entrypoint!` + `nostd_panic_handler!`
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
//! #### Recommended template (works reliably with `cargo build-sbf`)
//!
//! ```rust,ignore
//! #![no_std]
//!
//! // Via geppetto re-export (recommended):
//! geppetto::program_entrypoint!(process_instruction);
//! geppetto::default_allocator!();
//! geppetto::nostd_panic_handler!();
//!
//! // Or via pinocchio directly:
//! // pinocchio::program_entrypoint!(process_instruction);
//! // pinocchio::default_allocator!();
//! // pinocchio::nostd_panic_handler!();
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
//! #### Zero-allocation template (no heap at all)
//!
//! ```rust,ignore
//! #![no_std]
//!
//! geppetto::program_entrypoint!(process_instruction);
//! geppetto::no_allocator!();        // panics on any heap allocation
//! geppetto::nostd_panic_handler!();
//! ```
//!
//! #### Build command
//!
//! ```bash
//! cargo build-sbf --manifest-path program/Cargo.toml
//! # Output: program/target/deploy/your_program.so
//! ```
//!
//! #### Downstream Cargo.toml template
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
//! # BOTH are required. Without "cdylib", cargo build-sbf produces nothing.
//! # Without "lib", tests can't import your program's modules.
//! ```
//!
//! ---
//!
//! ### PDA Derivation: `derive_program_address` (NOT `find_program_address`)
//!
//! **Pinocchio uses `Address::derive_program_address`, not `find_program_address`.**
//!
//! This is a const-generic API — it takes `&[&[u8]; N]` (fixed-size array),
//! NOT `&[&[u8]]` (slice). You must know the number of seeds at compile time.
//!
//! ```rust,ignore
//! use geppetto::address::Address;
//!
//! // ✅ Correct: fixed-size array
//! let (pda, bump) = Address::derive_program_address(
//!     &[b"escrow", maker.as_ref()],  // [&[u8]; 2]
//!     program_id,
//! ).ok_or(ProgramError::InvalidSeeds)?;
//!
//! // ❌ Wrong: this does NOT compile
//! // let seeds: &[&[u8]] = &[b"escrow", maker.as_ref()];
//! // Address::derive_program_address(seeds, program_id);
//! // Error: expected `&[&[u8]; N]`, found `&[&[u8]]`
//! ```
//!
//! Returns `Option<(Address, u8)>` — `None` if no valid bump found.
//!
//! If you need dynamic seed count (runtime-determined), use
//! `geppetto::guard::assert_pda()` which handles 0-15 seeds internally
//! via a match over all array sizes.
//!
//! **In tests**: use `solana_pubkey::Pubkey::find_program_address` instead,
//! which accepts `&[&[u8]]` slices. See `geppetto::testing` for details.
//!
//! ---
//!
//! ### Account Slice Destructuring
//!
//! Every official Pinocchio program uses pattern matching on the accounts slice.
//! This is safer than index-based access and gives clear error messages when
//! the wrong number of accounts is passed.
//!
//! ```rust,ignore
//! // ✅ Correct: destructuring with guard checks
//! let [maker, escrow, system_program, remaining @ ..] = accounts else {
//!     return Err(ProgramError::NotEnoughAccountKeys);
//! };
//! guard::assert_signer(maker)?;
//! guard::assert_writable(escrow)?;
//! guard::assert_system_program(system_program)?;
//! ```
//!
//! **Common mistake**: using `accounts[0]`, `accounts[1]` directly. This panics
//! on too-short slices instead of returning a clean program error.
//!
//! ---
//!
//! ### TryFrom Accounts Pattern
//!
//! For complex instructions, extract accounts into a typed struct with a
//! `TryFrom<&mut [AccountView]>` implementation. This keeps the processor
//! focused on business logic.
//!
//! ```rust,ignore
//! // instructions/create/accounts.rs
//! pub struct CreateAccounts<'a> {
//!     pub maker: &'a mut AccountView,
//!     pub escrow: &'a mut AccountView,
//!     pub system_program: &'a AccountView,
//! }
//!
//! impl<'a> TryFrom<&'a mut [AccountView]> for CreateAccounts<'a> {
//!     type Error = ProgramError;
//!     fn try_from(accounts: &'a mut [AccountView]) -> Result<Self, Self::Error> {
//!         let [maker, escrow, system_program, ..] = accounts else {
//!             return Err(ProgramError::NotEnoughAccountKeys);
//!         };
//!         guard::assert_signer(maker)?;
//!         guard::assert_writable(maker)?;
//!         guard::assert_writable(escrow)?;
//!         guard::assert_system_program(system_program)?;
//!         Ok(Self { maker, escrow, system_program })
//!     }
//! }
//! ```
//!
//! ---
//!
//! ### CPI Styles
//!
//! Pinocchio supports two CPI styles:
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
//! #### Concrete CPI examples
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
//! ---
//!
//! ### Program Logging (requires `features = ["log"]`)
//!
//! Use `pinocchio-log` for on-chain logging. Do NOT use `std::println!`.
//!
//! ```rust,ignore
//! use geppetto::log::sol_log;
//!
//! sol_log("Processing create instruction");
//! ```
//!
//! **Performance tip**: gate logging behind a feature flag in production:
//!
//! ```rust,ignore
//! #[cfg(feature = "logging")]
//! geppetto::log::sol_log("debug info");
//! ```
//!
//! The `pinocchio-log` crate provides `sol_log` (raw string) and
//! `pinocchio-log-macro` provides `msg!`-style formatting macros.
//!
//! ---
//!
//! ### Self-CPI Events
//!
//! Programs can emit structured events by CPI-ing to themselves. This is the
//! pattern used by `escrow` and `rewards`.
//!
//! ```rust,ignore
//! use geppetto::dispatch::SELF_CPI_EVENT_DISCRIMINATOR;
//!
//! // Event authority PDA is the signer for the self-CPI
//! let event_authority_seeds = &[b"event_authority"];
//! let (event_authority, bump) = Address::derive_program_address(
//!     event_authority_seeds,
//!     program_id,
//! ).unwrap();
//!
//! // Build instruction data: [228, event_payload...]
//! let mut data = [SELF_CPI_EVENT_DISCRIMINATOR];
//! // ... append payload ...
//! ```
//!
//! ---
//!
//! ### Token-2022 Dual Support
//!
//! Modern Solana programs should accept both Token and Token-2022. Use
//! `guard::assert_token_program()` to validate the passed token program, then
//! branch CPI calls to `pinocchio_token` or `pinocchio_token_2022` based on
//! the actual address.
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
//! ---
//!
//! ### Batch CPI
//!
//! SPL Token reserves discriminator `255` for batching multiple token
//! instructions into a single CPI call. This reduces CPI overhead.
//!
//! ```rust,ignore
//! use geppetto::dispatch::BATCH_DISCRIMINATOR;
//!
//! // Instruction data starts with 255, followed by multiple sub-instructions
//! let data = [BATCH_DISCRIMINATOR, /* sub-instruction 1 */, /* sub-instruction 2 */];
//! ```
//!
//! **Note**: Batch CPI is only supported by the original SPL Token program, not
//! Token-2022.
//!
//! ---
//!
//! ### Codama (Client Generation)
//!
//! Codama is the official Solana tool for generating TypeScript/Rust clients
//! from Rust source code. `escrow` and `rewards` both use it.
//!
//! Key attributes:
//! - `#[derive(CodamaInstructions)]` on instruction enums
//! - `#[codama(...)]` on account structs to define names and signs
//!
//! This complements `client.rs`: Codama generates the skeleton, while
//! `client.rs` guides manual tuning.
//!
//! ---
//!
//! ### Testing with LiteSVM / Mollusk-SVM
//!
//! Official Pinocchio programs do **not** use `solana-program-test` (it is
//! considered legacy). Instead, they use:
//!
//! - **mollusk-svm** — fast, fixture-driven SVM tests
//! - **litesvm** — lightweight Solana VM for end-to-end tests
//!
//! Use mollusk for pure instruction logic. Use litesvm when you need full
//! transaction simulation or client alignment tests.
//!
//! ---
use pinocchio::ProgramResult;
use pinocchio::account::AccountView;
use pinocchio::address::Address;
use pinocchio::error::ProgramError;

/// Close an account safely: zero all data, drain lamports to recipient.
///
/// # Why this matters
///
/// Closing an account without draining and zeroing leaves dangling data and
/// ambiguous ownership. This helper enforces the same close sequence that is
/// used in official programs.
///
/// # Errors
///
/// Returns [`ProgramError::ArithmeticOverflow`] if `recipient.lamports() + lamports`
/// would overflow `u64`.
/// Propagates borrow errors from `try_borrow_mut` if the account is not mutable.
pub fn close_account(account: &mut AccountView, recipient: &mut AccountView) -> ProgramResult {
    let lamports = account.lamports();
    let new_recipient_lamports = recipient
        .lamports()
        .checked_add(lamports)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    recipient.set_lamports(new_recipient_lamports);
    account.set_lamports(0);

    let mut data = account.try_borrow_mut()?;
    data.fill(0);

    Ok(())
}

/// Read a little-endian u64 from a byte slice at the given offset.
///
/// # Why this matters
///
/// Direct slicing like `data[offset..offset + 8]` can panic on overflow or bounds.
/// This helper uses checked arithmetic so invalid offsets fail with explicit
/// program errors.
///
/// # Errors
///
/// Returns [`ProgramError::AccountDataTooSmall`] when `offset + 8` overflows or
/// the slice is too short.
#[inline]
pub fn read_u64_le(data: &[u8], offset: usize) -> Result<u64, ProgramError> {
    let end = offset
        .checked_add(8)
        .ok_or(ProgramError::AccountDataTooSmall)?;
    if end > data.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    let bytes: [u8; 8] = data[offset..end]
        .try_into()
        .map_err(|_| ProgramError::AccountDataTooSmall)?;
    Ok(u64::from_le_bytes(bytes))
}

/// Write a little-endian u64 to a mutable byte slice at the given offset.
///
/// # Why this matters
///
/// Manual offset math is a frequent source of runtime panics in instruction handlers.
/// This function centralizes safe offset handling for mutable writes.
///
/// # Errors
///
/// Returns [`ProgramError::AccountDataTooSmall`] when `offset + 8` overflows or
/// the slice is too short.
#[inline]
pub fn write_u64_le(data: &mut [u8], offset: usize, value: u64) -> Result<(), ProgramError> {
    let end = offset
        .checked_add(8)
        .ok_or(ProgramError::AccountDataTooSmall)?;
    if end > data.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    data[offset..end].copy_from_slice(&value.to_le_bytes());
    Ok(())
}

/// Read a 32-byte Address from a byte slice at the given offset.
///
/// # Why this matters
///
/// Program interfaces and account layouts commonly place addresses at fixed offsets.
/// `Address::new_from_array` expects exactly 32 bytes; slicing without checks can
/// panic or parse partial data.
///
/// # Errors
///
/// Returns [`ProgramError::AccountDataTooSmall`] when `offset + 32` overflows or
/// the slice is too short.
#[inline]
pub fn read_address(data: &[u8], offset: usize) -> Result<Address, ProgramError> {
    let end = offset
        .checked_add(32)
        .ok_or(ProgramError::AccountDataTooSmall)?;
    if end > data.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    let bytes: [u8; 32] = data[offset..end]
        .try_into()
        .map_err(|_| ProgramError::AccountDataTooSmall)?;
    Ok(Address::new_from_array(bytes))
}

#[cfg(test)]
mod tests {
    extern crate alloc;

    use super::*;
    use pinocchio::account::{AccountView, RuntimeAccount};
    use pinocchio::address::Address;

    fn mock_account_view(
        key: [u8; 32],
        owner: [u8; 32],
        lamports: u64,
        data: &mut [u8],
    ) -> AccountView {
        unsafe {
            let total_size = core::mem::size_of::<RuntimeAccount>() + data.len();
            let layout = core::alloc::Layout::from_size_align(total_size, 8).unwrap();
            let ptr = alloc::alloc::alloc(layout);
            assert!(!ptr.is_null());

            let raw = ptr as *mut RuntimeAccount;
            (*raw).borrow_state = pinocchio::account::NOT_BORROWED;
            (*raw).is_signer = 0;
            (*raw).is_writable = 1;
            (*raw).executable = 0;
            (*raw).padding = [0; 4];
            (*raw).address = Address::new_from_array(key);
            (*raw).owner = Address::new_from_array(owner);
            (*raw).lamports = lamports;
            (*raw).data_len = data.len() as u64;

            if !data.is_empty() {
                let data_ptr = ptr.add(core::mem::size_of::<RuntimeAccount>());
                core::ptr::copy_nonoverlapping(data.as_ptr(), data_ptr, data.len());
            }

            AccountView::new_unchecked(raw)
        }
    }

    #[test]
    fn test_idioms_close_account_happy() {
        let mut account_data = [1u8; 10];
        let mut recipient_data = [];
        let mut account = mock_account_view([0u8; 32], [0u8; 32], 1000, &mut account_data);
        let mut recipient = mock_account_view([1u8; 32], [0u8; 32], 500, &mut recipient_data);

        close_account(&mut account, &mut recipient).unwrap();

        assert_eq!(account.lamports(), 0);
        assert_eq!(recipient.lamports(), 1500);
        unsafe {
            assert!(account.borrow_unchecked().iter().all(|&b| b == 0));
        }
    }

    #[test]
    fn test_idioms_close_account_boundary_zero_lamports() {
        let mut account_data = [1u8; 5];
        let mut recipient_data = [];
        let mut account = mock_account_view([0u8; 32], [0u8; 32], 0, &mut account_data);
        let mut recipient = mock_account_view([1u8; 32], [0u8; 32], 100, &mut recipient_data);

        close_account(&mut account, &mut recipient).unwrap();

        assert_eq!(account.lamports(), 0);
        assert_eq!(recipient.lamports(), 100);
        unsafe {
            assert!(account.borrow_unchecked().iter().all(|&b| b == 0));
        }
    }

    #[test]
    fn test_idioms_close_account_data_zeroed() {
        let mut account_data = [0xFFu8; 8];
        let mut recipient_data = [];
        let mut account = mock_account_view([0u8; 32], [0u8; 32], 100, &mut account_data);
        let mut recipient = mock_account_view([1u8; 32], [0u8; 32], 0, &mut recipient_data);

        close_account(&mut account, &mut recipient).unwrap();

        unsafe {
            assert!(account.borrow_unchecked().iter().all(|&b| b == 0));
        }
    }

    #[test]
    fn test_idioms_read_u64_le_happy() {
        let data = [1u8, 0, 0, 0, 0, 0, 0, 0];
        assert_eq!(read_u64_le(&data, 0).unwrap(), 1);
    }

    #[test]
    fn test_idioms_read_u64_le_nonzero_offset() {
        let data = [0u8; 8]
            .iter()
            .chain([1u8, 0, 0, 0, 0, 0, 0, 0].iter())
            .copied()
            .collect::<alloc::vec::Vec<u8>>();
        assert_eq!(read_u64_le(&data, 8).unwrap(), 1);
    }

    #[test]
    fn test_idioms_read_u64_le_error_out_of_bounds() {
        let data = [1u8, 0, 0, 0];
        assert_eq!(
            read_u64_le(&data, 0),
            Err(ProgramError::AccountDataTooSmall)
        );
    }

    #[test]
    fn test_idioms_read_u64_le_boundary_exact() {
        let data = [1u8, 0, 0, 0, 0, 0, 0, 0];
        assert_eq!(read_u64_le(&data, 0).unwrap(), 1);
    }

    #[test]
    fn test_idioms_read_u64_le_boundary_max_value() {
        let data = [0xFFu8; 8];
        assert_eq!(read_u64_le(&data, 0).unwrap(), u64::MAX);
    }

    #[test]
    fn test_idioms_write_u64_le_happy() {
        let mut data = [0u8; 8];
        write_u64_le(&mut data, 0, 42).unwrap();
        assert_eq!(&data[..], &42u64.to_le_bytes()[..]);
    }

    #[test]
    fn test_idioms_write_u64_le_error_out_of_bounds() {
        let mut data = [0u8; 4];
        assert_eq!(
            write_u64_le(&mut data, 0, 42),
            Err(ProgramError::AccountDataTooSmall)
        );
    }

    #[test]
    fn test_idioms_write_u64_le_roundtrip() {
        let mut data = [0u8; 8];
        write_u64_le(&mut data, 0, 123456789).unwrap();
        assert_eq!(read_u64_le(&data, 0).unwrap(), 123456789);
    }

    #[test]
    fn test_idioms_read_address_happy() {
        let addr = Address::new_from_array([1u8; 32]);
        let data = addr.as_array().to_vec();
        assert_eq!(read_address(&data, 0).unwrap(), addr);
    }

    #[test]
    fn test_idioms_read_address_error_out_of_bounds() {
        let data = [0u8; 16];
        assert_eq!(
            read_address(&data, 0),
            Err(ProgramError::AccountDataTooSmall)
        );
    }

    #[test]
    fn test_idioms_read_address_boundary_exact_at_end() {
        let addr = Address::new_from_array([2u8; 32]);
        let mut data = alloc::vec::Vec::with_capacity(64);
        data.extend_from_slice(&[0u8; 32]);
        data.extend_from_slice(addr.as_array());
        assert_eq!(read_address(&data, 32).unwrap(), addr);
    }
}

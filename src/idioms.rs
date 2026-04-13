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
//! ### Entrypoint Selection
//!
//! Pinocchio provides three entrypoint macros. Choose based on your program's
//! needs:
//!
//! | Macro | When to use |
//! |-------|-------------|
//! | `entrypoint!` | Standard choice. Includes allocator + panic handler. Use if you need heap allocation. |
//! | `program_entrypoint!` | `#![no_std]` zero-allocation programs. Pair with `no_allocator!()` and `nostd_panic_handler!()`. |
//! | `lazy_program_entrypoint!` | High-performance paths where you only need a subset of accounts. Receives `InstructionContext`. |
//!
//! #### Standard `#![no_std]` template
//!
//! ```rust,ignore
//! #![no_std]
//!
//! use pinocchio::{no_allocator, nostd_panic_handler, program_entrypoint};
//!
//! no_allocator!();
//! nostd_panic_handler!();
//! program_entrypoint!(process_instruction);
//! ```
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

//! # Idioms
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! Canonical low-level helpers for Pinocchio programs.
//!
//! ## Why this module
//!
//! These helpers encode common safe-by-default patterns that appear in official
//! programs:
//!
//! - Close accounts by moving lamports and clearing data
//! - Fixed-width integer access with explicit bounds checks
//! - Fixed-width `Address` extraction
//!
//! The goal is twofold:
//!
//! - Reduce accidental UB or panics under edge inputs.
//! - Keep instruction handlers linear and consistent.
use pinocchio::account::AccountView;
use pinocchio::address::Address;
use pinocchio::error::ProgramError;
use pinocchio::ProgramResult;

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
pub fn close_account(
    account: &mut AccountView,
    recipient: &mut AccountView,
) -> ProgramResult {
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
    let end = offset.checked_add(8).ok_or(ProgramError::AccountDataTooSmall)?;
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
    let end = offset.checked_add(8).ok_or(ProgramError::AccountDataTooSmall)?;
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
    let end = offset.checked_add(32).ok_or(ProgramError::AccountDataTooSmall)?;
    if end > data.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    let bytes: [u8; 32] = data[offset..end]
        .try_into()
        .map_err(|_| ProgramError::AccountDataTooSmall)?;
    Ok(Address::new_from_array(bytes))
}

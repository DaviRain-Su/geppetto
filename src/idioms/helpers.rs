//! # Helper Functions
//!
//! Reusable safe-by-default helpers for common Pinocchio operations.

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

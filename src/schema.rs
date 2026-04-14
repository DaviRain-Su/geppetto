//! # Account Schema
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! Trait for defining account memory layouts. Inspired by:
//! - token's `Transmutable` trait
//! - rewards' `assert_no_padding!` macro
//! - escrow's zero-copy state structs
//!
//! ## How to implement
//!
//! ```rust,ignore
//! use geppetto::schema::AccountSchema;
//!
//! #[repr(C)]
//! pub struct Escrow {
//!     pub discriminator: u8,    // offset 0, 1 byte
//!     pub status: u8,           // offset 1, 1 byte
//!     pub maker: Address,       // offset 2, 32 bytes
//!     pub taker: Address,       // offset 34, 32 bytes
//!     pub amount: u64,          // offset 66, 8 bytes (LE)
//! }
//!
//! impl AccountSchema for Escrow {
//!     const LEN: usize = 74;       // 1 + 1 + 32 + 32 + 8
//!     const DISCRIMINATOR: Option<u8> = Some(1);
//!
//!     fn layout() -> &'static [(&'static str, &'static str, usize, usize)] {
//!         &[
//!             ("discriminator", "u8",      0,  1),
//!             ("status",        "u8",      1,  1),
//!             ("maker",         "Address", 2,  32),
//!             ("taker",         "Address", 34, 32),
//!             ("amount",        "u64",     66, 8),
//!         ]
//!     }
//! }
//!
//! // Field offsets also as associated constants (for direct byte access)
//! impl Escrow {
//!     pub const DISCRIMINATOR_OFFSET: usize = 0;
//!     pub const STATUS_OFFSET: usize = 1;
//!     pub const MAKER_OFFSET: usize = 2;
//!     pub const TAKER_OFFSET: usize = 34;
//!     pub const AMOUNT_OFFSET: usize = 66;
//! }
//!
//! // Compile-time size check
//! assert_account_size!(Escrow);
//! ```
//!
//! ## For AI agents
//!
//! When you see `impl AccountSchema for X`, read the `LEN`,
//! `DISCRIMINATOR`, and `*_OFFSET` constants to understand
//! the exact byte layout. Use these constants when:
//! - Serializing/deserializing account data
//! - Building TypeScript clients (offsets must match)
//! - Writing tests (assert data at specific offsets)

use pinocchio::account::AccountView;
use pinocchio::address::Address;
use pinocchio::error::ProgramError;

/// Defines the on-chain memory layout of an account type.
///
/// Implementors MUST be `#[repr(C)]` to guarantee field ordering
/// matches the byte layout. Field offsets are expressed as
/// associated constants on the implementing type (not on this trait),
/// because each account has different fields.
pub trait AccountSchema: Sized {
    /// Total size in bytes of the serialized account data.
    const LEN: usize;

    /// Single-byte discriminator to distinguish account types.
    ///
    /// `None` for accounts that don't use discriminators (e.g. system-owned).
    /// `Some(d)` for program-owned accounts — must be unique per program.
    const DISCRIMINATOR: Option<u8> = None;

    /// Return the field layout as (name, type_name, offset, size) tuples.
    fn layout() -> &'static [(&'static str, &'static str, usize, usize)];

    /// Validate that raw account data matches this schema.
    ///
    /// Default implementation checks:
    /// 1. Data length == LEN
    /// 2. Discriminator matches (if DISCRIMINATOR is Some)
    ///
    /// This default is intentionally **strict**: `AccountSchema` models a fixed-size,
    /// zero-copy account layout. If your account format includes trailing extension
    /// bytes (for example TLV or other variable-length regions), override this
    /// method with a custom validator instead of relying on the default.
    fn validate(data: &[u8]) -> Result<(), ProgramError> {
        if data.len() != Self::LEN {
            return Err(crate::error::GeppettoError::InvalidAccountLen.into());
        }
        if let Some(d) = Self::DISCRIMINATOR
            && (data.is_empty() || data[0] != d)
        {
            return Err(ProgramError::InvalidAccountData);
        }
        Ok(())
    }

    /// Zero-copy cast from raw account data to &Self.
    ///
    /// # Safety
    ///
    /// Caller MUST ensure:
    /// - `data.len() >= size_of::<Self>()` (not just `Self::LEN`)
    /// - `Self` is `#[repr(C)]` with no padding bytes
    /// - Discriminator has been validated (if applicable)
    /// - Account owner is correct
    unsafe fn from_bytes_unchecked(data: &[u8]) -> &Self {
        // SAFETY: caller guarantees data.len() >= size_of::<Self>(),
        // Self is #[repr(C)] with no padding, and discriminator/owner are valid.
        unsafe { &*(data.as_ptr() as *const Self) }
    }

    /// Validate an AccountView and return a zero-copy reference.
    ///
    /// # Safety
    ///
    /// This function is marked `unsafe` because it returns a reference tied to
    /// the internal borrow of `account`. The caller must ensure the borrow is
    /// not violated (i.e., do not call `try_borrow_mut` while this reference lives).
    ///
    /// ## Pinocchio borrow model (soundness note)
    ///
    /// `account.try_borrow()` creates a temporary runtime borrow guard over the
    /// account data. Dropping the guard releases borrow tracking but does not
    /// deallocate or relocate the account's backing bytes. The returned pointer is
    /// therefore valid for the account's transaction lifetime as long as no mutable
    /// borrow of the same account is created while the returned reference lives.
    /// This is why the function escapes the borrow through
    /// `core::slice::from_raw_parts`.
    unsafe fn try_from_account<'a>(
        account: &'a AccountView,
        program_id: &Address,
    ) -> Result<&'a Self, ProgramError> {
        if !account.owned_by(program_id) {
            return Err(ProgramError::InvalidAccountOwner);
        }
        let data = account.try_borrow()?;
        Self::validate(&data)?;
        // SAFETY: we just validated length and discriminator, and owner is correct.
        // We extend the borrow by returning a reference with lifetime `'a`.
        // This is sound as long as the caller respects the borrow invariant.
        let ptr = data.as_ref().as_ptr();
        let len = data.as_ref().len();
        Ok(unsafe { Self::from_bytes_unchecked(core::slice::from_raw_parts(ptr, len)) })
    }
}

/// Compile-time assertion that a struct's size matches AccountSchema::LEN.
#[macro_export]
macro_rules! assert_account_size {
    ($t:ty) => {
        const _: () = {
            assert!(
                core::mem::size_of::<$t>() == <$t as $crate::schema::AccountSchema>::LEN,
                "struct size does not match AccountSchema::LEN — check for padding"
            );
        };
    };
}

#[cfg(test)]
mod tests {
    extern crate alloc;

    use super::*;
    use pinocchio::account::{AccountView, RuntimeAccount};
    use pinocchio::address::Address;

    #[repr(C)]
    #[derive(Debug, PartialEq)]
    struct MockAccount {
        discriminator: u8,
        _padding: [u8; 7],
        value: u64,
    }

    impl AccountSchema for MockAccount {
        const LEN: usize = 16; // 1 + 7 (padding) + 8
        const DISCRIMINATOR: Option<u8> = Some(42);

        fn layout() -> &'static [(&'static str, &'static str, usize, usize)] {
            &[("discriminator", "u8", 0, 1), ("value", "u64", 8, 8)]
        }
    }

    assert_account_size!(MockAccount);

    #[repr(C)]
    struct NoDiscriminatorAccount {
        value: u64,
    }

    impl AccountSchema for NoDiscriminatorAccount {
        const LEN: usize = 8;
        const DISCRIMINATOR: Option<u8> = None;

        fn layout() -> &'static [(&'static str, &'static str, usize, usize)] {
            &[("value", "u64", 0, 8)]
        }
    }

    assert_account_size!(NoDiscriminatorAccount);

    fn mock_account_view(key: [u8; 32], owner: [u8; 32], data: &mut [u8]) -> AccountView {
        unsafe {
            let total_size = core::mem::size_of::<RuntimeAccount>() + data.len();
            let layout = core::alloc::Layout::from_size_align(total_size, 8).unwrap();
            let ptr = alloc::alloc::alloc(layout);
            assert!(!ptr.is_null());

            let raw = ptr as *mut RuntimeAccount;
            (*raw).borrow_state = pinocchio::account::NOT_BORROWED;
            (*raw).is_signer = 0;
            (*raw).is_writable = 0;
            (*raw).executable = 0;
            (*raw).padding = [0; 4];
            (*raw).address = Address::new_from_array(key);
            (*raw).owner = Address::new_from_array(owner);
            (*raw).lamports = 0;
            (*raw).data_len = data.len() as u64;

            if !data.is_empty() {
                let data_ptr = ptr.add(core::mem::size_of::<RuntimeAccount>());
                core::ptr::copy_nonoverlapping(data.as_ptr(), data_ptr, data.len());
            }

            AccountView::new_unchecked(raw)
        }
    }

    #[test]
    fn test_schema_validate_happy() {
        let data = [42u8, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0];
        assert!(MockAccount::validate(&data).is_ok());
    }

    #[test]
    fn test_schema_validate_error_short() {
        let data = [42u8, 0, 0, 0, 0];
        assert_eq!(
            MockAccount::validate(&data),
            Err(crate::error::GeppettoError::InvalidAccountLen.into())
        );
    }

    #[test]
    fn test_schema_validate_error_wrong_discriminator() {
        let data = [99u8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        assert_eq!(
            MockAccount::validate(&data),
            Err(ProgramError::InvalidAccountData)
        );
    }

    #[test]
    fn test_schema_validate_boundary_exact_len() {
        let data = [42u8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        assert!(MockAccount::validate(&data).is_ok());
    }

    #[test]
    fn test_schema_validate_error_longer_data() {
        let data = [42u8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        assert_eq!(
            MockAccount::validate(&data),
            Err(crate::error::GeppettoError::InvalidAccountLen.into())
        );
    }

    #[test]
    fn test_schema_validate_boundary_none_discriminator() {
        let data = [99u8, 0, 0, 0, 0, 0, 0, 0];
        assert!(NoDiscriminatorAccount::validate(&data).is_ok());
    }

    #[test]
    fn test_schema_try_from_account_happy() {
        let program_id = Address::new_from_array([1u8; 32]);
        let mut data = [42u8, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0];
        let account = mock_account_view([0u8; 32], *program_id.as_array(), &mut data);
        unsafe {
            let result = MockAccount::try_from_account(&account, &program_id).unwrap();
            assert_eq!(result.discriminator, 42);
            assert_eq!(result.value, 7);
        }
    }

    #[test]
    fn test_schema_try_from_account_error_wrong_owner() {
        let program_id = Address::new_from_array([1u8; 32]);
        let wrong_owner = Address::new_from_array([2u8; 32]);
        let mut data = [42u8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        let account = mock_account_view([0u8; 32], *wrong_owner.as_array(), &mut data);
        unsafe {
            assert!(matches!(
                MockAccount::try_from_account(&account, &program_id),
                Err(ProgramError::InvalidAccountOwner)
            ));
        }
    }

    #[test]
    fn test_schema_try_from_account_error_short_data() {
        let program_id = Address::new_from_array([1u8; 32]);
        let mut data = [42u8, 0, 0, 0, 0];
        let account = mock_account_view([0u8; 32], *program_id.as_array(), &mut data);
        unsafe {
            assert!(matches!(
                MockAccount::try_from_account(&account, &program_id),
                Err(ProgramError::Custom(code))
                    if code == crate::error::GeppettoError::InvalidAccountLen as u32
            ));
        }
    }

    #[test]
    fn test_schema_try_from_account_error_wrong_discriminator() {
        let program_id = Address::new_from_array([1u8; 32]);
        let mut data = [99u8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        let account = mock_account_view([0u8; 32], *program_id.as_array(), &mut data);
        unsafe {
            assert!(matches!(
                MockAccount::try_from_account(&account, &program_id),
                Err(ProgramError::InvalidAccountData)
            ));
        }
    }

    #[test]
    fn test_schema_from_bytes_unchecked_happy() {
        let data = [42u8, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0];
        unsafe {
            let account = MockAccount::from_bytes_unchecked(&data);
            assert_eq!(account.discriminator, 42);
            assert_eq!(account.value, 7);
        }
    }

    #[test]
    fn test_schema_from_bytes_unchecked_zero_copy() {
        let mut data = [42u8, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0];
        let account_ptr = data.as_ptr() as *const MockAccount;

        unsafe {
            let first = MockAccount::from_bytes_unchecked(&data);
            assert_eq!(core::ptr::addr_of!(*first), account_ptr);
            assert_eq!(first.value, 7);
        }

        data[8..16].copy_from_slice(&99u64.to_le_bytes());

        unsafe {
            let second = MockAccount::from_bytes_unchecked(&data);
            assert_eq!(core::ptr::addr_of!(*second), account_ptr);
            assert_eq!(second.value, 99);
        }
    }
}

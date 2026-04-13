use pinocchio::account::AccountView;
use pinocchio::address::Address;
use pinocchio::error::ProgramError;

/// Defines the on-chain memory layout of an account type.
///
/// > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
/// > **Verified against**: Solana 2.2.x
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
    /// 1. Data length >= LEN
    /// 2. Discriminator matches (if DISCRIMINATOR is Some)
    fn validate(data: &[u8]) -> Result<(), ProgramError> {
        if data.len() < Self::LEN {
            return Err(ProgramError::AccountDataTooSmall);
        }
        if let Some(d) = Self::DISCRIMINATOR {
            if data.is_empty() || data[0] != d {
                return Err(ProgramError::InvalidAccountData);
            }
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
    unsafe fn try_from_account<'a>(
        account: &'a AccountView,
        program_id: &Address,
    ) -> Result<&'a Self, ProgramError> {
        if !account.owned_by(program_id) {
            return Err(ProgramError::InvalidAccountOwner);
        }
        let data = account.try_borrow()?;
        Self::validate(&*data)?;
        // SAFETY: we just validated length and discriminator, and owner is correct.
        // We leak the `Ref` by extracting its raw pointer, extending the borrow
        // to the lifetime of `account`. Caller is responsible for not violating
        // the borrow rules.
        let ptr: *const [u8] = data.as_ref();
        core::mem::forget(data);
        Ok(unsafe { Self::from_bytes_unchecked(&*ptr) })
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

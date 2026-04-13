use pinocchio::account::AccountView;
use pinocchio::address::Address;
use pinocchio::error::ProgramError;

/// Assert that the account is a signer of the transaction.
///
/// # Why this matters
/// Missing signer checks allow anyone to impersonate authorized users.
/// This is the #1 most common Solana program vulnerability.
///
/// # Errors
/// Returns [`ProgramError::MissingRequiredSignature`] if `account.is_signer()` is false.
#[inline]
pub fn assert_signer(account: &AccountView) -> Result<(), ProgramError> {
    if account.is_signer() {
        Ok(())
    } else {
        Err(ProgramError::MissingRequiredSignature)
    }
}

/// Assert that the account is writable.
///
/// # Why this matters
/// Writing to a read-only account causes a runtime error.
/// Checking explicitly gives a clear error message instead of
/// a cryptic "program failed to complete" at CPI time.
///
/// # Errors
/// Returns [`ProgramError::Immutable`] if `account.is_writable()` is false.
#[inline]
pub fn assert_writable(account: &AccountView) -> Result<(), ProgramError> {
    if account.is_writable() {
        Ok(())
    } else {
        Err(ProgramError::Immutable)
    }
}

/// Assert that the account is owned by the expected program.
///
/// # Why this matters
/// If you don't check ownership, an attacker can pass an account
/// owned by a different program with arbitrary data.
/// This is the #2 most common Solana vulnerability.
///
/// # Errors
/// Returns [`ProgramError::InvalidAccountOwner`] if `account.owner() != expected_owner`.
#[inline]
pub fn assert_owner(account: &AccountView, expected_owner: &Address) -> Result<(), ProgramError> {
    if account.owned_by(expected_owner) {
        Ok(())
    } else {
        Err(ProgramError::InvalidAccountOwner)
    }
}

/// Assert that the account's address matches the expected PDA.
///
/// # Why this matters
/// PDA validation ensures the account was derived from the expected
/// seeds. Without this check, an attacker can substitute any account.
///
/// # Errors
/// Returns [`crate::error::GeppettoError::PdaMismatch`] if the derived address does not match.
/// Returns the bump seed on success.
pub fn assert_pda(
    account: &AccountView,
    seeds: &[&[u8]],
    program_id: &Address,
) -> Result<u8, ProgramError> {
    let (derived, bump) =
        derive_pda(seeds, program_id).ok_or(crate::error::GeppettoError::PdaMismatch)?;
    if account.address() == &derived {
        Ok(bump)
    } else {
        Err(crate::error::GeppettoError::PdaMismatch.into())
    }
}

/// Derive a PDA from seeds and program_id.
///
/// Solana allows up to 15 seeds (each up to 32 bytes) for
/// `Address::derive_program_address`. This helper builds a fixed-size
/// array for each exact seed count (0-15) so we can call the
/// const-generic API without unsafe transmute.
fn derive_pda(seeds: &[&[u8]], program_id: &Address) -> Option<(Address, u8)> {
    match seeds.len() {
        0 => Address::derive_program_address(&[], program_id),
        1 => {
            let s = [seeds[0]];
            Address::derive_program_address(&s, program_id)
        }
        2 => {
            let s = [seeds[0], seeds[1]];
            Address::derive_program_address(&s, program_id)
        }
        3 => {
            let s = [seeds[0], seeds[1], seeds[2]];
            Address::derive_program_address(&s, program_id)
        }
        4 => {
            let s = [seeds[0], seeds[1], seeds[2], seeds[3]];
            Address::derive_program_address(&s, program_id)
        }
        5 => {
            let s = [seeds[0], seeds[1], seeds[2], seeds[3], seeds[4]];
            Address::derive_program_address(&s, program_id)
        }
        6 => {
            let s = [seeds[0], seeds[1], seeds[2], seeds[3], seeds[4], seeds[5]];
            Address::derive_program_address(&s, program_id)
        }
        7 => {
            let s = [
                seeds[0], seeds[1], seeds[2], seeds[3], seeds[4], seeds[5], seeds[6],
            ];
            Address::derive_program_address(&s, program_id)
        }
        8 => {
            let s = [
                seeds[0], seeds[1], seeds[2], seeds[3], seeds[4], seeds[5], seeds[6],
                seeds[7],
            ];
            Address::derive_program_address(&s, program_id)
        }
        9 => {
            let s = [
                seeds[0], seeds[1], seeds[2], seeds[3], seeds[4], seeds[5], seeds[6],
                seeds[7], seeds[8],
            ];
            Address::derive_program_address(&s, program_id)
        }
        10 => {
            let s = [
                seeds[0], seeds[1], seeds[2], seeds[3], seeds[4], seeds[5], seeds[6],
                seeds[7], seeds[8], seeds[9],
            ];
            Address::derive_program_address(&s, program_id)
        }
        11 => {
            let s = [
                seeds[0], seeds[1], seeds[2], seeds[3], seeds[4], seeds[5], seeds[6],
                seeds[7], seeds[8], seeds[9], seeds[10],
            ];
            Address::derive_program_address(&s, program_id)
        }
        12 => {
            let s = [
                seeds[0], seeds[1], seeds[2], seeds[3], seeds[4], seeds[5], seeds[6],
                seeds[7], seeds[8], seeds[9], seeds[10], seeds[11],
            ];
            Address::derive_program_address(&s, program_id)
        }
        13 => {
            let s = [
                seeds[0], seeds[1], seeds[2], seeds[3], seeds[4], seeds[5], seeds[6],
                seeds[7], seeds[8], seeds[9], seeds[10], seeds[11], seeds[12],
            ];
            Address::derive_program_address(&s, program_id)
        }
        14 => {
            let s = [
                seeds[0], seeds[1], seeds[2], seeds[3], seeds[4], seeds[5], seeds[6],
                seeds[7], seeds[8], seeds[9], seeds[10], seeds[11], seeds[12], seeds[13],
            ];
            Address::derive_program_address(&s, program_id)
        }
        15 => {
            let s = [
                seeds[0], seeds[1], seeds[2], seeds[3], seeds[4], seeds[5], seeds[6],
                seeds[7], seeds[8], seeds[9], seeds[10], seeds[11], seeds[12], seeds[13],
                seeds[14],
            ];
            Address::derive_program_address(&s, program_id)
        }
        _ => None,
    }
}

/// Assert that the first byte of account data matches the expected discriminator.
///
/// # Why this matters
/// Without discriminator checks, an attacker can pass a different
/// account type with a valid layout but wrong semantics.
///
/// # Errors
/// Returns [`crate::error::GeppettoError::InvalidDiscriminator`] if mismatch.
/// Returns [`ProgramError::AccountDataTooSmall`] if data is empty.
pub fn assert_discriminator(account: &AccountView, expected: u8) -> Result<(), ProgramError> {
    let data = account.try_borrow()?;
    if data.is_empty() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    if data[0] == expected {
        Ok(())
    } else {
        Err(crate::error::GeppettoError::InvalidDiscriminator.into())
    }
}

/// Assert that the account holds enough lamports to be rent exempt.
///
/// # Why this matters
/// Non-rent-exempt accounts can be garbage collected by the runtime,
/// causing data loss.
///
/// # Implementation note
/// Uses hardcoded rent constants. See `rent_exempt_minimum` for details.
///
/// # Errors
/// Returns [`ProgramError::AccountNotRentExempt`] if below threshold.
pub fn assert_rent_exempt(account: &AccountView) -> Result<(), ProgramError> {
    let min_balance = rent_exempt_minimum(account.data_len());
    if account.lamports() >= min_balance {
        Ok(())
    } else {
        Err(ProgramError::AccountNotRentExempt)
    }
}

/// Calculate minimum lamports for rent exemption.
///
/// ⚠️ WARNING: This uses hardcoded Solana mainnet parameters.
/// For accurate results, pass the rent amount computed off-chain
/// via instruction data.
///
/// Formula: (128 + data_len) * 3480 * 2
/// where 3480 = lamports per byte-year (mainnet hardcoded)
///        2   = exemption threshold in years
#[inline]
const fn rent_exempt_minimum(data_len: usize) -> u64 {
    ((128 + data_len) as u64) * 3480 * 2
}

/// Assert that the account is NOT writable (read-only).
///
/// # Why this matters
/// Passing a writable account where read-only is expected can enable
/// unintended state mutations.
///
/// # Errors
/// Returns [`crate::error::GeppettoError::ExpectedReadonly`] if `account.is_writable()` is true.
#[inline]
pub fn assert_readonly(account: &AccountView) -> Result<(), ProgramError> {
    if !account.is_writable() {
        Ok(())
    } else {
        Err(crate::error::GeppettoError::ExpectedReadonly.into())
    }
}

/// Assert that the account's address is the System Program.
///
/// # Why this matters
/// When creating accounts via CPI, you must verify the system program
/// account is actually the system program. An attacker could substitute
/// a malicious program.
///
/// # Errors
/// Returns [`ProgramError::IncorrectProgramId`] if mismatch.
#[inline]
pub fn assert_system_program(account: &AccountView) -> Result<(), ProgramError> {
    if account.address() == &SYSTEM_PROGRAM_ID {
        Ok(())
    } else {
        Err(ProgramError::IncorrectProgramId)
    }
}

/// System Program ID: `11111111111111111111111111111111`
pub const SYSTEM_PROGRAM_ID: Address = Address::new_from_array([0u8; 32]);

/// Assert that the account's address is either SPL Token or Token-2022.
///
/// # Why this matters
/// Programs that handle tokens must verify the token program account.
/// Since Token-2022 is increasingly common, this guard accepts BOTH
/// program IDs.
///
/// # Errors
/// Returns [`ProgramError::IncorrectProgramId`] if neither Token nor Token-2022.
#[inline]
pub fn assert_token_program(account: &AccountView) -> Result<(), ProgramError> {
    let addr = account.address();
    if addr == &SPL_TOKEN_PROGRAM_ID || addr == &TOKEN_2022_PROGRAM_ID {
        Ok(())
    } else {
        Err(ProgramError::IncorrectProgramId)
    }
}

/// SPL Token Program ID: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
pub const SPL_TOKEN_PROGRAM_ID: Address = Address::new_from_array([
    0x06, 0xdd, 0xf6, 0xe1, 0xd7, 0x65, 0xa1, 0x93,
    0xd9, 0xcb, 0xe1, 0x46, 0xce, 0xeb, 0x79, 0xac,
    0x1c, 0xb4, 0x85, 0xed, 0x5f, 0x5b, 0x37, 0x91,
    0x3a, 0x8c, 0xf5, 0x85, 0x7e, 0xff, 0x00, 0xa9,
]);

/// Token-2022 Program ID: TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
pub const TOKEN_2022_PROGRAM_ID: Address = Address::new_from_array([
    0x06, 0xdd, 0xf6, 0xe1, 0xee, 0x75, 0x8f, 0xde,
    0x18, 0x42, 0x5d, 0xbc, 0xe4, 0x6c, 0xcd, 0xda,
    0xb6, 0x1a, 0xfc, 0x4d, 0x83, 0xb9, 0x0d, 0x27,
    0xfe, 0xbd, 0xf9, 0x28, 0xd8, 0xa1, 0x8b, 0xfc,
]);

/// Assert that the account is owned by the currently executing program.
///
/// # Why this matters
/// Ensures the account was created by this program, not a different one.
/// This is a CPI re-entrancy guard.
///
/// # Errors
/// Returns [`ProgramError::InvalidAccountOwner`] if mismatch.
#[inline]
pub fn assert_current_program(
    account: &AccountView,
    program_id: &Address,
) -> Result<(), ProgramError> {
    assert_owner(account, program_id)
}

/// Assert that the accounts slice has at least `expected` accounts.
///
/// # Why this matters
/// Accessing `accounts[n]` on a too-short slice panics at runtime
/// with an unhelpful message. This guard gives a clear
/// `NotEnoughAccountKeys` error upfront.
///
/// # Errors
/// Returns [`ProgramError::NotEnoughAccountKeys`] if `accounts.len() < expected`.
#[inline]
pub fn assert_account_count(accounts: &[AccountView], expected: usize) -> Result<(), ProgramError> {
    if accounts.len() >= expected {
        Ok(())
    } else {
        Err(ProgramError::NotEnoughAccountKeys)
    }
}

/// Assert that the account's address matches the expected Associated Token Account.
///
/// # Why this matters
/// ATA derivation uses a specific seed pattern. If you don't verify,
/// an attacker can substitute a non-ATA token account.
///
/// # Errors
/// Returns [`crate::error::GeppettoError::PdaMismatch`] if derived ATA address doesn't match.
pub fn assert_ata(
    account: &AccountView,
    wallet: &Address,
    mint: &Address,
    token_program: &Address,
) -> Result<(), ProgramError> {
    let derived = derive_ata(wallet, mint, token_program)?;
    if account.address() == &derived {
        Ok(())
    } else {
        Err(crate::error::GeppettoError::PdaMismatch.into())
    }
}

/// Derive an Associated Token Account address.
fn derive_ata(wallet: &Address, mint: &Address, token_program: &Address) -> Result<Address, ProgramError> {
    let seeds: &[&[u8]] = &[wallet.as_ref(), token_program.as_ref(), mint.as_ref()];
    let (addr, _) = derive_pda(seeds, &ATA_PROGRAM_ID)
        .ok_or(crate::error::GeppettoError::PdaMismatch)?;
    Ok(addr)
}

/// Associated Token Account Program ID: ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL
pub const ATA_PROGRAM_ID: Address = Address::new_from_array([
    0x8c, 0x97, 0x25, 0x8f, 0x4e, 0x24, 0x89, 0xf1,
    0xbb, 0x3d, 0x10, 0x29, 0x14, 0x8e, 0x0d, 0x83,
    0x0b, 0x5a, 0x13, 0x99, 0xda, 0xff, 0x10, 0x84,
    0x04, 0x8e, 0x7b, 0xd8, 0xdb, 0xe9, 0xf8, 0x59,
]);

#[cfg(test)]
mod tests {
    extern crate alloc;

    use super::*;
    use pinocchio::account::AccountView;
    use pinocchio::address::Address;
    use pinocchio::account::RuntimeAccount;

    // Helper to create a mock AccountView for testing.
    // Allocates a RuntimeAccount followed by data region on the heap,
    // initializes all fields, and returns an AccountView via new_unchecked.
    // The memory is leaked intentionally since AccountView borrows it.
    // This is a test-only helper and should not be used in production.
    fn mock_account_view(
        key: [u8; 32],
        owner: [u8; 32],
        lamports: u64,
        data: &mut [u8],
        is_signer: bool,
        is_writable: bool,
    ) -> AccountView {
        unsafe {
            let total_size = core::mem::size_of::<RuntimeAccount>() + data.len();
            let layout = core::alloc::Layout::from_size_align(total_size, 8).unwrap();
            let ptr = alloc::alloc::alloc(layout);
            assert!(!ptr.is_null());

            let raw = ptr as *mut RuntimeAccount;
            (*raw).borrow_state = pinocchio::account::NOT_BORROWED;
            (*raw).is_signer = if is_signer { 1 } else { 0 };
            (*raw).is_writable = if is_writable { 1 } else { 0 };
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
    fn test_assert_signer_happy() {
        let mut data = [];
        let account = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            0,
            &mut data,
            true,
            false,
        );
        assert!(assert_signer(&account).is_ok());
    }

    #[test]
    fn test_assert_signer_error() {
        let mut data = [];
        let account = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            0,
            &mut data,
            false,
            false,
        );
        assert_eq!(
            assert_signer(&account),
            Err(ProgramError::MissingRequiredSignature)
        );
    }

    #[test]
    fn test_assert_writable_happy() {
        let mut data = [];
        let account = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            0,
            &mut data,
            false,
            true,
        );
        assert!(assert_writable(&account).is_ok());
    }

    #[test]
    fn test_assert_writable_error() {
        let mut data = [];
        let account = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            0,
            &mut data,
            false,
            false,
        );
        assert_eq!(assert_writable(&account), Err(ProgramError::Immutable));
    }

    #[test]
    fn test_assert_owner_happy() {
        let mut data = [];
        let owner = Address::new_from_array([1u8; 32]);
        let account = mock_account_view(
            [0u8; 32],
            *owner.as_array(),
            0,
            &mut data,
            false,
            false,
        );
        assert!(assert_owner(&account, &owner).is_ok());
    }

    #[test]
    fn test_assert_owner_error() {
        let mut data = [];
        let owner = Address::new_from_array([1u8; 32]);
        let wrong_owner = Address::new_from_array([2u8; 32]);
        let account = mock_account_view(
            [0u8; 32],
            *wrong_owner.as_array(),
            0,
            &mut data,
            false,
            false,
        );
        assert_eq!(
            assert_owner(&account, &owner),
            Err(ProgramError::InvalidAccountOwner)
        );
    }

    #[test]
    fn test_assert_pda_happy() {
        let program_id = Address::new_from_array([1u8; 32]);
        let seeds: &[&[u8]] = &[b"test"];
        let (derived, bump) = derive_pda(seeds, &program_id).unwrap();

        let mut data = [];
        let account = mock_account_view(
            *derived.as_array(),
            *program_id.as_array(),
            0,
            &mut data,
            false,
            false,
        );
        assert_eq!(assert_pda(&account, seeds, &program_id).unwrap(), bump);
    }

    #[test]
    fn test_assert_pda_error() {
        let program_id = Address::new_from_array([1u8; 32]);
        let seeds: &[&[u8]] = &[b"test"];
        let wrong_address = Address::new_from_array([99u8; 32]);

        let mut data = [];
        let account = mock_account_view(
            *wrong_address.as_array(),
            *program_id.as_array(),
            0,
            &mut data,
            false,
            false,
        );
        assert_eq!(
            assert_pda(&account, seeds, &program_id),
            Err(crate::error::GeppettoError::PdaMismatch.into())
        );
    }

    #[test]
    fn test_assert_pda_empty_seeds() {
        let program_id = Address::new_from_array([1u8; 32]);
        let seeds: &[&[u8]] = &[];
        let (derived, bump) = derive_pda(seeds, &program_id).unwrap();

        let mut data = [];
        let account = mock_account_view(
            *derived.as_array(),
            *program_id.as_array(),
            0,
            &mut data,
            false,
            false,
        );
        assert_eq!(assert_pda(&account, seeds, &program_id).unwrap(), bump);
    }

    #[test]
    fn test_derive_pda_boundary_too_many_seeds() {
        let program_id = Address::new_from_array([1u8; 32]);
        let seeds: &[&[u8]] = &[b"1", b"2", b"3", b"4", b"5", b"6", b"7", b"8", b"9", b"10", b"11", b"12", b"13", b"14", b"15", b"16"];
        assert_eq!(derive_pda(seeds, &program_id), None);
    }

    #[test]
    fn test_assert_discriminator_happy() {
        let mut data = [42u8];
        let account = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            0,
            &mut data,
            false,
            false,
        );
        assert!(assert_discriminator(&account, 42).is_ok());
    }

    #[test]
    fn test_assert_discriminator_error() {
        let mut data = [42u8];
        let account = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            0,
            &mut data,
            false,
            false,
        );
        assert_eq!(
            assert_discriminator(&account, 99),
            Err(crate::error::GeppettoError::InvalidDiscriminator.into())
        );
    }

    #[test]
    fn test_assert_discriminator_empty_data() {
        let mut data = [];
        let account = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            0,
            &mut data,
            false,
            false,
        );
        assert_eq!(
            assert_discriminator(&account, 42),
            Err(ProgramError::AccountDataTooSmall)
        );
    }

    #[test]
    fn test_assert_rent_exempt_happy() {
        let mut data = [0u8; 100];
        let min_balance = rent_exempt_minimum(100);
        let account = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            min_balance,
            &mut data,
            false,
            false,
        );
        assert!(assert_rent_exempt(&account).is_ok());
    }

    #[test]
    fn test_assert_rent_exempt_error() {
        let mut data = [0u8; 100];
        let min_balance = rent_exempt_minimum(100);
        let account = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            min_balance - 1,
            &mut data,
            false,
            false,
        );
        assert_eq!(
            assert_rent_exempt(&account),
            Err(ProgramError::AccountNotRentExempt)
        );
    }

    #[test]
    fn test_assert_rent_exempt_boundary_exact() {
        let mut data = [0u8; 100];
        let min_balance = rent_exempt_minimum(100);
        let account = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            min_balance,
            &mut data,
            false,
            false,
        );
        assert!(assert_rent_exempt(&account).is_ok());
    }

    #[test]
    fn test_assert_rent_exempt_data_len_zero() {
        let mut data = [];
        let min_balance = rent_exempt_minimum(0);
        let account = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            min_balance,
            &mut data,
            false,
            false,
        );
        assert!(assert_rent_exempt(&account).is_ok());
    }

    #[test]
    fn test_assert_readonly_happy() {
        let mut data = [];
        let account = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            0,
            &mut data,
            false,
            false,
        );
        assert!(assert_readonly(&account).is_ok());
    }

    #[test]
    fn test_assert_readonly_error() {
        let mut data = [];
        let account = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            0,
            &mut data,
            false,
            true,
        );
        assert_eq!(
            assert_readonly(&account),
            Err(crate::error::GeppettoError::ExpectedReadonly.into())
        );
    }

    #[test]
    fn test_assert_system_program_happy() {
        let mut data = [];
        let account = mock_account_view(
            *SYSTEM_PROGRAM_ID.as_array(),
            [0u8; 32],
            0,
            &mut data,
            false,
            false,
        );
        assert!(assert_system_program(&account).is_ok());
    }

    #[test]
    fn test_assert_system_program_error() {
        let mut data = [];
        let wrong_address = Address::new_from_array([99u8; 32]);
        let account = mock_account_view(
            *wrong_address.as_array(),
            [0u8; 32],
            0,
            &mut data,
            false,
            false,
        );
        assert_eq!(
            assert_system_program(&account),
            Err(ProgramError::IncorrectProgramId)
        );
    }

    #[test]
    fn test_assert_token_program_happy_token() {
        let mut data = [];
        let account = mock_account_view(
            *SPL_TOKEN_PROGRAM_ID.as_array(),
            [0u8; 32],
            0,
            &mut data,
            false,
            false,
        );
        assert!(assert_token_program(&account).is_ok());
    }

    #[test]
    fn test_assert_token_program_happy_token_2022() {
        let mut data = [];
        let account = mock_account_view(
            *TOKEN_2022_PROGRAM_ID.as_array(),
            [0u8; 32],
            0,
            &mut data,
            false,
            false,
        );
        assert!(assert_token_program(&account).is_ok());
    }

    #[test]
    fn test_assert_token_program_error() {
        let mut data = [];
        let wrong_address = Address::new_from_array([99u8; 32]);
        let account = mock_account_view(
            *wrong_address.as_array(),
            [0u8; 32],
            0,
            &mut data,
            false,
            false,
        );
        assert_eq!(
            assert_token_program(&account),
            Err(ProgramError::IncorrectProgramId)
        );
    }

    #[test]
    fn test_assert_current_program_happy() {
        let program_id = Address::new_from_array([1u8; 32]);
        let mut data = [];
        let account = mock_account_view(
            [0u8; 32],
            *program_id.as_array(),
            0,
            &mut data,
            false,
            false,
        );
        assert!(assert_current_program(&account, &program_id).is_ok());
    }

    #[test]
    fn test_assert_current_program_error() {
        let program_id = Address::new_from_array([1u8; 32]);
        let wrong_owner = Address::new_from_array([2u8; 32]);
        let mut data = [];
        let account = mock_account_view(
            [0u8; 32],
            *wrong_owner.as_array(),
            0,
            &mut data,
            false,
            false,
        );
        assert_eq!(
            assert_current_program(&account, &program_id),
            Err(ProgramError::InvalidAccountOwner)
        );
    }

    #[test]
    fn test_assert_account_count_happy_greater() {
        let mut data1 = [];
        let mut data2 = [];
        let account1 = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            0,
            &mut data1,
            false,
            false,
        );
        let account2 = mock_account_view(
            [1u8; 32],
            [0u8; 32],
            0,
            &mut data2,
            false,
            false,
        );
        let accounts = [account1, account2];
        assert!(assert_account_count(&accounts, 1).is_ok());
    }

    #[test]
    fn test_assert_account_count_boundary_exact() {
        let mut data1 = [];
        let mut data2 = [];
        let account1 = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            0,
            &mut data1,
            false,
            false,
        );
        let account2 = mock_account_view(
            [1u8; 32],
            [0u8; 32],
            0,
            &mut data2,
            false,
            false,
        );
        let accounts = [account1, account2];
        assert!(assert_account_count(&accounts, 2).is_ok());
    }

    #[test]
    fn test_assert_account_count_error() {
        let mut data1 = [];
        let account1 = mock_account_view(
            [0u8; 32],
            [0u8; 32],
            0,
            &mut data1,
            false,
            false,
        );
        let accounts = [account1];
        assert_eq!(
            assert_account_count(&accounts, 2),
            Err(ProgramError::NotEnoughAccountKeys)
        );
    }

    #[test]
    fn test_assert_account_count_boundary_zero() {
        let accounts: [AccountView; 0] = [];
        assert!(assert_account_count(&accounts, 0).is_ok());
    }

    #[test]
    fn test_assert_ata_happy() {
        let wallet = Address::new_from_array([1u8; 32]);
        let mint = Address::new_from_array([2u8; 32]);
        let token_program = SPL_TOKEN_PROGRAM_ID;
        let derived = derive_ata(&wallet, &mint, &token_program).unwrap();

        let mut data = [];
        let account = mock_account_view(
            *derived.as_array(),
            [0u8; 32],
            0,
            &mut data,
            false,
            false,
        );
        assert!(assert_ata(&account, &wallet, &mint, &token_program).is_ok());
    }

    #[test]
    fn test_assert_ata_error_wrong_mint() {
        let wallet = Address::new_from_array([1u8; 32]);
        let mint = Address::new_from_array([2u8; 32]);
        let wrong_mint = Address::new_from_array([3u8; 32]);
        let token_program = SPL_TOKEN_PROGRAM_ID;

        let derived = derive_ata(&wallet, &mint, &token_program).unwrap();
        let mut data = [];
        let account = mock_account_view(
            *derived.as_array(),
            [0u8; 32],
            0,
            &mut data,
            false,
            false,
        );
        assert_eq!(
            assert_ata(&account, &wallet, &wrong_mint, &token_program),
            Err(crate::error::GeppettoError::PdaMismatch.into())
        );
    }

    #[test]
    fn test_assert_ata_error_wrong_wallet() {
        let wallet = Address::new_from_array([1u8; 32]);
        let wrong_wallet = Address::new_from_array([99u8; 32]);
        let mint = Address::new_from_array([2u8; 32]);
        let token_program = SPL_TOKEN_PROGRAM_ID;

        let derived = derive_ata(&wallet, &mint, &token_program).unwrap();
        let mut data = [];
        let account = mock_account_view(
            *derived.as_array(),
            [0u8; 32],
            0,
            &mut data,
            false,
            false,
        );
        assert_eq!(
            assert_ata(&account, &wrong_wallet, &mint, &token_program),
            Err(crate::error::GeppettoError::PdaMismatch.into())
        );
    }

    #[test]
    fn test_assert_ata_error_wrong_token_program() {
        let wallet = Address::new_from_array([1u8; 32]);
        let mint = Address::new_from_array([2u8; 32]);
        let token_program = SPL_TOKEN_PROGRAM_ID;
        let wrong_token_program = Address::new_from_array([99u8; 32]);

        let derived = derive_ata(&wallet, &mint, &token_program).unwrap();
        let mut data = [];
        let account = mock_account_view(
            *derived.as_array(),
            [0u8; 32],
            0,
            &mut data,
            false,
            false,
        );
        assert_eq!(
            assert_ata(&account, &wallet, &mint, &wrong_token_program),
            Err(crate::error::GeppettoError::PdaMismatch.into())
        );
    }
}

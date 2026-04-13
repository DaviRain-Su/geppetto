use pinocchio::account::AccountView;
use pinocchio::address::Address;
use pinocchio::error::ProgramError;

/// Assert that the account is a signer of the transaction.
#[inline]
pub fn assert_signer(account: &AccountView) -> Result<(), ProgramError> {
    if account.is_signer() {
        Ok(())
    } else {
        Err(ProgramError::MissingRequiredSignature)
    }
}

/// Assert that the account is writable.
#[inline]
pub fn assert_writable(account: &AccountView) -> Result<(), ProgramError> {
    if account.is_writable() {
        Ok(())
    } else {
        Err(ProgramError::Immutable)
    }
}

/// Assert that the account is owned by the expected program.
#[inline]
pub fn assert_owner(account: &AccountView, expected_owner: &Address) -> Result<(), ProgramError> {
    if account.owned_by(expected_owner) {
        Ok(())
    } else {
        Err(ProgramError::InvalidAccountOwner)
    }
}

/// Assert that the account's address matches the expected PDA.
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
/// Solana allows up to 16 seeds (each up to 32 bytes). This helper uses a
/// fixed-size array to call `Address::derive_program_address` without the
/// const-generic limitation, supporting the full Solana seed limit.
fn derive_pda(seeds: &[&[u8]], program_id: &Address) -> Option<(Address, u8)> {
    const MAX_SEEDS: usize = 16;
    if seeds.len() > MAX_SEEDS {
        return None;
    }

    let mut arr: [&[u8]; MAX_SEEDS] = [&[]; MAX_SEEDS];
    for (i, seed) in seeds.iter().enumerate() {
        arr[i] = seed;
    }

    macro_rules! dispatch {
        ($n:expr) => {
            Address::derive_program_address(
                unsafe { core::mem::transmute::<&[&[u8]; MAX_SEEDS], &[&[u8]; $n]>(&arr) },
                program_id,
            )
        };
    }

    match seeds.len() {
        0 => dispatch!(0),
        1 => dispatch!(1),
        2 => dispatch!(2),
        3 => dispatch!(3),
        4 => dispatch!(4),
        5 => dispatch!(5),
        6 => dispatch!(6),
        7 => dispatch!(7),
        8 => dispatch!(8),
        9 => dispatch!(9),
        10 => dispatch!(10),
        11 => dispatch!(11),
        12 => dispatch!(12),
        13 => dispatch!(13),
        14 => dispatch!(14),
        15 => dispatch!(15),
        16 => dispatch!(16),
        _ => None,
    }
}

/// Assert that the first byte of account data matches the expected discriminator.
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
pub fn assert_rent_exempt(account: &AccountView) -> Result<(), ProgramError> {
    let min_balance = rent_exempt_minimum(account.data_len());
    if account.lamports() >= min_balance {
        Ok(())
    } else {
        Err(ProgramError::AccountNotRentExempt)
    }
}

/// Calculate minimum lamports for rent exemption.
#[inline]
const fn rent_exempt_minimum(data_len: usize) -> u64 {
    ((128 + data_len) as u64) * 3480 * 2
}

/// Assert that the account is NOT writable (read-only).
#[inline]
pub fn assert_readonly(account: &AccountView) -> Result<(), ProgramError> {
    if !account.is_writable() {
        Ok(())
    } else {
        Err(crate::error::GeppettoError::ExpectedReadonly.into())
    }
}

/// Assert that the account's address is the System Program.
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
#[inline]
pub fn assert_current_program(
    account: &AccountView,
    program_id: &Address,
) -> Result<(), ProgramError> {
    assert_owner(account, program_id)
}

/// Assert that the accounts slice has at least `expected` accounts.
#[inline]
pub fn assert_account_count(accounts: &[AccountView], expected: usize) -> Result<(), ProgramError> {
    if accounts.len() >= expected {
        Ok(())
    } else {
        Err(ProgramError::NotEnoughAccountKeys)
    }
}

/// Assert that the account's address matches the expected Associated Token Account.
pub fn assert_ata(
    account: &AccountView,
    wallet: &Address,
    mint: &Address,
    token_program: &Address,
) -> Result<(), ProgramError> {
    let derived = derive_ata(wallet, mint, token_program);
    if account.address() == &derived {
        Ok(())
    } else {
        Err(crate::error::GeppettoError::PdaMismatch.into())
    }
}

/// Derive an Associated Token Account address.
fn derive_ata(wallet: &Address, mint: &Address, token_program: &Address) -> Address {
    let seeds: &[&[u8]] = &[wallet.as_ref(), token_program.as_ref(), mint.as_ref()];
    let (addr, _) = derive_pda(seeds, &ATA_PROGRAM_ID).expect("ATA seeds are always valid");
    addr
}

/// Associated Token Account Program ID: ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL
pub const ATA_PROGRAM_ID: Address = Address::new_from_array([
    0x8c, 0x97, 0x25, 0x8f, 0x4e, 0x24, 0x89, 0xf1,
    0xbb, 0x3d, 0x10, 0x29, 0x14, 0x8e, 0x0d, 0x83,
    0x0b, 0x5a, 0x13, 0x99, 0xda, 0xff, 0x10, 0x84,
    0x04, 0x8e, 0x7b, 0xd8, 0xdb, 0xe9, 0xf8, 0x59,
]);

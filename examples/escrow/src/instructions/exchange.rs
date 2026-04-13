use geppetto::account::AccountView;
use geppetto::address::Address;
use geppetto::guard;
use geppetto::schema::AccountSchema;
use geppetto::ProgramResult;
use geppetto::error::ProgramError;

use crate::error::EscrowError;
use crate::state::{escrow_seeds, status, Escrow};

/// Exchange — taker fulfills the escrow.
///
/// Accounts:
/// 0. `[signer, writable]` Taker
/// 1. `[writable]`         Escrow PDA
/// 2. `[]`                 Maker (read-only, for PDA derivation)
///
/// Data: none
pub fn process(
    program_id: &Address,
    accounts: &mut [AccountView],
    _data: &[u8],
) -> ProgramResult {
    // ── 1. Parse accounts ──
    let [taker, escrow, maker, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // ── 2. Guard checks ──
    guard::assert_signer(taker)?;
    guard::assert_writable(taker)?;
    guard::assert_writable(escrow)?;
    guard::assert_owner(escrow, program_id)?;
    guard::assert_pda(escrow, &escrow_seeds(maker.address()), program_id)?;
    guard::assert_discriminator(escrow, Escrow::DISCRIMINATOR.unwrap_or(0))?;

    // ── 3. Validate escrow status ──
    let mut escrow_data = escrow.try_borrow_mut()?;
    if escrow_data[Escrow::STATUS_OFFSET] != status::OPEN {
        return Err(EscrowError::InvalidStatus.into());
    }

    // ── 4. Write taker + update status ──
    escrow_data[Escrow::TAKER_OFFSET..Escrow::TAKER_OFFSET + 32]
        .copy_from_slice(taker.address().as_ref());
    escrow_data[Escrow::STATUS_OFFSET] = status::EXCHANGED;

    // NOTE: In a real escrow, token CPIs would happen here.
    // Omitted for simplicity — this demo focuses on Geppetto conventions.

    Ok(())
}

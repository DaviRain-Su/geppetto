use geppetto::account::AccountView;
use geppetto::address::Address;
use geppetto::guard;
use geppetto::idioms;
use geppetto::schema::AccountSchema;
use geppetto::ProgramResult;
use geppetto::error::ProgramError;

use crate::error::EscrowError;
use crate::state::{escrow_seeds, status, Escrow};

/// Create a new escrow.
///
/// Accounts:
/// 0. `[signer, writable]` Maker — the escrow creator
/// 1. `[writable]`         Escrow PDA — derived from ["escrow", maker]
///
/// Data:
/// `[0..8]` amount (u64 LE) — the amount to escrow
pub fn process(
    program_id: &Address,
    accounts: &mut [AccountView],
    data: &[u8],
) -> ProgramResult {
    // ── 1. Parse accounts ──
    let [maker, escrow, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // ── 2. Guard checks ──
    guard::assert_signer(maker)?;
    guard::assert_writable(maker)?;
    guard::assert_writable(escrow)?;
    let _bump = guard::assert_pda(escrow, &escrow_seeds(maker.address()), program_id)?;
    guard::assert_owner(escrow, program_id)?;

    // ── 3. Parse instruction data ──
    let amount = idioms::read_u64_le(data, 0)?;
    if amount == 0 {
        return Err(EscrowError::ZeroAmount.into());
    }

    // ── 4. Write escrow data ──
    let mut escrow_data = escrow.try_borrow_mut()?;

    if escrow_data.len() < Escrow::LEN {
        return Err(ProgramError::AccountDataTooSmall);
    }

    escrow_data[Escrow::DISCRIMINATOR_OFFSET] = Escrow::DISCRIMINATOR.unwrap_or(0);
    escrow_data[Escrow::STATUS_OFFSET] = status::OPEN;
    escrow_data[Escrow::MAKER_OFFSET..Escrow::MAKER_OFFSET + 32]
        .copy_from_slice(maker.address().as_ref());
    escrow_data[Escrow::TAKER_OFFSET..Escrow::TAKER_OFFSET + 32].fill(0);
    idioms::write_u64_le(&mut escrow_data, Escrow::AMOUNT_OFFSET, amount)?;

    Ok(())
}

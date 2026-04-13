use geppetto::account::AccountView;
use geppetto::address::Address;
use geppetto::guard;
use geppetto::idioms;
use geppetto::schema::AccountSchema;
use geppetto::ProgramResult;
use pinocchio::error::ProgramError;

use crate::error::EscrowError;
use crate::state::{escrow_seeds, status, Escrow};

/// Close — maker cancels the escrow and reclaims lamports.
///
/// Accounts:
/// 0. `[signer, writable]` Maker
/// 1. `[writable]`         Escrow PDA
///
/// Data: none
pub fn process(
    program_id: &Address,
    accounts: &mut [AccountView],
    _data: &[u8],
) -> ProgramResult {
    // ── 1. Parse accounts ──
    let [maker, escrow, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // ── 2. Guard checks ──
    guard::assert_signer(maker)?;
    guard::assert_writable(maker)?;
    guard::assert_writable(escrow)?;
    guard::assert_owner(escrow, program_id)?;
    guard::assert_pda(escrow, &escrow_seeds(maker.address()), program_id)?;
    guard::assert_discriminator(escrow, Escrow::DISCRIMINATOR.unwrap_or(0))?;

    // ── 3. Validate escrow status — only open escrows can be closed ──
    {
        let escrow_data = escrow.try_borrow()?;
        if escrow_data[Escrow::STATUS_OFFSET] != status::OPEN {
            return Err(EscrowError::InvalidStatus.into());
        }

        // Verify maker matches
        let stored_maker = idioms::read_address(&escrow_data, Escrow::MAKER_OFFSET)?;
        if &stored_maker != maker.address() {
            return Err(ProgramError::InvalidAccountOwner);
        }
    }

    // ── 4. Close account safely ──
    idioms::close_account(escrow, maker)?;

    Ok(())
}

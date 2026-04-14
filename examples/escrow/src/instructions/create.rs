use geppetto::account::AccountView;
use geppetto::address::Address;
use geppetto::cpi::{Seed, Signer};
use geppetto::error::ProgramError;
use geppetto::guard;
use geppetto::idioms;
use geppetto::schema::AccountSchema;
use geppetto::system;
use geppetto::ProgramResult;

use crate::error::EscrowError;
use crate::state::{escrow_seeds, status, Escrow};

/// Create a new escrow.
///
/// Accounts:
/// 0. `[signer, writable]` Maker — the escrow creator / rent payer
/// 1. `[writable]`         Escrow PDA — derived from ["escrow", maker]
///
/// Behavior:
/// - If `escrow` is an empty system-owned PDA account, this instruction creates
///   it via `geppetto::system::create_account_with_minimum_balance_signed` and
///   then initializes its data.
/// - If `escrow` is already program-owned, it must be a zeroed, pre-allocated
///   buffer (useful for unit tests and fixtures); non-zero state is rejected.
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
    let bump = guard::assert_pda(escrow, &escrow_seeds(maker.address()), program_id)?;

    // ── 3. Parse instruction data ──
    let amount = idioms::read_u64_le(data, 0)?;
    if amount == 0 {
        return Err(EscrowError::ZeroAmount.into());
    }

    // ── 4. Ensure escrow account exists and is uninitialized ──
    if escrow.owned_by(&guard::SYSTEM_PROGRAM_ID) {
        if escrow.lamports() != 0 || escrow.data_len() != 0 {
            return Err(EscrowError::AlreadyInitialized.into());
        }

        let bump_seed = [bump];
        let signer_seeds = [
            Seed::from(b"escrow"),
            Seed::from(maker.address().as_ref()),
            Seed::from(&bump_seed),
        ];
        let signer = Signer::from(&signer_seeds);

        system::create_account_with_minimum_balance_signed(
            escrow,
            Escrow::LEN,
            program_id,
            maker,
            None,
            &[signer],
        )?;
    } else if !escrow.owned_by(program_id) {
        return Err(ProgramError::InvalidAccountOwner);
    }

    // ── 5. Write escrow data ──
    let escrow_lamports = escrow.lamports();
    let mut escrow_data = escrow.try_borrow_mut()?;

    if escrow_data.len() != Escrow::LEN {
        return Err(EscrowError::AlreadyInitialized.into());
    }

    if escrow_lamports == 0 || escrow_data.iter().any(|&b| b != 0) {
        return Err(EscrowError::AlreadyInitialized.into());
    }

    escrow_data[Escrow::DISCRIMINATOR_OFFSET] = Escrow::DISCRIMINATOR.unwrap_or(0);
    escrow_data[Escrow::STATUS_OFFSET] = status::OPEN;
    escrow_data[Escrow::MAKER_OFFSET..Escrow::MAKER_OFFSET + 32]
        .copy_from_slice(maker.address().as_ref());
    escrow_data[Escrow::TAKER_OFFSET..Escrow::TAKER_OFFSET + 32].fill(0);
    idioms::write_u64_le(&mut escrow_data, Escrow::AMOUNT_OFFSET, amount)?;

    Ok(())
}

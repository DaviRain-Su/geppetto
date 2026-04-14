//! Integration tests for the Geppetto Escrow example program.
//!
//! These tests validate the instruction handlers using mock AccountView objects.
//! PDA-dependent tests use pre-computed PDA addresses.

extern crate alloc;

use geppetto::account::{AccountView, RuntimeAccount};
use geppetto::address::Address;
use geppetto::error::ProgramError;
use geppetto::schema::AccountSchema;
use geppetto_escrow::state::{status, Escrow};

// ── Program ID (arbitrary for testing) ──
const PROGRAM_ID: [u8; 32] = [1u8; 32];

// ── Mock AccountView builder ──

fn mock_account_view(
    key: [u8; 32],
    owner: [u8; 32],
    lamports: u64,
    data: &[u8],
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

/// Derive the escrow PDA for a given maker and program_id.
fn derive_escrow_pda(maker_key: &[u8; 32], program_id: &[u8; 32]) -> ([u8; 32], u8) {
    let program = Address::new_from_array(*program_id);
    let (addr, bump) = Address::derive_program_address(
        &[b"escrow", maker_key.as_ref()],
        &program,
    )
    .expect("PDA derivation should succeed");
    let addr_slice: &[u8] = addr.as_ref();
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(addr_slice);
    (bytes, bump)
}

// ── Tests: Create instruction ──

#[test]
fn test_create_happy_path() {
    let maker_key = [2u8; 32];
    let (escrow_key, _bump) = derive_escrow_pda(&maker_key, &PROGRAM_ID);

    let escrow_data = vec![0u8; Escrow::LEN];
    let amount: u64 = 1_000_000;
    let instruction_data = amount.to_le_bytes();

    let mut accounts = [
        // maker: signer + writable
        mock_account_view(maker_key, [0u8; 32], 10_000_000, &[], true, true),
        // escrow PDA: writable, owned by program
        mock_account_view(escrow_key, PROGRAM_ID, 1_000_000, &escrow_data, false, true),
    ];

    let program_id = Address::new_from_array(PROGRAM_ID);
    let result = geppetto_escrow::instructions::create::process(
        &program_id,
        &mut accounts,
        &instruction_data,
    );

    assert!(result.is_ok(), "create should succeed: {:?}", result);

    // Verify escrow data was written
    let data = accounts[1].try_borrow().unwrap();
    assert_eq!(data[Escrow::DISCRIMINATOR_OFFSET], 1, "discriminator should be 1");
    assert_eq!(data[Escrow::STATUS_OFFSET], status::OPEN, "status should be OPEN");
    assert_eq!(
        &data[Escrow::MAKER_OFFSET..Escrow::MAKER_OFFSET + 32],
        &maker_key,
        "maker should match"
    );
    assert_eq!(
        &data[Escrow::TAKER_OFFSET..Escrow::TAKER_OFFSET + 32],
        &[0u8; 32],
        "taker should be zeroed"
    );
    let stored_amount = u64::from_le_bytes(
        data[Escrow::AMOUNT_OFFSET..Escrow::AMOUNT_OFFSET + 8]
            .try_into()
            .unwrap(),
    );
    assert_eq!(stored_amount, amount, "amount should match");
}

#[test]
fn test_create_zero_amount_fails() {
    let maker_key = [2u8; 32];
    let (escrow_key, _bump) = derive_escrow_pda(&maker_key, &PROGRAM_ID);

    let escrow_data = vec![0u8; Escrow::LEN];
    let instruction_data = 0u64.to_le_bytes(); // zero amount

    let mut accounts = [
        mock_account_view(maker_key, [0u8; 32], 10_000_000, &[], true, true),
        mock_account_view(escrow_key, PROGRAM_ID, 1_000_000, &escrow_data, false, true),
    ];

    let program_id = Address::new_from_array(PROGRAM_ID);
    let result = geppetto_escrow::instructions::create::process(
        &program_id,
        &mut accounts,
        &instruction_data,
    );

    assert!(result.is_err(), "zero amount should fail");
    assert_eq!(result.unwrap_err(), ProgramError::Custom(0x101)); // EscrowError::ZeroAmount
}

#[test]
fn test_create_reinitialize_fails() {
    let maker_key = [2u8; 32];
    let (escrow_key, _bump) = derive_escrow_pda(&maker_key, &PROGRAM_ID);

    let mut escrow_data = vec![0u8; Escrow::LEN];
    escrow_data[Escrow::DISCRIMINATOR_OFFSET] = 1;
    escrow_data[Escrow::STATUS_OFFSET] = status::OPEN;
    let instruction_data = 1_000_000u64.to_le_bytes();

    let mut accounts = [
        mock_account_view(maker_key, [0u8; 32], 10_000_000, &[], true, true),
        mock_account_view(escrow_key, PROGRAM_ID, 1_000_000, &escrow_data, false, true),
    ];

    let program_id = Address::new_from_array(PROGRAM_ID);
    let result = geppetto_escrow::instructions::create::process(
        &program_id,
        &mut accounts,
        &instruction_data,
    );

    assert_eq!(result, Err(ProgramError::Custom(0x102))); // EscrowError::AlreadyInitialized
}

#[test]
fn test_create_closed_account_cannot_reinitialize() {
    let maker_key = [2u8; 32];
    let (escrow_key, _bump) = derive_escrow_pda(&maker_key, &PROGRAM_ID);

    let escrow_data = vec![0u8; Escrow::LEN];
    let instruction_data = 1_000_000u64.to_le_bytes();

    let mut accounts = [
        mock_account_view(maker_key, [0u8; 32], 10_000_000, &[], true, true),
        // program-owned + zero lamports simulates a previously closed drained account
        mock_account_view(escrow_key, PROGRAM_ID, 0, &escrow_data, false, true),
    ];

    let program_id = Address::new_from_array(PROGRAM_ID);
    let result = geppetto_escrow::instructions::create::process(
        &program_id,
        &mut accounts,
        &instruction_data,
    );

    assert_eq!(result, Err(ProgramError::Custom(0x102))); // EscrowError::AlreadyInitialized
}

#[test]
fn test_create_not_signer_fails() {
    let maker_key = [2u8; 32];
    let (escrow_key, _bump) = derive_escrow_pda(&maker_key, &PROGRAM_ID);

    let escrow_data = vec![0u8; Escrow::LEN];
    let instruction_data = 1_000_000u64.to_le_bytes();

    let mut accounts = [
        // maker: NOT signer
        mock_account_view(maker_key, [0u8; 32], 10_000_000, &[], false, true),
        mock_account_view(escrow_key, PROGRAM_ID, 1_000_000, &escrow_data, false, true),
    ];

    let program_id = Address::new_from_array(PROGRAM_ID);
    let result = geppetto_escrow::instructions::create::process(
        &program_id,
        &mut accounts,
        &instruction_data,
    );

    assert_eq!(result, Err(ProgramError::MissingRequiredSignature));
}

#[test]
fn test_create_not_enough_accounts() {
    let instruction_data = 1_000_000u64.to_le_bytes();
    let mut accounts = [
        mock_account_view([2u8; 32], [0u8; 32], 10_000_000, &[], true, true),
        // missing escrow account
    ];

    let program_id = Address::new_from_array(PROGRAM_ID);
    let result = geppetto_escrow::instructions::create::process(
        &program_id,
        &mut accounts[..1], // only 1 account
        &instruction_data,
    );

    assert_eq!(result, Err(ProgramError::NotEnoughAccountKeys));
}

// ── Tests: Exchange instruction ──

#[test]
fn test_exchange_happy_path() {
    let maker_key = [2u8; 32];
    let taker_key = [3u8; 32];
    let (escrow_key, _bump) = derive_escrow_pda(&maker_key, &PROGRAM_ID);

    // Pre-populate escrow with Create state
    let mut escrow_data = vec![0u8; Escrow::LEN];
    escrow_data[Escrow::DISCRIMINATOR_OFFSET] = 1; // discriminator
    escrow_data[Escrow::STATUS_OFFSET] = status::OPEN;
    escrow_data[Escrow::MAKER_OFFSET..Escrow::MAKER_OFFSET + 32].copy_from_slice(&maker_key);

    let mut accounts = [
        // taker: signer + writable
        mock_account_view(taker_key, [0u8; 32], 10_000_000, &[], true, true),
        // escrow: writable, owned by program, with data
        mock_account_view(escrow_key, PROGRAM_ID, 1_000_000, &escrow_data, false, true),
        // maker: read-only (for PDA derivation)
        mock_account_view(maker_key, [0u8; 32], 10_000_000, &[], false, false),
    ];

    let program_id = Address::new_from_array(PROGRAM_ID);
    let result = geppetto_escrow::instructions::exchange::process(
        &program_id,
        &mut accounts,
        &[],
    );

    assert!(result.is_ok(), "exchange should succeed: {:?}", result);

    // Verify taker was written and status updated
    let data = accounts[1].try_borrow().unwrap();
    assert_eq!(data[Escrow::STATUS_OFFSET], status::EXCHANGED);
    assert_eq!(
        &data[Escrow::TAKER_OFFSET..Escrow::TAKER_OFFSET + 32],
        &taker_key,
    );
}

#[test]
fn test_exchange_already_exchanged_fails() {
    let maker_key = [2u8; 32];
    let taker_key = [3u8; 32];
    let (escrow_key, _bump) = derive_escrow_pda(&maker_key, &PROGRAM_ID);

    let mut escrow_data = vec![0u8; Escrow::LEN];
    escrow_data[Escrow::DISCRIMINATOR_OFFSET] = 1;
    escrow_data[Escrow::STATUS_OFFSET] = status::EXCHANGED; // already exchanged

    let mut accounts = [
        mock_account_view(taker_key, [0u8; 32], 10_000_000, &[], true, true),
        mock_account_view(escrow_key, PROGRAM_ID, 1_000_000, &escrow_data, false, true),
        mock_account_view(maker_key, [0u8; 32], 10_000_000, &[], false, false),
    ];

    let program_id = Address::new_from_array(PROGRAM_ID);
    let result = geppetto_escrow::instructions::exchange::process(
        &program_id,
        &mut accounts,
        &[],
    );

    assert_eq!(result, Err(ProgramError::Custom(0x100))); // InvalidStatus
}

// ── Tests: Close instruction ──

#[test]
fn test_close_happy_path() {
    let maker_key = [2u8; 32];
    let (escrow_key, _bump) = derive_escrow_pda(&maker_key, &PROGRAM_ID);

    let mut escrow_data = vec![0u8; Escrow::LEN];
    escrow_data[Escrow::DISCRIMINATOR_OFFSET] = 1;
    escrow_data[Escrow::STATUS_OFFSET] = status::OPEN;
    escrow_data[Escrow::MAKER_OFFSET..Escrow::MAKER_OFFSET + 32].copy_from_slice(&maker_key);
    // Set some lamports on escrow
    let escrow_lamports = 5_000_000u64;
    let maker_lamports = 10_000_000u64;

    let mut accounts = [
        mock_account_view(maker_key, [0u8; 32], maker_lamports, &[], true, true),
        mock_account_view(escrow_key, PROGRAM_ID, escrow_lamports, &escrow_data, false, true),
    ];

    let program_id = Address::new_from_array(PROGRAM_ID);
    let result = geppetto_escrow::instructions::close::process(
        &program_id,
        &mut accounts,
        &[],
    );

    assert!(result.is_ok(), "close should succeed: {:?}", result);

    // Verify escrow was drained
    assert_eq!(accounts[1].lamports(), 0, "escrow lamports should be 0");
    assert_eq!(
        accounts[0].lamports(),
        maker_lamports + escrow_lamports,
        "maker should receive escrow lamports"
    );

    // Verify data was zeroed
    let data = accounts[1].try_borrow().unwrap();
    assert!(data.iter().all(|&b| b == 0), "escrow data should be all zeros");
}

#[test]
fn test_close_wrong_maker_fails() {
    let maker_key = [2u8; 32];
    let wrong_maker_key = [9u8; 32];
    let (escrow_key, _bump) = derive_escrow_pda(&maker_key, &PROGRAM_ID);

    let mut escrow_data = vec![0u8; Escrow::LEN];
    escrow_data[Escrow::DISCRIMINATOR_OFFSET] = 1;
    escrow_data[Escrow::STATUS_OFFSET] = status::OPEN;
    escrow_data[Escrow::MAKER_OFFSET..Escrow::MAKER_OFFSET + 32].copy_from_slice(&maker_key);

    // Note: wrong_maker_key won't match PDA derivation either,
    // so assert_pda will fail before the maker check.
    // This tests the PDA guard path.
    let (_wrong_escrow_key, _) = derive_escrow_pda(&wrong_maker_key, &PROGRAM_ID);

    let mut accounts = [
        mock_account_view(wrong_maker_key, [0u8; 32], 10_000_000, &[], true, true),
        mock_account_view(escrow_key, PROGRAM_ID, 5_000_000, &escrow_data, false, true),
    ];

    let program_id = Address::new_from_array(PROGRAM_ID);
    let result = geppetto_escrow::instructions::close::process(
        &program_id,
        &mut accounts,
        &[],
    );

    assert!(result.is_err(), "close with wrong maker should fail");
}

// ── Tests: Dispatch ──

#[test]
fn test_dispatch_invalid_tag() {
    let mut accounts = [];
    let program_id = Address::new_from_array(PROGRAM_ID);

    // Tag 99 is not a valid instruction
    let result = geppetto_escrow::processor::dispatch(
        &program_id,
        &mut accounts,
        &[99],
    );

    assert_eq!(result, Err(ProgramError::InvalidInstructionData));
}

#[test]
fn test_dispatch_empty_data() {
    let mut accounts = [];
    let program_id = Address::new_from_array(PROGRAM_ID);

    let result = geppetto_escrow::processor::dispatch(
        &program_id,
        &mut accounts,
        &[],
    );

    assert_eq!(result, Err(ProgramError::InvalidInstructionData));
}

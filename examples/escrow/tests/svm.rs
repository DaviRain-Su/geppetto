//! SVM-level integration tests for the Geppetto Escrow program.
//!
//! These tests run the compiled SBF program through mollusk-svm,
//! validating instruction behavior against the actual Solana runtime.
//!
//! Prerequisites: `cargo build-sbf` must be run before these tests.

use geppetto::schema::AccountSchema;
use geppetto_escrow::state::{status, Escrow};
use mollusk_svm::{result::Check, Mollusk};
use solana_account::Account;
use solana_instruction::{AccountMeta, Instruction};
use solana_pubkey::Pubkey;

// ── Constants ──

const PROGRAM_ID_BYTES: [u8; 32] = [1u8; 32];

fn program_id() -> Pubkey {
    Pubkey::new_from_array(PROGRAM_ID_BYTES)
}

fn setup_mollusk() -> Mollusk {
    // Load pre-compiled SBF binary. Requires `cargo build-sbf` first.
    let elf = include_bytes!("../target/deploy/geppetto_escrow.so");
    let pid = program_id();
    // BPF Loader v3 (upgradeable loader) program ID
    let loader_v3 = solana_pubkey::pubkey!("BPFLoaderUpgradeab1e11111111111111111111111");
    let mut mollusk = Mollusk::default();
    mollusk.add_program_with_loader_and_elf(&pid, &loader_v3, elf);
    mollusk
}

/// Derive the escrow PDA using the same seeds as the program.
fn derive_escrow_pda(maker: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"escrow", maker.as_ref()], &program_id())
}

/// Build an empty escrow account (program-owned, with LEN bytes).
fn escrow_account(lamports: u64) -> Account {
    Account {
        lamports,
        data: vec![0u8; Escrow::LEN],
        owner: program_id(),
        executable: false,
        rent_epoch: 0,
    }
}

/// Build instruction data: [tag] ++ [payload]
fn build_ix_data(tag: u8, payload: &[u8]) -> Vec<u8> {
    let mut data = vec![tag];
    data.extend_from_slice(payload);
    data
}

// ── Create Tests ──

#[test]
fn test_svm_create_happy() {
    let mollusk = setup_mollusk();
    let maker = Pubkey::new_unique();
    let (escrow_pda, _bump) = derive_escrow_pda(&maker);

    let amount: u64 = 1_000_000;
    let ix = Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(maker, true),         // signer + writable
            AccountMeta::new(escrow_pda, false),    // writable
        ],
        data: build_ix_data(0, &amount.to_le_bytes()),
    };

    let accounts = vec![
        (maker, Account::default()),
        (escrow_pda, escrow_account(1_000_000)),
    ];

    let result = mollusk.process_instruction(&ix, &accounts);

    // Check success
    assert!(
        !result.program_result.is_err(),
        "create should succeed: {:?}",
        result.program_result
    );

    // Verify escrow state
    let escrow_post = &result.resulting_accounts[1].1;
    assert_eq!(escrow_post.data[Escrow::DISCRIMINATOR_OFFSET], 1);
    assert_eq!(escrow_post.data[Escrow::STATUS_OFFSET], status::OPEN);
    assert_eq!(
        &escrow_post.data[Escrow::MAKER_OFFSET..Escrow::MAKER_OFFSET + 32],
        maker.as_ref()
    );
    let stored = u64::from_le_bytes(
        escrow_post.data[Escrow::AMOUNT_OFFSET..Escrow::AMOUNT_OFFSET + 8]
            .try_into()
            .unwrap(),
    );
    assert_eq!(stored, amount);
}

#[test]
fn test_svm_create_zero_amount() {
    let mollusk = setup_mollusk();
    let maker = Pubkey::new_unique();
    let (escrow_pda, _) = derive_escrow_pda(&maker);

    let ix = Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(maker, true),
            AccountMeta::new(escrow_pda, false),
        ],
        data: build_ix_data(0, &0u64.to_le_bytes()),
    };

    let accounts = vec![
        (maker, Account::default()),
        (escrow_pda, escrow_account(1_000_000)),
    ];

    // EscrowError::ZeroAmount = 0x101
    mollusk.process_and_validate_instruction(
        &ix,
        &accounts,
        &[Check::err(solana_program_error::ProgramError::Custom(0x101))],
    );
}

#[test]
fn test_svm_create_missing_signer() {
    let mollusk = setup_mollusk();
    let maker = Pubkey::new_unique();
    let (escrow_pda, _) = derive_escrow_pda(&maker);

    let ix = Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(maker, false), // NOT a signer
            AccountMeta::new(escrow_pda, false),
        ],
        data: build_ix_data(0, &1_000_000u64.to_le_bytes()),
    };

    let accounts = vec![
        (maker, Account::default()),
        (escrow_pda, escrow_account(1_000_000)),
    ];

    mollusk.process_and_validate_instruction(
        &ix,
        &accounts,
        &[Check::err(
            solana_program_error::ProgramError::MissingRequiredSignature,
        )],
    );
}

// ── Exchange Tests ──

#[test]
fn test_svm_exchange_happy() {
    let mollusk = setup_mollusk();
    let maker = Pubkey::new_unique();
    let taker = Pubkey::new_unique();
    let (escrow_pda, _) = derive_escrow_pda(&maker);

    // Pre-populate escrow data (as if Create already ran)
    let mut escrow_acc = escrow_account(1_000_000);
    escrow_acc.data[Escrow::DISCRIMINATOR_OFFSET] = 1;
    escrow_acc.data[Escrow::STATUS_OFFSET] = status::OPEN;
    escrow_acc.data[Escrow::MAKER_OFFSET..Escrow::MAKER_OFFSET + 32]
        .copy_from_slice(maker.as_ref());

    let ix = Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(taker, true),       // signer + writable
            AccountMeta::new(escrow_pda, false),  // writable
            AccountMeta::new_readonly(maker, false), // read-only
        ],
        data: build_ix_data(1, &[]),
    };

    let accounts = vec![
        (taker, Account::default()),
        (escrow_pda, escrow_acc),
        (maker, Account::default()),
    ];

    let result = mollusk.process_instruction(&ix, &accounts);
    assert!(
        !result.program_result.is_err(),
        "exchange should succeed: {:?}",
        result.program_result
    );

    let escrow_post = &result.resulting_accounts[1].1;
    assert_eq!(escrow_post.data[Escrow::STATUS_OFFSET], status::EXCHANGED);
    assert_eq!(
        &escrow_post.data[Escrow::TAKER_OFFSET..Escrow::TAKER_OFFSET + 32],
        taker.as_ref()
    );
}

// ── Close Tests ──

#[test]
fn test_svm_close_happy() {
    let mollusk = setup_mollusk();
    let maker = Pubkey::new_unique();
    let (escrow_pda, _) = derive_escrow_pda(&maker);

    let mut escrow_acc = escrow_account(5_000_000);
    escrow_acc.data[Escrow::DISCRIMINATOR_OFFSET] = 1;
    escrow_acc.data[Escrow::STATUS_OFFSET] = status::OPEN;
    escrow_acc.data[Escrow::MAKER_OFFSET..Escrow::MAKER_OFFSET + 32]
        .copy_from_slice(maker.as_ref());

    let ix = Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(maker, true),
            AccountMeta::new(escrow_pda, false),
        ],
        data: build_ix_data(2, &[]),
    };

    let maker_acc = Account {
        lamports: 10_000_000,
        ..Account::default()
    };

    let accounts = vec![
        (maker, maker_acc),
        (escrow_pda, escrow_acc),
    ];

    let result = mollusk.process_instruction(&ix, &accounts);
    assert!(
        !result.program_result.is_err(),
        "close should succeed: {:?}",
        result.program_result
    );

    // Maker should have received escrow lamports
    let maker_post = &result.resulting_accounts[0].1;
    assert_eq!(maker_post.lamports, 10_000_000 + 5_000_000);

    // Escrow should be drained and zeroed
    let escrow_post = &result.resulting_accounts[1].1;
    assert_eq!(escrow_post.lamports, 0);
    assert!(
        escrow_post.data.iter().all(|&b| b == 0),
        "escrow data should be all zeros"
    );
}

// ── Dispatch Tests ──

#[test]
fn test_svm_invalid_instruction_tag() {
    let mollusk = setup_mollusk();

    let ix = Instruction {
        program_id: program_id(),
        accounts: vec![],
        data: vec![99], // invalid tag
    };

    mollusk.process_and_validate_instruction(
        &ix,
        &[],
        &[Check::err(
            solana_program_error::ProgramError::InvalidInstructionData,
        )],
    );
}

#[test]
fn test_svm_empty_instruction_data() {
    let mollusk = setup_mollusk();

    let ix = Instruction {
        program_id: program_id(),
        accounts: vec![],
        data: vec![],
    };

    mollusk.process_and_validate_instruction(
        &ix,
        &[],
        &[Check::err(
            solana_program_error::ProgramError::InvalidInstructionData,
        )],
    );
}

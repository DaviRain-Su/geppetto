//! # Testing Utilities
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-14
//! > **Verified against**: Solana 2.2.x, mollusk-svm 0.12, litesvm 0.11
//!
//! Helpers for testing Pinocchio programs. Enable with:
//! `geppetto = { features = ["test-utils"] }`
//!
//! ## Testing Strategy
//!
//! Use a three-tier approach:
//!
//! 1. **Unit tests** — mock `AccountView` for pure helpers (`guard`, `idioms`).
//! 2. **mollusk-svm tests** — run compiled SBF against real Solana runtime.
//! 3. **litesvm tests** — full transaction simulation with stateful accounts.
//!
//! ## mollusk-svm vs litesvm
//!
//! | Framework | Best for | Speed | State |
//! |-----------|----------|-------|-------|
//! | mollusk-svm 0.12 | Single instruction, CU profiling | Very fast | Stateless per call |
//! | litesvm 0.11 | Multi-instruction flows, CPI chains | Fast | Stateful (accounts persist) |
//!
//! Official programs (memo, escrow, rewards) use mollusk-svm or litesvm.
//! Do **not** use `solana-program-test` — it is outdated for Pinocchio programs.
//!
//! ---
//!
//! # mollusk-svm: Complete Setup Guide
//!
//! ## Step 1: Build SBF first
//!
//! ```bash
//! cargo build-sbf --manifest-path program/Cargo.toml
//! ```
//!
//! This produces `program/target/deploy/your_program.so`.
//! mollusk-svm loads this compiled binary — it cannot compile inline.
//!
//! ## Step 2: Cargo.toml dev-dependencies
//!
//! ```toml
//! [dev-dependencies]
//! mollusk-svm = "0.12"
//! solana-account = "3"
//! solana-instruction = "3"
//! solana-pubkey = "4"
//! solana-program-error = "3"
//! ```
//!
//! ## Step 3: Setup mollusk instance
//!
//! Two ways to load your program:
//!
//! ```rust,ignore
//! use mollusk_svm::Mollusk;
//! use solana_pubkey::Pubkey;
//!
//! // Option A: Auto-resolve from target/deploy/ (requires standard workspace layout)
//! let mollusk = Mollusk::new(&program_id, "your_program_name");
//!
//! // Option B: Include bytes directly (works in any directory structure)
//! let elf = include_bytes!("../target/deploy/your_program.so");
//! let loader_v3 = solana_pubkey::pubkey!("BPFLoaderUpgradeab1e11111111111111111111111");
//! let mut mollusk = Mollusk::default();
//! mollusk.add_program_with_loader_and_elf(&program_id, &loader_v3, elf);
//! ```
//!
//! ## Step 4: Build and execute an instruction
//!
//! ```rust,ignore
//! use mollusk_svm::Mollusk;
//! use solana_account::Account;
//! use solana_instruction::{AccountMeta, Instruction};
//! use solana_pubkey::Pubkey;
//!
//! // Build instruction
//! let ix = Instruction {
//!     program_id,
//!     accounts: vec![
//!         AccountMeta::new(maker, true),        // signer + writable
//!         AccountMeta::new(escrow_pda, false),   // writable, not signer
//!         AccountMeta::new_readonly(mint, false), // read-only
//!     ],
//!     data: vec![0, /* instruction tag */ /* ...payload */ ],
//! };
//!
//! // Build account list: Vec<(Pubkey, Account)>
//! // Order MUST match the AccountMeta order above.
//! let accounts = vec![
//!     (maker, Account::default()),
//!     (escrow_pda, Account {
//!         lamports: 1_000_000,
//!         data: vec![0u8; 74],  // AccountSchema::LEN
//!         owner: program_id,
//!         executable: false,
//!         rent_epoch: 0,
//!     }),
//!     (mint, Account::default()),
//! ];
//!
//! // Execute
//! let result = mollusk.process_instruction(&ix, &accounts);
//! ```
//!
//! ## Step 5: Assert results
//!
//! ```rust,ignore
//! use mollusk_svm::result::Check;
//! use solana_program_error::ProgramError;
//!
//! // --- Method A: process_and_validate (declarative) ---
//! mollusk.process_and_validate_instruction(
//!     &ix,
//!     &accounts,
//!     &[Check::success()],
//! );
//!
//! // Expected error:
//! mollusk.process_and_validate_instruction(
//!     &ix,
//!     &accounts,
//!     &[Check::err(ProgramError::MissingRequiredSignature)],
//! );
//!
//! // Custom error code:
//! mollusk.process_and_validate_instruction(
//!     &ix,
//!     &accounts,
//!     &[Check::err(ProgramError::Custom(0x101))],
//! );
//!
//! // --- Method B: process_instruction (imperative) ---
//! let result = mollusk.process_instruction(&ix, &accounts);
//! assert!(!result.program_result.is_err());
//!
//! // Check resulting account state:
//! let escrow_post = &result.resulting_accounts[1].1; // index matches accounts vec
//! assert_eq!(escrow_post.data[0], 1);                // discriminator
//! assert_eq!(escrow_post.lamports, 1_000_000);
//!
//! // CU consumption:
//! println!("CU: {}", result.compute_units_consumed);
//! ```
//!
//! ## Step 6: PDA derivation in tests
//!
//! ```rust,ignore
//! // Use solana_pubkey for test-side PDA derivation:
//! let (escrow_pda, bump) = Pubkey::find_program_address(
//!     &[b"escrow", maker.as_ref()],
//!     &program_id,
//! );
//! ```
//!
//! Note: `solana_pubkey::Pubkey::find_program_address` requires the
//! `curve25519` feature on `solana-address` if you use `Address` directly.
//! In test code, prefer `solana_pubkey::Pubkey` for PDA derivation.
//!
//! ---
//!
//! # litesvm: Complete Setup Guide
//!
//! ## Cargo.toml
//!
//! ```toml
//! [dev-dependencies]
//! litesvm = "0.11"
//! solana-sdk = "3"
//! ```
//!
//! ## Setup and load program
//!
//! ```rust,ignore
//! use litesvm::LiteSVM;
//! use solana_sdk::{
//!     instruction::{AccountMeta, Instruction},
//!     pubkey::Pubkey,
//!     signature::{Keypair, Signer},
//!     transaction::Transaction,
//! };
//!
//! let mut svm = LiteSVM::new()
//!     .with_sysvars()
//!     .with_default_programs();
//!
//! // Load your compiled program
//! let elf = include_bytes!("../target/deploy/your_program.so");
//! svm.add_program(program_id, elf).unwrap();
//!
//! // Fund a payer account
//! let payer = Keypair::new();
//! svm.airdrop(&payer.pubkey(), 500_000_000).unwrap();
//! ```
//!
//! ## Send transaction
//!
//! ```rust,ignore
//! let ix = Instruction {
//!     program_id,
//!     accounts: vec![
//!         AccountMeta::new(payer.pubkey(), true),
//!         AccountMeta::new(escrow_pda, false),
//!     ],
//!     data: vec![0, /* ...payload */],
//! };
//!
//! let tx = Transaction::new_signed_with_payer(
//!     &[ix],
//!     Some(&payer.pubkey()),
//!     &[&payer],
//!     svm.latest_blockhash(),
//! );
//!
//! // Success:
//! let meta = svm.send_transaction(tx).expect("should succeed");
//! println!("CU: {}", meta.compute_units_consumed);
//!
//! // Expected failure:
//! let err = svm.send_transaction(tx).expect_err("should fail");
//! // err.err is TransactionError
//! ```
//!
//! ## Read account state after transaction
//!
//! ```rust,ignore
//! // litesvm persists state across transactions
//! let account = svm.get_account(&escrow_pda).unwrap();
//! assert_eq!(account.owner, program_id);
//! assert_eq!(account.data[0], 1); // discriminator
//! ```
//!
//! ## Pre-set account data
//!
//! ```rust,ignore
//! use solana_sdk::account::Account;
//!
//! svm.set_account(escrow_pda, Account {
//!     lamports: 1_000_000,
//!     data: vec![0u8; 74],
//!     owner: program_id,
//!     executable: false,
//!     rent_epoch: 0,
//! }).unwrap();
//! ```
//!
//! ## Multi-step test (stateful)
//!
//! ```rust,ignore
//! // litesvm keeps state between send_transaction calls:
//! // 1. Create escrow
//! svm.send_transaction(create_tx).unwrap();
//! // 2. Exchange (reads escrow created in step 1)
//! svm.send_transaction(exchange_tx).unwrap();
//! // 3. Verify final state
//! let escrow = svm.get_account(&escrow_pda).unwrap();
//! assert_eq!(escrow.data[1], 1); // status = EXCHANGED
//! ```
//!
//! ---
//!
//! # CU Profiling
//!
//! When using mollusk-svm, capture compute unit consumption to prevent
//! regressions:
//!
//! ```rust,ignore
//! let result = mollusk.process_instruction(&ix, &accounts);
//! let cu = result.compute_units_consumed;
//! assert!(cu < 5000, "instruction exceeded CU budget: {}", cu);
//! ```
//!
//! Typical CU ranges for Pinocchio programs:
//! - Simple state updates (no CPI): ~500-2000 CU
//! - Token CPI (transfer/mint): ~5000-15000 CU
//! - Complex multi-CPI flows: ~15000-50000 CU
//!
//! Set a CU budget ceiling in CI and fail the build if any instruction exceeds it.
//!
//! ---
//!
//! # Common Pitfalls
//!
//! 1. **Forgetting `cargo build-sbf` before `cargo test`** — both mollusk and
//!    litesvm need the compiled `.so`. Add a Makefile/justfile target.
//! 2. **Account order mismatch** — `AccountMeta` order in `Instruction` must
//!    match `(Pubkey, Account)` order in the accounts vec.
//! 3. **Using `solana-program-test`** — it doesn't support Pinocchio's
//!    `AccountView`. Use mollusk-svm or litesvm instead.
//! 4. **PDA derivation in tests** — use `solana_pubkey::Pubkey::find_program_address`,
//!    not `Address::derive_program_address` (which needs `curve25519` feature).
//! 5. **Program accounts are auto-stubbed** — mollusk automatically provides program
//!    accounts. Do NOT include your program's account in the `accounts` slice.
//!
//! ---
//!
//! # mollusk-svm 0.12 API Reference
//!
//! This section is a local reference so you do NOT need to web search.
//!
//! ## Mollusk constructors
//!
//! ```rust,ignore
//! // Auto-find ELF: searches tests/fixtures/, BPF_OUT_DIR, SBF_OUT_DIR, cwd
//! let mollusk = Mollusk::new(&program_id, "program_name");
//!
//! // Default (builtins only, no custom program)
//! let mut mollusk = Mollusk::default();
//!
//! // Then load ELF manually:
//! mollusk.add_program(&program_id, "program_name");                    // auto-find
//! mollusk.add_program_with_loader(&program_id, "name", &loader_key);   // specific loader
//! mollusk.add_program_with_loader_and_elf(&program_id, &loader_key, elf); // raw bytes
//! ```
//!
//! **Loader keys** (from `mollusk_svm::program`):
//! - `LOADER_V3` = BPF Loader Upgradeable (default, most common)
//! - `LOADER_V2` = BPF Loader
//! - `LOADER_V1` = deprecated
//!
//! ## Instruction processing methods
//!
//! ```rust,ignore
//! // Single instruction → InstructionResult
//! let result = mollusk.process_instruction(&ix, &accounts);
//!
//! // Single instruction + declarative checks (panics on failure)
//! mollusk.process_and_validate_instruction(&ix, &accounts, &[Check::success()]);
//!
//! // Chain: sequential instructions, state persists between them
//! let result = mollusk.process_instruction_chain(&[ix1, ix2], &accounts);
//!
//! // Transaction: all instructions in one context (atomic)
//! let result = mollusk.process_transaction_instructions(&[ix1, ix2], &accounts);
//! ```
//!
//! ## InstructionResult fields
//!
//! ```rust,ignore
//! result.compute_units_consumed  // u64
//! result.execution_time          // u64 (nanoseconds)
//! result.program_result          // ProgramResult::Success | Failure(ProgramError) | UnknownError
//! result.program_result.is_ok()  // bool
//! result.program_result.is_err() // bool
//! result.return_data             // Vec<u8>
//! result.resulting_accounts      // Vec<(Pubkey, Account)> — same order as input
//! result.get_account(&pubkey)    // Option<&Account>
//! ```
//!
//! ## Check variants (for process_and_validate_*)
//!
//! ```rust,ignore
//! use mollusk_svm::result::Check;
//!
//! Check::success()                              // instruction succeeded
//! Check::err(ProgramError::Custom(0x101))       // specific program error
//! Check::err(ProgramError::MissingRequiredSignature)
//! Check::instruction_err(InstructionError::...)  // instruction-level error
//! Check::compute_units(500)                     // exact CU match
//! Check::return_data(&[1, 2, 3])                // return data match
//!
//! // Account state checks (builder pattern):
//! Check::account(&pubkey)
//!     .lamports(1_000_000)
//!     .data(&expected_data)
//!     .owner(&program_id)
//!     .space(74)
//!     .data_slice(0, &[1])          // check byte at offset 0
//!     .closed()                      // account == Account::default()
//!     .rent_exempt()
//!     .build()
//! ```
//!
//! ## MolluskContext (stateful testing)
//!
//! For multi-step flows where account state should persist automatically:
//!
//! ```rust,ignore
//! use std::collections::HashMap;
//!
//! let mut store = HashMap::new();
//! store.insert(escrow_pda, escrow_account);
//! store.insert(maker, Account::default());
//!
//! let ctx = mollusk.with_context(store);
//!
//! // No accounts parameter needed — loaded from store automatically
//! ctx.process_and_validate_instruction(&create_ix, &[Check::success()]);
//! // State persists: escrow now has data from create
//! ctx.process_and_validate_instruction(&exchange_ix, &[Check::success()]);
//! ```
//!
//! ## Sysvars
//!
//! ```rust,ignore
//! mollusk.sysvars.clock.slot = 100;
//! mollusk.sysvars.clock.unix_timestamp = 1700000000;
//! mollusk.warp_to_slot(500); // updates Clock + SlotHashes
//! ```
//!
//! ## CU Benchmarking
//!
//! ```rust,ignore
//! use mollusk_svm_bencher::MolluskComputeUnitBencher;
//!
//! MolluskComputeUnitBencher::new(mollusk)
//!     .bench(("create", &create_ix, &accounts))
//!     .bench(("exchange", &exchange_ix, &accounts))
//!     .must_pass(true)
//!     .out_dir("../target/benches")
//!     .execute();
//! // Outputs markdown table with CU counts
//! ```
//!
//! ## Fixture support (feature = "fuzz")
//!
//! ```rust,ignore
//! // Auto-eject fixtures during tests:
//! // EJECT_FUZZ_FIXTURES="./fixtures" cargo test-sbf
//! // EJECT_FUZZ_FIXTURES_JSON="./fixtures" cargo test-sbf
//!
//! // Load and replay:
//! let fixture = Fixture::load_from_json_file("fixtures/create.json");
//! mollusk.process_and_validate_fixture(&fixture);
//! ```

/// Assert that account data at a given offset equals expected bytes.
pub fn assert_account_data(data: &[u8], offset: usize, expected: &[u8], field_name: &str) {
    let end = offset.checked_add(expected.len()).unwrap_or_else(|| {
        panic!(
            "field '{}': offset {} + len {} overflow",
            field_name,
            offset,
            expected.len()
        )
    });
    assert!(
        end <= data.len(),
        "field '{}': offset {}..{} out of bounds (data len = {})",
        field_name,
        offset,
        end,
        data.len()
    );
    assert_eq!(
        &data[offset..end],
        expected,
        "field '{}' at offset {} does not match",
        field_name,
        offset
    );
}

/// Assert that the first byte of data matches the expected discriminator.
pub fn assert_discriminator(data: &[u8], expected: u8) {
    assert!(
        !data.is_empty(),
        "account data is empty for discriminator: expected {}",
        expected
    );
    assert_eq!(
        data[0], expected,
        "discriminator mismatch: expected {}, got {}",
        expected, data[0]
    );
}

/// Assert a u64 LE value at offset matches expected.
pub fn assert_u64_le(data: &[u8], offset: usize, expected: u64, field_name: &str) {
    let actual = crate::idioms::read_u64_le(data, offset).expect("offset out of bounds");
    assert_eq!(
        actual, expected,
        "field '{}' at offset {}: expected {}, got {}",
        field_name, offset, expected, actual
    );
}

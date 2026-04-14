//! # mollusk-svm 0.12 Complete Guide
//!
//! > **Knowledge version**: geppetto 0.1.0 | mollusk-svm 0.12 | 2026-04-14
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
//! ```rust,ignore
//! use mollusk_svm::Mollusk;
//! use solana_pubkey::Pubkey;
//!
//! // Option A: Auto-resolve from target/deploy/
//! let mollusk = Mollusk::new(&program_id, "your_program_name");
//!
//! // Option B: Include bytes directly
//! let elf = include_bytes!("../target/deploy/your_program.so");
//! let loader_v3 = solana_pubkey::pubkey!("BPFLoaderUpgradeab1e11111111111111111111111");
//! let mut mollusk = Mollusk::default();
//! mollusk.add_program_with_loader_and_elf(&program_id, &loader_v3, elf);
//! ```
//!
//! ## Step 4: Build and execute an instruction
//!
//! ```rust,ignore
//! use solana_account::Account;
//! use solana_instruction::{AccountMeta, Instruction};
//!
//! let ix = Instruction {
//!     program_id,
//!     accounts: vec![
//!         AccountMeta::new(maker, true),         // signer + writable
//!         AccountMeta::new(escrow_pda, false),    // writable, not signer
//!         AccountMeta::new_readonly(mint, false),  // read-only
//!     ],
//!     data: vec![0, /* tag + payload */],
//! };
//!
//! // Order MUST match AccountMeta order above.
//! let accounts = vec![
//!     (maker, Account::default()),
//!     (escrow_pda, Account {
//!         lamports: 1_000_000,
//!         data: vec![0u8; 74],
//!         owner: program_id,
//!         executable: false,
//!         rent_epoch: 0,
//!     }),
//!     (mint, Account::default()),
//! ];
//!
//! let result = mollusk.process_instruction(&ix, &accounts);
//! ```
//!
//! ## Step 5: Assert results
//!
//! ```rust,ignore
//! use mollusk_svm::result::Check;
//! use solana_program_error::ProgramError;
//!
//! // Declarative:
//! mollusk.process_and_validate_instruction(&ix, &accounts, &[Check::success()]);
//! mollusk.process_and_validate_instruction(&ix, &accounts,
//!     &[Check::err(ProgramError::MissingRequiredSignature)]);
//! mollusk.process_and_validate_instruction(&ix, &accounts,
//!     &[Check::err(ProgramError::Custom(0x101))]);
//!
//! // Imperative:
//! let result = mollusk.process_instruction(&ix, &accounts);
//! assert!(!result.program_result.is_err());
//! let escrow_post = &result.resulting_accounts[1].1;
//! assert_eq!(escrow_post.data[0], 1);
//! println!("CU: {}", result.compute_units_consumed);
//! ```
//!
//! ## Step 6: PDA derivation in tests
//!
//! ```rust,ignore
//! let (escrow_pda, bump) = Pubkey::find_program_address(
//!     &[b"escrow", maker.as_ref()],
//!     &program_id,
//! );
//! ```
//!
//! ## API Reference
//!
//! ### Constructors
//! - `Mollusk::new(&program_id, "name")` — auto-find ELF
//! - `Mollusk::default()` — builtins only
//! - `mollusk.add_program(&pid, "name")` — add by name
//! - `mollusk.add_program_with_loader_and_elf(&pid, &loader, elf)` — raw bytes
//!
//! ### Processing
//! - `process_instruction(&ix, &accounts)` → `InstructionResult`
//! - `process_and_validate_instruction(&ix, &accounts, &[Check])` — panics on failure
//! - `process_instruction_chain(&[ix], &accounts)` — sequential, state persists
//! - `process_transaction_instructions(&[ix], &accounts)` → `TransactionResult` (atomic)
//!
//! ### InstructionResult fields
//! - `.compute_units_consumed` — u64
//! - `.execution_time` — u64 nanoseconds
//! - `.program_result` — `ProgramResult::Success | Failure | UnknownError`
//! - `.resulting_accounts` — `Vec<(Pubkey, Account)>` same order as input
//! - `.get_account(&pubkey)` — `Option<&Account>`
//!
//! ### Check variants
//! - `Check::success()`
//! - `Check::err(ProgramError::...)`
//! - `Check::compute_units(n)`
//! - `Check::return_data(&[u8])`
//! - `Check::account(&pubkey).lamports(n).data(d).owner(o).closed().rent_exempt().data_slice(off, d).build()`
//!
//! ### MolluskContext (stateful)
//! ```rust,ignore
//! let ctx = mollusk.with_context(HashMap::new());
//! ctx.process_and_validate_instruction(&ix, &[Check::success()]);
//! // state persists between calls
//! ```
//!
//! ### Sysvars
//! ```rust,ignore
//! mollusk.sysvars.clock.slot = 100;
//! mollusk.warp_to_slot(500);
//! ```
//!
//! ### CU Benchmarking
//! ```rust,ignore
//! use mollusk_svm_bencher::MolluskComputeUnitBencher;
//! MolluskComputeUnitBencher::new(mollusk)
//!     .bench(("create", &ix, &accounts))
//!     .must_pass(true)
//!     .out_dir("../target/benches")
//!     .execute();
//! ```
//!
//! ### Fixture support (feature = "fuzz")
//! ```rust,ignore
//! // Auto-eject: EJECT_FUZZ_FIXTURES="./fixtures" cargo test-sbf
//! let fixture = Fixture::load_from_json_file("fixtures/create.json");
//! mollusk.process_and_validate_fixture(&fixture);
//! ```

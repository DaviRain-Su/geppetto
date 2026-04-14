//! # litesvm 0.11 Complete Guide
//!
//! > **Knowledge version**: geppetto 0.1.0 | litesvm 0.11 | 2026-04-14
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
//! let elf = include_bytes!("../target/deploy/your_program.so");
//! svm.add_program(program_id, elf).unwrap();
//!
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
//! ```
//!
//! ## Read account state (stateful — persists across transactions)
//!
//! ```rust,ignore
//! let account = svm.get_account(&escrow_pda).unwrap();
//! assert_eq!(account.owner, program_id);
//! assert_eq!(account.data[0], 1);
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
//! ## Multi-step test
//!
//! ```rust,ignore
//! // litesvm keeps state between send_transaction calls:
//! svm.send_transaction(create_tx).unwrap();
//! svm.send_transaction(exchange_tx).unwrap();
//! let escrow = svm.get_account(&escrow_pda).unwrap();
//! assert_eq!(escrow.data[1], 1); // status = EXCHANGED
//! ```

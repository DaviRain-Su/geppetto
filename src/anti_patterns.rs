//! # Security Review Checklist
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-14
//! > **Verified against**: Solana 2.2.x
//!
//! This module documents high-impact vulnerabilities and how to fix them.
//! Use it as a **code review checklist**: before deployment, verify that your
//! instruction handlers satisfy all these guardrails.
//!
//! Key insight: Each vulnerability has a simple, idiomatic fix that Geppetto's
//! guard helpers enforce. This isn't optional polish — it's mandatory security.
//!
//! ---
//!
//! ## Missing Signer Check
//!
//! **Danger level**: Critical
//!
//! ### What goes wrong
//! Anyone can call an instruction that should require authorization,
//! because the code never verifies `account.is_signer()`.
//!
//! ### Wrong code
//! ```rust,ignore
//! // ❌ BAD: no signer check
//! fn process_create(accounts: &mut [AccountView]) -> ProgramResult {
//!     let [maker, ..] = accounts else { return Err(ProgramError::NotEnoughAccountKeys); };
//!     // maker could be any account — not necessarily a signer
//!     Ok(())
//! }
//! ```
//!
//! ### Correct code
//! ```rust,ignore
//! // ✅ GOOD: explicit signer guard
//! use geppetto::guard;
//! guard::assert_signer(maker)?;
//! ```
//!
//! ### How Geppetto prevents this
//! `guard::assert_signer` returns `MissingRequiredSignature` if the account is
//! not a signer. Every agent should use it on the first line of any
//! authorization-sensitive instruction.
//!
//! ---
//!
//! ## Unchecked Account Owner
//!
//! **Danger level**: Critical
//!
//! ### What goes wrong
//! An attacker passes an account owned by a different program with arbitrary
//! data. The code reads the data as if it were a trusted type.
//!
//! ### Wrong code
//! ```rust,ignore
//! // ❌ BAD: trusting account data without owner check
//! let data = account.try_borrow()?;
//! let state = unsafe { &*(data.as_ptr() as *const Escrow) };
//! ```
//!
//! ### Correct code
//! ```rust,ignore
//! // ✅ GOOD: validate owner before zero-copy cast
//! use geppetto::guard;
//! guard::assert_owner(account, program_id)?;
//! // or use AccountSchema::try_from_account
//! ```
//!
//! ### How Geppetto prevents this
//! `guard::assert_owner` and `AccountSchema::try_from_account` both enforce
//! ownership checks before any data is interpreted.
//!
//! ---
//!
//! ## PDA Seed Collision
//!
//! **Danger level**: High
//!
//! ### What goes wrong
//! Two different account types or use cases derive addresses from the same
//! seeds. An attacker can substitute one account for another.
//!
//! ### Wrong code
//! ```rust,ignore
//! // ❌ BAD: same seeds for escrow and user profile
//! let (escrow_pda, _) = Address::derive_program_address(&[b"state", user.as_ref()], program_id)?;
//! let (profile_pda, _) = Address::derive_program_address(&[b"state", user.as_ref()], program_id)?;
//! // Both PDAs are identical — collision!
//! ```
//!
//! ### Correct code
//! ```rust,ignore
//! // ✅ GOOD: unique prefix per account type
//! let (escrow_pda, _) = Address::derive_program_address(&[b"escrow", user.as_ref()], program_id)?;
//! let (profile_pda, _) = Address::derive_program_address(&[b"profile", user.as_ref()], program_id)?;
//! ```
//!
//! ### How Geppetto prevents this
//! `guard::assert_pda` validates that an account address matches the expected
//! seeds. Document seed prefixes in `AccountSchema` implementations so agents
//! always use unique, typed seeds.
//!
//! ---
//!
//! ## Close Account Without Zeroing Data
//!
//! **Danger level**: High
//!
//! ### What goes wrong
//! Draining lamports without clearing data leaves stale state on chain. The
//! account can be "resurrected" within the same transaction and misused.
//!
//! ### Wrong code
//! ```rust,ignore
//! // ❌ BAD: only drain lamports
//! recipient.set_lamports(recipient.lamports() + account.lamports());
//! account.set_lamports(0);
//! // data is still readable!
//! ```
//!
//! ### Correct code
//! ```rust,ignore
//! // ✅ GOOD: use the safe close helper
//! use geppetto::idioms;
//! idioms::close_account(account, recipient)?;
//! ```
//!
//! ### How Geppetto prevents this
//! `idioms::close_account` drains lamports **and** fills all data bytes with
//! zero before returning.
//!
//! ---
//!
//! ## Catch-All Dispatch (`_ => Ok(())`)
//!
//! **Danger level**: High
//!
//! ### What goes wrong
//! A match arm that silently accepts unknown instructions makes the program
//! ignore invalid or malicious input instead of rejecting it.
//!
//! ### Wrong code
//! ```rust,ignore
//! // ❌ BAD: silently accepting unknown instructions
//! match tag {
//!     0 => instructions::create::process(program_id, accounts, data),
//!     1 => instructions::exchange::process(program_id, accounts, data),
//!     _ => Ok(()), // dangerous!
//! }
//! ```
//!
//! ### Correct code
//! ```rust,ignore
//! // ✅ GOOD: explicit error for unknown instructions
//! match tag {
//!     0 => instructions::create::process(program_id, accounts, data),
//!     1 => instructions::exchange::process(program_id, accounts, data),
//!     _ => Err(ProgramError::InvalidInstructionData),
//! }
//! ```
//!
//! ### How Geppetto prevents this
//! `dispatch::split_tag` is designed to be used in an exhaustive match where
//! the `_` arm **must** return an error. This is documented as a hard rule in
//! every dispatch example.
//!
//! ---
//!
//! ## Unbounded Allocation
//!
//! **Danger level**: Medium
//!
//! ### What goes wrong
//! Using `Vec::push` in a loop or allocating based on user input can exhaust
//! compute units (CU) or hit the heap limit, causing non-deterministic
//! failures.
//!
//! ### Wrong code
//! ```rust,ignore
//! // ❌ BAD: unbounded Vec growth on-chain
//! let mut items = Vec::new();
//! for _ in 0..user_input_count {
//!     items.push(something); // CU explosion
//! }
//! ```
//!
//! ### Correct code
//! ```rust,ignore
//! // ✅ GOOD: fixed-size stack arrays or bounded loops
//! const MAX_ITEMS: usize = 10;
//! let mut items = [0u8; MAX_ITEMS];
//! for i in 0..MAX_ITEMS {
//!     items[i] = something;
//! }
//! ```
//!
//! ### How Geppetto prevents this
//! Geppetto is built `#![no_std]` with no allocator by default. All helpers
//! use fixed-size slices and checked arithmetic. If you need allocation,
//! explicitly opt in via the `alloc` feature and audit every `Vec` usage.
//!
//! ---
//!
//! ## `#[repr(C)]` Struct with Hidden Padding
//!
//! **Danger level**: High
//!
//! ### What goes wrong
//!
//! A `#[repr(C)]` struct with mixed-alignment fields gets invisible padding.
//! `u64` requires 8-byte alignment, so when the preceding fields leave the
//! offset misaligned, the compiler inserts padding bytes before it. The
//! struct's `size_of` won't match your expected byte layout, causing
//! `AccountSchema::LEN` mismatch and incorrect data reads.
//!
//! ### Wrong code
//! ```rust,ignore
//! // ❌ This struct has 6 bytes of hidden padding before `amount`!
//! #[repr(C)]
//! pub struct BadEscrow {
//!     pub discriminator: u8,    // 1 byte
//!     pub status: u8,           // 1 byte
//!     pub maker: [u8; 32],      // 32 bytes — alignment 1, no padding here
//!     pub taker: [u8; 32],      // 32 bytes
//!     pub amount: u64,          // 8 bytes — BUT u64 needs 8-byte alignment!
//!     // compiler inserts 6 bytes of padding before `amount`
//! }
//! // size_of::<BadEscrow>() = 80, NOT 74!
//! // assert_account_size! will catch this at compile time.
//! ```
//!
//! ### Correct code
//! ```rust,ignore
//! // ✅ Option A: Unit struct + offset constants (recommended)
//! // No #[repr(C)] needed, no padding possible.
//! pub struct Escrow;
//!
//! impl Escrow {
//!     pub const DISCRIMINATOR_OFFSET: usize = 0;  // u8
//!     pub const STATUS_OFFSET: usize = 1;         // u8
//!     pub const MAKER_OFFSET: usize = 2;          // [u8; 32]
//!     pub const TAKER_OFFSET: usize = 34;         // [u8; 32]
//!     pub const AMOUNT_OFFSET: usize = 66;        // u64 LE
//! }
//!
//! // ✅ Option B: #[repr(C)] with explicit padding field
//! #[repr(C)]
//! pub struct EscrowRepr {
//!     pub discriminator: u8,
//!     pub _padding: [u8; 7],  // explicit! makes padding visible
//!     pub value: u64,         // now aligned correctly
//! }
//! ```
//!
//! ### How Geppetto prevents this
//!
//! `assert_account_size!(MyStruct)` catches the mismatch at compile time.
//! If `size_of::<T>() != T::LEN`, the build fails with a clear message.
//! For maximum safety, prefer unit struct + offset constants (Option A)
//! which avoids `#[repr(C)]` alignment issues entirely.

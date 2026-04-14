//! # PDA Derivation
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-14
//!
//! ## `derive_program_address` (NOT `find_program_address`)
//!
//! **Pinocchio uses `Address::derive_program_address`, not `find_program_address`.**
//!
//! This is a const-generic API — it takes `&[&[u8]; N]` (fixed-size array),
//! NOT `&[&[u8]]` (slice). You must know the number of seeds at compile time.
//!
//! ```rust,ignore
//! use geppetto::address::Address;
//!
//! // ✅ Correct: fixed-size array
//! let (pda, bump) = Address::derive_program_address(
//!     &[b"escrow", maker.as_ref()],  // [&[u8]; 2]
//!     program_id,
//! ).ok_or(ProgramError::InvalidSeeds)?;
//!
//! // ❌ Wrong: this does NOT compile
//! // let seeds: &[&[u8]] = &[b"escrow", maker.as_ref()];
//! // Address::derive_program_address(seeds, program_id);
//! // Error: expected `&[&[u8]; N]`, found `&[&[u8]]`
//! ```
//!
//! Returns `Option<(Address, u8)>` — `None` if no valid bump found.
//!
//! If you need dynamic seed count (runtime-determined), use
//! `geppetto::guard::assert_pda()` which handles 0-15 seeds internally
//! via a match over all array sizes.
//!
//! **In tests**: use `solana_pubkey::Pubkey::find_program_address` instead,
//! which accepts `&[&[u8]]` slices. See `geppetto::testing` for details.
//!
//! ## PDA Validation Traits (rewards pattern)
//!
//! Rewards and escrow define PDA traits for typed PDA validation:
//!
//! ```rust,ignore
//! /// Trait for types that define their own PDA seeds.
//! pub trait PdaSeeds {
//!     fn pda_seeds(&self) -> Vec<&[u8]>;
//! }
//!
//! /// Trait for accounts that ARE PDAs.
//! pub trait PdaAccount: PdaSeeds {
//!     fn validate_pda(&self, account: &AccountView, program_id: &Address)
//!         -> Result<u8, ProgramError>
//!     {
//!         guard::assert_pda(account, &self.pda_seeds(), program_id)
//!     }
//! }
//! ```
//!
//! ---
//!
//! ## `geppetto::pubkey`: Compile-Time Constants (requires `features = ["pubkey"]`)
//!
//! `geppetto::pubkey` re-exports `pinocchio-pubkey`, giving you zero-cost
//! compile-time base58 decoding for program IDs, authority addresses, and PDA
//! constants without adding another direct dependency.
//!
//! ### `pubkey!` — define any address constant
//!
//! ```rust,ignore
//! const TOKEN_PROGRAM: Address =
//!     geppetto::pubkey::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
//! const MY_AUTHORITY: Address =
//!     geppetto::pubkey::pubkey!("MyAuth111111111111111111111111111111111111");
//! ```
//!
//! ### `declare_id!` — declare program ID + `check_id()` + `id()`
//!
//! ```rust,ignore
//! geppetto::pubkey::declare_id!("MyProgram11111111111111111111111111111111");
//! // Expands to:
//! //   pub const ID: Address = from_str("MyProgram...");
//! //   pub fn check_id(id: &Address) -> bool { id == &ID }
//! //   pub const fn id() -> Address { ID }
//! ```
//!
//! ### `from_str` — const fn base58 decode
//!
//! ```rust,ignore
//! const MY_KEY: Address =
//!     geppetto::pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
//! ```
//!
//! ### Compile-time PDA derivation
//!
//! ```rust,ignore
//! const EVENT_AUTHORITY: Address = geppetto::pubkey::derive_address_const(
//!     &[b"event_authority"],
//!     Some(255),
//!     &MY_PROGRAM_ID,
//! );
//! ```
//!
//! **Key advantage**: all of these are compile-time — zero runtime cost,
//! and Geppetto keeps the API available under a single import surface.

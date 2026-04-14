//! # Account Patterns
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-14
//!
//! ## Account Slice Destructuring
//!
//! Every official Pinocchio program uses pattern matching on the accounts slice.
//! This is safer than index-based access and gives clear error messages.
//!
//! ```rust,ignore
//! // ✅ Correct: destructuring with guard checks
//! let [maker, escrow, system_program, remaining @ ..] = accounts else {
//!     return Err(ProgramError::NotEnoughAccountKeys);
//! };
//! guard::assert_signer(maker)?;
//! guard::assert_writable(escrow)?;
//! guard::assert_system_program(system_program)?;
//! ```
//!
//! **Common mistake**: using `accounts[0]`, `accounts[1]` directly. This panics
//! on too-short slices instead of returning a clean program error.
//!
//! ## TryFrom Accounts Pattern
//!
//! For complex instructions, extract accounts into a typed struct with a
//! `TryFrom<&mut [AccountView]>` implementation. This keeps the processor
//! focused on business logic.
//!
//! ```rust,ignore
//! // instructions/create/accounts.rs
//! pub struct CreateAccounts<'a> {
//!     pub maker: &'a mut AccountView,
//!     pub escrow: &'a mut AccountView,
//!     pub system_program: &'a AccountView,
//! }
//!
//! impl<'a> TryFrom<&'a mut [AccountView]> for CreateAccounts<'a> {
//!     type Error = ProgramError;
//!     fn try_from(accounts: &'a mut [AccountView]) -> Result<Self, Self::Error> {
//!         let [maker, escrow, system_program, ..] = accounts else {
//!             return Err(ProgramError::NotEnoughAccountKeys);
//!         };
//!         guard::assert_signer(maker)?;
//!         guard::assert_writable(maker)?;
//!         guard::assert_writable(escrow)?;
//!         guard::assert_system_program(system_program)?;
//!         Ok(Self { maker, escrow, system_program })
//!     }
//! }
//! ```
//!
//! ## Instruction Data Parsing
//!
//! Official programs parse instruction payloads via `TryFrom<&[u8]>`:
//!
//! ```rust,ignore
//! // instructions/create/data.rs
//! pub struct CreateData {
//!     pub amount: u64,
//! }
//!
//! impl TryFrom<&[u8]> for CreateData {
//!     type Error = ProgramError;
//!     fn try_from(data: &[u8]) -> Result<Self, Self::Error> {
//!         if data.len() < 8 {
//!             return Err(ProgramError::InvalidInstructionData);
//!         }
//!         let amount = u64::from_le_bytes(
//!             data[..8].try_into().map_err(|_| ProgramError::InvalidInstructionData)?
//!         );
//!         Ok(Self { amount })
//!     }
//! }
//! ```

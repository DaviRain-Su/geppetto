//! # Instruction Dispatch
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! Standard dispatch pattern: first byte of instruction data is the tag.
//! All official Pinocchio programs (memo, escrow, rewards, token) use this.
//!
//! ## Pattern (copy this into your processor.rs)
//!
//! ```rust,ignore
//! use geppetto::dispatch;
//! use geppetto::{Address, AccountView, ProgramResult};
//!
//! pub fn process_instruction(
//!     program_id: &Address,
//!     accounts: &mut [AccountView],
//!     data: &[u8],
//! ) -> ProgramResult {
//!     let (tag, rest) = dispatch::split_tag(data)?;
//!     match tag {
//!         0 => instructions::create::process(program_id, accounts, rest),
//!         1 => instructions::exchange::process(program_id, accounts, rest),
//!         2 => instructions::close::process(program_id, accounts, rest),
//!         _ => Err(ProgramError::InvalidInstructionData),
//!     }
//! }
//! ```
//!
//! ## Rules
//!
//! - **No `_ => Ok(())`** — unknown instructions MUST return error
//! - Each instruction handler in its own file under `instructions/`
//! - Account validation FIRST, business logic SECOND

use pinocchio::error::ProgramError;

/// Split instruction data into (tag, remaining_data).
#[inline]
pub fn split_tag(data: &[u8]) -> Result<(u8, &[u8]), ProgramError> {
    data.split_first()
        .map(|(&tag, rest)| (tag, rest))
        .ok_or(ProgramError::InvalidInstructionData)
}

/// Well-known discriminator for self-CPI event emission.
pub const SELF_CPI_EVENT_DISCRIMINATOR: u8 = 228;

/// Well-known discriminator for batch instructions (SPL Token).
pub const BATCH_DISCRIMINATOR: u8 = 255;

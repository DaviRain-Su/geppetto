//! # Errors
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-14
//! > **Verified against**: Solana 2.2.x
//!
//! Geppetto-specific error namespace used by guards and schema validation.
//!
//! ## Error space
//! - Stored as `ProgramError::Custom(u32)`.
//! - Geppetto reserves `0x4700` to `0x4703` in this crate version.
//! - Downstream users should avoid reusing these codes for unrelated variants.
// Re-export ProgramError so downstream crates can use geppetto::error::ProgramError
// without depending on pinocchio directly.
pub use pinocchio::error::ProgramError;

/// Geppetto-specific error codes.
#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GeppettoError {
    /// Account's first byte does not match expected discriminator.
    InvalidDiscriminator = 0x4700,
    /// Account data length does not match `AccountSchema::LEN`.
    InvalidAccountLen = 0x4701,
    /// PDA derivation does not match account address.
    PdaMismatch = 0x4702,
    /// Account is writable but was expected to be read-only.
    ExpectedReadonly = 0x4703,
}

impl From<GeppettoError> for ProgramError {
    fn from(e: GeppettoError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

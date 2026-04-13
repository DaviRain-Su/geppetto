use pinocchio::error::ProgramError;

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

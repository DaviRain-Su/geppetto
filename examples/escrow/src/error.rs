use pinocchio::error::ProgramError;

/// Escrow program custom errors.
#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EscrowError {
    /// Escrow is not in the expected status.
    InvalidStatus = 0x100,
    /// Amount must be greater than zero.
    ZeroAmount = 0x101,
}

impl From<EscrowError> for ProgramError {
    fn from(e: EscrowError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

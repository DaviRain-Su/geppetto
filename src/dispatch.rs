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

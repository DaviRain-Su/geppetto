use geppetto::account::AccountView;
use geppetto::address::Address;
use geppetto::dispatch;
use geppetto::ProgramResult;
use pinocchio::error::ProgramError;

use crate::instructions;

/// Dispatch instruction by tag (first byte).
pub fn dispatch(
    program_id: &Address,
    accounts: &mut [AccountView],
    data: &[u8],
) -> ProgramResult {
    let (tag, rest) = dispatch::split_tag(data)?;
    match tag {
        0 => instructions::create::process(program_id, accounts, rest),
        1 => instructions::exchange::process(program_id, accounts, rest),
        2 => instructions::close::process(program_id, accounts, rest),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

#![no_std]

//! # Geppetto Escrow — Example Program
//!
//! A minimal escrow program demonstrating all Geppetto conventions:
//! - `AccountSchema` for account layouts
//! - `guard::*` for security checks
//! - `dispatch::split_tag` for instruction routing
//! - Standard instruction handler pattern
//!
//! ## Instructions
//!
//! | Tag | Instruction | Description |
//! |-----|-------------|-------------|
//! | 0   | Create      | Maker creates escrow, deposits tokens |
//! | 1   | Exchange    | Taker fulfills escrow, tokens swap |
//! | 2   | Close       | Maker cancels escrow, reclaims tokens |

use geppetto::account::AccountView;
use geppetto::address::Address;
use geppetto::ProgramResult;

pub mod error;
pub mod instructions;
pub mod processor;
pub mod state;

// program_entrypoint + nostd_panic_handler for reliable #![no_std] SBF builds.
// entrypoint!() uses default_panic_handler which provides custom_panic hook
// but not #[panic_handler]. nostd_panic_handler provides the actual handler.
geppetto::program_entrypoint!(process_instruction);
geppetto::default_allocator!();
geppetto::nostd_panic_handler!();

pub fn process_instruction(
    program_id: &Address,
    accounts: &mut [AccountView],
    data: &[u8],
) -> ProgramResult {
    processor::dispatch(program_id, accounts, data)
}

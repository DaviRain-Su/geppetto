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
use geppetto::entrypoint;
use geppetto::ProgramResult;

pub mod error;
pub mod instructions;
pub mod processor;
pub mod state;

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Address,
    accounts: &mut [AccountView],
    data: &[u8],
) -> ProgramResult {
    processor::dispatch(program_id, accounts, data)
}

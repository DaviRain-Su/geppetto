#![no_std]

pub use pinocchio::*;

#[cfg(feature = "system")]
pub use pinocchio_system as system;

#[cfg(feature = "token")]
pub use pinocchio_token as token;

#[cfg(feature = "token-2022")]
pub use pinocchio_token_2022 as token_2022;

#[cfg(feature = "ata")]
pub use pinocchio_associated_token_account as ata;

#[cfg(feature = "memo")]
pub use pinocchio_memo as memo;

pub mod guard;
pub mod schema;
pub mod dispatch;
pub mod error;
pub mod idioms;
pub mod anti_patterns;
pub mod client;

#[cfg(feature = "test-utils")]
pub mod testing;

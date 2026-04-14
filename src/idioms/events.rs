//! # Event Emission
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-14
//!
//! ## Self-CPI Events (escrow + rewards pattern)
//!
//! Programs can emit structured events by CPI-ing to themselves. This avoids
//! log truncation and enables indexing.
//!
//! ```rust,ignore
//! use geppetto::dispatch::SELF_CPI_EVENT_DISCRIMINATOR;
//!
//! // Event authority PDA is the signer for the self-CPI
//! let event_authority_seeds = &[b"event_authority"];
//! let (event_authority, bump) = Address::derive_program_address(
//!     event_authority_seeds,
//!     program_id,
//! ).unwrap();
//!
//! // Build instruction data: [228, event_payload...]
//! let mut data = [SELF_CPI_EVENT_DISCRIMINATOR];
//! // ... append payload ...
//! ```
//!
//! ## Event System Architecture
//!
//! ```rust,ignore
//! // 1. Define event structs
//! pub struct EscrowCreated {
//!     pub maker: Address,
//!     pub amount: u64,
//! }
//!
//! // 2. Serialize event to bytes
//! impl EscrowCreated {
//!     fn to_bytes(&self) -> Vec<u8> { /* ... */ }
//! }
//!
//! // 3. Emit via CPI with discriminator 228
//! fn emit_event(
//!     event_authority: &AccountView,
//!     program_id: &Address,
//!     event_data: &[u8],
//!     bump: u8,
//! ) -> ProgramResult {
//!     // Build CPI instruction with tag = SELF_CPI_EVENT_DISCRIMINATOR (228)
//!     // Sign with event_authority PDA seeds + bump
//!     // invoke_signed(...)
//!     Ok(())
//! }
//! ```
//!
//! The event authority PDA (typically seeded with `b"event_authority"`) serves as
//! the CPI signer, proving the event originated from this program.
//!
//! ## Program Logging (requires `features = ["log"]`)
//!
//! Use `pinocchio-log` for on-chain logging. Do NOT use `std::println!`.
//!
//! ```rust,ignore
//! use geppetto::log::sol_log;
//!
//! sol_log("Processing create instruction");
//! ```
//!
//! **Performance tip**: gate logging behind a feature flag in production:
//!
//! ```rust,ignore
//! #[cfg(feature = "logging")]
//! geppetto::log::sol_log("debug info");
//! ```

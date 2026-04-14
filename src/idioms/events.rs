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
//! ## Program Logging with `geppetto::log` (requires `features = ["log"]`)
//!
//! `geppetto::log` re-exports `pinocchio-log`, which provides CU-efficient
//! logging that replaces `msg!` from `solana-program`. It avoids Rust's
//! `format!` machinery, often saving 50-90% CU.
//!
//! ### `log!` macro (recommended)
//!
//! ```rust,ignore
//! // Basic (default 200-byte stack buffer):
//! geppetto::log::log!("transfer amount: {}", lamports);
//!
//! // Custom buffer size:
//! geppetto::log::log!(50, "amount: {}", lamports);
//!
//! // Precision formatting (u64 → decimal with N places):
//! geppetto::log::log!("amount (SOL): {:.9}", lamports);
//!
//! // Truncation:
//! geppetto::log::log!("{:>.10}", "pinocchio-program");
//! ```
//!
//! ### `Logger<N>` (direct API, maximum control)
//!
//! ```rust,ignore
//! use geppetto::log::logger::Logger;
//!
//! let mut logger = Logger::<100>::default();
//! logger.append("balance=");
//! logger.append(1_000_000_000u64);
//! logger.log();
//! logger.clear();
//! ```
//!
//! ### CU savings vs `msg!`
//!
//! | Message | `log!` CU | `msg!` CU | Saving |
//! |---------|-----------|-----------|--------|
//! | Static string | 104 | 104 | — |
//! | String + u64 | 286 | 625 | 55% |
//! | Two strings | 119 | 1610 | 93% |
//! | Decimal formatting | 438 | 2656 | 84% |
//!
//! ### Production pattern: gate behind feature
//!
//! ```rust,ignore
//! #[cfg(feature = "log")]
//! geppetto::log::log!("debug: amount={}", amount);
//! ```
//!
//! If your program wants a separate app-level debug toggle, wrap the log call in
//! your own feature in addition to enabling Geppetto's `log` dependency feature.

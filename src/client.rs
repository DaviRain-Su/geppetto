//! # Client Guidance
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! TypeScript/JS clients should stay aligned to Rust schema and derivation rules:
//!
//! - Use the same seed vectors and program IDs as Rust PDA derivation.
//! - Use exact field offsets from `AccountSchema` implementations.
//! - Preserve Rust error decoding (convert `ProgramError::Custom` back to `GeppettoError` codes).
//! - Keep client-side rent and lamport constants in sync with on-chain decisions.
//!
//! This module is intentionally documentation-first. Implementation helpers can be
//! added in later phases alongside `tests/` and fixture assets.

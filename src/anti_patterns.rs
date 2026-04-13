//! # Anti Patterns
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! This module is the reference map of high-impact mistakes.
//! Each anti-pattern should be treated as an explicit guardrail during review:
//!
//! - Missing signer checks
//! - Unchecked owner/type assumptions
//! - Wrong account/program assumptions in dispatch
//! - Unsafe account close flow
//! - Invalid seed usage in PDA derivation
//! - Unbounded allocation in on-chain paths
//!
//! For each listed pattern, the corresponding guard in `guard.rs`, schema contract
//! in `schema.rs`, or dispatch rule in `dispatch.rs` should be used to prevent the issue.

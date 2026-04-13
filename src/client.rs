//! # Client Guidance
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! TypeScript/JS client patterns aligned to Rust schema and derivation rules.
//!
//! ## Transaction Construction
//!
//! Use `@solana/kit` (formerly `@solana/web3.js` v2) to build and send
//! instructions. Keep instruction data layout in sync with Rust dispatch rules.
//!
//! ```typescript,ignore
//! import { generateKeyPairSigner, getProgramDerivedAddress } from '@solana/kit';
//! import { createTransaction, setTransactionFeePayer, setTransactionLifetimeUsingBlockhash } from '@solana/kit';
//!
//! // Instruction data: [tag, ...payload]
//! const data = new Uint8Array([0, ...amount.toBytes(8, true)]);
//!
//! const ix = {
//!   programAddress: PROGRAM_ID,
//!   accounts: [
//!     { address: maker.address, role: AccountRole.WRITABLE_SIGNER },
//!     { address: escrowPda, role: AccountRole.WRITABLE },
//!     { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
//!   ],
//!   data,
//! };
//! ```
//!
//! ## PDA Derivation
//!
//! TypeScript must use **exactly** the same seeds and program ID as Rust.
//! Any deviation (extra byte, different encoding, wrong program ID) produces
//! a different address and causes the transaction to fail.
//!
//! ```typescript,ignore
//! import { getProgramDerivedAddress, address } from '@solana/kit';
//!
//! const [escrowPda] = await getProgramDerivedAddress({
//!   programAddress: address(PROGRAM_ID),
//!   seeds: [
//!     Buffer.from('escrow'),
//!     Buffer.from(maker.address), // must match Rust seed exactly
//!   ],
//! });
//! ```
//!
//! ## Account Deserialization
//!
//! Read fields at the exact offsets defined by the Rust `AccountSchema`
//! implementation. Do not assume padding or field ordering.
//!
//! ```typescript,ignore
//! // Escrow schema: discriminator(1) + status(1) + maker(32) + taker(32) + amount(8)
//! const discriminator = accountData.readUInt8(0);
//! const status = accountData.readUInt8(1);
//! const maker = accountData.subarray(2, 34).toBase58();
//! const amount = accountData.readBigUInt64LE(66);
//! ```
//!
//! ## Error Handling
//!
//! Pinocchio programs return `ProgramError::Custom(u32)`. Map these back to
//! `GeppettoError` codes on the client for meaningful error messages.
//!
//! ```typescript,ignore
//! enum GeppettoError {
//!   InvalidDiscriminator = 0x4700,
//!   InvalidAccountLen = 0x4701,
//!   PdaMismatch = 0x4702,
//!   ExpectedReadonly = 0x4703,
//! }
//!
//! function decodeError(err: { code: number }): string {
//!   switch (err.code) {
//!     case GeppettoError.InvalidDiscriminator:
//!       return 'Account discriminator mismatch';
//!     case GeppettoError.PdaMismatch:
//!       return 'Derived PDA does not match expected address';
//!     default:
//!       return `Unknown Geppetto error: 0x${err.code.toString(16)}`;
//!   }
//! }
//! ```
//!
//! ## Fixture-Based Alignment Testing
//!
//! The recommended way to verify Rust/TypeScript alignment without a live
//! validator:
//!
//! 1. Rust test serializes a known account to `tests/fixtures/escrow_account.bin`.
//! 2. TypeScript test reads the fixture and asserts field values.
//! 3. If offsets drift in Rust, the TypeScript test fails immediately.
//!
//! See `tests/client_alignment.ts` for a working example.

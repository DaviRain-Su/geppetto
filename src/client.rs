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
//!     getAddressEncoder().encode(maker.address), // raw 32 bytes, must match Rust seed exactly
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
//! const maker = encodeBase58(accountData.subarray(2, 34));
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
//! Geppetto ships a concrete escrow example for verifying Rust/TypeScript
//! alignment without a live validator:
//!
//! 1. `examples/escrow/tests/generate_fixtures.rs` serializes a known escrow
//!    account into `examples/escrow/tests/fixtures/`.
//! 2. `examples/escrow/tests/client_alignment.ts` reads those fixtures and
//!    asserts every field using the same offsets as the Rust schema.
//! 3. `npm run test:escrow-client-alignment` runs both steps from the repo root.
//!
//! If offsets drift in Rust, the TypeScript alignment test fails immediately.
//!
//! ---
//!
//! ## Codama: Automated Client Generation (Recommended)
//!
//! Instead of hand-writing TypeScript clients, use **Codama** — the official IDL
//! and client generation tool used by all Anza pinocchio programs (escrow, rewards, token).
//!
//! Repository: <https://github.com/codama-idl/codama>
//!
//! ### Setup
//!
//! There are two common ways to use Codama:
//!
//! 1. **CLI-only workflow** — install/run the Codama CLI; no Rust dependency is
//!    required in your on-chain program crate.
//! 2. **Dedicated generator crate / build tool** — keep Codama in a separate
//!    Rust crate that exists only to read program definitions and emit IDL/clients.
//!
//! ```toml
//! # Example: tools/idl-gen/Cargo.toml (NOT the on-chain program crate)
//! [dependencies]
//! codama = "0.4"          # check crates.io for latest
//! codama-korok-plugins = "0.4"
//! ```
//!
//! ### Initialize
//!
//! ```bash
//! # In your program directory:
//! codama init
//! # Creates .codama/ config directory
//! ```
//!
//! ### Generate clients
//!
//! ```bash
//! # Generate TypeScript client:
//! codama run js --out ../clients/js/src/generated
//!
//! # Generate Rust client:
//! codama run rust --out ../clients/rust/src/generated
//! ```
//!
//! ### How it works
//!
//! Codama reads your Rust program's types and instruction definitions
//! (annotated with `#[derive(CodamaInstructions)]` and `#[codama(...)]`),
//! produces a standardized IDL, then generates typed clients from that IDL.
//!
//! ```rust,ignore
//! // In a dedicated generator crate / build tool context:
//! use codama::CodamaInstructions;
//!
//! #[derive(CodamaInstructions)]
//! pub enum MyProgramInstruction {
//!     #[codama(discriminator = 0)]
//!     Create {
//!         #[codama(signer, writable)]
//!         maker: AccountMeta,
//!         #[codama(writable)]
//!         escrow: AccountMeta,
//!         amount: u64,
//!     },
//!     // ...
//! }
//! ```
//!
//! ### When to use Codama vs hand-written clients
//!
//! | Approach | When to use |
//! |----------|-------------|
//! | **Codama** | Production programs with multiple clients (JS + Rust + mobile). Official pipeline. |
//! | **Hand-written** | Quick prototypes, hackathon demos, programs with <3 instructions. |
//!
//! For the Geppetto escrow demo, hand-written is fine. For production, use Codama.
//!
//! ---
//!
//! ## Ecosystem References
//!
//! - **solana-developers/program-examples** (<https://github.com/solana-developers/program-examples>):
//!   10+ pinocchio examples (counter, PDAs, CPIs, tokens) side-by-side with Anchor/Native.
//!   Best learning resource for pattern comparison.
//! - **create-solana-program** (<https://github.com/solana-program/create-solana-program>):
//!   Scaffolding CLI (`pnpm create solana-program`). No `--pinocchio` flag yet —
//!   scaffold with `--shank` and add geppetto manually.

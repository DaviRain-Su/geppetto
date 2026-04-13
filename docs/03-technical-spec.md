# Phase 3: Technical Spec — Geppetto

> 状态：草稿
> 日期：2026-04-13
> 输入：Phase 2 架构设计
> 重要：代码必须与本规格 100% 一致。不一致时先改规格，再改代码。

---

## 1. Cargo.toml

```toml
[package]
name = "geppetto"
version = "0.1.0"
edition = "2024"
description = "Pinocchio Agent Harness — knowledge + constraints for AI coding agents"
license = "Apache-2.0"
repository = "https://github.com/DaviRain-Su/geppetto"
keywords = ["solana", "pinocchio", "agent", "harness"]
categories = ["development-tools"]

[dependencies]
pinocchio = { version = "0.11", features = ["cpi"] }

pinocchio-system = { version = "0.6", optional = true }
pinocchio-token = { version = "0.6", optional = true }
pinocchio-token-2022 = { version = "0.3", optional = true }
pinocchio-associated-token-account = { version = "0.4", optional = true }
pinocchio-memo = { version = "0.4", optional = true }

[features]
default = []
system = ["dep:pinocchio-system"]
token = ["dep:pinocchio-token"]
token-2022 = ["dep:pinocchio-token-2022"]
ata = ["dep:pinocchio-associated-token-account"]
memo = ["dep:pinocchio-memo"]
token-all = ["token", "token-2022", "ata"]
full = ["system", "token-all", "memo"]
test-utils = []
```

## 2. src/lib.rs — 透传层

```rust
#![no_std]

//! # Geppetto — Pinocchio Agent Harness
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! Agent-aware harness for Solana/Pinocchio development.
//! Provides knowledge (doc comments), constraints (guard, schema),
//! and patterns (dispatch, idioms) that make AI coding agents
//! produce correct, secure, idiomatic Pinocchio programs.
//!
//! Built on top of official [Anza-xyz/pinocchio](https://github.com/anza-xyz/pinocchio)
//! and Solana Foundation patterns. All types (`AccountView`, `Address`,
//! `ProgramError`) are direct re-exports from pinocchio 0.11.x — this
//! crate adds zero wrapping, only knowledge and constraints.
//!
//! ## Quick Start
//!
//! ```toml
//! [dependencies]
//! geppetto = { version = "0.1", features = ["system", "token-all"] }
//! ```
//!
//! ```rust,ignore
//! use geppetto::*;
//! use geppetto::guard;
//! use geppetto::token;
//! ```
//!
//! ## Module Overview
//!
//! | Module | Type | Purpose |
//! |--------|------|---------|
//! | `guard` | Code + Knowledge | Security check helpers |
//! | `schema` | Code + Knowledge | Account layout trait |
//! | `dispatch` | Code + Knowledge | Instruction routing |
//! | `error` | Code | Custom error codes |
//! | `idioms` | Code + Knowledge | Common pattern helpers |
//! | `anti_patterns` | Knowledge only | What NOT to do |
//! | `client` | Knowledge only | TypeScript client patterns |
//! | `testing` | Code + Knowledge | Test utilities (feature-gated) |

// ── Pinocchio 核心 re-export ──
pub use pinocchio::*;

// ── CPI helpers（feature-gated）──
#[cfg(feature = "system")]
pub use pinocchio_system as system;

#[cfg(feature = "token")]
pub use pinocchio_token as token;

#[cfg(feature = "token-2022")]
// Note: Cargo feature name is `token-2022` (hyphen, Cargo convention),
// but Rust module alias must use underscore: `token_2022`
pub use pinocchio_token_2022 as token_2022;

#[cfg(feature = "ata")]
pub use pinocchio_associated_token_account as ata;

#[cfg(feature = "memo")]
pub use pinocchio_memo as memo;

// ── Geppetto 自有模块 ──
pub mod guard;
pub mod schema;
pub mod dispatch;
pub mod error;
pub mod idioms;
pub mod anti_patterns;
pub mod client;

#[cfg(feature = "test-utils")]
pub mod testing;
```

## 3. src/guard.rs — 安全检查 helpers（FR-3）

### 3.1 类型约定

- 所有函数接收 `&AccountView` 引用
- 返回 `Result<(), ProgramError>`
- 失败时使用最具体的 `ProgramError` 变体或 `GeppettoError`

### 3.2 函数规格

#### `assert_signer`

```rust
use pinocchio::account::AccountView;
use pinocchio::error::ProgramError;

/// Assert that the account is a signer of the transaction.
///
/// # Why this matters
///
/// Missing signer checks allow anyone to impersonate authorized users.
/// This is the #1 most common Solana program vulnerability.
///
/// Official programs (escrow, rewards, token) all check this explicitly
/// in their `accounts.rs` files via `verify_signer`.
///
/// # Errors
///
/// Returns [`ProgramError::MissingRequiredSignature`] if `account.is_signer()` is false.
///
/// # Example
///
/// ```rust,ignore
/// use geppetto::guard;
///
/// guard::assert_signer(maker)?;
/// ```
#[inline]
pub fn assert_signer(account: &AccountView) -> Result<(), ProgramError> {
    if account.is_signer() {
        Ok(())
    } else {
        Err(ProgramError::MissingRequiredSignature)
    }
}
```

#### `assert_writable`

```rust
/// Assert that the account is writable.
///
/// # Why this matters
///
/// Writing to a read-only account causes a runtime error.
/// Checking explicitly gives a clear error message instead of
/// a cryptic "program failed to complete" at CPI time.
///
/// # Errors
///
/// Returns [`ProgramError::Immutable`] if `account.is_writable()` is false.
#[inline]
pub fn assert_writable(account: &AccountView) -> Result<(), ProgramError> {
    if account.is_writable() {
        Ok(())
    } else {
        Err(ProgramError::Immutable)
    }
}
```

#### `assert_owner`

```rust
use pinocchio::address::Address;

/// Assert that the account is owned by the expected program.
///
/// # Why this matters
///
/// If you don't check ownership, an attacker can pass an account
/// owned by a different program with arbitrary data.
/// This is the #2 most common Solana vulnerability.
///
/// # Errors
///
/// Returns [`ProgramError::InvalidAccountOwner`] if `account.owner() != expected_owner`.
#[inline]
pub fn assert_owner(account: &AccountView, expected_owner: &Address) -> Result<(), ProgramError> {
    if account.owned_by(expected_owner) {
        Ok(())
    } else {
        Err(ProgramError::InvalidAccountOwner)
    }
}
```

#### `assert_pda`

```rust
/// Assert that the account's address matches the expected PDA.
///
/// Derives the PDA from `seeds` + `program_id` and compares with
/// `account.address()`. This prevents PDA spoofing attacks.
///
/// # Why this matters
///
/// PDA validation ensures the account was derived from the expected
/// seeds. Without this check, an attacker can substitute any account.
///
/// # Errors
///
/// Returns [`GeppettoError::PdaMismatch`] if the derived address does not match.
pub fn assert_pda(
    account: &AccountView,
    seeds: &[&[u8]],
    program_id: &Address,
) -> Result<u8, ProgramError> {
    let (derived, bump) = Address::find_program_address(seeds, program_id);
    if account.address() == &derived {
        Ok(bump)
    } else {
        Err(crate::error::GeppettoError::PdaMismatch.into())
    }
}
```

**注意**：`assert_pda` 返回 `Result<u8, ProgramError>`（bump seed），而非 `Result<(), ProgramError>`。调用方经常需要 bump。

#### `assert_discriminator`

```rust
/// Assert that the first byte of account data matches the expected discriminator.
///
/// # Why this matters
///
/// Without discriminator checks, an attacker can pass a different
/// account type with a valid layout but wrong semantics.
///
/// # Errors
///
/// Returns [`GeppettoError::InvalidDiscriminator`] if mismatch.
/// Returns [`ProgramError::AccountDataTooSmall`] if data is empty.
///
/// For `Option<u8>` discriminators (from AccountSchema), use
/// `AccountSchema::validate()` or `try_from_account()` instead.
pub fn assert_discriminator(account: &AccountView, expected: u8) -> Result<(), ProgramError> {
    let data = account.try_borrow()?;
    if data.is_empty() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    if data[0] == expected {
        Ok(())
    } else {
        Err(crate::error::GeppettoError::InvalidDiscriminator.into())
    }
}
```

#### `assert_rent_exempt`

```rust
/// Assert that the account holds enough lamports to be rent exempt.
///
/// # Why this matters
///
/// Non-rent-exempt accounts can be garbage collected by the runtime,
/// causing data loss.
///
/// # Implementation note
///
/// Uses hardcoded rent constants instead of Rent::get() sysvar,
/// because Pinocchio doesn't expose the Rent sysvar directly and
/// these values have been stable since Solana 1.x.
/// If Solana ever changes rent parameters, this function must be updated.
///
/// Formula: `(128 + data_len) * 3480 * 2`
///
/// # Errors
///
/// Returns [`ProgramError::AccountNotRentExempt`] if below threshold.
pub fn assert_rent_exempt(account: &AccountView) -> Result<(), ProgramError> {
    let min_balance = rent_exempt_minimum(account.data_len());
    if account.lamports() >= min_balance {
        Ok(())
    } else {
        Err(ProgramError::AccountNotRentExempt)
    }
}

/// Calculate minimum lamports for rent exemption.
///
/// Formula: (128 + data_len) * 3480 * 2
/// where 3480 = lamports per byte-year, 2 = exemption threshold (years).
#[inline]
const fn rent_exempt_minimum(data_len: usize) -> u64 {
    ((128 + data_len) as u64) * 3480 * 2
}
```

#### `assert_readonly`

```rust
/// Assert that the account is NOT writable (read-only).
///
/// # Why this matters
///
/// Passing a writable account where read-only is expected can enable
/// unintended state mutations. Official programs (escrow, rewards)
/// enforce this explicitly via `verify_readonly`.
///
/// # Errors
///
/// Returns [`GeppettoError::ExpectedReadonly`] if `account.is_writable()` is true.
#[inline]
pub fn assert_readonly(account: &AccountView) -> Result<(), ProgramError> {
    if !account.is_writable() {
        Ok(())
    } else {
        Err(crate::error::GeppettoError::ExpectedReadonly.into())
    }
}
```

#### `assert_system_program`

```rust
/// Assert that the account's address is the System Program.
///
/// # Why this matters
///
/// When creating accounts via CPI, you must verify the system program
/// account is actually the system program. An attacker could substitute
/// a malicious program.
///
/// # Errors
///
/// Returns [`ProgramError::IncorrectProgramId`] if mismatch.
#[inline]
pub fn assert_system_program(account: &AccountView) -> Result<(), ProgramError> {
    if account.address() == &SYSTEM_PROGRAM_ID {
        Ok(())
    } else {
        Err(ProgramError::IncorrectProgramId)
    }
}

/// System Program ID: 11111111111111111111111111111111
pub const SYSTEM_PROGRAM_ID: Address = Address::new_from_array([0u8; 32]);
```

#### `assert_token_program`

```rust
/// Assert that the account's address is either SPL Token or Token-2022.
///
/// # Why this matters
///
/// Programs that handle tokens must verify the token program account.
/// Since Token-2022 is increasingly common, this guard accepts BOTH
/// program IDs — matching the pattern in escrow and rewards.
///
/// # Errors
///
/// Returns [`ProgramError::IncorrectProgramId`] if neither Token nor Token-2022.
#[inline]
pub fn assert_token_program(account: &AccountView) -> Result<(), ProgramError> {
    let addr = account.address();
    if addr == &SPL_TOKEN_PROGRAM_ID || addr == &TOKEN_2022_PROGRAM_ID {
        Ok(())
    } else {
        Err(ProgramError::IncorrectProgramId)
    }
}

/// SPL Token Program ID
pub const SPL_TOKEN_PROGRAM_ID: Address = /* TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA */;
/// Token-2022 Program ID
pub const TOKEN_2022_PROGRAM_ID: Address = /* TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb */;
```

#### `assert_current_program`

```rust
/// Assert that the account is owned by the currently executing program.
///
/// # Why this matters
///
/// Ensures the account was created by this program, not a different one.
/// This is a CPI re-entrancy guard — prevents accounts from other
/// programs being passed as program-owned data accounts.
///
/// # Errors
///
/// Returns [`ProgramError::InvalidAccountOwner`] if mismatch.
#[inline]
pub fn assert_current_program(account: &AccountView, program_id: &Address) -> Result<(), ProgramError> {
    assert_owner(account, program_id)
}
```

#### `assert_account_count`

```rust
/// Assert that the accounts slice has at least `expected` accounts.
///
/// # Why this matters
///
/// Accessing `accounts[n]` on a too-short slice panics at runtime
/// with an unhelpful message. This guard gives a clear
/// `NotEnoughAccountKeys` error upfront.
///
/// All official programs check this first. Pattern:
/// `let [a, b, c, ..] = accounts else { return Err(NotEnoughAccountKeys) };`
///
/// # Errors
///
/// Returns [`ProgramError::NotEnoughAccountKeys`] if `accounts.len() < expected`.
#[inline]
pub fn assert_account_count(accounts: &[AccountView], expected: usize) -> Result<(), ProgramError> {
    if accounts.len() >= expected {
        Ok(())
    } else {
        Err(ProgramError::NotEnoughAccountKeys)
    }
}
```

#### `assert_ata`

```rust
/// Assert that the account's address matches the expected Associated Token Account.
///
/// Derives the ATA from (wallet, token_program, mint) and compares.
///
/// # Why this matters
///
/// ATA derivation uses a specific seed pattern. If you don't verify,
/// an attacker can substitute a non-ATA token account.
///
/// # Errors
///
/// Returns [`GeppettoError::PdaMismatch`] if derived ATA address doesn't match.
pub fn assert_ata(
    account: &AccountView,
    wallet: &Address,
    mint: &Address,
    token_program: &Address,
) -> Result<(), ProgramError> {
    let derived = derive_ata(wallet, mint, token_program);
    if account.address() == &derived {
        Ok(())
    } else {
        Err(crate::error::GeppettoError::PdaMismatch.into())
    }
}

/// Derive an Associated Token Account address.
fn derive_ata(wallet: &Address, mint: &Address, token_program: &Address) -> Address {
    let (addr, _) = Address::find_program_address(
        &[
            wallet.as_ref(),
            token_program.as_ref(),
            mint.as_ref(),
        ],
        &ATA_PROGRAM_ID,
    );
    addr
}

/// Associated Token Account Program ID
pub const ATA_PROGRAM_ID: Address = /* ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL */;
```

### 3.3 Guard 汇总表

| 函数 | 参数 | 返回 | 错误码 |
|------|------|------|--------|
| `assert_signer` | `&AccountView` | `Result<(), ProgramError>` | `MissingRequiredSignature` |
| `assert_writable` | `&AccountView` | `Result<(), ProgramError>` | `Immutable` |
| `assert_readonly` | `&AccountView` | `Result<(), ProgramError>` | `GeppettoError::ExpectedReadonly` |
| `assert_owner` | `&AccountView, &Address` | `Result<(), ProgramError>` | `InvalidAccountOwner` |
| `assert_pda` | `&AccountView, &[&[u8]], &Address` | `Result<u8, ProgramError>` | `GeppettoError::PdaMismatch` |
| `assert_discriminator` | `&AccountView, u8` | `Result<(), ProgramError>` | `GeppettoError::InvalidDiscriminator` |
| `assert_rent_exempt` | `&AccountView` | `Result<(), ProgramError>` | `AccountNotRentExempt` |
| `assert_system_program` | `&AccountView` | `Result<(), ProgramError>` | `IncorrectProgramId` |
| `assert_token_program` | `&AccountView` | `Result<(), ProgramError>` | `IncorrectProgramId` |
| `assert_current_program` | `&AccountView, &Address` | `Result<(), ProgramError>` | `InvalidAccountOwner` |
| `assert_account_count` | `&[AccountView], usize` | `Result<(), ProgramError>` | `NotEnoughAccountKeys` |
| `assert_ata` | `&AccountView, &Address, &Address, &Address` | `Result<(), ProgramError>` | `GeppettoError::PdaMismatch` |

### 3.4 导出常量

| 常量 | 值 | 用途 |
|------|-----|------|
| `SYSTEM_PROGRAM_ID` | `11111111111111111111111111111111` | assert_system_program |
| `SPL_TOKEN_PROGRAM_ID` | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | assert_token_program |
| `TOKEN_2022_PROGRAM_ID` | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` | assert_token_program |
| `ATA_PROGRAM_ID` | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` | assert_ata |

## 4. src/schema.rs — AccountSchema trait（FR-2）

```rust
use pinocchio::error::ProgramError;

/// Defines the on-chain memory layout of an account type.
///
/// > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
/// > **Verified against**: Solana 2.2.x
///
/// Implementors MUST be `#[repr(C)]` to guarantee field ordering
/// matches the byte layout. Field offsets are expressed as
/// associated constants on the implementing type (not on this trait),
/// because each account has different fields.
///
/// # How to implement
///
/// ```rust,ignore
/// use geppetto::schema::AccountSchema;
///
/// #[repr(C)]
/// pub struct Escrow {
///     pub discriminator: u8,    // offset 0, 1 byte
///     pub status: u8,           // offset 1, 1 byte
///     pub maker: Address,       // offset 2, 32 bytes
///     pub taker: Address,       // offset 34, 32 bytes
///     pub amount: u64,          // offset 66, 8 bytes (LE)
/// }
///
/// impl AccountSchema for Escrow {
///     const LEN: usize = 74;       // 1 + 1 + 32 + 32 + 8
///     const DISCRIMINATOR: Option<u8> = Some(1);
///
///     fn layout() -> &'static [(&'static str, &'static str, usize, usize)] {
///         &[
///             ("discriminator", "u8",      0,  1),
///             ("status",        "u8",      1,  1),
///             ("maker",         "Address", 2,  32),
///             ("taker",         "Address", 34, 32),
///             ("amount",        "u64",     66, 8),
///         ]
///     }
/// }
///
/// // Field offsets also as associated constants (for direct byte access)
/// impl Escrow {
///     pub const DISCRIMINATOR_OFFSET: usize = 0;
///     pub const STATUS_OFFSET: usize = 1;
///     pub const MAKER_OFFSET: usize = 2;
///     pub const TAKER_OFFSET: usize = 34;
///     pub const AMOUNT_OFFSET: usize = 66;
/// }
///
/// // Compile-time size check
/// assert_account_size!(Escrow);
/// ```
///
/// # For AI agents
///
/// When you see `impl AccountSchema for X`, read the `LEN`,
/// `DISCRIMINATOR`, and `*_OFFSET` constants to understand
/// the exact byte layout. Use these constants when:
/// - Serializing/deserializing account data
/// - Building TypeScript clients (offsets must match)
/// - Writing tests (assert data at specific offsets)
pub trait AccountSchema: Sized {
    /// Total size in bytes of the serialized account data.
    const LEN: usize;

    /// Single-byte discriminator to distinguish account types.
    ///
    /// `None` for accounts that don't use discriminators (e.g. system-owned).
    /// `Some(d)` for program-owned accounts — must be unique per program.
    const DISCRIMINATOR: Option<u8> = None;

    /// Return the field layout as (name, type_name, offset, size) tuples.
    ///
    /// Enables agents to generate TypeScript clients:
    /// - `type_name` maps to TS read methods (u64 → readBigUInt64LE, Address → 32-byte array)
    /// - `offset` + `size` map to Buffer.subarray calls
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// fn layout() -> &'static [(&'static str, &'static str, usize, usize)] {
    ///     &[
    ///         ("discriminator", "u8",      0,  1),
    ///         ("status",        "u8",      1,  1),
    ///         ("maker",         "Address", 2,  32),
    ///         ("taker",         "Address", 34, 32),
    ///         ("amount",        "u64",     66, 8),
    ///     ]
    /// }
    /// ```
    fn layout() -> &'static [(&'static str, &'static str, usize, usize)];

    /// Validate that raw account data matches this schema.
    ///
    /// Default implementation checks:
    /// 1. Data length >= LEN
    /// 2. Discriminator matches (if DISCRIMINATOR is Some)
    fn validate(data: &[u8]) -> Result<(), ProgramError> {
        if data.len() < Self::LEN {
            return Err(ProgramError::AccountDataTooSmall);
        }
        if let Some(d) = Self::DISCRIMINATOR {
            if data.is_empty() || data[0] != d {
                return Err(ProgramError::InvalidAccountData);
            }
        }
        Ok(())
    }

    /// Zero-copy cast from raw account data to &Self.
    ///
    /// # Safety
    ///
    /// Caller MUST ensure:
    /// - `data.len() >= Self::LEN`
    /// - Discriminator is valid (if applicable)
    /// - Account owner is correct
    /// - `Self` is `#[repr(C)]` with no padding
    ///
    /// Use `try_from_account` for the safe path.
    /// Use this only after all guards have passed and you need
    /// zero-copy access without re-validation.
    unsafe fn from_bytes_unchecked(data: &[u8]) -> &Self {
        &*(data.as_ptr() as *const Self)
    }

    /// Validate an AccountView and return a zero-copy reference.
    ///
    /// Checks: owner matches `program_id`, data length >= LEN,
    /// discriminator matches (if Some). This is the recommended
    /// safe entry point for accessing account data.
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let escrow: &Escrow = Escrow::try_from_account(escrow_account, program_id)?;
    /// ```
    fn try_from_account(
        account: &AccountView,
        program_id: &Address,
    ) -> Result<&Self, ProgramError> {
        // Check owner
        if !account.owned_by(program_id) {
            return Err(ProgramError::InvalidAccountOwner);
        }
        // Borrow data (immutable)
        let data = account.try_borrow()?;
        // Validate length + discriminator
        Self::validate(&data)?;
        // Safe: we just validated length and discriminator
        Ok(unsafe { Self::from_bytes_unchecked(&data) })
    }
}
```

### 4.1 编译期大小断言

提供一个辅助宏（这是唯一允许的宏，因为它是编译期断言，不生成运行时代码）：

```rust
/// Compile-time assertion that a struct's size matches AccountSchema::LEN.
///
/// Catches padding bugs that would cause layout mismatch.
/// Inspired by rewards' `assert_no_padding!`.
///
/// # Usage
/// ```rust,ignore
/// assert_account_size!(Escrow);
/// ```
#[macro_export]
macro_rules! assert_account_size {
    ($t:ty) => {
        const _: () = {
            assert!(
                core::mem::size_of::<$t>() == <$t as $crate::schema::AccountSchema>::LEN,
                "struct size does not match AccountSchema::LEN — check for padding"
            );
        };
    };
}
```

## 5. src/dispatch.rs — 指令分发（FR-4）

```rust
use pinocchio::error::ProgramError;

//! # Instruction Dispatch
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! Standard dispatch pattern: first byte of instruction data is the tag.
//! All official Pinocchio programs (memo, escrow, rewards, token) use this.
//!
//! ## Pattern (copy this into your processor.rs)
//!
//! ```rust,ignore
//! use geppetto::dispatch;
//! use geppetto::{Address, AccountView, ProgramResult};
//!
//! pub fn process_instruction(
//!     program_id: &Address,
//!     accounts: &mut [AccountView],
//!     data: &[u8],
//! ) -> ProgramResult {
//!     let (tag, rest) = dispatch::split_tag(data)?;
//!     match tag {
//!         0 => instructions::create::process(program_id, accounts, rest),
//!         1 => instructions::exchange::process(program_id, accounts, rest),
//!         2 => instructions::close::process(program_id, accounts, rest),
//!         _ => Err(ProgramError::InvalidInstructionData),
//!     }
//! }
//! ```
//!
//! ## Rules
//!
//! - **No `_ => Ok(())`** — unknown instructions MUST return error
//! - Each instruction handler in its own file under `instructions/`
//! - Account validation FIRST, business logic SECOND

/// Split instruction data into (tag, remaining_data).
///
/// The tag is the first byte, used as the instruction discriminator.
/// The remaining bytes are passed to the specific instruction handler.
///
/// # Errors
///
/// Returns [`ProgramError::InvalidInstructionData`] if `data` is empty.
///
/// # Example
///
/// ```rust,ignore
/// let (tag, rest) = geppetto::dispatch::split_tag(instruction_data)?;
/// ```
#[inline]
pub fn split_tag(data: &[u8]) -> Result<(u8, &[u8]), ProgramError> {
    data.split_first()
        .map(|(&tag, rest)| (tag, rest))
        .ok_or(ProgramError::InvalidInstructionData)
}

/// Well-known discriminator for self-CPI event emission.
///
/// Used by official programs (escrow, rewards) to emit structured events
/// via CPI to the program's own event authority PDA.
/// See `idioms.rs` for the full self-CPI event pattern.
pub const SELF_CPI_EVENT_DISCRIMINATOR: u8 = 228;

/// Well-known discriminator for batch instructions (SPL Token).
///
/// Discriminator 255 is reserved by SPL Token for batching multiple
/// token instructions into a single CPI call.
/// See `idioms.rs` for the Batch CPI pattern.
pub const BATCH_DISCRIMINATOR: u8 = 255;
```

### 5.2 设计说明：为什么用 split_tag + match 而不是 handlers 数组

另一种可能的设计是数组索引分发：`handlers[tag](program_id, accounts, data)`，O(1) 跳转。

我们选择 `split_tag + match` 的理由：
1. **与官方一致** — memo/escrow/rewards/token 四个官方仓库全部用 match 分发
2. **Agent 可读性** — match 语句的每个分支自解释，agent 一眼看懂
3. **灵活性** — handler 签名不需要强制统一，每个分支可以有不同的参数处理
4. **编译器优化** — 对于 <20 个分支，rustc 通常将 match 编译为跳转表，性能等价

handlers 数组模式适合 >50 条指令的极大型程序（如 token 的 fast-path dispatch），在 `idioms.rs` 中作为进阶知识文档覆盖。

## 6. src/error.rs — 自定义错误码

**注意**：此模块必须兼容 `#![no_std]`。不使用 `std::error::Error`，不使用 `thiserror`。仅依赖 `core` 和 `pinocchio::error::ProgramError`。

```rust
use pinocchio::error::ProgramError;

//! # Geppetto Custom Errors
//!
//! Used only when pinocchio's built-in `ProgramError` variants
//! are insufficient to express the specific failure.
//!
//! Error codes start at `0x4700` to avoid collisions with:
//! - Pinocchio built-in errors (0x0 - 0xFF)
//! - User program errors (typically 0x100+)

/// Geppetto-specific error codes.
#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GeppettoError {
    /// Account's first byte does not match expected discriminator.
    ///
    /// Triggered by `guard::assert_discriminator`.
    InvalidDiscriminator = 0x4700,

    /// Account data length does not match `AccountSchema::LEN`.
    ///
    /// Triggered by `AccountSchema::validate`.
    InvalidAccountLen = 0x4701,

    /// PDA derivation does not match account address.
    ///
    /// Triggered by `guard::assert_pda` and `guard::assert_ata`.
    PdaMismatch = 0x4702,

    /// Account is writable but was expected to be read-only.
    ///
    /// Triggered by `guard::assert_readonly`.
    ExpectedReadonly = 0x4703,
}

impl From<GeppettoError> for ProgramError {
    fn from(e: GeppettoError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

## 7. src/idioms.rs — 惯用法 helpers（FR-5）

### 7.1 导出函数

```rust
use pinocchio::account::AccountView;
use pinocchio::address::Address;
use pinocchio::error::ProgramError;
use pinocchio::ProgramResult;

//! # Solana/Pinocchio Idioms
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! Helper functions for common Pinocchio patterns, extracted from
//! official programs (escrow, rewards, token).

// NOTE: PDA derivation + verification is handled by guard::assert_pda
// which returns Result<u8, ProgramError> (bump seed). No duplicate here.

/// Close an account safely: zero all data, drain lamports to recipient.
///
/// # Why use this
///
/// Improper account closure is a known attack vector.
/// If you only drain lamports but don't zero data, the account
/// can be "resurrected" within the same transaction with stale data.
///
/// This function:
/// 1. Zeros all account data bytes
/// 2. Transfers all lamports to recipient
/// 3. Sets account lamports to 0
pub fn close_account(
    account: &mut AccountView,
    recipient: &mut AccountView,
) -> ProgramResult {
    // Transfer lamports
    let lamports = account.lamports();
    recipient.set_lamports(recipient.lamports() + lamports);
    account.set_lamports(0);

    // Zero data
    let mut data = account.try_borrow_mut()?;
    data.fill(0);

    Ok(())
}

/// Read a little-endian u64 from a byte slice at the given offset.
///
/// # Errors
///
/// Returns [`ProgramError::AccountDataTooSmall`] if `offset + 8 > data.len()`.
#[inline]
pub fn read_u64_le(data: &[u8], offset: usize) -> Result<u64, ProgramError> {
    let end = offset + 8;
    if end > data.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    let bytes: [u8; 8] = data[offset..end]
        .try_into()
        .map_err(|_| ProgramError::AccountDataTooSmall)?;
    Ok(u64::from_le_bytes(bytes))
}

/// Write a little-endian u64 to a mutable byte slice at the given offset.
///
/// # Errors
///
/// Returns [`ProgramError::AccountDataTooSmall`] if `offset + 8 > data.len()`.
#[inline]
pub fn write_u64_le(data: &mut [u8], offset: usize, value: u64) -> Result<(), ProgramError> {
    let end = offset + 8;
    if end > data.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    data[offset..end].copy_from_slice(&value.to_le_bytes());
    Ok(())
}

/// Read a 32-byte Address from a byte slice at the given offset.
///
/// # Errors
///
/// Returns [`ProgramError::AccountDataTooSmall`] if `offset + 32 > data.len()`.
#[inline]
pub fn read_address(data: &[u8], offset: usize) -> Result<Address, ProgramError> {
    let end = offset + 32;
    if end > data.len() {
        return Err(ProgramError::AccountDataTooSmall);
    }
    let bytes: [u8; 32] = data[offset..end]
        .try_into()
        .map_err(|_| ProgramError::AccountDataTooSmall)?;
    Ok(Address::new_from_array(bytes))
}
```

### 7.2 知识话题（doc comments）

以下话题写在 `idioms.rs` 的模块级 doc comments 中。每个话题包含：When to use / Pattern / Example / Common mistakes。

**idioms.rs 实现优先级**：内容多，必须分批实现。

| 批次 | 话题 | 黑客松必须 |
|------|------|-----------|
| P0 | Entrypoint 选择 + no_allocator/nostd | 是 |
| P0 | 账户切片解构 | 是 |
| P0 | TryFrom accounts 模式 | 是 |
| P0 | CPI 两种风格 | 是 |
| P0 | self-CPI 事件发射 | 是 |
| P1 | Token-2022 双支持、Batch CPI | 是 |
| P1 | Codama、LiteSVM/Mollusk | 是 |
| P2 | TLV 扩展、likely/unlikely、#[cold]、logging flag、InstructionContext | 时间允许 |

#### Critical — P0（agent 写的第一行就需要）

**Entrypoint 选择指南**

```
entrypoint!         — 标准入口，含 allocator + panic handler（需要 alloc feature）
program_entrypoint! — 仅入口，需自行配置 allocator 和 panic handler
lazy_program_entrypoint! — 延迟解析，接收 InstructionContext 而非预解析的 accounts 切片

选择规则：
- 如果程序使用堆分配 → entrypoint!
- 如果 #![no_std] 零分配 → program_entrypoint! + no_allocator!() + nostd_panic_handler!()
- 如果高性能且只需部分账户 → lazy_program_entrypoint!
```

**`no_allocator!()` + `nostd_panic_handler!()` 配置**

```rust,ignore
// 标准 no_std 程序模板
#![no_std]

use pinocchio::{no_allocator, nostd_panic_handler, program_entrypoint};

no_allocator!();
nostd_panic_handler!();
program_entrypoint!(process_instruction);
```

**账户切片解构（Critical — 每条指令都用）**

```rust,ignore
// ✅ 正确：官方程序的标准模式
pub fn process(
    program_id: &Address,
    accounts: &mut [AccountView],
    data: &[u8],
) -> ProgramResult {
    let [maker, escrow, system_program, remaining @ ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    // 现在 maker, escrow, system_program 都是 &mut AccountView
    guard::assert_signer(maker)?;
    guard::assert_writable(escrow)?;
    guard::assert_system_program(system_program)?;
    // ...
}

// ❌ 错误：index-based 访问（容易越界，可读性差）
let maker = &accounts[0];
let escrow = &accounts[1]; // 如果 accounts 只有 1 个元素就 panic
```

**TryFrom accounts 文件模式（High — 复杂指令的标准架构）**

```rust,ignore
// instructions/create/accounts.rs
pub struct CreateAccounts<'a> {
    pub maker: &'a mut AccountView,
    pub escrow: &'a mut AccountView,
    pub system_program: &'a AccountView,
}

impl<'a> TryFrom<&'a mut [AccountView]> for CreateAccounts<'a> {
    type Error = ProgramError;
    fn try_from(accounts: &'a mut [AccountView]) -> Result<Self, Self::Error> {
        let [maker, escrow, system_program, ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };
        guard::assert_signer(maker)?;
        guard::assert_writable(maker)?;
        guard::assert_writable(escrow)?;
        guard::assert_system_program(system_program)?;
        Ok(Self { maker, escrow, system_program })
    }
}
```

#### High（大多数程序需要）

**CPI 两种风格**
- 简单风格（system/ATA/memo）：栈分配 `InstructionAccount` 数组 + `invoke_signed()`
- 优化风格（token/token-2022）：`MaybeUninit` + `CpiWriter` trait + `invoke_signed_unchecked()`
- 选择规则：system CPI 用简单风格，token CPI 用 pinocchio-token 提供的结构体的 `.invoke()` 方法

**self-CPI 事件发射**
- 使用 `dispatch::SELF_CPI_EVENT_DISCRIMINATOR`（228）
- 需要 event authority PDA 作为 signer
- escrow 和 rewards 都使用此模式
- 示例：构建 CPI 指令，签名者为 event authority PDA

**Token-2022 双支持**
- 使用 `guard::assert_token_program()` 同时接受 Token 和 Token-2022
- CPI 时根据实际 token program 选择对应的 pinocchio-token 或 pinocchio-token-2022

**Batch CPI**
- 使用 `dispatch::BATCH_DISCRIMINATOR`（255）
- 将多个 token 指令打包成一次 CPI 调用，减少 CPI 开销
- 仅适用于 SPL Token

#### Medium（特定场景需要）

**TLV 扩展存储**
- Type-Length-Value 格式存储可选扩展数据
- escrow 使用此模式存储 timelock、hook、arbiter 等扩展

**`likely`/`unlikely` 分支提示**
- `pinocchio::hint::likely()` / `pinocchio::hint::unlikely()`
- 用在热路径 vs 错误路径的条件判断
- token 程序大量使用

**`#[cold]` 错误构造函数**
- 标记不常执行的错误路径，帮助编译器优化

**Logging feature flag 模式**
```rust,ignore
// 所有 msg! 调用都应该在 cfg 门控后
#[cfg(feature = "logging")]
pinocchio::msg!("Processing create instruction");
```

**InstructionContext 延迟解析**
- 配合 `lazy_program_entrypoint!` 使用
- 账户按需解析，减少不必要的反序列化

#### High（补充）

**Codama 注解（客户端自动生成）**
- `#[derive(CodamaInstructions)]` 和 `#[codama(...)]` 属性
- 用于从 Rust 类型自动生成 TypeScript/Rust 客户端 SDK
- escrow 和 rewards 都使用，是官方推荐的客户端生成方案
- 与 `client.rs` 知识互补：Codama 生成骨架，`client.rs` 知识指导手动调优

**LiteSVM / Mollusk-SVM 测试（官方推荐）**
- 官方程序（memo/escrow/rewards）全部使用 mollusk-svm 或 litesvm
- 不使用 `solana-program-test`（已过时）
- `testing.rs` 导出的工具函数基于这些测试框架

## 8. src/anti_patterns.rs — 反模式（FR-5，纯文档）

模块级 doc comments 覆盖以下反模式：

| 反模式 | 危害 | doctest 标记 |
|--------|------|-------------|
| Missing signer check | 任何人可冒充授权用户 | `should_panic` |
| Unchecked account owner | 攻击者传入恶意账户数据 | `should_panic` |
| PDA seed collision | 不同用途的账户共享地址 | 文字说明 |
| Close account drain | 关闭账户不清零数据，可被复活 | `should_panic` |
| Catch-all dispatch (`_ => Ok(())`) | 沉默接受无效指令 | `compile_fail` |
| Unbounded allocation | 堆分配导致 CU 爆炸 | 文字说明 |

每个反模式格式：

```rust
//! ## Anti-Pattern: [名称]
//!
//! **Danger level**: Critical / High / Medium
//!
//! ### What goes wrong
//! [描述]
//!
//! ### Wrong code
//! ```rust,should_panic
//! // 错误示例
//! ```
//!
//! ### Correct code
//! ```rust
//! // 使用 geppetto::guard 的正确示例
//! ```
//!
//! ### How Geppetto prevents this
//! [说明 guard/schema 如何机械化防止此问题]
```

## 9. src/client.rs — 客户端知识（FR-6，纯文档）

模块级 doc comments 覆盖：

1. **Transaction construction** — 使用 `@solana/kit` 构建指令
2. **PDA derivation** — TypeScript 侧必须与 Rust 侧种子完全匹配
3. **Account deserialization** — 偏移量必须与 `AccountSchema` 常量一致
4. **Error handling** — 解析 Custom error codes

每个话题包含 TypeScript 代码示例（无法 doctest）。

**验证策略（分层）：**
1. **Fixture-based 测试**（P0）：Rust 侧用 AccountSchema 序列化已知结构，导出 raw bytes 到 fixture 文件。TypeScript 侧读取 fixture，手动反序列化，断言字段值匹配。不需要链上环境，测试快速稳定。
2. **链上端到端测试**（P1，如果时间允许）：用 litesvm 部署程序 + ts-node 客户端交互，验证完整链路。

**测试文件位置：**
- Rust 测试：`tests/` 目录（标准 crate 结构）
- TypeScript fixture 测试：`tests/fixtures/` 存放 fixture 数据，`tests/client_alignment.ts` 执行验证
- 链上 e2e 测试（如做）：`examples/escrow/tests/` 目录

## 10. src/testing.rs — 测试工具（FR-7，feature-gated）

```rust
#![cfg(feature = "test-utils")]

//! # Testing Utilities
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! Helpers for testing Pinocchio programs with litesvm or mollusk-svm.
//! Enable with: `geppetto = { features = ["test-utils"] }`

use pinocchio::address::Address;
use pinocchio::error::ProgramError;

/// Assert that account data at a given offset equals expected bytes.
///
/// Panics with a descriptive message including the field name,
/// offset, expected, and actual values.
pub fn assert_account_data(
    data: &[u8],
    offset: usize,
    expected: &[u8],
    field_name: &str,
) {
    let end = offset + expected.len();
    assert!(
        end <= data.len(),
        "field '{}': offset {}..{} out of bounds (data len = {})",
        field_name, offset, end, data.len()
    );
    assert_eq!(
        &data[offset..end],
        expected,
        "field '{}' at offset {} does not match",
        field_name, offset
    );
}

/// Assert that the first byte of data matches the expected discriminator.
pub fn assert_discriminator(data: &[u8], expected: u8) {
    assert!(!data.is_empty(), "account data is empty");
    assert_eq!(
        data[0], expected,
        "discriminator mismatch: expected {}, got {}",
        expected, data[0]
    );
}

/// Assert a u64 LE value at offset matches expected.
pub fn assert_u64_le(data: &[u8], offset: usize, expected: u64, field_name: &str) {
    let actual = crate::idioms::read_u64_le(data, offset)
        .expect("offset out of bounds");
    assert_eq!(
        actual, expected,
        "field '{}' at offset {}: expected {}, got {}",
        field_name, offset, expected, actual
    );
}
```

纯知识话题（doc comments）：
- litesvm vs mollusk-svm vs bankrun 选择指南
- 测试环境搭建模板
- CU profiling 方法

## 11. AGENTS.md — Agent 指引（FR-8）

完整内容见 Phase 2 架构设计。Phase 3 补充 Knowledge Freshness 的 prompt 强度：

```markdown
## Knowledge Freshness Rules

CRITICAL: These rules are NOT optional. Violation produces unreliable code.

Every knowledge module in geppetto has a version header like:
> Knowledge version: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13

BEFORE using ANY pattern from geppetto's doc comments:

1. Read the version header of the module you're about to use.
2. Compare against this project's Cargo.toml:
   - What geppetto version is listed?
   - What pinocchio version is listed?
3. Check today's date against the knowledge date.

IF the pinocchio version in Cargo.toml differs from the knowledge header,
OR the knowledge is older than 3 months:
   → STOP. Do not use the pattern yet.
   → Check pinocchio's CHANGELOG for breaking changes since the knowledge date.
   → If the pattern is still valid: proceed and note "verified on [date]".
   → If the pattern is outdated: adapt it and note the change.

NEVER silently use knowledge you suspect may be outdated.
When in doubt, read the pinocchio source code directly.
```

## 12. 版本头标准格式

所有模块（guard、schema、dispatch、idioms、anti_patterns、client、testing）的第一行 doc comment 必须包含：

```
> **Knowledge version**: geppetto {geppetto_version} | pinocchio {pinocchio_version} | {YYYY-MM-DD}
> **Verified against**: Solana {solana_version}
```

## 13. 常量表

### 13.1 错误码

| 常量 | 值 | 触发函数 |
|------|-----|----------|
| `GeppettoError::InvalidDiscriminator` | `0x4700` | `guard::assert_discriminator` |
| `GeppettoError::InvalidAccountLen` | `0x4701` | `AccountSchema::validate` |
| `GeppettoError::PdaMismatch` | `0x4702` | `guard::assert_pda`, `guard::assert_ata` |
| `GeppettoError::ExpectedReadonly` | `0x4703` | `guard::assert_readonly` |

### 13.2 Well-known 地址

| 常量 | 值 | 用途 |
|------|-----|------|
| `SYSTEM_PROGRAM_ID` | `11111111111111111111111111111111` | `guard::assert_system_program` |
| `SPL_TOKEN_PROGRAM_ID` | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | `guard::assert_token_program` |
| `TOKEN_2022_PROGRAM_ID` | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` | `guard::assert_token_program` |
| `ATA_PROGRAM_ID` | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` | `guard::assert_ata` |

### 13.3 Well-known discriminator

| 常量 | 值 | 用途 |
|------|-----|------|
| `SELF_CPI_EVENT_DISCRIMINATOR` | `228` | self-CPI 事件发射 |
| `BATCH_DISCRIMINATOR` | `255` | SPL Token Batch 指令 |

### 13.4 Rent 参数

| 常量 | 值 | 用途 |
|------|-----|------|
| Rent lamports per byte-year | `3480` | `guard::assert_rent_exempt` |
| Rent exemption threshold | `2` (years) | `guard::assert_rent_exempt` |
| Rent account overhead | `128` bytes | `guard::assert_rent_exempt` |

## 14. 边界条件

| # | 场景 | 预期行为 |
|---|------|----------|
| 1 | `assert_signer` 传入非签名账户 | 返回 `MissingRequiredSignature` |
| 2 | `assert_writable` 传入只读账户 | 返回 `Immutable` |
| 3 | `assert_readonly` 传入可写账户 | 返回 `GeppettoError::ExpectedReadonly` |
| 4 | `assert_pda` seeds 为空 `&[]` | 正常推导（空 seeds 是合法的 PDA） |
| 5 | `assert_discriminator` 传入空数据账户 | 返回 `AccountDataTooSmall` |
| 6 | `AccountSchema::validate` data.len < LEN | 返回 `AccountDataTooSmall` |
| 7 | `AccountSchema::validate` data.len > LEN | 通过（`<` 检查，不是 `!=`） |
| 8 | `split_tag` 传入空 `&[]` | 返回 `InvalidInstructionData` |
| 9 | `split_tag` 传入单字节 `&[0]` | 返回 `(0, &[])` — tag=0，rest 为空 |
| 10 | `read_u64_le` offset 超出数据边界 | 返回 `AccountDataTooSmall` |
| 11 | `close_account` 账户 lamports 为 0 | 正常执行（零 + 零 = 零） |
| 12 | `rent_exempt_minimum` data_len = 0 | 返回 `128 * 3480 * 2 = 890880` |
| 13 | `assert_system_program` 传入非 system program 地址 | 返回 `IncorrectProgramId` |
| 14 | `assert_token_program` 传入 Token-2022 地址 | 通过（接受两种 token program） |
| 15 | `assert_token_program` 传入非 token program 地址 | 返回 `IncorrectProgramId` |
| 16 | `assert_account_count` accounts.len() == expected | 通过（`>=` 检查） |
| 17 | `assert_account_count` accounts.len() < expected | 返回 `NotEnoughAccountKeys` |
| 18 | `assert_ata` wallet/mint/token_program 组合正确 | 通过 |
| 19 | `assert_ata` mint 参数错误 | 返回 `GeppettoError::PdaMismatch` |
| 20 | 两个 AccountSchema 使用相同 DISCRIMINATOR | 编译通过但运行时错误——文档中警告 |

## Phase 3 验收标准

- [x] Guard helpers：12 个函数，完整签名和实现（从 6 扩展到 12）
- [x] Well-known 地址常量：System、Token、Token-2022、ATA
- [x] Well-known discriminator 常量：228（event）、255（batch）
- [x] 错误码 4 个（0x4700-0x4703），精确触发条件
- [x] AccountSchema trait 定义完整（LEN、DISCRIMINATOR、validate、assert_account_size!）
- [x] idioms.rs：5 个导出函数 + 12 个知识话题（Critical/High/Medium 分级）
- [x] 覆盖官方仓库范式：账户切片解构、TryFrom accounts、entrypoint 选择、CPI 风格、self-CPI 事件、TLV、Batch、Codama
- [x] 边界条件 20 个
- [x] 使用正确的 Pinocchio 0.11 类型（AccountView、Address、ProgramError）
- [x] 知识版本头格式已定义
- [x] AGENTS.md Knowledge Freshness prompt 已强化
- [x] 可进入 Phase 4: Task Breakdown

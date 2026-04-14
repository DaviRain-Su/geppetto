# Phase 2: Architecture — Geppetto

> 状态：草稿
> 日期：2026-04-13
> 输入：Phase 0 商业验证 + Phase 1 PRD

---

> **注意**：Phase 2 为架构设计草稿，所有 API 签名、类型名和模块路径以 Phase 3 技术规格为准。本文档中部分类型名（如 `AccountInfo`、`Pubkey`）在 Phase 3 中已更新为 Pinocchio 0.11 风格（`AccountView`、`Address`）。

## 系统概览

Geppetto 是一个单 crate，re-export 整个 Pinocchio 生态并在其上添加三层：约定代码（guard + schema + dispatch）、知识文档（doc comments）、agent 指引（AGENTS.md）。

```
┌─────────────────────────────────────────────────────┐
│                  用户项目                              │
│  use geppetto::*;                                    │
│  use geppetto::guard::*;                             │
│  use geppetto::token::Transfer;                      │
├─────────────────────────────────────────────────────┤
│                  geppetto crate                       │
│                                                       │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────┐    │
│  │  约定代码层    │  │ 知识文档层  │  │  透传层        │    │
│  │  guard.rs    │  │ idioms   │  │  lib.rs      │    │
│  │  schema.rs   │  │ anti_pat │  │  (re-export) │    │
│  │  dispatch.rs │  │ client   │  │              │    │
│  │              │  │ testing  │  │              │    │
│  └──────┬───────┘  └──────────┘  └──────┬───────┘    │
│         │                                │            │
├─────────┴────────────────────────────────┴────────────┤
│              Pinocchio 生态（外部依赖）                    │
│  pinocchio │ pinocchio-system │ pinocchio-token │ ... │
└─────────────────────────────────────────────────────┘
```

## 模块结构（目标状态）

> 注：标记 ✅ 已存在 / 🔲 计划中。当前仓库处于骨架阶段，大部分文件已创建但内容为空。

```
geppetto/
├── Cargo.toml                       ✅
├── AGENTS.md                        🔲 FR-8：唯一真相来源（Codex/Pi/Droid 直接读）
├── CLAUDE.md                        🔲 Claude Code（@AGENTS.md）
├── GEMINI.md                        🔲 Gemini
├── .cursor/rules/geppetto.md        🔲 Cursor
├── .windsurf/rules/geppetto.md      🔲 Windsurf
├── .github/copilot-instructions.md  🔲 GitHub Copilot
├── .amazonq/rules/geppetto.md       🔲 Amazon Q
├── .aider.conf.yml                  🔲 Aider（read: AGENTS.md）
├── src/
│   ├── lib.rs                       ← FR-1：crate 入口 + pinocchio re-export
│   │
│   │  ── 约定代码层 ──
│   ├── guard.rs                     ← FR-3：安全检查 helpers
│   ├── schema.rs                    ← FR-2：AccountSchema trait
│   ├── dispatch.rs                  ← FR-4：指令分发模式
│   ├── error.rs                     ← Geppetto 自定义错误码
│   │
│   │  ── 知识层（代码 + 文档 或 纯文档）──
│   ├── idioms.rs                    ← FR-5：惯用法 helpers（PDA/CPI/事件）+ 知识
│   ├── anti_patterns.rs             ← FR-5：反模式（纯文档）
│   ├── client.rs                    ← FR-6：客户端知识（纯文档，TypeScript）
│   └── testing.rs                   ← FR-7：测试工具函数 + 知识
│
├── examples/                        🔲 FR-9：示例程序（计划中，尚未创建）
│   └── escrow/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── state.rs
│           ├── processor.rs
│           ├── error.rs
│           └── instructions/
│               ├── mod.rs
│               ├── create.rs
│               └── exchange.rs
│
└── tests/                           🔲 集成测试目录（计划中，尚未创建）
    ├── guard_tests.rs
    ├── schema_tests.rs
    └── dispatch_tests.rs
```

## 模块依赖关系

```
lib.rs ──re-export──→ pinocchio + pinocchio-system + pinocchio-token + ...
  │
  ├── guard.rs ──────→ pinocchio (AccountView, ProgramError)
  ├── schema.rs ─────→ pinocchio (无直接依赖，纯 trait 定义)
  ├── dispatch.rs ───→ pinocchio (ProgramResult, AccountView)
  ├── error.rs ──────→ pinocchio (ProgramError)
  │
  ├── idioms.rs ─────→ pinocchio + guard + schema（代码 + 知识：PDA/CPI/事件 helpers）
  ├── anti_patterns.rs → (纯文档，doctest 依赖 geppetto 自身)
  ├── client.rs ─────→ (纯文档，TypeScript 示例)
  └── testing.rs ────→ pinocchio（代码 + 知识：测试工具函数，cfg(test) 或 dev-dep）
```

关键：约定代码层的三个模块（guard、schema、dispatch）之间**无循环依赖**。guard 可以引用 schema（检查 discriminator 时需要知道布局），但 schema 不依赖 guard。

## 层级详细设计

### 1. 透传层（lib.rs）— FR-1

```rust
//! # Geppetto
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! Agent-aware knowledge SDK for Solana/Pinocchio development.
//! [crate 总览知识...]

#![no_std]

// 核心 SDK 直接透传
pub use pinocchio::*;

// CPI helpers 作为子模块
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

// Geppetto 自有模块
pub mod guard;
pub mod schema;
pub mod dispatch;
pub mod error;

// 知识模块（idioms/testing 含导出代码，anti_patterns/client 纯文档）
pub mod idioms;
pub mod anti_patterns;
pub mod client;

#[cfg(feature = "test-utils")]
pub mod testing;
```

**Cargo.toml feature gates：**

```toml
[features]
# 默认只含核心 SDK，不拉入任何 CPI helper
default = []

# 单个 CPI helper，按需启用
system = ["dep:pinocchio-system"]
token = ["dep:pinocchio-token"]
token-2022 = ["dep:pinocchio-token-2022"]
ata = ["dep:pinocchio-associated-token-account"]
memo = ["dep:pinocchio-memo"]

# 预设组合，覆盖常见场景
token-all = ["token", "token-2022", "ata"]   # SPL Token 全家桶
full = ["system", "token-all", "memo"]        # 所有 CPI helpers

# 测试工具（testing.rs 导出的 helpers）
test-utils = []
```

**用法示例（AGENTS.md 和 doc comments 里都要写清楚）：**

```toml
# 最小：只要 guard + schema + idioms helpers，不做任何 CPI
geppetto = "0.1"

# 需要转 SOL
geppetto = { version = "0.1", features = ["system"] }

# 需要 SPL Token 操作（最常见）
geppetto = { version = "0.1", features = ["system", "token-all"] }

# 全部拉入
geppetto = { version = "0.1", features = ["full"] }

# 测试中使用 testing.rs 的工具函数
[dev-dependencies]
geppetto = { version = "0.1", features = ["test-utils"] }
```

**AGENTS.md 里的 feature 选择指引：**

agent 看到用户的需求后，按以下规则选择 features：

- 程序需要创建账户或转 SOL → 加 `system`
- 程序需要操作 SPL Token → 加 `token-all`（含 token + token-2022 + ata）
- 程序需要写 memo 日志 → 加 `memo`
- 不确定 → 用 `full`

### 2. 约定代码层

> **说明（实现 vs 下游使用）**：本节展示的是 **Geppetto crate 内部实现规格**，
> 因此代码块里允许直接引用底层 `pinocchio::*` 类型。
> 但对 **Geppetto 的下游用户 / agent**，公开知识与示例应统一使用
> `geppetto::*` facade，而不是直接依赖 `pinocchio::*`。

#### 2a. guard.rs — FR-3

**设计原则**：每个函数做一件事，签名自解释，失败返回明确错误。

```rust
//! # Security Guards
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//!
//! Explicit security checks for Solana program accounts.
//! Every check that the official programs (escrow, rewards, token)
//! do implicitly, Geppetto makes explicit.

use pinocchio::{account::AccountView, error::ProgramError, address::Address};

/// Assert that the account is a signer of the transaction.
///
/// # Why this matters
/// Missing signer checks allow anyone to impersonate authorized users.
/// This is the #1 most common Solana vulnerability.
///
/// # Errors
/// Returns `ProgramError::MissingRequiredSignature` if not a signer.
pub fn assert_signer(account: &AccountView) -> Result<(), ProgramError>;

/// Assert that the account is writable.
pub fn assert_writable(account: &AccountView) -> Result<(), ProgramError>;

/// Assert that the account is owned by the expected program.
pub fn assert_owner(account: &AccountView, expected_owner: &Address) -> Result<(), ProgramError>;

/// Assert that the account's address matches the expected PDA.
pub fn assert_pda(
    account: &AccountView,
    seeds: &[&[u8]],
    program_id: &Address,
) -> Result<u8, ProgramError>;

/// Assert that the first byte of account data matches the expected discriminator.
pub fn assert_discriminator(account: &AccountView, expected: u8) -> Result<(), ProgramError>;

/// Assert that the account is rent exempt.
pub fn assert_rent_exempt(account: &AccountView) -> Result<(), ProgramError>;
```

**错误码策略**：尽量使用 Pinocchio 内置的 `ProgramError` 变体。自定义错误仅在内置变体不够表达时使用，定义在 `error.rs` 中。

#### 2b. schema.rs — FR-2

**设计原则**：通过 trait const 在编译期暴露布局信息，`#[repr(C)]` 保证零拷贝。

```rust
//! # Account Schema
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//!
//! Trait for defining account memory layouts. Inspired by:
//! - token's `Transmutable` trait
//! - rewards' `assert_no_padding!` macro
//! - escrow's zero-copy state structs

/// Defines the on-chain memory layout of an account.
///
/// Implementors must be `#[repr(C)]` to guarantee field ordering.
/// All field offsets are expressed as associated constants.
pub trait AccountSchema {
    /// Total size in bytes of the serialized account data.
    const LEN: usize;

    /// Single-byte discriminator to distinguish account types.
    ///
    /// `None` for accounts that don't use discriminators (e.g. system-owned).
    /// `Some(d)` for program-owned accounts — must be unique per program.
    const DISCRIMINATOR: Option<u8> = None;

    /// Validate that raw account data matches this schema.
    ///
    /// Default implementation checks:
    /// 1. Data length == LEN
    /// 2. Discriminator matches (if DISCRIMINATOR is Some)
    fn validate(data: &[u8]) -> Result<(), ProgramError> {
        if data.len() != Self::LEN {
            return Err(GeppettoError::InvalidAccountLen.into());
        }
        if let Some(d) = Self::DISCRIMINATOR {
            if data.is_empty() || data[0] != d {
                return Err(ProgramError::InvalidAccountData);
            }
        }
        Ok(())
    }
}
```

**使用示例（agent 看到的）：**

```rust
#[repr(C)]
pub struct Escrow;

impl AccountSchema for Escrow {
    const LEN: usize = 74;       // 1 + 1 + 32 + 32 + 8
    const DISCRIMINATOR: Option<u8> = Some(1);
}

impl Escrow {
    // Field offsets — agent 可直接读取这些常量来生成客户端代码
    pub const DISCRIMINATOR_OFFSET: usize = 0;  // u8, 1 byte
    pub const STATUS_OFFSET: usize = 1;         // u8, 1 byte
    pub const MAKER_OFFSET: usize = 2;          // Address, 32 bytes
    pub const TAKER_OFFSET: usize = 34;         // Address, 32 bytes
    pub const AMOUNT_OFFSET: usize = 66;        // u64 LE, 8 bytes
}
```

#### 2c. dispatch.rs — FR-4

**设计原则**：纯文档模式 + 辅助函数，不使用宏。agent 看到 dispatch 模式后直接复制使用。

````rust
//! # Instruction Dispatch
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//!
//! Standard pattern: first byte of instruction data is the tag.
//!
//! ```rust,ignore
//! pub fn process_instruction(
//!     program_id: &Address,
//!     accounts: &mut [AccountView],
//!     data: &[u8],
//! ) -> ProgramResult {
//!     let (tag, rest) = data.split_first()
//!         .ok_or(ProgramError::InvalidInstructionData)?;
//!     match tag {
//!         0 => instructions::create::process(program_id, accounts, rest),
//!         1 => instructions::update::process(program_id, accounts, rest),
//!         2 => instructions::close::process(program_id, accounts, rest),
//!         _ => Err(ProgramError::InvalidInstructionData),
//!     }
//! }
//! ```
//!
//! **Rules:**
//! - No `_ => Ok(())` — unknown instructions MUST error
//! - Each instruction handler in its own file under `instructions/`
//! - Account validation in handler, before business logic

/// Split instruction data into (tag, remaining_data).
///
/// Returns `InvalidInstructionData` if data is empty.
pub fn split_tag(data: &[u8]) -> Result<(u8, &[u8]), ProgramError> {
    data.split_first()
        .map(|(&tag, rest)| (tag, rest))
        .ok_or(ProgramError::InvalidInstructionData)
}
````

#### 2d. error.rs

```rust
//! Geppetto-specific error codes.
//!
//! Used only when pinocchio's built-in ProgramError variants
//! are insufficient. Keep this minimal.

use pinocchio::error::ProgramError;

/// Geppetto custom errors, starting at offset 0x4700.
#[repr(u32)]
pub enum GeppettoError {
    /// Account discriminator does not match expected value.
    InvalidDiscriminator = 0x4700,
    /// Account data length does not match schema LEN.
    InvalidAccountLen = 0x4701,
    /// PDA derivation does not match expected address.
    PdaMismatch = 0x4702,
    /// Account is writable but was expected to be read-only.
    ExpectedReadonly = 0x4703,
}

impl From<GeppettoError> for ProgramError {
    fn from(e: GeppettoError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

### 3. 知识层（代码 + 文档 混合）

知识层模块分两类：**代码 + 知识**（导出可调用的 helper）和**纯知识**（只有 doc comments）。

所有模块共享版本头格式：

```rust
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! If pinocchio version differs or knowledge is >3 months old,
//! verify patterns before using. See AGENTS.md Knowledge Freshness Rules.
```

#### 3a. idioms.rs — 代码 + 知识（FR-5）

导出常用模式的 helper 函数，doc comments 包含完整知识（为什么这样做、替代方案、注意事项）。

````rust
//! # Solana/Pinocchio Idioms
//!
//! Helper functions for common Pinocchio patterns.
//! Each function is a codified best practice from the official
//! programs (escrow, rewards, token).

use pinocchio::{account::AccountView, error::ProgramError, address::Address, ProgramResult};

/// Close an account safely: zero data, drain lamports to recipient.
///
/// # Why use this
/// Improper account closure is a known attack vector (close account drain).
/// This function zeros all data before transferring lamports.
pub fn close_account(
    account: &mut AccountView,
    recipient: &mut AccountView,
) -> ProgramResult;

/// Read a little-endian u64 from account data at the given offset.
///
/// # Why use this
/// Manual byte slicing is error-prone. This function handles
/// bounds checking and endianness.
pub fn read_u64_le(data: &[u8], offset: usize) -> Result<u64, ProgramError>;

/// Write a little-endian u64 to account data at the given offset.
pub fn write_u64_le(data: &mut [u8], offset: usize, value: u64) -> Result<(), ProgramError>;

/// Read a 32-byte Address from account data at the given offset.
pub fn read_address(data: &[u8], offset: usize) -> Result<Address, ProgramError>;
````

Doc comments 中还覆盖以下**纯知识话题**（无导出函数，只有文档）：

- CPI 两种风格（简单 vs 优化）的选择指南
- Batch CPI 使用场景
- self-CPI 事件发射模式（discriminator 228）
- TLV 扩展模式
- Token/Token-2022 双支持策略

#### 3b. testing.rs — 代码 + 知识（FR-7）

导出测试工具函数。在 crate 中通过 `#[cfg(feature = "test-utils")]` 门控，用户项目的 `[dev-dependencies]` 启用。

```rust
//! # Testing Utilities
//!
//! Helper functions for testing Pinocchio programs with litesvm/mollusk-svm.
//! Enable with: `geppetto = { features = ["test-utils"] }`

use pinocchio::address::Address;

/// Create a deterministic address for testing.
///
/// # Why use this
/// Tests need reproducible addresses. This generates an address
/// from a human-readable seed string.
pub fn test_address(seed: &str) -> Address;

/// Assert that account data at a given offset equals expected bytes.
///
/// # Why use this
/// Manual account data comparison is verbose. This helper gives
/// clear error messages on mismatch with offset context.
pub fn assert_account_data(
    data: &[u8],
    offset: usize,
    expected: &[u8],
    field_name: &str,
);

/// Assert that an account's discriminator matches the expected value.
pub fn assert_discriminator(data: &[u8], expected: u8);
```

Doc comments 中还覆盖**纯知识话题**：

- litesvm vs mollusk-svm vs bankrun 选择指南
- 测试环境搭建模式
- CU profiling 方法

#### 3c. anti\_patterns.rs — 纯文档（FR-5）

无导出代码，纯 doc comments + `should_panic` / `compile_fail` 示例。

#### 3d. client.rs — 纯文档（FR-6）

无导出代码，TypeScript 示例写在 doc comments 中。

**各模块总结：**

| 模块                 | 类型                                                 | 导出代码                          | 知识话题                            | doctest          |
| ------------------ | -------------------------------------------------- | ----------------------------- | ------------------------------- | ---------------- |
| `idioms.rs`        | 代码 + 知识                                            | 账户关闭、数据读写 helpers（close_account、read_u64_le、write_u64_le、read_address） | CPI 风格、Batch CPI、事件、TLV         | 是                |
| `testing.rs`       | 代码 + 知识                                            | 测试断言、mock 工具（feature-gated）   | litesvm/mollusk 选择、CU profiling | 部分               |
| `anti_patterns.rs` | 纯文档                                                | 无                             | 6+ 常见漏洞的错误/正确对比                 | 是（should\_panic） |
| `client.rs`        | 纯文档                                                | 无                             | 交易构建、PDA、反序列化                   | 否（TypeScript）    |
| `testing.rs`       | litesvm/mollusk-svm 环境搭建、交易构建与提交、状态断言、CU profiling | Rust 示例：部分（需要测试环境的无法 doctest） |                                 |                  |

### 4. Agent 指引文件 — FR-8

不同 AI code agent 读取不同的指引文件。策略：**一份内容（AGENTS.md），多个入口文件引用它**。

```
项目根目录/
├── AGENTS.md              ← 唯一真相来源（完整内容）
├── CLAUDE.md              ← Claude Code 读取，include AGENTS.md
├── GEMINI.md              ← Gemini 读取，include AGENTS.md
├── .cursor/rules          ← Cursor 读取，include AGENTS.md
└── .github/
    └── copilot-instructions.md  ← GitHub Copilot 读取，include AGENTS.md
```

**AGENTS.md**（完整内容）：

```markdown
# Geppetto — Agent Instructions

## Your training data is outdated

Do NOT rely on memorized Solana/Pinocchio patterns.
Read geppetto's doc comments as the source of truth:
- `geppetto::guard` — security checks
- `geppetto::schema` — account layouts
- `geppetto::dispatch` — instruction routing
- `geppetto::idioms` — approved patterns
- `geppetto::anti_patterns` — what NOT to do
- `geppetto::client` — TypeScript client patterns
- `geppetto::testing` — test patterns

## Mechanical Rules

1. All accounts MUST implement `AccountSchema`
2. All account access MUST use `guard::*` helpers
3. Instruction dispatch MUST use single-byte tag + match
4. No `_ => Ok(())` — unknown instructions must error
5. Import from `geppetto::*`, not `pinocchio::*`

## Feature Selection

Choose geppetto features based on your program's needs:
- Transfer SOL / create accounts → `features = ["system"]`
- SPL Token operations → `features = ["system", "token-all"]`
- Need everything → `features = ["full"]`
- Only knowledge + guard + schema → no features needed (default)

## Knowledge Freshness Rules

Every knowledge module has a version/date header.

1. Before using any pattern, check the knowledge version against:
   - The pinocchio version in this project's Cargo.toml
   - Today's date
2. If pinocchio version differs OR knowledge is >3 months old:
   - Verify the pattern by checking pinocchio's changelog
   - If verified: update the date
   - If outdated: adapt and note the change
3. DO NOT silently use knowledge you suspect may be outdated.
```

**CLAUDE.md**（引用入口）：

```markdown
@AGENTS.md
```

Claude Code 的 `@` 语法会自动 include AGENTS.md 的全部内容。

**其他 agent 入口文件**（均指向 AGENTS.md）：

```markdown
Read and follow all instructions in AGENTS.md in this repository.
```

不支持 include 语法的 agent，用自然语言指向 AGENTS.md。内容只维护一份。

**Agent 覆盖表：**

| Agent                     | 文件                                | 备注                      |
| ------------------------- | --------------------------------- | ----------------------- |
| Claude Code               | `CLAUDE.md`                       | `@AGENTS.md` include 语法 |
| OpenAI Codex / Pi / Droid | `AGENTS.md`                       | 直接读取，无需额外入口             |
| Cursor                    | `.cursor/rules/geppetto.md`       | 指向 AGENTS.md            |
| Gemini                    | `GEMINI.md`                       | 指向 AGENTS.md            |
| GitHub Copilot            | `.github/copilot-instructions.md` | 指向 AGENTS.md            |
| Windsurf                  | `.windsurf/rules/geppetto.md`     | 指向 AGENTS.md            |
| Amazon Q                  | `.amazonq/rules/geppetto.md`      | 指向 AGENTS.md            |
| Aider                     | `.aider.conf.yml`                 | `read: AGENTS.md` 配置项   |

**`npx geppetto-cli init`**\*\* 生成所有入口文件：\*\*

```
geppetto-cli init 做的事：
1. 生成 AGENTS.md（完整内容）
2. 生成 CLAUDE.md（@AGENTS.md）
3. 生成 GEMINI.md（指向 AGENTS.md）
4. 生成 .cursor/rules/geppetto.md（指向 AGENTS.md）
5. 生成 .github/copilot-instructions.md（指向 AGENTS.md）
6. 生成 .windsurf/rules/geppetto.md（指向 AGENTS.md）
7. 生成 .amazonq/rules/geppetto.md（指向 AGENTS.md）
8. 追加 .aider.conf.yml（read: AGENTS.md）
```

## 依赖图（Cargo.toml）

```toml
[package]
name = "geppetto"
version = "0.1.0"
edition = "2024"

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

## Examples 架构（escrow demo）

Escrow 示例遵循官方 escrow/rewards 仓库的文件结构，但全部使用 Geppetto 约定：

```
examples/escrow/src/
├── lib.rs              ← entrypoint!, 调用 processor::dispatch
├── processor.rs        ← dispatch::split_tag + match
├── state.rs            ← impl AccountSchema for Escrow/Receipt
├── error.rs            ← 程序自定义错误
└── instructions/
    ├── mod.rs
    ├── create.rs       ← guard::assert_signer + guard::assert_pda + 写入数据
    └── exchange.rs     ← guard 全套 + Token CPI
```

每个 instruction 文件的标准结构：

```rust
// instructions/create.rs
use geppetto::{guard, ProgramResult, AccountView, Address};
use crate::state::Escrow;

pub fn process(
    program_id: &Address,
    accounts: &mut [AccountView],
    data: &[u8],
) -> ProgramResult {
    // 1. 解析账户
    let maker = &accounts[0];
    let escrow = &accounts[1];

    // 2. 安全检查（guard 层）
    guard::assert_signer(maker)?;
    guard::assert_writable(maker)?;
    guard::assert_writable(escrow)?;
    guard::assert_pda(escrow, &[b"escrow", maker.address().as_ref()], program_id)?;

    // 3. 业务逻辑
    // ... 写入 Escrow 数据，偏移量来自 Escrow::*_OFFSET 常量

    Ok(())
}
```

## 关键架构决策

| 决策                 | 选择                                            | 理由                                                                                          |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `#![no_std]`       | 是                                             | 与 Pinocchio 一致，Solana BPF 程序标准                                                              |
| guard 返回类型         | `Result<(), ProgramError>`                    | 用 `?` 链式调用，与 Pinocchio 风格一致                                                                 |
| AccountSchema 字段偏移 | `impl` 块中的 `pub const`                        | 不是 trait method（不需要动态派发），const 可被 agent 和编译器同时使用                                            |
| 知识层混合策略            | idioms/testing 导出代码，anti\_patterns/client 纯文档 | agent 不只读知识还能直接调用 helper——"读到就能用"比"读到还要自己写"体验好得多                                            |
| 自定义错误偏移            | `0x4700` 起始                                   | 避免与 Pinocchio 内置错误码和用户程序错误码冲突                                                               |
| dispatch helper    | 仅 `split_tag()` 函数                            | 不做 trait/宏，dispatch 逻辑应由 agent 在 processor.rs 中显式写 match                                    |
| feature 默认值        | `default = []`（最小）                            | 核心 SDK（guard/schema/dispatch/知识）不依赖任何 CPI helper，用户按需加 feature。提供 `token-all` 和 `full` 预设组合 |

## Phase 2 验收标准

- [x] 模块结构明确（透传层 + 约定代码层 + 知识文档层）
- [x] 模块间依赖无循环
- [x] 每个 FR 有对应的模块/文件
- [x] Cargo.toml 依赖和 feature gates 设计完成
- [x] 关键 API 签名已草拟（guard、schema、dispatch、error）
- [x] 知识模块结构（版本头 + 正反例 + doctest）已定义
- [x] AGENTS.md 内容已设计
- [x] Examples 架构遵循官方模式
- [x] 可进入 Phase 3: Technical Spec


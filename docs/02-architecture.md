# Phase 2: Architecture — Geppetto

> 状态：草稿
> 日期：2026-04-13
> 输入：Phase 0 商业验证 + Phase 1 PRD

---

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

## 模块结构

```
geppetto/
├── Cargo.toml
├── AGENTS.md                        ← FR-8：agent 指引（唯一真相来源）
├── CLAUDE.md                        ← Claude Code 入口（@AGENTS.md）
├── GEMINI.md                        ← Gemini 入口
├── .cursor/rules                    ← Cursor 入口
├── .github/copilot-instructions.md  ← GitHub Copilot 入口
├── src/
│   ├── lib.rs                       ← FR-1：crate 入口 + pinocchio re-export
│   │
│   │  ── 约定代码层 ──
│   ├── guard.rs                     ← FR-3：安全检查 helpers
│   ├── schema.rs                    ← FR-2：AccountSchema trait
│   ├── dispatch.rs                  ← FR-4：指令分发模式
│   ├── error.rs                     ← Geppetto 自定义错误码
│   │
│   │  ── 知识文档层（纯 doc comments，无导出代码）──
│   ├── idioms.rs                    ← FR-5：惯用法
│   ├── anti_patterns.rs             ← FR-5：反模式
│   ├── client.rs                    ← FR-6：客户端知识
│   └── testing.rs                   ← FR-7：测试知识
│
├── examples/
│   └── escrow/                      ← FR-9：示例程序
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
└── tests/
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
  ├── idioms.rs ─────→ (纯文档，doctest 依赖 geppetto 自身)
  ├── anti_patterns.rs → (纯文档)
  ├── client.rs ─────→ (纯文档，TypeScript 示例)
  └── testing.rs ────→ (纯文档)
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

// 纯知识模块
pub mod idioms;
pub mod anti_patterns;
pub mod client;
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
```

**用法示例（AGENTS.md 和 doc comments 里都要写清楚）：**

```toml
# 最小：只要 guard + schema + 知识，不做任何 CPI
geppetto = "0.1"

# 需要转 SOL
geppetto = { version = "0.1", features = ["system"] }

# 需要 SPL Token 操作（最常见）
geppetto = { version = "0.1", features = ["system", "token-all"] }

# 全部拉入
geppetto = { version = "0.1", features = ["full"] }
```

**AGENTS.md 里的 feature 选择指引：**

agent 看到用户的需求后，按以下规则选择 features：

- 程序需要创建账户或转 SOL → 加 `system`
- 程序需要操作 SPL Token → 加 `token-all`（含 token + token-2022 + ata）
- 程序需要写 memo 日志 → 加 `memo`
- 不确定 → 用 `full`

### 2. 约定代码层

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

use pinocchio::{account_info::AccountInfo, program_error::ProgramError, pubkey::Pubkey};

/// Assert that the account is a signer of the transaction.
///
/// # Why this matters
/// Missing signer checks allow anyone to impersonate authorized users.
/// This is the #1 most common Solana vulnerability.
///
/// # Errors
/// Returns `ProgramError::MissingRequiredSignature` if not a signer.
pub fn assert_signer(account: &AccountInfo) -> Result<(), ProgramError>;

/// Assert that the account is writable.
pub fn assert_writable(account: &AccountInfo) -> Result<(), ProgramError>;

/// Assert that the account is owned by the expected program.
pub fn assert_owner(account: &AccountInfo, expected_owner: &Pubkey) -> Result<(), ProgramError>;

/// Assert that the account's address matches the expected PDA.
pub fn assert_pda(
    account: &AccountInfo,
    seeds: &[&[u8]],
    program_id: &Pubkey,
) -> Result<(), ProgramError>;

/// Assert that the first byte of account data matches the expected discriminator.
pub fn assert_discriminator(account: &AccountInfo, expected: u8) -> Result<(), ProgramError>;

/// Assert that the account is rent exempt.
pub fn assert_rent_exempt(account: &AccountInfo) -> Result<(), ProgramError>;
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
    const DISCRIMINATOR: u8;

    /// Validate that raw account data matches this schema.
    ///
    /// Checks: data length == LEN, first byte == DISCRIMINATOR.
    fn validate(data: &[u8]) -> Result<(), ProgramError> {
        if data.len() != Self::LEN {
            return Err(ProgramError::InvalidAccountData);
        }
        if data[0] != Self::DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
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
    const DISCRIMINATOR: u8 = 1;
}

impl Escrow {
    // Field offsets — agent 可直接读取这些常量来生成客户端代码
    pub const DISCRIMINATOR_OFFSET: usize = 0;  // u8, 1 byte
    pub const STATUS_OFFSET: usize = 1;         // u8, 1 byte
    pub const MAKER_OFFSET: usize = 2;          // Pubkey, 32 bytes
    pub const TAKER_OFFSET: usize = 34;         // Pubkey, 32 bytes
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
//!     program_id: &Pubkey,
//!     accounts: &[AccountInfo],
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

use pinocchio::program_error::ProgramError;

/// Geppetto custom errors, starting at offset 0x4700.
#[repr(u32)]
pub enum GeppettoError {
    /// Account discriminator does not match expected value.
    InvalidDiscriminator = 0x4700,
    /// Account data length does not match schema LEN.
    InvalidAccountLen = 0x4701,
    /// PDA derivation does not match expected address.
    PdaMismatch = 0x4702,
    /// Account is not rent exempt.
    NotRentExempt = 0x4703,
}

impl From<GeppettoError> for ProgramError {
    fn from(e: GeppettoError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

### 3. 知识文档层

四个纯文档模块共享相同的结构：

````rust
//! # Module Title
//!
//! > **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
//! > **Verified against**: Solana 2.2.x
//!
//! If pinocchio version differs or knowledge is >3 months old,
//! verify patterns before using. See AGENTS.md Knowledge Freshness Rules.
//!
//! ## Topic 1
//!
//! [问题描述]
//!
//! ### Wrong (don't do this)
//! ```rust,should_panic
//! // 错误示例
//! ```
//!
//! ### Correct
//! ```rust
//! // 正确示例（doctest 验证）
//! ```
//!
//! ## Topic 2
//! ...
````

**各模块覆盖内容：**

| 模块                 | 内容                                                                                             | doctest                                    |
| ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `idioms.rs`        | PDA 推导、CPI（简单 vs 优化）、Token/Token-2022、Batch CPI、self-CPI 事件、TLV 扩展                             | Rust 示例：是                                  |
| `anti_patterns.rs` | missing signer、unchecked owner、PDA 种子碰撞、close account drain、unbounded alloc、catch-all dispatch | Rust 示例：是（`should_panic` / `compile_fail`） |
| `client.rs`        | 交易构建、PDA 推导（必须匹配合约侧种子）、账户反序列化（偏移量匹配 AccountSchema）、错误处理                                        | TypeScript 示例：否（手动 + 端到端测试验证）              |
| `testing.rs`       | litesvm/mollusk-svm 环境搭建、交易构建与提交、状态断言、CU profiling                                             | Rust 示例：部分（需要测试环境的无法 doctest）              |

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

**GEMINI.md / .cursor/rules / copilot-instructions.md**（引用入口）：

```markdown
Read and follow all instructions in AGENTS.md in this repository.
```

不支持 include 语法的 agent，用自然语言指向 AGENTS.md。内容只维护一份。

**`npx geppetto-cli init`**\*\* 生成所有入口文件\*\*：

```
geppetto-cli init 做的事：
1. 生成 AGENTS.md（完整内容）
2. 生成 CLAUDE.md（@AGENTS.md）
3. 生成 GEMINI.md（指向 AGENTS.md）
4. 生成 .cursor/rules（指向 AGENTS.md）
5. 生成 .github/copilot-instructions.md（指向 AGENTS.md）
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
use geppetto::{guard, ProgramResult, AccountInfo, Pubkey};
use crate::state::Escrow;

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // 1. 解析账户
    let maker = &accounts[0];
    let escrow = &accounts[1];

    // 2. 安全检查（guard 层）
    guard::assert_signer(maker)?;
    guard::assert_writable(maker)?;
    guard::assert_writable(escrow)?;
    guard::assert_pda(escrow, &[b"escrow", maker.key().as_ref()], program_id)?;

    // 3. 业务逻辑
    // ... 写入 Escrow 数据，偏移量来自 Escrow::*_OFFSET 常量

    Ok(())
}
```

## 关键架构决策

| 决策                 | 选择                         | 理由                                                                                          |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------------- |
| `#![no_std]`       | 是                          | 与 Pinocchio 一致，Solana BPF 程序标准                                                              |
| guard 返回类型         | `Result<(), ProgramError>` | 用 `?` 链式调用，与 Pinocchio 风格一致                                                                 |
| AccountSchema 字段偏移 | `impl` 块中的 `pub const`     | 不是 trait method（不需要动态派发），const 可被 agent 和编译器同时使用                                            |
| 知识模块导出             | `pub mod` 但无 `pub` items   | 模块存在于 `cargo doc` 但不污染命名空间                                                                  |
| 自定义错误偏移            | `0x4700` 起始                | 避免与 Pinocchio 内置错误码和用户程序错误码冲突                                                               |
| dispatch helper    | 仅 `split_tag()` 函数         | 不做 trait/宏，dispatch 逻辑应由 agent 在 processor.rs 中显式写 match                                    |
| feature 默认值        | `default = []`（最小）         | 核心 SDK（guard/schema/dispatch/知识）不依赖任何 CPI helper，用户按需加 feature。提供 `token-all` 和 `full` 预设组合 |

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


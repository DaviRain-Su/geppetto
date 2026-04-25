# Migration Guide: Unified Account Schema Pattern

> **Version**: geppetto 0.1.0 → 0.2.0  
> **Date**: 2026-04-14  
> **Impact**: Clarification only; no breaking changes to API

## Overview

Geppetto 0.2.0 unifies the account schema pattern documentation to make it crystal clear that **unit struct + offset constants** is the canonical, recommended approach for most programs. The unsafe zero-copy methods (`from_bytes_unchecked`, `try_from_account`) are repositioned as advanced escape hatches, not defaults.

## What Changed

### 1. `AccountSchema` Trait Documentation (src/schema.rs)

**Before**: Trait docs said "Implementors MUST be `#[repr(C)]`" — which contradicted the safer unit struct approach shown in examples.

**After**: 
- Trait docs now clearly recommend **unit struct + offset constants**
- `#[repr(C)]` is documented as "Advanced: only if you need struct field access AND handle alignment explicitly"
- Example code shows unit struct implementation with practical byte-reading patterns

### 2. Anti-Patterns Module Reframing (src/anti_patterns.rs)

**Before**: Named "Anti Patterns" — passive list of "what not to do"

**After**: Renamed to **"Security Review Checklist"**
- Now positioned as **mandatory guardrails** before deployment
- Each vulnerability has a straightforward Geppetto fix
- Intended as a code review checklist, not optional advice

### 3. Program Architecture (src/idioms/architecture.rs)

**Before**: Single structure recommendation for all programs

**After**: Added program size tiers
| Tier | Size | Structure |
|------|------|-----------|
| Tiny | 1–2 instructions | Single file OK |
| Small | 3–5 instructions | Separate entrypoint, state, errors |
| Medium | 6+ instructions | Per-instruction `accounts.rs` + `processor.rs` |
| Large | Multiple features | Full separation with traits and utils |

**Key rule**: Validation and business logic separation is **always required**.

## Migration Path by Use Case

### Case 1: New Programs (Starting Fresh)

**Action**: No action needed. Follow the docs as updated.

```rust
// ✅ RECOMMENDED: Unit struct + offset constants
pub struct Escrow;
impl AccountSchema for Escrow {
    const LEN: usize = 74;
    const DISCRIMINATOR: Option<u8> = Some(1);
    fn layout() -> &'static [(&'static str, &'static str, usize, usize)] { &[...] }
}
impl Escrow {
    pub const MAKER_OFFSET: usize = 2;
    pub const AMOUNT_OFFSET: usize = 66;
}

// Read data using offsets
let data = account.try_borrow()?;
Escrow::validate(&data)?;
let maker_bytes = &data[Escrow::MAKER_OFFSET..Escrow::MAKER_OFFSET + 32];
```

### Case 2: Existing Programs Using Unit Struct + Offsets

**Action**: No action needed. Your code is already canonical.

Example: `examples/escrow/src/state.rs` already follows this pattern perfectly.

### Case 3: Existing Programs Using `#[repr(C)]` Struct

**If your struct has no padding issues**: You can keep it as-is, but document it.

```rust
// Add a doc comment clarifying this is an advanced/specialized use case
/// ⚠️ Advanced: #[repr(C)] with explicit padding.
/// Used for zero-copy perf optimization.
/// See geppetto/src/schema.rs for unit struct pattern (recommended for most programs).
#[repr(C)]
pub struct Escrow {
    pub discriminator: u8,
    pub _padding: [u8; 7],  // MUST be explicit!
    pub amount: u64,
}
```

Then use `assert_account_size!(Escrow)` to catch padding mismatches at compile time.

### Case 4: Existing Programs Using Unsafe Zero-Copy

**If using `from_bytes_unchecked` or `try_from_account`**: You should add a safety comment.

```rust
// ⚠️ Performance-critical code: using unsafe zero-copy.
// For non-critical paths, use manual byte reads with offset constants.
unsafe {
    let account = MyAccount::from_bytes_unchecked(&data);
    // ... use account fields
}
```

## Recommended Reading Order for Agents

When working on Geppetto projects:

1. **First**: Read `src/schema.rs` — understand `AccountSchema` and the unit struct pattern
2. **Second**: Read `src/anti_patterns.rs` — security review checklist before any instruction logic
3. **Third**: Read `src/idioms/architecture.rs` — apply the right structure for your program size
4. **Fourth**: Read examples (`examples/escrow/`) — see the pattern in practice

## FAQ

### Q: Should I refactor my existing `#[repr(C)]` structs to unit structs?

**A**: Only if you're planning major changes. The refactor is mechanical but touches multiple files:
- Replace struct with unit struct
- Add offset constants
- Update all field accesses to slice indexing
- Remove `assert_account_size!` macro

For a 74-byte escrow account, this is typically 30–60 lines of changes.

### Q: Is `from_bytes_unchecked` being deprecated?

**A**: No. It's still available and useful for performance-critical code. We're just repositioning it as an **escape hatch**, not the default. Use manual byte reads for normal instruction processing.

### Q: Can I still use `#[repr(C)]`?

**A**: Yes, but:
1. Explicit padding fields only (`pub _padding: [u8; N]`)
2. Verify with `assert_account_size!` at compile time
3. Document why you chose `#[repr(C)]` over unit struct + offsets
4. See `anti_patterns.rs` section on padding for the gotcha

### Q: Does this affect the API surface?

**A**: No. All types, traits, and functions remain unchanged. This is documentation and guidance clarification only.

## Validation Checklist

Before deploying a program using updated Geppetto:

- [ ] `AccountSchema` impl uses unit struct or explicitly padded `#[repr(C)]`
- [ ] All offset constants are defined and used for byte access
- [ ] `assert_account_size!` compiles successfully (if using `#[repr(C)]`)
- [ ] `guard::assert_signer`, `assert_owner`, etc. called on first line of authorization-sensitive instructions
- [ ] Every instruction has dedicated `accounts.rs` with validation, separate `processor.rs` with logic
- [ ] `anti_patterns.rs` checklist reviewed: no missing signer checks, no unchecked owners, no catch-all dispatch, etc.
- [ ] All `unsafe` blocks have safety comments explaining why they're sound

## Questions?

See `src/schema.rs`, `src/anti_patterns.rs`, and `AGENTS.md` for more context.

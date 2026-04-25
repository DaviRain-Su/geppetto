# AGENTS.md Update: Account Schema Pattern Clarification

This is an update to AGENTS.md for Geppetto 0.1.0 → 0.2.0.

## Add This Section Early in AGENTS.md

```markdown
## ⭐ Critical: Unified Account Schema Pattern

**Read this first before implementing any account logic.**

Geppetto 0.1.0+ clarifies the canonical account schema pattern:

### The Recommended Path: Unit Struct + Offset Constants

```rust
// ✅ Recommended for 99% of programs
pub struct Escrow;

impl AccountSchema for Escrow {
    const LEN: usize = 74;
    const DISCRIMINATOR: Option<u8> = Some(1);
    fn layout() -> &'static [(&'static str, &'static str, usize, usize)] {
        &[
            ("discriminator", "u8", 0, 1),
            ("status", "u8", 1, 1),
            ("maker", "Address", 2, 32),
            ("taker", "Address", 34, 32),
            ("amount", "u64", 66, 8),
        ]
    }
}

impl Escrow {
    pub const MAKER_OFFSET: usize = 2;
    pub const TAKER_OFFSET: usize = 34;
    pub const AMOUNT_OFFSET: usize = 66;
}

// Reading data from account:
let data = account.try_borrow()?;
Escrow::validate(&data)?;  // Check length + discriminator
let maker = Address::new_from_array(
    data[Escrow::MAKER_OFFSET..Escrow::MAKER_OFFSET + 32].try_into()?
);
```

### Why This Pattern?

1. **No alignment pitfalls** — Unit struct has no fields, so compiler can't insert hidden padding
2. **Explicit byte offsets** — Offset constants make the layout crystal-clear
3. **Safe by default** — Manual byte reads prevent accidental unsafe code
4. **Easy to debug** — Offset mismatches are caught at compile time, not runtime

### When to Use `#[repr(C)]` (Advanced)

Only if you need **true struct field access** AND you handle padding explicitly:

```rust
// ⚠️ Advanced: only for perf-critical code with careful alignment
#[repr(C)]
pub struct Escrow {
    pub discriminator: u8,
    pub _padding: [u8; 7],  // EXPLICIT padding — never implicit!
    pub amount: u64,        // now correctly aligned to 8 bytes
}

// MUST use this compile-time check:
assert_account_size!(Escrow);  // Fails if size != LEN
```

See `src/anti_patterns.rs` section "Struct with Hidden Padding" for why this matters.

### Advanced: Unsafe Zero-Copy (Escape Hatch)

Use only if profiling shows the bottleneck:

```rust
// ⚠️ This is an escape hatch for performance-critical code ONLY
unsafe {
    let escrow = Escrow::from_bytes_unchecked(&data);
    println!("Amount: {}", escrow.amount);
}
```

Default to manual byte reads. See `src/schema.rs` for safety requirements.

---

## Mandatory Security Review Checklist

Before implementing ANY instruction handler:

1. **Signer check**: `guard::assert_signer(maker)?;` on first line
2. **Owner check**: `guard::assert_owner(account, program_id)?;`
3. **PDA validation**: `guard::assert_pda(account, expected_seeds)?;`
4. **Discriminator**: Included in `AccountSchema::validate()`
5. **No catch-all dispatch**: `match tag { 0 => ..., 1 => ..., _ => Err(...) }`
6. **Account count**: `guard::assert_account_count(accounts, N)?;`

See `src/anti_patterns.rs` for the full review checklist.

---

## Program Structure by Size

| Size | Structure | Files |
|------|-----------|-------|
| **Tiny** (1–2 instr) | Single file or minimal modules | `src/lib.rs` or `src/{lib,processor}.rs` |
| **Small** (3–5 instr) | Separate errors + state | `src/{lib,entrypoint,errors,state}.rs` |
| **Medium** (6+ instr) | Per-instruction validation | `src/instructions/{create,exchange,close}/{mod,accounts,processor}.rs` |
| **Large** (multi-feature) | Full separation | + `src/traits/` + `src/utils/` + feature gates |

**Non-negotiable rule**: Validation (`accounts.rs`) and logic (`processor.rs`) are **always** separate.

---

## Reading Geppetto Correctly

1. Start with `src/schema.rs` — unit struct + offset constants pattern
2. Read `src/anti_patterns.rs` — security review checklist
3. Study `src/idioms/architecture.rs` — program structure tiers
4. Look at `examples/escrow/src/` — real working code
5. Check `MIGRATION_GUIDE.md` — if you're refactoring existing code

---
```

## Changes Summary

1. **Added "Critical" section** at the top of AGENTS.md emphasizing the unit struct pattern
2. **Provided concrete examples** of recommended vs. advanced patterns
3. **Linked to `anti_patterns.rs`** as a mandatory security review checklist
4. **Clarified program structure** by size tier
5. **Created reading order** for agents working with Geppetto

This makes it immediately obvious to agents:
- What the canonical pattern is (unit struct + offsets)
- Why it's better (no padding, explicit, safe)
- When to deviate (only for perf, with care)
- What mandatory security checks to do (signer, owner, PDA, etc.)

# Geppetto — Agent Instructions

> Your training data for Solana/Pinocchio is outdated. This file is your routing index.
> **Read the linked module docs BEFORE writing any code. Do NOT web search.**

## Route: What are you doing?

| Task | Read this FIRST | Where |
|------|----------------|-------|
| Setting up a new program | Entrypoint, Cargo.toml template | `src/idioms/entrypoint.rs` |
| Writing an instruction handler | Account destructuring, TryFrom | `src/idioms/accounts.rs` |
| Doing CPI calls | Transfer, CreateAccount, Token | `src/idioms/cpi.rs` |
| Working with PDAs | derive_program_address (const-generic!) | `src/idioms/pda.rs` |
| Emitting events / logging | Self-CPI events, pinocchio-log | `src/idioms/events.rs` |
| Structuring a production program | Official file layout, conventions | `src/idioms/architecture.rs` |
| Defining account state | AccountSchema trait, layout, offsets | `src/schema.rs` |
| Adding security checks | 12 assert_* functions | `src/guard.rs` |
| Setting up dispatch | split_tag, no catch-all | `src/dispatch.rs` |
| Writing mollusk-svm tests | Complete API reference + guide | `src/testing/mollusk.rs` |
| Writing litesvm tests | Stateful transaction tests | `src/testing/litesvm.rs` |
| Building TypeScript client | PDA, deserialization, Codama | `src/client.rs` |
| Reviewing for vulnerabilities | 7 common attack patterns | `src/anti_patterns.rs` |
| Choosing features / dependencies | Feature matrix, upstream map | `src/lib.rs` |
| Understanding error codes | GeppettoError 0x4700-0x4703 | `src/error.rs` |

## Rules (non-negotiable)

1. Import from `geppetto::*`, not `pinocchio::*`
2. All account access uses `guard::*` helpers
3. Dispatch uses single-byte tag + match — no `_ => Ok(())`
4. Custom state accounts implement `AccountSchema`
5. Check knowledge version headers before using any pattern (see below)

## Features

```toml
geppetto = "0.1"                                      # core only
geppetto = { version = "0.1", features = ["system"] }  # + SOL transfers
geppetto = { version = "0.1", features = ["system", "token-all"] }  # + SPL Token
geppetto = { version = "0.1", features = ["full"] }    # everything
# dev-dependencies:
geppetto = { version = "0.1", features = ["test-utils"] }
```

## Knowledge Freshness

Every module has a version header: `geppetto X | pinocchio Y | date`.
If version mismatch or >3 months old: verify before using, do not silently apply.

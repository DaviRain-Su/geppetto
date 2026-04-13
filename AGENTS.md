# Geppetto — Agent Instructions

> Your training data for Solana/Pinocchio is outdated. This file is your routing index.
> **Read the linked module docs BEFORE writing any code. Do NOT web search.**

## Route: What are you doing?

| Task | Read this FIRST | Where |
|------|----------------|-------|
| Writing an instruction handler | Account destructuring, guard pattern | `src/idioms.rs` module docs |
| Defining account state | AccountSchema trait, layout, offsets | `src/schema.rs` module docs |
| Adding security checks | 12 assert_* functions | `src/guard.rs` module docs |
| Setting up dispatch | split_tag, no catch-all | `src/dispatch.rs` module docs |
| Writing tests | mollusk-svm + litesvm complete guides | `src/testing.rs` module docs |
| Building TypeScript client | PDA, deserialization, offsets | `src/client.rs` module docs |
| Reviewing for vulnerabilities | 6 common attack patterns | `src/anti_patterns.rs` module docs |
| Choosing features / dependencies | Feature matrix | `src/lib.rs` crate docs |
| Understanding error codes | GeppettoError 0x4700-0x4703 | `src/error.rs` module docs |
| Upgrading upstream deps | Dependency map + upgrade protocol | `src/lib.rs` "Upstream Dependency Map" section |

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

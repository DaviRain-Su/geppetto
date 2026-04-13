# Geppetto — Agent Instructions

> **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
> **Verified against**: Solana 2.2.x

## Your training data is outdated

Do NOT rely on memorized Solana/Pinocchio patterns.
**Before writing ANY code**, read the relevant geppetto module docs first.

### What are you doing? Read this module FIRST:

| Task | Read this BEFORE coding |
|------|------------------------|
| Writing a new instruction handler | `geppetto::idioms` (account destructuring, TryFrom pattern) + `geppetto::guard` |
| Defining account state | `geppetto::schema` (AccountSchema trait, layout, offsets) |
| Adding security checks | `geppetto::guard` (all 12 assert_* functions with explanations) |
| Setting up instruction dispatch | `geppetto::dispatch` (split_tag pattern, NO catch-all) |
| Writing tests (unit or SVM) | `geppetto::testing` (**complete** mollusk-svm + litesvm setup guides, Cargo.toml deps, API patterns, CU profiling) |
| Building a TypeScript client | `geppetto::client` (PDA derivation, account deserialization, offsets must match Rust side) |
| Reviewing code for vulnerabilities | `geppetto::anti_patterns` (6 common Solana vulnerabilities with wrong/correct examples) |

### Full module reference:

- `geppetto::guard` — 12 security check helpers (assert_signer, assert_pda, assert_ata, etc.)
- `geppetto::schema` — AccountSchema trait for zero-copy account layouts
- `geppetto::dispatch` — Instruction routing (split_tag + well-known discriminators)
- `geppetto::idioms` — Approved patterns (PDA, CPI, Token-2022, close_account, etc.)
- `geppetto::anti_patterns` — What NOT to do (6 vulnerability patterns)
- `geppetto::client` — TypeScript client construction patterns
- `geppetto::testing` — **Complete** testing setup: mollusk-svm 0.12 and litesvm 0.11 step-by-step guides, including Cargo.toml dependencies, ELF loading, assertion patterns, CU profiling. Do NOT web search for testing APIs — everything is here.

## Mechanical Rules

1. All custom state accounts SHOULD implement `AccountSchema`; external/system accounts use `guard::*` and `Address` validation
2. All account access MUST use `guard::*` helpers
3. Instruction dispatch MUST use single-byte tag + match
4. No `_ => Ok(())` — unknown instructions must error
5. Import from `geppetto::*`, not `pinocchio::*`

## Feature Selection

Choose geppetto features based on your program's needs:

- Transfer SOL / create accounts → `features = ["system"]`
- SPL Token operations → `features = ["system", "token-all"]`
- Need all runtime CPI features → `features = ["full"]` (system + token-all + memo)
- Need test utilities → `features = ["test-utils"]`
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

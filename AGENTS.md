# Geppetto — Agent Instructions

> **Knowledge version**: geppetto 0.1.0 | pinocchio 0.11.x | 2026-04-13
> **Verified against**: Solana 2.2.x

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

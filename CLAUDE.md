# Geppetto — CLAUDE.md

Agent-aware knowledge SDK that makes AI coding agents fluent in Solana/Pinocchio.
Rust crate (`geppetto`) + Node CLI (`geppetto-cli`) + deploy platform.

## Project structure

```
src/              Rust crate — knowledge docs, guard helpers, schema, dispatch
  idioms/         Pinocchio patterns: entrypoint, accounts, cpi, pda, events, architecture
  testing/        mollusk-svm and litesvm test guides
lib/              Node.js CLI internals — init, audit, checks, platform adapters
bin/              CLI entry point (geppetto-cli.js)
tests/cli/        Node.js test suite (node --test)
examples/escrow/  Demo Solana program using Geppetto
examples/escrow-api/  Encore off-chain API for escrow demo
docs/             PRD, architecture, specs, release notes, platform docs
docs/platform/    Deploy platform design docs
```

## Build and test

```bash
# Run all Node.js CLI tests
npm test

# Run docs/knowledge checks
npm run docs:check

# Run Rust tests
cargo test

# Run Rust tests for escrow example
cargo test --manifest-path examples/escrow/Cargo.toml

# Lint Rust
cargo clippy --all-features

# Release readiness
npm run release:check
```

## Key conventions

- Import from `geppetto::*`, never `pinocchio::*` directly
- All account access uses `guard::*` helpers
- Dispatch uses single-byte tag + match — no catch-all `_ => Ok(())`
- Custom state accounts implement `AccountSchema`
- Knowledge modules have version headers — check freshness before using

## Deploy platform (lib/platform/)

`geppetto deploy` orchestrates Solana program builds/deploys and Encore off-chain deploys.
Config lives in `geppetto.toml`. Modes: `hybrid`, `solana-only`.

## Agent knowledge routing

See @AGENTS.md for the full task-to-module routing table.
Read the linked module's doc comments BEFORE writing Solana/Pinocchio code.

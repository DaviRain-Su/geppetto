# Phase 6 PRD — Remaining Toolchain JS to TS

## 1. Problem

Phase 5 only migrated the **core deploy path** to Bun + TypeScript:

- `lib/platform/*`
- `lib/platform/adapters/*`
- `bin/geppetto-cli.ts`
- deploy-path tests

The repository still contains a non-trivial amount of JavaScript in the surrounding toolchain:

- `18` source files under `lib/*.js`
- `15` test files under `tests/cli/*.test.js`

This creates an inconsistent developer experience:

- the main deploy path is TypeScript
- the surrounding init/new/test/audit/release/upstream tooling is still JavaScript
- the repo-level statement “Geppetto tool layer is Bun + TypeScript” is not yet true for the whole toolchain

## 2. Goal

Complete the **remaining toolchain migration** so the repository’s maintained JS/TS tool layer is consistently:

- `Bun` as the runtime/package-manager direction
- `TypeScript` as the maintained implementation language

This phase is about **finishing the remaining migration**, not redesigning behavior.

## 3. In Scope

### 3.1 Source files

Migrate the remaining non-platform toolchain modules from `.js` to `.ts`, including:

- project bootstrap / scaffolding:
  - `lib/init.js`
  - `lib/new.js`
  - `lib/templates.js`
  - `lib/new-manifest.js`
- command/tool dispatch:
  - `lib/test.js`
  - `lib/audit.js`
- documentation / knowledge checks:
  - `lib/knowledge-check.js`
  - `lib/knowledge-manifest.js`
  - `lib/agent-entry-check.js`
  - `lib/feature-matrix-check.js`
- upstream/release/e7 helpers:
  - `lib/upstream-*.js`
  - `lib/release-check.js`
  - `lib/e7-*.js`

### 3.2 Tests

Migrate the corresponding remaining CLI/tooling tests from `.js` to `.ts`.

### 3.3 Wiring and references

Update:

- imports
- script entrypoints
- template references
- test runner commands
- CI references if they still point to removed `.js` paths

## 4. Out of Scope

This phase does **not** include:

- behavior changes or feature redesign
- changing product semantics of `init/new/test/audit/release/upstream`
- Bun runner compatibility redesign for all tests
- refactoring test architecture just to suit Bun limitations
- unrelated platform/deploy pipeline changes

Known Bun compatibility issues may be tracked in parallel, but they are **not** the core acceptance target of this phase.

## 5. Success Criteria

Phase 6 is successful when:

1. The remaining maintained toolchain source files under `lib/` have `.ts` equivalents and the old `.js` versions are removed.
2. The remaining maintained CLI/tooling tests under `tests/cli/` are migrated to `.ts` or explicitly documented as temporary exceptions.
3. Repository references no longer depend on removed `.js` toolchain paths.
4. `npx tsc --noEmit` passes.
5. The agreed CI path remains green using the repo’s chosen short-term runner strategy.
6. Migration is behavior-equivalent: same commands, same outputs, same errors, same artifacts.

## 6. Non-Goals / Guardrails

This phase must preserve:

- command names
- file outputs
- error messages/codes unless TypeScript typing forces a safe equivalent
- existing CLI behavior

This phase must avoid:

- “while we are here” cleanup that changes logic
- rewriting tests into a different testing style unless a compatibility issue explicitly requires it
- mixing migration work with unrelated product changes

## 7. Risks

### Risk 1: Scope creep

The remaining toolchain touches many utilities. There will be pressure to “clean up” behavior while migrating. That should be resisted.

### Risk 2: CI / runner confusion

The repo is Bun-first, but short-term CI may intentionally use `node --test --import tsx` for stability. That is acceptable during migration.

### Risk 3: Hidden path references

Some templates, scripts, and tests may still refer to removed `.js` files after migration. This needs explicit validation.

## 8. Acceptance Anchor for Next Stage

The next document should be:

- `docs/toolchain/02-architecture.md`

It should define:

- remaining module groupings
- migration order
- TS type boundaries for non-platform utilities
- runner/CI strategy during migration

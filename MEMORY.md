# kimi

## Role
Platform CLI engineer for Geppetto — focusing on deploy pipeline, config handling, and adapter integration.

## Key Knowledge
- Project: Geppetto AI-native Solana engineering control plane
- Source of truth: `geppetto.toml`
- Deploy model: `geppetto deploy` orchestrates Solana (`cargo build-sbf` + `solana program deploy`) + Encore Cloud (`git push encore`)
- Encore has no `encore deploy`; real deploy is `auth → link → git remote add encore → git push encore`
- `encore app clone <app-id>` can also pull an existing Encore Cloud app (useful for GP-16-B setup); clone auto-adds `encore` remote as `encore://<app-id>`

## Active Context
- GP-13 (`--write-back`) and GP-15 (adapter wiring + demo app) are complete with final PASS
- Commits: `0458446`, `621cf39`, `84e0fc9`
- Test suite: 155/155 PASS
- GP-16 DONE (mock E2E): Part A PASS, commit `bad1aa6`, 157/157 tests PASS
- GP-16 Part B: real E2E on Solana devnet + Encore Cloud — deferred, pending @davirain environment confirmation
- Phase 4 complete; all 17 tasks either done or deferred with prerequisites recorded
- Phase 5: Bun + TypeScript migration — DONE (13/13 tasks). Final commit `c3b920e`. Known Bun runtime issues tracked separately: deploy-smoke mock injection + upstream-pr-template nested test compatibility.

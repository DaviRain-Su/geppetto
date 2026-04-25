# Phase 8: Evolution — GP-16-B Runbook And Next-Step Governance

> Status: active handoff
> Date: 2026-04-16
> Scope: post-Phase-4 operation, hackathon preparation, and real-environment execution

---

## 1. Current State

Platform MVP status:

- Phase 4 closed as `DONE (mock E2E)`
- `17/17` implementation tasks complete for this iteration
- `157/157` tests passing

Remaining operational gate:

- **GP-16-B** = real Solana devnet + Encore Cloud end-to-end run

This document exists to make that run reproducible and low-friction.

---

## 2. Decision Log

### 2.1 What counts as done now

For the current iteration, the team agreed:

- `GP-16-A` mock E2E PASS
- `GP-16-B` deferred with prerequisites documented

Therefore:

- implementation is closed
- real-environment validation is tracked as an execution runbook, not as an unfinished code task

### 2.2 Why GP-16-B is deferred

Because it depends on real operator-controlled resources:

- Solana devnet wallet / keypair / SOL
- Encore Cloud auth
- Encore Cloud app state
- local toolchain and environment state

These are not stable CI assumptions.

---

## 3. GP-16-B Goal

Run one real:

```bash
node bin/geppetto-cli.js deploy --output json --write-back
```

against:

- a real Solana devnet deployment target
- a real Encore Cloud app

and verify that the real run matches the mock-E2E contract closely enough for hackathon demo use.

---

## 4. Prerequisites

## 4.1 Solana side

- `solana` CLI installed and available on PATH
- deploy keypair present
- keypair funded with enough devnet SOL
- `cargo build-sbf` toolchain available

Minimum checks:

```bash
solana --version
solana config get
solana balance
cargo build-sbf --help
```

## 4.2 Encore side

- Encore CLI installed
- logged in via:

```bash
encore auth whoami
```

- app registered / linked / or cloneable on Encore Cloud

## 4.3 Repo state

- clean or intentionally staged Git state
- current repo contains:
  - `geppetto.toml`
  - `examples/escrow`
  - `examples/escrow-api`

---

## 5. Two Valid Prep Paths

The team now knows both of these are valid.

### 5.1 Path A: Existing repo + link path

Use this when working in the existing repo copy.

Steps:

```bash
encore auth whoami
encore app link <app-id>
cat examples/escrow-api/encore.app
```

Notes:

- if the repo lacks an `encore` remote, the adapter will auto-add:

```text
encore://<app-id>
```

Use this path when local code changes should stay in the current repo.

### 5.2 Path B: Clone path

Use this when you want a clean cloud-linked copy quickly.

Steps:

```bash
encore app clone <app-id>
git -C <cloned-dir> remote -v
```

Confirmed behavior:

- cloned repos already contain:

```text
encore  encore://<app-id> (fetch)
encore  encore://<app-id> (push)
```

This path is the safest recovery path if the local working tree becomes noisy before the demo.

---

## 6. Execution Command

From repo root:

```bash
node bin/geppetto-cli.js deploy --output json --write-back
```

Optional override example:

```bash
node bin/geppetto-cli.js deploy --output json --write-back --set cluster=devnet
```

---

## 7. Expected Success Signals

Successful GP-16-B should produce all of the following.

### 7.1 CLI exit status

- exit code `0`

### 7.2 JSON output

Must include:

- `run_id`
- `app_name`
- `cluster`
- `program_id`
- `service_url`
- `provider_deployment_id`
- `status = "success"`
- `failure_class = null`
- `steps[]`

### 7.3 Artifacts

Must exist:

- `.geppetto/deploy-output.json`
- `.geppetto/deploy-output.txt`

### 7.4 Write-back

If `--write-back` is enabled:

- `geppetto.toml` should have `[solana].program_id` populated
- other adjacent lines should remain stable

### 7.5 Operational proof

At minimum:

- Solana program deploy returns a real `program_id`
- Encore side returns a real deploy URL / service URL

---

## 8. Failure Classification

Use the existing contract.

### `config`

Examples:

- missing / invalid `geppetto.toml`
- not logged into Encore
- missing `encore.app` id
- invalid override key / value

### `build`

Examples:

- `cargo build-sbf` failure
- missing binary after build

### `deploy`

Examples:

- Solana deploy failure
- `git push encore` failure
- missing deploy output after a nominally successful command

---

## 9. Suggested Operator Checklist

Run in order:

```bash
git status --short
solana --version
solana balance
encore auth whoami
node --test tests/cli/deploy-smoke.test.js
node bin/geppetto-cli.js deploy --output json --write-back
```

After the deploy:

```bash
cat .geppetto/deploy-output.json
cat geppetto.toml | rg program_id
```

Capture:

- terminal stdout/stderr
- `.geppetto/deploy-output.json`
- final `program_id`
- final Encore deploy URL

---

## 10. Demo-Day Fallbacks

### If current repo state is messy

Use:

```bash
encore app clone <app-id>
```

This gives a clean repo with the `encore://<app-id>` remote already configured.

### If Encore app is linked but remote is missing

Adapter behavior is already designed to recover by adding:

```text
encore://<app-id>
```

### If write-back is not desired during probing

Use:

```bash
node bin/geppetto-cli.js deploy --output json
```

without `--write-back`.

---

## 11. Next Evolution Candidates After GP-16-B

Once the real run is proven, the next likely evolution items are:

1. stabilize real service URL extraction beyond deploy URL fallback
2. document a dedicated hackathon rehearsal script
3. backfill remaining lifecycle docs if desired:
   - `04-task-breakdown.md`
   - `05-test-spec.md`
   - `06-implementation-log.md`
4. decide whether to keep `program_id` write-back as the only mutable manifest field long-term

---

## 12. Final Note

The most important strategic conclusion from this iteration is:

- the architecture held
- the adapter boundary absorbed real Encore CLI surprises cleanly
- the remaining risk is now operational, not conceptual

That is exactly the state we want before hackathon execution.

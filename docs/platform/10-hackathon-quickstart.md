# Geppetto Hackathon Quickstart

This document is the fastest path to a competition-safe Geppetto demo.

It assumes you are running from the repository root and using the current local
CLI entrypoint:

```bash
bun ./bin/geppetto-cli.ts
```

## Goal

In under 5 minutes, show that:

1. the repository is agent-friendly and workflow-driven
2. the deploy path is real
3. a Solana builder can run a stable command contract instead of wiring the
   full process manually

## Recommended Demo Mode

Use one of these two modes:

### Mode A: Hybrid path

Use the repository's current default `geppetto.toml`:
- Solana program: `examples/escrow`
- Off-chain app: `examples/escrow-api`
- deploy mode: `hybrid`

This is the best narrative if you want to show the broader platform story:
on-chain + off-chain + workflow contract.

### Mode B: Solana-only fallback

Use this when the competition environment is unstable or you want the most
reliable demo path.

Use a `geppetto.toml` without `[offchain]` and set:

```toml
[deploy]
mode = "solana"
output = "json"
```

This gives you the cleanest proof that Geppetto can build and deploy the Solana
program without depending on Encore Cloud.

## Prerequisites

Before the demo machine is handed to judges, confirm:

```bash
solana --version
cargo --version
which cargo-build-sbf
bun --version
solana config get
solana balance
```

Minimum expected conditions:
- `solana` CLI available
- `cargo-build-sbf` available
- `bun` available
- the configured keypair exists
- devnet wallet has enough SOL

## Repository Setup

From the repo root:

```bash
bun install
npx tsc --noEmit
npm test
```

Expected result:
- TypeScript check passes
- test suite passes

## Golden Deploy Command

Run:

```bash
bun ./bin/geppetto-cli.ts deploy --output json --write-back
```

If you want the table view instead:

```bash
bun ./bin/geppetto-cli.ts deploy --output table --write-back
```

## What Success Looks Like

The command should produce:

1. a successful build step
2. a successful Solana deploy step
3. a non-empty `program_id`
4. deploy artifacts under `.geppetto/`
5. `program_id` written back into `geppetto.toml`

For hybrid mode, it should also produce:
- a `service_url`
- optionally a `provider_deployment_id`

## Artifacts To Preserve

After a successful run, save:

```bash
cat .geppetto/deploy-output.json
cat .geppetto/deploy-output.txt
cat geppetto.toml
```

These files are useful for:
- proving the deploy path is real
- showing the workflow contract output
- recovering quickly if the live run misbehaves

## Live Demo Safety Order

Use this exact order:

1. Show the repo shape briefly
2. Show `geppetto.toml`
3. Run the deploy command
4. Show the output artifact
5. Show the written-back `program_id`
6. Stop

Do not add extra manual steps in the middle unless something breaks.

## Fallback Strategy

If hybrid mode becomes risky:

1. switch to the solana-only config
2. rerun the same deploy contract
3. still show:
   - build
   - deploy
   - `program_id`
   - artifacts
   - write-back

This preserves the core product claim:
Geppetto turns Solana deployment into a stable, agent-friendly workflow
contract.

## Judge-Facing Explanation

If the judges ask what is important here, answer:

The point is not just that a deployment happened. The point is that the repo,
config, command surface, and outputs are structured so both developers and AI
agents can continue the same workflow reliably.

## Do Not Rely On

Avoid relying on:
- ad hoc shell history
- undocumented local environment tricks
- a second hidden config file
- hand-edited output after deploy

The demo should stand on:
- repo
- config
- one command
- visible output

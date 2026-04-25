# Geppetto 3-Minute Demo Script

This is the judge-facing script for a short live demo.

## One-Sentence Open

Geppetto is an agent-native engineering workflow for Solana builders, and
deploy is the first productionized path.

## Demo Objective

Show that Geppetto is not just “another deploy command,” but a stable workflow
contract that makes a Solana codebase easier for both developers and agents to
understand and operate.

## 0:00 - 0:20 Problem

Say:

On Solana, AI-assisted development still breaks down because each repository is
different, the workflow is implicit, and agents have to reverse-engineer how to
build, test, and deploy before they can contribute safely.

## 0:20 - 0:45 Product Thesis

Say:

Geppetto standardizes that engineering surface. The repo becomes more
agent-friendly, and commands like `new`, `init`, `test`, `audit`, and `deploy`
become executable workflow contracts. Today, the most mature path is deploy.

## 0:45 - 1:10 Show The Repo Contract

Show briefly:
- `docs/platform/`
- `geppetto.toml`
- `examples/escrow`
- `bin/geppetto-cli.ts`

Say:

The important thing is that an agent entering this repo does not have to guess
the structure. The contracts are explicit: docs, config, examples, tests, and
CLI entrypoints all line up.

## 1:10 - 1:50 Show The Config

Open `geppetto.toml`.

Point out:
- app name
- Solana cluster
- program path
- binary path
- keypair path
- deploy mode

Say:

This is the contract surface for deployment. Instead of hidden shell state, the
workflow is declared in config and can be executed consistently.

## 1:50 - 2:30 Run The Deploy Path

Run:

```bash
bun ./bin/geppetto-cli.ts deploy --output json --write-back
```

While it runs, say:

What matters here is not just that a deploy happens. What matters is that the
build, deploy, output artifact, and config write-back are all part of one
stable workflow contract.

## 2:30 - 2:45 Show The Outputs

Show:
- `.geppetto/deploy-output.json`
- `geppetto.toml`

Point out:
- `run_id`
- `program_id`
- `status`
- step logs
- write-back result

Say:

This is the proof artifact. A developer or an agent can now continue from
structured outputs rather than scraping terminal text.

## 2:45 - 3:00 Close

Say:

So the product is not just deployment. The product is an agent-native Solana
engineering workflow. Deploy is simply the first path we fully productized and
verified end-to-end.

## Optional Judge Q&A Answers

### What is already real today?

The repo contract is real, the command surface is real, and the deploy path is
real. We are showing a verified workflow, not a conceptual prototype.

### Why does this matter beyond deployment?

Because once the workflow contracts are stable, the same pattern can extend to
test, audit, release, and submission flows.

### Why is this interesting for AI?

Because AI agents fail less when the repository is structured around explicit
engineering contracts instead of undocumented local process.

## Fallback Close

If the live deploy becomes unstable, say:

Even if the environment is noisy, the product thesis does not change. Geppetto
is about making the engineering workflow legible and executable for both humans
and agents. The deploy path is the first verified vertical of that thesis.

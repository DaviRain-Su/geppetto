---
theme: default
title: Geppetto
info: |
  Geppetto is an agent-native engineering workflow for Solana builders.
class: text-left
drawings:
  persist: false
transition: fade-out
mdc: true
---

# Geppetto

## An agent-native engineering workflow for Solana builders

- Not just a deploy tool
- A repository and workflow model designed for both developers and AI agents
- Deploy is the first productionized path

---
layout: section
---

# The Problem

---

# AI can generate code

# but it still struggles to continue real Solana projects

- Every repository hides workflow assumptions in different places
- Docs, config, examples, and scripts drift apart
- Deploy paths often live in shell history, not in a stable contract
- Agents end up guessing instead of engineering

---

# The missing layer is not another code generator

# The missing layer is a workflow contract

- Stable repo structure
- Stable config surface
- Stable command entrypoints
- Stable outputs that both humans and agents can continue from

---
layout: section
---

# What Geppetto Is

---

# Geppetto is not just deployment

It is a workflow model with three layers:

1. **Repo as contract**
   - docs
   - config
   - examples
   - tests
   - entrypoints

2. **Commands as workflow primitives**
   - `new`
   - `init`
   - `test`
   - `audit`
   - `deploy`

3. **Deploy as proof**
   - the first hard path already productized end-to-end

---

# Why start with deploy?

- It is the easiest path to verify
- It is the hardest path to fake
- It produces visible outputs
- It proves the workflow model is real, not conceptual

---
layout: section
---

# What Exists Today

---

# Current repository state

- Toolchain migrated to **TypeScript**
- Runtime/tooling aligned around **Bun**
- CLI entrypoint is stable and repo-local
- Deploy outputs are structured and persisted
- `program_id` write-back is implemented
- CI is green

---

# Current proof artifact

Run:

```bash
bun ./bin/geppetto-cli.ts deploy --output json --write-back
```

Expected visible outputs:

- build step
- deploy step
- `program_id`
- `.geppetto/deploy-output.json`
- `.geppetto/deploy-output.txt`
- write-back into `geppetto.toml`

---
layout: section
---

# Demo Story

---

# 3-minute demo flow

1. Show the repo shape
2. Open `geppetto.toml`
3. Run:

```bash
bun ./bin/geppetto-cli.ts deploy --output json --write-back
```

4. Show:
   - output artifact
   - `program_id`
   - write-back
5. Close on the workflow thesis

---

# What judges should understand

- The win is not only that deployment succeeds
- The win is that the repo becomes easier for agents and developers to continue
- Geppetto reduces hidden process and turns engineering steps into explicit contracts

---
layout: section
---

# Why This Matters

---

# Why this matters for Solana builders

- Lower repo onboarding cost
- Easier AI-assisted continuation of existing codebases
- More repeatable demos and hackathon workflows
- Less dependence on undocumented local steps

---

# Why this matters for agent workflows

Without workflow contracts, an agent must rediscover:

- where truth lives
- how tests are run
- how config is shaped
- how deploy is executed

Geppetto makes that surface explicit.

---
layout: section
---

# What We Are Not Claiming

---

# Avoid overclaiming

Do **not** say:

- this is already a full autonomous software engineer
- deploy is the entire product
- Geppetto solves every Solana workflow today

Do say:

- this is an agent-native engineering workflow
- deploy is the first productionized path
- the same pattern extends to test, audit, release, and submission flows

---
layout: section
---

# Near-Term Extension

---

# Highest-ROI next steps

- `doctor` / preflight checks
- `deploy --dry-run`
- fixed hackathon demo script
- stronger judge-facing docs

These are workflow extensions, not another rewrite.

---

# Closing line

## Geppetto is an agent-native engineering workflow for Solana builders

### and deploy is the first productionized path.

---

# Appendix

- `docs/platform/09-competition-positioning.md`
- `docs/platform/10-hackathon-quickstart.md`
- `docs/platform/11-demo-script.md`
- `docs/platform/12-website-copy.md`
- `docs/platform/13-pitch-deck.md`

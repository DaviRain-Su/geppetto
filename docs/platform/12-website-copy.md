# Geppetto Website Copy

## Website Goal

The website should explain Geppetto in less than 60 seconds:

1. what problem it solves
2. why it is different from a normal deploy tool
3. why the Agent-native angle matters for Solana builders
4. what is already real today

## Primary Audience

- Solana hackathon judges
- Solana builders
- developer-tooling investors / ecosystem teams
- AI-agent developers looking for reliable repo workflows

## Positioning Anchor

Geppetto is an agent-native engineering workflow for Solana builders, and
deploy is the first productionized path.

## Core Message

Geppetto is not just another CLI.

It makes a Solana repository easier for both developers and AI agents to
understand, continue, validate, and deploy by turning workflow steps into
stable, executable contracts.

## Home Page Structure

### Section 1: Hero

**Headline**

Build Solana projects the way agents actually work.

**Subheadline**

Geppetto is an agent-native engineering workflow for Solana builders. It turns
commands like `new`, `init`, `test`, `audit`, and `deploy` into stable
workflow contracts that both developers and AI agents can execute reliably.

**Primary CTA**

See the 3-minute demo

**Secondary CTA**

Read the quickstart

### Section 2: Problem

**Section title**

Why Solana + AI still breaks in practice

**Copy**

Most AI-assisted coding on Solana is still fragile. Agents can generate code,
but they usually have to reverse-engineer each repository before they can
contribute safely. The docs drift, the workflow is implicit, and the deploy
path lives in shell history instead of a stable contract.

Geppetto fixes that by making the repository itself more legible and by turning
core engineering actions into explicit workflow entrypoints.

### Section 3: Product Thesis

**Section title**

Not just deployment. A workflow contract.

**Copy**

Geppetto standardizes the repo shape, config, examples, tests, and CLI surface
so an AI agent does not have to guess how to continue real work.

Today, the first fully productized path is `deploy`.

That means a builder can go from config to build to deployment output and
artifact generation through one stable workflow contract.

### Section 4: Workflow Surface

**Section title**

Workflow primitives

**Cards**

#### `geppetto new`

Start from a structured project shape instead of a blank repo.

#### `geppetto init`

Make the repository easier for agents to understand and continue.

#### `geppetto test`

Run the agreed validation surface through a stable command contract.

#### `geppetto audit`

Turn common repo checks into a repeatable workflow.

#### `geppetto deploy`

Productize the hardest path first: build, deploy, output, and write-back.

### Section 5: What Is Real Today

**Section title**

Already working now

**Bullets**

- TypeScript toolchain migration complete
- stable repo-local CLI entrypoint
- structured deploy output artifacts
- `program_id` write-back
- mock E2E and CI green
- competition-ready quickstart and demo script

### Section 6: Why It Matters

**Section title**

Why this matters beyond one demo

**Copy**

The value is not only that deployment succeeds.

The value is that the repo becomes easier to:
- understand
- continue
- validate
- demo
- automate

This is what makes Geppetto an agent-native engineering workflow rather than a
single-purpose deploy helper.

### Section 7: Competition CTA

**Section title**

Built for live proof, not just slides

**Copy**

Geppetto already ships a competition-ready story:
- positioning
- quickstart
- 3-minute demo flow
- deploy artifacts

If the environment is stable, you show the working path.
If the environment is noisy, you still show a repository and workflow designed
for both developers and agents to build in together.

## Suggested Navigation

- Home
- Quickstart
- Demo
- Docs
- GitHub

## Suggested FAQ

### Is Geppetto only a deploy tool?

No. Deploy is just the first mature vertical. The broader product is an
agent-native engineering workflow for Solana repositories.

### What makes this “agent-native”?

The repository structure, docs, config, tests, and command entrypoints are
designed to be stable enough that an AI agent can continue engineering work
without guessing the workflow.

### What is already productionized?

The deploy path is the most productionized workflow today.

### What comes next?

Doctor/preflight, dry-run, richer test/audit/release contracts, and better
submission workflows for hackathons and teams.

## Visual Direction

Keep the site:
- technical
- direct
- repo-first
- not overdesigned

Avoid:
- generic AI gradients with no product meaning
- “autonomous everything” claims
- investor-speak that outruns what the repo already proves

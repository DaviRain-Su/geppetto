# Geppetto Pitch Deck Outline

## Deck Goal

This deck is for a short hackathon or builder-demo presentation.

It should answer three questions quickly:

1. what is Geppetto?
2. why is the Agent-native angle useful for Solana?
3. what is already real today?

## Slide 1 — Title

**Title**

Geppetto

**Subtitle**

An agent-native engineering workflow for Solana builders

**Speaker note**

We are not pitching a vague AI wrapper. We are pitching a repository and
workflow model that makes Solana engineering easier for both developers and
agents to continue reliably.

## Slide 2 — Problem

**Title**

AI can generate code, but it still struggles to continue real Solana projects

**Points**

- each repo has different hidden workflow assumptions
- docs and code drift
- deploy steps are often implicit
- agents end up guessing instead of engineering

**Speaker note**

The friction is not only code generation quality. The friction is workflow
legibility.

## Slide 3 — Insight

**Title**

The missing layer is a workflow contract

**Points**

- stable repo structure
- stable config surface
- stable examples and tests
- stable CLI entrypoints

**Speaker note**

Instead of asking agents to rediscover each repository, we make the engineering
surface explicit and repeatable.

## Slide 4 — What Geppetto Is

**Title**

Geppetto makes Solana repositories easier for agents and developers to build in
 together

**Points**

- `new`
- `init`
- `test`
- `audit`
- `deploy`

**Speaker note**

These are not just commands. They are executable workflow contracts.

## Slide 5 — Why Deploy First

**Title**

Deploy is the first productionized path

**Points**

- easiest path to verify
- hardest path to fake
- produces visible outputs
- proves the workflow model is real

**Speaker note**

We started with deploy because it gives the clearest end-to-end evidence.

## Slide 6 — Demo Flow

**Title**

One command, structured output

**Command**

```bash
bun ./bin/geppetto-cli.ts deploy --output json --write-back
```

**Outputs**

- build step
- deploy step
- `program_id`
- artifacts
- write-back

**Speaker note**

The proof is not just terminal text. The proof is structured output that both
humans and agents can continue from.

## Slide 7 — What Exists Today

**Title**

Already real in the repository

**Points**

- TypeScript toolchain
- stable CLI
- deploy artifacts
- CI green
- competition quickstart
- demo script

**Speaker note**

This is not a concept deck disconnected from the repo.

## Slide 8 — Why This Matters

**Title**

Why Agent-native matters for Solana

**Points**

- faster continuation of existing repos
- lower repo onboarding cost
- better repeatability for hackathons and teams
- less hidden process in shell history

**Speaker note**

If AI is going to be useful in real Solana engineering, the workflow layer has
to be made explicit. That is the wedge.

## Slide 9 — Near-Term Roadmap

**Title**

Next high-ROI extensions

**Points**

- `doctor`
- `deploy --dry-run`
- stronger demo packaging
- richer test/audit/release contracts

**Speaker note**

The next steps are workflow extensions, not another rewrite.

## Slide 10 — Close

**Title**

Geppetto is not just a deploy tool

**Closing line**

Geppetto is an agent-native engineering workflow for Solana builders, and
deploy is the first productionized path.

**Speaker note**

Today we are proving the first vertical. The broader opportunity is making the
entire Solana engineering lifecycle easier for agents and developers to execute
together.

## Optional Appendix Slides

### Appendix A — Architecture

- repo contract
- config contract
- command contract
- output contract

### Appendix B — Demo Evidence

- `.geppetto/deploy-output.json`
- write-back example
- CI status

### Appendix C — Competition Readiness

- quickstart
- demo script
- fallback path

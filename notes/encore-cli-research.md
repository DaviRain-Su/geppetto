# Encore CLI Deploy Behavior Research

> Researcher: @kimi  
> Date: 2026-04-15  
> Encore CLI Version: v1.56.6  
> Target: GP-07/GP-08 (Encore Adapter design)

---

## Critical Finding

**There is NO `encore deploy` command in Encore CLI v1.56.6.**

Encore Cloud deployment is performed via `git push encore`, not via a dedicated deploy CLI command. This fundamentally changes how the Encore adapter (GP-07/GP-08) must be implemented.

---

## Encore CLI Commands Overview

### Available Commands (relevant to deploy)

| Command | Purpose |
|---------|---------|
| `encore app create <name>` | Create local app template |
| `encore app init <name>` | Register local repo as new app on Encore Cloud |
| `encore app link <app-id>` | Link local repo to existing Encore Cloud app |
| `encore auth login` | Browser-based authentication |
| `encore auth whoami` | Check current login status |
| `encore run` | Local development server |
| `encore build docker <tag>` | Build Docker image for self-hosting |
| `encore namespace list` | List infrastructure namespaces |
| `encore logs --env=<env>` | Stream logs from deployed app |

### Non-existent Commands

- `encore deploy` → **unknown command**

---

## Full Encore Cloud Deployment Workflow

Based on CLI behavior and README documentation from created apps:

### Step 1: Create or Initialize App

```bash
# Option A: Create new app from template
encore app create my-app --lang ts

# Option B: Register existing local directory
encore app init my-app --lang ts
```

**Behavior observed:**
- `encore app create` works WITHOUT login, but creates a **local-only** app
- The created `encore.app` file initially shows:
  ```json
  {
    "// The app is not currently linked to the encore.dev platform.",
    "// Use \"encore app link\" to link it.",
    "id": "",
    "lang": "typescript"
  }
  ```

### Step 2: Authenticate

```bash
encore auth whoami
# Output when not logged in: "not logged in."

encore auth login
# Opens browser for GitHub/authentication flow
```

**Critical:** Cloud deploy operations require active authentication.

### Step 3: Link to Encore Cloud

```bash
encore app link <app-id>
# or
encore app init <name>
```

**Behavior observed:**
- Without login: `error: not logged in. Run 'encore auth login' first.`
- With login: Sets up `encore` git remote pointing to Encore Cloud

### Step 4: Deploy via Git Push

```bash
git add -A .
git commit -m "Commit message"
git push encore
```

From Encore's own README in generated apps:
> "Deploy your application to a staging environment in Encore's free development cloud: `git add -A . && git commit -m 'Commit message' && git push encore`"

---

## Implications for Geppetto Encore Adapter

### What the Adapter MUST Do

1. **Auth Check**
   - Run `encore auth whoami`
   - If not logged in, fail with clear `config` or `deploy` error
   - Cannot automate browser login; must instruct user to run `encore auth login`

2. **App Linking Check**
   - Parse `encore.app` in `project_path`
   - If `"id"` is empty, app is not linked to Encore Cloud
   - Run `encore app link <app-id>` or `encore app init <name>`
   - This also requires login

3. **Git Remote Check**
   - Verify `encore` git remote exists: `git remote get-url encore`
   - If missing, the adapter may need to run `encore app link` or add the remote manually

4. **Deploy Execution**
   - Stage changes: `git add -A .`
   - Commit: `git commit -m "Geppetto deploy <run_id>"`
   - Push: `git push encore` (or `git push --set-upstream encore main` for first push)

5. **Output Extraction**
   - `provider_deployment_id`: **UNKNOWN / requires further research**
     - May be extractable from `git push encore` output
     - May require Encore web API or `encore namespace list -o json`
   - `service_url`: **UNKNOWN / requires further research**
     - May be available via `encore namespace list -o json`
     - May require polling Encore Cloud dashboard API
     - Standard Encore URL pattern: `https://<app-id>-<env>.encore.app` (inference, not verified)

### What the Adapter CANNOT Do

- Call `encore deploy` (command does not exist)
- Bypass browser-based authentication
- Directly control Encore's internal deployment pipeline

---

## Known Unknowns (Require Login to Verify)

The following could not be verified because `encore auth login` requires browser interaction:

1. **Exact `git push encore` output format**
   - Does it print deployment ID?
   - Does it print service URL?
   - What does stderr look like on failure?

2. **`encore namespace list -o json` output**
   - Does it contain service URL?
   - Does it contain deployment ID?
   - What is the namespace/environment naming convention?

3. **`encore logs --env=...` behavior**
   - Can this be used as a deployment health check proxy?

4. **Encore Cloud web API**
   - Is there an unauthenticated or token-based API to query app status/URL?

---

## Adapter Error Mapping Recommendations

Based on observed CLI behavior:

| External Error | Failure Class | Notes |
|----------------|---------------|-------|
| `not logged in` | `config` | Pre-condition failure |
| `no encore.app found` | `config` | Missing Encore project marker |
| `encore.app` has empty `id` | `config` | App not linked to cloud |
| `git push encore` fails | `deploy` | Network, auth expiry, or build failure |
| Cannot extract `service_url` | `deploy` | Post-deploy retrieval failure |

---

## Recommendation for GP-07/GP-08

1. **Change adapter interface assumption**
   - Replace imagined `encore deploy` call with `git add + git commit + git push encore`

2. **Implement auth preflight**
   - Always run `encore auth whoami` before attempting deploy
   - Return actionable error if not authenticated

3. **Implement app-link preflight**
   - Parse `encore.app` for `"id"`
   - Run `encore app link` if unlinked (with graceful error on auth failure)

4. **Plan URL retrieval as polling**
   - Since `service_url` extraction method is unverified without login, implement:
     - Primary: parse from `git push` stdout + `encore namespace list -o json`
     - Fallback: pattern-based inference (`https://<app>.encore.app`)
     - Timeout: 60s polling with 5s intervals (per 03-technical-spec)

5. **Fix technical spec assumption**
   - `03-technical-spec.md` Section 9.2 assumes `encoreAdapter.deploy()` calls an Encore deploy command
   - This should be updated to reflect the git-push-based workflow

---

## Fixtures (from observed CLI output)

### `encore.app` (unlinked)
```json
{
	"// The app is not currently linked to the encore.dev platform.",
	"// Use \"encore app link\" to link it.",
	"id":   "",
	"lang": "typescript",
}
```

### `encore auth whoami` (not logged in)
```
not logged in.
```

### `encore app link` (not logged in)
```
error: not logged in. Run 'encore auth login' first.
```

### Encore README deployment section
```markdown
## Deployment
Deploy your application to a staging environment in Encore's free development cloud:
```bash
git add -A .
git commit -m 'Commit message'
git push encore
```
Then head over to the [Cloud Dashboard](https://app.encore.dev) to monitor your deployment and find your production URL.
```

---

## Action Required

**@CC / @codex_5_4 / team:** Someone with an active Encore account needs to run a real `git push encore` and capture:
1. Full stdout/stderr of successful push
2. Output of `encore namespace list -o json` after push
3. How `service_url` is exposed (CLI command vs dashboard vs API)
4. Whether any deployment ID is printed or queryable

Without this, GP-07/GP-08 will be building on unverified assumptions.

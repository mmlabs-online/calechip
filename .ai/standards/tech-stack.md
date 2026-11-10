---
doc_version: 3
last_updated: 2026-10-14
governed_by: [RULE-02, RULE-09]
---

# Tech stack

**The single place that answers "what are we building with".** Every other document in this
repository cites this file rather than restating it. If a language, framework, datastore, runner or
package manager is named twice in this repository, one of the two copies is wrong and this one is
the original.

## What this file holds, and what it must never hold

It holds **choices and majors**. It does not hold resolved versions, and it does not hold the
reasoning that belongs to a decision record.

| Fact | Lives here? | Where it actually lives |
|---|---|---|
| Language, framework, datastore, runners, package manager — the choice and the major | **yes** | this file |
| The exact resolved version of anything installed | no | `package.json` and the lockfile |
| The data-access seam: its path, its lint rule, its implementations | no | [architecture.md](architecture.md) |
| Layers, and where authorization lives | no | [architecture.md](architecture.md) |
| The four commands, by role | no | [testing-standards.md](testing-standards.md) |
| Field names and schema | no | [data-model.md](data-model.md) |
| External services, and what happens when one is unreachable | no | [integrations.md](integrations.md) |
| A package that must not enter the dependency tree | no | [boundaries.json](../registry/boundaries.json) |
| Why a choice below was made over the alternative | no | `.ai/registry/decisions/` |

**Resolved versions are deliberately excluded.** A document that restates the lockfile is wrong
within a week of the first patch bump, and a stale version string is worse than an absent one because
an agent reads it as current. Name the major that was chosen — `19`, `8`, `4` — and let the manifest
carry the rest.

## Where these choices came from

The interface stack was **not chosen from scratch**. It is the stack the Figma Make prototype in
`_figma/` was generated on, adopted deliberately so the reference and the implementation do not drift
apart in tooling. Everything below the interface — datastore, runners, linter — was decided
separately, on 2026-08-31.

`_figma/` is a reference, not source. It is named in `SOURCE_ROOTS` so `ba` and `qa` cannot read it,
for the same reason they cannot read the implementation: a test derived from a prototype agrees with
the prototype rather than with the story.

## Runtime and language

| | Choice | Major |
|---|---|---|
| Runtime | Node.js | 22 |
| Language | TypeScript | 5 |
| Package manager | pnpm | 10 |

Toolchain versions are pinned in `_figma/.mise.toml` and mirrored by `packageManager` in
`package.json`. **The machine used on 2026-08-31 ran Node 23.6.0 against a recorded major of 22** —
the loop works on both, but the pin and the machine disagree and one of them should move. TypeScript runs in `strict` mode with `"@/*"` aliased to the source root — the
configuration the prototype already uses, carried forward rather than re-derived.

## Framework

| | Choice | Major |
|---|---|---|
| Interface | React | 19 |
| Routing | react-router-dom | 7 |
| Build tool | Vite | 8 |
| React plugin | `@vitejs/plugin-react` | 6 |
| Styling | Tailwind CSS | 4 |

**Tailwind 4 takes no config file and no PostCSS config.** It is wired through the
`@tailwindcss/vite` plugin, and theme customisation goes in the global CSS entry point next to
`@import 'tailwindcss';`. This is a real change from Tailwind 3 and is the single most likely thing
to be written wrongly from memory — see *Versions the model cannot recall* below.

Supporting libraries, all carried from the prototype: `date-fns` 4 (with the `vi` locale),
`lucide-react` 1, `clsx` 2, `tailwind-merge` 3.

## Datastore

| | Choice | Major |
|---|---|---|
| Datastore | Supabase (PostgreSQL) | TODO(project) — no project provisioned yet |
| Client | `@supabase/supabase-js` | 2 |
| Migrations | Supabase CLI migrations | TODO(project) — CLI not installed yet |

**Everything that reaches this datastore lives inside the seam**, which is declared in
[architecture.md](architecture.md), not here. This section names the product; that file names the
one door to it. Recording the client library here and the seam there is the split that keeps RULE-02
checkable — R4 points at a directory, not at a package name.

**Supabase brings a second permission layer, and that was a decision rather than a detail. It has
been made.** [ADR-005](../registry/decisions/ADR-005-authorization-in-rls.md): row-level security is
the sole authorization mechanism, Supabase Auth provides authentication, and no server-side API is
written. The seam still exists and is still mandatory under RULE-02, but its job is typing and a
single import site — not enforcement. Any permission check appearing in it is an affordance and is
commented as one.

The reason is the deployment shape rather than taste: with no server, the browser holds the user's
own token and talks to PostgREST directly, so a rule written in client-side TypeScript can be skipped
by issuing the same request from anywhere else.

## Interface between the parts

TODO(project): the shape of the call from the interface into the seam, and whether any server-side
code exists beyond what Supabase provides. The prototype is client-only with data held in component
state, so this has no prior art in `_figma/` and must be decided rather than copied.

## Test runners

| | Choice | Major |
|---|---|---|
| Unit and component | Vitest | 4 |
| End-to-end | Playwright | 1 |

Vitest was chosen because it reuses the Vite configuration this project already has, so the unit
level costs almost no configuration. Playwright covers the end-to-end level that the Definition of
Done requires.

**The commands are not here.** [testing-standards.md](testing-standards.md) holds the
role-to-command table, because the Definition of Done and checks R2 and R3 refer to those commands by
role, and one file has to know their names. This section names the tools; that file names the
invocations.

## Lint and formatting

| | Choice | Major |
|---|---|---|
| Linter | ESLint | **10** |
| TypeScript support | `typescript-eslint` | 8 |
| Import boundaries | core `no-restricted-imports`, scoped by `files` in flat config | — no plugin |
| Formatter | oxfmt | 0.2 |

**ESLint resolved to 10, not the 9 recorded when the stack was chosen.** The correction is kept
visible rather than overwritten, because it is the clearest example this repository has of why the
list below exists: a flat config written from memory of ESLint 9 would have been written against the
wrong major.

**The boundary needs no plugin.** Core `no-restricted-imports`, scoped with `files` and `ignores` in
flat config, expresses *"nothing under `src/` outside the seam may import `@supabase/*`"* exactly.
That removes a dependency whose flat-config shape was unconfirmed, which was the main risk in this
row. Verified by attempt: a probe file importing the client from outside the seam is reported, and
the same import inside the seam is not.

ESLint was chosen over the faster alternatives for one reason: **it is the mechanism behind RULE-02**,
and a linter that cannot express "nothing outside this directory may import the datastore client"
leaves that rule as a sentence. Speed was the wrong thing to optimise for on the one rule the whole
architecture hangs from.

oxfmt stays as the formatter, carried from the prototype. It formats; it does not lint, and it is not
load-bearing for any rule.

The seam exists at `src/lib/data/` and the boundary rule is configured in `eslint.config.js`. The
enforcement map in [rules.md](../registry/rules.md) names it.

## Build and deployment

- **Build output:** `dist/`, ignored in `.gitignore`.
- **Container:** static nginx on port 3000, with the health check `GET :3000/healthz`. No Node
  process at runtime (`Dockerfile`, `docker/nginx.conf`).
- **Image:** `mingming21400/calechip` on Docker Hub. Each merge to `main` pushes `:sha-<7>`; a
  version tag promotes that image to `:vX.Y.Z` by digest, never by a second build.
- **Target:** Docker Compose on the operator's WSL2 home server, behind a Cloudflare Tunnel, deployed
  from the separate deployment repository by a self-hosted runner there.
- **`VITE_*` values are baked in at build**, so one image serves one Supabase project.
- **No staging environment.**
- **CI:** GitHub Actions.

Everything else — every workflow and its trigger, the secrets, cutting a release, the rollback
runbook — is in [docs/ops/ci-cd.md](../../docs/ops/ci-cd.md).

*Until 2026-10-14 this said "TODO(project): the deployment target for a Vite single-page build, and
the build output directory, which must also be added to `.gitignore`." CICD-06.*

## Versions the model cannot recall

**Any dependency whose current release is newer than the model's training data must be inspected
before configuration is written against it** — the installed types, the package's own documentation,
the real config file on disk. `TODO(verify):` is the correct output when a fact cannot be confirmed;
a confident guess is not.

This paragraph is not boilerplate. In the project this kit came from, a framework major had moved
connection configuration between two files and inverted which one wanted which URL. Written from
memory, it produced migrations that failed intermittently rather than cleanly — the failure mode that
costs the most to diagnose, because it looks like a data problem.

**Verified by installing and running, on 2026-08-31.** These are no longer recalled; the resolved
versions are in `pnpm-lock.yaml` and the configs were written against the installed packages.

| Dependency | Resolved | What reading it actually changed |
|---|---|---|
| ESLint | 10.9.1 | The recorded major was 9. A flat config written from memory would have targeted the wrong major. |
| Vitest | 4.1.11 | `defineConfig` must come from `vitest/config`; vite's own export has no `test` key, and `tsc` said so immediately. |
| Playwright | 1.62.1 | `vite preview` binds to `localhost`, not `127.0.0.1` — a `127.0.0.1` URL times out waiting for a server that is running. Found by attempt. |
| Vite | 8.2.2 | Config surface unchanged from what the prototype uses. |
| Tailwind CSS | 4.3.3 | Confirmed: no config file, no PostCSS config, wired through the Vite plugin and one `@import` in the CSS entry point. |
| `@vitejs/plugin-react` | 6.1.1 | Default export, called as a plugin. No change. |
| `@supabase/supabase-js` | 2.112.4 | `createClient` throws on an empty URL, so the seam constructs it lazily — the parity test caught eager construction on its first run. |
| `typescript-eslint` | 8.68.0 | Provides the `config()` helper and the recommended sets used in flat config. |
| TypeScript | 5.9.3 | `noUncheckedIndexedAccess` rejects destructuring the first element of an array, which is correct and was fixed rather than relaxed. |
| `lucide-react`, `date-fns`, `clsx`, `tailwind-merge` | from the prototype's lockfile | Carried across unchanged, so already resolved once. |

**Still unverified, and still on this list:** the Supabase CLI and its migration layout, and the
PostgreSQL major behind the hosted project. Neither is installed. Read their own documentation before
writing a migration path or an apply command.

## Changing anything on this page

Two mechanisms, and neither is optional:

1. **An ADR** in `.ai/registry/decisions/`. Review check R9 fails a dependency added without one.
   Swapping a datastore, a framework major, or a test runner is the same kind of change as adding a
   package and takes the same record.
2. **An entry in [boundaries.json](../registry/boundaries.json)** if the ADR names a revert condition
   of the form *this package must not enter the tree*, or *it may only be reachable from this
   directory*. Check D12 then enforces it, instead of a reviewer having to remember what the ADR
   said.

This file is standards plane: human-owned, and covered by CODEOWNERS review on the pull request.
An agent that needs a change here stops with `gate: BLOCKED` and states the change in
`blocking_reason`.

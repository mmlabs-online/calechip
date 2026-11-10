---
doc_version: 3
last_updated: 2026-10-13
governed_by: [RULE-01, RULE-02, RULE-09]
---

# Architecture

**The products are not named here.** Which datastore, which framework, which client library — those
are in [tech-stack.md](tech-stack.md), named once. This file names the *shape*: where the one door to
data is, what may import what, and where authorization stands. The split is deliberate, and it is
what keeps RULE-02 checkable — check R4 points at a directory, and a directory does not change when a
package does.

## The data-access seam

**The seam is `src/lib/data/`.** Nothing outside it may import the Supabase client.

RULE-02 says no component may bypass the seam declared here. Three things make that sentence
enforceable, and all three are named below rather than implied.

### 1. The path

`src/lib/data/` holds every module that talks to the datastore. Outside it, no file imports
`@supabase/supabase-js` — not a component, not a hook, not a test helper. Code above the seam works
in domain types the seam returns, and never in a query builder.

### 2. The mechanism

An ESLint rule, running in the `lint` command named in [testing-standards.md](testing-standards.md),
makes an import of the Supabase client from outside `src/lib/data/` a build failure. It is recorded
in the enforcement map in [rules.md](../registry/rules.md) and as the `supabase-client-in-seam`
boundary in [boundaries.json](../registry/boundaries.json), so that check D12 reports a crossing even
if the lint config is later loosened.

**The rule is `no-restricted-imports` in `eslint.config.js`**, scoped with `files: ["src/**"]` and
`ignores: ["src/lib/data/**"]`, forbidding the `@supabase/*` group. It needed no plugin, which
removed the one dependency whose flat-config shape was unconfirmed. ESLint resolved to 10, not the 9
recorded when the stack was chosen — see *Versions the model cannot recall* in
[tech-stack.md](tech-stack.md).

**Verified firing**, not assumed: a probe importing the client from outside the seam is reported with
the rule's own message, and the same import inside the seam is not.

### 3. The implementations

Two, with identical exported names and arity, so the seam-parity test in
[testing-standards.md](testing-standards.md) can compare them:

- **The real one**, backed by Supabase.
- **A mock**, in memory, seeded from the shared fixture module. This is what component tests run
  against.

Parity is necessary and not sufficient — a mock returning a field the real implementation cannot
produce passes parity and breaks at runtime. Where a return shape is subtle, assert it.

**One thing the seam is explicitly not.** It is not where permissions are enforced. See below.

## Layers

Four, and the arrows go one way.

```
  route / page component        may import: components, hooks, domain types
        |
  component                     may import: components, hooks, domain types
        |
  hook                          may import: the seam, domain types
        |
  src/lib/data/  (the seam)     may import: @supabase/supabase-js, domain types
        |
  Supabase — PostgREST, Auth, PostgreSQL
```

Domain types are shared and may be imported from anywhere. Nothing else skips a layer downward, and
nothing imports upward.

**The absence count is computed in exactly one place** (INV-04). That place is inside the seam, so
that the live warning, the month cell, the year grid and any future notification all read the same
function rather than four arithmetics that agree until one of them is edited.

## Where authorization lives

**In row-level security, and nowhere else.** Decided in
[ADR-005](../registry/decisions/ADR-005-authorization-in-rls.md).

Supabase Auth establishes identity. RLS policies decide what that identity may read and write. There
is no server-side API and none is planned.

**This is not a preference about where checks are tidiest — it follows from the deployment shape.**
The browser holds the user's own token and talks to PostgREST directly. Any rule written in
client-side TypeScript can be skipped by issuing the same request from somewhere that is not this
application. A permission check in the seam is therefore an **affordance**: it hides a control, it
shows a helpful message, it prevents a pointless round trip. It is not a control, and every such
check carries a comment saying so.

The consequence for reviews is real and is stated in ADR-005: check R6 compares a design against
policies in a migration, not against TypeScript, and the permission-model test executes against a
real PostgreSQL with a token per role rather than running as a unit test.

## Where invariants live

The same reasoning, for the same reason. `.ai/registry/invariants.md` says a UI affordance alone is
never sufficient for an invariant; with no server, application code is in the same position.

| Invariant | Held by |
|---|---|
| INV-01 — no overlapping entries for one member | A PostgreSQL exclusion constraint over member, date range and portion. This is the one that a read-then-write check cannot hold: two tabs, two devices, or a retry defeat it, and only the database sees both writes. |
| INV-02 — an edit revokes approval | A trigger on update, so it holds regardless of which client wrote. |
| INV-03 — a rejection carries a reason | A check constraint. |
| INV-04 — one definition of the absence count | A single function inside the seam. This one is application-level by nature: it is a computation, not a state constraint, and nothing can write a wrong value because nothing writes it at all. |
| INV-05 — tentative counts | Follows from INV-04 having one implementation. |
| INV-06 — one portion per entry | Column shape plus an enum. |
| INV-07 — one member, every team they belong to (title until 2026-10-13: *one member, one team*) | Foreign keys, not null — sufficient while a member has one team; MIR-10 redesigns it for several (ADR-059). |

TODO(project): cite the migration and the constraint name for each row above once they exist. A row
here naming no mechanism is a claim, and `.ai/registry/invariants.md` warns specifically that an
invariant claimed and not held is worse than one never claimed.

## Boundaries the audit enforces

[boundaries.json](../registry/boundaries.json) holds the machine-checkable boundaries, and check D12
in `scripts/check-docs.mjs` enforces them.

One is declared: **`supabase-client-in-seam`**, from ADR-005. `@supabase/supabase-js` may appear in
the manifest, and may only be imported from `src/lib/data/`. It is in the config rather than in this
paragraph because a decision nobody re-reads is a decision nobody keeps — the origin project left a
boundary as prose for eleven days and found out it had been crossed only when the audit was taught to
look.

## Configuration and environment

TODO(project): the Supabase project URL and anon key are environment-dependent and belong in
`.env.local`, which `.gitignore` already excludes. Name here which settings a test run must never
inherit from a developer machine — the integration tests that exercise policies must point at a
disposable database, and a test suite that can reach production data is one command away from
writing to it.

## Rejected alternatives

**A thin server seam — every write through a Supabase Edge Function, with authorization in
TypeScript.** Rejected in ADR-005. It does not remove the second enforcement layer, it adds a third:
RLS still has to be enabled or the database is open to any token holder, so the drift this document
warns about would exist anyway and would now span two languages. Against that, the permission surface
is four one-line policies.

**A repository class per entity, rather than a module of functions.** Rejected as ceremony this
project cannot spend: with one datastore and no second implementation planned beyond the test mock,
an interface plus two classes per entity buys indirection nobody varies. The seam-parity test already
provides what the interface would have — a mechanical guarantee that both implementations expose the
same surface — and it does it without asking every caller to construct anything.

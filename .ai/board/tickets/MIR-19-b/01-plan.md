---
ticket: MIR-19-b
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-11T13:50:31Z
inputs_read:
  - .ai/board/tickets/MIR-19-b/ticket.yaml
  - .ai/board/tickets/MIR-19/01-plan.md
  - .ai/board/tickets/MIR-21-c/01-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-097-an-org-address-is-served-beside-the-root-one-first-and-the-flip-is-mir-19-b.md
  - .ai/01-operating-model.md
  - .ai/standards/testing-standards.md
  - .ai/templates/plan.md
  - vite.config.ts
  - playwright.config.ts
  - tsconfig.json
  - tests/route-role-guards.test.ts
  - tests/e2e/support/entry-form.ts
  - tests/e2e/ (grep for toHaveURL, toHaveAttribute("href"), getAttribute("href"), page.url() walks, history.pushState)
  - node_modules/@playwright/test/package.json (1.62.1)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-19-b — The e2e specs that assert an in-app link read it through an org-prefix helper

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:308`):

| ID | Feature | Group |
|---|---|---|
| MIR-19 | Every authenticated page is served under `/{org_code}` | MIR |

**Plan item:** Phase 5, *Org-scoped routing* (`.ai/board/plans/calechip-multi-tenancy-plan.md:261-283`),
the part ADR-097 decision 5 gives to MIR-19-b.

**The split.** ADR-097 decision 5 gives MIR-19-b six items in a fixed order, and says it *"plans its
own count, and splits again if it is `L`"*. It is `L`. Item 1 alone touches 20 specs and a helper,
before the flip, email, nginx, the panel mock and the sign-up schema change. Split by operation first:
the specs change before the flip does. Then split by surface, by the kind of assertion:

- **This ticket (MIR-19-b): the helper, and the nine specs that assert an in-app `href`.**
- **MIR-19-c, created at this PLAN:** the rest of ADR-097 decision 5, in its order. That is the specs
  that walk history to an exact pathname, then the flip, then items 3 to 6. It plans its own count and
  splits again if it is `L` (§ 7 has the prediction).

**Who gains what.** Nobody using the app sees a change. This ticket serves whoever builds the flip.
Today nine specs assert a link's `href` as a root path, for example `"/admin"`. After the flip a
member's links are `"/shared/admin"`, because the router's basename is the org (ADR-097 decision 1),
and all nine specs would fail for a reason unrelated to what they test. After this ticket they read
the `href` with the org segment removed. They pass now, at the root, and they will still pass when the
links carry `/shared`. The flip then has fewer unrelated failures to work through.

**Counted again at this PLAN.** The MIR-19 count (`ticket.yaml` `mir_detail` item 1) was taken by
grep, and three of its entries are wrong:

- `solo-admin-tabs` (`:94-97`) and `solo-profile` (`:53-56`) wrap `toHaveAttribute(` across lines,
  so a one-line grep missed them. `solo-admin-tabs` was missing from the list, and `solo-profile`
  had one site counted where it has two.
- `adm-04:374` and `uie-09:321` assert `/\/$/` for a **member-less** caller. ADR-097 decision 5.2
  keeps member-less at the root, so neither breaks at the flip and neither is edited.
- `uie-07-week-absence-count` walks history to an exact pathname (`:105`, `:130`) and was missing from
  the walk list. It goes to MIR-19-c.

**Out of scope**:

- Specs that walk history to an exact pathname: adm-05, cal-03, cal-04, cal-05, cal-06, cal-07,
  cal-08, cal-10, evt-09, solo-pending-approval-ui, uie-07. They go to **MIR-19-c**, which uses
  `appPathname` from this ticket's helper.
- `evt-14-guest-sign-in`. Its exact `toHaveURL` strings (`:289-358`) assert where signing in lands,
  and the flip changes that, so the flip ticket decides what they become. → **MIR-19-c**.
- `mir-19-org-routing.spec.ts` AC-11. It asserts the root addresses are not redirected, which the flip
  deliberately ends. → **MIR-19-c**.
- `adm-04:374` and `uie-09:321`. Member-less callers stay at the root, so these are not edited.
- `data-to` reads (`uie-09:223`, `solo-admin-tabs:88-91`). That attribute is the `to` prop the screen
  passes, which the basename does not rewrite. Not edited.
- Suffix regexes (`toHaveURL(/\/events$/)` and the like). They already pass under an org prefix. Not
  edited.
- Any change under `src/`, `supabase/`, `docker/`. Specifically the flip (item 2), email links (item
  3), nginx (item 4), the panel's mock reserved list (item 5) and sign-up into an org (item 6), all
  **MIR-19-c**, in that order.
- Proving the nine specs pass *after* the flip. No flip exists yet. The evidence here is the unit test
  of the helper (AC-1, AC-2) and the specs passing at the root (AC-4). The full suite at the flip is
  MIR-19-c's.
- The `features.md` row. It stays `PLANNED` until the last slice of MIR-19 ships.

`size_estimate`: **M**.

## 2. Acceptance criteria

Terms used below. **The org segment:** a leading `/shared` path segment. `shared` is the code of Org
public, the org every fixture member is in (ADR-097 *Consequences*). **The nine specs:**
`solo-admin-back-to-calendar`, `solo-admin-tabs`, `solo-approval-settings`, `solo-profile`,
`solo-team-settings`, `solo-teams`, `tsk-01-tasks`, `tsk-04-week-task-badge`, `uie-09-admin-hub`, each
`tests/e2e/<name>.spec.ts`.

**AC-1: `stripOrg` removes exactly one leading org segment and nothing else**
- Given `stripOrg` from `tests/e2e/support/org-prefix.ts`
- When it is called on each input below
- Then it returns the output beside it:

  | input | output |
  |---|---|
  | `/shared` | `/` |
  | `/shared/` | `/` |
  | `/shared/admin` | `/admin` |
  | `/shared/tasks/2030-03-12` | `/tasks/2030-03-12` |
  | `/shared?team=t1` | `/?team=t1` |
  | `/shared/month/2026-10?team=t1` | `/month/2026-10?team=t1` |
  | `/admin` | `/admin` |
  | `/` | `/` |
  | `/sharedx/admin` | `/sharedx/admin` |
  | `/acme/admin` | `/acme/admin` |
  | `/admin/shared` | `/admin/shared` |
  | `/shared/shared/admin` | `/shared/admin` |
  | `https://example.com/shared/x` | `https://example.com/shared/x` |
  | `` (empty) | `` (empty) |

**AC-2: the two readers strip what the page and the link actually hold**
- Given a page whose URL is `http://localhost:4173/shared/month/2026-10?team=t1`, and a link whose
  `href` is `/shared/admin`. Given also a page at `http://localhost:4173/month/2026-10` and a link
  whose `href` is `/admin`. And a link with no `href`.
- When `appPathname` reads each page and `appHref` reads each link
- Then the pages give `/month/2026-10` both times (the query is not included). The links give
  `/admin` both times, and the link with no `href` gives `null`.

**AC-3: none of the nine specs asserts a raw in-app `href`**
- Given the nine specs as committed
- When their source text is read
- Then none holds `toHaveAttribute(` whose first argument is `"href"` or `'href'`, on one line or
  across lines. Each imports from `./support/org-prefix`.

**AC-4: the nine specs pass at the root as they do today**
- Given the app at this ticket's commit, where root addresses are not redirected (MIR-19 AC-11)
- When `pnpm exec playwright test` runs
- Then every test in the nine specs passes, and the whole suite passes. Each of the nine specs has the
  same number of tests as before, and none is skipped, `fixme`'d or deleted.

**AC-5: each migrated assertion compares the same path as before**
- Given each `toHaveAttribute("href", P)` site listed in § 4.2
- When it is rewritten
- Then the expected value is the same `P`, written the same way (a literal, a constant, or a template).
  Only the side being read changes, to `appHref(...)` or `stripOrg(...)`. The neighbouring
  assertions on the same locator are not edited: `toHaveText`, `toHaveCount`, `data-state`,
  `aria-current`.

**AC-6: an `href` that is wrong still fails**
- Given a migrated assertion that expects `/admin`
- When the link's `href` is `/shared/week`, `/acme/admin` or `/sharedx/admin`
- Then the assertion fails. This follows from AC-1, and the AC-1 unit test is its evidence: none of
  those three strips to `/admin`.

**Invariants touched:** `[]`. This ticket edits test code only. It writes no entry, computes no count
and changes no screen, so INV-01 to INV-07 are unaffected.

**Open questions:** none. ADR-097 decision 5 settles the order, and the split follows the operating
model (*Sizing*).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

There is no layout. This ticket adds and changes no screen, element or selector.

## 3. Permission model

This ticket changes no permission, role gate or check. Every spec signs in as the same fixture user as
today, and every role gate it exercises is the one already in place (`src/App.tsx`, the MIR-13
policies on the Supabase seam, and the mock seam's mirror of them).

| Action | Who | Where the check lives |
|---|---|---|
| none added or changed | n/a | n/a |

**Denials.** None change, and every denial the nine specs assert stays as it is, for example
`solo-admin-tabs`'s member who sees no tab. AC-5 forbids editing those assertions.

## 4. Contract

### 4.1 `tests/e2e/support/org-prefix.ts` (new)

It is not a spec file. `playwright.config.ts` collects `.*\.spec\.ts$`, and vitest collects
`tests/**/*.test.ts`. **It has no runtime import.** Its only import is `import type`, which the
compiler erases, so vitest can load it without loading `@playwright/test`. It does not import from
`src/`, for the reason `entry-form.ts` gives: a check that used the product's own `splitOrgPath` could
not catch that function being wrong.

```ts
import type { Locator, Page } from "@playwright/test";

/**
 * The org code of Org public, the org every fixture member is in (ADR-097 Consequences). MIR-19-b.
 * The only code stripped: a spec that stripped any org-shaped segment would pass at another org's address.
 */
export const E2E_ORG_CODE = "shared";

/**
 * `path` with one leading `/shared` segment removed. `path` is a pathname, optionally followed by
 * `?search` and/or `#hash`. A segment is `/shared` when the next character is `/`, `?`, `#` or the
 * end of the string. When removing it leaves nothing, or leaves a string that starts with `?` or `#`,
 * a `/` is put in front. Anything else, including a string that does not start with `/`, is returned
 * unchanged. Examples: 01-plan.md AC-1.
 */
export function stripOrg(path: string): string;

/** `stripOrg(new URL(page.url()).pathname)`. Pathname only: no search and no hash. Synchronous. */
export function appPathname(page: Pick<Page, "url">): string;

/**
 * `stripOrg` of the locator's `href` attribute, or `null` when it has none. It reads once through
 * `locator.getAttribute("href")`, so a spec polls it: `await expect.poll(() => appHref(x)).toBe(P)`.
 */
export function appHref(locator: Pick<Locator, "getAttribute">): Promise<string | null>;
```

`Pick<…>` is what lets the unit test pass a stub object instead of a real `Page` or `Locator` (§ 4.3).

### 4.2 The nine specs — the rewrite, site by site

**Rule (AC-5):**

```ts
// before
await expect(L).toHaveAttribute("href", P);
// after
await expect.poll(() => appHref(L)).toBe(P);
```

Keep any message argument, as `expect.poll(() => appHref(L), msg)`. `P` is unchanged. Add one import
per file, `import { appHref } from "./support/org-prefix";` plus `stripOrg` where it is used. Nothing
else in the file moves.

| Spec | Sites (line numbers at `origin/main` 453e3b6) | Expected value, unchanged |
|---|---|---|
| `solo-admin-back-to-calendar.spec.ts` | `:87`, `:92`, `:93`, `:94`, `:107` | `"/admin"`, `"/week"`, `"/month"`, `"/year"`, `"/admin"` |
| `solo-admin-tabs.spec.ts` | `:94-97` (one call over four lines) | `tab.path` |
| `solo-approval-settings.spec.ts` | `:102` | `SETTING` |
| `solo-profile.spec.ts` | `:53-56` (over four lines), `:276` | `"/profile"`, `"/"` |
| `solo-team-settings.spec.ts` | `:88` | `THRESHOLD` |
| `solo-teams.spec.ts` | `:80` | `"/teams"` |
| `tsk-01-tasks.spec.ts` | `:98`, `:110` | `"/tasks"`, `"/week"` |
| `tsk-04-week-task-badge.spec.ts` | `:323` | `` `/tasks/${TODAY}` `` |
| `uie-09-admin-hub.spec.ts` | `:231`; and `:236-240` (see below) | `destination.path`; `DESTINATIONS.map((d) => d.path)` |

**`uie-09:236-240`** reads every `href` in one `evaluateAll`. The browser-side callback stays exactly
as it is. The comparison changes from `expect(hrefs).toEqual(…)` to:

```ts
expect(hrefs.map((h) => (h === null ? null : stripOrg(h)))).toEqual(DESTINATIONS.map((d) => d.path));
```

It is still a snapshot, as before, and not a poll.

**Not edited** (§ 1 Out of scope): `uie-09:223-226` and `solo-admin-tabs:87-91` (`data-to`),
`uie-09:321` (member-less), and every suffix-regex `toHaveURL`.

### 4.3 `tests/e2e-org-prefix.test.ts` (new, vitest)

It sits beside the other unit tests, not under `tests/e2e/`, so the e2e folder holds only Playwright
files and helpers. It imports `{ E2E_ORG_CODE, stripOrg, appPathname, appHref }` from
`./e2e/support/org-prefix`, and `readFileSync` and `fileURLToPath` as `tests/route-role-guards.test.ts`
does.

```ts
/** The specs that have moved to the helper. MIR-19-c appends to this list; nothing removes from it. */
const MIGRATED_SPECS: readonly string[] = [
  "solo-admin-back-to-calendar.spec.ts",
  "solo-admin-tabs.spec.ts",
  "solo-approval-settings.spec.ts",
  "solo-profile.spec.ts",
  "solo-team-settings.spec.ts",
  "solo-teams.spec.ts",
  "tsk-01-tasks.spec.ts",
  "tsk-04-week-task-badge.spec.ts",
  "uie-09-admin-hub.spec.ts",
];
```

- `describe("stripOrg")`: one `it.each` row per AC-1 table row. Also `expect(E2E_ORG_CODE).toBe("shared")`.
- `describe("appPathname / appHref")`: AC-2, on stubs. `{ url: () => "http://localhost:4173/shared/month/2026-10?team=t1" }`,
  and `{ getAttribute: async () => "/shared/admin" }` / `async () => null`.
- `describe("migrated specs")`: AC-3. For each name in `MIGRATED_SPECS`, read `tests/e2e/<name>`:
  - it does not match `/toHaveAttribute\(\s*["']href["']/`;
  - it matches `/from "\.\/support\/org-prefix"/`.

## 5. Seam impact

None. No function in `src/lib/data/` is added, removed or changed.

## 6. Schema delta

`none`. No migration, policy, trigger, constraint or function. (Item 6's schema change is MIR-19-c's,
with its own ADR.)

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/board/tickets/MIR-19-c/ticket.yaml"
  - "tests/e2e/support/org-prefix.ts"
  - "tests/e2e-org-prefix.test.ts"
  - "tests/e2e/solo-admin-back-to-calendar.spec.ts"
  - "tests/e2e/solo-admin-tabs.spec.ts"
  - "tests/e2e/solo-approval-settings.spec.ts"
  - "tests/e2e/solo-profile.spec.ts"
  - "tests/e2e/solo-team-settings.spec.ts"
  - "tests/e2e/solo-teams.spec.ts"
  - "tests/e2e/tsk-01-tasks.spec.ts"
  - "tests/e2e/tsk-04-week-task-badge.spec.ts"
  - "tests/e2e/uie-09-admin-hub.spec.ts"
```

Twelve paths, so `size: M`. That matches `size_estimate: M`. It was predicted `L` at `/plan MIR-19`,
which counted the whole of decision 5, and the split above is what brings it to `M`.

- **`MIR-19-c/ticket.yaml` is written at this PLAN**, at `BACKLOG`, and carries the rest of ADR-097
  decision 5 with the corrected counts from § 1. Nothing further is owed on it at IN_PROGRESS.
- **No dependant changes.** No ticket's `depends_on` names MIR-19-b (checked across
  `.ai/board/tickets/*/ticket.yaml`), so no `depends_on` needs MIR-19-c added.
- **No ADR.** ADR-097 decision 5 already provides for this split (*"splits again if it is `L`"*), and
  the split makes no architectural decision. This ticket decides only how a test reads a path.
- **MIR-19-c, predicted.** The 11 walk specs plus a sibling ticket is 12 paths, or 13 if it also
  appends to `MIGRATED_SPECS` (the predicted count). Its PLAN takes the walks first and then splits
  again: the flip with evt-14 and `mir-19-org-routing` AC-11; then email, nginx and the panel mock;
  then sign-up into an org, which is a schema change with its own ADR.
- `glossary_owed` is `[]`, so no glossary row is written.
- Checked on 2026-11-11 against `git branch -a` and `git ls-remote`: neither the ticket ID `MIR-19-c`
  nor the file names `org-prefix.ts` and `e2e-org-prefix.test.ts` are in use.

## 8. Rejected alternatives

1. **Make the helper strip any segment that is an org code, through `isOrgCode` / `splitOrgPath`
   from `src/lib/org-path.ts`.** This would be one source of truth and would cover every org.
   Rejected for two reasons. A spec run at another org's address (for example `/acme/admin`) would
   still pass, but that is exactly what MIR-19 AC-4 says must not work. And the test would use the
   product's own parser to check the product's output, which `entry-form.ts` refuses on principle.
   Every fixture member is in `shared`, so stripping that one code is both enough and stricter.
2. **Regex the expected side instead, e.g. `toHaveAttribute("href", /^(\/shared)?\/admin$/)`.** No
   helper is needed and Playwright still auto-waits. Rejected. Nine specs, and later twenty, would each
   carry their own copy of the org rule. One `stripOrg` is one place to change if the fixture org ever
   moves.
3. **A Playwright `expect.extend` matcher, `toHaveAppHref(P)`.** This reads best at the call site.
   Rejected for now. It needs a runtime import of `@playwright/test` in the helper, so the vitest unit
   test would have to load the Playwright runner module. That library is past reliable recall
   (`tech-stack.md`), and whether loading it under vitest is safe was not verified. `expect.poll`
   already ships and is used in three specs.
4. **Take all 20 specs in this ticket and the flip in MIR-19-c.** Rejected. The helper plus 20 specs
   is 21 or more paths, which is `L`.

## Changelog

- `2026-11-11T13:50:31Z`: all sections written. Scope amended from the ticket's title (*"the specs
  learn the prefix, then the root addresses send a member to their org"*) to the first slice of that
  scope, because the whole of it is `L` (§ 1, § 7). The rest goes to MIR-19-c. The § 1 count corrects
  `mir_detail` item 1 in three places. Raised by `tech-lead-design`. Amended by `tech-lead-design`.

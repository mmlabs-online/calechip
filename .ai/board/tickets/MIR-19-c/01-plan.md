---
ticket: MIR-19-c
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-12T00:36:35Z
inputs_read:
  - .ai/board/tickets/MIR-19-c/ticket.yaml
  - .ai/board/tickets/MIR-19-b/01-plan.md
  - .ai/board/tickets/MIR-19-b/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-097-an-org-address-is-served-beside-the-root-one-first-and-the-flip-is-mir-19-b.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - tests/e2e/support/org-prefix.ts
  - tests/e2e-org-prefix.test.ts
  - tests/e2e/ (grep for page.url(), goBack, history.pushState; read every walk helper and its callers in the eleven listed specs)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-19-c — The e2e specs that walk history to an exact pathname read it through the org-prefix helper

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:308`):

| ID | Feature | Group |
|---|---|---|
| MIR-19 | Every authenticated page is served under `/{org_code}` | MIR |

**Plan item:** Phase 5, *Org-scoped routing* (`.ai/board/plans/calechip-multi-tenancy-plan.md:261-283`),
the part of ADR-097 decision 5 that MIR-19-b left: item 1 (the rest) to item 6.

**The split.** ADR-097 decision 5 says the slice *"plans its own count, and splits again if it is
`L`"*. It is `L`: item 1 alone is ten specs, the unit test and a sibling ticket, before the flip, email
links, nginx, the panel mock and the sign-up schema change. Split by operation first, as MIR-19-b did:
the specs change before the flip does.

- **This ticket (MIR-19-c): the ten specs that walk history to an exact pathname.**
- **MIR-19-d, created at this PLAN:** items 2 to 6 of decision 5, in their order. It plans its own
  count and splits again if it is `L` (§ 7 has the prediction).

**Who gains what.** Nobody using the app sees a change. This ticket serves whoever builds the flip.
Ten specs keep their mock data alive by stepping back through history (`page.goBack()`) until the page
is at an exact pathname such as `"/"` or `"/week/2026-10-12"`, because a `page.goto` reloads the page
and resets the mock. After the flip a signed-in member is at `/shared/…`, the walk never finds `"/"`,
and each spec fails for a reason unrelated to what it tests. After this ticket the walk compares the
pathname with the org segment removed, so it stops at the same screen at the root today and under
`/shared` after the flip. ADR-097 decision 5.1: *"Each spec passes before and after the flip."*

**Counted again at this PLAN.** `mir_detail` item 1 lists eleven specs. One is wrong:

- **`evt-09-create-invitation` (`:197`) is not edited.** It captures the page's pathname and pushes
  that same string back through `window.history.pushState` (`:207-218`). It never compares it against
  a root literal. The raw pathname is the correct value at either address: under `/shared` the browser
  URL must keep `/shared`, or the router (basename `/shared`, ADR-097 decision 1) would not match it.
  Stripping it would break the spec at the flip, not save it. → not edited, and noted for MIR-19-d.
- The other ten are confirmed, every site below compares the current pathname against a root path
  (a literal, a constant, or a pathname captured earlier and later compared):
  adm-05 (`:98`), cal-03 (`:86`), cal-04 (`:71`), cal-05 (`:83`, `:103`), cal-06 (`:108`, `:141`),
  cal-07 (`:115`), cal-08 (`:147`, `:150`), cal-10 (`:69`, `:91`), solo-pending-approval-ui (`:84`),
  uie-07 (`:105`, `:130`).
- **The caller check `mir_detail` asks for.** Every `"/"` walk (adm-05, cal-03, cal-07,
  solo-pending-approval-ui) ends by asserting `home-sign-out`, so its caller is a signed-in member and
  is moved by the flip. Two walks also serve a member-less caller: cal-06 AC-13 (`backToYear`, `:369`)
  and cal-10 AC-14 (`backTo`, `:372`). Member-less stays at the root (decision 5.2), and at the root
  `appPathname` returns the raw pathname unchanged (MIR-19-b AC-1: `/year/2026` → `/year/2026`), so the
  same edited helper serves both callers. No walk is left raw for a member-less caller alone.

**Out of scope**:

- `evt-09-create-invitation.spec.ts`. Reason above. → nothing; MIR-19-d's `mir_detail` records why.
- The specs that navigate by `window.history.pushState` + `popstate` to an org-less address (evt-03,
  evt-06, evt-07, evt-10, evt-11, evt-14, solo-approval-settings, solo-busy-day, tsk-02, uie-12). They
  do not walk to an exact pathname; whether they survive depends on how the flip treats an org-less
  address reached by popstate. → **MIR-19-d** counts them at its PLAN.
- Suffix regexes (`toHaveURL(/\/month\/2026-10$/)` and the like, e.g. cal-04:194, cal-05:352,
  cal-10:159). They already pass under an org prefix. Not edited.
- `evt-10:78`, `evt-11:101`, `evt-14:68`, `uie-12:78`: a suffix regex over the pathname
  (`/\/events\/([^/?#]+)$/`), prefix-agnostic. Not edited.
- `evt-14-guest-sign-in`'s exact `toHaveURL` strings (`:289-358`) and `mir-19-org-routing.spec.ts`
  AC-11. Their subject is the landing itself. → **MIR-19-d** (the flip).
- Any change under `src/`, `supabase/`, `docker/`: the flip (item 2), email links (item 3), nginx (item
  4), the panel's mock reserved list (item 5), sign-up into an org (item 6). → **MIR-19-d**, in that
  order.
- `tests/e2e/support/org-prefix.ts`. It ships from MIR-19-b and is used, not changed.
- Proving the ten specs pass *after* the flip. No flip exists yet. The evidence here is AC-1 (no raw
  pathname read is left) and AC-2 (the specs pass at the root). The full suite at the flip is
  MIR-19-d's.
- The `features.md` row. It stays `PLANNED` until the last slice of MIR-19 ships.

`size_estimate`: **M**.

## 2. Acceptance criteria

Terms used below. **The ten specs:** `adm-05-approve-reject`, `cal-03-admin-edit-entry`,
`cal-04-month-view`, `cal-05-week-view`, `cal-06-year-view`, `cal-07-overload-warning`,
`cal-08-holiday-shading`, `cal-10-year-overview`, `solo-pending-approval-ui`,
`uie-07-week-absence-count`, each `tests/e2e/<name>.spec.ts`. **The helper:**
`tests/e2e/support/org-prefix.ts` as shipped by MIR-19-b; `appPathname(page)` is
`stripOrg(new URL(page.url()).pathname)`.

**AC-1: none of the ten specs reads the raw pathname**
- Given the ten specs as committed
- When their source text is read
- Then none contains the text `new URL(page.url()).pathname`, and each imports from
  `./support/org-prefix`.

**AC-2: the ten specs pass at the root as they do today**
- Given the app at this ticket's commit, where root addresses are not redirected (MIR-19 AC-11)
- When `pnpm exec playwright test` runs
- Then every test in the ten specs passes, and the whole suite passes. Each of the ten specs has the
  same number of tests as before, and none is skipped, `fixme`'d or deleted.

**AC-3: each walk still stops at the same path, and only the read side changes**
- Given each site listed in § 4.2
- When it is rewritten
- Then the path it compares against is unchanged (the same literal, constant or parameter), the loop
  bound (`step < 8`, `< 10`, `< 12`) is unchanged, and the assertion after the loop (`home-sign-out`,
  `week-anchor`, `month-grid` and so on) is unchanged. Only `new URL(page.url()).pathname` becomes
  `appPathname(page)`.

**AC-4: a pathname captured and later walked back to is captured through the helper too**
- Given a function that captures the current pathname and later passes it to a walk (cal-05 `:103`,
  cal-06 `:141`, cal-10 `:91`, uie-07 `:130`)
- When it is rewritten
- Then the capture is `appPathname(page)`, so the value passed to the walk and the value the walk
  reads are stripped the same way.

**AC-5: the unit test records the ten specs and fails if one regresses**
- Given `tests/e2e-org-prefix.test.ts`
- When `pnpm test` runs
- Then for each of the ten specs it asserts the AC-1 conditions, and the nine specs MIR-19-b listed are
  still asserted exactly as before. A spec that later reintroduces `new URL(page.url()).pathname` fails
  this test.

**AC-6: `evt-09-create-invitation.spec.ts` is not edited**
- Given the diff of this ticket
- When it is read
- Then `tests/e2e/evt-09-create-invitation.spec.ts` is not in it (§ 1 gives the reason).

**Invariants touched:** `[]`. This ticket edits test code only. It writes no entry, computes no count
and changes no screen, so INV-01 to INV-07 are unaffected.

**Open questions:** none. ADR-097 decision 5 settles the order, and the split follows the operating
model (*Sizing*).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

There is no layout. This ticket adds and changes no screen, element or selector.

## 3. Permission model

This ticket changes no permission, role gate or check. Every spec signs in as the same fixture users as
today (member, admin, member-less), and every role gate it exercises is the one already in place
(`src/App.tsx`, the MIR-13 policies on the Supabase seam, and the mock seam's mirror of them).

| Action | Who | Where the check lives |
|---|---|---|
| none added or changed | n/a | n/a |

**Denials.** None change. Every denial the ten specs assert stays as it is, for example cal-06 AC-13
and cal-10 AC-14, where a member-less caller lands on the not-on-a-team state. AC-3 forbids editing the
assertions around the walks.

## 4. Contract

### 4.1 The helper — used, not changed

From `tests/e2e/support/org-prefix.ts` (MIR-19-b, unchanged):

```ts
export function appPathname(page: Pick<Page, "url">): string;
```

### 4.2 The ten specs — the rewrite, site by site

**Rule (AC-3, AC-4):**

```ts
// before
new URL(page.url()).pathname
// after
appPathname(page)
```

Add one import per file, directly after the existing `./support/entry-form` import where there is one,
otherwise after the `@playwright/test` import:

```ts
import { appPathname } from "./support/org-prefix";
```

Nothing else in the file moves: not the comments, the loop bounds, the compared value or the
assertion after the loop.

| Spec | Sites (line numbers at `origin/main` 77efa17) | What the site is |
|---|---|---|
| `adm-05-approve-reject.spec.ts` | `:98` | `backToHome` compare against `"/"` |
| `cal-03-admin-edit-entry.spec.ts` | `:86` | `backToHome` compare against `"/"` |
| `cal-04-month-view.spec.ts` | `:71` | `backToMonth` compare against `MONTH` |
| `cal-05-week-view.spec.ts` | `:83`, `:103` | `backToWeek` compare against `path`; `declare` capture |
| `cal-06-year-view.spec.ts` | `:108`, `:141` | `backToYear` compare against `path`; `declare` capture |
| `cal-07-overload-warning.spec.ts` | `:115` | `backToHome` compare against `"/"` |
| `cal-08-holiday-shading.spec.ts` | `:147`, `:150` | `backTo` compare against `path`; the `expect(…).toBe(path)` after the loop |
| `cal-10-year-overview.spec.ts` | `:69`, `:91` | `backTo` compare against `path`; `declare` capture |
| `solo-pending-approval-ui.spec.ts` | `:84` | `backToHome` compare against `"/"` |
| `uie-07-week-absence-count.spec.ts` | `:105`, `:130` | `backToWeek` compare against `path`; `declare` capture |

cal-08 `:150` becomes `expect(appPathname(page)).toBe(path);`.

**Not edited** (§ 1 Out of scope): `evt-09-create-invitation.spec.ts`, and every suffix-regex
`toHaveURL` in the ten specs.

### 4.3 `tests/e2e-org-prefix.test.ts` — appended, nothing removed

Above `MIGRATED_SPECS`, add:

```ts
/** The specs whose history walks read the pathname through `appPathname`. MIR-19-c. Append only. */
const WALK_SPECS: readonly string[] = [
  "adm-05-approve-reject.spec.ts",
  "cal-03-admin-edit-entry.spec.ts",
  "cal-04-month-view.spec.ts",
  "cal-05-week-view.spec.ts",
  "cal-06-year-view.spec.ts",
  "cal-07-overload-warning.spec.ts",
  "cal-08-holiday-shading.spec.ts",
  "cal-10-year-overview.spec.ts",
  "solo-pending-approval-ui.spec.ts",
  "uie-07-week-absence-count.spec.ts",
];
```

Append `...WALK_SPECS` as the last element of `MIGRATED_SPECS`. The nine existing names stay, in their
order. The existing `describe("migrated specs")` then asserts, for the ten as for the nine, no raw
`href` and the import (`/from "\.\/support\/org-prefix"/`).

Add one block after `describe("migrated specs")`:

- `describe("walk specs")` → `describe.each(WALK_SPECS)("%s", …)`, reading `tests/e2e/<name>` the
  same way the existing block does (`readFileSync(fileURLToPath(new URL(\`./e2e/${name}\`, import.meta.url)), "utf8")`),
  with one `it("reads no raw pathname", …)` asserting
  `expect(source).not.toMatch(/new URL\(page\.url\(\)\)\.pathname/)`.

No other `describe` or `it` in the file is edited.

## 5. Seam impact

None. No function in `src/lib/data/` is added, removed or changed.

## 6. Schema delta

`none`. No migration, policy, trigger, constraint or function. (Item 6's schema change is MIR-19-d's,
with its own ADR.)

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/board/tickets/MIR-19-d/ticket.yaml"
  - "tests/e2e-org-prefix.test.ts"
  - "tests/e2e/adm-05-approve-reject.spec.ts"
  - "tests/e2e/cal-03-admin-edit-entry.spec.ts"
  - "tests/e2e/cal-04-month-view.spec.ts"
  - "tests/e2e/cal-05-week-view.spec.ts"
  - "tests/e2e/cal-06-year-view.spec.ts"
  - "tests/e2e/cal-07-overload-warning.spec.ts"
  - "tests/e2e/cal-08-holiday-shading.spec.ts"
  - "tests/e2e/cal-10-year-overview.spec.ts"
  - "tests/e2e/solo-pending-approval-ui.spec.ts"
  - "tests/e2e/uie-07-week-absence-count.spec.ts"
```

Twelve paths, so `size: M`. That matches `size_estimate: M`. It was predicted `L` at `/plan MIR-19-b`,
which counted items 1 to 6 together, and the split above plus dropping evt-09 is what brings it to `M`
(with evt-09 it would have been 13, `L`).

- **`MIR-19-d/ticket.yaml` is written at this PLAN**, at `BACKLOG`, and carries items 2 to 6 of ADR-097
  decision 5, the evt-09 reason, and the pushState specs to count. Nothing further is owed on it at
  IN_PROGRESS.
- **No dependant changes.** No ticket's `depends_on` names MIR-19-c except MIR-19-d itself (checked
  across `.ai/board/tickets/*/ticket.yaml`).
- **No ADR.** ADR-097 decision 5 already provides for this split, and this ticket decides only how a
  test reads a path.
- **MIR-19-d, predicted `L`.** The flip touches the router and landing in `src/`, evt-14 and
  `mir-19-org-routing.spec.ts`, and possibly some of the ten pushState specs; then email, nginx and the
  panel mock; then sign-up into an org, which is a schema change with its own ADR. Its PLAN takes the
  flip first and splits again.
- `glossary_owed` is `[]`, so no glossary row is written.
- Checked on 2026-11-12 against `git show-ref` and `.ai/board/tickets/`: the ticket ID `MIR-19-d` and
  the name `WALK_SPECS` are not in use.

## 8. Rejected alternatives

1. **Edit only the comparison inside each walk helper, and leave the captures raw.** Fewer edits.
   Rejected: after the flip a raw capture is `/shared/week/…` while the stripped read is `/week/…`, so
   `declare` in cal-05, cal-06, cal-10 and uie-07 would walk past the screen it came from and run out
   of steps. AC-4 exists for this.
2. **Leave the walks raw and let the flip land members at the root history entry they walked from.**
   No spec edit at all. Rejected: ADR-097 decision 5.1 orders the specs to change first, and the walk
   would then depend on which entries the flip pushes or replaces, a detail of the flip's
   implementation that a spec should not encode.
3. **Edit evt-09 too, as `mir_detail` listed it.** Rejected (§ 1): the captured pathname is pushed back
   to the browser, so it must stay the real address. Stripping it would break the spec at the flip.
4. **Take the walk specs and the flip together.** Rejected. Ten specs, the unit test and the flip's
   `src/` files and specs is far over twelve paths, which is `L`.

## Changelog

- `2026-11-12T00:36:35Z`: all sections written. Scope amended from the ticket's title (*"The
  history-walk specs learn the org prefix, then the root addresses send a member to their org"*) to the
  first part of it, because the whole is `L` (§ 1, § 7). Items 2 to 6 go to MIR-19-d. The § 1 count
  corrects `mir_detail` item 1: evt-09 is removed (it round-trips the raw pathname). Raised by
  `tech-lead-design`. Amended by `tech-lead-design`.

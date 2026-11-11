---
ticket: MIR-17-g
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-11T09:13:54Z
inputs_read:
  - .ai/board/tickets/MIR-17-g/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-089-the-admin-screen-guards-go-through-the-role-helpers-first-and-the-rest-of-p4-2-is-mir-17-c.md
  - .ai/registry/decisions/ADR-094-memberlist-is-scoped-through-reads-that-already-exist-and-router-guards-are-mir-17-g.md
  - .ai/registry/decisions/ADR-090-the-worklist-decides-per-row-from-list-entry-owners-and-the-rest-of-p4-2-is-mir-17-d.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/tickets/MIR-17-f/01-plan.md
  - .ai/board/tickets/MIR-17-d/01-plan.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - src/App.tsx
  - src/components/AdminLayout.tsx
  - src/routes/AdminHub.tsx
  - src/routes/NewSignups.tsx
  - src/routes/Threshold.tsx
  - src/routes/Teams.tsx
  - src/routes/TeamEntries.tsx
  - src/routes/PendingEntries.tsx
  - src/routes/Holidays.tsx
  - src/routes/IssueReports.tsx
  - src/routes/MemberList.tsx
  - tests/role-guards.test.ts
  - tests/e2e/ (grep for the six `*-refused` selectors)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-17-g — The router gains role guards, or records why the screens' in-place refusals are the guards

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:306`):

| ID | Feature | Group |
|---|---|---|
| MIR-17 | Client role checks take a team or org, every admin-only guard is replaced, and the router gains role guards | MIR |

**P4-2's last bullet** (`.ai/board/plans/calechip-multi-tenancy-plan.md:244`): *"Router has no role
guards at all; add them"*. ADR-094 decision 3 gives it to MIR-17-g, *"which decides between
interception and the in-place refusals"*.

**The decision, ADR-096 (written at this PLAN):** the in-place refusals are the guards. The router
keeps guarding membership only. The ticket's title allows either answer, and this is the second one.

**Who gains what.** No role sees a different screen. The gain is for whoever adds the next admin
screen. Today nothing stops a path from being added under `AdminLayout` with a screen that never
refuses anybody. The audit's *"no role guards at all"* names exactly that risk. After this ticket,
a source-text test classifies every path under `AdminLayout`. Each one is either a refusing route,
whose screen asks a role helper and renders its `*-refused` element, or a named open route. An
unclassified path fails `pnpm test`. The decision is also written in the one place a reader of P4-2
would look, `src/App.tsx`.

`size_estimate: S`. One ADR, one comment block, one new test file.

**Out of scope — and where each goes:**

- **Router interception of any kind**, whether a redirect or a shared refusal. ADR-096 *Options
  considered* rejects it. Its revert condition names when it would come back.
- **`tests/e2e/**`** is not edited. The 23 references to the six `*-refused` selectors, across 10
  spec files, stay as they are (AC-5).
- **Any screen's refusal logic or copy.** `AdminHub`, `NewSignups`, `Threshold`, `Teams`,
  `TeamEntries` and `PendingEntries` are read by the new test and not edited.
- **`mayAdminister`, `mayDecide` and `mayDecideEntriesOf` gaining a team or org parameter** (P4-2
  bullet 1). Earlier slices answered this in the seam and the scope objects instead: ADR-090
  (`listEntryOwners`), ADR-091 (*manager* means *manages at least one team*) and ADR-094
  (`RosterScope`). Not reopened here.
- **Routes outside the four `AdminLayout` blocks.** Their guards are membership guards with recorded
  reasons (CAL-01, CAL-02, EVT-01 and others), and none of them is an admin screen.
- **The stale comments inside `src/App.tsx`** (*"block 2 of 3"* against four blocks, and *"`/threshold`
  is still `/threshold`"* under UIE-09) stay as they are. They are other tickets' history, and the
  `/setting` block already records its own supersession.
- **MIR-17's feature row status** is `/ship`'s to move, not this plan's.
- **No migration, policy, grant or seam change.**

## 2. Acceptance criteria

All of these are observed through `tests/route-role-guards.test.ts` (new), except AC-5, which is
observed through the e2e suite and `git diff`.

**AC-1 — every path under `AdminLayout` is classified**
- Given `src/App.tsx` with comments removed and whitespace collapsed
- When the `path="…"` values inside every `<Route element={<AdminLayout …>}>` … `</Route>` block are
  collected
- Then the collected set equals the union of `REFUSING_ROUTES` and `OPEN_ROUTES` (§ 4.2), with nothing
  missing and nothing extra
- And at least four such blocks are found, so a parse that finds nothing cannot pass

**AC-2 — each refusing route reaches its screen, and the router asks no rank**
- Given each row of `REFUSING_ROUTES`
- When the `element` of its `<Route path="…">` is read from `src/App.tsx`
- Then it equals the row's `element` exactly: either the bare screen or
  `membership.state === "member" ? <Screen /> : <Navigate to="/" replace />`
- And `src/App.tsx` does not import from `"@/lib/roles"`, and its code (comments removed) contains
  neither `mayAdminister(` nor `mayDecide(`

**AC-3 — each refusing screen asks its helper and draws its refusal**
- Given each row of `REFUSING_ROUTES`
- When the row's screen file is read
- Then it imports the row's `asks` helper from `"@/lib/roles"`
- And its code (comments removed) contains `` `${asks}(me.role)` `` and
  `setView({ phase: "refused" })`
- And its source contains `` data-testid="${refusal}" ``

**AC-4 — each open route stays open**
- Given each row of `OPEN_ROUTES`
- When the `element` of its `<Route path="…">` is read from `src/App.tsx`
- Then it equals the row's `element` exactly. So `/members` still renders `<MemberList />` to every
  caller, `/holidays` and `/holidays/:year` turn away only a signed-out caller, `/reports` reaches
  `IssueReports` for every member, and `/threshold` redirects to `/setting`

**AC-5 — no role sees a different screen**
- When the e2e suite runs on the mock build
- Then every spec that addresses `admin-hub-refused`, `signups-refused`, `threshold-refused`,
  `teams-refused`, `team-entries-refused` or `pending-entries-refused` passes
- And `git diff origin/main -- tests/e2e src/routes src/components` is empty

**AC-6 — the router records the decision**
- When `src/App.tsx` is read
- Then the comment above the first `AdminLayout` block contains `MIR-17-g, ADR-096` and the sentence
  `The role guards are the screens' own refusals.`

**Invariants touched.** `[]`. INV-01 to INV-07 are about entries and the absence count. This ticket
changes no read, no write and no rendered screen. INV-04 and INV-07 were the candidates, through
`/entries/team` and `/entries/pending`, and neither route's element or screen changes (AC-2, AC-5).

**Open questions.** None. One correction to the ticket's `mir_detail`: it cites *"TEA-04 AC-3"* for
`/members` not being admin-only. TEA-04's AC-3 is about `removed_at`. The source for an open
`/members` is TEA-03 and the `Read the member list` row (member ✅). This plan cites that, and the
behaviour is the same.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No layout changes. Nothing rendered changes for any role.

## 3. Permission model

Nothing changes. Every line is an affordance (ADR-005), and this ticket moves none of them.

| Path | Router guard (affordance, unchanged) | Screen refusal (affordance, unchanged) | Control (unchanged) |
|---|---|---|---|
| `/signups` | none | `mayAdminister` → `signups-refused` | the sign-up queue's definer functions |
| `/entries/team` | membership | `mayAdminister` → `team-entries-refused` | `entry_update_admin`, `entry_delete_admin` |
| `/entries/pending` | membership | `mayDecide`, or a decidable row in `owners` → `pending-entries-refused` | `may_decide_entry` in the decide path (ADR-090) |
| `/setting` | membership | `mayAdminister` → `threshold-refused` | `team_update_admin`, `grant update (overload_threshold)` |
| `/teams` | membership | `mayAdminister` → `teams-refused` | each team write's `security definer` function |
| `/admin` | membership | `mayAdminister` → `admin-hub-refused` | none behind it: five links, no control |
| `/members` | none | none for rank; `member-list-not-on-a-team` with no member row | `member_select_team`, `member_update_admin` and others |
| `/holidays`, `/holidays/:year` | session | none | `holiday_select_own_org`, holiday write functions |
| `/reports` | membership | none: `issue-reports-moved` for every role | `issue_report_select_*` (system admin only, MIR-16) |
| `/threshold` | redirect to `/setting` | — | — |

**Denials, unchanged.** A member is refused in place on the six refusing routes. On
`/entries/pending`, a member is refused unless `owners` names a row they may decide. A signed-out or
member-less caller is sent to `/` by the router on every membership-guarded path. The router never
redirects on rank (ADR-096 decision 2).

## 4. Contract

### 4.1 `src/App.tsx` — one comment, no code

Inserted as the first paragraph of the existing JSX comment that begins
`{/* **SOLO, 2026-09-09 — THE ADMIN TAB STRIP, AND WHY THERE ARE SEVERAL OF THESE BLOCKS`. No existing
line of that comment, and no line of code, changes:

```tsx
{/* **MIR-17-g, ADR-096 — THE ROUTER GUARDS MEMBERSHIP, NOT RANK.** The role guards are the screens' own refusals.
    Six paths under these `AdminLayout` blocks refuse a caller in place, each through a helper
    from `@/lib/roles`, and each refusal says why. The router cannot answer `/entries/pending`,
    whose admission depends on a read the screen makes (ADR-090). Every guard here is an
    affordance either way (ADR-005). `tests/route-role-guards.test.ts` classifies every path
    under `AdminLayout`. A new one fails it until it is listed as refusing or open.

    **SOLO, 2026-09-09 — THE ADMIN TAB STRIP, AND WHY THERE ARE SEVERAL OF THESE BLOCKS
    … (unchanged from here)
```

The sentence `The role guards are the screens' own refusals.` must survive line wrapping intact on one
line, because AC-6 matches it as a substring of the raw source. The Developer may re-wrap the other
lines of the new paragraph.

`src/App.tsx` gains no import, and no `<Route>` changes.

### 4.2 `tests/route-role-guards.test.ts` — new

```ts
// MIR-17-g, ADR-096 — the admin screens' in-place refusals are the role guards, and the router
// guards membership only. A source-text test, the shape of `tests/role-guards.test.ts`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** Comments removed: `//` lines and `/* … *\/` blocks, which includes JSX `{/* … *\/}`. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Whitespace collapsed to one space, and the space just inside `{` and `}` removed, so a
 *  route's `element={ … }` written over several lines compares equal to the one-line form. */
function normalise(code: string): string {
  return code.replace(/\s+/g, " ").replace(/\{ /g, "{").replace(/ \}/g, "}");
}

type RoleHelper = "mayAdminister" | "mayDecide";

interface RefusingRoute {
  path: string;
  element: string;
  file: string;
  asks: RoleHelper;
  refusal: string;
}

interface OpenRoute {
  path: string;
  element: string;
  why: string;
}

const MEMBER_ONLY = (screen: string): string =>
  `membership.state === "member" ? <${screen} /> : <Navigate to="/" replace />`;

const REFUSING_ROUTES: readonly RefusingRoute[] = [
  { path: "/signups", element: "<NewSignups />", file: "src/routes/NewSignups.tsx", asks: "mayAdminister", refusal: "signups-refused" },
  { path: "/entries/team", element: MEMBER_ONLY("TeamEntries"), file: "src/routes/TeamEntries.tsx", asks: "mayAdminister", refusal: "team-entries-refused" },
  { path: "/entries/pending", element: MEMBER_ONLY("PendingEntries"), file: "src/routes/PendingEntries.tsx", asks: "mayDecide", refusal: "pending-entries-refused" },
  { path: "/setting", element: MEMBER_ONLY("Threshold"), file: "src/routes/Threshold.tsx", asks: "mayAdminister", refusal: "threshold-refused" },
  { path: "/teams", element: MEMBER_ONLY("Teams"), file: "src/routes/Teams.tsx", asks: "mayAdminister", refusal: "teams-refused" },
  { path: "/admin", element: MEMBER_ONLY("AdminHub"), file: "src/routes/AdminHub.tsx", asks: "mayAdminister", refusal: "admin-hub-refused" },
];

const SIGNED_IN = `membership.state === "signed-out" ? <Navigate to="/" replace /> : <Holidays />`;

const OPEN_ROUTES: readonly OpenRoute[] = [
  { path: "/members", element: "<MemberList />", why: "TEA-03: every signed-in role reads the roster" },
  { path: "/holidays", element: SIGNED_IN, why: "ADM-02: Read the holiday calendar is checked for both roles" },
  { path: "/holidays/:year", element: SIGNED_IN, why: "ADM-02: as /holidays" },
  { path: "/reports", element: MEMBER_ONLY("IssueReports"), why: "MIR-17 AC-3: every role is told where reports go" },
  { path: "/threshold", element: `<Navigate to="/setting" replace />`, why: "a redirect to /setting" },
];

const appSource = readFileSync(repoRoot + "src/App.tsx", "utf8");
const appCode = normalise(stripComments(appSource));

/** The paths inside every `<Route element={<AdminLayout …>}>` … `</Route>` block. The inner routes
 *  are self-closing, so the first `</Route>` after the opening closes the block. */
function adminLayoutPaths(code: string): { blocks: number; paths: string[] } {
  const blocks = code.match(/<Route element=\{<AdminLayout [\s\S]*?<\/Route>/g) ?? [];
  return {
    blocks: blocks.length,
    paths: blocks.flatMap((block) => [...block.matchAll(/path="([^"]+)"/g)].map((m) => m[1])),
  };
}

/** The `element` of the route at `path`, as written between `element={` and the `} />` that closes
 *  the route. `null` when the route is not found. */
function routeElement(code: string, path: string): string | null {
  const escaped = path.replace(/[/:]/g, (c) => `\\${c}`);
  const match = code.match(new RegExp(`path="${escaped}" element=\\{(.*?)\\} \\/>`));
  return match ? match[1] : null;
}
```

Then four `describe` blocks, one per AC from AC-1 to AC-4, each `it` prefixed `AC-n:`:

- **AC-1.** `adminLayoutPaths(appCode).blocks` is `>= 4`. The sorted `paths` equal the sorted
  `[...REFUSING_ROUTES, ...OPEN_ROUTES].map((r) => r.path)`.
- **AC-2.** One `it` per `REFUSING_ROUTES` row: `routeElement(appCode, row.path)` is `row.element`.
  Then one `it`: `appSource` does not match `/from\s+"@\/lib\/roles"/`, and `appCode` contains
  neither `"mayAdminister("` nor `"mayDecide("`.
- **AC-3.** One `it` per `REFUSING_ROUTES` row, reading `row.file`:
  - the source matches `new RegExp(`import\\s*\\{[^}]*\\b${row.asks}\\b[^}]*\\}\\s*from\\s*"@/lib/roles"`)`;
  - `stripComments(source)` contains `` `${row.asks}(me.role)` `` and `'setView({ phase: "refused" })'`;
  - the source contains `` `data-testid="${row.refusal}"` ``.
- **AC-4.** One `it` per `OPEN_ROUTES` row: `routeElement(appCode, row.path)` is `row.element`. The
  `it` title includes `row.why`.
- **AC-6** is one more `it` in the AC-2 `describe`: `appSource` contains `"MIR-17-g, ADR-096"` and
  `"The role guards are the screens' own refusals."`.

Every field name above (`path`, `element`, `file`, `asks`, `refusal`, `why`) and every constant
(`REFUSING_ROUTES`, `OPEN_ROUTES`, `MEMBER_ONLY`, `SIGNED_IN`) is fixed by this section. On
2026-11-11 at `2aad301`, `stripComments` + `normalise` + `adminLayoutPaths` found 4 blocks and
exactly the 11 paths above, and `routeElement` returned exactly the `element` strings listed. Each of
the six screens contains `setView({ phase: "refused" })`, `<asks>(me.role)` and its `data-testid`.
Those were checked against the source, not assumed.

## 5. Seam impact

None.

## 6. Schema delta

`none`. No table, column, policy, grant, trigger or constraint is named. `requires_adr` stays
`true`, because ADR-096 is this ticket's ADR.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-096-the-admin-screens-in-place-refusals-are-the-role-guards-and-the-router-guards-membership-only.md"
  - "src/App.tsx"
  - "tests/route-role-guards.test.ts"
```

- **Size.** `size: S`, from 3 paths, and `size_estimate` agrees. Interception would have been about
  14: `App.tsx`, a guard component, its test, and the 10 e2e specs and the ADR. That is `L`, and
  ADR-096 rejects it on its merits as well as on size.
- **Registry write at this PLAN:** ADR-096, under ADR-067.
- `glossary_owed` is `[]`.
- `src/routes/*` and `tests/e2e/**` are read by the test and are deliberately not listed (AC-5).
- `.ai/board/plans/multi-tenancy-status.md` is not listed. Its MIR-17 row is plan status, and this
  ticket does not change it.

## 8. Rejected alternatives

- **A `RequireRole` wrapper that redirects a non-admin to `/`.** This is the reading of P4-2 closest
  to the letter. Rejected for three reasons:
  - it drops the refusal's sentence, which five route comments say is the point;
  - it refuses a second-team decider at `/entries/pending`, whom the screen admits (ADR-090);
  - it moves 23 references in 10 e2e specs, which makes the ticket `L`.
- **A wrapper that renders one shared refusal instead of redirecting.** Rejected. It collapses six
  selectors and six sentences into one, moves the same e2e references, and still cannot answer
  `/entries/pending`.
- **A wrapper that calls the same helper and then renders the screen, which refuses again.**
  Rejected. That is two checks of one question, and they can drift apart.
- **Record the decision in the ADR and the comment only, with no test.** Rejected. Prose does not
  catch the next admin path added without a refusal. That gap is the real content of P4-2's
  *"no role guards at all"*.

## Changelog

- `2026-11-11T09:13:54Z` — all sections written. Raised by `tech-lead-design`, amended by
  `tech-lead-design`. Sections 1 and 2 were framed from P4-2, ADR-089, ADR-094 and `mir_detail`, and
  the route-versus-screen choice was settled only after reading `src/App.tsx` and the six screens.
  Reading them found three things that decided it:
  - `PendingEntries` admits without a rank when `owners` is non-empty (ADR-090). The router cannot
    see that.
  - The six `*-refused` selectors are addressed 23 times in 10 e2e specs.
  - Five of the eleven `AdminLayout` paths are deliberately open.

  The ACs were written against the decision, not reshaped to fit it. The ticket's `mir_detail`
  citation of *"TEA-04 AC-3"* for `/members` is corrected in § 2 *Open questions* to TEA-03.

## Delegated decisions

- **ADR-096**: the six admin screens' in-place refusals are the role guards. The router guards
  membership only and asks no rank question. A source-text test classifies every path under
  `AdminLayout`.

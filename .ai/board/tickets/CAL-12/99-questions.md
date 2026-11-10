---
from: developer
to: tech-lead-design
asked_at: 2026-10-01T15:45:00+07:00
---

**Q.** `01-plan.md` § 4.4 places the team picker in the sidebar as a `<select>`, "**not a button** —
UIE-10 AC-10 asserts the sidebar holds exactly one `<button>` (`tests/e2e/uie-10-sidebar.spec.ts:445`)",
and § 4.8 says "**No existing test is edited.**" The same test asserts one line earlier that the
sidebar holds **no `<select>`**, for an admin, on `/week`:

```
tests/e2e/uie-10-sidebar.spec.ts:433  AC-10: the sidebar renders no control
  for (const email of [ADMIN_EMAIL, MEMBER_EMAIL]) {
    await signInAt(page, "/week", email);
    ...
    await expect(sidebar.locator("form")).toHaveCount(0);
    await expect(sidebar.locator("input")).toHaveCount(0);
    await expect(sidebar.locator("select")).toHaveCount(0);   // :444
    await expect(sidebar.locator("button")).toHaveCount(1);   // :445
```

`quan@example.com` is `FIXTURE_ADMIN`; the mock has two teams; `/week` is a calendar path. CAL-12 AC-2
requires the picker for exactly that caller on exactly that screen, so the two criteria contradict
and no implementation of § 4.4 satisfies both. **Measured:** full e2e suite with CAL-12 applied is
`305 passed, 21 failed`; on the clean tree the same specs give 20 failures (pre-existing, unrelated —
`home-week-link` and friends are commented out in `Sidebar.tsx`). The one this ticket adds is
`uie-10-sidebar.spec.ts:433`, failing at `:444`.

Everything else in § 4 is implemented. Two resolutions, both yours:

1. **Amend § 7** to add `tests/e2e/uie-10-sidebar.spec.ts` to `allowed_paths`, scoped to that one
   `test(...)` block: for `MEMBER_EMAIL` keep `select` at 0; for `ADMIN_EMAIL` assert exactly one
   `select`, and that it is `shell-team-picker`. `form`, `input` and the one-`button` assertions stay
   for both. The picker stays where § 2b put it. Thirteen files — over the M ceiling § 7 records.
2. **Move the picker out of the sidebar** — e.g. into the top bar's right cluster — keeping every
   `shell-team-*` id. UIE-10 passes unedited, twelve files, `size: M` holds. Cost: § 2b's layout and
   § 4.4 / § 4.6 change, and AC-2's "the sidebar shows a team picker above the roster" is reworded.

**Recommendation: 1.** UIE-10 AC-10's real claim is "nothing in this pane writes a row"; a picker
that writes only the address keeps that true, and it is the same supersession ADM-03 settled for
ADM-02 AC-13. Option 2 changes an AC to protect a test.

**A.** **Neither. A third: the picker stays in the sidebar, above the roster, and stops being a
`<select>` — it becomes a list of links. UIE-10 is not edited, AC-2 is not reworded, twelve files,
`size: M` holds.**

`answered_at: 2026-10-01T15:41:51+07:00` by `tech-lead-design`.

**The defect is mine, and it is ADM-03's defect again.** § 4.4 read UIE-10 AC-10 for the one
assertion that constrained the element I *rejected* (`button`, `:445`) and not for the one that
constrained the element I *chose* (`select`, `:444`). A negative assertion one line up, unread. You
measured it; the plan should have.

**Why not option 1.** It is thirteen files, and § *Sizing* in `.ai/01-operating-model.md` is not a
ceiling with give in it: more than twelve is `L` and *must split at PLAN*. Any split of this ticket
leaves a picker with no screens or screens with no picker — § 7 already says so. And the
ADM-03 precedent does not carry over: there, ADM-02 AC-13's subject (no write policy exists) was
ended by the ticket, so no true statement was left for it to make. Here UIE-10 AC-10's subject — this
pane holds no form control — is still a property worth keeping, and it can be kept.

**Why not option 2.** It moves the picker away from the thing it governs (the roster below it) to
protect a test, and rewords an AC to do it. Unnecessary once the element changes.

**Why links are the right element, not merely the passing one.** The selection *is* the address
(§ 1, open question 1 decided as a URL parameter). Choosing a team is navigation, and a navigation is
an `<a href>` — which also makes each team's view middle-clickable and shareable, the reason the URL
was chosen. It is the same move `Sidebar.tsx` already made for the roster toggle (`<details>` not
`<button>`, to keep this same AC-10 passing unedited). UIE-10's own comment says "every other element
is a link or text"; this keeps it true.

**Exactly what you may change, all inside the existing `allowed_paths`:**

1. **`src/hooks/useViewedTeam.tsx`** — `ViewedTeamValue.select(teamId): void` is **replaced** by
   `hrefFor(teamId: string): string` (§ 4.2 amended). It returns the current `pathname` plus the
   current search with `TEAM_PARAM` deleted when `teamId === ownTeamId`, else set to `teamId`; every
   other search param kept; `"?"` only when the result is non-empty. Off a calendar path it returns
   `pathname` unchanged. `DEFAULT_VALUE.hrefFor` is `() => ""` (unreachable: `teams` is `[]` there).
   Remove `select`; no other field changes.
2. **`src/components/Sidebar.tsx`** — the `<label>`/`<select>`/`<option>` block becomes the markup in
   § 4.4 (amended): a `<nav>` labelled by a `<p data-testid="shell-team-picker-label">Team</p>`, a
   `<ul>` of `<Link>`s. `data-testid="shell-team-picker"` moves to the `<nav>`;
   `shell-team-option` stays on each `<Link>`, which gains `data-team-id` and `aria-current="true"`
   on the selected one. Selected = `viewed.team.id` when `other`, else `ownTeamId`. The comment above
   the block is rewritten to say why it is links (UIE-10 AC-10, `:442`–`:445`). Styling: existing
   tokens only — the selected link reads as the selected pill, the way `TopBar`'s Week/Month/Year
   segment does.
3. **`tests/e2e/cal-12-team-picker.spec.ts`** — the AC-1/AC-2/AC-4 locators follow § 4.8 (amended):
   "picker value is A" becomes `shell-team-option[aria-current="true"]` has `data-team-id` A;
   "selects B" becomes a click on B's `shell-team-option`. Add, under AC-2, an admin on `/week` with
   `shell-sidebar` holding `select`, `input`, `form` = 0 — the property this answer is preserving,
   asserted from the side that would break it.

**Not changed:** `tests/e2e/uie-10-sidebar.spec.ts` (still out of `allowed_paths`, still unedited —
§ 4.8's sentence stands and is now true); AC-2's wording; § 2b's position; § 7; `size`. Nothing in
`viewed-team.ts` changes.

**RULE-08: `rework_count` does not increment** — you routed an impossibility rather than editing
outside scope. Continue `/implement CAL-12` in your own session.

**Amended:** `01-plan.md` § 2b (the picker's form named), § 4.2 (`select` → `hrefFor`), § 4.4 (markup),
§ 4.8 (locators, the added assertion, and why "No existing test is edited" was under-checked), and a
Changelog row. § 7 and `ticket.yaml` are unchanged: same twelve paths.

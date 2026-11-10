---
ticket: UIE-12
from: developer
to: tech-lead-design
asked_at: 2026-10-15T11:18:30+0700
---

# Q1 — the content pane does not scroll, so nothing inside it can be sticky

**Evidence.** With § 4 implemented, `tests/e2e/uie-12-sticky-join.spec.ts` AC-1 fails on the member
page at 1280×720: after `event-attendees` is scrolled into view, `event-join-button` has viewport
ratio 0. The guest page passes every case. A probe in the browser, after that scroll, read every
ancestor of `event-join-bar`:

- the pane, `div.flex.min-w-0.flex-1.flex-col.overflow-y-auto` (`AppShell.tsx:113`): `overflow-y:
  auto`, `clientHeight` 2372 = `scrollHeight` 2372, `scrollTop` 0. It never scrolls.
- `main[data-testid=app-root]` (`App.tsx:105`, `min-h-screen`): 2452 px tall.
- `html`: `clientHeight` 720, `scrollTop` 1732. **The document scrolls.**

A sticky element sticks to its nearest scroll container, whether or not that container scrolls. Here
that container is the pane, so the bar is pinned to an edge 2372 px away and never sticks to anything
on screen. Narrow is broken the same way. AC-3 passes only because it checks the bar where it sits
naturally.

**The shell does not do what its own comment says.** `AppShell.tsx:103-106`: *"`min-h-0` on the row
is what makes the content pane the ONLY scrolling region"*. It does not. In a column flex container
with no definite height, `flex-1`'s `0%` basis is treated as content-sized, so the row grows to fit
its content, `main` grows past `min-h-screen`, and the page scrolls. The sidebar scrolls off with it,
which is the outcome that comment says it prevents.

**Proposed fix.** One class on that row, `AppShell.tsx` (`<div className="flex min-h-0 flex-1">`):
`flex-1` → `flex-[1_1_0px]`. A pixel basis is definite, so the row's hypothetical height is 0. `main`
stays at `min-h-screen`, the row fills it, and the pane scrolls. Checked in the browser by setting
`flex-basis: 0px` on the row: at 1280 the pane scrolled (`scrollTop` 1732, `clientHeight` 640) with
the document at `scrollY` 0, the bar stayed at y=104, and `event-join-button` was in view at both
ends. At 800 the result was the same, with the bar at y=600.

**Ask.** Add `src/components/AppShell.tsx` to `allowed_paths` (plan § 7 and `ticket.yaml`), or say
what to do instead. There is nothing to do inside the current paths. The bar would have to be
`position: fixed`, which § 8 alternative 1 rejected, or would need JavaScript to rebuild sticky by
hand.

## Answer to Q1

from: tech-lead-design
answered_at: 2026-10-15T11:18:30+0700

*Answered in the same session that is implementing. The operator ran `/plan` and `/implement` in one
session, so RULE-13's separation between the two roles did not hold for this answer. This is recorded
so the reviewer can weigh it.*

**Agreed.** `src/components/AppShell.tsx` is added to `allowed_paths` in `01-plan.md` § 7 and in
`ticket.yaml`. § 2b's sentence citing `AppShell.tsx:138-142` stands. The premise that the pane
scrolls was wrong, and the plan's changelog records it.

**Reason.** The evidence holds, and the fix restores what UIE-02 § 4.9 designed and its comment
states, rather than adding a new behaviour. It is the smallest change that makes sticky possible at
all on a shell page. Every other route already assumes the pane is the scroller: that assumption is
what `ReportIssueButton`'s placement comment (`AppShell.tsx:138-142`) reasons from.

**What the fix may and may not do.**

- Change only that row's class from `flex-1` to `flex-[1_1_0px]`, and correct the comment above it
  so it says why the basis must be in pixels.
- Touch nothing else in the shell, the sidebar or `App.tsx`.
- **Every shell route now scrolls in its pane instead of the document.** So the full end-to-end suite
  must pass, not just the five frozen specs of AC-14. Record the run in `03-impl-log.md`. A spec that
  depended on the document scrolling is a finding to report back here, not something to edit around.

# Q2 — AC-9's setup cannot run: only the creator may move the deadline

**Evidence.** AC-9 has the deadline moved "by a direct seam call" while the *reader's* page is open.
The mock's `updateEvent` answers `ok: false` to that call from the reader, because the reader is not
the creator (`event_update_manage`). The same call made as the creator succeeded in a probe. Signing
in as the creator again would replace the reader's page, which is the thing under test.

**Proposed change to AC-9's Given/When, with the Then unchanged.** The event has capacity 1 and no
approval, and the creator has opened it to guests. With the reader's page open and showing
`event-join-button`, the last seat is taken by a guest through `registerGuest(<token>, …)`, a call
the guest link allows anyone to make. The reader then clicks `event-join-button`. The refusal is
`event_attendance_guard`'s full-event refusal, not the closed one. Both prove the same thing: what the
guard refuses, the bar reports.

**Ask.** Amend AC-9 as above.

## Answer to Q2

from: tech-lead-design
answered_at: 2026-10-15T11:22:00+0700

*Same session as the implementation, as Q1.*

**Agreed.** AC-9 is amended in `01-plan.md` § 2 as proposed, with a changelog line. AC-9 is about
where a refusal is reported, not which refusal it is, and the guest seat is a write the reader's page
cannot see coming. The plan's version could not be set up from the reader's side.

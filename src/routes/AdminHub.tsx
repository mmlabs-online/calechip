// UIE-09 — the admin hub. 01-plan.md § 4.4, § 4.5 and § 4.6.
//
// EVERYTHING IN THIS FILE IS AN AFFORDANCE (ADR-005), AND IT IS A WEAKER ONE THAN USUAL: the screen
// renders five LINKS and nothing else. The five destinations keep their own guards, their own
// refusals and their own row-level security exactly as they had them before this file existed, so
// nothing here is the control for anything — a caller who reached one of those addresses by typing
// it is refused by the screen at the far end, not by the absence of a row in the list below.
//
// **NO WRITE FUNCTION FROM THE SEAM IS IMPORTED, AND THAT IS CHECKABLE BY READING ONE LINE.**
// `seam.getCurrentMember` is the only member of `seam` this file names (01-plan.md § 4.4), which is
// what makes AC-6's denial — a member sees NONE of the five destinations — a property of the file
// rather than a claim about it.
//
// **THE HUB IS A LIST AND NEVER A DASHBOARD.** It renders no count, no status and no summary of
// anything behind its five links, so it has one read, one refusal and no arithmetic. 01-plan.md § 2,
// the one assumption that ships: the moment it summarises something it acquires a seam read per
// destination and a partial failure state, which is `ticket.yaml` § 9's named size risk and is a
// different ticket.
import { useCallback, useEffect, useState } from "react";
// SOLO, 2026-09-12. **THE `admin-hub-back` LINKS ARE GONE, AND THIS TIME IT IS A DECISION.** The
// note that stood here recorded a removal on 2026-09-10 that had been reverted, and set the test for
// telling the two apart: *"a removal that skipped its own sibling and left three criteria asserting
// the opposite reads as an oversight, not a decision. If it was a decision, deleting these four
// lines and flipping those three assertions is the whole of it."* The operator instructed the
// removal in words on 2026-09-12, all FOURTEEN links went in one sweep across all six admin screens,
// and the eleven assertions that followed one were rewritten with it. Neither half of that test is
// met any more.
//
// **WHAT REPLACES IT WAS ALREADY THERE**, which is why the link was redundant rather than merely
// unwanted: `TopBar.tsx:75-80` says in terms that its one control *"standing on any admin screen is
// the way back to the calendar"*, and the top bar renders above every screen inside the
// shell. A second way out, in prose, at the bottom of the page, below the fold on a long worklist.
// The seam, through its one door: nothing above the seam names an implementation, so this file must
// never import `@/lib/data/supabase` or `@/lib/data/mock` (RULE-02).
import { seam } from "@/lib/data";
import type { Member } from "@/lib/domain/types";
import { mayAdminister } from "@/lib/roles";
// SOLO, 2026-09-11 — the loading mark that replaced this screen's sentence. The sentence itself is
// still announced: `Loader.tsx` keeps it as `sr-only` text, because the element below carries
// `role="status"` and an emptied one announces nothing.
import Loader from "@/components/Loader";

/**
 * The four phases `Threshold.tsx:45-48` established, so a reader meets no new shape here. `loading`
 * MUST resolve, which is why every path out of the effect below sets one of the other three.
 *
 * `refused` AND `unavailable` ARE SEPARATE AND MUST STAY SEPARATE — AC-8. A denial and a transport
 * failure are different answers: an admin whose read threw is not being told they are not an admin,
 * and a member is not being told to try again in a moment.
 */
type View =
  | { phase: "loading" }
  | { phase: "refused" }
  | { phase: "unavailable" }
  | { phase: "ready"; me: Member };

export default function AdminHub() {
  const [view, setView] = useState<View>({ phase: "loading" });

  // ONE SEAM CALL AND NO OTHER. The screen reads the member itself rather than receiving it from the
  // router — 01-plan.md § 8, rejected alternative 5: a screen whose refusal depends on a route line
  // is a screen whose denial moves the moment somebody edits that line. `Threshold.tsx`,
  // `TeamEntries.tsx` and `PendingEntries.tsx` each read the member and each refuse in place, and
  // the three extra phases are the price of the refusal living in the component that renders it.
  const load = useCallback(async (): Promise<void> => {
    try {
      const me = await seam.getCurrentMember();

      // AC-6, and the member-row-less caller that got past the route guard, in one branch. The route
      // sends the second one to `/` before this component exists (AC-7); this is the belt to that
      // brace, and folding the two together tells somebody outside the team nothing they could not
      // already infer from the sign-up screen.
      if (!me || !mayAdminister(me.role)) {
        setView({ phase: "refused" });
        return;
      }

      setView({ phase: "ready", me });
    } catch {
      // A transport failure, or the Supabase client raising on an unusable configuration before any
      // request leaves. AC-8: this is why the screen has a fourth phase at all.
      setView({ phase: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (view.phase === "loading") {
    return (
      <p
        data-testid="admin-hub-loading"
        role="status"
        className="mx-auto max-w-2xl rounded-card bg-card p-8 text-center text-sm opacity-70 shadow-soft"
      >
        <Loader label="Opening the admin area…" />
      </p>
    );
  }

  if (view.phase === "refused") {
    return (
      <section
        data-testid="admin-hub-refused"
        className="mx-auto max-w-2xl rounded-card bg-card p-8 text-center shadow-soft"
      >
        <h1 className="text-xl font-semibold text-ink">This area is for admins</h1>
        {/* AC-6. It names none of the five destinations and no member: somebody who is not an admin
            learns here only that admins exist, which the sign-up screen already says. */}
        <p className="mt-2 text-sm text-ink-2">
          Only an admin can approve entries, manage the team and change the team&rsquo;s settings.
        </p>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <section
        data-testid="admin-hub-unavailable"
        role="alert"
        className="mx-auto max-w-2xl rounded-card bg-card p-8 text-center shadow-soft"
      >
        <h1 className="text-xl font-semibold text-ink">The admin area could not be opened</h1>
        {/* AC-8. NO LIST IS DRAWN ON THIS PATH, and it does not say the area is for admins: a
            transport failure reported as a refusal tells an admin they are not one. */}
        <p className="mt-2 text-sm text-ink-2">
          Your account could not be read just now. Try again in a moment.
        </p>
      </section>
    );
  }

  return (
    <section data-testid="admin-hub" className="flex w-full flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-ink">Admin</h1>
        <p className="mt-2 text-sm text-ink-2">
          Everything an admin can do, in one place. Pick a tab above — each one is its own screen,
          and nothing is decided here.
        </p>
      </header>

      {/* **THE `<ol>` OF FIVE CARDS THAT STOOD HERE IS NOW THE TAB STRIP, AND IT MOVED RATHER THAN
          CHANGING.** `src/components/AdminTabs.tsx` carries UIE-09's `DESTINATIONS` array verbatim
          — the same five addresses in § 2b's order, the same `admin-hub-link` row id with the same
          `data-to`, and the same five `admin-hub-*-link` ids on the anchors — and `AdminLayout`
          renders it above this screen and above each of the five. **AC-3, AC-4, AC-5 and AC-9 all
          still pass on THIS page, unedited**, because the rows they count and follow are still on
          it; they are one element higher up the tree.

          **IT MUST NOT BE RENDERED TWICE.** A second copy of the five here would put two nodes
          under each `admin-hub-*-link`, which fails AC-9's exactly-one count and every strict-mode
          click in the eight other spec files that follow one. That is the whole reason this list is
          gone rather than kept alongside the strip, and it is why the five blurbs moved to the tab
          anchors' `title` instead of staying as a second, fuller list.

          SOLO, 2026-09-09. `.claude/agents/solo.md`; there is no ticket and no plan for this. */}
    </section>
  );
}

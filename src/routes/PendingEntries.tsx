// ADM-04 — the worklist of entries awaiting a decision. 01-plan.md sections 2, 2b, 3, 4.3 and 4.5.
//
// **ADM-05 PUTS THE DECISION ON THIS SURFACE, which is what ADM-04's own header said it would.**
// That header read "it carries no approve control and no reject control, and that is the ticket
// rather than an omission" — the losing half of a triage argument kept in
// .ai/registry/features.md:103 so nobody re-argued it there. It is spent now: ADM-05 mounts
// `EntryDecision` on each row, consuming `entry_update_admin` and clause (a) of
// `public.entry_enforce_decision()`. ADM-04's other three verbs are UNCHANGED — this screen still
// LISTS, FILTERS and COUNTS exactly as it did, and ADM-04's own suite passes unedited.
//
// **THE ONE WRITE IS THE PANEL'S AND THIS FILE STILL ISSUES NONE.** `EntryDecision` calls the seam;
// this screen hands it an entry and re-reads when it reports back. The link on a row still goes to
// `/entries/:id/edit`, which is CAL-02's and CAL-03's shipped screen.
//
// **ADM-06 ADDED THE BATCH TO THIS SURFACE AND SOLO REMOVED IT AGAIN ON 2026-09-10**, on the
// operator's instruction: *"Bỏ phần Select entries to reject them together."* `BulkRejection.tsx` is
// deleted, the selection state and the per-row checkbox with it, and `tests/e2e/adm-06-bulk-reject.spec.ts`
// is deleted because all five of its tests drove the removed controls.
//
// **THE SEAM AND THE DATABASE ARE UNTOUCHED, AND THE OPERATOR CHOSE THAT DEPTH WHEN ASKED.**
// `seam.rejectEntries`, `BulkRejectionOutcome`, `tests/bulk-rejection.test.ts` and
// `supabase/migrations/20260905230000_adm06_reject_entries.sql` all stay. So ADM-06's CAPABILITY is
// intact and only its surface is gone — re-mounting a bar later needs a component and nothing else,
// and no schema change was made on live data to undo something a UI decision can undo for free.
//
// **THE `Open` LINK IS GONE AND THE WHOLE ENTRY IS ON THE ROW — SOLO, 2026-09-10**, on the
// operator's instruction against an image: *"bỏ nút open"*, *"Show đầy đủ thông tin request ngay
// từng row"*. The two halves are one decision: a link to a detail screen is only worth a row's width
// while the row is a summary, and the instruction is that it should stop being one.
//
// **THIS REVERSES ADM-04 AC-14**, which reads *each row links to that entry's own edit screen*. It
// is reversed rather than quietly dropped, and `tests/e2e/adm-04-worklist.spec.ts` now asserts the
// link ABSENT in the same test that asserted it present — the convention
// `tests/e2e/solo-pending-approval-ui.spec.ts` set when the filters went.
//
// **NO CAPABILITY IS LOST AND THAT IS WHY THIS IS CHEAP.** `/entries/:id/edit` is unchanged and
// still reachable: CAL-03's team list at `/entries/team` carries `team-entry-row-edit` on every row,
// which is the same route for the same entries. What is gone is a second door to it from a screen
// whose job is deciding, not editing.
//
// **WHAT "EVERYTHING" MEANS HERE IS EVERY COLUMN OF THE ROW, and it is a short list because the row
// already carried most of it**: who, both bounds, the type, the portion, whether it is tentative,
// and the crowded-day sentence. The note stopped being TRUNCATED — a decision about somebody's week
// should not turn on a sentence cut off mid-word — and `createdAt` is drawn, which is the one field
// of `Entry` a reader of this queue could previously only get by opening the entry.
//
// **THE IMAGE PUTS A GROUP IN PARENTHESES AFTER EACH NAME — `(Core Engineering)`, `(Backend Team)`,
// `(Design / Product)` — AND NOTHING IS DRAWN THERE.** `public.member` has no group, department or
// squad column and `Member` has no such field (`src/lib/domain/types.ts:20-42`); v1 has exactly one
// team, so even the team's own name would be the same parenthetical on every row. Inventing a field
// to fill a mockup is what `CLAUDE.md` § *Working agreements* forbids in as many words, and the
// carve-out it makes for `/solo` is the ARRANGEMENT of a screen, never its data.
//
// **THE IMAGE ALSO PUTS A PINK `5` ON THE APPROVALS TAB, AND THAT IS STILL NOT DRAWN.**
// `src/components/AdminTabs.tsx:15-21` records that the operator was asked on 2026-09-09 and chose
// to leave it out, because a count on a tab is a seam read, a loading state and a refusal path on a
// component that makes no seam call at all. This instruction was about the rows and did not reopen
// that.
//
// **THE FILTERS AND THE PAGER ARE GONE TOO, FROM AN EARLIER INSTRUCTION**: *"Bỏ phần filter"* and
// *"Bỏ pagination thay bằng load more"*. What that costs ADM-04 is named at the query and at the
// list below. This screen now LISTS and COUNTS; it no longer FILTERS, and it pages by ACCUMULATING
// rather than by replacing.
//
// **AFTER A DECISION THE SCREEN RE-READS FROM THE FIRST PAGE (ADM-05 AC-1, AC-2).** `reload()`,
// never a local splice: the row leaves the queue and `pending-entries-count` falls because the
// datastore says so. Splicing would make the count and the list disagree, which is the one property
// this screen was built not to have.
//
// **A DECISION COLLAPSES AN EXPANDED LIST BACK TO ONE PAGE, AND THAT IS A CHOSEN COST.** The
// alternative — re-reading pages 0..k and concatenating — is k requests, and it is not even correct:
// these are OFFSET pages over a set that just shrank, so re-reading them after a removal can skip a
// row into the gap the decided entry left. One read from the top can skip nothing.
//
// **THE REFUSAL IS AN AFFORDANCE AND NOT A CONTROL**, and it has to be said plainly because a screen
// that says "this page is for admins" reads exactly like one — the sentence TeamEntries.tsx already
// carries, and here it is stronger. `entry_select_team` admits the whole team's rows to BOTH roles,
// so a member who deleted this refusal in a debugger would see a list of rows they can already read
// at `/entries/team`, and would gain nothing. There is no capability behind this screen that a
// member lacks, which is why nothing in this file is load-bearing for security (01-plan.md section
// 3).
//
// **THE COUNT AND THE LIST COME FROM ONE READ AND CANNOT DISAGREE.** `seam.listPendingEntries`
// returns the page AND the exact size of the matching set in one response. Two calls could disagree,
// because a write can land between them, and the feature row forbids exactly that. Nothing in this
// file derives the outstanding figure from `rows.length`.
//
// **`today` IS THIS MACHINE'S DATE AND IS PASSED INTO THE READ.** The one place a local date read is
// correct — the exception MonthView.tsx records for `currentMonth()` — because "what day is it for
// the person looking at the screen" is a fact about their clock. A server-side `current_date` would
// be evaluated in UTC and would move the boundary seven hours early for a Vietnamese team.
//
// Colour: `.ai/standards/ui-design-system.md` section Colour is still `TODO(project)`, and every
// criterion here turns on an attribute or on copy rather than on a colour, so none of them changes
// when the standard is written. 01-plan.md section 2b records that no image was attached at any
// stage and that the arrangement below is the Tech Lead's own — borrowed wholesale from
// TeamEntries.tsx, which is the nearest thing the product has to this screen.
import { useCallback, useEffect, useState } from "react";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `./supabase` or `./mock` (RULE-02).
import EntryDecision from "@/components/EntryDecision";
import { usePageOverload } from "@/hooks/usePageOverload";
import { seam } from "@/lib/data";
import type { Entry, EntryOwner, EntryType, Member } from "@/lib/domain/types";
import { PORTION_LABELS, TYPE_LABELS } from "@/lib/labels";
import { mayDecide } from "@/lib/roles";
// SOLO, 2026-09-11 — the loading mark that replaced this screen's "Loading…" sentence. The
// sentence itself is still announced: `Loader.tsx` keeps it as `sr-only` text, because the element
// below carries `role="status"` and an emptied one announces nothing.
import Loader from "@/components/Loader";
import Avatar from "@/components/Avatar";
import BusySpinner from "@/components/BusySpinner";

// OPS-002 folded these into src/lib/labels.ts. The paragraph that stood here handed the fold to
// OPS-001, which shipped without doing it; the shared home is a module rather than a component, so
// no ticket has to own a component to fold a label set into it.

/**
 * This machine's date as `yyyy-MM-dd`.
 *
 * The LOCAL accessors are correct here and only here, which is worth naming because every other date
 * in this product is compared as a timezone-free string and never read off a clock. MonthView.tsx's
 * `currentMonth`, WeekView.tsx's `today` and YearView.tsx's `currentYear` all record the same
 * exception for the same reason: this answers "what day is it for the person looking at the screen".
 */
/**
 * SOLO, 2026-09-10 — **A LEAVE ROW AND A WORK-FROM-HOME ROW DO NOT LOOK THE SAME.** The operator's
 * instruction: *"ở page pending approval. Tôi muốn UI của row WFH và row PTO khác nhau"*.
 *
 * **THE COLOURS ARE NOT CHOSEN HERE AND NOTHING NEW IS PICKED.** `CLAUDE.md` § *Visual direction*
 * fixes PTO to peach and WFH to mint, UIE-01 and UIE-06 made them `--color-pto` and `--color-wfh`,
 * and this screen is now the fifth surface to spend them — the month grid's avatar chips, the
 * sidebar's legend, the entry form's type tabs and `EntryDecision`'s approve control are the other
 * four. A queue that used a sixth vocabulary for the same distinction would be the defect UIE-06 § 1
 * describes, where a legend and the thing it explains were painted from two different palettes.
 *
 * **AND THE COLOUR IS NEVER THE ONLY SIGNAL.** UIE-01 AC-4's rule holds here: the type is also the
 * WORD, in full, on every row — `Leave` or `Working from home` — so a reader who cannot separate
 * peach from mint loses nothing. The fill is what makes the distinction survive a glance down a
 * queue of six.
 *
 * **WHY IT MATTERS MORE ON THIS SCREEN THAN ANYWHERE ELSE.** `glossary.md` calls a WFH member being
 * read as absent the single most costly confusion in the domain, and this is the one screen where
 * somebody acts on the distinction rather than merely reading it.
 */
const TYPE_STRIPE: Record<EntryType, string> = {
  pto: "border-l-pto",
  wfh: "border-l-wfh",
};

const TYPE_PILL: Record<EntryType, string> = {
  pto: "bg-pto",
  wfh: "bg-wfh",
};

/** SOLO. The stable empty page handed to `usePageOverload` on the three non-`ready` phases. A fresh
 *  `[]` would be a new dependency on every render; this is one array for the life of the module. */
const NO_ROWS: readonly Entry[] = [];

function localToday(): string {
  return localDayOf(new Date());
}

/**
 * A timestamp as the reader's own `yyyy-MM-dd`.
 *
 * SOLO, 2026-09-10. Extracted from `localToday` when the row began drawing `createdAt`, so the two
 * cannot answer the same question differently — the queue's `today` and the day a row says it was
 * declared are read off the same clock in the same format.
 */
function localDayOf(at: string | Date): string {
  const when = typeof at === "string" ? new Date(at) : at;
  return `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
}

// Four phases, the shape TeamEntries.tsx and MemberList.tsx use. AC-12: "still loading", "this is not
// for you" and "the read failed" are three different facts, and folding any two of them tells
// somebody something untrue — here worst of all, because a worklist that renders short reads as a
// queue that is finished.
type View =
  | { phase: "loading" }
  | { phase: "refused" } // AC-10, and the state a caller with no member row lands on
  | { phase: "unavailable" } // any throw, including AC-5's short-page assertion
  | {
      phase: "ready";
      rows: Entry[];
      total: number;
      /** SOLO. How many pages this screen has ACCUMULATED. The next read asks for this index. */
      pages: number;
      pageSize: number;
      roster: Member[];
      /** SOLO 2026-09-13, ADR-035 § Decision item 3. The caller, so a manager's OWN row can say who decides it. */
      me: Member;
      /** MIR-14-b. The owners `listEntryOwners` named, keyed by member id: the name a second-team
       *  decider's roster cannot supply (ADR-072 decision 1), and the teams each entry affects.
       *  MIR-17-c, ADR-090 decision 1: this is ALSO the set of owners the caller may decide — every
       *  key answered `may_decide_entry` true for this caller, because that is `list_entry_owners`'
       *  only filter. A row's controls and the screen's own refusal both read it for that reason. */
      owners: Map<string, EntryOwner>;
    };

/** MIR-14-b. The distinct owners of `rows` that `known` does not already hold. */
function unresolvedOwners(rows: readonly Entry[], known: ReadonlyMap<string, EntryOwner>): string[] {
  return [...new Set(rows.map((e) => e.memberId))].filter((id) => !known.has(id));
}

function withOwners(
  known: ReadonlyMap<string, EntryOwner>,
  found: readonly EntryOwner[],
): Map<string, EntryOwner> {
  const next = new Map(known);
  for (const owner of found) next.set(owner.memberId, owner);
  return next;
}

export default function PendingEntries() {
  const [view, setView] = useState<View>({ phase: "loading" });

  // The query, and it is three pieces of one thing rather than three states: every change to any of
  // them is a new read. `today` is resolved ONCE, on mount, so a screen left open across midnight
  // keeps answering the question it was opened with rather than silently re-filtering.
  const [today] = useState(localToday);

  // SOLO, 2026-09-10. **`busy` IS NOT A PHASE, AND THAT DISTINCTION IS THE WHOLE OF "LOAD MORE".**
  // The `loading` phase blanks the screen, which is right on a first read and wrong on a second: a
  // list that vanished while it grew would lose the rows the admin was reading. So fetching the next
  // page sets this instead, and the only thing it changes is the control's own label and disabled
  // state.
  const [busy, setBusy] = useState(false);

  // SOLO, 2026-09-10 — **THE QUERY IS FIXED NOW, AND `window: "all"` IS A DECISION THE OPERATOR
  // MADE WHEN ASKED.** ADM-04 defaulted to `upcoming` and offered a control to reach the other two;
  // 01-plan.md § 2 is explicit that *the control is what advertises the existence of the sets it is
  // not showing*. Remove the control and keep `upcoming` and that sentence becomes the bug: a
  // past-dated pending entry would be unreachable from this screen forever, with nothing on it to
  // say so. `all` is the only window under which removing the filter hides nothing.
  //
  // `type: null` is both kinds, which is what the removed Kind control defaulted to.
  //
  // **THE SEAM STILL TAKES BOTH**, untouched: `PendingEntryQuery` keeps `window` and `type`, and
  // `tests/pending-entries.test.ts` still exercises every window and both kinds directly. What was
  // removed is a screen's controls, not a read's capability — which is why re-adding a filter later
  // is a component change and nothing more.
  //
  // `today` is still passed and still resolved ONCE on mount, so a screen left open across midnight
  // keeps answering the question it was opened with rather than silently re-filtering.
  const queryFor = useCallback(
    (page: number) => ({ type: null, window: "all" as const, today, page }),
    [today],
  );

  const reload = useCallback(async (): Promise<void> => {
    setView({ phase: "loading" });

    try {
      const me = await seam.getCurrentMember();

      // AC-10 and AC-12. A caller with no member row lands here too. `refused` fails CLOSED, which
      // is what AllowList.tsx and TeamEntries.tsx both chose for the same fork: it is not a true
      // sentence about why, and the alternative is drawing a worklist to somebody the seam has told
      // us nothing about.
      if (!me) {
        setView({ phase: "refused" });
        return;
      }

      // The two reads 01-plan.md section 4.3 permits, and no third. `seam.getTeam()` is deliberately
      // NOT called: it exists to supply `overloadThreshold`, this screen computes no absence count,
      // and calling it would be the first step toward a number that is not this screen's — the
      // refusal CAL-05 and CAL-06 each recorded on their own surfaces.
      //
      // `listMembers()` returns the roster INCLUDING removed members (ADR-013), which is what AC-2
      // needs: an entry whose owner has since been removed still resolves to a name rather than to a
      // bare uuid.
      const [pageResult, roster] = await Promise.all([
        seam.listPendingEntries(queryFor(0)),
        seam.listMembers(),
      ]);

      // MIR-14-b AC-10, AC-13. The third read, and it is the page's OWNERS: who each entry belongs
      // to when the roster cannot say (a second-team owner), and every team it affects. Inside the
      // same `try`, so a failure here lands on `unavailable` like the other two — a queue drawn
      // without the teams its entries affect is a queue decided on half the facts.
      const owners = withOwners(
        new Map(),
        await seam.listEntryOwners(unresolvedOwners(pageResult.rows, new Map())),
      );

      // AC-5, ADR-090 decision 1. The refusal moves here from before the reads: "nothing to decide"
      // can only be known once `owners` is in hand. A deciding rank admits the screen outright;
      // without one, the caller is admitted only when `owners` named at least one row they may
      // decide — `owners` IS the decidable set (see the field's own comment above).
      if (!mayDecide(me.role) && owners.size === 0) {
        setView({ phase: "refused" });
        return;
      }

      setView({
        phase: "ready",
        rows: pageResult.rows,
        total: pageResult.total,
        pages: 1,
        pageSize: pageResult.pageSize,
        roster,
        me,
        owners,
      });
    } catch {
      // AC-5 and AC-12. Both reads throw on a transport failure, and `listPendingEntries` throws on a
      // page the datastore shortened. No partial list is ever drawn: a worklist that is short by two
      // entries is two decisions nobody will ever make, and nothing about it looks wrong.
      setView({ phase: "unavailable" });
    }
  }, [queryFor]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * SOLO, 2026-09-10 — the next page, APPENDED. What replaced the pager.
   *
   * **IT NEVER SETS A PHASE.** `busy` is what changes, so the rows already on screen stay on screen
   * while the next page arrives — which is the entire difference between "load more" and "next
   * page", and the reason the pager could not simply be relabelled.
   *
   * **IT READS THE PAGE AFTER THE LAST ONE HELD, NOT `total / pageSize`.** `pages` counts what this
   * screen has actually accumulated; deriving the next index from the total would ask for a page
   * that was already loaded whenever the set shrank under it.
   *
   * **A FAILURE HERE DOES NOT BLANK THE SCREEN.** `reload`'s catch sets `unavailable` because it has
   * nothing to show; this one has a list already, and replacing it with a failure notice would throw
   * away rows that are still perfectly true. It stops, and the control comes back so the admin can
   * try again — the same reasoning `EntryDecision` records for keeping a refused rejection on screen.
   *
   * **`listMembers()` IS NOT RE-READ.** The roster in hand already names every owner on the team, so
   * a second read would be one request per page for an answer that does not change.
   */
  const loadMore = useCallback(async (): Promise<void> => {
    if (busy) return;
    setBusy(true);

    try {
      const next = await seam.listPendingEntries(
        queryFor(view.phase === "ready" ? view.pages : 0),
      );

      // MIR-14-b AC-12. Only the owners not already resolved. A throw here is the catch below's —
      // the rows on screen stay and the control comes back (AC-13).
      const known = view.phase === "ready" ? view.owners : new Map<string, EntryOwner>();
      const found = await seam.listEntryOwners(unresolvedOwners(next.rows, known));

      setView((current) =>
        current.phase === "ready"
          ? {
              ...current,
              // The TOTAL comes from the newest response rather than being kept: it is the size of
              // the matching set at the moment of THIS read, and a decision landing between the two
              // pages must move the number the header states.
              total: next.total,
              rows: [...current.rows, ...next.rows],
              pages: current.pages + 1,
              owners: withOwners(current.owners, found),
            }
          : current,
      );
    } catch {
      // Deliberately silent about the list. See the note above.
    } finally {
      setBusy(false);
    }
  }, [busy, queryFor, view]);

  // SOLO, 2026-09-09 — the crowded-day sentence on a row. **CALLED HERE, ABOVE THE FOUR EARLY
  // RETURNS, BECAUSE A HOOK CANNOT BE CONDITIONAL**; on every phase but `ready` it is handed the
  // shared empty array and issues no read at all.
  //
  // `NO_ROWS` IS A MODULE CONSTANT AND NOT A FRESH `[]`. A new array each render is a new dependency
  // each render, which would rebuild the derived map on every keystroke of the filter for a screen
  // that is not even showing rows.
  //
  // **THIS ADDS NO PHASE TO THIS SCREEN.** The hook says nothing when its read fails, so the queue
  // still lists, filters, counts and pages exactly as ADM-04 shipped it — the four phases above are
  // untouched, and a reader should be able to check that by seeing that `view` is not mentioned here.
  const crowded = usePageOverload(view.phase === "ready" ? view.rows : NO_ROWS);

  if (view.phase === "loading") {
    return (
      <p
        data-testid="pending-entries-loading"
        role="status"
        className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
      >
        <Loader label="Loading…" />
      </p>
    );
  }

  // AC-10. It names no entry and no member — a refusal that listed what it was withholding would be
  // the read it is refusing.
  if (view.phase === "refused") {
    return (
      <section
        data-testid="pending-entries-refused"
        className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">This page is for admins and managers</h1>
        <p className="mt-2 text-sm opacity-70">
          Only an admin or a manager decides on an entry. Everything listed here is readable by the whole team on
          the team&rsquo;s entries page.
        </p>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <section
        data-testid="pending-entries-unavailable"
        role="alert"
        className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">The worklist could not be loaded</h1>
        {/* AC-5. No partial list is ever drawn, and the sentence says why in the direction that
            matters: a short queue reads as a finished one. */}
        <p className="mt-2 text-sm opacity-70">
          Nothing is listed rather than part of it. A short list here would look like a queue with
          nothing left in it. Please reload the page.
        </p>
      </section>
    );
  }

  const { rows, total, pageSize, roster, owners } = view;

  // The owner's display name, from the roster the same load returned. An id is shown when no roster
  // row matches, which under `entry_select_team` and `member_select_team` cannot happen — both are
  // scoped to the same team by the same helper — so it is a fallback for a state the policies
  // exclude rather than a case with a design. TeamEntries.tsx records the same.
  //
  // MIR-14-b. That sentence stopped being true with MIR-14: `entry_select_decider` admits a
  // second-team owner's entry, and `member_select_team` stays primary-only (ADR-072 decision 1). So
  // `owners` is the second source, after the roster — the roster first, because it is the only one
  // that still names a REMOVED owner (ADR-013, AC-11).
  const ownerName = (memberId: string): string =>
    roster.find((m) => m.id === memberId)?.displayName ??
    owners.get(memberId)?.displayName ??
    memberId;

  const ownerAvatar = (memberId: string): string =>
    roster.find((m) => m.id === memberId)?.avatar ?? owners.get(memberId)?.avatar ?? "";

  // SOLO, 2026-09-10. **THE ROWS IN HAND AGAINST THE SIZE OF THE MATCHING SET**, which is the one
  // comparison "load more" needs and the only one it makes. `total` is the datastore's figure from
  // the newest response, never `rows.length` — the property this screen's header note states and the
  // reason a control offering a page that is not there is not reachable from here.
  const more = rows.length < total;

  return (
    <section className="flex w-full flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">Waiting for a decision</h1>

        {/* AC-3. THE EXACT SIZE OF THE MATCHING SET, from the same response the rows came in — not
            the number of rows on screen, which `data-shown` carries beside it so a test can assert
            the two are allowed to differ. A sentence in the header rather than a badge on a
            navigation item, because this product has no navigation chrome to hang one on and
            inventing one would be inventing a control (01-plan.md section 2b).

            AC-15. The object is an ENTRY and never a request, an application or an *đơn*, and no
            quota, balance or remaining-days figure appears here or anywhere on this screen. */}
        <p
          data-testid="pending-entries-count"
          data-total={total}
          data-shown={rows.length}
          className="mt-1 text-sm opacity-70"
        >
          {total === 1 ? "1 entry is" : `${total} entries are`} waiting in this view. Deciding is
          coordination, not permission — nothing is blocked while an entry waits.
        </p>
      </header>

      {/* AC-11. An empty worklist SAYS SO. A screen with no rows and no sentence is
          indistinguishable from one that failed to load, and on this screen that mistake is the
          feature's whole failure mode read backwards. */}
      {rows.length === 0 ? (
        <p
          data-testid="pending-entries-empty"
          className="rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
        >
          Nothing is waiting for a decision in this view.
        </p>
      ) : (
        // SOLO, 2026-09-09. ONE CARD HOLDING FIVE DIVIDED ROWS, not five cards with a gap between
        // them — the transcription's arrangement, and the reason it is better is that a queue reads
        // as one thing to work down rather than five things to consider separately.
        <ul
          data-testid="pending-entries"
          className="divide-y divide-line overflow-hidden rounded-card bg-card shadow-soft"
        >
          {rows.map((entry) => {
            const owner = owners.get(entry.memberId);
            return (
              <li
                key={entry.id}
                data-testid="pending-entry-row"
                data-entry-id={entry.id}
                data-member-id={entry.memberId}
                data-type={entry.type}
                data-portion={entry.portion}
                data-start-date={entry.startDate}
                data-end-date={entry.endDate}
                data-tentative={entry.tentative}
                // SOLO, 2026-09-10 — the type's own colour as a left edge. A STRIPE and not a row
                // background: the fills on this palette are pastels chosen to sit UNDER text on the
                // calendar, and a whole row of one would fight the crowded-day sentence, which is the
                // only thing on this screen allowed to shout.
                className={`flex flex-wrap items-center gap-3 border-l-4 px-4 py-3 text-sm ${TYPE_STRIPE[entry.type]}`}
              >
                {/* SOLO. The avatar is the transcription's 38px circle rather than a bare glyph, and
                    it sits on `bg-field` the way the sidebar's roster chip does — one shape for "a
                    person" across the product instead of two. */}
                <span
                  aria-hidden="true"
                  className="flex size-9.5 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-field text-xl"
                >
                  <Avatar value={ownerAvatar(entry.memberId)} />
                </span>

                {/* SOLO. THE THREE LINES THE TRANSCRIPTION DRAWS — who and what, when, and whether the
                    day is crowded. Every id, string and `data-` attribute below is ADM-04's, ADM-05's
                    or ADM-06's; what changed is which line each sits on. `min-w-0` so a long note
                    truncates inside the column rather than pushing the decision controls off the row. */}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span
                      data-testid="pending-entry-row-member"
                      className="font-semibold text-ink"
                    >
                      {ownerName(entry.memberId)}
                    </span>
                    {/* SOLO, 2026-09-10. The type was grey text beside the name, which is what made
                        a leave row and a work-from-home row identical at a glance. It is a filled pill
                        now, in the type's own colour, and it gained a selector: `data-type` on the
                        element that CARRIES the colour is what lets a spec assert the two agree
                        without reading a class off the row itself. */}
                    <span
                      data-testid="pending-entry-row-type"
                      data-type={entry.type}
                      className={`rounded-pill px-2 py-0.5 text-xs font-bold text-ink ${TYPE_PILL[entry.type]}`}
                    >
                      {TYPE_LABELS[entry.type]}
                    </span>

                    {/* The portion stays plain, deliberately. It is a different axis — INV-06, one
                        portion for the whole entry — and giving it a fill too would make the row two
                        competing badges with no way to tell which one answers *is this person at
                        work*. */}
                    <span className="text-ink-3">
                      {PORTION_LABELS[entry.portion]}
                    </span>
                  </p>

                  <p className="flex flex-wrap items-center gap-2">
                    {/* BOTH BOUNDS, always, as `d → d` for a single day — the form CAL-01 fixed and
                        TeamEntries.tsx repeats, for its reason: a single date shown once makes the
                        inclusivity of `end_date` unobservable on exactly the case where an off-by-one
                        is easiest to introduce. The strings render as they arrive; no `new Date(...)`
                        on this path.

                        SOLO added `font-mono` and nothing else. The transcription sets the dates in a
                        monospace face so a column of them lines up, and a face is presentation — the
                        STRING is unchanged, which is what `tests/e2e/adm-04-worklist.spec.ts` reads. */}
                    <span
                      data-testid="pending-entry-row-dates"
                      className="font-mono text-xs text-ink-2"
                    >
                      {entry.startDate} → {entry.endDate}
                    </span>

                    {/* SOLO. `Tentative` became a PILL and kept its word. The transcription marks
                        every row `CHƯA CHỐT`; the interface is English (§ Language), so the word is
                        the one ADM-04 already ships and only the shape is the transcription's. The
                        dashed border is `CLAUDE.md` § Visual direction's own marker for a tentative
                        entry, so the row and the calendar say it the same way. */}
                    {entry.tentative ? (
                      <span className="rounded-pill border border-dashed border-ink-3 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-3">
                        Tentative
                      </span>
                    ) : null}

                    {/* SOLO, 2026-09-10. **`createdAt`, WHICH WAS THE ONE FIELD ONLY THE EDIT
                        SCREEN SHOWED.** With the `Open` link gone it has nowhere else to be read, and
                        on a queue it is the field that says which of two entries has been waiting.

                        **THE LOCAL CALENDAR DAY, AND `new Date(...)` IS CORRECT HERE — the one place
                        in this product where it is.** The trap every other file records is about
                        DATE-ONLY strings: `new Date('2026-04-30')` parses as UTC midnight and a local
                        read west of UTC yields the previous day. `createdAt` is a full ISO 8601
                        timestamp with an offset, so parsing it is unambiguous, and the local day is
                        the honest answer to *when was this declared* for the person reading it.
                        Slicing the string to ten characters would print the UTC day instead — wrong by
                        one for anything declared before 07:00 in Vietnam.

                        The exact value stays on `data-created-at`, unrounded, so a test reads the
                        timestamp and a person reads the day. */}
                    <span
                      data-testid="pending-entry-row-declared"
                      data-created-at={entry.createdAt}
                      className="font-mono text-xs text-ink-3"
                    >
                      declared {localDayOf(entry.createdAt)}
                    </span>
                  </p>

                  {/* SOLO, 2026-09-10. **THE NOTE, IN FULL AND ON ITS OWN LINE.** It was `truncate`d
                      into the dates line, which is exactly the shape that sends somebody to the edit
                      screen to read the rest — the screen this instruction removed the link to. It is
                      the member's own words and is the one piece of user content on this screen, so it
                      wraps rather than being clipped (`.ai/standards/ui-design-system.md` § Language
                      is about interface copy and does not reach it). */}
                  {/* MIR-14-b AC-10, AC-11 — THE TEAMS THIS ENTRY AFFECTS, 01-plan.md § 2b. Every team
                      the owner actively belongs to, read at the moment of the question (INV-07,
                      ADR-073 decision 1). Drawn for a single-team owner too, so its ABSENCE means
                      something: the owner was not returned by `listEntryOwners`. No team colour —
                      none exists, and lavender is holidays. */}
                  {owner && owner.teams.length > 0 ? (
                    <p
                      data-testid="pending-entry-row-teams"
                      data-team-ids={owner.teams.map((t) => t.id).join(",")}
                      className="flex flex-wrap items-center gap-1.5 text-xs"
                    >
                      <span className="text-ink-3">Affects</span>
                      {owner.teams.map((t) => (
                        <span
                          key={t.id}
                          data-testid="pending-entry-row-team"
                          data-team-id={t.id}
                          className="rounded-pill bg-field px-2 py-0.5 text-[11px] font-semibold text-ink-2"
                        >
                          {t.name}
                        </span>
                      ))}
                    </p>
                  ) : null}

                  {entry.note ? (
                    <p
                      data-testid="pending-entry-row-note"
                      className="whitespace-pre-wrap break-words text-xs text-ink-2"
                    >
                      {entry.note}
                    </p>
                  ) : null}

                  {/* SOLO — the crowded-day sentence. `usePageOverload` computes it for the whole page
                      from ONE set of reads and INV-04's single implementation; see that file for why
                      it is not `OverloadWarning` mounted per row.

                      **IT REFUSES NOTHING** (charter refusal 6). It is a sentence beside a control it
                      cannot reach: the decision panel below neither reads it nor is disabled by it, so
                      an admin who wants to approve a crowded day approves it. Rendered as `null` when
                      the row is not crowded AND when the read has not resolved or failed — a warning
                      is the only thing it says, and it has nothing to say about a read it did not get. */}
                  {(crowded.get(entry.id) ?? []).map((day) => (
                    <p
                      key={day.date}
                      data-testid="pending-entry-row-overload"
                      data-date={day.date}
                      data-count={day.count}
                      className="text-xs font-semibold text-danger"
                    >
                      <span aria-hidden="true">⚠ </span>
                      {day.date} already has {day.count} away
                    </p>
                  ))}
                </div>

                {/* **ADM-04 AC-14's `Open` LINK STOOD HERE AND IS REMOVED — SOLO, 2026-09-10.** The
                    header records the instruction and what it costs; the route it pointed at is
                    unchanged and `/entries/team` still reaches it on every row.

                    `ml-auto` moved onto the decision panel's wrapper below, which is what keeps the
                    two controls hard against the right edge now that nothing separates them from the
                    text column. */}

                {/* ADM-05 AC-1, AC-2. The decision, on the surface the feature row names. It is the
                    SAME component `/entries/:id/edit` mounts, so "a rejection carries a reason" is
                    decided in one place rather than twice.

                    `reload` and not a splice: a decided entry leaves this view because the next read
                    does not return it, and the count above falls for the same reason. */}
                {/* MIR-17-c, ADR-073 decision 3, ADR-090. The controls are drawn exactly when this
                    row's owner is among the owners `listEntryOwners` named — the per-team decider
                    the database enforces (`may_decide_entry`), never the caller's global rank alone.
                    An affordance only; the refusal is still the datastore's. */}
                <div className="ml-auto shrink-0">
                  {view.owners.has(entry.memberId) ? (
                    <EntryDecision entry={entry} onDecided={reload} />
                  ) : (
                    <p data-testid="pending-entries-own-entry" className="text-xs text-ink-3">
                      You cannot decide this entry.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* SOLO, 2026-09-10 — **LOAD MORE, WHICH REPLACED THE PAGER**, on the operator's instruction:
          *"Bỏ pagination thay bằng load more"*. ADM-04 AC-4 is rewritten against this control and
          its argument is UNTOUCHED: this is still paging and not truncation, because a ceiling turns
          a long queue into an error and a queue long enough to trip it is precisely the queue an
          admin most needs to work through (01-plan.md § 8, rejected alternative 4). What changed is
          that the next page is APPENDED rather than swapped in, so working down a long queue never
          costs the admin their place.

          **ABSENT WHEN EVERY ROW IS ON SCREEN, NOT DISABLED.** The old pager rendered `Previous` and
          `Next` greyed out on a one-page set — visible controls asserting that more exists. A
          disabled control here would say the same untrue thing, and there is no state to advertise:
          the list is complete, and a screen that has nothing more to give should say nothing.
          `pending-entries-page` kept ITS name on the wrapper so the surrounding assertions about
          where the control lives did not all have to move; what it holds is a different control and
          the ids inside it are new.

          `data-shown` and `data-total` are on the header's count sentence, not here — this element
          states what it CAN do and the header states what is true. */}
      {more ? (
        <div
          data-testid="pending-entries-page"
          data-shown={rows.length}
          data-page-size={pageSize}
          className="flex items-center gap-3 text-sm"
        >
          <button
            data-testid="pending-entries-more"
            type="button"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void loadMore()}
            className="rounded-pill border border-line bg-card px-4 py-1.5 text-sm font-semibold text-ink-2 transition-colors hover:bg-field hover:text-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {/* SOLO, 2026-09-11 — **THE LABEL STAYS AND THE SPINNER JOINS IT**, which is the one
                place in this change where the words were NOT replaced. The eleven full-screen
                states are a card with nothing in it but the mark; this is a control the reader is
                about to press again, and a button whose text vanishes mid-press is a button that
                moved. `BusySpinner` rather than `Loader`: the orbiting mark is 44px and this row
                is a 30px pill. */}
            <span className="inline-flex items-center gap-2">
              Load more
              {busy ? <BusySpinner testIdPrefix="pending-entries-more" /> : null}
            </span>
          </button>
          <span className="text-ink-3">
            {rows.length} of {total} shown
          </span>
        </div>
      ) : null}
    </section>
  );
}

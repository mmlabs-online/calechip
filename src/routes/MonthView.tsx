// CAL-04 — the month grid: who is away on each day, and which days are crowded.
// 01-plan.md sections 2, 2b, 3 and 4.
//
// EVERYTHING here is an affordance (ADR-005). This screen holds no control at all, and that is
// unusually literal: it issues three reads and one create, and every one of them is decided in the
// datastore. `entry_select_team` and `member_select_team` are AC-12, `team_select_own` — shipped by
// this ticket's migration — is AC-14's read half, and `entry_insert_own` is what decides the write
// the drag-select form issues. This component refuses nobody holding a token.
//
// **IT COMPUTES NO COUNT OF ITS OWN.** Every number on screen comes from `absenceCountsFor` in
// @/lib/data/absence, which is INV-04's single implementation. A `.filter(e => e.status !== ...)`
// written anywhere in this file would be a second copy of that rule, which is the exact failure
// INV-04 exists to prevent. The same goes for `isOverloaded`: the comparison is strictly greater and
// it is written once, there.
//
// **AND IT SETS NO THRESHOLD (AC-14).** `Set the overload threshold` is ADM-01's and
// rbac-and-security.md:47-48 grants the read to both roles and the write to `admin` alone. There is
// no control on this screen for either role, and the migration grants no `update` to anyone.
//
// **THE TWO ROLES ARE IDENTICAL HERE**, which is a first in this product. A reviewer scanning for a
// missing `is_admin` check should find that absence deliberate: 01-plan.md section 3 is ✅✅ or ❌❌ on
// every row.
//
// Colour, and where it comes from. `.ai/standards/ui-design-system.md` § Colour is still
// `TODO(project)`, so the palette below is cited to `CLAUDE.md` § Visual direction, which is the only
// place in the repository that carries it: PTO peach, WFH mint, an overloaded day a soft pink that is
// deliberately not an alarming red, tentative entries dashed at reduced opacity, approved ones
// carrying a small star. 01-plan.md § 2b records that citation and why it is honest rather than lazy.
// Holidays are lavender, and CAL-08 draws them HERE — the sentence above this one used to say they
// were not drawn on this screen, and that ticket is the one that spends it. Lavender means NOT
// WORKING: a bridge day is a working day, gets none of it, and carries an outlined badge instead
// (glossary.md, and CAL-08 01-plan.md § 2b). The overloaded soft pink still wins the background, so
// an overloaded holiday is pink AND named — a colour that hid the crowded-day signal would be the
// suppression ADR-015 forbids (CAL-08 AC-10). There is no density toggle: it is named in CLAUDE.md,
// specified nowhere, and originating one would be inventing a control rather than a layout (§ 2b).
//
// UIE-06 — **THE GRID BECOMES ONE RULED FULL-WIDTH CARD WITH TALLER CELLS, PAINTED FROM THE
// PRODUCT'S OWN TOKENS.** Five changes, every one of them arrangement:
//
//   - the `mx-auto max-w-5xl` cap is gone (AC-1). AppShell.tsx:40-42 already grants the width,
//     YearView never capped itself, and UIE-04 deleted the identical cap from the week view. This
//     was the last calendar surface still drawing itself 1024px wide inside a ~1563px pane.
//   - the seven weekday labels LEFT `month-grid` and sit on the page ground above the card (AC-2).
//     They keep `month-weekday` and they keep reading Mon…Sun — `T2`…`CN` is Vietnamese and
//     .ai/standards/ui-design-system.md:46-48 is the operator's own instruction against it.
//   - 35 `rounded-xl` tiles separated by `gap-1` gutters became ONE `rounded-card` surface whose
//     cells are separated by 1px `--color-line` hairlines (AC-3). `overflow-hidden` is what rounds
//     the four outer corners and leaves every cell rectangular.
//   - cells are at least 170px tall and the card fills the pane on a five-row month (AC-4). **A
//     MINIMUM, never a height** — a six-row month is ~1020px of cells against a ~1010px viewport, so
//     a card that FILLED the viewport would clip a week roughly half the year (01-plan.md § 4.4).
//   - **THE SIX FRAMEWORK DEFAULTS BECAME TOKENS** (AC-7, AC-8). `bg-white` -> `bg-card`,
//     `bg-slate-100/60` -> `bg-bg`, `bg-violet-100` -> `bg-holiday`, `bg-orange-100` -> `bg-pto`,
//     `bg-emerald-100` -> `bg-wfh`, `bg-rose-100` -> `bg-overload`. The last token did not exist;
//     UIE-06 § 4.6 adds it at exactly `rose-100`'s value, so no pixel changes colour. This closes
//     the defect § 1 names: Sidebar.tsx:68-70 draws the legend from `bg-pto`/`bg-wfh`/`bg-holiday`,
//     so **the legend and the grid it explains were painted from two different palettes, side by
//     side, permanently.**
//
// **THE OUT-OF-MONTH TINT IS `--color-bg` AND IS NEVER `--color-holiday`** (AC-5). The image tints
// those cells pale lavender, and lavender is spent: CLAUDE.md § Visual direction fixes it to
// holidays and CAL-08 spends `--color-holiday` there and nowhere else. CAL-08 AC-14 keeps
// out-of-month cells stateless, so an out-of-month holiday is not tinted — take the image literally
// and an out-of-month 30th and an in-month non-working holiday become the same colour with only a
// greyed numeral between them. The transcription's own § 1.3 calls the page ground "a pale lavender
// off-white", which is `--color-bg` and is not `#c9bff0`.
//
// **AND FOUR THINGS THE IMAGE ASKS FOR THAT ARE REFUSED**, each in 01-plan.md § 1: deleting
// `month-cell-count` (it is INV-04's agreement with the faces and INV-06's ONLY surface on this
// screen — ADR-031 is PROPOSED and this ticket neither waits on it nor anticipates it), deleting
// `month-threshold`, filling the bridge badge with pink (pink is the overload fill, and a second
// meaning for it on one grid is worse than an outline), and translating any copy into Vietnamese.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import EntryForm from "@/components/EntryForm";
import type { EntryFormValues } from "@/components/EntryForm";
import Modal from "@/components/Modal";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `./supabase` or `./mock` (RULE-02).
import { seam } from "@/lib/data";
// CAL-12 § 4.7. The viewed team's reads, through the one switch (`teamReadsFor`), and the address
// helpers that keep `?team=` across a redirect (AC-7).
import { useViewedTeam } from "@/hooks/useViewedTeam";
import { isReadOnly, teamReadsFor, withTeamParam } from "@/lib/viewed-team";
// INV-04's single implementation, imported DIRECTLY rather than through the seam. 01-plan.md
// section 5: neither seam implementation counts anything, so there is no second arithmetic for
// tests/seam-parity.test.ts to miss.
import {
  absenceCountsFor,
  absentMembersFor,
  addDays,
  currentMemberCount,
  eachDateInRange,
  isOverloaded,
} from "@/lib/data/absence";
// CAL-08's derivation, imported the same way and for the same reason: neither seam implementation
// derives a day status, so there is no second answer for tests/seam-parity.test.ts to miss. The
// weekend rule is inside that module and is not exported — a `isSaturday(d)` written here would be
// the second definition .ai/registry/features.md:95 forbids.
import { dayStatusesFor, holidayReadRange } from "@/lib/data/day-status";
// SOLO, 2026-09-11. The busy count's one definition, imported the same way and for the same reason.
// **IT IS NOT INV-04.** A busy person is AT WORK, so this number never enters `absenceCountsFor`,
// never enters `isOverloaded`, and is never drawn as one figure with the absence count — `busy.ts`
// carries the argument.
import { busyCountsFor, busyDatesOf, busyMembersFor, withOwnBusyMark } from "@/lib/data/busy";
// SOLO, 2026-09-11 (second pass) — the in-flight ring inside the busy badge, the same component the
// week strip draws. Its own file records why it is a bordered circle rather than an icon.
import BusySpinner from "@/components/BusySpinner";
// SOLO, 2026-09-10. One entry per unbroken run of the days chosen in the picker, and the dragged
// range expanded into the days the picker opens filled.
import { createEntriesForDates } from "@/lib/create-entries";
import { datesInRange } from "@/lib/date-selection";
import type { BusyCounts, BusyDay, CalEvent, DateRange, DayStatus, Entry, EventAttendance, Failure, Holiday, Member, Team } from "@/lib/domain/types";
// EVT-03. The event layer — pure, and importing nothing from absence, day-status or busy.
import { eventsByDate, eventsOverlapping, MONTH_EVENT_LIMIT, takingPartIds } from "@/lib/event-layer";
import EventChip from "@/components/EventChip";
// UIE-02 § 4.5. `MONTH_NAMES`, `mondayIndex`, `shiftMonth`, `monthLabel` and the month shape test
// were declared BELOW, in this file; the shell's top bar needs all of them, and `mondayIndex` was
// DUPLICATED here and in WeekView.tsx character for character. Moving each definition into one pure
// module deletes a copy rather than making a third. This import and the deletions under it are the
// whole of UIE-02's edit to this screen — no rendered output changes here, which is what keeps
// `Out of scope` item 1 true and zero spec files in scope.
//
// UIE-03 § 4.4. `monthLabel` and `shiftMonth` LEAVE THIS IMPORT with the header that used them: the
// label was the anchor's text and the shift was the previous/next target, and the top bar computes
// both now. `mondayIndex` and `isRealMonth` stay — the grid and the route guard are untouched.
// SOLO, 2026-09-11 adds `currentDay`. See the `today` memo below for why this file reads the
// day-shaped clock from `period.ts` rather than growing one beside its own `currentMonth()`.
import { currentDay, isRealMonth, mondayIndex } from "@/lib/period";
// SOLO, 2026-09-11 — the loading mark that replaced this screen's "Loading…" sentence. The
// sentence itself is still announced: `Loader.tsx` keeps it as `sr-only` text, because the element
// below carries `role="status"` and an emptied one announces nothing.
import Loader from "@/components/Loader";
import Avatar from "@/components/Avatar";

// ---------------------------------------------------------------------------
// The month vocabulary. `yyyy-MM` in the URL, `yyyy-MM-dd` everywhere below it.
// ---------------------------------------------------------------------------

/* `MONTH_PATTERN` and `MONTH_NAMES` STOOD HERE and are now in @/lib/period as `isRealMonth` and
   `MONTH_NAMES` (UIE-02 § 4.5). The names in that module are this file's spelling, in full —
   YearView.tsx's twelve are the three-letter abbreviations it draws as column headings, which are a
   different list and moved separately. */

// Monday first. `.ai/standards/ui-design-system.md` § Components is `TODO(project)` and specifies no
// week start, so this is 01-plan.md § 2b's layout decision, marked there as the Tech Lead's own.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The last date of a `yyyy-MM`, without a calendar table: day 1 of the next month, minus one. */
function lastDateOf(month: string): string {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  const next = index === 12 ? `${year + 1}-01-01` : `${month.slice(0, 5)}${String(index + 1).padStart(2, "0")}-01`;
  return addDays(next, -1);
}

/* `mondayIndex`, `shiftMonth` and `monthLabel` STOOD HERE and are now in @/lib/period, imported
   above. `lastDateOf` above did NOT move: nothing outside this screen needs it, and the top bar
   steps months rather than walking their days. */

/**
 * The month `/month` with no anchor redirects to.
 *
 * This is the ONE place a LOCAL date read is correct, and the exception is worth naming because
 * every other date in this feature is deliberately UTC. It answers "which month is it for the person
 * looking at the screen", which is a fact about their clock — not a stored `yyyy-MM-dd`, where a
 * local read is the off-by-one CAL-01 recorded.
 */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// The screen.
// ---------------------------------------------------------------------------

// Four states, and they are four for the reason TeamEntries.tsx and MemberList.tsx record. "Still
// loading", "you are on no team" and "the read failed" are three different facts, and folding any
// two of them tells somebody something untrue — here worst of all, because a grid drawn from a
// partial read is a believable wrong answer about who is away.
type View =
  | { phase: "loading" }
  | { phase: "not-on-a-team" } // the caller has no member row, or has been removed
  | { phase: "unavailable" } // a throw from any read, including AC-11's truncation assertion
  // SOLO, 2026-09-11 adds `me` and `busyDays`. `me` was read and discarded before — only its
  // nullness was used — and the busy control needs the caller's own id to know whether a press marks
  // or unmarks.
  | {
      phase: "ready";
      me: Member;
      team: Team;
      roster: Member[];
      entries: Entry[];
      holidays: Holiday[];
      busyDays: BusyDay[];
      // EVT-03 § 4.6. Empty until the second read lands; `eventsFailed` is AC-19's notice.
      events: CalEvent[];
      ownAttendance: EventAttendance[];
      eventsFailed: boolean;
    };

/** The drag in progress: where it started and where the pointer is now. Order-free — a drag upwards
 *  through the grid is the same range as the same drag downwards. */
interface Drag {
  anchor: string;
  over: string;
}

const ordered = (a: string, b: string): DateRange => (a <= b ? { start: a, end: b } : { start: b, end: a });

export default function MonthView() {
  const { month } = useParams<{ month: string }>();

  // AC-10. The anchor is the URL and nothing else, so `/month/2026-05` typed directly produces the
  // same screen as pressing "next" from April. An invalid or absent anchor redirects to the current
  // month rather than rendering an error: there is no criterion about a malformed address, and a
  // grid for "this month" is the useful answer to somebody who mistyped one.
  const valid = month !== undefined && isRealMonth(month);

  const [view, setView] = useState<View>({ phase: "loading" });

  // The drag in progress, and the range it produced. Two pieces of state rather than one because
  // they answer different questions: `drag` is live and redraws on every cell entered, `draft` is
  // settled and is what the form was opened with.
  const [drag, setDrag] = useState<Drag | null>(null);
  const [draft, setDraft] = useState<DateRange | null>(null);

  const range = useMemo<DateRange | null>(
    () => (valid && month ? { start: `${month}-01`, end: lastDateOf(month) } : null),
    [valid, month],
  );

  // CAL-12 § 4.7. The viewed team decides which reads run; `resolving` and `unavailable` are this
  // screen's own loading and unavailable phases (AC-12). `loadSeq` drops the answer of a load that a
  // later one has replaced, so a slow read for one team can never be drawn under another's notice.
  const { viewed } = useViewedTeam();
  const { search } = useLocation();
  const loadSeq = useRef(0);
  // AC-9. While another team is viewed the cell starts no drag, the draft form cannot open and the
  // busy control is not drawn — each would write on the CALLER's team, not the one on screen.
  const readOnly = isReadOnly(viewed);

  const load = useCallback(async (): Promise<void> => {
    if (!range) return;
    const seq = ++loadSeq.current;
    const stale = (): boolean => seq !== loadSeq.current;
    setView({ phase: "loading" });
    if (viewed.kind === "resolving") return;
    if (viewed.kind === "unavailable") {
      setView({ phase: "unavailable" });
      return;
    }
    const reads = teamReadsFor(seam, viewed);

    try {
      const me = await seam.getCurrentMember();
      if (stale()) return;

      // A caller with no member row, and a removed one, land here. Both read no team and no entries
      // at all — `member_team_id` filters `removed_at is null` inside its own body, so every policy
      // built on it inherits that. This state is the honest one for both.
      if (!me) {
        setView({ phase: "not-on-a-team" });
        return;
      }

      // CAL-08. One read added and no other seam call changed (CAL-08 01-plan.md section 4.3). The
      // range is PADDED: `dayStatusesFor` is not total on its own range, because deciding whether
      // the 1st of the month is a bridge day needs the day before it. The pad is one exported
      // function rather than an expression here, so the three views cannot disagree about it.
      //
      // SOLO, 2026-09-11 adds the FIFTH read, in the same `Promise.all` rather than after it: it is
      // independent of the other four and a sequential await would add a round trip to every month.
      // It throws on a truncated answer exactly as the entry read does and lands in the same
      // `unavailable` branch, for the reason AC-11 gives about the threshold: a grid that drew a
      // believable partial answer would say nothing about what it had not been given.
      const [team, roster, entries, holidays, busyDays] = await Promise.all([
        reads.team(),
        reads.roster(),
        reads.entriesOverlapping(range),
        seam.listHolidays(holidayReadRange(range)),
        reads.busyDaysOverlapping(range),
      ]);
      if (stale()) return;

      // AC-7 and AC-14 need the threshold, and a grid drawn without it is exactly the failure AC-11
      // is written about one read over: the counts would be right, no overloaded day would be
      // marked, and nothing on screen would say the comparison had not been made. `unavailable` is
      // the state that refuses to show a believable partial answer.
      //
      // In practice this fires on one thing: a build where this ticket's migration has not been
      // applied, since `public.team` carries no grant and no policy until then
      // (`supabase/migrations/20260904100000_cal04_team_select.sql`) and
      // PostgREST answers zero rows. Applying a migration is human — RULE-09.
      if (!team) {
        setView({ phase: "unavailable" });
        return;
      }

      setView({
        phase: "ready",
        me,
        team,
        roster,
        entries,
        holidays,
        busyDays,
        events: [],
        ownAttendance: [],
        eventsFailed: false,
      });

      // EVT-03 § 4.6, AC-19. THE EVENT LAYER IS READ AFTER THE GRID IS STORED, AND ITS FAILURE NEVER
      // REACHES THE `unavailable` PHASE: the reads above are inputs to the absence count and a partial
      // one would make a count wrong, but no event feeds any count (ADR-049 decision 6), so a missing
      // layer says nothing false about absence — provided the screen says it is missing.
      try {
        const [events, ownAttendance] = await Promise.all([
          reads.events(),
          seam.listOwnEventAttendance(),
        ]);
        if (stale()) return;
        setView((current) =>
          current.phase === "ready" ? { ...current, events, ownAttendance } : current,
        );
      } catch {
        if (stale()) return;
        setView((current) => (current.phase === "ready" ? { ...current, eventsFailed: true } : current));
      }
    } catch {
      if (stale()) return;
      // All four reads throw on a transport failure and on a possibly-truncated answer. AC-11 is
      // this branch: a capped read SUMS what it was given, so a day that was overloaded renders
      // normal and nothing anywhere says so. No count is displayed.
      //
      // CAL-08 AC-12 is the same branch for the holiday read, and its truncation is worse than
      // local: a dropped Thursday row removes FRIDAY's bridge mark (ADR-015 Consequences), so a
      // calendar drawn without its holidays is a believable wrong answer about a date whose own row
      // arrived intact.
      setView({ phase: "unavailable" });
    }
  }, [range, viewed]);

  useEffect(() => {
    void load();
  }, [load]);

  // A drag that ends anywhere — on a cell, off the grid, outside the window — settles the range.
  // Listening on `window` rather than on the cell is what makes releasing outside the grid produce a
  // range instead of a drag that never ends.
  useEffect(() => {
    if (!drag) return;
    const finish = (): void => {
      setDraft(ordered(drag.anchor, drag.over));
      setDrag(null);
    };
    window.addEventListener("mouseup", finish);
    return () => window.removeEventListener("mouseup", finish);
  }, [drag]);

  const counts = useMemo(
    () =>
      view.phase === "ready" && range
        ? absenceCountsFor(view.entries, range, view.roster)
        : new Map<string, number>(),
    [view, range],
  );

  const absent = useMemo(
    () =>
      view.phase === "ready" && range
        ? absentMembersFor(view.entries, range, view.roster)
        : new Map<string, readonly Member[]>(),
    [view, range],
  );

  // SOLO, 2026-09-11. The busy count, the busy people and my own marks — three derivations from one
  // pass, the shape `counts` and `absent` above already use.
  //
  // **NONE OF THESE REACHES `isOverloaded`.** A day is crowded when too many people are AWAY; adding
  // a busy person to that comparison would report the team as short-staffed on a day when everybody
  // is at their desk. The two numbers sit in the same cell and are never summed.
  const busyCounts = useMemo<BusyCounts>(
    () =>
      view.phase === "ready" && range
        ? busyCountsFor(view.busyDays, range, view.roster)
        : new Map<string, number>(),
    [view, range],
  );

  const busyPeople = useMemo(
    () =>
      view.phase === "ready" && range
        ? busyMembersFor(view.busyDays, range, view.roster)
        : new Map<string, readonly Member[]>(),
    [view, range],
  );

  const myBusy = useMemo(
    () =>
      view.phase === "ready" && range
        ? busyDatesOf(view.busyDays, range, view.me.id)
        : new Set<string>(),
    [view, range],
  );

  // EVT-03 § 4.6. THE EVENT LAYER, IN ITS OWN MEMOS AND NOWHERE ELSE. Neither is passed to
  // `absenceCountsFor`, `absentEntriesFor`, `dayStatusesFor`, `isOverloaded` or the overload warning —
  // an event is a layer of its own and never an entry (ADR-049 decision 6; INV-04, INV-07).
  const eventDays = useMemo(
    () =>
      view.phase === "ready" && range
        ? eventsByDate(eventsOverlapping(view.events, range), range)
        : new Map<string, CalEvent[]>(),
    [view, range],
  );

  // AC-6..AC-8, AC-11: the READER's participation — on another team's view too.
  const takingPart = useMemo(
    () =>
      view.phase === "ready"
        ? takingPartIds(view.events, view.me.id, view.ownAttendance)
        : new Set<string>(),
    [view],
  );

  // The date mid-write. One at a time rather than a boolean, so marking three days in a row does not
  // pause the whole grid three times.
  const [busyPending, setBusyPending] = useState<string | null>(null);

  // SOLO, 2026-09-11. **THE DAY TO MARK.** Memoised on mount, the same choice `WeekView.tsx` records
  // and for the same reason: a marker that re-read the clock per render could, past midnight in a
  // tab nobody reloaded, point at a day outside the month the anchor resolved to.
  //
  // `currentDay()` from `period.ts` and NOT a fourth local clock function. This file already holds
  // `currentMonth()` — which answers a different question, *which month should `/month` redirect
  // to* — and `period.ts` is where the day-shaped read lives and is already exported. A second
  // implementation of "what day is it" is exactly the second definition this codebase spends its
  // whole `absence.ts` header arguing against.
  const today = useMemo(() => currentDay(), []);

  // SOLO, 2026-09-11 (second pass). **PATCH IN PLACE, THEN WRITE — NO RELOAD AND NO RE-READ.** The
  // operator asked for this and chose it over the two safer shapes when asked; `WeekView.tsx`'s copy
  // of this callback carries the argument in full, including what the prediction is blind to and why
  // a refusal must now be checked rather than discarded. The month grid is where the old `load()`
  // hurt most: one press blanked all 35 cells, the roster, the entries and the holidays to move one
  // badge.
  //
  // Identical to the week's, deliberately — the two screens draw the same number from the same
  // module, and the ONE piece of logic that could disagree between them, the prediction itself, is
  // `withOwnBusyMark` in `busy.ts` and is not written here.
  const toggleBusy = useCallback(
    async (date: string, busy: boolean): Promise<void> => {
      // The rows to restore come from the RENDERED state and not from inside the updater, and the
      // patch is a functional update while the revert is not. `WeekView.tsx` records why each of
      // those two is the way round it is.
      if (view.phase !== "ready") return;
      const previous = view.busyDays;
      const meId = view.me.id;

      setView((current) =>
        current.phase === "ready"
          ? { ...current, busyDays: withOwnBusyMark(current.busyDays, meId, date, busy) }
          : current,
      );

      const revert = (): void =>
        setView((current) => (current.phase === "ready" ? { ...current, busyDays: previous } : current));

      setBusyPending(date);
      try {
        const result = await seam.setOwnBusyDay({ date, busy });
        if (!result.ok) revert();
      } catch {
        revert();
      } finally {
        setBusyPending(null);
      }
    },
    [view],
  );

  // CAL-08 AC-1 to AC-4, AC-11 and AC-14. The day status of every date IN THE MONTH — the range is
  // the month and not the whole-weeks grid, so the leading and trailing cells have no key here and
  // stay stateless (CAL-08 AC-14), exactly as they carry no count today.
  //
  // `view.holidays` is the PADDED read: the function needs the day either side of the range to
  // answer the first and last day, and it cannot tell "no row on that date" from "you did not fetch
  // that date".
  const dayStatuses = useMemo(
    () =>
      view.phase === "ready" && range
        ? dayStatusesFor(view.holidays, range)
        : new Map<string, DayStatus>(),
    [view, range],
  );

  // AC-13. The dates go to CAL-01's form, unedited — `EntryForm` is imported and rendered, not
  // copied, so there is one place the six fields and their validation live. This screen adds no save
  // path of its own: `seam.createEntry` is CAL-01's, `entry_insert_own` decides it, and nothing is
  // written until the member presses the button.
  async function onCreate(values: EntryFormValues): Promise<Failure | null> {
    // SOLO, 2026-09-10. The drag still fills the picker; the picker is what is saved, so a member
    // who dragged three days and then unchose the middle one stores two entries and not one across
    // a day they are working. The dialog closes only when every run was stored.
    const failure = await createEntriesForDates(values);
    await load();
    if (!failure) setDraft(null);
    return failure;
  }

  if (!valid) return <Navigate to={withTeamParam(`/month/${currentMonth()}`, search)} replace />;

  const anchorMonth = month as string;

  if (view.phase === "loading") {
    return (
      <p data-testid="month-loading" role="status" className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm">
        <Loader label="Loading the month…" />
      </p>
    );
  }

  if (view.phase === "not-on-a-team") {
    return (
      <section data-testid="month-not-on-a-team" className="mx-auto flex max-w-md flex-col gap-3 rounded-2xl bg-white p-8 text-center text-sm shadow-sm">
        <p>This calendar belongs to a team, and you are not on one yet.</p>
        <Link data-testid="month-sign-in" to="/signin" className="underline">
          Sign in
        </Link>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <p data-testid="month-unavailable" role="alert" className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm shadow-sm">
        The month could not be read completely, so no counts are shown. A partial count would look
        like a real one.
      </p>
    );
  }

  const { team, roster } = view;
  const active = currentMemberCount(roster);

  const first = `${anchorMonth}-01`;
  const last = lastDateOf(anchorMonth);
  // The grid is whole weeks. The leading and trailing cells complete the first and last week and are
  // drawn as out-of-month: no avatars, no count and no overload state (AC-1).
  const gridStart = addDays(first, -mondayIndex(first));
  const gridEnd = addDays(last, 6 - mondayIndex(last));
  const cells = eachDateInRange({ start: gridStart, end: gridEnd });

  const selection = drag ? ordered(drag.anchor, drag.over) : null;

  // UIE-06 AC-1 and AC-4. **`mx-auto max-w-5xl` DELETED** — the same cap UIE-04 deleted from
  // WeekView.tsx:304, and the last one left on a calendar view. AppShell.tsx:40-42 already grants
  // the width at `min-w-0 flex-1`; nothing was added to the shell.
  //
  // **`h-full`, AND 01-plan.md OPEN QUESTION 1 IS ANSWERED BY MEASUREMENT RATHER THAN BY READING.**
  // The plan left this declaration to this stage because it needs a rendered viewport, and it was
  // rendered. **THE PERCENTAGE RESOLVES.** The chain is App.tsx:82 `flex min-h-screen flex-col` ->
  // AppShell.tsx:33 `flex min-h-0 flex-1` -> :40 the pane `flex min-w-0 flex-1 flex-col
  // overflow-y-auto` -> :42 `min-w-0 flex-1 px-6 pb-6` -> this screen. That last div is a flex ITEM
  // whose height the flex algorithm resolves, which is what a percentage below it resolves against
  // — the same chain and the same answer UIE-05 measured for the week column, and no
  // `calc(100vh - 70px - 1.5rem)` is needed. A calc would be wrong here for UIE-05's reason too:
  // App.tsx:88 renders `seam-banner` ABOVE the shell on every mock build, which is every build the
  // acceptance suite drives, so this screen's top edge is 80px down rather than the top bar's 70px.
  // A percentage absorbs that offset without knowing it exists.
  //
  // **`min-h-full` WAS WRITTEN FIRST AND MEASURING IS WHAT REJECTED IT.** A percentage MINIMUM on a
  // box whose own height is indefinite resolves to `auto`, so the flex column below had no free
  // space to hand out and `auto-rows-[minmax(170px,1fr)]` never reached its `1fr`: measured at
  // 1563x1440 a five-row April stopped at 854px of cells with 244px of empty pane under it, which
  // is AC-4's first clause failing. With `h-full` the same month measures 218.8px cells and a card
  // bottom of 1324px in a 1360px pane — the 36px left is `month-empty`, which is a sibling below
  // the card. September, which HAS entries and so draws no empty sentence, measures a card bottom
  // of 1416px against a pane bottom of 1440px, which is exactly the pane's own `pb-6`.
  //
  // **AND THE CLIPPING THIS COMMENT ONCE FEARED FROM `h-full` DOES NOT HAPPEN**, which is the other
  // half of what was measured. `h-full` is a hard height and the card below carries
  // `overflow-hidden` — but the card is a flex ITEM whose `min-height: auto` is its content, so a
  // six-row month makes the CARD 1025px tall and it overflows this section rather than being cut by
  // it. Probed at 1563x1010 and at 1280x800: `card.scrollHeight === card.clientHeight` on every
  // five- and six-row month tried, cells hold their 170px, and the page scrolls (AC-4's second
  // clause). Nothing scrolls inside the card.
  return (
    <section className="flex h-full flex-col gap-6">
      {/* UIE-03 AC-2. **Everything this header carried except the threshold line is gone.**
          Its link to the landing route is dead — UIE-02 deleted the home screen — and `month-prev`,
          `month-anchor`, `month-next`, `month-week` and `month-year` are the top bar's now, under
          those same names (01-plan.md § 4.3), so the specs addressing them keep passing unedited.
          AC-5 is why the deleted id is described rather than named.

          **The `<header>` element survives for the one child below.** § 4.4 permits deleting it and
          this does not, for a layout reason: `ml-auto` on that `<p>` right-aligns it against a flex
          ROW, and the section around it is a flex COLUMN — dropping the wrapper would move the
          threshold line to the left edge, which is a visible change on a ticket whose AC-10 says the
          content below the header is unchanged. */}
      <header className="flex items-center gap-4">
        {/* EVT-03 AC-19. Beside the threshold line, and only when the event read failed. */}
        {view.eventsFailed ? (
          <p data-testid="month-events-unavailable" role="status" className="text-xs text-ink-3">
            Events could not be loaded.
          </p>
        ) : null}
        {/* AC-14. The threshold is READ and shown, and there is no control that changes it — for
            either role. It is displayed rather than hidden because an overloaded day is otherwise a
            colour with no explanation, and the two numbers behind it are the whole of INV-04. */}
        <p data-testid="month-threshold" data-threshold={team.overloadThreshold} data-current-members={active} className="ml-auto text-sm opacity-70">
          Crowded above {Math.round(team.overloadThreshold * 100)}% of {active} people
        </p>
      </header>

      {/* UIE-06 AC-2, AC-3 and AC-4 — the strip, the card and the height, in one flex column.

          `flex-1` AND NOT A SECOND `h-full`: this wrapper is a flex ITEM of the section above, so
          the flex algorithm hands it whatever height is left after the header — which is the
          subtraction a percentage cannot do. Its default `min-height: auto` is what stops it
          shrinking below the card inside it, and it is why a six-row month grows the section rather
          than being clipped by it. The same reasoning puts `flex-1` on the card and on the grid. */}
      <div className="flex flex-1 flex-col gap-2">
        {/* UIE-06 AC-2. **THE SEVEN LABELS LEFT `month-grid`.** They were its first seven children;
            they are now a sibling row on the page ground, above the card, which is what puts the
            card's top edge under the labels rather than around them.

            `gap-px` AND NOT `gap-1`, and it is the only reason this row is a grid at all: it has to
            share the cell grid's column geometry exactly, or every label drifts left of the column
            it names — by 7px across the row at `gap-1`. `px-2` matches the cells' `p-2`.

            **Mon…Sun stays English** (01-plan.md § 1 item 4). `T2`…`CN` is what the image shows and
            it reverses .ai/standards/ui-design-system.md:46-48, the operator's own instruction of
            2026-09-03; `copyDebt` is empty and only ever shrinks. **No test in this repository
            addresses `month-weekday`**, which is what makes this move free. */}
        <div className="grid grid-cols-7 gap-px">
          {WEEKDAYS.map((day) => (
            <div key={day} data-testid="month-weekday" className="px-2 py-1 text-xs font-medium opacity-60">
              {day}
            </div>
          ))}
        </div>

        {/* UIE-06 AC-3 and AC-4 — **ONE CARD, RULED, WITH ONLY ITS FOUR OUTER CORNERS ROUNDED.**

            `overflow-hidden` is what does the corners: the cells stay rectangular and the card clips
            them, so no cell needs a corner radius of its own and the four that show are the card's.
            `overflow-hidden` is safe against AC-4's "no cell clipped" BECAUSE this card is a flex
            ITEM with `min-height: auto`: the section above it IS a hard `h-full`, but a flex item
            never shrinks below its content, so a six-row month makes the CARD 1025px and overflows
            the section instead of being cut by it. Probed at three viewports and two month shapes:
            `card.scrollHeight === card.clientHeight` every time. */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-card bg-card shadow-soft">
          {/* **THE HAIRLINES ARE THE GAPS.** `gap-px` over `bg-line` lets 1px of `--color-line`
              show between neighbouring cells, and every cell paints its own opaque background over
              the rest. That draws rules BETWEEN cells and none around the outside, which is what
              AC-3 asks for, and it costs no border on any cell — a `border-r border-b` scheme
              doubles every interior rule to 2px and needs a last-column and last-row exception.

              `auto-rows-[minmax(170px,1fr)]` is AC-4 in one declaration. The `170px` is the minimum
              the criterion names; the `1fr` is what makes a five-row month FILL the pane instead of
              stopping at 850px of cells with white space under it — extra height is shared out
              across the rows rather than left at the bottom. A six-row month exceeds the pane, the
              rows stay at 170px, and the page scrolls. */}
          <div
            data-testid="month-grid"
            className="grid flex-1 auto-rows-[minmax(170px,1fr)] grid-cols-7 gap-px bg-line select-none"
          >
            {cells.map((date) => {
              const inMonth = date >= first && date <= last;
              const count = inMonth ? (counts.get(date) ?? 0) : 0;
              const people = inMonth ? (absent.get(date) ?? []) : [];
              // AC-7. Strictly greater, decided in one place. Out-of-month cells are never evaluated.
              const overloaded = inMonth && isOverloaded(count, active, team.overloadThreshold);
              const selected = Boolean(selection && inMonth && date >= selection.start && date <= selection.end);
              // CAL-08. Absent on an out-of-month cell, which is the whole of CAL-08 AC-14.
              const status = inMonth ? dayStatuses.get(date) : undefined;
              const holiday = status?.holiday ?? null;

              // SOLO, 2026-09-11. Out-of-month cells carry no busy figure and no control, exactly as
              // they carry no count and no day status — `busyCountsFor` is keyed on the month's own
              // range, so there is nothing to read for them.
              // SOLO, 2026-09-11. `inMonth` is deliberately NOT part of this: a grid of whole weeks
              // draws up to six days of the neighbouring months, and today can be one of them when
              // the caller has stepped to the month either side. Marking it there is the honest
              // answer — the cell IS today — and it is the one case where a reader would otherwise
              // wonder why the marker vanished.
              const isToday = date === today;

              const busyCount = inMonth ? (busyCounts.get(date) ?? 0) : 0;
              const busyHere = inMonth ? (busyPeople.get(date) ?? []) : [];
              const iAmBusy = inMonth && myBusy.has(date);
              // EVT-03 AC-2, AC-17. In-month cells only; at most MONTH_EVENT_LIMIT chips, then `+N more`.
              const cellEvents = inMonth ? (eventDays.get(date) ?? []) : [];
              const shownEvents = cellEvents.slice(0, MONTH_EVENT_LIMIT);
              const hiddenEvents = cellEvents.slice(MONTH_EVENT_LIMIT);

              return (
                <div
                  key={date}
                  data-testid="month-cell"
                  data-date={date}
                  data-in-month={inMonth}
                  data-count={inMonth ? count : ""}
                  data-overloaded={overloaded}
                  // CAL-08 AC-1, AC-2, AC-3, AC-11 and AC-14. THREE values and not four: `bridge` is a
                  // separate attribute because a bridge day IS a working day, and folding it in here
                  // would rebuild the flat union .ai/registry/features.md:95 forbids. Empty on an
                  // out-of-month cell.
                  data-day-status={status ? (status.nonWorkingReason ?? "working") : ""}
                  data-bridge={status?.bridge ?? false}
                  // SOLO, 2026-09-11. Read by the spec rather than inferred from a class, the shape
                  // every other fact about this cell already uses.
                  data-today={isToday}
                  // AC-13. `onMouseDown` starts the drag and `onMouseEnter` extends it; the release is
                  // handled on `window` above, so letting go outside the grid still produces a range.
                  // A press and a release on one cell is a one-day range, which is the same gesture a
                  // person uses to declare a single day.
                  onMouseDown={inMonth && !readOnly ? () => { setDraft(null); setDrag({ anchor: date, over: date }); } : undefined}
                  onMouseEnter={inMonth && !readOnly && drag ? () => setDrag({ anchor: drag.anchor, over: date }) : undefined}
                  className={[
                    // UIE-06 AC-3 and AC-4. `min-h-24` and `rounded-xl` are BOTH GONE. The height is
                    // the grid's `auto-rows-[minmax(170px,1fr)]` and belongs to the ROW rather than to
                    // the cell, and the only rounded corners on this screen are now the card's four
                    // outer ones — a rounded cell inside a ruled card reads as a tile again.
                    "flex flex-col gap-1 p-2 text-xs",
                    // UIE-06 AC-5 and AC-7. **The out-of-month tint is the PAGE GROUND and never the
                    // holiday lavender** — the UIE-06 block at the top of this file carries the whole
                    // argument. `text-slate-400` became `text-ink-3` in the same pass: it is the other
                    // half of this one treatment and it was the other framework default in this list.
                    inMonth ? "" : "bg-bg text-ink-3",
                    // The soft pink CLAUDE.md § Visual direction reserves for an overloaded day, and
                    // describes as deliberately not an alarming red. It is the cell's BACKGROUND rather
                    // than a badge, because a crowded day has to be findable by scanning (§ 2b).
                    // UIE-06 AC-7: `--color-overload` is #ffe4e6, which is exactly what `bg-rose-100`
                    // resolved to — this line changes the NAME of the colour and not the colour.
                    inMonth && overloaded ? "bg-overload" : "",
                    // CAL-08 AC-1. Lavender (CLAUDE.md § Visual direction) for a NON-WORKING holiday and
                    // for nothing else. A mandated `working` Saturday is named but not tinted (AC-2), a
                    // bridge day is a working day and gets no lavender at all (AC-3), and the overloaded
                    // pink above still wins the background (AC-10).
                    // UIE-06 AC-8: `bg-holiday` is the token Sidebar.tsx:70 draws the legend swatch
                    // from, so the swatch and the day it explains are finally the same colour.
                    inMonth && !overloaded && status?.nonWorkingReason === "holiday" ? "bg-holiday" : "",
                    inMonth && !overloaded && status?.nonWorkingReason !== "holiday" ? "bg-card" : "",
                    // UIE-06 § 4.9 and AC-17. The selection ring now sits against 1px hairlines rather
                    // than against `gap-1` gutters, so it is INSET: Tailwind's default ring is drawn
                    // OUTSIDE the border box and would spill across the hairline onto the neighbouring
                    // cell, which reads as two selected cells. `ring-ink-3` replaces `ring-slate-400`,
                    // the last framework default in the grid — #8f89b3 against the #e4e0f4 hairlines.
                    selected ? "ring-2 ring-inset ring-ink-3" : "",
                    // SOLO, 2026-09-11 — the border on today.
                    //
                    // **INSET, for the reason UIE-06 § 4.9 gives about the selection ring one line
                    // above:** the cells are separated by 1px hairlines rather than by gutters, so
                    // an outset ring spills across the hairline onto the neighbour and reads as two
                    // marked cells.
                    //
                    // **IT IS DRAWN UNDER THE SELECTION RING AND NOT INSTEAD OF IT** — both classes
                    // can be present, the later one wins the paint, and that is the right precedence:
                    // a drag in progress is what the caller is doing NOW, and losing its feedback to
                    // a permanent marker would make today the one cell a range cannot visibly start
                    // on. `ring-primary` is the `+ Book` ink, the one colour on this grid that
                    // carries no meaning about absence.
                    isToday && !selected ? "ring-2 ring-inset ring-primary" : "",
                  ].join(" ")}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{date.slice(8)}</span>

                    {/* SOLO, 2026-09-11 — the badge.
                        **IT SHARES THE NUMERAL'S LINE AND DOES NOT TAKE ONE.** This grid is what
                        CLAUDE.md § Visual direction means by *information density wins every time*;
                        a row of its own would cost every cell in the month a line to say something
                        about one of them. It sits between the numeral and `month-cell-count`, which
                        keeps its right-hand slot — UIE-06 § 5.1 gives that slot to the count because
                        the count is the domain fact.
                        Absent on all 34 other cells, so nothing moves. */}
                    {isToday ? (
                      <span
                        data-testid="month-cell-today"
                        className="ml-1 mr-auto rounded-pill bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                      >
                        Today
                      </span>
                    ) : null}
                    {inMonth && count > 0 ? (
                      <span data-testid="month-cell-count" className="opacity-70">
                        {count}
                      </span>
                    ) : null}
                  </div>

                  {/* EVT-03 § 2b. Directly under the date row, above the holiday name. AC-17: the cell
                      keeps its avatars, count, holiday name and busy badge — the cap is what pays for
                      that, and a hidden event is still on the week view, which draws every one. */}
                  {cellEvents.length > 0 ? (
                    <div className="flex min-w-0 flex-col gap-0.5">
                      {shownEvents.map((event) => (
                        <EventChip
                          key={event.id}
                          event={event}
                          takingPart={takingPart.has(event.id)}
                          surface="month"
                          date={date}
                        />
                      ))}
                      {hiddenEvents.length > 0 ? (
                        <span
                          data-testid="month-cell-events-more"
                          data-date={date}
                          data-hidden-count={hiddenEvents.length}
                          title={hiddenEvents.map((event) => event.name).join(", ")}
                          className="text-[10px] text-ink-3"
                        >
                          {`+${hiddenEvents.length} more`}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {/* UIE-06 AC-10. **THE BADGE LEFT THE HOLIDAY'S ROW AND TOOK A LINE OF ITS OWN,
                      RIGHT-ALIGNED.** The image puts it in the cell's top-right; 01-plan.md § 5.1 says
                      `month-cell-count` keeps that slot because the count is the domain fact and the
                      badge is decoration on a day's meaning. § 4.8 satisfies both: the numeral-and-count
                      line above is untouched, and the badge sits on the NEXT line at the right edge,
                      which reads as the corner without competing for the line the count owns.

                      **STILL OUTLINED AND STILL UNFILLED**, and 01-plan.md § 1 item 3 is why the image's
                      filled pink pill is refused: pink is the overload fill, and painting the
                      crowded-day colour onto a working day gives one colour two meanings on one grid. */}
                  {status?.bridge ? (
                    <div className="flex justify-end">
                      <span
                        data-testid="month-cell-bridge"
                        className="rounded-full border border-current px-1.5 py-0.5 text-[10px] opacity-70"
                      >
                        Bridge
                      </span>
                    </div>
                  ) : null}

                  {/* CAL-08 AC-1, AC-2, AC-3 and AC-10, and UIE-06 AC-11 keeps all four. The name is
                      drawn whenever a row exists, of EITHER kind — a mandated working Saturday is named
                      so an admin can see the swap day they entered — and it is drawn on an overloaded
                      cell too, because a signal hidden by a colour is the suppression ADR-015 forbids.
                      The image is silent about this name, and UIE-06 § 2b is the standing answer:
                      silence is not removal. */}
                  {holiday !== null ? (
                    <span
                      data-testid="month-cell-holiday"
                      data-kind={holiday.kind}
                      title={holiday.name}
                      className="truncate opacity-80"
                    >
                      {holiday.name}
                    </span>
                  ) : null}

                  {/* SOLO, 2026-09-11 — the busy figure, and the control that writes it.
                      The operator's purpose: somebody arranging an event needs to see which days are
                      heavy, where "heavy" means people who are AT WORK with their hands full.

                      **ONE ELEMENT IS BOTH THE FIGURE AND THE CONTROL**, the same choice
                      `WeekView.tsx` records: a separate button beside a separate number would spend
                      two of a cell's few lines on one fact, on the screen CLAUDE.md § Visual
                      direction says information density wins every time.

                      **IT DOES NOT REPLACE `month-cell-count` AND IS NEVER ADDED TO IT.** That
                      number is INV-04's absence count and drives the crowded-day fill; this one
                      counts people who are present. Two numbers in one cell is the honest rendering
                      of two different facts, and butter is a fifth colour precisely so neither can
                      be mistaken for the other (`src/index.css`).

                      **IT IS DRAWN ONLY WHEN SOMEBODY IS BUSY, OR WHEN IT IS MINE TO UNSET** — the
                      rule `month-cell-count` already follows (`count > 0`), for the reason UIE-07
                      gives for departing from it in the week: a control on all 35 cells of a quiet
                      month is 35 pieces of furniture for a feature nobody used that month. An empty
                      cell's press target is the cell itself, which opens the entry form; marking a
                      day busy from a month with no marks starts in the week view, which draws the
                      control on all seven days.

                      **`onMouseDown` STOPS PROPAGATION, AND WITHOUT THAT LINE THE CONTROL IS
                      UNUSABLE.** The cell starts a date-range drag on mouse down (AC-13); a press on
                      a button inside it would both toggle the mark AND open the entry form on a
                      one-day range. `stopPropagation` on the button is the narrowest fix — the cell
                      keeps its gesture everywhere else in its own area. */}
                  {inMonth && !readOnly && (busyCount > 0 || iAmBusy) ? (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        data-testid="month-cell-busy"
                        data-date={date}
                        data-busy-count={busyCount}
                        data-mine={iAmBusy}
                        data-pending={busyPending === date}
                        aria-pressed={iAmBusy}
                        aria-busy={busyPending === date}
                        disabled={busyPending === date}
                        title={busyHere.map((person) => person.displayName).join(", ")}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={() => void toggleBusy(date, !iAmBusy)}
                        className={[
                          "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                          "disabled:opacity-50",
                          iAmBusy ? "bg-busy text-busy-ink" : "border border-current opacity-70",
                        ].join(" ")}
                      >
                        {/* The word, not a bare numeral: this cell already carries `month-cell-count`
                            as a bare numeral, and a second unlabelled figure beside it would read as
                            part of the same fact.

                            SOLO, 2026-09-11 (second pass) — the spinner sits BESIDE the number and
                            does not replace it, for the reason the week's control records: the press
                            is optimistic, so the figure is already the new one when this appears and
                            swapping it out would hide the thing that just changed.

                            **THE BADGE CAN VANISH UNDER THE SPINNER, AND THAT IS CORRECT.** Unsetting
                            my own mark on a day nobody else marked drops `busyCount` to 0 and
                            `iAmBusy` to false, and the enclosing test renders nothing — so the
                            spinner leaves with the badge rather than spinning over a cell with no
                            number left to wait for. A refused write puts both back. */}
                        <span>Busy {busyCount}</span>
                        {busyPending === date ? <BusySpinner testIdPrefix="month-cell-busy" /> : null}
                      </button>
                    </div>
                  ) : null}

                  {/* INV-04: a view shows a member's avatar exactly when that member's entry is counted.
                      These come from `absentMembersFor`, which walks the same pass as the counts — a
                      second filter here would be a second chance to disagree (AC-2, AC-4, AC-6).

                      A member holding an `am` and a `pm` entry on one date appears ONCE and the count is
                      1, which is the same fact told two ways. */}
                  <div className="flex flex-wrap gap-1">
                    {people.map((person) => {
                      const entry = entryFor(view.entries, person.id, date);
                      return (
                        <span
                          key={person.id}
                          data-testid="month-avatar"
                          data-member-id={person.id}
                          data-type={entry?.type ?? ""}
                          data-tentative={entry?.tentative ?? false}
                          data-status={entry?.status ?? ""}
                          title={person.displayName}
                          className={[
                            "inline-flex items-center rounded-full px-1.5 py-0.5",
                            // PTO peach, WFH mint (CLAUDE.md § Visual direction). A WFH member IS
                            // working — glossary.md calls that the single most costly confusion in the
                            // domain — so the two are different colours even though they weigh the same
                            // in the count.
                            // UIE-06 AC-7 and AC-8. `bg-emerald-100` and `bg-orange-100` were the two
                            // framework defaults a person could actually catch: Sidebar.tsx:68-69 draws
                            // the PTO and WFH legend swatches from `bg-pto` and `bg-wfh`, permanently
                            // beside this grid, and the two palettes did not match.
                            entry?.type === "wfh" ? "bg-wfh" : "bg-pto",
                            // AC-5. Tentative is a dashed border at reduced opacity, so that "counts"
                            // and "is settled" stay visually separate: it is counted like any other
                            // entry (INV-05) and drawn so nobody reads the count as certainty.
                            entry?.tentative ? "border border-dashed border-current opacity-60" : "",
                          ].join(" ")}
                        >
                          <Avatar value={person.avatar} className="h-4 w-4" />
                          {entry?.status === "approved" ? <span aria-hidden="true">★</span> : null}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AC-9. An empty month is empty, not an error and not a loading state that never ends. The
          grid above already renders every date at zero; this says so in words, because a screen of
          blank cells and no sentence reads like a failure. Its appearance is not asserted by any
          criterion — `.ai/standards/ui-design-system.md` § Components specifies no empty state, and
          01-plan.md § 2b records that gap rather than inventing one. */}
      {view.entries.length === 0 ? (
        <p data-testid="month-empty" className="rounded-2xl bg-white p-6 text-center text-sm opacity-70 shadow-sm">
          Nobody on the team is away this month.
        </p>
      ) : null}

      {/* AC-13. CAL-01's form, with the dragged dates already in it and nothing written yet.
          `key` remounts it for each new range: `EntryForm` reads `initial` into `useState`, so a
          re-render with new dates would leave the old ones on screen. */}
      {draft && !readOnly ? (
        <Modal
          testIdPrefix="month-entry"
          label="Book leave or working from home"
          onClose={() => setDraft(null)}
        >
          {/* SOLO, 2026-09-10. The panel became the dialog the operator's design draws, and
              `month-entry-cancel` moved INTO the form as its `onCancel` — same selector, same
              effect, one control fewer outside it. The wrapper keeps `month-entry-panel`. */}
          <div data-testid="month-entry-panel" className="flex flex-col gap-2">
            <EntryForm
              key={`${draft.start}:${draft.end}`}
              testIdPrefix="month-entry"
              title="Book leave or working from home"
              submitLabel="Save"
              submittingLabel="Saving…"
              initial={{
                type: "pto",
                portion: "full",
                dates: datesInRange(draft.start, draft.end),
                tentative: false,
                note: null,
              }}
              afterSubmit="keep"
              onSubmit={onCreate}
              onCancel={() => setDraft(null)}
            />
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

/**
 * The entry a member's avatar is drawn FROM on a date, for the three attributes the chip carries.
 *
 * It decides nothing about whether the avatar appears — `absentMembersFor` has already answered
 * that, and this only ever runs for a member it returned. Rejected rows are skipped here so the chip
 * cannot pick one up for its colour while the count excludes it (AC-4); the first remaining row wins
 * when a member holds both an `am` and a `pm` entry, which is a display choice and not a count.
 */
function entryFor(entries: readonly Entry[], memberId: string, date: string): Entry | undefined {
  return entries.find(
    (entry) =>
      entry.memberId === memberId &&
      entry.status !== "rejected" &&
      entry.startDate <= date &&
      entry.endDate >= date,
  );
}

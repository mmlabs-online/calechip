// CAL-05 — the week view: who is away this week, for how much of each day, why, and who agreed.
// 01-plan.md sections 2, 2b, 3, 4.2 and 4.3.
//
// **IT IS READ-ONLY, AND THAT IS THE FEATURE.** The registry row says *displaying who approved is
// not approving* and *no admin action reaches this surface*. There is no approve, no reject, no edit
// and no delete here, for either role, and there is no draft panel either — CAL-04's month cell
// carries the create path and a second one would be a second thing to keep in step with
// `entry_insert_own`. AC-8 is held by ABSENCE, which 01-plan.md section 3 names as the weakest
// mechanism in the plan: a reviewer checks it by reading the imports below and finding no write.
//
// **IT COUNTS, SINCE UIE-07 — AND THE TWO REASONS THIS PARAGRAPH USED TO GIVE FOR REFUSING WERE
// BOTH WRONG.** It said the count needed `seam.getTeam()` and that INV-04 stood in the way. Neither
// was true, and saying so is the point of this rewrite: ADR-029 requires the correction rather than
// a fresh description of the footer, so the next reader does not inherit the same wrong reason in
// new words.
//
// - **A count never needed a team read.** `getTeam()` supplies `overloadThreshold`, and a bare
//   `n/N` does not use it. The denominator is `currentMemberCount(roster)` over the roster this
//   screen ALREADY reads, so the fourth read the old sentence feared was never on the path.
// - **INV-04 was never the obstacle.** CAL-05's own plan says so at its `01-plan.md:528-531`. The
//   invariant forbids a SECOND DEFINITION, not a second SCREEN — `absenceCountsFor` is the same
//   function the month grid calls, so putting its answer here is reuse and not divergence. ADR-029
//   records INV-04 as SATISFIED by this decision rather than amended.
//
// **WHAT DOES NOT CHANGE, AND CLAUSE 3 KEEPS IT THAT WAY: this screen computes no overload state,
// reads no threshold, and does not call `seam.getTeam()`.** The strip is two numbers and a slash;
// it divides nothing and carries no colour that means a state.
//
// **AND THE WARNING BELOW IS NOW MORE LOAD-BEARING, NOT LESS.** Every row drawn comes from
// `absentEntriesFor` and every count from `absenceCountsFor`, two derivations from INV-04's one
// pass; a `.filter(e => e.status !== ...)` — or a local sum over `absent` — written anywhere in this
// file would be the second definition INV-04 exists to forbid. It used to be the reason for a
// refusal. It is now the guard rail on UIE-07 AC-5, and the divergence the feature row names — four
// names against 3.5 — is invisible on either screen alone.
//
// **INV-06 IS VISIBLE HERE AND NOWHERE ELSE.** A five-day `pm` entry is five afternoons, not a
// half-day at one end, because `portion` is one value applying to every date in the range. This view
// chooses nothing about that: it reads `entry.portion` on every row it draws, which is what makes
// the rendering unable to contradict the column shape CAL-01 shipped (AC-4).
//
// Colour, and where it comes from. `.ai/standards/ui-design-system.md` § Colour is still
// `TODO(project)`, so the palette is cited to `CLAUDE.md` § Visual direction, the only place in the
// repository that carries it: PTO peach, WFH mint, tentative dashed at reduced opacity, approved
// carrying a small star. No overload pink appears here at all, because no overload state is
// computed. Holidays are lavender, and CAL-08 draws them HERE — the sentence this replaces said
// they were not drawn on this screen, and that ticket is the one that spends it. Lavender means NOT
// WORKING and tints the DAY HEADING only; the rows below are untouched. A bridge day is a working
// day, gets no lavender, and carries an outlined badge instead (glossary.md, CAL-08 01-plan.md
// § 2b). 01-plan.md § 2b records that no image was attached at either stage and that the arrangement
// below is the Tech Lead's own.
//
// UIE-04 — **the seven days are a GRID above 1280px and the shipped stack below it, and nothing else
// on this screen changed.** 01-plan.md § 4.2, § 4.3 and § 4.4. Two properties below are decisions
// rather than defaults, and both are worth knowing before editing the layout.
//
// **THE COLUMNS DO NOT FILL THE VIEWPORT AND NO COLUMN SCROLLS ON ITS OWN** (AC-4, AC-5).
// **UIE-05 REVERSED THE FIRST HALF OF THAT SENTENCE AND NOT THE SECOND — see the UIE-05 block
// below.** The
// transcription shows seven columns with a crisp bottom edge — on an EMPTY week, which is the one
// case in which that property costs nothing. At ~161px a column a chip is 90-110px tall, and one
// member may hold an `am` AND a `pm` entry on one date, so sixteen chips on one day is ~1520px of
// content in ~910px of body. Seven independent scrollers would put the days out of horizontal
// register, and a day whose entries all sat below its own fold would read as a quiet day — the
// opposite of what this screen is for. The pane scrolls once instead, and a column is as tall as
// the busiest day.
//
// **THE FOOTER STRIP THIS TICKET REFUSED IS NOW BUILT — UIE-07 — BUT ITS REFUSAL OF THE CHIP COUNT
// STANDS AND IS THE ARGUMENT THE STRIP RESTS ON.** The transcription draws an absence-count footer
// under every column; UIE-04 refused it, and refused triage's cheaper suggestion with it — the
// day's own CHIP count — because a day holding one full-day and two half-day entries has three
// chips and an absence count of two, so the number would contradict the month grid for the same
// date. That is INV-04's forbidden second definition, reached without ever opening `absence.ts`.
// **THAT SENTENCE IS STILL TRUE AND IS WHY UIE-07 AC-5 EXISTS**: the number in the strip comes from
// `absenceCountsFor` and from nothing on this screen — not the chip count, not the number of
// people, not a sum over `absent`.
//
// What is no longer true is the conclusion UIE-04 drew from it. It ended *a column ends where its
// content ends*; a column now ends with `week-day-count`, pinned by `mt-auto`, on every one of the
// seven days including a day with nobody away.
//
// UIE-05 — **the column FILLS the viewport, and the header strip and the entry chip are restacked.**
// 01-plan.md § 4.2 to § 4.5. A second image was drawn hours after UIE-04 merged; three of its four
// asks are built here and four are refused. Nothing outside this file is opened.
//
// **THE FILL IS `min-height` AND NEVER `height`, AND THAT IS THE WHOLE OF WHY UIE-04's TWO
// ACCEPTANCE CRITERIA SURVIVE IT.** UIE-04's PROSE, four paragraphs up, said the columns do not fill
// the viewport; this ticket reverses that prose deliberately and says so rather than quietly doing
// the opposite of a shipped decision. It reverses NEITHER AC-4 (every entry reachable by scrolling
// the PAGE, no column scrollbar, nothing clipped) NOR AC-5 (the seven stay in horizontal register):
// a column at LEAST the pane tall and free to grow past it renders the image on a quiet week and
// behaves exactly as those two require on a busy one. A fixed `height` would clip a busy column or
// introduce a second scroller, which is why it is not used. **UIE-04's three rejected alternatives
// are untouched** — seven independently scrolling columns are still refused, for the reason above.
//
// **THE COST, ACCEPTED: on a busy week anything pinned to the bottom of a column goes below the fold
// with that column.** **UIE-07 IS WHAT PINS SOMETHING THERE** — `week-day-count` sits on the
// column's bottom edge via `mt-auto`, so on a busy week it goes below the fold with the rest of that
// column, exactly as this paragraph predicted. That cost was accepted again by ADR-029, and pinning
// to the VIEWPORT is still a different feature that is not proposed anywhere.
//
// **THE CHIP KEEPS ALL FIVE OF THE FACTS THE IMAGE DROPS, AND THAT IS THE TICKET'S ONE REAL
// DECISION.** The image's chip is a ~44px two-line stack carrying an avatar, a name, a star and a
// type code, and nothing else. Each of the five it drops is load-bearing: the portion pill is
// INV-06's only visible surface in the product; the note is CAL-05 AC-6; the word `Tentative` is
// AC-9's ACCESSIBLE half, said in words for somebody who cannot see the dashed border;
// `Approved by <name>` is what CAL-05's registry row is actually about, since a bare star says only
// that SOMEBODY approved and `approved_by` is v1's only audit trail; and `Leave` / `Working from
// home` is OPS-002 AC-7, which requires every screen naming a type to state that the member is
// WORKING — a bare `WFH` states nothing. **UIE-04 refused this same deletion as its Option 2, even
// behind an expand where the information still existed; the image deletes it outright.** So the
// SILHOUETTE is reproduced — a three-row stack with a circular avatar bubble and the star beside the
// name — and the five facts are DEMOTED to a third line at reduced size rather than removed. Every
// one of them renders AT REST: no hover, no click, no expansion.
//
// **IT IS THEREFORE TWO OR THREE LINES TALL AND NOT THE IMAGE'S ~44px.** Those two are not
// simultaneously satisfiable and 01-plan.md Open question 2 records the choice as made rather than
// missed.
//
// **THE COUNT UIE-05 DEFERRED IS BUILT, AND SO IS THE COUPLING IT RECORDED — UIE-07.** The second
// image draws `n/8 vắng` under every column. ADR-029 was ACCEPTED on 2026-09-08 and UIE-07 builds
// the strip, but **not that label and not that denominator**: the denominator is COMPUTED and the
// fixtures give 4, and the word is refused on clause 4 and on § Language, so the visible strip is
// `n/N` with the glossary's English term in the accessible reading only. UIE-05's refusal of the
// chip count as an approximation is untouched and is now AC-5.
//
// **THE COUPLING IS RESOLVED, AND `"Everybody is in."` STAYS.** This paragraph recorded that the
// sentence and the count are decided together, since a footer reading `0/4` is what would make
// deleting the sentence defensible. UIE-07's 01-plan.md § 8 alternative 1 took that decision and
// declined the deletion, on geometry rather than test cost: the sentence renders only when a column
// is empty, and the strip pins to the bottom of a column at least a viewport tall, so **the two are
// only ever co-visible on a column with nothing else in it** — the redundancy costs a row exactly
// where there is spare room. So `week-day-empty` keeps its element, its selector and its SENTENCE,
// and `tests/e2e/cal-05-week-view.spec.ts` is unedited. The middle path — keeping the element and
// emptying it — was refused for this file's own recorded reason further down: an empty third row is
// a line of padding that claims a fact exists.
//
// **THE RADIUS IS `rounded-2xl` AND NOT A CHANGE TO `--radius-card`.** `rounded-card` (26px) is
// SHARED with AuthCard.tsx and Sidebar.tsx, both out of scope, so moving the token would repaint two
// screens this ticket may not touch — the same collision src/index.css:117-123 already records one
// token over. A `--radius-day` token was rejected for having exactly one consumer. The consequence,
// accepted: the day column and the sign-in card now have different corner radii.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `./supabase` or `./mock` (RULE-02).
import { seam } from "@/lib/data";
// CAL-12 § 4.7. The viewed team's reads, through the one switch (`teamReadsFor`), and the address
// helpers that keep `?team=` across a redirect (AC-7).
import { useViewedTeam } from "@/hooks/useViewedTeam";
import { isReadOnly, teamReadsFor, withTeamParam } from "@/lib/viewed-team";
// INV-04's module, imported DIRECTLY rather than through the seam — the same import MonthView.tsx
// makes, for the same reason: neither seam implementation counts or derives anything, so there is no
// second answer for tests/seam-parity.test.ts to miss.
import { absenceCountsFor, absentEntriesFor, addDays, currentMemberCount, eachDateInRange } from "@/lib/data/absence";
// CAL-08's derivation, imported the same way and for the same reason. The weekend rule lives inside
// that module and is not exported — a `isSaturday(d)` written here would be the second definition
// .ai/registry/features.md:95 forbids, and this file draws no weekend distinction anyway.
import { dayStatusesFor, holidayReadRange } from "@/lib/data/day-status";
// SOLO, 2026-09-11. The busy count's one definition, imported the same way and for the same reason
// as the two above. **IT IS NOT INV-04 AND THE TWO NUMBERS ARE NEVER ADDED** — `busy.ts`'s header
// carries that at length. A busy person is at work; the strip below draws the two facts separately.
import { busyCountsFor, busyDatesOf, busyMembersFor, withOwnBusyMark } from "@/lib/data/busy";
import type { AbsenceCounts, AbsenceDetail, BusyCounts, BusyDay, CalEvent, DateRange, DayStatus, Entry, EventAttendance, Holiday, Member, Task } from "@/lib/domain/types";
// TSK-04 § 4.1. The viewer's own done/total per day — pure, and importing nothing from absence,
// day-status or busy. `ListChecks` is the task icon PtoTaskWarning.tsx already uses.
import { taskTalliesFor, tallyLabel, tallyText, type DayTaskTally } from "@/lib/week-tasks";
import { ListChecks } from "lucide-react";
// EVT-03. The event layer — pure, and importing nothing from absence, day-status or busy.
import { eventsByDate, eventsOverlapping, takingPartIds } from "@/lib/event-layer";
import EventChip from "@/components/EventChip";
// SOLO, 2026-09-12. `TYPE_CODES` REPLACES `TYPE_LABELS` IN THIS IMPORT, which is the whole fix for
// `Uncaught ReferenceError: TYPE_CODES is not defined` at :912. The row below was changed to render
// the short code and the import was never widened, so the module compiled — Vite does not typecheck
// — and threw on first render. `TYPE_LABELS` goes because nothing in this file reads it any more:
// the only occurrence left is the sentence at :905 explaining that every OTHER surface still uses it.
import { PORTION_LABELS, TYPE_CODES } from "@/lib/labels";
// UIE-02 § 4.5. `mondayIndex` and `isRealDay` were declared BELOW, in this file; the shell's top bar
// needs both, and `mondayIndex` was DUPLICATED here and in MonthView.tsx character for character.
// Moving each definition into one pure module deletes a copy rather than making a third. This import
// and the two deletions under it are the whole of UIE-02's edit to this screen — no rendered output
// changes here, which is what keeps `Out of scope` item 1 true and zero spec files in scope.
import { currentDay, isRealDay, mondayIndex } from "@/lib/period";
// SOLO, 2026-09-11 (second pass) — the in-flight ring inside the busy pill. Its own file records why
// it is a bordered circle rather than an icon, and why it announces nothing of its own.
import BusySpinner from "@/components/BusySpinner";
// SOLO, 2026-09-11 — the loading mark that replaced this screen's "Loading…" sentence. The
// sentence itself is still announced: `Loader.tsx` keeps it as `sr-only` text, because the element
// below carries `role="status"` and an emptied one announces nothing.
import Loader from "@/components/Loader";
import Avatar from "@/components/Avatar";
import EntryTooltip from "@/components/EntryTooltip";
// One day's own tasks in a dialog, opened from the task footer at the foot of each column.
import TaskDayDialog from "@/components/TaskDayDialog";

// ---------------------------------------------------------------------------
// The week vocabulary. `yyyy-MM-dd` in the URL and everywhere below it.
// ---------------------------------------------------------------------------

/** Monday first, matching the month grid's column order. */
const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/* `mondayIndex` and `isRealDay` STOOD HERE and are now in @/lib/period, imported above (UIE-02
   § 4.5). The duplication CAL-05 recorded in this comment — the same three lines in MonthView.tsx,
   left as a copy because that ticket had one link's worth of scope in that file — is paid here: the
   shell's top bar needed the helper, so moving it deletes a copy instead of adding a third.

   `isRealDay` MOVED WITH IT because the two are used together, and its one implementation detail
   moved too: it checked the calendar roll-over with a round trip through `addDays`, and the new
   module may not import @/lib/data (UIE-02 01-plan.md § 5), so it does the same arithmetic
   directly. The rejected dates are the same ones — `2026-02-30` still fails. */

/* `today()` STOOD HERE and is now `currentDay()` in @/lib/period, imported above (UIE-02 § 4.5,
   added at PLAN rework 1). It is still the one place a LOCAL date read is correct and it still
   carries that argument, at its new home: `/` now resolves the current week in place (AC-5), so the
   shell needed the same answer this screen has always computed, and a second copy of it would be
   two clocks that can disagree on the same screen. MonthView.tsx's `currentMonth` and
   YearView.tsx's `currentYear` deliberately did NOT move — nothing outside those files needs them. */

/* OPS-002 folded the two label maps that stood here into src/lib/labels.ts (AC-8). They were named
   in the singular and had already diverged: `full` read "All day" here and "Full day" on the two
   screens that declared it next, a divergence nobody introduced deliberately and no test caught.
   AC-13 settles it to "Full day", so THIS SCREEN'S WORDING FOR `full` CHANGES and the other two do
   not. */

// ---------------------------------------------------------------------------
// The screen.
// ---------------------------------------------------------------------------

// Four states, and they are four for the reason MonthView.tsx, TeamEntries.tsx and MemberList.tsx
// all record. "Still loading", "you are on no team" and "the read failed" are three different facts,
// and folding any two of them tells somebody something untrue. AC-15 is the third one: a week drawn
// from a possibly-truncated read is a short list that reads as a quiet week, which is worse than an
// error because nothing about it looks wrong.
type View =
  | { phase: "loading" }
  | { phase: "not-on-a-team" } // the caller has no member row, or has been removed
  | { phase: "unavailable" } // a throw from either read, including the truncation assertion
  // SOLO, 2026-09-11 adds `me` and `busyDays`. `me` was read and discarded before — only its
  // nullness was used — and the busy control needs the caller's own id to know whether a press marks
  // or unmarks. Reading it again in the handler would be a second `getCurrentMember()` per press.
  | {
      phase: "ready";
      me: Member;
      roster: Member[];
      entries: Entry[];
      holidays: Holiday[];
      busyDays: BusyDay[];
      // EVT-03 § 4.6. Empty until the second read lands; `eventsFailed` is AC-19's notice.
      events: CalEvent[];
      ownAttendance: EventAttendance[];
      eventsFailed: boolean;
      // TSK-04 § 4.2. `[]` until read, and always `[]` when viewed.kind !== "own"; `tasksFailed`
      // is AC-12's notice and is true only when the task read threw.
      tasks: Task[];
      tasksFailed: boolean;
    };

interface WeekViewProps {
  /**
   * UIE-02 § 4.10, added at PLAN rework 1. **At `/` only.** Resolve the current week IN PLACE
   * instead of redirecting to `/week/<today>`.
   *
   * Defaults to false, so `/week` and `/week/:day` behave exactly as CAL-05 shipped them — CAL-05
   * AC-1 and AC-14 are untouched and `tests/e2e/cal-05-week-view.spec.ts` passes unedited.
   *
   * It exists because `/` must be an address the application COMES TO REST ON (UIE-02 AC-23): five
   * shipped spec files walk browser history back to `/` in helpers, and a redirect makes `/` an
   * address that is never in history. Rendering the week here rather than bouncing to `/week` is
   * what makes Back work without making it a trap.
   */
  landing?: boolean;
}

export default function WeekView({ landing = false }: WeekViewProps) {
  const { day } = useParams<{ day: string }>();

  // AC-1 and AC-14. The anchor is the URL and nothing else, so `/week/2026-10-07` typed directly
  // produces the same screen as pressing "next" from the week before. An absent or malformed anchor
  // redirects to this week rather than rendering an error: there is no criterion about a mistyped
  // address, and the current week is the useful answer to somebody who mistyped one.
  //
  // AT `/` THERE IS NOTHING TO REDIRECT TO, so `landing` supplies the anchor instead.
  // **Memoised on mount and not read per render**, so the anchor cannot change under a re-render —
  // the same stability `/week/:day` gets for free from the URL. A bare `currentDay()` in the render
  // body would re-resolve at midnight mid-session and move the week under the caller silently.
  const landingDay = useMemo(() => currentDay(), []);

  // SOLO, 2026-09-11. **THE DAY TO MARK, AND IT IS MEMOISED ON MOUNT FOR THE SAME REASON THE ANCHOR
  // ABOVE IS.** A marker that re-read the clock per render would, in a tab left open past midnight,
  // point at a day OUTSIDE the week the anchor resolved to — the screen contradicting itself about
  // what day it is, which is worse than a marker that is one day stale in a session nobody reloaded.
  // The two reads move together or not at all.
  //
  // `currentDay()` reads LOCAL date parts, unlike every comparison in `day-status.ts`, and that is
  // correct here rather than inconsistent: those compare stored dates to each other and must not
  // drift with the machine, while this answers *what day is it for the person looking at the
  // screen*, which is a local question. `period.ts` records the same argument for its own use.
  const today = useMemo(() => currentDay(), []);
  const anchorDay = day !== undefined && isRealDay(day) ? day : landing ? landingDay : null;

  // Any day of a week produces the SAME screen, so a link from any date works and `/week/2026-10-07`
  // is not redirected to `/week/2026-10-05` — the URL keeps the date the caller arrived with, and
  // `week-anchor` carries the Monday it resolved to.
  const weekStart = useMemo(
    () => (anchorDay ? addDays(anchorDay, -mondayIndex(anchorDay)) : null),
    [anchorDay],
  );

  const range = useMemo<DateRange | null>(
    () => (weekStart ? { start: weekStart, end: addDays(weekStart, 6) } : null),
    [weekStart],
  );

  const [view, setView] = useState<View>({ phase: "loading" });

  // CAL-12 § 4.7. The viewed team decides which reads run; `resolving` and `unavailable` are this
  // screen's own loading and unavailable phases (AC-12). `loadSeq` drops the answer of a load that a
  // later one has replaced, so a slow read for one team can never be drawn under another's notice.
  const { viewed } = useViewedTeam();
  const { search } = useLocation();
  const loadSeq = useRef(0);

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

      // A caller with no member row, and a removed one, land here. Both read no entries at all —
      // `member_team_id` filters `removed_at is null` inside its own body, so every policy built on
      // it inherits that. This state is the honest one for both.
      if (!me) {
        setView({ phase: "not-on-a-team" });
        return;
      }

      // The two reads 01-plan.md section 4.2 permits, plus the ONE CAL-08 adds, and no fourth.
      // `listMembers()` returns the roster INCLUDING removed members (ADR-013), which is what AC-11
      // needs and what lets an approver who has since been removed resolve to a name rather than to
      // a bare uuid.
      //
      // The holiday range is PADDED: `dayStatusesFor` is not total on its own range, because
      // deciding whether Monday is a bridge day needs the Sunday before it — which for a seven-day
      // range is outside it. The pad is one exported function rather than an expression here, so the
      // three views cannot disagree about it (CAL-08 01-plan.md section 8, rejected alternative 2).
      //
      // SOLO, 2026-09-11 adds the FOURTH read, in the same `Promise.all` rather than after it: it is
      // independent of the other three and a sequential await would add a round trip to every week.
      // It throws on a truncated answer exactly as the entry read does, and lands in the same
      // `unavailable` branch — a short busy read draws a quieter day than the team really has, which
      // is the same silent wrong answer AC-15 exists for.
      const [roster, entries, holidays, busyDays] = await Promise.all([
        reads.roster(),
        reads.entriesOverlapping(range),
        seam.listHolidays(holidayReadRange(range)),
        reads.busyDaysOverlapping(range),
      ]);
      if (stale()) return;

      setView({
        phase: "ready",
        me,
        roster,
        entries,
        holidays,
        busyDays,
        events: [],
        ownAttendance: [],
        eventsFailed: false,
        tasks: [],
        tasksFailed: false,
      });

      // EVT-03 § 4.6, AC-19. THE EVENT LAYER IS READ AFTER THE GRID IS STORED, AND ITS FAILURE NEVER
      // REACHES THE `unavailable` PHASE: the reads above are inputs to the absence count and a partial
      // one would make a count wrong, but no event feeds any count (ADR-049 decision 6), so a missing
      // layer says nothing false about absence — provided the screen says it is missing.
      const eventLayer = async (): Promise<void> => {
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
      };

      // TSK-04 § 4.2, AC-7, AC-12. The viewer's own tasks, in the same post-grid block as the event
      // layer, IN PARALLEL WITH IT BUT CAUGHT SEPARATELY, so neither layer's failure hides the other
      // and neither reaches `unavailable` — no task feeds any count (AC-11). **NOT ISSUED AT ALL on
      // another team's calendar (ADR-040)**: RLS would still return only the caller's rows, so this
      // is the feature row's display rule, not a privacy gate — that one is `task_select_own`.
      const taskLayer = async (): Promise<void> => {
        if (viewed.kind !== "own") return;
        try {
          const tasks = await seam.listTasks(range.start, range.end);
          if (stale()) return;
          setView((current) => (current.phase === "ready" ? { ...current, tasks } : current));
        } catch {
          if (stale()) return;
          setView((current) => (current.phase === "ready" ? { ...current, tasksFailed: true } : current));
        }
      };

      await Promise.all([eventLayer(), taskLayer()]);
    } catch {
      if (stale()) return;
      // AC-15. All three reads throw on a transport failure and on a possibly-truncated answer
      // (`MONTH_ENTRY_LIMIT`, reused rather than joined by a second constant — section 4.2). This
      // branch is the refusal: nobody is listed, rather than a short list that reads as a quiet week.
      //
      // CAL-08 AC-12 is the same branch for the holiday read, whose truncation is worse than local:
      // a dropped Thursday row removes FRIDAY's bridge mark (ADR-015 Consequences), so a week drawn
      // without its holidays is a believable wrong answer about a day whose own row arrived intact.
      setView({ phase: "unavailable" });
    }
  }, [range, viewed]);

  // The day whose task dialog is open, or null. Own calendar only: the footer that opens it is too.
  const [taskDay, setTaskDay] = useState<string | null>(null);

  // A re-read of the task layer alone, after the dialog writes — the same read and the same
  // own-calendar rule as `taskLayer` above, so the footers' tallies follow the dialog.
  const reloadTasks = useCallback(async (): Promise<void> => {
    if (!range || viewed.kind !== "own") return;
    try {
      const tasks = await seam.listTasks(range.start, range.end);
      setView((current) => (current.phase === "ready" ? { ...current, tasks, tasksFailed: false } : current));
    } catch {
      setView((current) => (current.phase === "ready" ? { ...current, tasksFailed: true } : current));
    }
  }, [range, viewed]);

  useEffect(() => {
    void load();
  }, [load]);

  // AC-2, AC-5, AC-9, AC-10, AC-11, AC-12. INV-04's third derivation, from the same pass as the
  // month's counts and avatars. Nothing in this file narrows `entries` itself.
  const absent = useMemo(
    () =>
      view.phase === "ready" && range
        ? absentEntriesFor(view.entries, range, view.roster)
        : new Map<string, readonly AbsenceDetail[]>(),
    [view, range],
  );

  // UIE-07 AC-1, AC-2, AC-5. INV-04's COUNT, from the same module, over the same three arguments
  // and in the same pass shape as `absent` directly above. Nothing in this file sums, filters or
  // narrows `entries` — a local sum over `absent` is the cheapest wrong path and it is wrong twice:
  // one member's `am` and `pm` on one date would read 1.5 rather than 1, and the day's chip count
  // would read 2. `absenceCountsFor` is total over its range (`zeroed(range)`, absence.ts:202), so
  // the fallback below is for the loading and failure phases and never for a drawn day.
  const counts = useMemo<AbsenceCounts>(
    () =>
      view.phase === "ready" && range
        ? absenceCountsFor(view.entries, range, view.roster)
        : new Map<string, number>(),
    [view, range],
  );

  // UIE-07 AC-6, AC-9. The denominator, from INV-04's module — never a literal and never a filter
  // written here. The roster is the UNFILTERED one `seam.listMembers()` returns (ADR-013), which is
  // the shape both functions require and the same shape MonthView.tsx feeds them.
  const activeMembers = view.phase === "ready" ? currentMemberCount(view.roster) : 0;

  // SOLO, 2026-09-11. **THE BUSY COUNT, THE BUSY PEOPLE AND MY OWN MARKS — THREE DERIVATIONS FROM
  // ONE PASS**, the shape `absent` and `counts` above already use and for the same reason: a second
  // filter written here would be a second chance to disagree with the number beside it.
  //
  // **NONE OF THESE IS INV-04 AND NONE IS EVER ADDED TO IT.** The strip below draws `0/4` for
  // absences and a separate busy figure; a reader who saw one number would be reading a fact the
  // product does not hold.
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

  // Which of the seven days I have marked. It decides what a press DOES, so it deliberately does not
  // apply the removed-member rule the counts apply — `busy.ts` records that asymmetry.
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

  // The date whose control is mid-write. **ONE AT A TIME AND NOT A BOOLEAN**: a boolean would
  // disable all seven controls while one is saving, which on a week where somebody marks three days
  // in a row is three pauses of the whole strip.
  const [busyPending, setBusyPending] = useState<string | null>(null);

  // SOLO, 2026-09-11 (second pass). **THE PRESS NO LONGER RELOADS THE CALENDAR, AND IT IS NOW
  // OPTIMISTIC.** Both halves are the operator's decision, made explicitly when asked and recorded
  // here because the previous text of this comment argued the opposite at length.
  //
  // What it used to do: `await load()`, which sets `phase: "loading"` and re-reads the roster, the
  // entries, the holidays and the busy rows. The whole week blanked and redrew to move one number.
  //
  // What it does now: patch `busyDays` IN PLACE through `withOwnBusyMark` — `phase` stays `ready`,
  // so nothing unmounts and the three `useMemo`s below recompute the count, the avatars and my own
  // marks from the patched rows. The write runs after, and only a REFUSAL puts the rows back.
  //
  // **THE COST, ACCEPTED: the figure is briefly one this screen predicted rather than one the
  // datastore produced.** The prediction is exact for the caller's own row and blind to everybody
  // else's — `withOwnBusyMark` carries why that is all a press can know — so a date somebody else
  // marked in the meantime reads one short until the next read of the range. The operator chose
  // immediacy over that, for a number nobody acts on within the second it is stale.
  //
  // **A REFUSED WRITE REVERTS, AND IT CHECKS THE RESULT TO KNOW.** `setOwnBusyDay` returns a
  // `Result` and the old code discarded it, which was harmless while every press ended in a re-read
  // and is not harmless now: a discarded refusal would leave a mark on screen that the datastore
  // never took. A throw reverts the same way. The revert restores the exact array captured before
  // the press rather than recomputing one, so a second press mid-flight cannot resurrect a row.
  const toggleBusy = useCallback(
    async (date: string, busy: boolean): Promise<void> => {
      // **THE ROWS TO RESTORE ARE READ FROM THE RENDERED STATE, NOT FROM INSIDE THE UPDATER.** React
      // does not promise to run a functional update synchronously — with another update already
      // queued it runs at render time — so a `previous` assigned in there is still null on the line
      // after, and the revert would have nothing to put back. This closure is the state this press
      // was drawn against, which is exactly what the press should undo.
      if (view.phase !== "ready") return;
      const previous = view.busyDays;
      const meId = view.me.id;

      // The PATCH is still a functional update, for the opposite reason: it must apply to whatever
      // rows are current when it lands, not to the ones this closure captured.
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

  // CAL-08 AC-6 and AC-11. The day status of the seven days, from the same module the month grid
  // reads — which is what makes the two screens unable to disagree about a date (CAL-08 AC-11).
  // TSK-04 § 4.2, AC-1..AC-4. The viewer's own tally per date. `view.tasks` is `[]` on another
  // team's calendar and on a failed read, so this map is empty there and no badge is drawn.
  const tallies = useMemo<ReadonlyMap<string, DayTaskTally>>(
    () => (view.phase === "ready" && range ? taskTalliesFor(view.tasks, range) : new Map()),
    [view, range],
  );

  const dayStatuses = useMemo(
    () =>
      view.phase === "ready" && range
        ? dayStatusesFor(view.holidays, range)
        : new Map<string, DayStatus>(),
    [view, range],
  );

  // AC-7. The approver is resolved against the roster the same read returned, so no name from
  // another team can reach the screen (INV-07) and a removed admin still resolves.
  const byId = useMemo(
    () => new Map((view.phase === "ready" ? view.roster : []).map((member) => [member.id, member])),
    [view],
  );

  // Only reachable off `/`: at `/` the anchor is always resolved above, so this never fires there
  // and `/` never moves on its own (AC-23).
  if (anchorDay === null) return <Navigate to={withTeamParam(`/week/${currentDay()}`, search)} replace />;

  if (view.phase === "loading") {
    return (
      <p
        data-testid="week-loading"
        role="status"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
      >
        <Loader label="Loading the week…" />
      </p>
    );
  }

  if (view.phase === "not-on-a-team") {
    return (
      <section
        data-testid="week-not-on-a-team"
        className="mx-auto flex max-w-md flex-col gap-3 rounded-2xl bg-white p-8 text-center text-sm shadow-sm"
      >
        <p>This calendar belongs to a team, and you are not on one yet.</p>
        <Link data-testid="week-sign-in" to="/signin" className="underline">
          Sign in
        </Link>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <p
        data-testid="week-unavailable"
        role="alert"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm shadow-sm"
      >
        The week could not be read completely, so nobody is listed. A short list would look like a
        quiet week.
      </p>
    );
  }

  const start = weekStart as string;
  const end = addDays(start, 6);
  const dates = eachDateInRange({ start, end });

  // AC-11. A week nobody has booked, which is the only week the mascot card is drawn over — and the
  // only one with room to draw it over. It reads the SAME `absent` map the columns render from, so
  // the card cannot disagree with the seven `week-day-empty` states beneath it.
  const weekIsEmpty = dates.every((date) => (absent.get(date) ?? []).length === 0);

  return (
    // § 4.4. `mx-auto max-w-3xl` STOOD HERE and is gone: seven columns need the pane's full width,
    // which AppShell.tsx already grants with `min-w-0 flex-1`. Nothing was added to the shell.
    // `xl:h-full` is UIE-05 AC-1's, not CAL-05's or UIE-04's: it is what carries a definite height
    // from AppShell.tsx:42's flex item down to the grid, so that `xl:min-h-full` below has something
    // to be a percentage OF. It is a height and not a min-height on purpose — this element is the
    // measuring stick, and the grid inside it is the thing allowed to outgrow the pane.
    <section className="flex flex-col gap-6 xl:h-full">
      {/* UIE-03 AC-1. **The week screen's own header is gone, and nothing replaces it here.** It
          carried a link to the landing route, then `week-prev`, `week-anchor`, `week-next`,
          `week-month` and `week-year`. The landing link is dead — UIE-02 deleted the home screen and
          made `/` show the current week — and the other five are now the top bar's, rendered once
          for every period screen (01-plan.md § 4.3). AC-5 is why the dead id is not named here.
          `week-anchor` still carries `data-week-start` set to the same Monday this screen computed,
          which is why the 43 references that read it need no edit.

          The day list below is untouched, CAL-08's cell selectors included (AC-10). */}

      {/* CAL-05 AC-13. Seven sections, always. A week that hid its quiet days would make "nobody is
          away on Sunday" and "Sunday is missing" the same screen. UIE-04 AC-3 restates it for the
          grid: seven at EVERY width, and the same seven. */}
      {/* AC-1, AC-2, AC-3 and AC-15. ONE list of seven, laid out two ways by ONE container, so
          the DOM order is Monday-to-Sunday at every width and no day exists at one width and not
          the other. `xl` is Tailwind's 1280px and is the breakpoint 01-plan.md § 4.2 originates —
          nothing in the repository stated one before (`.ai/standards/ui-design-system.md:165` is a
          bare `TODO(project)` for exactly this), which 01-plan.md Open question 1 records.

          `grid-cols-7` is `repeat(7, minmax(0, 1fr))`, so the seven tracks are EQUAL and each may
          shrink below its content — that `minmax(0, ...)`, with `min-w-0` on the day itself, is
          what keeps a long note inside its column instead of widening the pane (AC-15). `gap-2` is
          the transcription's ~8px gutter. Nothing here sets `overflow`: a column is as tall as the
          busiest day and the PANE scrolls, once, for all seven (UIE-04 AC-4, AC-5). */}
      {/* UIE-05 AC-1 and AC-3. **`xl:min-h-full`, and it is a MINIMUM.** The sentence above used to
          read "nothing here sets a height"; a minimum is what lets a quiet week reach the bottom of
          the pane without taking the busy week's freedom to grow past it, which is why UIE-04's AC-4
          and AC-5 survive the reversal of its prose (see the UIE-05 block at the top of this file).

          **01-plan.md OPEN QUESTION 1 ASKED WHETHER A PERCENTAGE RESOLVES THROUGH THIS CHAIN OR
          NEEDS AN EXPLICIT `calc(...)`, AND LEFT IT TO THIS STAGE BECAUSE IT NEEDS A RENDERED
          VIEWPORT. IT WAS RENDERED AND MEASURED, AND THE ANSWER IS THAT THE PERCENTAGE RESOLVES.**
          The chain is App.tsx:82 `<main class="flex min-h-screen flex-col">` -> AppShell.tsx:33
          `flex min-h-0 flex-1` -> :40 the pane, `flex min-w-0 flex-1 flex-col overflow-y-auto` ->
          :42 `min-w-0 flex-1 px-6 pb-6` -> this screen. That last div is a flex ITEM whose height
          the flex algorithm resolves, which is what a percentage below it resolves against — so
          `xl:h-full` on the section and on the positioning wrapper carries a definite height down to
          this grid, and `min-h-full` here is the pane minus the top bar and the pane's own `pb-6`.

          **THE `calc(100vh - 70px - 1.5rem)` THE PLAN NAMED AS THE FALLBACK WAS WRITTEN FIRST, AND
          MEASURING IT IS WHAT REJECTED IT.** It is right only when this grid's top edge is exactly
          the top bar's height, and it is not: App.tsx:88 renders `seam-banner` ABOVE the shell on
          every build resolving to the mock seam, which is every build the acceptance suite drives.
          Measured at 1280x800 the calc put the columns' bottom edge at 856px against an 800px
          viewport — 56px BELOW the fold, with the document scrolling 80px on a week where nobody is
          away, which is the opposite of AC-1. **A percentage is offset-independent and absorbs that
          banner without knowing it exists**: the same measurement gives a bottom edge of 776px, plus
          the pane's 24px of `pb-6`, which is exactly 800.

          Measured with the same probe, and these are AC-2 and AC-3: at a viewport short enough to
          overflow, the seven columns are 533px inside a 270px pane — they grow past it, the PAGE
          scrolls, no column scrolls itself, and all seven keep one top and one height.

          **`xl:` AND NOT BARE**, because below 1280px there are no columns to fill — the stacked
          layout UIE-04 originated is untouched, and a min-height there would push a two-entry week
          onto a page that scrolls for nothing. Measured at 1024px: the seven stack at their content
          height and nothing fills. */}
      {/* `xl:h-full` for the reason on the section above — the second link in the chain. On a busy
          week this wrapper is SHORTER than the grid it holds, which is intended and costs nothing:
          nothing here sets `overflow`, and the only thing positioned against it is the mascot, which
          is drawn on empty weeks only, where the two heights are the same. */}
      {/* EVT-03 AC-19. One line above the grid, and only when the event read failed. */}
      {view.eventsFailed ? (
        <p data-testid="week-events-unavailable" role="status" className="text-xs text-ink-3">
          Events could not be loaded.
        </p>
      ) : null}
      {/* TSK-04 AC-12. Where the event notice sits, and for the same reason: the grid is drawn, and
          the screen says which layer is missing rather than drawing a week with no badges as if the
          viewer had no tasks. */}
      {view.phase === "ready" && view.tasksFailed ? (
        <p data-testid="week-tasks-unavailable" role="status" className="text-xs text-ink-3">
          Your task counts could not be loaded.
        </p>
      ) : null}

      <div className="relative xl:h-full">
        <div className="flex flex-col gap-3 xl:grid xl:min-h-full xl:grid-cols-7 xl:gap-2">
          {dates.map((date) => {
            const people = absent.get(date) ?? [];
            // CAL-08. Every date of the week is a key — the contract `dayStatusesFor` keeps — so the
            // fallback below is for the loading and failure phases and never for a drawn day.
            const status = dayStatuses.get(date);
            const holiday = status?.holiday ?? null;
            // UIE-07 AC-1, AC-2. Read beside `people` and `status`, from INV-04's map and not from
            // `people.length` — the two differ on exactly the days this ticket exists for.
            const count = counts.get(date) ?? 0;

            // SOLO, 2026-09-11. The three busy facts about this date, read from the three maps built
            // in one pass above. `busyCount` is a HEAD COUNT and `count` is INV-04's weighted
            // absence figure — they are drawn as two separate things and never summed.
            // SOLO, 2026-09-11. Exactly one of the seven is true, and on a week that is not this
            // week none of them is — the marker is simply absent, which is the honest rendering of
            // "today is not on this screen".
            const isToday = date === today;

            const busyCount = busyCounts.get(date) ?? 0;
            const busyHere = busyPeople.get(date) ?? [];
            const iAmBusy = myBusy.has(date);
            // EVT-03 AC-18. Every event of the day, in AC-17's order — the week column has the room.
            const dayEvents = eventDays.get(date) ?? [];
            // TSK-04 AC-1, AC-2. The viewer's own tally, for the task footer; undefined on a day
            // without tasks, which the footer draws as `0/0`.
            const tally = tallies.get(date);

            return (
              <section
                key={date}
                data-testid="week-day"
                data-date={date}
                // UIE-07 AC-2. Borrowed verbatim from the month cell (MonthView.tsx), so the two
                // screens' attributes agree by name rather than by luck. Every day of the week is
                // in range, so there is no out-of-range empty-string case as the month has.
                data-count={count}
                // CAL-08 AC-6 and AC-11. The same two attributes the month cell carries, with the same
                // three values and the same separate `data-bridge` — a bridge day IS a working day.
                data-day-status={status ? (status.nonWorkingReason ?? "working") : ""}
                data-bridge={status?.bridge ?? false}
                // SOLO, 2026-09-11. Read by the spec rather than inferred from a class, the shape
                // `data-count`, `data-day-status` and `data-bridge` beside it already use.
                data-today={isToday}
                // § 4.3. The tokens UIE-01 and UIE-02 shipped, in place of the three Tailwind
                // defaults CAL-05 had to use before they existed — `bg-white` -> `bg-card`,
                // `shadow-sm` -> `shadow-soft`. **UIE-05 § 4.4 TOOK THE THIRD ONE BACK**: the day
                // column is `rounded-2xl` (16px) again, because the image's corner is smaller and
                // `rounded-card` (26px) is SHARED with AuthCard.tsx and Sidebar.tsx — moving
                // `--radius-card` would repaint the sign-in card and the sidebar, which AC-16
                // forbids and which src/index.css:117-123 already records as a collision one token
                // over. A Tailwind built-in on the one element that wants it means src/index.css is
                // never opened. No token is
                // added and src/index.css is not opened. `flex flex-col` makes the header strip sit
                // above the entries in a grid track that stretches to the tallest day, and `min-w-0`
                // is the other half of AC-15 — without it the day refuses to shrink below its
                // content and a long note widens the pane rather than wrapping.
              className={[
                  "flex min-w-0 flex-col rounded-2xl bg-card p-4 shadow-soft",
                  // SOLO, 2026-09-11 — the operator asked for a border on today.
                  //
                  // **`ring` AND NOT `border`, AND INSET.** A real border would add 2px to the box
                  // and make today's column a different WIDTH from the other six, which on a
                  // seven-column grid reads as a layout bug rather than as a marker. A ring is
                  // painted and occupies no space; `ring-inset` keeps it off the 2px gutter between
                  // columns, where an outset ring would touch its neighbour.
                  //
                  // `--color-primary` is the ink the `+ Book` button is filled with — the darkest
                  // thing in the palette and the one colour on this screen that carries no domain
                  // meaning. Peach, mint, lavender, pink and butter each already mean something
                  // about a day (UIE-06 § 4.6 on why a colour may not mean two things), and today is
                  // not a fact about absence at all. It is also NOT the lavender holiday tint, which
                  // can legitimately be on the same column at the same time.
                  isToday ? "ring-2 ring-inset ring-primary" : "",
                ].join(" ")}
              >
                <h2
                  data-testid="week-day-label"
                  className={[
                    // UIE-05 AC-4. A CENTRED STACK, not a wrapping baseline row: at ~161px a
                    // centred two-part label only reads as one label when the parts are stacked.
                    // `border-b border-line` is the hairline — `--color-line` is the token UIE-01
                    // shipped for exactly this and TopBar.tsx:38 already uses it, so no token is
                    // added. `rounded-t-2xl` matches the column's own corner (§ 4.4).
                    "-mx-4 -mt-4 mb-2 flex flex-col items-center gap-0.5 rounded-t-2xl border-b border-line px-4 py-2 text-center text-sm font-semibold",
                    // CAL-08 AC-6. Lavender (CLAUDE.md § Visual direction) tints the HEADING and only
                    // for a NON-WORKING holiday. The rows below are untouched, a mandated `working`
                    // Saturday is named but not tinted, and a bridge day gets no lavender at all.
                    status?.nonWorkingReason === "holiday" ? "bg-violet-100" : "",
                  ].join(" ")}
                >
                  {/* UIE-05 AC-5. **THE FULL WEEKDAY NAME, IN ENGLISH**, and both halves of that are
                      decisions rather than defaults. `T2`/`CN` is Vietnamese and is refused —
                      .ai/standards/ui-design-system.md § Language, the operator's own instruction of
                      2026-09-03, lint-enforced, and `ui-language.json` has `copyDebt: []`, a list
                      that only ever shrinks. `Mon` IS layout and IS available, but
                      tests/e2e/cal-05-week-view.spec.ts:145-146 assert `toContainText("Monday")`,
                      which a substring test fails against `Mon`; keeping the full name is free and
                      is what keeps every spec file out of `allowed_paths`. */}
                  <span>{WEEKDAY_NAMES[mondayIndex(date)]}</span>

                  {/* UIE-05 AC-6. `dd/MM` — `14/09` — sliced out of the `yyyy-MM-dd` this component
                      already holds. No date library, no locale and no new import: § Language governs
                      STRINGS, and a numeric format is outside it. It stays inside `week-day-label`,
                      which is where AC-6 puts it and what keeps the selector contract intact.

                      **SOLO, 2026-09-11 — THE BADGE SHARES THIS LINE, AND A SCREENSHOT IS WHY.**
                      Written first as a third child of the label, which is a `flex flex-col`: it
                      became a THIRD STACKED LINE, pushed `11/09` down, and made today's column's
                      header ~34px taller than the other six — a seven-column grid with one column
                      out of step, which reads as a layout bug rather than as a marker. The comment
                      that stood here claimed it "costs no line"; it cost one, and the picture is
                      what said so.
                      Paired with the DATE rather than with the weekday name because the date is two
                      digits and a slash: `TODAY 11/09` fits a ~161px column where
                      `Wednesday TODAY` would wrap and cost the line back. */}
                  <span className="flex items-center justify-center gap-1">
                    {/* The half of the request a border alone does not answer. A ring is a difference
                        somebody has to NOTICE and then guess the meaning of; the word says it. It
                        also carries the marker to a screen reader, which a painted ring reaches not
                        at all. ENGLISH (§ Language), like every other string this screen authors. */}
                    {isToday ? (
                      <span
                        data-testid="week-day-today"
                        className="rounded-pill bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-white"
                      >
                        Today
                      </span>
                    ) : null}
                    <span className="font-normal opacity-60">
                      {`${date.slice(8, 10)}/${date.slice(5, 7)}`}
                    </span>
                    {/* TSK-04's task badge (`week-day-tasks`) STOOD HERE, on the date line. It moved
                        to the column's foot as `week-day-task-panel`, which opens the day's tasks. */}
                  </span>

                  {/* CAL-08 AC-6. Named whenever a row exists, of EITHER kind, and the badge is
                      outlined rather than filled — lavender means not working. **UIE-05 § 4.3 KEEPS
                      BOTH, on their own line beneath the date.** The image draws no room for either
                      because it shows neither a holiday nor a bridge day, and silence is not
                      removal: dropping the bridge badge because a 161px column has no room for it
                      would reverse CAL-08's own decision that a bridge day is a WORKING day, which
                      is a feature-row amendment and not a layout call. */}
                  {holiday !== null ? (
                    <span
                      data-testid="week-day-holiday"
                      data-kind={holiday.kind}
                      className="font-normal opacity-80"
                    >
                      {holiday.name}
                    </span>
                  ) : null}
                  {status?.bridge ? (
                    <span
                      data-testid="week-day-bridge"
                      className="rounded-full border border-current px-2 py-0.5 text-xs font-normal opacity-70"
                    >
                      Bridge
                    </span>
                  ) : null}
                </h2>

                {/* EVT-03 § 2b. Under the label, above the entries — and AC-16: `week-day-empty`
                    below still says "Everybody is in." on a day whose only content is an event. */}
                {dayEvents.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {dayEvents.map((event) => (
                      <EventChip
                        key={event.id}
                        event={event}
                        takingPart={takingPart.has(event.id)}
                        surface="week"
                        date={date}
                      />
                    ))}
                  </div>
                ) : null}

                {people.length === 0 ? (
                  <p data-testid="week-day-empty" className="mt-2 text-sm opacity-60">
                    Everybody is in.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {people.map(({ entry, member }) => {
                      // AC-7. `approvedBy` is resolved, never rendered raw: a uuid on the row would be
                      // the opposite of naming who approved.
                      //
                      // BOTH halves are tested, and the `status` half is not redundant. INV-02's
                      // trigger clears `approved_by` when an approval is revoked, so today the two
                      // agree — but the selector contract says `week-row-approver` is present only
                      // when the entry is APPROVED, and reading the status is what makes that true of
                      // this file rather than true of a trigger one layer down.
                      const approver =
                        entry.status === "approved" && entry.approvedBy !== null
                          ? byId.get(entry.approvedBy)
                          : undefined;

                      // UIE-05 AC-9. Row 3 renders only when it would hold something, so the same
                      // question the note element already asked is asked once and named — an empty
                      // third row is a line of padding that claims a fact exists.
                      const hasNote = entry.note !== null && entry.note !== "";

                      return (
                        <li
                          // One member may hold an `am` AND a `pm` entry on one date, so the key is the
                          // entry and not the member — that pair is two rows here and one avatar on
                          // the month grid, which is the same fact told two ways.
                          key={entry.id}
                          data-testid="week-row"
                          data-member-id={member.id}
                          data-entry-id={entry.id}
                          // SOLO 2026-09-13. Focusable so the hover card also opens from the keyboard
                          // (`EntryTooltip`, rendered as this chip's first child).
                          tabIndex={0}
                          className={[
                            // SOLO 2026-09-10 — **A CAPSULE WITH AN ACCENTED LEFT EDGE**, from the
                            // operator's screenshot. UIE-05's three-row stack is not undone: the same
                            // seven children and the same seven selectors are all still here, and the
                            // three secondary facts are still demoted rather than hidden. What changed
                            // is that the avatar now sits BESIDE the text column instead of above it,
                            // which is what buys the second line back.
                            //
                            // `rounded-[1.5rem]` AND NOT `rounded-full`: at the two-line height the
                            // screenshot draws, half the height IS 1.5rem, so the two are identical
                            // there — and they stop being identical the moment a note or an approver
                            // adds a third line, where `rounded-full` turns a paragraph into a lozenge.
                            // A fixed radius reproduces the picture and survives the row growing.
                            "flex min-w-0 items-start gap-2 rounded-[1.5rem] py-1.5 pl-1.5 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                            // **THE LEFT ARC IS A LEFT BORDER ON A ROUNDED BOX**, which is what makes
                            // it a crescent rather than a bar — no extra element, nothing to position.
                            //
                            // **AND THE FILL IS NOW THE SEMANTIC TOKEN.** This file was still on
                            // `bg-emerald-100` / `bg-orange-100` while UIE-06 moved the month grid to
                            // `bg-wfh` / `bg-pto` on 2026-09-05, so the two screens have been drawing
                            // one person in two different mints for five days. `/50` is what makes the
                            // fill the paler tint of the screenshot while the arc keeps the token at
                            // full strength — one colour, two weights, and a repaint still changes one
                            // hex in `src/index.css`.
                            entry.type === "wfh"
                              ? "border-l-4 border-l-wfh bg-wfh/50"
                              : "border-l-4 border-l-pto bg-pto/50",
                            // AC-9. Tentative is a dashed border at reduced opacity, so that "is
                            // listed" and "is settled" stay visually separate: a tentative entry is
                            // listed on exactly the same terms as any other (INV-05) and drawn so
                            // nobody reads the list as certainty. THE DASH IS ON THE OTHER THREE SIDES
                            // ONLY — the left edge is the type accent, and dashing it would make the
                            // two signals fight over one stroke.
                            entry.tentative
                              ? "border-y border-r border-dashed border-y-current border-r-current opacity-70"
                              // **SIDE-SCOPED, AND THE UNSCOPED FORM WAS A REAL BUG FOR ONE
                              // ITERATION.** `border-transparent` sets `border-color` on ALL FOUR
                              // sides, so it overwrote `border-l-pto` and the accent arc rendered
                              // invisible while every class looked right in the source.
                              : "border-y border-r border-y-transparent border-r-transparent",
                          ].join(" ")}
                        >
                          <EntryTooltip entry={entry} member={member} approver={approver} />

                          {/* UIE-05 AC-7. A CIRCULAR BUBBLE rather than a bare glyph. `shrink-0` keeps
                              it round when the name beside it wraps. SOLO 2026-09-10: `h-8 w-8` and a
                              solid white fill, per the screenshot — it is out of the text column now,
                              so the pixels it costs are no longer pixels taken off the name. */}
                          <span
                            data-testid="week-row-avatar"
                            aria-hidden="true"
                            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card text-base leading-none"
                          >
                            <Avatar value={member.avatar} />
                          </span>

                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            {/* UIE-05 AC-7 and AC-8. **ROW 1 — the name and the star.**

                                **THE STAR IS INLINE WITH THE NAME AND IS NOT A SIBLING FLEX CHILD, AND
                                THAT IS A MEASURED CORRECTION RATHER THAN A PREFERENCE.** Written as two
                                flex children with a `shrink-0` star, the rendered column at 1280px left
                                the name about 24px and `Đã duyệt` broke MID-WORD, as `Đã / du / yệt` —
                                a Vietnamese name pulled apart across three lines on the screen
                                CLAUDE.md § Visual direction asks to set the diacritics correctly on.
                                Inline, the star flows after the last word instead of reserving a column
                                of its own, and the name wraps between words.

                                `break-words` is a LAST RESORT and not the normal case: it breaks a word
                                only when the word cannot fit a line of its own. `truncate` was rejected
                                outright — a clipped name is a person the screen has stopped naming. */}
                            <span className="min-w-0 leading-snug">
                              <span
                                data-testid="week-row-name"
                                className="break-words font-semibold text-ink"
                              >
                                {member.displayName}
                              </span>

                              {/* UIE-05 AC-8. **THE STAR MOVED HERE; IT WAS NOT ADDED.** It stood
                                  inside `week-row-approver`, which rendered `★ Approved by <name>`.
                                  CLAUDE.md § Visual direction asks that an approved entry carry a
                                  small star, and beside the name is where it is legible at a glance.
                                  **THE NAME OF THE APPROVER STAYS ON ROW 3** — a bare star says only
                                  that somebody approved, and CAL-05's registry row is about WHO, which
                                  is the whole of v1's audit answer. SOLO 2026-09-10: the screenshot
                                  draws it gold, so it is an emoji rather than a glyph inheriting body
                                  ink.

                                  **SOLO 2026-09-13: THE APPROVER'S NAME MOVED ONTO THE STAR.** The
                                  operator removed row 3's `Approved by <name>` from the chip; the name
                                  survives as the star's accessible name (`aria-label`) and in the chip's
                                  hover card (`EntryTooltip`), so WHO approved is still on this screen (CAL-05 AC-7)
                                  without costing a line. A span and not a button: AC-8 holds this
                                  screen to no control over an entry. */}
                              {approver ? (
                                <span
                                  data-testid="week-row-approver"
                                  data-approver-id={approver.id}
                                  role="img"
                                  aria-label={`Approved by ${approver.displayName}`}
                                  className="ml-1 cursor-help text-[0.75em]"
                                >
                                  ⭐
                                </span>
                              ) : null}
                            </span>

                            {/* UIE-05 AC-7 and AC-9. **ROW 2 — the type and the portion**, demoted
                                under the name as a small uppercase caption.

                                **THE CODE IS HERE AT THE OPERATOR'S INSTRUCTION AND IT CONTRADICTS
                                OPS-002 AC-7**, which requires every screen naming an entry's type to
                                state that the member is WORKING. `WFH` states nothing to a reader who
                                does not know the domain — that is the criterion's whole point, and the
                                screenshot of 2026-09-10 asks for the code anyway. `TYPE_CODES`'
                                docblock in `src/lib/labels.ts` carries the same warning beside the map,
                                so neither end of this can be read without meeting it. Every OTHER
                                surface still renders `TYPE_LABELS`. */}
                            <div className="flex flex-wrap items-center gap-1.5 text-[0.6875rem] font-bold uppercase leading-none tracking-wide">
                              <span
                                data-testid="week-row-type"
                                data-type={entry.type}
                                className={entry.type === "wfh" ? "text-wfh-ink" : "text-pto-ink"}
                              >
                                {TYPE_CODES[entry.type]}
                              </span>

                              {/* AC-3 and AC-4. `data-portion` is the attribute the criteria turn on, and
                                  it is read off the entry on EVERY date the entry covers — which is why a
                                  five-day `pm` entry renders five afternoons and cannot render a whole day
                                  in the middle (INV-06). **UIE-05 MOVED THIS PILL AND DID NOT DROP IT**,
                                  and neither does this: the screenshot has no portion on any of its rows
                                  because every row it draws is a whole day, and this is INV-06's only
                                  visible surface in the whole product. Dropping it would make that
                                  invariant invisible on the one screen that shows it. */}
                              <span
                                data-testid="week-row-portion"
                                data-portion={entry.portion}
                                className="whitespace-nowrap rounded-full bg-card/70 px-1.5 py-0.5 font-semibold text-ink-2"
                              >
                                {PORTION_LABELS[entry.portion]}
                              </span>
                            </div>

                            {/* UIE-05 AC-9. **ROW 3 — DEMOTION, NOT DISCLOSURE.** Smaller and lighter,
                                and every one of these renders AT REST: no hover, no click, no expansion.
                                UIE-04 refused hiding them even behind an expand, where the information
                                still existed. The row itself is absent when it would be empty.

                                **SOLO 2026-09-13: ONLY THE NOTE IS LEFT ON THIS ROW.** The operator
                                removed the visible `Tentative` word and moved `Approved by <name>` onto
                                the star in row 1. The dashed border and reduced opacity still mark a
                                tentative entry, and the word stays for a screen reader (`sr-only`),
                                because a border is not readable to somebody who cannot see it (AC-9). */}
                            {entry.tentative ? (
                              <span data-testid="week-row-tentative" className="sr-only">
                                Tentative
                              </span>
                            ) : null}
                            {hasNote ? (
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">

                                {/* AC-6. Present only when there is a note — an empty note element is a row
                                    that claims something was said. The note is readable by the whole team,
                                    which follows from `entry_select_team` being a row-level select policy
                                    (ADR-005) and is a consequence to be aware of rather than a decision this
                                    screen takes. Demoting it changes how PROMINENT it is and not who may
                                    read it. */}
                                <span data-testid="week-row-note" className="basis-full break-words opacity-80">
                                  {entry.note}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* SOLO, 2026-09-11 — the busy strip, and the control that writes it.
                    The operator: *"cho phép user mark ngày cụ thể nào đó là bận, người khác sẽ thấy
                    được số member bận trong ngày đó"*, so that somebody arranging an event can see
                    which days are heavy. They chose a press on the day itself, and count PLUS names.

                    **`mt-auto` IS HERE AND THE COUNT STRIP BELOW GAVE UP ITS OWN, WHICH IS THE ONE
                    CHARACTER OF UIE-07's ELEMENT THIS CHANGE TOUCHES.** Written first with BOTH
                    carrying it, and a screenshot is what rejected that: CSS distributes free space
                    EQUALLY among every auto margin in the box, so two `mt-auto` siblings take half
                    the slack each and this pill floated in the middle of the column with the strip
                    still at the bottom. One auto margin pins the pair. `week-day-count` keeps its
                    id, its text, its `data-current-members` and its whole appearance — UIE-07
                    asserts those and asserts no class, so every one of its criteria still passes.

                    **ONE ELEMENT IS BOTH THE FIGURE AND THE CONTROL.** A separate "mark busy" button
                    beside a separate number would spend two rows of a 161px column on one fact.
                    `aria-pressed` is what makes the button a toggle to a screen reader rather than
                    an action with a surprising result.

                    **IT IS NOT THE OVERLOAD STATE AND NOT THE ABSENCE COUNT.** Butter, not pink and
                    not peach: UIE-06 § 4.6 refused giving one colour two meanings on one grid, and a
                    busy person is at work — the opposite of what every other colour on this screen
                    means. `src/index.css` carries the token's reasoning.

                    **THE NAMES ARE AVATARS, NOT A LIST.** The column is ~161px wide and a stacked
                    list of display names is the density CLAUDE.md § Visual direction says the grid
                    never pays. Each avatar carries `title` and `data-member-id`, which is how the
                    month cell already names the people it draws. */}
                {/* CAL-12 AC-9. Absent while another team is viewed: another team's busy days have no
                    read (01-plan.md § 1, out of scope 13), and the toggle writes the CALLER's own
                    mark. The empty `mt-auto` keeps the count strip below pinned to the column's foot,
                    which this pair's own auto margin does when it is drawn. */}
                {isReadOnly(viewed) ? (
                  <div className="mt-auto" />
                ) : (
                <div className="mt-auto flex flex-wrap items-center gap-1 pt-2">
                  <button
                    type="button"
                    data-testid="week-day-busy"
                    data-date={date}
                    data-busy-count={busyCount}
                    data-mine={iAmBusy}
                    data-pending={busyPending === date}
                    aria-pressed={iAmBusy}
                    aria-busy={busyPending === date}
                    disabled={busyPending === date}
                    onClick={() => void toggleBusy(date, !iAmBusy)}
                    className={[
                      "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-semibold transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                      "disabled:opacity-50",
                      iAmBusy ? "bg-busy text-busy-ink" : "border border-line text-ink-3 hover:text-ink",
                    ].join(" ")}
                  >
                    {/* The word is visible and the number is beside it, because a bare figure on a
                        strip that already carries `0/4` would read as a second absence count.

                        SOLO, 2026-09-11 (second pass) — the spinner the operator asked for. **IT
                        SITS BESIDE THE NUMBER AND DOES NOT REPLACE IT.** The count is already the
                        new one when this appears, because the press is optimistic; swapping the
                        figure out for a spinner would hide the very thing the press just changed,
                        and would also change the pill's width mid-press. What it says is "the write
                        is still in flight", which is the only fact the button still owes. */}
                    <span>Busy {busyCount}</span>
                    {busyPending === date ? <BusySpinner testIdPrefix="week-day-busy" /> : null}
                  </button>

                  {busyHere.map((person) => (
                    <span
                      key={person.id}
                      data-testid="week-day-busy-avatar"
                      data-member-id={person.id}
                      title={person.displayName}
                      className="inline-flex items-center rounded-full bg-busy px-1.5 py-0.5 text-xs"
                    >
                      <Avatar value={person.avatar} className="h-4 w-4" />
                    </span>
                  ))}
                </div>
                )}

                {/* The viewer's own tasks for the day, at the column's foot, above the count strip.
                    Own calendar only, as the task read is (ADR-040). A button and not a link: it
                    opens the day in a dialog rather than leaving the week. The count is neutral
                    ink, and mint only when every task is done. */}
                {viewed.kind === "own" ? (
                  <button
                    type="button"
                    data-testid="week-day-task-panel"
                    data-date={date}
                    data-done={tally?.done ?? 0}
                    data-total={tally?.total ?? 0}
                    aria-label={`Tasks: ${tally ? tallyLabel(tally) : "none"}. Open`}
                    onClick={() => setTaskDay(date)}
                    className={
                      "mt-2 flex items-center justify-between gap-1 rounded-xl border border-dashed border-line " +
                      "px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-3 transition-colors " +
                      "hover:border-ink-3 hover:text-ink " +
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      <ListChecks aria-hidden="true" className="h-3 w-3 shrink-0" />
                      Tasks
                    </span>
                    <span
                      className={
                        "tabular-nums " +
                        (tally && tally.total > 0 && tally.done === tally.total
                          ? "text-wfh-ink"
                          : tally && tally.total > 0
                            ? "text-ink"
                            : "")
                      }
                    >
                      {tally ? tallyText(tally) : "0/0"}
                    </span>
                  </button>
                ) : null}

                {/* UIE-07 AC-1, AC-7, AC-8, AC-10, AC-11. THE MIRROR OF THE HEADER STRIP above —
                    same full-bleed negative margin, same hairline token, same centred small type,
                    `border-t` and `rounded-b-2xl` where the header has `border-b` and
                    `rounded-t-2xl`. No token is added: `--color-line` and `--color-ink-3` both
                    already exist (src/index.css:104, :109), so src/index.css is not opened.

                    `mt-auto` IS THE PIN AND IT NEEDS NO WRAPPER. UIE-05 shipped `xl:grid
                    xl:min-h-full` on the grid with each day a `flex min-w-0 flex-col` section, so
                    grid items stretch and the auto margin eats the slack — the strip sits on the
                    column's bottom edge whatever the tallest day is. Below `xl` the stack is
                    content-height and `mt-auto` is inert, which is the correct behaviour there.

                    IT RENDERS ALWAYS, INCLUDING `0/N`, and that is a decision rather than the
                    month's default: `month-cell-count` renders only when `count > 0`, and following
                    that here would make the strip vanish on all seven columns of an empty week
                    (AC-7). On a quiet week a column therefore reads label / "Everybody is in." / a
                    gap / `0/4`, which is the accepted cost of keeping that sentence.

                    NO NOUN IS VISIBLE (AC-10). ADR-029 clause 4 forbids `vắng`, and its other half —
                    the glossary's own English term — carries the same claim about a member working
                    from home that the clause exists to prevent (glossary.md, "Absence count"; and
                    src/lib/labels.ts calls that the most costly confusion in this domain). So the
                    visible strip is two numbers and a slash, which also spends the least density on
                    the screen CLAUDE.md § Visual direction is written about, and the glossary's
                    exact English term is in the ACCESSIBLE reading only. An `aria-label` on the `<p>`
                    is deliberately not used: the sr-only span adds the name to the reading order
                    without overriding the numbers.

                    TWO NUMBERS AND A SLASH, NEVER A PERCENTAGE, AND NO SPECIAL CASE AT `N = 0`
                    (AC-8, AC-9). Under ADR-013 the numerator is DATE-SENSITIVE while the denominator
                    is READ-TIME, a consequence INV-04 records as accepted, so on a past week after a
                    removal `n` can exceed `N`, and `N` can be 0 while `n` is not. THIS IS THE FIRST
                    SURFACE THAT JUXTAPOSES THEM. Nothing here divides, so it is a display oddity and
                    not a defect — and dividing is exactly where an oddity becomes a NaN on screen,
                    which is why `isOverloaded` guards `currentMembers <= 0` before it and why this
                    element does not need to.

                    NO ROUNDING, AND THAT IS INV-06 (AC-3, AC-8). A half day weighs 0.5, so `{count}`
                    renders `0.5` and `1` — never `1.0`, never `Math.round(count)`, never `toFixed`.
                    The chip above carries `week-row-portion`, INV-06's only visible surface in the
                    product (UIE-05), and a strip reading `1` beside a pill reading `Morning` would
                    make the screen contradict itself about the invariant on the one screen that
                    shows it.

                    IT IS NOT THE OVERLOAD STATE (AC-11). No threshold, no `seam.getTeam()`, no
                    overload attribute, and no pink — pink is `--color-overload`, and UIE-06 already
                    refused painting it on a working day for giving one colour two meanings on one
                    grid. ADR-029 clause 3 forbids anything overload-shaped here independently.

                    IT ADDS NO CONTROL (AC-12). A `<p>` holding two `<span>`s is none of the five
                    elements cal-05-week-view.spec.ts forbids inside a `week-day`, so CAL-05 AC-8's
                    absence mechanism survives untouched and that spec file stays unedited. */}
                <p
                  data-testid="week-day-count"
                  data-current-members={activeMembers}
                  // SOLO, 2026-09-11: `mt-auto` REMOVED, and the busy strip immediately above now
                  // carries the column's only auto margin. Two of them split the free space rather
                  // than stacking — see the block above, which is where the reasoning lives.
                  className="-mx-4 -mb-4 rounded-b-2xl border-t border-line px-4 py-2 text-center text-sm text-ink-3"
                >
                  <span className="sr-only">Absence count: </span>
                  {count}/{activeMembers}
                </p>
              </section>
            );
          })}
        </div>

        {/* AC-11 and AC-12. The mascot, and it is the whole of what UIE-04 adds to this screen's
            content. It floats OVER the columns rather than inside one — the transcription puts it
            across the fourth — so it is a sibling of the grid, absolutely positioned over it, and
            `pointer-events-none` keeps it from being a target on a screen that has none.

            `hidden xl:flex` is AC-11's "in the seven-column layout": below the breakpoint the seven
            per-day empty states ARE the screen and a card has nothing to float over.

            IT CARRIES NO LINK AND NO BUTTON (AC-12). The transcription's create link is refused in
            01-plan.md § 1 item 10: `home-new-entry-link` already sits in the top bar on every
            route, so a second control to `/entries/new` either duplicates an id or gives the
            product two names for one destination. The sentence is ENGLISH (§ Language, AC-16) —
            the transcription's is Vietnamese and this is the one string on this screen a developer
            would copy from it rather than from the file.

            The seven `week-day-empty` states below are untouched and all seven still render
            (AC-10), which `tests/e2e/cal-05-week-view.spec.ts:266` asserts by count. */}
        {weekIsEmpty ? (
          <div className="pointer-events-none absolute inset-0 hidden items-center justify-center xl:flex">
            <div
              data-testid="week-empty-card"
              className="flex items-center gap-3 rounded-card bg-card px-5 py-4 shadow-soft"
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                🐭
              </span>
              <p className="text-[13px] text-ink">Nobody has booked this week yet.</p>
            </div>
          </div>
        ) : null}
      </div>

      {taskDay !== null ? (
        <TaskDayDialog day={taskDay} onClose={() => setTaskDay(null)} onChanged={() => void reloadTasks()} />
      ) : null}
    </section>
  );
}

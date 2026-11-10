// ADM-02 — the national holiday calendar, one year at a time.
// ADM-03 — and, for an admin, writable: add, edit, delete.
// 01-plan.md sections 2, 2b, 3, 4.2, 4.4 and 4.5.
//
// **MIR-15-e, ADR-079.** `holiday` NOW CARRIES AN ORG, and the read this screen makes is
// `holiday_select_own_org` (ADR-079 decision 3), not the `holiday_select_all` this comment used to
// cite: a caller reads only their own org's rows, and a caller with no org — no member row,
// pending, or removed — reads none and is told so (AC-5) rather than seeing an empty year. The gate
// below the controls are drawn under now also tests `!orgShared` (ADR-079 decision 2): an Org
// public admin is shown the calendar and told who sets it (AC-1, AC-2), and a dedicated org's admin
// keeps all three controls exactly as an admin always has (AC-3).
//
// **THE READ HALF IS UNCHANGED BY ADM-03.** Every selector ADM-02 shipped keeps its name and its
// position, the one `listHolidays` call is the same call, and the loading, unavailable and
// empty-year phases are untouched — which is what makes `tests/e2e/adm-02-holidays.spec.ts` the
// evidence that reading did not change rather than merely the belief that it did not (AC-18).
//
// **WHAT ADM-03 ADDS IS AN AFFORDANCE, AND THE CONTROL IS IN THE DATASTORE.** `getCurrentMember()`
// is called here for the ROLE and nothing else. ADM-02's comment said this screen deliberately does
// not call it, and the reason it gave was that "you are not on a team" is not a true thing to say
// about a national calendar — that is about the not-on-a-team PHASE, which MIR-15-e adds for a
// different reason: a caller with no org now reads no row at all (AC-5), rather than the whole
// calendar with no controls that every other caller still gets (AC-14, AC-18). Hiding the controls
// stops nobody: `holiday_insert_admin`, `holiday_update_admin`, `holiday_delete_admin` and the write
// grant are the control, and AC-15 exists to prove that removing the affordance changes nothing.
//
// **IT STILL COMPUTES NO BRIDGE DAY.** ADR-015 section 4's three-input derivation is CAL-08's,
// together with the shading in the calendar views, and its central definition — what *sandwiched*
// means for a run longer than one day — is an open question with the operator.
//
// **AND IT STILL SUPPRESSES NOTHING.** A Saturday on which four people declared PTO stays crowded
// as far as CAL-07 is concerned. The ADM-03 registry row forbids holiday-suppression of the
// crowded-day warning to this ticket in terms.
//
// Colour, and where it comes from. `.ai/standards/ui-design-system.md` section Colour is still
// `TODO(project)`, so the palette is cited to `CLAUDE.md` section Visual direction, the only place in
// the repository that carries it: holidays are lavender. The `working` rows deliberately do NOT take
// lavender — they are the inverse of a holiday, and giving them the holiday colour is the exact
// confusion ADR-015 section 2 names. 01-plan.md section 2b records that no image was attached at
// either stage and that the arrangement below is the Tech Lead's own.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import HolidayForm, { EFFECT_LABEL, type HolidayFormValues } from "@/components/HolidayForm";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `./supabase` or `./mock` (RULE-02).
import { seam } from "@/lib/data";
import type { DateRange, Failure, Holiday, Member } from "@/lib/domain/types";
import { mayAdminister } from "@/lib/roles";
// SOLO, 2026-09-11 — the loading mark that replaced this screen's "Loading…" sentence. The
// sentence itself is still announced: `Loader.tsx` keeps it as `sr-only` text, because the element
// below carries `role="status"` and an emptied one announces nothing.
import Loader from "@/components/Loader";

// ---------------------------------------------------------------------------
// The year vocabulary. `yyyy` in the URL, `yyyy-MM-dd` everywhere below it — the shape CAL-06
// shipped for `/year/:year`, borrowed rather than reinvented (01-plan.md section 2b).
// ---------------------------------------------------------------------------

const YEAR_PATTERN = /^\d{4}$/;

/** AC-8. January 1st to December 31st, inclusive, as two strings — no Date is constructed anywhere
 *  in this file, which on this table is the difference between a correct and an incorrect feature
 *  (ADR-015 Consequences, and the note beside `Holiday.date`). */
const yearRange = (year: string): DateRange => ({ start: `${year}-01-01`, end: `${year}-12-31` });

const shiftYear = (year: string, by: number): string => String(Number(year) + by).padStart(4, "0");

/**
 * The year `/holidays` with no anchor resolves to (AC-9).
 *
 * This is the ONE place a LOCAL date read is correct, and the exception is worth naming because
 * every other date in this feature is deliberately a plain string. It answers "which year is it for
 * the person looking at the screen", which is a fact about their clock. `MonthView.tsx`,
 * `WeekView.tsx` and `YearView.tsx` each record the same exception.
 */
const currentYear = (): string => String(new Date().getFullYear()).padStart(4, "0");

/**
 * ADM-03 AC-4. Which year a stored row belongs to, read off the FIRST FOUR CHARACTERS of the
 * `yyyy-MM-dd` string and never through a Date. `new Date('2027-01-01').getFullYear()` is 2026 for a
 * reader west of UTC — the trap ADR-015 Consequences names — and here it would send an admin to the
 * wrong year to look for the row they just added.
 */
const yearOf = (date: string): string => date.slice(0, 4);

// AC-3 lives in `EFFECT_LABEL`, which is defined once in `HolidayForm` and imported here, so the
// form a person chooses in and the list they read afterwards cannot disagree about what `working`
// means. It moved out of this file at ADM-03 and its value did not change.

// ---------------------------------------------------------------------------
// The screen.
// ---------------------------------------------------------------------------

// Four phases now. The empty year is still a case INSIDE `ready` rather than a phase of its own —
// because it is not a different fact about the read, it is a different fact about the calendar
// (AC-10). "Still loading" and "the read failed" are two that must never be folded into it: a
// year drawn from a failed or possibly-truncated read looks exactly like an under-seeded one, and
// telling those apart is the whole of AC-11 and AC-12.
//
// ADM-03 ADDED `me` TO `ready` AND NO FOURTH PHASE, on the reasoning that a member reads this
// calendar in full, so the role only ever decided which CONTROLS are drawn and never whether the
// screen is drawn. MIR-15-e ADDS THE FOURTH PHASE, `no-org`, because that reasoning stopped being
// true at MIR-15-b: `holiday_select_own_org` reads nothing for a caller with no org (no member row,
// pending, or removed — AC-5), so there is no calendar for the screen to draw controls under in the
// first place. `null` on `ready.me` still means only "the member read failed", which keeps today's
// whole-calendar-no-controls behaviour for that one failure case (AC-6's reasoning mirrored).
type View =
  | { phase: "loading" }
  | { phase: "unavailable" } // a throw from the read, including the truncation refusal
  | { phase: "no-org" } // MIR-15-e AC-5: the member read resolved to no org to read a calendar for
  | { phase: "ready"; holidays: Holiday[]; me: Member | null; orgShared: OrgShared };

/** MIR-15-e. "unknown" is a failed read: no control (AC-6) and no system-admin line, since the line
 *  would then be a claim nothing established. */
type OrgShared = "yes" | "no" | "unknown";

export default function Holidays() {
  const { year } = useParams<{ year: string }>();

  // AC-8 and AC-9. The anchor is the URL and nothing else, so `/holidays/2026` typed directly
  // produces the same screen as pressing *next* from 2025. An absent or malformed anchor resolves to
  // the caller's current year rather than rendering an empty calendar — and it resolves HERE rather
  // than in a second route, because which year it is is a fact about the caller's clock and
  // `App.tsx` holds none.
  const valid = year !== undefined && YEAR_PATTERN.test(year);

  const range = useMemo<DateRange | null>(
    () => (valid && year ? yearRange(year) : null),
    [valid, year],
  );

  const [view, setView] = useState<View>({ phase: "loading" });

  // ADM-03. The row being edited and the row being confirmed for deletion, each held as an ID AND
  // NOT AS A BOOLEAN — the reason `NewEntry.tsx` records for its own confirmation state: a boolean
  // beside a separate id is two pieces of state that can disagree, and here that would mean an open
  // form belonging to a row that is no longer on screen. One row at a time, in each case.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<Failure | null>(null);

  // AC-4. The year a just-added row actually landed in, when it is not the year on screen. Null the
  // rest of the time, which is every add that behaved the way the person expected.
  const [addedElsewhere, setAddedElsewhere] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!range) return;
    setView({ phase: "loading" });

    // ADM-03. The ROLE, and nothing else is taken from this row. It is read in its own `try` so that
    // a caller with no member row — and a member read that fails — still gets the whole calendar
    // (AC-14, AC-18). Folding it into the read below would make `listHolidays`'s refusal and "we
    // could not tell who you are" the same screen, and only one of those is a reason to withhold a
    // national calendar.
    let me: Member | null;
    let memberReadFailed = false;
    try {
      me = await seam.getCurrentMember();
    } catch {
      me = null;
      memberReadFailed = true;
    }

    // MIR-15-e AC-5. A caller with no org to read a calendar for — no member row, pending, or
    // removed — is told so directly rather than seeing an empty year, because after MIR-15-b
    // `holiday_select_own_org` reads them nothing (`member_org_id` is null for exactly these three
    // cases). `listHolidays` is not called. A FAILED member read is NOT this case: "we could not
    // tell who you are" keeps today's behaviour, the whole calendar with no controls, the same
    // reasoning AC-6 uses below for a failed org-shared read.
    if (!memberReadFailed && (me === null || me.status !== "approved" || me.removedAt !== null)) {
      setView({ phase: "no-org" });
      return;
    }

    // MIR-15-e, ADR-079 decision 2. Whether the caller's org is Org public, asked only for an admin
    // — a member's controls are already hidden by role alone, so the extra read would add a failure
    // mode to a path no criterion needs it on (01-plan.md § 8). AC-6: a throw answers "unknown"
    // rather than a guess, so a failed read shows no control and no system-admin line, never three
    // controls the database would refuse.
    let orgShared: OrgShared;
    if (me !== null && mayAdminister(me.role)) {
      try {
        orgShared = (await seam.isOwnOrgShared()) ? "yes" : "no";
      } catch {
        orgShared = "unknown";
      }
    } else {
      orgShared = "no";
    }

    try {
      // THE ONE READ THIS SCREEN MAKES OF THE CALENDAR. No `listMembers()` and no `getTeam()` — a
      // holiday belongs to the calendar and not to any member, so there is no roster to fetch and no
      // threshold to compare against. Either would be the first step toward a derivation this ticket
      // has not designed.
      const holidays = await seam.listHolidays(range);
      setView({ phase: "ready", holidays, me, orgShared });
    } catch {
      // AC-11 and AC-12. The read throws on a transport failure AND on a possibly-truncated answer
      // (`HOLIDAY_LIMIT`). This branch is the refusal: no calendar at all, rather than one missing
      // the rows the read dropped — a short calendar renders a holiday as an ordinary working day
      // and a mandated Saturday as an inert weekend, and neither error surfaces on the day whose row
      // went missing.
      setView({ phase: "unavailable" });
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  // Moving between years abandons whatever was open. The row an edit form belonged to is not on the
  // new year's screen, and a confirmation that survived the navigation would be pointing at a row
  // the person can no longer see.
  useEffect(() => {
    setEditingId(null);
    setPendingId(null);
    setDeleteError(null);
    setAddedElsewhere(null);
  }, [year]);

  if (!valid) return <Navigate to={`/holidays/${currentYear()}`} replace />;

  if (view.phase === "loading") {
    return (
      <p
        data-testid="holidays-loading"
        role="status"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
      >
        <Loader label="Loading the calendar…" />
      </p>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <p
        data-testid="holidays-unavailable"
        role="alert"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm shadow-sm"
      >
        The holiday calendar could not be read completely, so none of it is shown. A calendar with
        days missing from it would show a holiday as an ordinary working day.
      </p>
    );
  }

  // MIR-15-e AC-5. The same centred card `holidays-unavailable` uses, WITHOUT `role="alert"` — this
  // is a state, a fact about the caller's account, and not a failure the way a truncated or
  // transport-failed read is.
  if (view.phase === "no-org") {
    return (
      <p
        data-testid="holidays-no-org"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm shadow-sm"
      >
        Your account is not in an organisation yet, so there is no holiday calendar to show.
      </p>
    );
  }

  const anchorYear = year as string;
  const { holidays, me, orgShared } = view;

  // AC-14. THE ONE CONDITION EVERY CONTROL BELOW IS DRAWN UNDER. A member, and a signed-in caller
  // with no member row, get the calendar and nothing to press. It is an affordance and never the
  // check — the three policies are the check, and AC-15 is the test that says so.
  //
  // MIR-15-e, ADR-079 decision 2 adds `orgShared === "no"`: an Org public admin (`orgShared ===
  // "yes"`) and a failed org-shared read (`"unknown"`, AC-6) now draw no control either, matching
  // `holiday_insert_admin`'s, `holiday_update_admin`'s and `holiday_delete_admin`'s own
  // `and not public.org_is_shared(org_id)` conjunct.
  const mayWrite =
    me !== null && me.removedAt === null && mayAdminister(me.role) && orgShared === "no";

  // AC-1, AC-2. The add form's own handler. The seam returns the stored row, so the year it landed
  // in is read back from the datastore rather than assumed to be the one on screen (AC-4).
  async function onAdd(values: HolidayFormValues): Promise<Failure | null> {
    const result = await seam.addHoliday(values);
    if (!result.ok) return result.error;

    const landedIn = yearOf(result.value.date);
    setAddedElsewhere(landedIn === anchorYear ? null : landedIn);
    await load();
    return null;
  }

  // AC-7, AC-8, AC-10. The edit form's handler, one row at a time. A successful save closes the form
  // and re-reads, so the list shows the stored values rather than the ones that were typed.
  async function onEdit(holidayId: string, values: HolidayFormValues): Promise<Failure | null> {
    const result = await seam.updateHoliday(holidayId, values);
    if (!result.ok) return result.error;

    setEditingId(null);
    // A row edited ONTO another year leaves the year on screen, which is the same surprise AC-4
    // names on the add — so it is answered with the same notice rather than with silence.
    const landedIn = yearOf(result.value.date);
    setAddedElsewhere(landedIn === anchorYear ? null : landedIn);
    await load();
    return null;
  }

  // AC-11, AC-13. The second press. Nothing is removed by the first one — `pendingId` is set and
  // this runs only from inside the confirmation.
  async function onConfirmDelete(holidayId: string): Promise<void> {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await seam.deleteHoliday(holidayId);
      if (result.ok) {
        setPendingId(null);
        await load();
      } else {
        // The confirmation STAYS OPEN on a refusal, the shape `AllowList.tsx` uses: the row the
        // sentence is about is named directly above it, and there is no other place on this screen
        // where a delete failure would make sense.
        setDeleteError(result.error);
      }
    } catch {
      setDeleteError({ code: "unknown", message: "Could not remove this day. Please try again." });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl bg-white p-8 shadow-sm">
      <header className="flex flex-wrap items-center gap-4">
        {/* AC-8. Links and not buttons: the year IS the address, so moving between years is
            navigation and anybody can bookmark or share the year they are looking at. The shape
            CAL-06 shipped for `/year/:year`, borrowed rather than reinvented. */}
        <Link
          data-testid="holidays-prev"
          to={`/holidays/${shiftYear(anchorYear, -1)}`}
          className="text-sm underline"
        >
          Previous
        </Link>
        <h1 data-testid="holidays-year" data-year={anchorYear} className="text-xl font-semibold">
          {anchorYear}
        </h1>
        <Link
          data-testid="holidays-next"
          to={`/holidays/${shiftYear(anchorYear, 1)}`}
          className="text-sm underline"
        >
          Next
        </Link>
      </header>

      {/* MIR-15-e AC-2. Exactly where the Add form sits for a writing admin, so an Org public
          admin sees this line in the place they would look for the control they do not have. */}
      {me !== null && mayAdminister(me.role) && orgShared === "yes" ? (
        <p data-testid="holidays-set-by-system" className="text-sm opacity-70">
          Org public&rsquo;s holiday calendar is set by a system admin.
        </p>
      ) : null}

      {/* ADM-03 AC-1, AC-2, AC-3, AC-5. Above the list, because adding is what an admin comes here
          to do and the list is what they check afterwards. `kind` opens on `non_working`, which is
          the column's own default — a form whose default disagreed with the datastore's would make
          the two disagree about a row nobody edited. */}
      {mayWrite ? (
        <HolidayForm
          testIdPrefix="holiday-add"
          submitLabel="Add to the calendar"
          submittingLabel="Adding…"
          initial={{ date: "", name: "", kind: "non_working" }}
          afterSubmit="clear"
          onSubmit={onAdd}
        />
      ) : null}

      {/* AC-4. Without this the row is saved and then invisible, which is indistinguishable from a
          save that failed. It NAMES the year and offers the way there, rather than saying the add
          worked and leaving the person to find it. */}
      {addedElsewhere ? (
        <p data-testid="holidays-added-elsewhere" role="status" className="text-sm">
          That day was added to {addedElsewhere}, which is not the year on screen.{" "}
          <Link to={`/holidays/${addedElsewhere}`} className="underline">
            Go to {addedElsewhere}
          </Link>
        </p>
      ) : null}

      {holidays.length > 0 ? (
        /* AC-1, AC-2, AC-3, AC-4. Ascending by date, and the order is fixed in BOTH seam
           implementations rather than here — `tests/seam-parity.test.ts` compares names and arity
           and not row order, so a sort in this file would hide a divergence between them rather than
           prevent one. Nothing below re-sorts. */
        <ol data-testid="holidays-list" className="flex flex-col gap-2">
          {holidays.map((holiday) => (
            <li
              key={holiday.id}
              data-testid="holidays-row"
              data-date={holiday.date}
              // AC-3. The ATTRIBUTE is what the criterion turns on, not the colour and not the copy:
              // it keeps AC-3 true when the palette is finally written into
              // .ai/standards/ui-design-system.md, and it lets a test assert the EFFECT rather than
              // parse a sentence.
              data-kind={holiday.kind}
              className={[
                "flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl px-4 py-3 text-sm",
                // Lavender is the holiday colour (CLAUDE.md section Visual direction). The `working`
                // rows deliberately do not take it — they are the inverse of a holiday, and
                // colouring them as one is the exact confusion ADR-015 section 2 names.
                holiday.kind === "non_working" ? "bg-violet-100" : "bg-slate-100",
              ].join(" ")}
            >
              <span data-testid="holidays-row-date" className="font-medium tabular-nums">
                {holiday.date}
              </span>
              <span data-testid="holidays-row-name">{holiday.name}</span>
              {/* AC-3's second half, in WORDS. Colour alone is not readable to somebody who cannot
                  see it, and on this table the two kinds mean opposite things — so the effect is
                  spelled out on every row rather than inferred from a swatch. */}
              <span data-testid="holidays-row-effect" className="ml-auto text-xs opacity-70">
                {EFFECT_LABEL[holiday.kind]}
              </span>

              {/* ADM-03 AC-8, AC-9, AC-11, AC-12. The two controls, and then the two things one of
                  them can open. All four are inside the row they act on, which is what makes the
                  inline arrangement worth having: the neighbouring dates stay visible, and a swap
                  day is only comprehensible beside the holiday it compensates (01-plan.md section
                  8). */}
              {mayWrite && editingId !== holiday.id && pendingId !== holiday.id ? (
                <span className="flex w-full gap-2">
                  <button
                    data-testid="holidays-row-edit"
                    type="button"
                    onClick={() => {
                      setPendingId(null);
                      setDeleteError(null);
                      setAddedElsewhere(null);
                      setEditingId(holiday.id);
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    data-testid="holidays-row-delete"
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setDeleteError(null);
                      setAddedElsewhere(null);
                      setPendingId(holiday.id);
                    }}
                    className="rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-700"
                  >
                    Delete
                  </button>
                </span>
              ) : null}

              {/* AC-9. It opens carrying THIS ROW'S values — `initial` is the stored row and not a
                  set of defaults, so an edit that changes one field leaves the other two as they
                  were rather than blanking them. */}
              {mayWrite && editingId === holiday.id ? (
                <span className="w-full">
                  <HolidayForm
                    testIdPrefix="holiday-edit"
                    submitLabel="Save this day"
                    submittingLabel="Saving…"
                    initial={{ date: holiday.date, name: holiday.name, kind: holiday.kind }}
                    afterSubmit="keep"
                    onSubmit={(values) => onEdit(holiday.id, values)}
                    onCancel={() => setEditingId(null)}
                  />
                </span>
              ) : null}

              {/* AC-11 and AC-12. `.ai/standards/ui-design-system.md`, Destructive actions: the
                  confirmation NAMES what is about to be lost, and "Are you sure?" names nothing. It
                  names BOTH the date and the label, because on this table either alone is
                  ambiguous — the date without the name does not say which observance is going, and
                  the name without the date does not say which year's row. Deleting is hard and
                  there is no trash (01-plan.md section 8). */}
              {mayWrite && pendingId === holiday.id ? (
                <span
                  data-testid="holidays-row-delete-confirm"
                  role="alertdialog"
                  aria-label="Confirm removing this day"
                  className="w-full rounded-xl bg-rose-50 p-3"
                >
                  <span className="block text-sm">
                    Remove <strong>{holiday.date}</strong>, <strong>{holiday.name}</strong>, from the
                    calendar? This cannot be undone.
                  </span>

                  {deleteError ? (
                    <span role="alert" className="mt-2 block text-sm text-rose-600">
                      {deleteError.message}
                    </span>
                  ) : null}

                  <span className="mt-3 flex gap-2">
                    <button
                      data-testid="holidays-row-delete-confirm-accept"
                      type="button"
                      disabled={deleting}
                      onClick={() => void onConfirmDelete(holiday.id)}
                      className="rounded-lg bg-rose-600 px-3 py-1 text-xs text-white disabled:opacity-40"
                    >
                      {deleting ? "Removing…" : "Remove this day"}
                    </button>
                    <button
                      data-testid="holidays-row-delete-confirm-cancel"
                      type="button"
                      disabled={deleting}
                      onClick={() => {
                        setDeleteError(null);
                        setPendingId(null);
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </span>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        /* AC-10. A SENTENCE ABOUT THE CALENDAR, NEVER ABOUT THE YEAR. "No holidays in 2031" is the
           shorter sentence and it is false in a way the product would be stating with confidence: a
           Vietnamese year with no public holidays does not exist, so the only thing an empty year can
           mean is that the calendar has run out. Being under-seeded is silent in every other place it
           could show up, and this notice is what makes it loud in the one place a person looks. */
        <p data-testid="holidays-beyond-calendar" className="text-sm opacity-70">
          The calendar does not go as far as {anchorYear} yet. That is the calendar running out
          rather than a year without holidays — ask an admin to add them.
        </p>
      )}

      {/* UIE-03 AC-4. **The back-link that stood here is deleted and NOT replaced** — AC-5 is why
          its id is not written out. It pointed at `/`, which UIE-02 made the current week rather
          than a home screen, and the sidebar already carries every destination it offered.

          **`holidays-prev`, `holidays-year` and `holidays-next` above are kept, deliberately.**
          `periodNavFor` returns `null` for `/holidays`, so the top bar draws no period cluster on
          this screen — there is no duplication here to remove, and deleting these three would leave
          an admin no way to change year. That is a functional regression rather than a restyle, and
          teaching `period.ts` a fourth period kind is an addition that belongs to another ticket
          (01-plan.md § 1 item 3, § 8 alternative 2, and *Open questions* 4). */}
    </section>
  );
}

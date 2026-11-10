// CAL-07 — the warning a person sees while choosing dates, before anything is saved.
// 01-plan.md sections 4.2 and 4.3.
//
// **IT IS AN AFFORDANCE AND IT REFUSES NOTHING** (charter refusal 6, and AC-9 to AC-15). It renders
// a block or it renders null; it holds no submit state, disables no control, sets no field invalid
// and adds no required field. The save control lives in EntryForm and this component cannot reach
// it — which is how AC-9, AC-10 and AC-12 are held by construction rather than by a test.
//
// **IT COMPUTES NO COUNT OF ITS OWN.** Every number here comes from `absenceCountsFor` and
// `isOverloaded` in @/lib/data/absence, INV-04's single implementation, which this ticket does not
// touch. The only new step is `withDraft`, which builds the ROWS — 01-plan.md section 4.2.
//
// **RECOMPUTING IS NOT REFETCHING.** The fetched rows are held and the count is derived from them
// synchronously on every draft change, so changing the portion or the tentative flag updates the
// warning with no request at all (AC-4, AC-8) and only a change of start or end date reaches the
// datastore.
//
// Colour, and where it comes from. `.ai/standards/ui-design-system.md` is a stub in its Colour, Type
// and Components sections, so the palette is cited to CLAUDE.md section Visual direction through the
// component that already implements it: `bg-rose-100` is the exact class
// src/routes/MonthView.tsx:381 gives a crowded cell, and the per-person markers are
// src/routes/MonthView.tsx:410-427. 01-plan.md Open question 2 records that this is REUSE rather
// than a warning-specific vocabulary, which is what the CAL-07 registry row required of any answer.
import { useEffect, useMemo, useRef, useState } from "react";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `./supabase` or `./mock` (RULE-02).
import { seam } from "@/lib/data";
import Avatar from "@/components/Avatar";
// INV-04's single implementation, imported DIRECTLY rather than through the seam — the same import
// MonthView.tsx makes, and for the reason CAL-04 01-plan.md section 5 records: neither seam
// implementation counts anything, so there is no second arithmetic for seam-parity to miss.
import {
  absenceCountsFor,
  absentEntriesFor,
  currentMemberCount,
  eachDateInRange,
  isOverloaded,
} from "@/lib/data/absence";
import { DRAFT_ENTRY_ID, isUsableRange, withDraft } from "@/lib/draft-entry";
import type {
  AbsenceDetail,
  Entry,
  EntryPortion,
  EntryType,
  Member,
  Team,
} from "@/lib/domain/types";

/**
 * How long the range has to stop changing before the entries read is issued.
 *
 * 300 ms, and 01-plan.md section 8 records the alternative: waiting for the person to "stop typing"
 * would be absent exactly on the fastest path to a save, because the native date picker fills both
 * fields in one interaction. This is the smaller version of the same idea and keeps AC-1 true.
 */
const DEBOUNCE_MS = 300;

export interface OverloadWarningProps {
  /** The draft's owner. NULL means "the caller", which this component resolves with
   *  `seam.getCurrentMember()`. The edit route passes the entry's `memberId` instead, so an admin
   *  editing somebody else's entry counts that member and not themselves (AC-18, INV-07). */
  ownerId: string | null;
  /** The saved row this draft replaces, or null when the draft is new. AC-17. */
  excludeEntryId: string | null;
  type: EntryType;
  portion: EntryPortion;
  startDate: string;
  endDate: string;
  tentative: boolean;
  /** The form's selector family - `new-entry`, `edit-entry` or `month-entry`. Every selector this
   *  component renders is this prefix plus a suffix, exactly as EntryForm's own are. */
  testIdPrefix: string;
}

/** What the three range-independent reads answer, held as one value because a warning drawn from two
 *  of the three would be a believable partial answer - the failure MonthView's `unavailable` state
 *  exists to refuse, one screen over. */
interface Base {
  team: Team;
  roster: Member[];
  /** Resolved: the prop when it is given, the caller's own member id when it is null. */
  ownerId: string;
}

/** One crowded date, ready to draw. */
interface CrowdedDay {
  date: string;
  count: number;
  currentMembers: number;
  people: readonly AbsenceDetail[];
}

export default function OverloadWarning({
  ownerId,
  excludeEntryId,
  type,
  portion,
  startDate,
  endDate,
  tentative,
  testIdPrefix,
}: OverloadWarningProps) {
  const [base, setBase] = useState<Base | null>(null);
  const [rows, setRows] = useState<Entry[] | null>(null);

  const usable = isUsableRange(startDate, endDate);

  // The three range-independent reads, once, on mount. The caller does not change while a form is
  // open, and neither the threshold nor the denominator depends on the dates being chosen.
  //
  // `listMembers()` returns REMOVED members carrying `removedAt`, which is what `absenceCountsFor`
  // needs to decide each date under ADR-013; a pre-filtered roster would make INV-04 uncomputable.
  //
  // A null team, a null caller or a throw leaves `base` null and NOTHING is ever drawn (AC-21). No
  // message, no placeholder: a warning is the only thing this component says, and it has nothing to
  // say about a read it did not get.
  useEffect(() => {
    let live = true;

    void (async () => {
      try {
        const [team, roster, me] = await Promise.all([
          seam.getTeam(),
          seam.listMembers(),
          // Only when the owner was not given. AC-18's whole mechanism is that the edit route names
          // the entry's member, and asking who the caller is would then be a read with no consumer.
          ownerId === null ? seam.getCurrentMember() : Promise.resolve(null),
        ]);

        const owner = ownerId ?? me?.id ?? null;
        if (!live) return;
        setBase(team && owner !== null ? { team, roster, ownerId: owner } : null);
      } catch {
        if (live) setBase(null);
      }
    })();

    return () => {
      live = false;
    };
  }, [ownerId]);

  // AC-19. Every request carries a number, and an answer whose number is not the latest is discarded
  // without touching state. The cleanup bumps it too, so a range that changes while a read is in
  // flight invalidates that read even though the request itself is not cancelled.
  //
  // 01-plan.md section 4.4 and section 8 record why it is not cancelled: a transport-level abort
  // needs an `AbortSignal` parameter on `listTeamEntriesOverlapping`, and a change to the signature
  // of an existing seam function is XL and escalates (.ai/01-operating-model.md:375). The observable
  // requirement is that a stale answer never PAINTS, which this delivers.
  const request = useRef(0);

  useEffect(() => {
    const id = (request.current += 1);

    // Whatever is held describes a range the person has left. AC-19: what is on screen always
    // describes the dates currently in the form, so the old answer goes before the new one is asked
    // for, and nothing is drawn in between.
    setRows(null);

    // AC-20. An incomplete or inverted range asks the datastore nothing.
    if (!usable) return;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const fetched = await seam.listTeamEntriesOverlapping({ start: startDate, end: endDate });
          if (request.current === id) setRows(fetched);
        } catch {
          // AC-21. A transport failure and the seam's truncation refusal land here, and both mean
          // the same thing: no warning, and nothing on the form suggesting the day is safe.
          if (request.current === id) setRows(null);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      request.current += 1;
      clearTimeout(timer);
    };
  }, [usable, startDate, endDate]);

  // The composition, in order, and every step but the first is CAL-04's (01-plan.md section 4.2).
  const crowded = useMemo<readonly CrowdedDay[]>(() => {
    if (!base || rows === null || !usable) return [];

    const range = { start: startDate, end: endDate };
    const withIt = withDraft(
      rows,
      { memberId: base.ownerId, type, portion, startDate, endDate, tentative },
      excludeEntryId,
    );

    const counts = absenceCountsFor(withIt, range, base.roster);
    const details = absentEntriesFor(withIt, range, base.roster);
    const active = currentMemberCount(base.roster);

    return eachDateInRange(range)
      .filter((date) => isOverloaded(counts.get(date) ?? 0, active, base.team.overloadThreshold))
      .map((date) => ({
        date,
        count: counts.get(date) ?? 0,
        currentMembers: active,
        people: details.get(date) ?? [],
      }));
  }, [base, rows, usable, startDate, endDate, type, portion, tentative, excludeEntryId]);

  // AC-1's other half, AC-12's structural half, AC-20 and AC-21 all end here: while the reads are in
  // flight, on a failed read, on an unusable range and on an uncrowded one, this renders NOTHING. No
  // spinner and no placeholder - a spinner beside a save button reads as "wait", which is the thing
  // AC-12 forbids.
  if (crowded.length === 0) return null;

  return (
    <div
      data-testid={`${testIdPrefix}-overload`}
      // `status` and never `alert`. AC-11: `alert` is the form's error channel and `<prefix>-error`
      // already holds it. A warning announced as an error is the soft block the charter refuses,
      // delivered by an ARIA attribute.
      role="status"
      aria-live="polite"
      // The soft pink CLAUDE.md section Visual direction reserves for a crowded day, and describes
      // as deliberately not an alarming red. The form's error stays `text-rose-600`, so the two
      // remain visibly different things.
      className="flex flex-col gap-2 rounded-xl bg-rose-100 p-3 text-sm"
    >
      {crowded.map((day) => (
        <div
          key={day.date}
          data-testid={`${testIdPrefix}-overload-day`}
          data-date={day.date}
          data-count={day.count}
          data-current-members={day.currentMembers}
          className="flex flex-col gap-1"
        >
          {/* The count the day WILL have, and the team size (AC-2). NOT the configured share: a
              warning that displayed the threshold would be ADM-01's surface leaking into this one
              (01-plan.md section 1), and these two numbers are the ones a person can act on. */}
          <span className="font-medium">
            {day.date} &mdash; {day.count} of {day.currentMembers} people away
          </span>

          {/* AC-7. Everyone the count includes, INCLUDING the person drafting - the numbers and the
              names would otherwise disagree. Each is drawn with the month grid's vocabulary. */}
          <div className="flex flex-wrap gap-1">
            {day.people.map(({ entry, member }) => (
              <span
                key={entry.id}
                data-testid={`${testIdPrefix}-overload-person`}
                data-member-id={member.id}
                data-type={entry.type}
                data-status={entry.status}
                data-tentative={entry.tentative}
                data-draft={entry.id === DRAFT_ENTRY_ID}
                title={member.displayName}
                className={[
                  "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5",
                  // PTO peach, WFH mint. A WFH member IS working - glossary.md calls that the single
                  // most costly confusion in the domain - so the two are different colours even
                  // though they weigh the same in the count.
                  entry.type === "wfh" ? "bg-emerald-100" : "bg-orange-100",
                  // Tentative is a dashed border at reduced opacity, so that "counts" and "is
                  // settled" stay visually separate: a tentative entry is counted like any other
                  // (INV-05, AC-8) and drawn so nobody reads the count as certainty.
                  entry.tentative ? "border border-dashed border-current opacity-60" : "",
                ].join(" ")}
              >
                <Avatar value={member.avatar} className="h-4 w-4" />
                {member.displayName}
                {entry.status === "approved" ? <span aria-hidden="true">&#9733;</span> : null}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

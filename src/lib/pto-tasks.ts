// TSK-03 — which tasks a PTO draft covers, and which PTO covers a day. 01-plan.md § 4.1.
//
// Pure: no React, no seam, no clock. The warning in the entry form and the flag on the task page
// both reduce to these three functions, so the rules they share — "open" means not done, "PTO" means
// pending or approved — are decided once.
import type { Entry, EntryPortion, Task } from "@/lib/domain/types";

/** AC-1, AC-2. The tasks in `tasks` that are not done and whose date is in `dates`, ordered by date,
 *  then by `createdAt`, then by `id`. Pure; does not mutate its input.
 *
 *  `dates` is every chosen day, NOT the outer bounds — a day inside the gap of a gapped selection is
 *  not chosen, and a task on it is not at risk from this entry. */
export function openTasksOnDays(tasks: readonly Task[], dates: readonly string[]): Task[] {
  const chosen = new Set(dates);
  return tasks
    .filter((t) => !t.done && chosen.has(t.date))
    .sort(
      (a, b) =>
        compare(a.date, b.date) || compare(a.createdAt, b.createdAt) || compare(a.id, b.id),
    );
}

/** AC-10, AC-11. The first entry in `entries` with memberId === `memberId`, type "pto", status
 *  "pending" or "approved", and startDate <= `day` <= endDate; null when none. When several match,
 *  the one with the earliest startDate, then the smallest id.
 *
 *  Pending and approved are the two statuses INV-04 counts as an absence; a rejected entry is not a
 *  plan to be away (01-plan.md § 1, reading 3). */
export function ptoCovering(entries: readonly Entry[], memberId: string, day: string): Entry | null {
  let best: Entry | null = null;
  for (const e of entries) {
    if (e.memberId !== memberId || e.type !== "pto") continue;
    if (e.status !== "pending" && e.status !== "approved") continue;
    if (e.startDate > day || e.endDate < day) continue;
    if (best === null || compare(e.startDate, best.startDate) < 0) best = e;
    else if (e.startDate === best.startDate && compare(e.id, best.id) < 0) best = e;
  }
  return best;
}

/** AC-10. The flag's text after "On PTO": " · morning" for "am", " · afternoon" for "pm", "" for
 *  "full"; then " · tentative" when `tentative`; then " · 1 open task" / " · N open tasks" when
 *  openCount > 0. */
export function ptoFlagSuffix(portion: EntryPortion, tentative: boolean, openCount: number): string {
  let suffix = portion === "am" ? " · morning" : portion === "pm" ? " · afternoon" : "";
  if (tentative) suffix += " · tentative";
  if (openCount > 0) suffix += ` · ${openCount} open ${openCount === 1 ? "task" : "tasks"}`;
  return suffix;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

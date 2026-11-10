// TSK-03 — the member's own open tasks on the days a PTO draft covers. 01-plan.md § 4.2.
//
// A NOTICE, NEVER A GATE (charter refusal 6, AC-5). `role="status"` and not `alert`, and this
// component is given nothing that reaches the form's submit control — the same construction that
// holds CAL-07's AC-9 in `OverloadWarning`.
//
// OWNER ONLY (ADR-057). `listTasks` takes no member and the policy answers the caller's own rows, so
// on another member's entry the read would return the VIEWER's tasks: a wrong warning, not a leak.
// The owner check below prevents the wrong warning; `task_select_own` prevents the leak (§ 3).
//
// Separate from `OverloadWarning` on purpose (§ 8, rejected alternative 1): that component is per run
// and computes INV-04 from team rows; this one is per selection and private.
import { useEffect, useRef, useState, type JSX } from "react";
import { format, parseISO } from "date-fns";
import { ListChecks } from "lucide-react";
import { seam } from "@/lib/data";
import type { EntryType, Task } from "@/lib/domain/types";
import { openTasksOnDays } from "@/lib/pto-tasks";

/** How long the chosen days have to stop changing before the tasks read is issued. AC-1; the same
 *  value and reasoning as `OverloadWarning`'s. */
const DEBOUNCE_MS = 300;

export interface PtoTaskWarningProps {
  /** The entry's owner, or null for the caller — EntryForm's own `ownerId`, passed through. */
  ownerId: string | null;
  type: EntryType;
  /** Every chosen day, sorted — EntryForm's `dates`, NOT one run (AC-2: a gapped selection's gap is
   *  not chosen). */
  dates: readonly string[];
  /** EntryForm's prefix: `new-entry`, `edit-entry` or `month-entry`. */
  testIdPrefix: string;
}

export default function PtoTaskWarning({
  ownerId,
  type,
  dates,
  testIdPrefix,
}: PtoTaskWarningProps): JSX.Element | null {
  // null while unresolved, and for good when the entry is not the viewer's or the check failed
  // (AC-6, AC-8). Only `true` ever issues a tasks read.
  const [own, setOwn] = useState<boolean | null>(ownerId === null ? true : null);
  // The tasks last read, with the chosen days they were read for. Held across a type switch (AC-3).
  const [fetched, setFetched] = useState<{ key: string; tasks: Task[] } | null>(null);

  useEffect(() => {
    if (ownerId === null) {
      setOwn(true);
      return;
    }
    let live = true;
    setOwn(null);
    void (async () => {
      try {
        const me = await seam.getCurrentMember();
        if (live) setOwn(me !== null && me.id === ownerId);
      } catch {
        if (live) setOwn(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [ownerId]);

  // `dates` arrives as a fresh array on renders that did not change it; key the read on its content.
  const key = dates.join(",");
  const first = dates[0];
  const last = dates[dates.length - 1];
  const isPto = type === "pto";
  const request = useRef(0);

  useEffect(() => {
    // AC-3. Switching to WFH neither clears nor refetches: what was read is held and the render
    // below returns null. Switching back to PTO on the same days reuses it.
    if (own !== true || !isPto || first === undefined || last === undefined) return;
    if (fetched !== null && fetched.key === key) return;

    const id = (request.current += 1);

    // AC-9. What is held describes other days; it is cleared before the new read.
    setFetched(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const tasks = await seam.listTasks(first, last);
          if (request.current === id) setFetched({ key, tasks });
        } catch {
          // AC-8. A failed read shows nothing and changes nothing else.
          if (request.current === id) setFetched(null);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      request.current += 1;
      clearTimeout(timer);
    };
  }, [own, isPto, key, first, last, fetched]);

  // AC-9. Only tasks read for exactly the days now chosen are ever painted.
  if (own !== true || !isPto || fetched === null || fetched.key !== key) return null;

  const open = openTasksOnDays(fetched.tasks, dates);
  if (open.length === 0) return null;

  return (
    <div
      data-testid={`${testIdPrefix}-task-warning`}
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2 rounded-xl bg-pto/40 p-3 text-sm"
    >
      <p className="flex items-center gap-1.5 font-bold text-ink">
        <ListChecks aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>
          You have <span data-testid={`${testIdPrefix}-task-warning-count`}>{open.length}</span> open{" "}
          {open.length === 1 ? "task" : "tasks"} on these days
        </span>
      </p>

      {/* Past five rows the list scrolls inside the block, so a long PTO never pushes the save
          control off a phone screen (§ 2b). */}
      <ul className="flex max-h-[8.5rem] flex-col gap-1 overflow-y-auto">
        {open.map((task) => (
          <li
            key={task.id}
            data-testid={`${testIdPrefix}-task-warning-task`}
            data-task-id={task.id}
            data-date={task.date}
            className="flex min-w-0 items-baseline gap-2"
          >
            <span
              data-testid={`${testIdPrefix}-task-warning-date-chip`}
              className="shrink-0 text-xs text-ink-2"
            >
              {format(parseISO(task.date), "EEE d MMM")}
            </span>
            <span data-testid={`${testIdPrefix}-task-warning-title`} className="min-w-0 truncate">
              {task.title}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-ink-2">
        Saving is not blocked. Move them on your task page if you need to.
      </p>
    </div>
  );
}

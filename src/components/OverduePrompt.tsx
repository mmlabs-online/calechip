// TSK-02 — the prompt shown at each opening while any of the member's own tasks is overdue.
// 01-plan.md §§ 2b, 4.2.
//
// **ONLY THE OPENER'S OWN TASKS, AND THIS FILE IS NOT WHAT MAKES IT SO.** `listOverdueTasks` takes no
// member and the policies on `public.task` are owner-only (ADR-057); `memberId` is the once-per-opening
// gate's key and never a read parameter. No `useViewedTeam`, no member read, no `listTasks` (AC-11).
//
// **IT NEVER BLOCKS** (AC-4). Close, Escape and the backdrop all dismiss it, and closing changes no
// task. It comes back at the next opening while anything is still overdue (AC-3, Q9-B).
//
// **THE TICK IS `/tasks`' OPTIMISTIC TICK**, `src/lib/task-tick.ts` unchanged (AC-5, AC-6). A ticked
// row stays in place, shown done, until the prompt closes.
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { format, parseISO } from "date-fns";
import { seam } from "@/lib/data";
import type { Task } from "@/lib/domain/types";
import { eventToday } from "@/lib/event-registration";
import { claimOverduePrompt, moveAllToToday } from "@/lib/overdue-prompt";
import { applyOutcome, createTaskTicker, type TaskTicker, type TickOutcome } from "@/lib/task-tick";
import Modal from "./Modal";
import { PILL_OUTLINE } from "./TopBar";

const PRIMARY =
  "rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 " +
  "disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** § 2b. The row's chip, *Mon 12 Oct* — the same label `/tasks`' overdue section draws. */
const chipLabel = (day: string): string => format(parseISO(day), "EEE d MMM");

/** `record` without `key`; the same object when the key is absent, so React skips the render. */
function withoutKey(record: Record<string, string>, key: string): Record<string, string> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

export interface OverduePromptProps {
  /** The signed-in member's id, from the shell — the gate's key, never a read parameter. */
  memberId: string;
  /** AC-10. Called once when the prompt closes, if any tick or move in it was saved. */
  onTasksChanged(): void;
}

export default function OverduePrompt({ memberId, onTasksChanged }: OverduePromptProps): JSX.Element | null {
  const [open, setOpen] = useState(false);
  /** The rows as the server last gave them; `ticker.shown` lays the presses over them. */
  const [list, setList] = useState<Task[]>([]);
  /** AC-6, AC-8. Each row's last failure, by task id. */
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [moving, setMoving] = useState(false);
  const [, setRenders] = useState(0);

  /** "Today" is read once, at the opening, and kept for the prompt's life (§ 4.2). */
  const todayRef = useRef("");
  /** AC-10. Whether a tick or a move in the prompt has been saved since it opened. */
  const changedRef = useRef(false);
  /** Whether the prompt has been closed — a tick saved after this reports straight to the shell. */
  const closedRef = useRef(false);
  const onTasksChangedRef = useRef(onTasksChanged);
  onTasksChangedRef.current = onTasksChanged;

  // One ticker for the component's lifetime; every callback it holds is a stable setter or a ref.
  const tickerRef = useRef<TaskTicker | null>(null);
  if (tickerRef.current === null) {
    tickerRef.current = createTaskTicker(
      (id, done) => seam.setTaskDone(id, done),
      () => setRenders((n) => n + 1),
      (outcome: TickOutcome) => {
        setList((l) => applyOutcome(l, outcome));
        if (outcome.kind === "saved") {
          const savedId = outcome.task.id;
          setRowErrors((e) => withoutKey(e, savedId));
          // A tick still in flight when the prompt closed: the shell hears of it when it lands.
          if (closedRef.current) onTasksChangedRef.current();
          else changedRef.current = true;
        } else if (outcome.kind === "failed") {
          setRowErrors((e) => ({ ...e, [outcome.taskId]: outcome.failure.message }));
        }
      },
    );
  }
  const ticker = tickerRef.current;

  // AC-1, AC-2, AC-12. The read is NOT discarded on cleanup: under StrictMode the second run's claim
  // is false, so a first run that ignored its own answer would show nothing, ever (§ 4.2).
  useEffect(() => {
    if (!claimOverduePrompt(memberId)) return;
    const today = eventToday();
    todayRef.current = today;
    seam.listOverdueTasks(today).then(
      (overdue) => {
        if (overdue.length === 0) return;
        setList(overdue);
        setOpen(true);
      },
      (error: unknown) => {
        console.error("TSK-02: the overdue read failed at opening", error);
      },
    );
  }, [memberId]);

  const close = useCallback((): void => {
    setOpen(false);
    closedRef.current = true;
    if (changedRef.current) {
      changedRef.current = false;
      onTasksChangedRef.current();
    }
  }, []);

  if (!open) return null;

  const notDone = list.filter((t) => !ticker.shown(t).done);
  const count = notDone.length;

  /** AC-5, AC-6. `task` is the row as the server last gave it, not as shown. */
  const tick = (task: Task): void => {
    setRowErrors((e) => withoutKey(e, task.id));
    ticker.tap(task);
  };

  /** AC-7, AC-8. Only the rows shown not done at the moment of the press. */
  const moveAll = async (): Promise<void> => {
    const targets = notDone;
    setMoving(true);
    setRowErrors((e) => targets.reduce((acc, t) => withoutKey(acc, t.id), e));
    const { moved, failed } = await moveAllToToday(targets, todayRef.current, (id, date) =>
      seam.moveTask(id, date),
    );
    setMoving(false);
    if (moved.length > 0) {
      changedRef.current = true;
      const movedIds = new Set(moved.map((t) => t.id));
      setList((l) => l.filter((t) => !movedIds.has(t.id)));
    }
    if (failed.length === 0) {
      close();
      return;
    }
    setRowErrors((e) => {
      const next = { ...e };
      for (const f of failed) next[f.taskId] = f.failure.message;
      return next;
    });
  };

  return (
    <Modal testIdPrefix="overdue-prompt" label="Overdue tasks" onClose={close}>
      <div data-testid="overdue-prompt" className="flex min-h-0 flex-col gap-4">
        <header className="flex flex-col gap-2 pr-10">
          {/* § 2b. The soft-pink pill: needs attention, not alarm. */}
          <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-overload text-ink" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4l1.5 1.5L6 3M2 10l1.5 1.5L6 9M8.5 4.5H14M8.5 10.5H14" />
            </svg>
          </span>
          <h1 className="text-lg font-extrabold text-ink">
            You have <span data-testid="overdue-prompt-count">{count}</span>{" "}
            {count === 1 ? "overdue task" : "overdue tasks"}
          </h1>
          <p className="text-sm text-ink-2">Tick what you finished, or bring the rest to today.</p>
        </header>

        <ul className="max-h-72 overflow-y-auto">
          {list.map((original) => {
            const task = ticker.shown(original);
            const error = rowErrors[task.id];
            return (
              <li
                key={task.id}
                data-testid="overdue-prompt-row"
                data-task-id={task.id}
                data-date={task.date}
                data-done={task.done ? "true" : "false"}
                className="flex flex-col gap-1 border-b border-line py-2 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {/* AC-5. Never disabled, so a second press acts at once (TSK-05 AC-1). */}
                  <button
                    data-testid="overdue-prompt-done"
                    type="button"
                    role="checkbox"
                    aria-checked={task.done}
                    aria-label={task.done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
                    onClick={() => tick(original)}
                    className={
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border-2 transition-colors " +
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
                      (task.done ? "border-wfh bg-wfh text-wfh-ink" : "border-line bg-card hover:border-ink-3")
                    }
                  >
                    {task.done ? (
                      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3.5 8.5l3 3 6-7" />
                      </svg>
                    ) : null}
                  </button>
                  {/* AC-1. A date and nothing finer. */}
                  <span data-testid="overdue-prompt-date-chip" className="shrink-0 text-[11px] font-bold text-ink-3">
                    {chipLabel(task.date)}
                  </span>
                  <span
                    data-testid="overdue-prompt-title"
                    className={`min-w-0 truncate text-sm font-bold ${task.done ? "text-ink-3 line-through" : "text-ink"}`}
                  >
                    {task.title}
                  </span>
                </div>
                {error ? (
                  <p data-testid="overdue-prompt-row-error" role="alert" className="pl-8 text-xs text-danger">
                    {error}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-2 sm:flex-row">
          {/* AC-9. Disabled is an affordance: nothing to move, or a move already running. */}
          <button
            data-testid="overdue-prompt-move-all"
            type="button"
            disabled={count === 0 || moving}
            onClick={() => void moveAll()}
            className={PRIMARY}
          >
            Move all to today
          </button>
          <button data-testid="overdue-prompt-dismiss" type="button" onClick={close} className={PILL_OUTLINE}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

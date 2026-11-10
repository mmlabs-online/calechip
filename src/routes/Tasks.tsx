// TSK-01 — a member's own tasks for one day. 01-plan.md §§ 2b, 4.6 and 4.7. ADR-057.
// TSK-06 — the week around the viewed day, with progress, and an optional time of day. Its
// 01-plan.md §§ 2b and 4.7. ADR-062.
//
// **EVERYTHING ON THIS PAGE IS THE CALLER'S OWN, AND THE PAGE IS NOT WHAT MAKES IT SO.** The four
// policies on `public.task` are the control; the seam has no parameter that names a member, so this
// screen cannot even ask for anyone else's list. Every refusal drawn here — the hidden add form on a
// past day, the date field's minimum, the field messages — is an affordance.
//
// **"TODAY" IS `eventToday()`, Asia/Ho_Chi_Minh** (01-plan.md § 1 decision 1), read ONCE per render
// and handed to the overdue read, so the screen and the read agree on one instant.
//
// **ONE TIME IS SHOWN, A TASK'S OPTIONAL TIME OF DAY** (TSK-06 AC-17, ADR-062), and it drives
// nothing on this page but its own display and the day's order, which the seam applies (AC-8). *Until
// TSK-06: "NO TIME OF ANY KIND IS SHOWN (AC-20)".*
//
// **ONE READ FOR THE LIST, THE STRIP AND THE SUMMARY** (TSK-06 § 4.7): the week, Monday to Sunday,
// holding the viewed day; the day's list is that read filtered to the day, in the seam's order. Every
// count — the strip's marks, the day's progress, the summary — is of the tasks as SHOWN, so a tick
// moves them at once, and none of them is an absence count.
//
// **THE TICK IS OPTIMISTIC** (TSK-05, its 01-plan.md § 4.2). A press shows at once and writes behind
// it through `src/lib/task-tick.ts`; it never disables the box, never reloads a list, and a refusal
// puts the row back. Edit, move, add and delete keep the write-then-reload flow below unchanged.
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { addDays, format, parseISO } from "date-fns";
import { seam } from "@/lib/data";
import type { Entry, Failure, Result, Task } from "@/lib/domain/types";
import { eventToday } from "@/lib/event-registration";
import { ptoCovering, ptoFlagSuffix } from "@/lib/pto-tasks";
import { applyOutcome, createTaskTicker, type TaskTicker, type TickOutcome } from "@/lib/task-tick";
import { weekLabel } from "@/lib/period";
import {
  stripCellLabel,
  stripMark,
  taskTalliesFor,
  weekDaysOf,
  weekTotals,
  type DayTaskTally,
} from "@/lib/week-tasks";
import { ArrowRight, Clock, Pencil, Plus, Sun, Trash2 } from "lucide-react";
import Loader from "@/components/Loader";
import Modal from "@/components/Modal";
import { PILL_OUTLINE } from "@/components/TopBar";
import { useShellContext } from "@/components/AppShell";

// TopBar's `ICON_BUTTON`, repeated as NotificationBell repeats it: the same 32-pixel round arrows the
// period navigation uses (§ 2b).
const ICON_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-pill text-lg leading-none text-ink-2 " +
  "transition-colors hover:bg-field hover:text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const PRIMARY =
  "rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 " +
  "disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const FIELD =
  "w-full rounded-xl bg-field px-3 py-2 text-sm text-ink placeholder:text-ink-3 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** TSK-06 § 2b. The add form's inputs: white and rounded on the form's `field`-tinted panel. */
const PANEL_FIELD =
  "w-full rounded-pill bg-card px-4 py-2 text-sm text-ink placeholder:text-ink-3 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** The add form's time field: a compact pill, so it fits beside Add in the week view's dialog too. */
const PANEL_TIME =
  "w-auto shrink-0 rounded-pill bg-card px-2.5 py-1 text-xs tabular-nums text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** TSK-06 AC-18. A row action: a 28-pixel round icon button. `peer` drives its tooltip. */
const ROW_ACTION =
  "peer flex h-7 w-7 items-center justify-center rounded-pill text-ink-3 transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** TSK-06 § 2b. The strip, the day card and the summary are three cards on the page's background. */
const CARD = "rounded-card bg-card p-4 shadow-soft sm:p-5";

const LOAD_FAILED = "Your tasks could not be loaded. Please try again.";

/** AC-3. A `yyyy-MM-dd` that names a real calendar day — `2026-02-30` does not. */
function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const shiftDay = (day: string, by: number): string => format(addDays(parseISO(day), by), "yyyy-MM-dd");

/** § 2b. *Thursday, 15 October 2026*. Exported for the week view's task dialog. */
export const headingLabel = (day: string): string => format(parseISO(day), "EEEE, d MMMM yyyy");

/** § 2b. The overdue row's chip, *Mon 12 Oct*. */
const chipLabel = (day: string): string => format(parseISO(day), "EEE d MMM");

/** TSK-06 AC-11. A strip cell's weekday, *Mon* … *Sun*. */
const weekdayAbbr = (day: string): string => format(parseISO(day), "EEE");

type Field = "title" | "note" | "time" | "date";

/** Which field a refusal belongs beside (AC-8, AC-11); null is a message for the row as a whole. */
function fieldOf(failure: Failure): Field | null {
  switch (failure.code) {
    case "invalid_task_title":
      return "title";
    case "invalid_task_note":
      return "note";
    case "invalid_task_time":
      return "time";
    case "task_date_past":
      return "date";
    default:
      return null;
  }
}

interface Errors {
  title?: string;
  note?: string;
  time?: string;
  date?: string;
  general?: string;
}

const errorsOf = (failure: Failure): Errors => {
  const field = fieldOf(failure);
  return field ? { [field]: failure.message } : { general: failure.message };
};

function FieldError({ field, message }: { field: Field; message: string | undefined }): JSX.Element | null {
  if (!message) return null;
  return (
    <p data-testid="task-field-error" data-field={field} role="alert" className="text-xs text-danger">
      {message}
    </p>
  );
}

function GeneralError({ message }: { message: string | undefined }): JSX.Element | null {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-danger">
      {message}
    </p>
  );
}

/** TSK-06 AC-16, AC-21. A rounded bar filled to done ÷ total, mint on the `field` track, with the
 *  text `done/total` at its right. An empty bar at 0/0. Exported for the week view's task dialog. */
export function ProgressBar({ tally }: { tally: DayTaskTally }): JSX.Element {
  const ratio = tally.total === 0 ? 0 : tally.done / tally.total;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-pill bg-field">
        <div className="h-full rounded-pill bg-wfh transition-[width]" style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="shrink-0 text-xs font-bold tabular-nums text-ink-2">
        {tally.done}/{tally.total}
      </span>
    </div>
  );
}

/** TSK-06 AC-4, AC-19. The browser's own time field (§ 1 decision 7): its value is `HH:MM`, or "". */
function TimeInput({
  testId,
  value,
  onChange,
  className,
}: {
  testId: string;
  value: string;
  onChange(value: string): void;
  className: string;
}): JSX.Element {
  return (
    <input
      data-testid={testId}
      type="time"
      step={60}
      aria-label="Time (optional)"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  );
}

/** TSK-06 AC-18, § 2b. A small `ink` label under the button, on hover and on `focus-visible`; the
 *  button's `aria-label` carries the same text, so the label is `aria-hidden`. */
function RowAction({
  testId,
  label,
  onClick,
  hoverClass,
  children,
}: {
  testId: string;
  label: string;
  onClick(): void;
  hoverClass: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <span className="relative flex">
      <button data-testid={testId} type="button" aria-label={label} onClick={onClick} className={`${ROW_ACTION} ${hoverClass}`}>
        {children}
      </button>
      <span
        aria-hidden="true"
        className={
          "pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-ink px-2 py-1 " +
          "text-xs text-white opacity-0 transition-opacity peer-hover:opacity-100 peer-focus-visible:opacity-100"
        }
      >
        {label}
      </span>
    </span>
  );
}

/** TSK-06 AC-1, AC-17. `HH:MM`, a 12-pixel clock, tabular figures, grey. */
function TaskTime({ time }: { time: string }): JSX.Element {
  return (
    <span data-testid="task-time" data-time={time} className="inline-flex items-center gap-1 text-xs tabular-nums text-ink-3">
      <Clock aria-hidden="true" className="h-3 w-3" />
      {time}
    </span>
  );
}

// ---------------------------------------------------------------------------
// One row — view, edit and move. AC-9 to AC-12, in both lists.
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: Task;
  today: string;
  /** AC-13. The overdue section shows each task's date; the day's list does not need to. */
  showDate: boolean;
  onChanged(): Promise<void>;
  onDelete(task: Task): void;
  /** TSK-05 AC-1. The page's ticker flips the shown value and writes behind it. */
  onTick(): void;
  /** TSK-05 AC-3. The last tick's refusal, shown in the row's general message. */
  tickError: string | undefined;
  /** Whether the row offers "Move to a date". The week view's one-day dialog turns it off. */
  canMove?: boolean;
}

// Exported, with `AddTaskForm`, `ProgressBar` and `headingLabel`, for `TaskDayDialog`.
export function TaskRow({
  task,
  today,
  showDate,
  onChanged,
  onDelete,
  onTick,
  tickError,
  canMove = true,
}: TaskRowProps): JSX.Element {
  const [mode, setMode] = useState<"view" | "edit" | "move">("view");
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? "");
  const [time, setTime] = useState(task.timeOfDay ?? "");
  const [date, setDate] = useState(task.date);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const run = async (write: () => Promise<Result<Task>>): Promise<void> => {
    setBusy(true);
    const result = await write();
    setBusy(false);
    if (!result.ok) {
      setErrors(errorsOf(result.error));
      return;
    }
    setErrors({});
    setMode("view");
    await onChanged();
  };

  const startEdit = (): void => {
    setTitle(task.title);
    setNote(task.note ?? "");
    setTime(task.timeOfDay ?? "");
    setErrors({});
    setMode("edit");
  };

  // AC-11. The field opens on the day after the task's date, or on today when that is already past.
  const startMove = (): void => {
    const next = shiftDay(task.date, 1);
    setDate(next < today ? today : next);
    setErrors({});
    setMode("move");
  };

  const cancel = (): void => {
    setErrors({});
    setMode("view");
  };

  return (
    <li
      data-testid="task-row"
      data-task-id={task.id}
      data-date={task.date}
      data-done={task.done ? "true" : "false"}
      className={
        "group flex flex-col gap-2 rounded-xl border border-line px-3 py-2.5 transition-colors hover:border-ink-3 " +
        (task.done ? "bg-bg" : "bg-card")
      }
    >
      {mode === "edit" ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => seam.updateTask(task.id, { title, note, timeOfDay: time }));
          }}
        >
          <input
            data-testid="task-edit-title"
            aria-label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={FIELD}
          />
          <FieldError field="title" message={errors.title} />
          <textarea
            data-testid="task-edit-note"
            aria-label="Note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className={FIELD}
          />
          <FieldError field="note" message={errors.note} />
          {/* TSK-06 AC-2. Opens on the current time, empty when none; cleared, it removes the time. */}
          <TimeInput testId="task-edit-time" value={time} onChange={setTime} className={`${FIELD} w-auto self-start`} />
          <FieldError field="time" message={errors.time} />
          <GeneralError message={errors.general} />
          <div className="flex gap-2">
            <button data-testid="task-edit-save" type="submit" disabled={busy} className={PRIMARY}>
              Save
            </button>
            <button data-testid="task-edit-cancel" type="button" onClick={cancel} className={PILL_OUTLINE}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-3">
          {/* AC-9. A round box, mint when ticked. A button with the checkbox role, so it carries
              `aria-checked` and is reached by the keyboard. TSK-05 AC-1: never disabled, so a second
              press acts at once. */}
          <button
            data-testid="task-done"
            type="button"
            role="checkbox"
            aria-checked={task.done}
            aria-label={task.done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
            onClick={onTick}
            className={
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border-2 transition-colors " +
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

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {showDate ? (
                <span
                  data-testid="task-date-chip"
                  className="inline-flex shrink-0 items-center rounded-pill bg-field px-2 py-0.5 text-[11px] font-bold text-ink-2"
                >
                  {chipLabel(task.date)}
                </span>
              ) : null}
              {/* TSK-06 AC-10. In the overdue list the time follows the date chip. */}
              {showDate && task.timeOfDay !== null ? <TaskTime time={task.timeOfDay} /> : null}
              <span
                data-testid="task-title"
                className={`break-words text-sm font-bold ${task.done ? "text-ink-3 line-through" : "text-ink"}`}
              >
                {task.title}
              </span>
            </div>
            {task.note ? (
              <p data-testid="task-note" className="mt-0.5 line-clamp-2 whitespace-pre-line break-words text-xs text-ink-3">
                {task.note}
              </p>
            ) : null}
            {/* TSK-06 AC-17. Only when timed: a clock and the time, on its own line under the note. */}
            {!showDate && task.timeOfDay !== null ? (
              <div className="mt-1">
                <TaskTime time={task.timeOfDay} />
              </div>
            ) : null}
          </div>

          {/* TSK-06 AC-18. Three icon buttons, visible on hover or focus from `md`, always visible at
              phone width. Each opens TSK-01's flow unchanged; delete keeps its confirmation. */}
          <div className="flex shrink-0 gap-0.5 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <RowAction testId="task-edit" label="Edit task" onClick={startEdit} hoverClass="hover:bg-field hover:text-ink">
              <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
            </RowAction>
            {canMove ? (
              <RowAction testId="task-move" label="Move to a date" onClick={startMove} hoverClass="hover:bg-field hover:text-ink">
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </RowAction>
            ) : null}
            <RowAction
              testId="task-delete"
              label="Delete task"
              onClick={() => onDelete(task)}
              hoverClass="hover:bg-overload hover:text-danger"
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            </RowAction>
          </div>
        </div>
      )}

      {mode === "move" ? (
        <form
          className="flex flex-col gap-2 pl-8"
          // The browser's own `min` check would swallow the submit with no sentence; the seam's
          // `task_date_past` is what AC-11 shows beside the field.
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => seam.moveTask(task.id, date));
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            {/* AC-11. `min` is an affordance; the seam refuses `task_date_past` either way. */}
            <input
              data-testid="task-move-date"
              type="date"
              aria-label="Move to"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${FIELD} w-auto`}
            />
            <button data-testid="task-move-save" type="submit" disabled={busy} className={PRIMARY}>
              Move
            </button>
            <button data-testid="task-move-cancel" type="button" onClick={cancel} className={PILL_OUTLINE}>
              Cancel
            </button>
          </div>
          <FieldError field="date" message={errors.date} />
        </form>
      ) : null}

      {mode !== "edit" ? <GeneralError message={errors.general ?? tickError} /> : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// The add form. AC-6 to AC-8; present on today and later days only.
// ---------------------------------------------------------------------------

export function AddTaskForm({ day, onAdded }: { day: string; onAdded(): Promise<void> }): JSX.Element {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [time, setTime] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  return (
    <form
      data-testid="task-add-form"
      className="flex flex-col gap-2 rounded-card bg-field p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void (async () => {
          setBusy(true);
          const result = await seam.createTask({ date: day, title, note, timeOfDay: time });
          setBusy(false);
          if (!result.ok) {
            setErrors(errorsOf(result.error));
            return;
          }
          setErrors({});
          setTitle("");
          setNote("");
          setTime("");
          await onAdded();
        })();
      }}
    >
      <input
        data-testid="task-add-title"
        aria-label="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task"
        className={PANEL_FIELD}
      />
      <FieldError field="title" message={errors.title} />
      <textarea
        data-testid="task-add-note"
        aria-label="Task note"
        rows={1}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className={`${PANEL_FIELD} resize-none rounded-xl text-xs`}
      />
      <FieldError field="note" message={errors.note} />
      {/* A create refused `task_date_past` only when the day turned over while the page was open. */}
      <FieldError field="date" message={errors.date} />
      <GeneralError message={errors.general} />
      {/* TSK-06 AC-19. One line: the time on the left, empty by default; Add on the right. */}
      <div className="flex items-center justify-between gap-2">
        <TimeInput testId="task-add-time" value={time} onChange={setTime} className={PANEL_TIME} />
        <button
          data-testid="task-add-submit"
          type="submit"
          disabled={busy}
          className={`${PRIMARY} inline-flex items-center gap-1 px-5 text-sm`}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add
        </button>
      </div>
      <FieldError field="time" message={errors.time} />
    </form>
  );
}

/** `record` without `key`; the same object when the key is absent, so React skips the render. */
function withoutKey(record: Record<string, string>, key: string): Record<string, string> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

// ---------------------------------------------------------------------------
// The page.
// ---------------------------------------------------------------------------

type LoadState =
  | { phase: "loading" }
  | { phase: "failed" }
  // TSK-06 § 4.7. `week` is the whole read; `tasks` is the day's part of it, in the seam's order.
  | { phase: "ready"; day: string; week: Task[]; tasks: Task[]; overdue: Task[] };

export default function Tasks(): JSX.Element {
  const { day: param } = useParams();
  const navigate = useNavigate();
  // TSK-02 AC-10. Rises when the overdue prompt closes having changed a task; the page reloads.
  const { tasksRevision, member } = useShellContext();
  const today = eventToday();
  const valid = param === undefined || isCalendarDay(param);
  const day = param !== undefined && valid ? param : today;
  const isToday = day === today;
  // TSK-06 AC-11. Monday to Sunday, holding the viewed day.
  const weekDays = weekDaysOf(day);
  const weekStart = weekDays[0] ?? day;
  const weekEnd = weekDays[6] ?? day;

  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [confirming, setConfirming] = useState<Task | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** TSK-05 AC-3. Each task's last tick refusal, by task id. */
  const [tickErrors, setTickErrors] = useState<Record<string, string>>({});
  const [, setRenders] = useState(0);
  /** TSK-03 AC-10, AC-13. The member's own entries, for the PTO flag; null until read or when the read
   *  failed. Read once, apart from `load()`: a failed entries read never fails the task list, and a
   *  task change never re-reads entries. */
  const [ownEntries, setOwnEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const entries = await seam.listOwnEntries();
        if (live) setOwnEntries(entries);
      } catch {
        if (live) setOwnEntries(null);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  // TSK-05 § 4.2. One ticker for the page's lifetime; every callback it holds is a stable setter.
  const tickerRef = useRef<TaskTicker | null>(null);
  if (tickerRef.current === null) {
    tickerRef.current = createTaskTicker(
      (id, done) => seam.setTaskDone(id, done),
      () => setRenders((n) => n + 1),
      (outcome: TickOutcome) => {
        // The run is closed, so `shown` now reads the lists: every outcome writes the server's value
        // into them, not only `saved` (REVIEW FAIL of 2026-10-15).
        setState((s) =>
          s.phase === "ready"
            ? {
                ...s,
                week: applyOutcome(s.week, outcome),
                tasks: applyOutcome(s.tasks, outcome),
                overdue: applyOutcome(s.overdue, outcome),
              }
            : s,
        );
        if (outcome.kind === "saved") {
          const savedId = outcome.task.id;
          setTickErrors((e) => withoutKey(e, savedId));
        } else if (outcome.kind === "failed") {
          setTickErrors((e) => ({ ...e, [outcome.taskId]: outcome.failure.message }));
        }
      },
    );
  }
  const ticker = tickerRef.current;

  const load = useCallback(async (): Promise<void> => {
    // TSK-05 AC-6. A tick that ends while this load is out wins over what the load read.
    const mark = ticker.mark();
    try {
      // TSK-06 § 4.7. One read of the week, not one of the day and one of the week: two reads of the
      // same rows could disagree mid-tick (§ 8 alternative 3).
      const [week, overdue] = await Promise.all([
        seam.listTasks(weekStart, weekEnd),
        isToday ? seam.listOverdueTasks(today) : Promise.resolve([]),
      ]);
      const reconciled = week.map((t) => ticker.reconcile(t, mark));
      setState({
        phase: "ready",
        day,
        week: reconciled,
        tasks: reconciled.filter((t) => t.date === day),
        overdue: overdue.map((t) => ticker.reconcile(t, mark)),
      });
    } catch {
      setState({ phase: "failed" });
    }
  }, [day, weekStart, weekEnd, isToday, today, ticker]);

  useEffect(() => {
    if (valid) void load();
  }, [load, valid, tasksRevision]);

  // AC-3. Anything that is not a calendar day lands on today.
  if (!valid) return <Navigate to="/tasks" replace />;

  const goTo = (target: string): void => {
    navigate(`/tasks/${target}`);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!confirming) return;
    setDeleting(true);
    const result = await seam.deleteTask(confirming.id);
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error.message);
      return;
    }
    setConfirming(null);
    setDeleteError(null);
    await load();
  };

  const closeConfirm = (): void => {
    setConfirming(null);
    setDeleteError(null);
  };

  /** TSK-05 AC-1, AC-3. `task` is the row as the server last gave it, not as shown. */
  const tick = (task: Task): void => {
    setTickErrors((e) => withoutKey(e, task.id));
    ticker.tap(task);
  };

  // TSK-05. The key leaves out `done`, so a press does not remount the row and the box keeps focus.
  // TSK-06 § 4.7: it gains the time, so an edit of the time remounts the row with the new value.
  const rowKey = (task: Task): string =>
    `${task.id}:${task.date}:${task.title}:${task.note ?? ""}:${task.timeOfDay ?? ""}`;

  // A stale list from the previous day is not shown under the new day's heading.
  const ready = state.phase === "ready" && state.day === day ? state : null;

  // TSK-03 AC-10 to AC-12. The count is the day's list as SHOWN, so a tick moves it at once.
  const pto = ownEntries ? ptoCovering(ownEntries, member.id, day) : null;
  const openCount = ready ? ready.tasks.filter((t) => !ticker.shown(t).done).length : 0;

  // TSK-06 AC-12, AC-16, AC-21, § 1 decision 5. Every count is of the tasks as SHOWN.
  const tallies = ready
    ? taskTalliesFor(ready.week.map((t) => ticker.shown(t)), { start: weekStart, end: weekEnd })
    : null;
  const dayTally: DayTaskTally = tallies?.get(day) ?? { done: 0, total: 0 };
  const weekTally = tallies ? weekTotals(tallies) : { done: 0, total: 0 };

  return (
    <section data-testid="tasks-page" className="mx-auto flex w-full max-w-[1040px] flex-col gap-4">
      {/* TSK-06 § 2b. The header row: title and subtitle. `Today` moved to the week strip's nav row. */}
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-ink">My tasks</h1>
          <p className="mt-0.5 text-sm text-ink-2">Plan your tasks by day and tick them off.</p>
        </div>
      </header>

      {/* TSK-06 AC-11 to AC-13. The week strip. */}
      <div data-testid="tasks-week-strip" className={CARD}>
        <div className="flex items-center gap-2">
          <button
            data-testid="tasks-prev-week"
            type="button"
            aria-label="Previous week"
            onClick={() => goTo(shiftDay(day, -7))}
            className={ICON_BUTTON}
          >
            ‹
          </button>
          <p data-testid="tasks-week-label" className="flex-1 text-center text-sm font-extrabold text-ink">
            Week {weekLabel(weekStart)}
          </p>
          {/* TSK-01 AC-2, TSK-06 AC-14. Absent while viewing today; beside the week it moves within. */}
          {isToday ? null : (
            <Link data-testid="tasks-today" to="/tasks" className={`${PILL_OUTLINE} shrink-0`}>
              Today
            </Link>
          )}
          <button
            data-testid="tasks-next-week"
            type="button"
            aria-label="Next week"
            onClick={() => goTo(shiftDay(day, 7))}
            className={ICON_BUTTON}
          >
            ›
          </button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 sm:gap-2">
          {weekDays.map((d) => {
            const tally = tallies?.get(d);
            const selected = d === day;
            const isTodayCell = d === today;
            return (
              <Link
                key={d}
                data-testid="tasks-week-day"
                data-day={d}
                data-today={isTodayCell ? "true" : undefined}
                aria-current={selected ? "date" : undefined}
                aria-label={stripCellLabel(d, tally)}
                to={`/tasks/${d}`}
                className={
                  "flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-0.5 py-2 transition-colors " +
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
                  (selected ? "bg-ink text-white" : "bg-bg text-ink hover:bg-field") +
                  // Today is ringed whichever day is selected, and its weekday becomes a `Today` pill.
                  (isTodayCell ? " ring-2 ring-inset ring-primary" : "")
                }
              >
                {isTodayCell ? (
                  <span
                    data-testid="tasks-week-day-today"
                    className="rounded-pill bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-white"
                  >
                    Today
                  </span>
                ) : (
                  <span className={`text-[10px] font-bold uppercase ${selected ? "text-white/80" : "text-ink-3"}`}>
                    {weekdayAbbr(d)}
                  </span>
                )}
                <span className="text-sm font-extrabold tabular-nums">{Number(d.slice(8, 10))}</span>
                <span
                  data-testid="tasks-week-day-mark"
                  className={
                    "text-[10px] font-bold tabular-nums " +
                    (selected
                      ? "text-white"
                      : tally && tally.total > 0 && tally.done === tally.total
                        ? "text-wfh-ink"
                        : tally && tally.total > 0
                          ? "text-ink"
                          : "text-ink-3")
                  }
                >
                  {/* Nothing while the week is read, rather than a "–" that would be a claim. */}
                  {tallies ? stripMark(tally) : "\u00a0"}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* TSK-06 § 2b. The day card and the summary side by side from `lg`, stacked below it. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className={`${CARD} flex flex-col gap-4`}>
          {/* TSK-06 AC-15, AC-14. The heading and the PTO flag left, the day arrows right. */}
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <h2 data-testid="tasks-day-heading" data-day={day} className="text-base font-extrabold text-ink">
                {isToday ? "Today · " : ""}
                {headingLabel(day)}
              </h2>
              {/* TSK-03 AC-10. A pill beside the heading, never a banner or a row: it changes nothing
                  the page does (AC-12). Tentative is the palette's dashed border at reduced opacity. */}
              {pto ? (
                <span
                  data-testid="tasks-pto-flag"
                  data-entry-id={pto.id}
                  data-portion={pto.portion}
                  data-tentative={pto.tentative}
                  data-open-count={openCount}
                  className={[
                    "inline-flex items-center gap-1 rounded-full bg-pto px-2 py-0.5 text-xs font-bold text-pto-ink",
                    pto.tentative ? "border border-dashed border-current opacity-60" : "",
                  ].join(" ")}
                >
                  <Sun aria-hidden="true" className="h-3 w-3" />
                  On PTO{ptoFlagSuffix(pto.portion, pto.tentative, openCount)}
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                data-testid="tasks-prev-day"
                type="button"
                aria-label="Previous day"
                onClick={() => goTo(shiftDay(day, -1))}
                className={ICON_BUTTON}
              >
                ‹
              </button>
              <button
                data-testid="tasks-next-day"
                type="button"
                aria-label="Next day"
                onClick={() => goTo(shiftDay(day, 1))}
                className={ICON_BUTTON}
              >
                ›
              </button>
            </div>
          </div>

          {state.phase === "failed" ? (
            <p role="alert" className="text-center text-sm text-danger">
              {LOAD_FAILED}
            </p>
          ) : ready === null ? (
            <p role="status" className="text-center text-sm text-ink-2">
              <Loader label="Loading tasks…" />
            </p>
          ) : (
            <>
              {/* TSK-06 AC-16. Absent on a day with no task; TSK-01 AC-4's empty state stands. */}
              {dayTally.total > 0 ? (
                <div data-testid="tasks-day-progress" data-done={dayTally.done} data-total={dayTally.total}>
                  <ProgressBar tally={dayTally} />
                </div>
              ) : null}

              {/* AC-13 to AC-15. Today only, and only while something is overdue. */}
              {isToday && ready.overdue.length > 0 ? (
                <div data-testid="tasks-overdue" className="rounded-card bg-overload px-4 py-3">
                  <h3 className="text-sm font-extrabold text-ink">
                    {/* TSK-05 AC-7. The rows shown not done; a ticked row stays until the next load. */}
                    Overdue ·{" "}
                    <span data-testid="tasks-overdue-count">
                      {ready.overdue.filter((t) => !ticker.shown(t).done).length}
                    </span>
                  </h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {ready.overdue.map((task) => (
                      <TaskRow
                        key={rowKey(task)}
                        task={ticker.shown(task)}
                        today={today}
                        showDate
                        onChanged={load}
                        onDelete={setConfirming}
                        onTick={() => tick(task)}
                        tickError={tickErrors[task.id]}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}

              {ready.tasks.length > 0 ? (
                <ul data-testid="tasks-list" className="flex flex-col gap-2">
                  {ready.tasks.map((task) => (
                    <TaskRow
                      key={rowKey(task)}
                      task={ticker.shown(task)}
                      today={today}
                      showDate={false}
                      onChanged={load}
                      onDelete={setConfirming}
                      onTick={() => tick(task)}
                      tickError={tickErrors[task.id]}
                    />
                  ))}
                </ul>
              ) : (
                <p data-testid="tasks-empty" className="py-6 text-center text-sm text-ink-2">
                  {day >= today ? "Nothing planned yet. Add the first task below." : "Nothing was planned for this day."}
                </p>
              )}

              {/* AC-7. The form is ABSENT on an earlier day; the seam refuses `task_date_past` anyway. */}
              {day >= today ? (
                <AddTaskForm key={day} day={day} onAdded={load} />
              ) : (
                <p data-testid="tasks-past-day-note" className="border-t border-line pt-4 text-xs text-ink-3">
                  Past days take no new tasks.
                </p>
              )}
            </>
          )}
        </div>

        {/* TSK-06 AC-21. The week's own tasks, as shown; 0/0 and two zeros on an empty week. */}
        <aside
          data-testid="tasks-week-summary"
          data-done={weekTally.done}
          data-total={weekTally.total}
          className={`${CARD} flex flex-col gap-3`}
        >
          <h2 className="text-sm font-extrabold text-ink">This week</h2>
          <ProgressBar tally={weekTally} />
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col items-center rounded-xl bg-wfh/40 px-2 py-3">
              <span data-testid="tasks-week-done" className="text-xl font-extrabold tabular-nums text-ink">
                {weekTally.done}
              </span>
              <span className="text-xs text-wfh-ink">Done</span>
            </div>
            <div className="flex flex-col items-center rounded-xl bg-pto/40 px-2 py-3">
              <span data-testid="tasks-week-left" className="text-xl font-extrabold tabular-nums text-ink">
                {weekTally.total - weekTally.done}
              </span>
              <span className="text-xs text-pto-ink">Left</span>
            </div>
          </div>
        </aside>
      </div>

      {confirming ? (
        <Modal testIdPrefix="task-delete-confirm" label="Delete this task?" onClose={closeConfirm}>
          <div data-testid="task-delete-confirm" className="flex flex-col gap-4">
            <h1 className="text-lg font-extrabold text-ink">Delete this task?</h1>
            <p className="break-words text-sm text-ink-2">{confirming.title}</p>
            {deleteError ? (
              <p role="alert" className="text-sm text-danger">
                {deleteError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button
                data-testid="task-delete-confirm-yes"
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className={PRIMARY}
              >
                Delete
              </button>
              <button data-testid="task-delete-confirm-no" type="button" onClick={closeConfirm} className={PILL_OUTLINE}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

// One day's own tasks, in a dialog over the week view. Opened from `week-day-task-panel`.
//
// **EVERYTHING IN IT IS THE CALLER'S OWN, AND THE DIALOG IS NOT WHAT MAKES IT SO.** As on the task
// page, the policies on `public.task` are the control; the seam has no parameter that names a member.
// Every read and write goes through the seam (RULE-02): `listTasks`, `setTaskDone`, `deleteTask`, and
// the edit and add flows inside `TaskRow` and `AddTaskForm`, which are the task page's own.
//
// **"TODAY" IS `eventToday()`**, read once per render, as the task page reads it.
//
// **THE ROW CANNOT MOVE HERE.** The dialog holds one day; a moved task would leave it at once. Moving
// stays on the task page, which the footer link opens.
//
// `onChanged` runs after every successful write, so the week behind the dialog re-reads its tallies.
import { useCallback, useEffect, useState, type JSX } from "react";
import { Link } from "react-router-dom";
import { seam } from "@/lib/data";
import type { Task } from "@/lib/domain/types";
import { eventToday } from "@/lib/event-registration";
import { taskTalliesFor, type DayTaskTally } from "@/lib/week-tasks";
import { AddTaskForm, ProgressBar, TaskRow, headingLabel } from "@/routes/Tasks";
import Loader from "./Loader";
import Modal from "./Modal";
import { PILL_OUTLINE } from "./TopBar";

const PRIMARY =
  "rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 " +
  "disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const LOAD_FAILED = "Your tasks could not be loaded. Please try again.";

type LoadState = { phase: "loading" } | { phase: "failed" } | { phase: "ready"; tasks: Task[] };

export interface TaskDayDialogProps {
  /** The `yyyy-MM-dd` day whose tasks are shown. */
  day: string;
  onClose(): void;
  /** Called after every successful write. */
  onChanged(): void;
}

export default function TaskDayDialog({ day, onClose, onChanged }: TaskDayDialogProps): JSX.Element {
  const today = eventToday();
  const isToday = day === today;

  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [confirming, setConfirming] = useState<Task | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** Each task's last tick refusal, by task id. */
  const [tickErrors, setTickErrors] = useState<Record<string, string>>({});

  const load = useCallback(async (): Promise<void> => {
    try {
      const tasks = await seam.listTasks(day, day);
      setState({ phase: "ready", tasks: tasks.filter((t) => t.date === day) });
    } catch {
      setState({ phase: "failed" });
    }
  }, [day]);

  useEffect(() => {
    void load();
  }, [load]);

  /** A row's edit or an add succeeded: re-read here, and tell the week. */
  const changed = async (): Promise<void> => {
    await load();
    onChanged();
  };

  // Optimistic: the box flips at once, and a refusal puts the row back by re-reading.
  const tick = async (task: Task): Promise<void> => {
    const done = !task.done;
    setTickErrors((e) => {
      if (!(task.id in e)) return e;
      const next = { ...e };
      delete next[task.id];
      return next;
    });
    setState((s) =>
      s.phase === "ready" ? { ...s, tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, done } : t)) } : s,
    );
    const result = await seam.setTaskDone(task.id, done);
    if (!result.ok) {
      setTickErrors((e) => ({ ...e, [task.id]: result.error.message }));
      await load();
      return;
    }
    onChanged();
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
    await changed();
  };

  const closeConfirm = (): void => {
    setConfirming(null);
    setDeleteError(null);
  };

  // The task page's key: it leaves out `done`, so a tick keeps focus, and holds every edited field,
  // so an edit remounts the row with its new values.
  const rowKey = (task: Task): string =>
    `${task.id}:${task.date}:${task.title}:${task.note ?? ""}:${task.timeOfDay ?? ""}`;

  const tally: DayTaskTally =
    state.phase === "ready"
      ? (taskTalliesFor(state.tasks, { start: day, end: day }).get(day) ?? { done: 0, total: 0 })
      : { done: 0, total: 0 };

  return (
    <Modal testIdPrefix="task-day" label="Tasks for the day" onClose={onClose}>
      <div data-testid="task-day-dialog" data-day={day} className="flex flex-col gap-4">
        <div className="pr-10">
          <h1 className="text-lg font-extrabold text-ink">Tasks for the day</h1>
          <p data-testid="task-day-heading" data-day={day} className="mt-0.5 text-sm text-ink-2">
            {isToday ? "Today · " : ""}
            {headingLabel(day)}
          </p>
        </div>

        {confirming ? (
          // The confirmation replaces the content while open: a second modal over this one would
          // put two Escape handlers on the document.
          <div data-testid="task-delete-confirm" className="flex flex-col gap-4">
            <h2 className="text-base font-extrabold text-ink">Delete this task?</h2>
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
        ) : state.phase === "loading" ? (
          <p role="status" className="text-center text-sm text-ink-2">
            <Loader label="Loading tasks…" />
          </p>
        ) : state.phase === "failed" ? (
          <p role="alert" className="text-center text-sm text-danger">
            {LOAD_FAILED}
          </p>
        ) : (
          <>
            <ProgressBar tally={tally} />

            {state.tasks.length > 0 ? (
              <ul data-testid="task-day-list" className="flex flex-col gap-2">
                {state.tasks.map((task) => (
                  <TaskRow
                    key={rowKey(task)}
                    task={task}
                    today={today}
                    showDate={false}
                    canMove={false}
                    onChanged={changed}
                    onDelete={setConfirming}
                    onTick={() => void tick(task)}
                    tickError={tickErrors[task.id]}
                  />
                ))}
              </ul>
            ) : (
              <div
                data-testid="task-day-empty"
                className="rounded-card border border-dashed border-line px-4 py-6 text-center"
              >
                <p className="text-sm font-bold text-ink">No tasks yet</p>
                <p className="mt-1 text-xs text-ink-3">
                  {day >= today ? "Add something to do for this day below." : "Nothing was planned for this day."}
                </p>
              </div>
            )}

            {/* Absent on an earlier day; the seam refuses `task_date_past` anyway. */}
            {day >= today ? <AddTaskForm key={day} day={day} onAdded={changed} /> : null}
          </>
        )}

        <Link
          data-testid="task-day-open-page"
          to={`/tasks/${day}`}
          className="self-end text-xs font-bold text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Open the task page ›
        </Link>
      </div>
    </Modal>
  );
}

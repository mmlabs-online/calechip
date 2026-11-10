// TSK-05 — the optimistic tick. 01-plan.md § 4.1.
//
// **THE SCREEN SHOWS A PRESS BEFORE THE DATABASE HAS ACCEPTED IT, AND THE DATABASE STILL DECIDES.**
// A press flips what `shown` returns at once; the write runs behind it, and a refusal puts the value
// back (AC-3). What is shown is an affordance and nothing else — the policies on `public.task` are
// the control (§ 3).
//
// **ONE WRITE IN FLIGHT PER TASK** (AC-4, § 8 alternative 1). Two concurrent updates of one row reach
// PostgreSQL in no promised order, so a press made while a write is outstanding only changes the value
// wanted; when the write answers, the value wanted is sent if the server does not already hold it.
// The database therefore applies the presses in the order they were made, and stores the last.
//
// Pure: no React, no seam import, no clock, no timer. The page passes the write in (RULE-02).
import type { Failure, Result, Task } from "@/lib/domain/types";

/** The write a tap makes. The page passes `(id, done) => seam.setTaskDone(id, done)` (RULE-02). */
export type TickWrite = (taskId: string, done: boolean) => Promise<Result<Task>>;

/** AC-3. The sentence for a write that throws or rejects — the seam's own `unknown` sentence. */
export const TICK_FAILED = "This task could not be saved.";

/** What a task's run of presses ended in. Emitted once per run, when no write for it is outstanding. */
export type TickOutcome =
  /** AC-2. The last write succeeded; `task` is the truth. */
  | { kind: "saved"; task: Task }
  /** AC-3. The write carrying the last press's value failed; `done` is the value before the tap. */
  | { kind: "failed"; taskId: string; done: boolean; failure: Failure }
  /** AC-4, AC-5. An earlier write failed, and the last press had already restored the value the server
   *  holds, so nothing was left to send and nothing is shown. */
  | { kind: "settled"; taskId: string; done: boolean };

export interface TaskTicker {
  /** AC-1, AC-4. Flip the value `shown(task)` currently has. `task.done` is the value before the tap
   *  when no run is open for this task. Calls `onChange` synchronously, before any write is issued. */
  tap(task: Task): void;
  /** AC-1. `task` with `done` replaced by the last press's value while a run is open; else `task`. */
  shown(task: Task): Task;
  /** AC-6. A counter, read by the page immediately before it starts a load. */
  mark(): number;
  /** AC-6. `task` with `done` replaced by the value of a run that ended after `mark` was read; else
   *  `task`. */
  reconcile(task: Task, mark: number): Task;
}

/** One task's presses, from the first press until no write for it is outstanding. */
interface Run {
  /** The value the server is known to hold. */
  confirmed: boolean;
  /** The value the last press set. */
  desired: boolean;
  /** Incremented on every press; a write remembers the one it was sent under. */
  seq: number;
  inFlight: boolean;
}

/** AC-2, AC-3, AC-4. `list` with the outcome's server value written into the task it names: `saved`
 *  replaces the task with `outcome.task`; `failed` and `settled` replace only `done` with
 *  `outcome.done`. A task the list does not hold is left alone; the same array is returned when
 *  nothing changed. Once a run closes `shown` falls back to the page's lists, so they must hold the
 *  server's value — not the last load's, which a successful write earlier in the run has replaced. */
export function applyOutcome(list: Task[], outcome: TickOutcome): Task[] {
  const id = outcome.kind === "saved" ? outcome.task.id : outcome.taskId;
  const i = list.findIndex((t) => t.id === id);
  if (i === -1) return list;
  const before = list[i]!;
  const after = outcome.kind === "saved" ? outcome.task : { ...before, done: outcome.done };
  if (after === before || (outcome.kind !== "saved" && before.done === outcome.done)) return list;
  const next = list.slice();
  next[i] = after;
  return next;
}

const THREW: Result<Task> ={ ok: false, error: { code: "unknown", message: TICK_FAILED } };

export function createTaskTicker(
  write: TickWrite,
  /** Something shown has changed — the page re-renders. */
  onChange: () => void,
  onOutcome: (outcome: TickOutcome) => void,
): TaskTicker {
  const runs = new Map<string, Run>();
  /** AC-6. The value each task's last run closed on, and when, in `counter` ticks. */
  const closed = new Map<string, { done: boolean; at: number }>();
  let counter = 0;

  const send = (taskId: string, run: Run): void => {
    run.inFlight = true;
    const sentSeq = run.seq;
    let pending: Promise<Result<Task>>;
    try {
      pending = write(taskId, run.desired);
    } catch {
      pending = Promise.resolve(THREW);
    }
    void pending.then(
      (result) => answer(taskId, run, sentSeq, result),
      () => answer(taskId, run, sentSeq, THREW),
    );
  };

  const answer = (taskId: string, run: Run, sentSeq: number, result: Result<Task>): void => {
    run.inFlight = false;
    const current = sentSeq === run.seq;
    if (result.ok) {
      run.confirmed = result.value.done;
    } else if (current) {
      // AC-3. The last press's write failed: the row goes back to what the server holds.
      run.desired = run.confirmed;
    } else {
      // AC-5. A later press has already replaced this one; its failure is not the member's to see.
      console.error(`TSK-05: a superseded tick on task ${taskId} failed`, result.error);
    }

    if (run.desired !== run.confirmed) {
      send(taskId, run);
      return;
    }

    runs.delete(taskId);
    closed.set(taskId, { done: run.confirmed, at: ++counter });
    if (result.ok) onOutcome({ kind: "saved", task: result.value });
    else if (current) onOutcome({ kind: "failed", taskId, done: run.confirmed, failure: result.error });
    else onOutcome({ kind: "settled", taskId, done: run.confirmed });
    onChange();
  };

  return {
    tap(task) {
      let run = runs.get(task.id);
      if (run === undefined) {
        run = { confirmed: task.done, desired: task.done, seq: 0, inFlight: false };
        runs.set(task.id, run);
      }
      run.desired = !run.desired;
      run.seq += 1;
      onChange();
      if (!run.inFlight) send(task.id, run);
    },

    shown(task) {
      const run = runs.get(task.id);
      return run === undefined || run.desired === task.done ? task : { ...task, done: run.desired };
    },

    mark() {
      return counter;
    },

    reconcile(task, mark) {
      const last = closed.get(task.id);
      return last === undefined || last.at <= mark || last.done === task.done ? task : { ...task, done: last.done };
    },
  };
}

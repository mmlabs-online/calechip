// TSK-02 — the overdue prompt's two decisions that are not drawing. 01-plan.md § 4.1.
//
// **"OPENING THE APP" IS A PAGE LOAD OR A SIGN-IN** (01-plan.md § 1, reading 1). The gate below is
// module state on purpose: it survives the shell remounting — a session re-read in place, StrictMode's
// double effect — and dies with the page, which is exactly a reload (AC-3, § 8 alternative 3). It is
// an affordance, not a control: the policies on `public.task` decide what the prompt can read.
//
// Pure: no React, no seam import, no clock. The component passes the write in (RULE-02), as
// `src/lib/task-tick.ts` does.
import type { Failure, Result, Task } from "@/lib/domain/types";

/** The members the prompt has already been claimed for since the page loaded or the last sign-out. */
const claimed = new Set<string>();

/** AC-3. True the first time it is called for `memberId` since the page loaded or since
 *  `forgetOverduePrompt()`; false on every later call for the same member. Module state, so a
 *  remount of the shell (a session re-read in place, StrictMode's double effect) is not an opening. */
export function claimOverduePrompt(memberId: string): boolean {
  if (claimed.has(memberId)) return false;
  claimed.add(memberId);
  return true;
}

/** AC-3. Called after a successful sign-out, so the next sign-in is an opening. */
export function forgetOverduePrompt(): void {
  claimed.clear();
}

/** The write one move makes. The component passes `(id, date) => seam.moveTask(id, date)`. */
export type MoveWrite = (taskId: string, date: string) => Promise<Result<Task>>;

/** AC-8. The sentence for a move that throws or rejects — the seam's own `unknown` sentence. */
export const MOVE_FAILED = "This task could not be saved.";

export interface MoveAllResult {
  /** The saved rows, in the order given. */
  moved: Task[];
  /** One per task whose move returned `ok: false` or threw, in the order given. */
  failed: { taskId: string; failure: Failure }[];
}

/** AC-7, AC-8. Moves each of `tasks` to `today`, ONE AT A TIME in the order given, never stopping at a
 *  failure. A throw or rejection is `{ code: "unknown", message: MOVE_FAILED }`. Never throws. */
export async function moveAllToToday(tasks: Task[], today: string, move: MoveWrite): Promise<MoveAllResult> {
  const moved: Task[] = [];
  const failed: MoveAllResult["failed"] = [];
  for (const task of tasks) {
    let result: Result<Task>;
    try {
      result = await move(task.id, today);
    } catch {
      result = { ok: false, error: { code: "unknown", message: MOVE_FAILED } };
    }
    if (result.ok) moved.push(result.value);
    else failed.push({ taskId: task.id, failure: result.error });
  }
  return { moved, failed };
}

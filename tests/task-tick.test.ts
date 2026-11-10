// TSK-05 — the optimistic tick, against the module. 01-plan.md §§ 4.1 and 5.
//
// **EVERY WRITE IS A PROMISE THE TEST RESOLVES BY HAND.** The mock seam has no hook to make
// `setTaskDone` fail or wait (§ 5's stated gap), so the orderings the screen cannot be made to show —
// before the answer, a refusal, a superseded refusal — are asserted here, where they are a property of
// `createTaskTicker` alone.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Failure, Result, Task } from "@/lib/domain/types";
import { TICK_FAILED, applyOutcome, createTaskTicker, type TickOutcome } from "@/lib/task-tick";

const task = (id: string, done = false): Task => ({
  id,
  memberId: "m-1",
  date: "2030-03-12",
  title: `Task ${id}`,
  note: null,
  timeOfDay: null,
  done,
  createdAt: "2030-03-12T03:00:00.000Z",
});

const NOT_PERMITTED: Failure = {
  code: "task_not_permitted",
  message: "This task could not be changed. It may have been deleted.",
};

interface Call {
  answered: boolean;
  taskId: string;
  done: boolean;
  resolve(result: Result<Task>): void;
  reject(reason: unknown): void;
}

/** A write whose every call waits for the test, and which counts how many are outstanding. */
function harness() {
  const calls: Call[] = [];
  let open = 0;
  let maxOpen = 0;
  const outcomes: TickOutcome[] = [];
  const onChange = vi.fn();
  const write = vi.fn(
    (taskId: string, done: boolean) =>
      new Promise<Result<Task>>((resolve, reject) => {
        open += 1;
        maxOpen = Math.max(maxOpen, open);
        const call: Call = {
          answered: false,
          taskId,
          done,
          resolve: (r) => {
            settle();
            resolve(r);
          },
          reject: (e) => {
            settle();
            reject(e);
          },
        };
        const settle = () => {
          call.answered = true;
          open -= 1;
        };
        calls.push(call);
      }),
  );
  const ticker = createTaskTicker(write, onChange, (o) => outcomes.push(o));
  const call = (i: number): Call => {
    const c = calls[i];
    if (c === undefined) throw new Error(`no write #${i}`);
    return c;
  };
  return { ticker, write, calls, call, outcomes, onChange, maxOpen: () => maxOpen };
}

/** Lets every `then` queued by a resolved write run. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

const ok = (t: Task): Result<Task> => ({ ok: true, value: t });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TSK-05 — createTaskTicker", () => {
  it("AC-1: a tap flips what is shown and calls onChange before the write answers", () => {
    const h = harness();
    const t = task("a");
    h.ticker.tap(t);

    expect(h.ticker.shown(t).done).toBe(true);
    expect(h.onChange).toHaveBeenCalledTimes(1);
    expect(h.write).toHaveBeenCalledTimes(1);
    expect(h.write).toHaveBeenCalledWith("a", true);
    expect(h.outcomes).toEqual([]);
  });

  it("AC-1: onChange runs before the write is issued", () => {
    const order: string[] = [];
    const ticker = createTaskTicker(
      () => {
        order.push("write");
        return new Promise<Result<Task>>(() => {});
      },
      () => order.push("change"),
      () => {},
    );
    ticker.tap(task("a"));
    expect(order).toEqual(["change", "write"]);
  });

  it("AC-2: success emits one saved outcome with the returned task, and shown returns the input again", async () => {
    const h = harness();
    const t = task("a");
    h.ticker.tap(t);
    const returned = { ...t, done: true };
    h.call(0).resolve(ok(returned));
    await flush();

    expect(h.outcomes).toEqual([{ kind: "saved", task: returned }]);
    expect(h.ticker.shown(t)).toBe(t);
    expect(h.write).toHaveBeenCalledTimes(1);
  });

  it("AC-3: a task_not_permitted refusal emits failed with the value before the tap and the seam's sentence", async () => {
    const h = harness();
    const t = task("a", true);
    h.ticker.tap(t);
    expect(h.ticker.shown(t).done).toBe(false);
    h.call(0).resolve({ ok: false, error: NOT_PERMITTED });
    await flush();

    expect(h.outcomes).toEqual([{ kind: "failed", taskId: "a", done: true, failure: NOT_PERMITTED }]);
    expect(h.ticker.shown(t).done).toBe(true);
    expect(h.write).toHaveBeenCalledTimes(1);
  });

  it("AC-3: a rejected write emits failed with TICK_FAILED", async () => {
    const h = harness();
    h.ticker.tap(task("a"));
    h.call(0).reject(new Error("offline"));
    await flush();

    expect(h.outcomes).toEqual([
      { kind: "failed", taskId: "a", done: false, failure: { code: "unknown", message: TICK_FAILED } },
    ]);
  });

  it("AC-3: a write that throws synchronously emits failed with TICK_FAILED", async () => {
    const outcomes: TickOutcome[] = [];
    const ticker = createTaskTicker(
      () => {
        throw new Error("boom");
      },
      () => {},
      (o) => outcomes.push(o),
    );
    const t = task("a");
    ticker.tap(t);
    expect(ticker.shown(t).done).toBe(true);
    await flush();

    expect(outcomes).toEqual([
      { kind: "failed", taskId: "a", done: false, failure: { code: "unknown", message: TICK_FAILED } },
    ]);
    expect(ticker.shown(t).done).toBe(false);
  });

  it("AC-4: three taps with the first write out send one more write, with the last value", async () => {
    const h = harness();
    const t = task("a");
    h.ticker.tap(t);
    h.ticker.tap(t);
    h.ticker.tap(t);
    expect(h.write).toHaveBeenCalledTimes(1);
    expect(h.ticker.shown(t).done).toBe(true);

    // The server answers the first press (true) — the last press also wants true, so nothing is sent.
    h.call(0).resolve(ok({ ...t, done: true }));
    await flush();
    expect(h.write).toHaveBeenCalledTimes(1);
    expect(h.outcomes).toEqual([{ kind: "saved", task: { ...t, done: true } }]);
    expect(h.maxOpen()).toBe(1);
  });

  it("AC-4: two taps with the first write out send the last value after the first answers", async () => {
    const h = harness();
    const t = task("a");
    h.ticker.tap(t);
    h.ticker.tap(t);
    expect(h.ticker.shown(t).done).toBe(false);
    expect(h.write).toHaveBeenCalledTimes(1);

    h.call(0).resolve(ok({ ...t, done: true }));
    await flush();
    expect(h.write).toHaveBeenCalledTimes(2);
    expect(h.write).toHaveBeenLastCalledWith("a", false);
    expect(h.outcomes).toEqual([]);
    expect(h.ticker.shown(t).done).toBe(false);

    h.call(1).resolve(ok({ ...t, done: false }));
    await flush();
    expect(h.outcomes).toEqual([{ kind: "saved", task: { ...t, done: false } }]);
    expect(h.maxOpen()).toBe(1);
  });

  it("AC-4: never more than one write per task is outstanding, in any rhythm, and the last press is stored", async () => {
    const h = harness();
    // What the page holds: the task as the server last returned it (§ 4.2, `saved` replaces it).
    let held = task("a");
    let pressed = held.done;
    const answerOutstanding = async () => {
      for (const c of h.calls.filter((call) => !call.answered)) c.resolve(ok({ ...held, done: c.done }));
      await flush();
      const last = h.outcomes[h.outcomes.length - 1];
      if (last?.kind === "saved") held = last.task;
    };
    // Presses between answers: 1, 2, 3, 1, 2, 3 — then drain whatever is still owed.
    for (let round = 0; round < 6; round += 1) {
      for (let i = 0; i <= round % 3; i += 1) {
        h.ticker.tap(held);
        pressed = !pressed;
        expect(h.ticker.shown(held).done).toBe(pressed);
      }
      await answerOutstanding();
    }
    while (h.calls.some((c) => !c.answered)) await answerOutstanding();

    expect(h.maxOpen()).toBe(1);
    expect(held.done).toBe(pressed);
    expect(h.ticker.shown(held).done).toBe(pressed);
  });

  it("AC-4: taps on different tasks do not wait for each other", () => {
    const h = harness();
    h.ticker.tap(task("a"));
    h.ticker.tap(task("b"));
    expect(h.write).toHaveBeenCalledTimes(2);
    expect(h.write).toHaveBeenNthCalledWith(1, "a", true);
    expect(h.write).toHaveBeenNthCalledWith(2, "b", true);
  });

  it("AC-5: tap, tap, the first write fails — no failed outcome, one console.error, then settled", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness();
    const t = task("a");
    h.ticker.tap(t);
    h.ticker.tap(t);
    h.call(0).resolve({ ok: false, error: NOT_PERMITTED });
    await flush();

    expect(error).toHaveBeenCalledTimes(1);
    expect(h.write).toHaveBeenCalledTimes(1);
    expect(h.outcomes).toEqual([{ kind: "settled", taskId: "a", done: false }]);
    expect(h.ticker.shown(t).done).toBe(false);
  });

  it("AC-5: with a third tap, the following write's success yields saved", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness();
    const t = task("a");
    h.ticker.tap(t);
    h.ticker.tap(t);
    h.ticker.tap(t);
    h.call(0).resolve({ ok: false, error: NOT_PERMITTED });
    await flush();

    expect(error).toHaveBeenCalledTimes(1);
    expect(h.write).toHaveBeenCalledTimes(2);
    expect(h.write).toHaveBeenLastCalledWith("a", true);
    expect(h.outcomes).toEqual([]);

    h.call(1).resolve(ok({ ...t, done: true }));
    await flush();
    expect(h.outcomes).toEqual([{ kind: "saved", task: { ...t, done: true } }]);
  });

  it("AC-6: a load marked before a run closes reconciles to the run's value; one marked after does not", async () => {
    const h = harness();
    const t = task("a");
    const before = h.ticker.mark();
    h.ticker.tap(t);
    h.call(0).resolve(ok({ ...t, done: true }));
    await flush();

    const stale = task("a", false);
    expect(h.ticker.reconcile(stale, before).done).toBe(true);

    const after = h.ticker.mark();
    expect(h.ticker.reconcile(stale, after)).toBe(stale);
  });

  it("AC-6: an untouched task is returned unchanged", () => {
    const h = harness();
    const t = task("z");
    expect(h.ticker.reconcile(t, h.ticker.mark())).toBe(t);
    expect(h.ticker.shown(t)).toBe(t);
  });

  // The REVIEW FAIL of 2026-10-15 (04-review.md Finding 1): a success earlier in the run moves the
  // server's value, so the outcome's `done` must reach the page's list, which `shown` reads once closed.
  it("AC-3, AC-4: tap, tap, write 1 succeeds, write 2 fails — failed carries the server's value, and the list takes it", async () => {
    const h = harness();
    const loaded = task("a", false);
    h.ticker.tap(loaded);
    h.ticker.tap(loaded);
    h.call(0).resolve(ok({ ...loaded, done: true }));
    await flush();
    expect(h.write).toHaveBeenCalledTimes(2);
    expect(h.write).toHaveBeenLastCalledWith("a", false);

    h.call(1).resolve({ ok: false, error: NOT_PERMITTED });
    await flush();
    expect(h.outcomes).toEqual([{ kind: "failed", taskId: "a", done: true, failure: NOT_PERMITTED }]);

    const [outcome] = h.outcomes;
    const [row] = applyOutcome([loaded], outcome!);
    expect(h.ticker.shown(row!).done).toBe(true);
  });

  it("AC-4, AC-5: tap, tap, write 1 succeeds, tap, write 2 fails superseded — settled carries the server's value, and the list takes it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness();
    const loaded = task("a", false);
    h.ticker.tap(loaded);
    h.ticker.tap(loaded);
    h.call(0).resolve(ok({ ...loaded, done: true }));
    await flush();
    h.ticker.tap(loaded);
    h.call(1).resolve({ ok: false, error: NOT_PERMITTED });
    await flush();

    expect(h.write).toHaveBeenCalledTimes(2);
    expect(h.outcomes).toEqual([{ kind: "settled", taskId: "a", done: true }]);

    const [outcome] = h.outcomes;
    const [row] = applyOutcome([loaded], outcome!);
    expect(h.ticker.shown(row!).done).toBe(true);
  });
});

describe("TSK-05 — applyOutcome", () => {
  const a = task("a", false);
  const b = task("b", true);

  it("saved replaces the whole task", () => {
    const returned = { ...a, done: true, title: "Renamed elsewhere" };
    const next = applyOutcome([a, b], { kind: "saved", task: returned });
    expect(next).toEqual([returned, b]);
    expect(next[0]).toBe(returned);
    expect(next[1]).toBe(b);
  });

  it("failed and settled change done only", () => {
    const failed = applyOutcome([a, b], { kind: "failed", taskId: "a", done: true, failure: NOT_PERMITTED });
    expect(failed).toEqual([{ ...a, done: true }, b]);
    const settled = applyOutcome([a, b], { kind: "settled", taskId: "b", done: false });
    expect(settled).toEqual([a, { ...b, done: false }]);
  });

  it("a list without the task, or already holding the value, is returned unchanged", () => {
    const list = [b];
    expect(applyOutcome(list, { kind: "saved", task: { ...a, done: true } })).toBe(list);
    expect(applyOutcome(list, { kind: "failed", taskId: "a", done: true, failure: NOT_PERMITTED })).toBe(list);
    expect(applyOutcome(list, { kind: "settled", taskId: "b", done: true })).toBe(list);
  });
});

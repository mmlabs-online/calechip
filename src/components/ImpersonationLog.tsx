// MIR-20-b — the support log, as a section of the Members screen. 01-plan.md § 2b and § 4.4,
// ADR-100 decision 8.
//
// **THE SCREEN IS AN AFFORDANCE.** `public.list_impersonation_log()` decides which rows a caller may
// read; this component renders what came back and offers no control over it except a retry of the
// read itself. The layout is the Tech Lead's own (§ 2b), never specified by a person.
import { useCallback, useEffect, useState, type ReactElement } from "react";
import Loader from "@/components/Loader";
import { IMPERSONATION_LOG_LIMIT, seam, type ImpersonationLogEntry } from "@/lib/data";

type State =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; entries: ImpersonationLogEntry[] };

/** `2026-11-10 09:20 UTC`. */
const when = (iso: string): string =>
  `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;

const HEADERS = ["Started", "By", "Scope", "Reason", "Ended", "Reads"] as const;

export default function ImpersonationLog(): ReactElement {
  const [state, setState] = useState<State>({ phase: "loading" });

  const load = useCallback((): (() => void) => {
    let live = true;
    setState({ phase: "loading" });
    seam
      .listImpersonationLog()
      .then((entries) => {
        if (live) setState({ phase: "ready", entries });
      })
      .catch(() => {
        if (live) setState({ phase: "error" });
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => load(), [load]);

  return (
    <section data-testid="impersonation-log" className="flex flex-col gap-3">
      <header>
        <h2 className="text-base font-semibold">Support access</h2>
        <p className="text-sm text-ink-2">
          Read-only support sessions a CaleChip system admin opened on your org or team, with the
          reason they gave. A session can read, never change, and closes on its own within an hour.
        </p>
      </header>

      {state.phase === "loading" ? (
        <p
          data-testid="impersonation-log-loading"
          role="status"
          className="rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
        >
          <Loader label="Reading the support log…" />
        </p>
      ) : null}

      {state.phase === "error" ? (
        <div className="flex flex-col items-start gap-2">
          <p
            data-testid="impersonation-log-error"
            role="alert"
            className="rounded-2xl bg-white p-4 text-sm text-rose-600 shadow-sm"
          >
            The support log could not be read just now.
          </p>
          <button
            type="button"
            data-testid="impersonation-log-retry"
            onClick={() => {
              load();
            }}
            className="rounded-pill border border-line px-3 py-1 text-xs font-semibold text-ink-2 transition-colors hover:bg-field hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Try again
          </button>
        </div>
      ) : null}

      {state.phase === "ready" && state.entries.length === 0 ? (
        <p
          data-testid="impersonation-log-empty"
          className="rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
        >
          No support session is on record for you.
        </p>
      ) : null}

      {state.phase === "ready" && state.entries.length > 0 ? (
        <>
          <table
            data-testid="impersonation-log-table"
            className="w-full overflow-hidden rounded-card bg-card text-sm shadow-soft"
          >
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-ink-3">
                {HEADERS.map((h) => (
                  <th key={h} className="px-4 py-3 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.entries.map((e) => (
                <tr
                  key={e.id}
                  data-testid="impersonation-log-row"
                  data-impersonation-id={e.id}
                  className="text-ink-2"
                >
                  <td data-testid="impersonation-log-started" className="px-4 py-2">
                    {when(e.startedAt)}
                  </td>
                  <td data-testid="impersonation-log-actor" className="px-4 py-2">
                    {e.actorEmail}
                  </td>
                  <td data-testid="impersonation-log-scope" className="px-4 py-2">
                    {e.teamName ?? "Whole org"}
                  </td>
                  <td data-testid="impersonation-log-reason" className="px-4 py-2">
                    {e.reason}
                  </td>
                  <td
                    data-testid="impersonation-log-ended"
                    className={`px-4 py-2 ${e.endedAt === null ? "font-semibold text-ink" : ""}`}
                  >
                    {e.endedAt === null ? `Live until ${when(e.expiresAt)}` : when(e.endedAt)}
                  </td>
                  <td data-testid="impersonation-log-reads" className="px-4 py-2">
                    {String(e.reads)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {state.entries.length >= IMPERSONATION_LOG_LIMIT ? (
            <p data-testid="impersonation-log-truncated" className="text-xs text-ink-3">
              Showing the latest {IMPERSONATION_LOG_LIMIT} sessions.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

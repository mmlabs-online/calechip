// MIR-18 — the system panel's entry. 01-plan.md §§ 2b, 4.5; ADR-074 decision 6.
//
// IMPORTS NOTHING FROM THE MEMBER APP: not `App.tsx`, `components/`, `routes/`, `hooks/` or
// `@/lib/data`. Only React, the panel's own seam and the shared stylesheet. No router — the screen is
// a function of `SystemGate` plus the enrolment value held here.
//
// The layout is the Tech Lead's own (§ 2b, "Visual reference: none").
import { StrictMode, useEffect, useRef, useState, type FormEvent, type JSX } from "react";
import { createRoot } from "react-dom/client";
import { format, parseISO } from "date-fns";
import {
  HOLIDAY_FAILURE_MESSAGES,
  ORG_FAILURE_MESSAGES,
  systemSeam,
  systemSeamName,
  __setMockIssueReports,
  type OrgSummary,
  type SystemGate,
  type SystemIssueReport,
  type TotpEnrolment,
} from "@/lib/data/system";
import type { Holiday, HolidayKind, IssueKind, IssueStatus } from "@/lib/domain/types";
import "../index.css";

// MIR-16. The mock-only seeding hook, exposed the way `src/main.tsx` exposes the member app's whole
// seam: a page init script that cannot import this module reaches it through `window` instead. A
// real build drops this block, `VITE_DATA_SEAM` being replaced at build time.
declare global {
  interface Window {
    __setMockIssueReports?: (rows: SystemIssueReport[]) => void;
  }
}
if (systemSeamName === "mock") window.__setMockIssueReports = __setMockIssueReports;

const START_ENROLMENT_FAILED = "Could not start set-up. Reload to try again.";

const fieldClass = "w-full rounded-pill bg-field px-4 py-3 text-ink outline-none";
const primaryButtonClass =
  "w-full rounded-pill bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60";
const textButtonClass = "text-sm font-semibold text-ink-2 underline-offset-2 hover:underline";

// MIR-18-b — the signed-in screen: org management (01-plan.md §§ 2b, 4.5; ADR-075).
const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh"; // the column default, ADR-070 § 2
const smallPrimaryButtonClass =
  "rounded-pill bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";
const smallSecondaryButtonClass = "rounded-pill bg-field px-4 py-2 text-sm font-semibold text-ink";
const formFieldClass = "w-full rounded-pill bg-card px-4 py-2 text-sm text-ink outline-none";
const labelClass = "flex flex-col gap-1 text-xs font-semibold text-ink-3";
const headerCellClass = "px-3 py-2 text-xs font-semibold tracking-wide text-ink-3 uppercase";

function NullableCell({ testId, value, numeric }: { testId: string; value: string | number | null; numeric?: boolean }): JSX.Element {
  return (
    <td data-testid={testId} className={`px-3 py-2 ${numeric ? "text-right tabular-nums" : ""}`}>
      {value === null ? <span className="text-ink-3">—</span> : value}
    </td>
  );
}

/**
 * A cap field: empty is no cap. Not an integer after `Number(...)` is refused here and nothing is
 * sent (AC-13's `2.5`); any integer, `0` included, is sent so the database's refusal is the one shown.
 */
function parseCap(text: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, value: null };
  const value = Number(trimmed);
  return Number.isInteger(value) ? { ok: true, value } : { ok: false };
}

function OrgError({ testId, error }: { testId: string; error: string | null }): JSX.Element | null {
  return error ? (
    <p data-testid={testId} role="alert" className="text-sm text-danger">
      {error}
    </p>
  ) : null;
}

function CreateOrgForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }): JSX.Element {
  const [orgCode, setOrgCode] = useState("");
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await systemSeam.createOrg({ orgCode, name, timezone });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onDone();
  };

  return (
    <form
      data-testid="system-org-create-form"
      className="flex flex-col gap-3 rounded-xl bg-field/50 p-4"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <h3 className="text-sm font-bold text-ink">New org</h3>
      <label className={labelClass}>
        Org code
        <input
          data-testid="system-org-create-code"
          className={`${formFieldClass} font-mono`}
          value={orgCode}
          onChange={(event) => setOrgCode(event.target.value)}
        />
        <span className="text-xs font-normal text-ink-3">
          Lowercase letters, digits and hyphens. Cannot be changed later.
        </span>
      </label>
      <label className={labelClass}>
        Name
        <input
          data-testid="system-org-create-name"
          className={formFieldClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className={labelClass}>
        Timezone
        <input
          data-testid="system-org-create-timezone"
          className={formFieldClass}
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
        />
      </label>
      <div className="flex items-center gap-4">
        <button data-testid="system-org-create-submit" type="submit" className={smallPrimaryButtonClass} disabled={busy}>
          Create
        </button>
        <button data-testid="system-org-create-cancel" type="button" className={textButtonClass} onClick={onCancel}>
          Cancel
        </button>
      </div>
      <OrgError testId="system-org-create-error" error={error} />
    </form>
  );
}

function EditOrgForm({
  org,
  onDone,
  onCancel,
}: {
  org: OrgSummary;
  onDone: () => void;
  onCancel: () => void;
}): JSX.Element {
  const [name, setName] = useState(org.name);
  const [maxMembers, setMaxMembers] = useState(org.maxMembers === null ? "" : String(org.maxMembers));
  const [maxTeams, setMaxTeams] = useState(org.maxTeams === null ? "" : String(org.maxTeams));
  const [plan, setPlan] = useState(org.plan);
  const [licence, setLicence] = useState(org.licenceExpiresOn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const members = parseCap(maxMembers);
    const teams = parseCap(maxTeams);
    if (!members.ok || !teams.ok) {
      setError(ORG_FAILURE_MESSAGES.invalid_org_field);
      return;
    }
    setBusy(true);
    const result = await systemSeam.updateOrg({
      orgId: org.id,
      name,
      maxMembers: members.value,
      maxTeams: teams.value,
      plan,
      licenceExpiresOn: licence === "" ? null : licence,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onDone();
  };

  return (
    // `noValidate`: the browser's own `min`/`step` check would block `0` and `2.5` before the
    // panel's refusal (AC-13) could run.
    <form
      data-testid="system-org-edit-form"
      className="flex flex-col gap-3 rounded-xl bg-field/50 p-4"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <h3 className="text-sm font-bold text-ink">Edit org</h3>
      <p data-testid="system-org-edit-code" className="font-mono text-sm text-ink-2">
        {org.orgCode}
      </p>
      <label className={labelClass}>
        Name
        <input
          data-testid="system-org-edit-name"
          className={formFieldClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="flex flex-col gap-1">
        <div className="flex gap-3">
          <label className={`${labelClass} flex-1`}>
            Members cap
            <input
              data-testid="system-org-edit-max-members"
              type="number"
              min={1}
              className={formFieldClass}
              value={maxMembers}
              onChange={(event) => setMaxMembers(event.target.value)}
            />
          </label>
          <label className={`${labelClass} flex-1`}>
            Teams cap
            <input
              data-testid="system-org-edit-max-teams"
              type="number"
              min={1}
              className={formFieldClass}
              value={maxTeams}
              onChange={(event) => setMaxTeams(event.target.value)}
            />
          </label>
        </div>
        <span className="text-xs text-ink-3">Leave empty for no cap. Not enforced.</span>
      </div>
      <label className={labelClass}>
        Plan
        <input
          data-testid="system-org-edit-plan"
          className={formFieldClass}
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
        />
      </label>
      <label className={labelClass}>
        Licence expires
        <input
          data-testid="system-org-edit-licence"
          type="date"
          className={formFieldClass}
          value={licence}
          onChange={(event) => setLicence(event.target.value)}
        />
      </label>
      <div className="flex items-center gap-4">
        <button data-testid="system-org-edit-submit" type="submit" className={smallPrimaryButtonClass} disabled={busy}>
          Save
        </button>
        <button data-testid="system-org-edit-cancel" type="button" className={textButtonClass} onClick={onCancel}>
          Cancel
        </button>
      </div>
      <OrgError testId="system-org-edit-error" error={error} />
    </form>
  );
}

// MIR-15-b — Org public's holidays (01-plan.md §§ 2b, 4.6; ADR-079). The two effect labels are the
// member app's, written out here: the panel imports nothing from `HolidayForm`.
const EFFECT_LABELS: Record<HolidayKind, string> = {
  non_working: "Not a working day",
  working: "A working day",
};

function NationalHolidayForm({
  holiday,
  onDone,
  onCancel,
}: {
  holiday: Holiday | null; // null: add
  onDone: (date: string) => void;
  onCancel: () => void;
}): JSX.Element {
  const [date, setDate] = useState(holiday?.date ?? "");
  const [name, setName] = useState(holiday?.name ?? "");
  const [kind, setKind] = useState<HolidayKind>(holiday?.kind ?? "non_working");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    // An empty date cannot be sent as a `date`; the name is sent as given and the RPC refuses blank.
    if (date === "") {
      setError(HOLIDAY_FAILURE_MESSAGES.invalid_holiday);
      return;
    }
    setBusy(true);
    const input = { date, name, kind };
    const result = holiday
      ? await systemSeam.updateNationalHoliday(holiday.id, input)
      : await systemSeam.addNationalHoliday(input);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onDone(date);
  };

  return (
    <form
      data-testid="system-holiday-form"
      className="flex flex-col gap-3 rounded-xl bg-field/50 p-4"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <h3 className="text-sm font-bold text-ink">{holiday ? "Edit day" : "Add a day"}</h3>
      <div className="flex flex-wrap gap-3">
        <label className={`${labelClass} w-44`}>
          Date
          <input
            data-testid="system-holiday-form-date"
            type="date"
            className={`${formFieldClass} tabular-nums`}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label className={`${labelClass} min-w-48 flex-1`}>
          Name
          <input
            data-testid="system-holiday-form-name"
            className={formFieldClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className={`${labelClass} w-48`}>
          Effect
          <select
            data-testid="system-holiday-form-kind"
            className={formFieldClass}
            value={kind}
            onChange={(event) => setKind(event.target.value as HolidayKind)}
          >
            <option value="non_working">{EFFECT_LABELS.non_working}</option>
            <option value="working">{EFFECT_LABELS.working}</option>
          </select>
        </label>
      </div>
      <div className="flex items-center gap-4">
        <button data-testid="system-holiday-form-submit" type="submit" className={smallPrimaryButtonClass} disabled={busy}>
          Save
        </button>
        <button data-testid="system-holiday-form-cancel" type="button" className={textButtonClass} onClick={onCancel}>
          Cancel
        </button>
      </div>
      <OrgError testId="system-holiday-form-error" error={error} />
    </form>
  );
}

type HolidayFormState = { kind: "add" } | { kind: "edit"; holiday: Holiday } | null;

function NationalHolidays(): JSX.Element {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [form, setForm] = useState<HolidayFormState>(null);
  const [confirming, setConfirming] = useState<Holiday | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Only the latest read may land: moving through years quickly must not show an older year's rows.
  const readCounter = useRef(0);

  const load = async (forYear: number) => {
    readCounter.current += 1;
    const read = readCounter.current;
    setListError(null);
    const result = await systemSeam.listNationalHolidays({ start: `${forYear}-01-01`, end: `${forYear}-12-31` });
    if (read !== readCounter.current) return;
    if (!result.ok) {
      setListError(result.error.message);
      return;
    }
    setHolidays(result.value);
  };

  useEffect(() => {
    setHolidays(null);
    void load(year);
  }, [year]); // Read on arrival and on each year change; writes re-read through `load` directly.

  const moveYear = (delta: number) => {
    setForm(null);
    setConfirming(null);
    setYear((current) => current + delta);
  };

  // Read again after every successful write rather than patching local state. After an add, the
  // year follows the added date.
  const saved = (date: string) => {
    const savedYear = Number(date.slice(0, 4));
    const added = form?.kind === "add";
    setForm(null);
    if (added && savedYear !== year) {
      setYear(savedYear);
      return;
    }
    void load(year);
  };

  const remove = async (holiday: Holiday) => {
    setDeleting(true);
    setDeleteError(null);
    const result = await systemSeam.deleteNationalHoliday(holiday.id);
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error.message);
      return;
    }
    setConfirming(null);
    void load(year);
  };

  const askToRemove = (holiday: Holiday) => {
    setDeleteError(null);
    setConfirming(holiday);
  };

  let list: JSX.Element;
  if (listError) {
    list = (
      <div className="flex flex-col items-start gap-2">
        <p data-testid="system-holidays-error" role="alert" className="text-sm text-danger">
          {listError}
        </p>
        <button data-testid="system-holidays-retry" type="button" className={textButtonClass} onClick={() => void load(year)}>
          Try again
        </button>
      </div>
    );
  } else if (holidays === null) {
    list = (
      <p data-testid="system-holidays-loading" role="status" className="text-ink-3">
        Loading holidays…
      </p>
    );
  } else if (holidays.length === 0) {
    list = (
      <p data-testid="system-holidays-empty" className="text-ink-3">
        No holidays in {year}.
      </p>
    );
  } else {
    list = (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap text-ink">
          <thead>
            <tr className="border-b border-line">
              <th className={headerCellClass}>Date</th>
              <th className={headerCellClass}>Name</th>
              <th className={headerCellClass}>Effect</th>
              <th className={headerCellClass}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {holidays.map((holiday) => (
              <HolidayRow
                key={holiday.id}
                holiday={holiday}
                confirming={confirming?.id === holiday.id}
                deleting={deleting}
                deleteError={confirming?.id === holiday.id ? deleteError : null}
                onEdit={() => {
                  setConfirming(null);
                  setForm({ kind: "edit", holiday });
                }}
                onDelete={() => askToRemove(holiday)}
                onAccept={() => void remove(holiday)}
                onKeep={() => setConfirming(null)}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section data-testid="system-holidays" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">
          National holidays <span className="text-sm font-normal text-ink-3">Org public</span>
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              data-testid="system-holidays-prev"
              type="button"
              aria-label="Previous year"
              className="rounded-pill px-2 py-1 text-ink-2 hover:bg-field"
              onClick={() => moveYear(-1)}
            >
              ‹
            </button>
            <span data-testid="system-holidays-year" data-year={year} className="text-sm font-semibold tabular-nums text-ink">
              {year}
            </span>
            <button
              data-testid="system-holidays-next"
              type="button"
              aria-label="Next year"
              className="rounded-pill px-2 py-1 text-ink-2 hover:bg-field"
              onClick={() => moveYear(1)}
            >
              ›
            </button>
          </div>
          <button
            data-testid="system-holiday-new"
            type="button"
            className={smallPrimaryButtonClass}
            onClick={() => {
              setConfirming(null);
              setForm({ kind: "add" });
            }}
          >
            Add a day
          </button>
        </div>
      </div>
      {/* One form at a time; the key remounts the form when another row's Edit is pressed. */}
      {form ? (
        <NationalHolidayForm
          key={form.kind === "edit" ? form.holiday.id : "add"}
          holiday={form.kind === "edit" ? form.holiday : null}
          onDone={saved}
          onCancel={() => setForm(null)}
        />
      ) : null}
      {list}
    </section>
  );
}

function HolidayRow({
  holiday,
  confirming,
  deleting,
  deleteError,
  onEdit,
  onDelete,
  onAccept,
  onKeep,
}: {
  holiday: Holiday;
  confirming: boolean;
  deleting: boolean;
  deleteError: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onAccept: () => void;
  onKeep: () => void;
}): JSX.Element {
  const question = `Remove ${holiday.date} — ${holiday.name} from the national calendar?`;
  return (
    <>
      <tr data-testid="system-holiday-row" data-date={holiday.date} className="border-b border-line last:border-b-0">
        <td data-testid="system-holiday-row-date" className="px-3 py-2 tabular-nums">
          {holiday.date}
        </td>
        <td data-testid="system-holiday-row-name" className="px-3 py-2">
          {holiday.name}
        </td>
        <td data-testid="system-holiday-row-effect" className="px-3 py-2">
          {EFFECT_LABELS[holiday.kind]}
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex justify-end gap-4">
            <button data-testid="system-holiday-row-edit" type="button" className={textButtonClass} onClick={onEdit}>
              Edit
            </button>
            <button data-testid="system-holiday-row-delete" type="button" className={textButtonClass} onClick={onDelete}>
              Delete
            </button>
          </div>
        </td>
      </tr>
      {confirming ? (
        <tr className="border-b border-line">
          <td colSpan={4} className="px-3 py-2">
            <div
              data-testid="system-holiday-delete-confirm"
              role="alertdialog"
              aria-label={question}
              className="flex flex-col gap-2 rounded-xl bg-field/50 p-3 whitespace-normal"
            >
              <p className="text-sm text-ink">{question}</p>
              <div className="flex items-center gap-4">
                <button
                  data-testid="system-holiday-delete-accept"
                  type="button"
                  className={smallPrimaryButtonClass}
                  disabled={deleting}
                  onClick={onAccept}
                >
                  Remove
                </button>
                <button data-testid="system-holiday-delete-cancel" type="button" className={textButtonClass} onClick={onKeep}>
                  Keep
                </button>
              </div>
              <OrgError testId="system-holiday-delete-error" error={deleteError} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

// MIR-16 — issue reports move to the system panel (01-plan.md §§ 2b, 4.5; ADR-082).
const KIND_LABELS: Record<IssueKind, string> = { bug: "Bug", idea: "Idea", other: "Other" };
const STATUS_LABELS: Record<IssueStatus, string> = { open: "Open", done: "Done" };

function IssueReportRow({
  report,
  images,
  error,
  onToggle,
}: {
  report: SystemIssueReport;
  /** `null` until this report's URLs have been minted; a slot's own entry is `null` when minting it
   *  failed. Both render the same "Image unavailable" placeholder (§ 4.5). */
  images: (string | null)[] | null;
  error: string | null;
  onToggle: () => void;
}): JSX.Element {
  return (
    <div
      data-testid="system-issue-row"
      data-id={report.id}
      data-status={report.status}
      className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0"
    >
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span data-testid="system-issue-row-date" className="tabular-nums text-ink-3">
          {format(parseISO(report.createdAt), "yyyy-MM-dd HH:mm")}
        </span>
        <span data-testid="system-issue-row-org" className="text-ink-2">
          {report.orgName}
        </span>
        <span data-testid="system-issue-row-author" className="text-ink-2">
          {report.memberName ?? "Removed member"}
        </span>
        <span
          data-testid="system-issue-row-kind"
          className="rounded-pill bg-field px-2 py-0.5 text-xs font-semibold text-ink-2"
        >
          {KIND_LABELS[report.kind]}
        </span>
        <span data-testid="system-issue-row-page" className="font-mono text-xs text-ink-3">
          {report.page}
        </span>
        <span data-testid="system-issue-row-status" className="text-ink-2">
          {STATUS_LABELS[report.status]}
        </span>
        <button
          data-testid="system-issue-row-toggle"
          type="button"
          className={`${textButtonClass} ml-auto`}
          onClick={onToggle}
        >
          {report.status === "open" ? "Mark done" : "Reopen"}
        </button>
      </div>
      <p data-testid="system-issue-row-message" className="text-sm whitespace-pre-wrap text-ink">
        {report.message}
      </p>
      {report.images.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {report.images.map((path, index) => {
            const url = images ? images[index] : null;
            return url ? (
              <a key={path} href={url} target="_blank" rel="noreferrer">
                <img
                  data-testid="system-issue-row-image"
                  src={url}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-xl object-cover"
                />
              </a>
            ) : (
              <span
                key={path}
                data-testid="system-issue-row-image"
                className="flex h-16 w-16 items-center justify-center rounded-xl bg-field p-1 text-center text-xs text-ink-3"
              >
                Image unavailable
              </span>
            );
          })}
        </div>
      ) : null}
      <OrgError testId="system-issue-row-error" error={error} />
    </div>
  );
}

function IssueReports(): JSX.Element {
  const [reports, setReports] = useState<SystemIssueReport[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Map<string, (string | null)[]>>(new Map());
  const [rowErrors, setRowErrors] = useState<Map<string, string>>(new Map());
  // Only the latest read may land: a retry racing an earlier one must not show the stale answer.
  const readCounter = useRef(0);

  const load = async () => {
    readCounter.current += 1;
    const read = readCounter.current;
    setListError(null);
    const result = await systemSeam.listIssueReports();
    if (read !== readCounter.current) return;
    if (!result.ok) {
      setListError(result.error.message);
      return;
    }
    setReports(result.value);
    setImageUrls(new Map());
    // One mint per report that carries images, for every load (§ 4.5).
    for (const report of result.value) {
      if (report.images.length === 0) continue;
      void systemSeam.issueImageUrls(report.images).then((urls) => {
        if (read !== readCounter.current) return;
        setImageUrls((prev) => new Map(prev).set(report.id, urls));
      });
    }
  };

  useEffect(() => {
    void load();
  }, []); // Read once, on arriving at `signed-in`.

  const toggle = async (report: SystemIssueReport) => {
    setRowErrors((prev) => {
      const next = new Map(prev);
      next.delete(report.id);
      return next;
    });
    const nextStatus: IssueStatus = report.status === "open" ? "done" : "open";
    const result = await systemSeam.setIssueReportStatus(report.id, nextStatus);
    if (!result.ok) {
      setRowErrors((prev) => new Map(prev).set(report.id, result.error.message));
      return;
    }
    void load();
  };

  const openCount = reports?.filter((report) => report.status === "open").length ?? 0;

  let body: JSX.Element;
  if (listError) {
    body = (
      <div className="flex flex-col items-start gap-2">
        <p data-testid="system-issues-error" role="alert" className="text-sm text-danger">
          {listError}
        </p>
        <button data-testid="system-issues-retry" type="button" className={textButtonClass} onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  } else if (reports === null) {
    body = (
      <p data-testid="system-issues-loading" role="status" className="text-ink-3">
        Loading issue reports…
      </p>
    );
  } else if (reports.length === 0) {
    body = (
      <p data-testid="system-issues-empty" className="text-ink-3">
        No issue reports.
      </p>
    );
  } else {
    body = (
      <div className="flex flex-col">
        {reports.map((report) => (
          <IssueReportRow
            key={report.id}
            report={report}
            images={imageUrls.get(report.id) ?? null}
            error={rowErrors.get(report.id) ?? null}
            onToggle={() => void toggle(report)}
          />
        ))}
      </div>
    );
  }

  return (
    <section data-testid="system-issues" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Issue reports</h2>
        <span data-testid="system-issues-open-count" data-count={openCount} className="text-sm font-normal text-ink-3">
          {openCount} open
        </span>
      </div>
      {body}
    </section>
  );
}

type OpenForm = { kind: "create" } | { kind: "edit"; org: OrgSummary } | null;

function OrgManagement({ email, onSignOut }: { email: string; onSignOut: () => void }): JSX.Element {
  const [orgs, setOrgs] = useState<OrgSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [form, setForm] = useState<OpenForm>(null);

  // Read again after every successful write rather than patching local state (§ 4.5). The list
  // already shown stays while a re-read is in flight.
  const load = async () => {
    setListError(null);
    const result = await systemSeam.listOrgs();
    if (!result.ok) {
      setListError(result.error.message);
      return;
    }
    setOrgs(result.value);
  };

  useEffect(() => {
    void load();
  }, []); // Read once on arriving at `signed-in`.

  const done = () => {
    setForm(null);
    void load();
  };

  let list: JSX.Element;
  if (listError) {
    list = (
      <div className="flex flex-col items-start gap-2">
        <p data-testid="system-orgs-error" role="alert" className="text-sm text-danger">
          {listError}
        </p>
        <button data-testid="system-orgs-retry" type="button" className={textButtonClass} onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  } else if (orgs === null) {
    list = (
      <p data-testid="system-orgs-loading" role="status" className="text-ink-3">
        Loading orgs…
      </p>
    );
  } else {
    list = (
      <div data-testid="system-orgs" className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap text-ink">
          <thead>
            <tr className="border-b border-line">
              <th className={headerCellClass}>Code</th>
              <th className={headerCellClass}>Name</th>
              <th className={headerCellClass}>Timezone</th>
              <th className={`${headerCellClass} text-right`}>Members cap</th>
              <th className={`${headerCellClass} text-right`}>Teams cap</th>
              <th className={headerCellClass}>Plan</th>
              <th className={headerCellClass}>Licence expires</th>
              <th className={headerCellClass}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id} data-testid="system-org-row" data-org-code={org.orgCode} className="border-b border-line last:border-b-0">
                <td data-testid="system-org-code" className="px-3 py-2 font-mono">
                  {org.orgCode}
                </td>
                <td data-testid="system-org-name" className="px-3 py-2">
                  {org.name}
                </td>
                <td data-testid="system-org-timezone" className="px-3 py-2">
                  {org.timezone}
                </td>
                <NullableCell testId="system-org-max-members" value={org.maxMembers} numeric />
                <NullableCell testId="system-org-max-teams" value={org.maxTeams} numeric />
                <td data-testid="system-org-plan" className="px-3 py-2">
                  {org.plan}
                </td>
                <NullableCell testId="system-org-licence" value={org.licenceExpiresOn} />
                <td className="px-3 py-2 text-right">
                  {org.isSharedTenant ? (
                    <span
                      data-testid="system-org-shared"
                      className="rounded-pill bg-holiday px-3 py-1 text-xs font-semibold text-ink-2"
                    >
                      Shared
                    </span>
                  ) : (
                    <button
                      data-testid="system-org-edit"
                      type="button"
                      className={textButtonClass}
                      onClick={() => setForm({ kind: "edit", org })}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div data-testid="system-signed-in" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold text-ink">System panel</h1>
          <p className="text-ink-2">
            Signed in as <span data-testid="system-signed-in-email">{email}</span>
          </p>
          <span className="self-start rounded-pill bg-wfh px-3 py-1 text-xs font-semibold text-wfh-ink">
            Two-step verified
          </span>
        </div>
        <button data-testid="system-signout" type="button" className={smallSecondaryButtonClass} onClick={onSignOut}>
          Sign out
        </button>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">
            Orgs {orgs ? <span className="font-normal text-ink-3">{orgs.length}</span> : null}
          </h2>
          <button
            data-testid="system-org-new"
            type="button"
            className={smallPrimaryButtonClass}
            onClick={() => setForm({ kind: "create" })}
          >
            New org
          </button>
        </div>
        {/* One form at a time; the key remounts the edit form when another org's Edit is pressed. */}
        {form?.kind === "create" ? <CreateOrgForm onDone={done} onCancel={() => setForm(null)} /> : null}
        {form?.kind === "edit" ? (
          <EditOrgForm key={form.org.id} org={form.org} onDone={done} onCancel={() => setForm(null)} />
        ) : null}
        {list}
      </section>

      <NationalHolidays />

      <IssueReports />
    </div>
  );
}

function CodeForm({
  onSubmit,
  error,
  busy,
}: {
  onSubmit: (code: string) => void;
  error: string | null;
  busy: boolean;
}): JSX.Element {
  const [code, setCode] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(code);
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <input
        data-testid="system-code-input"
        aria-label="6-digit code"
        className={`${fieldClass} text-center text-lg tracking-[0.4em]`}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <button data-testid="system-code-submit" type="submit" className={primaryButtonClass} disabled={busy}>
        Verify
      </button>
      {error ? (
        <p data-testid="system-code-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function SystemPanel(): JSX.Element {
  const [gate, setGate] = useState<SystemGate | null>(null);
  const [enrolment, setEnrolment] = useState<TotpEnrolment | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Every transition goes through here, so the enrolment is started exactly when `enrol` arrives.
  const arrive = async (next: SystemGate) => {
    setCodeError(null);
    setEnrolment(null);
    if (next.state === "enrol") {
      try {
        setEnrolment(await systemSeam.startEnrolment());
      } catch {
        setCodeError(START_ENROLMENT_FAILED);
      }
    }
    setGate(next);
  };

  useEffect(() => {
    let live = true;
    void systemSeam.gate().then((next) => {
      if (live) void arrive(next);
    });
    return () => {
      live = false;
    };
  }, []); // The gate is read once, on mount.

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setSignInError(null);
    const result = await systemSeam.signIn(email, password);
    setBusy(false);
    if (!result.ok) {
      setSignInError(result.error.message);
      return;
    }
    setPassword("");
    await arrive(result.value);
  };

  const verify = async (code: string) => {
    setBusy(true);
    setCodeError(null);
    const result = await systemSeam.verifyCode(code, enrolment?.factorId);
    setBusy(false);
    if (!result.ok) {
      setCodeError(result.error.message);
      return;
    }
    await arrive(result.value);
  };

  const signOut = async () => {
    await systemSeam.signOut();
    setSignInError(null);
    await arrive({ state: "signed-out" });
  };

  const backToSignIn = () => {
    setSignInError(null);
    setGate({ state: "signed-out" });
  };

  let screen: JSX.Element;
  if (gate === null) {
    screen = (
      <p data-testid="system-loading" role="status" className="text-ink-3">
        Loading…
      </p>
    );
  } else if (gate.state === "signed-out") {
    screen = (
      <form data-testid="system-signin-form" className="flex flex-col gap-3" onSubmit={signIn}>
        <h1 className="mb-2 text-xl font-bold text-ink">Sign in to the system panel</h1>
        <input
          data-testid="system-signin-email"
          aria-label="Email"
          placeholder="Email"
          type="email"
          autoComplete="username"
          className={fieldClass}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          data-testid="system-signin-password"
          aria-label="Password"
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          className={fieldClass}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button data-testid="system-signin-submit" type="submit" className={primaryButtonClass} disabled={busy}>
          Sign in
        </button>
        {signInError ? (
          <p data-testid="system-signin-error" role="alert" className="text-sm text-danger">
            {signInError}
          </p>
        ) : null}
      </form>
    );
  } else if (gate.state === "not-system-admin") {
    screen = (
      <div data-testid="system-not-authorised" className="flex flex-col gap-3">
        <h1 className="text-xl font-bold text-ink">No access</h1>
        <p className="text-ink-2">This account has no access to the system panel.</p>
        <button
          data-testid="system-not-authorised-back"
          type="button"
          className={`${textButtonClass} self-start`}
          onClick={backToSignIn}
        >
          Back to sign in
        </button>
      </div>
    );
  } else if (gate.state === "enrol") {
    screen = (
      <div data-testid="system-enrol" className="flex flex-col gap-3">
        <h1 className="text-xl font-bold text-ink">Set up two-step sign-in</h1>
        <p className="text-ink-2">
          Scan this code with an authenticator app, then enter the 6-digit code it shows.
        </p>
        {enrolment ? (
          <>
            <div className="flex justify-center">
              <img
                data-testid="system-enrol-qr"
                src={enrolment.qrCode}
                alt="Authenticator set-up code"
                width={176}
                height={176}
                className="h-44 w-44 rounded-xl bg-white p-2"
              />
            </div>
            <div>
              <p className="text-xs text-ink-3">Or enter this key</p>
              <p data-testid="system-enrol-secret" className="font-mono text-xs break-all text-ink-2">
                {enrolment.secret}
              </p>
            </div>
          </>
        ) : null}
        <CodeForm onSubmit={(code) => void verify(code)} error={codeError} busy={busy || !enrolment} />
      </div>
    );
  } else if (gate.state === "verify") {
    screen = (
      <div data-testid="system-verify" className="flex flex-col gap-3">
        <h1 className="text-xl font-bold text-ink">Enter your code</h1>
        <p className="text-ink-2">Open your authenticator app and enter the 6-digit code.</p>
        <CodeForm onSubmit={(code) => void verify(code)} error={codeError} busy={busy} />
        <button
          data-testid="system-signout"
          type="button"
          className={`${textButtonClass} self-center`}
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </div>
    );
  } else {
    screen = <OrgManagement email={gate.email} onSignOut={() => void signOut()} />;
  }

  return (
    <div data-testid="system-panel-root" className="min-h-screen bg-bg px-4 py-10 font-sans">
      {/* Written out again rather than imported: the panel does not import `App.tsx` (§ 4.5). */}
      {systemSeamName === "mock" ? (
        <p
          data-testid="seam-banner"
          data-seam="mock"
          role="status"
          className="mx-auto mb-6 max-w-md rounded-xl bg-amber-100 px-4 py-2 text-center text-sm text-amber-900"
        >
          Demo build — data lives only in this browser and is lost when you reload the page.
        </p>
      ) : null}
      <div className={`mx-auto ${gate?.state === "signed-in" ? "max-w-4xl" : "max-w-sm"}`}>
        <p className="mb-3 text-center text-xs font-semibold tracking-wide text-ink-3 uppercase">
          CaleChip · System
        </p>
        <div className="rounded-card bg-card p-8">{screen}</div>
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from system.html");

createRoot(root).render(
  <StrictMode>
    <SystemPanel />
  </StrictMode>,
);

// ADM-01 — set the overload threshold. 01-plan.md sections 3, 4.1 and 4.3.
//
// **SOLO, 2026-09-11 — THIS SCREEN IS NOW THE TEAM'S SETTINGS AND THE THRESHOLD IS ONE OF THEM.**
// The operator asked for *"nơi quản lí list Teams ở admin"* and chose, when shown the three shapes,
// the single-team one: name, member count, created date and threshold on one screen.
//
// **IT EXTENDS THIS SCREEN RATHER THAN ADDING `/team`, AND THE ADDRESS NO LONGER MATCHES THE
// CONTENT.** That mismatch is the accepted cost and it is the smaller one. This file is the only
// screen in the product that writes `public.team`, so putting the name here keeps ONE editor for
// each column; a separate `/team` screen would either duplicate the threshold control or leave two
// admin tabs talking about one team. Re-addressing is what UIE-09's plan refused in terms — *"it
// re-addresses four shipped screens, changes every `page.goto` in their refusal tests, changes each
// screen's own back link"* — and six specs point at `/threshold` today. The TAB is renamed to
// `Team`, which is what an admin reads; no spec asserts a tab's name.
//
// **SOLO, 2026-09-11, LATER THE SAME DAY — THE PARAGRAPH ABOVE IS SUPERSEDED BY THE OPERATOR.** Asked
// where the approval switches should live, they chose to re-address this screen to `/setting` and name
// the tab `Settings`, knowingly paying the cost that paragraph declined: every `page.goto` in the
// refusal tests moved with it. `/threshold` redirects here so an old link still lands. The file keeps
// its name and every `threshold-*` id keeps its spelling — the threshold control still exists on this
// screen, and seventy-odd assertions address those ids rather than the path.
//
// **EVERY `threshold-*` ID IS UNCHANGED, and that is what keeps ADM-01's eleven criteria passing
// unedited.** The threshold block below is the one this file shipped, moved under an `<h2>` and
// otherwise untouched. The name block is new and every id in it begins `team-`.
//
// EVERYTHING in this file is an affordance (ADR-005). The check lives in row-level security and
// nowhere else: `team_update_admin` plus `grant update (overload_threshold) on public.team` refuse a
// member, a removed member, another team and every column other than the one, whoever issues the
// statement. What is below hides a control the policy would refuse anyway, which saves a round trip
// and says why — it enforces nothing. AC-5 is the criterion that proves it: it calls the seam
// function past every control this file draws.
//
// THE SCREEN IS THE ONE EDGE THAT SPEAKS PERCENT. `Team.overloadThreshold` is a SHARE and the seam
// declares the fraction form on `SetOverloadThresholdInput`; `src/lib/data/absence.ts` compares a
// share on both sides. The two conversions below are the only ones in the product, and putting them
// in `src/lib/` would create a second place that knows the representation (01-plan.md section 5).
import { useCallback, useEffect, useState } from "react";
// SOLO, 2026-09-12. **RESTORED.** On 2026-09-10 this import was deleted because `pnpm lint` failed
// on it: another session had removed the `threshold-back` link and left the import orphaned. That
// link is on the screen again (:593) and the import was not restored with it, so `pnpm typecheck`
// failed with `Cannot find name 'Link'` twice. Recorded rather than silently re-added, because the
// round trip is the useful part: this file has now been edited by two sessions in two days, and the
// only thing that caught either half was a typecheck nobody ran.
// The seam, through its one door: nothing above the seam names an implementation, so this file must
// never import `@/lib/data/supabase` or `@/lib/data/mock`.
import { seam } from "@/lib/data";
import type { Failure, Member, Team } from "@/lib/domain/types";
import { mayAdminister } from "@/lib/roles";
// SOLO, 2026-09-11. INV-04's denominator, imported rather than counted here: the member count this
// screen shows and the `N` in the week view's `0/4` must be the same number, and `absence.ts` is the
// one place that decides what "currently a member" means (ADR-013's removed-member rule).
import { currentMemberCount } from "@/lib/data/absence";
// SOLO, 2026-09-11 — the loading mark that replaced this screen's sentence. The sentence itself is
// still announced: `Loader.tsx` keeps it as `sr-only` text, because the element below carries
// `role="status"` and an emptied one announces nothing.
import Loader from "@/components/Loader";

/** The stored share as the whole percent the screen speaks in. AC-1. */
const toPercent = (share: number): number => Math.round(share * 100);

/** The whole percent back to the share the column holds. AC-2. */
const toShare = (percent: number): number => percent / 100;

/** AC-8. A WHOLE percentage, so a fractional, an empty and a non-numeric value are all refused by
 *  the same test. Written as a pattern rather than as `Number.isInteger(Number(v))` because
 *  `Number("")` is `0` and `Number(" ")` is `0` — both would pass a numeric check and save a
 *  threshold nobody typed. */
const WHOLE_NUMBER = /^-?\d+$/;

const NOT_WHOLE = "Enter a whole percentage, with no decimal point.";
const OUT_OF_RANGE = "The threshold must be between 0% and 100%, inclusive.";

// The four states of design section 4.3, mirroring the `View` union AllowList.tsx and
// TeamEntries.tsx already carry. `loading` MUST resolve, which is why every path out of the effect
// below sets one of the other three.
//
// `ready` IS ADMIN-ONLY. Design section 4.3 shows `threshold-refused` for a member as well as for a
// caller with no member row (AC-4, AC-6), so a member never reaches this phase — which makes the
// "ready, admin" qualifier on the input and the save control in that table hold trivially rather
// than describing a second shape of `ready`.
type View =
  | { phase: "loading" }
  | { phase: "refused" }
  | { phase: "unavailable" }
  // SOLO, 2026-09-11 adds `roster`. It is here for the member count and for nothing else, and it is
  // the UNFILTERED roster `listMembers()` returns — `currentMemberCount` needs `removedAt` per member
  // to apply ADR-013's rule, so a pre-filtered list could not answer it.
  | { phase: "ready"; me: Member; team: Team; roster: Member[] };

export default function Threshold() {
  const [view, setView] = useState<View>({ phase: "loading" });

  const [percent, setPercent] = useState("");
  const [saving, setSaving] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<Failure | null>(null);
  const [saved, setSaved] = useState(false);

  // SOLO, 2026-09-11. The name form's own four pieces of state, deliberately NOT shared with the
  // threshold form's above. Two forms that shared a `saving` flag would grey out each other's button
  // and, worse, a shared `saved` banner would appear under the control nobody pressed.
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<Failure | null>(null);
  const [renamed, setRenamed] = useState(false);

  // SOLO, 2026-09-11. The approval form's own state, NOT shared with either form above for the reason
  // the name form gives: a shared `saving` would grey out a button nobody pressed.
  const [wfhNeed, setWfhNeed] = useState(true);
  const [ptoNeed, setPtoNeed] = useState(true);
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [approvalError, setApprovalError] = useState<Failure | null>(null);
  const [approvalSaved, setApprovalSaved] = useState(false);

  // AC-1, AC-3. The value is READ on mount and never carried in from anywhere — a screen opened a
  // second time asks the seam again, which is the whole of AC-3.
  const load = useCallback(async (): Promise<void> => {
    try {
      const me = await seam.getCurrentMember();

      // AC-4 and AC-6 in one branch, and deliberately so: a member, a caller with no member row and
      // a caller with no session all land here and are told the same thing. Distinguishing them
      // would tell somebody outside the team that a team exists and has a threshold, which is the
      // half of AC-6 that is about disclosure rather than about display.
      if (!me || !mayAdminister(me.role)) {
        setView({ phase: "refused" });
        return;
      }

      // SOLO, 2026-09-11 adds the roster read, in the same `Promise.all` rather than after the team:
      // the two are independent and a sequential await would add a round trip to a screen that is
      // already two deep. It throws on a truncated answer, which lands in the same `unavailable`
      // branch below — a short roster would understate the member count, which is the quiet kind of
      // wrong this screen must not show beside a threshold measured against it.
      const [team, roster] = await Promise.all([seam.getTeam(), seam.listMembers()]);
      if (!team) {
        // An admin whose own team row does not come back. `team_select_own` returns it for every
        // caller with a member row, so this is a build where CAL-04's migration has not been
        // applied — not a refusal, and folding it into `refused` would tell an admin they are not
        // one. TeamEntries.tsx records the same choice for the same reason.
        setView({ phase: "unavailable" });
        return;
      }

      setPercent(String(toPercent(team.overloadThreshold)));
      setName(team.name);
      setWfhNeed(team.wfhNeedApprove);
      setPtoNeed(team.ptoNeedApprove);
      setView({ phase: "ready", me, team, roster });
    } catch {
      // A transport failure, or the Supabase client raising on an unusable configuration before any
      // request leaves. Design section 4.3 gives this screen an `unavailable` phase precisely so a
      // broken connection does not have to be reported as a permission refusal.
      setView({ phase: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // SOLO, 2026-09-11. **THE EMPTY-NAME REFUSAL IS NOT REPEATED HERE, AND THAT IS THE DECISION.**
  // The threshold form above validates BEFORE it calls, because its range is a product decision with
  // no `check` constraint behind it — there is nothing in the datastore to consult. The empty name is
  // different: both seam implementations refuse it, so the round trip returns `empty_team_name` with
  // a sentence already written, and a second copy of the test here would be a second place to keep
  // true. The button is disabled on an empty field, which is an affordance and not the control.
  async function onRename(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (renaming || view.phase !== "ready") return;

    setRenamed(false);
    setRenameError(null);
    setRenaming(true);
    try {
      // SOLO, 2026-09-11 — many teams: `renameTeam` takes the team's id now. This screen renames the
      // caller's own team, so it passes that one.
      const result = await seam.renameTeam(view.team.id, { name });
      if (result.ok) {
        // The row the DATASTORE returned, not the string that was typed — the seam trims, so the
        // field is refilled with what was actually stored rather than with trailing spaces the
        // person cannot see.
        setView({ phase: "ready", me: view.me, team: result.value, roster: view.roster });
        setName(result.value.name);
        setRenamed(true);
      } else {
        setRenameError(result.error);
      }
    } catch {
      setRenameError({ code: "unknown", message: "Could not save the name. Please try again." });
    } finally {
      setRenaming(false);
    }
  }

  // SOLO, 2026-09-11. Both switches in one call, always — `SetApprovalSettingsInput` says why.
  // Nothing to validate first: two booleans have no out-of-range value, which is why this has no
  // `approval-input-error` the way the threshold form has `threshold-input-error`.
  async function onSaveApproval(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (approvalSaving || view.phase !== "ready") return;

    setApprovalSaved(false);
    setApprovalError(null);
    setApprovalSaving(true);
    try {
      const result = await seam.setApprovalSettings({ wfhNeedApprove: wfhNeed, ptoNeedApprove: ptoNeed });
      if (result.ok) {
        // The row the DATASTORE returned, not the two checkboxes — so `approval-current` below
        // reports what is stored, and the switches are refilled from it.
        setView({ phase: "ready", me: view.me, team: result.value, roster: view.roster });
        setWfhNeed(result.value.wfhNeedApprove);
        setPtoNeed(result.value.ptoNeedApprove);
        setApprovalSaved(true);
      } else {
        setApprovalError(result.error);
      }
    } catch {
      setApprovalError({ code: "unknown", message: "Could not save the approval settings. Please try again." });
    } finally {
      setApprovalSaving(false);
    }
  }

  async function onSave(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (saving || view.phase !== "ready") return;

    setSaved(false);
    setSaveError(null);

    // AC-7 and AC-8. VALIDATION HAPPENS BEFORE THE CALL, not after it: a refused value issues
    // nothing at all, so there is no write to undo and the stored value cannot change. There is no
    // `check` constraint behind this column (01-plan.md section 6), so this is where the range is
    // decided — and it is a product decision (Open question 2), not a datastore truth.
    const raw = percent.trim();
    if (!WHOLE_NUMBER.test(raw)) {
      setInputError(NOT_WHOLE);
      return;
    }
    const value = Number(raw);
    if (value < 0 || value > 100) {
      setInputError(OUT_OF_RANGE);
      return;
    }
    setInputError(null);

    setSaving(true);
    try {
      // AC-9. ONE FIELD, and no team is passed and none can be: the seam reads the row from the
      // caller and the policy re-derives it.
      const result = await seam.setOverloadThreshold({ overloadThreshold: toShare(value) });
      if (result.ok) {
        // AC-2, AC-12. The row the DATASTORE returned, not the number that was typed — the
        // `.select()` on the update is what makes the two distinguishable, and a refusal comes back
        // as `not_permitted` rather than as a value.
        // SOLO, 2026-09-11 carries `roster` through. The threshold write does not touch the roster,
        // so re-reading it here would be a second read of a fact this screen already holds — and one
        // that could disagree with the count drawn two blocks up.
        setView({ phase: "ready", me: view.me, team: result.value, roster: view.roster });
        setPercent(String(toPercent(result.value.overloadThreshold)));
        setSaved(true);
      } else {
        // AC-5 arriving at a screen. It is reachable here only for an admin whose write the policy
        // refused anyway — a removed one, or a build with no `team_update_admin`.
        setSaveError(result.error);
      }
    } catch {
      setSaveError({ code: "unknown", message: "Could not save the threshold. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  if (view.phase === "loading") {
    return (
      <p
        data-testid="threshold-loading"
        role="status"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
      >
        <Loader label="Opening the setting…" />
      </p>
    );
  }

  if (view.phase === "refused") {
    return (
      <section
        data-testid="threshold-refused"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">This setting is for admins</h1>
        {/* AC-6. It names no team and no number: somebody outside the team learns nothing here
            beyond the fact that admins exist, which the sign-up screen already says. */}
        <p className="mt-2 text-sm opacity-70">
          Only an admin can change the share of the team above which a day is called crowded.
        </p>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <section
        data-testid="threshold-unavailable"
        role="alert"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">The threshold could not be loaded</h1>
        {/* No input is drawn on this path. An admin typing into a field whose current value never
            arrived would be replacing a number they never saw, which is the mistake AC-1 exists to
            prevent. */}
        <p className="mt-2 text-sm opacity-70">
          The setting could not be read just now. Try again in a moment.
        </p>
      </section>
    );
  }

  const { team, roster } = view;

  // SOLO, 2026-09-11. **THE ISO STRING IS SLICED AND NO `Date` IS CONSTRUCTED.** `createdAt` is a
  // stored instant, and every comparison on a stored date in this product goes through UTC —
  // `day-status.ts` records the trap at length: a local read west of UTC yields the previous day.
  // `toLocaleDateString` would also put a locale in a codebase whose § Language governs its strings.
  const createdOn = `${team.createdAt.slice(8, 10)}/${team.createdAt.slice(5, 7)}/${team.createdAt.slice(0, 4)}`;

  return (
    <section
      data-testid="team-settings"
      className="mx-auto flex max-w-md flex-col gap-8 rounded-2xl bg-white p-8 shadow-sm"
    >
      <header>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm opacity-70">
          The team&rsquo;s name, its size, when a day counts as crowded, and which entries need an
          admin&rsquo;s approval.
        </p>
      </header>

      {/* SOLO, 2026-09-11 — the name, and the two facts beside it that are read-only.
          **THE COUNT AND THE DATE ARE NOT EDITABLE AND COULD NOT BE.** `created_at` has no grant and
          the member count is not a column at all — it is `currentMemberCount(roster)`, INV-04's
          denominator, so this screen and the week view's `0/4` cannot disagree about the size of the
          team. A number computed here with a `.filter()` would be that second definition.
          THERE IS NO DELETE CONTROL AND NO "NEW TEAM" CONTROL, and neither is an omission:
          `public.team` has no insert policy and no delete policy, `.ai/standards/data-model.md`
          says *"One row in v1"* and *"Refuse. No delete path exists for a team in v1"*, and the
          operator chose the single-team shape after being shown what a second team would cost —
          `member_select_pending_admin` is not team-scoped, so every admin would see every pending
          sign-up. A control the datastore refuses is worse than no control: it teaches an admin the
          product can do something it cannot. */}
      <div className="flex flex-col gap-3">
        <form onSubmit={onRename} className="flex flex-col gap-3" aria-label="Rename the team">
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input
              data-testid="team-name-input"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setRenameError(null);
                setRenamed(false);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          {renameError ? (
            <p data-testid="team-name-error" role="alert" className="text-sm text-rose-600">
              {renameError.message}
            </p>
          ) : null}

          {renamed ? (
            <p data-testid="team-name-saved" role="status" className="text-sm text-emerald-700">
              Saved. The team is now called {team.name}.
            </p>
          ) : null}

          {/* DISABLED ON AN EMPTY FIELD, WHICH IS AN AFFORDANCE AND NOT THE CONTROL (ADR-005). Both
              seam implementations refuse an empty name and return `empty_team_name`; this only saves
              the round trip. `trim()` here matches the trim they do, so the button does not stay
              live for a field holding three spaces. */}
          <button
            data-testid="team-name-save"
            type="submit"
            disabled={renaming || name.trim() === ""}
            className="self-start rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
          >
            {renaming ? "Saving…" : "Save name"}
          </button>
        </form>

        <dl className="flex flex-wrap gap-x-8 gap-y-1 text-sm opacity-70">
          <div>
            <dt className="inline">Members: </dt>
            {/* `data-member-count` so a spec reads the number rather than parsing the sentence, the
                shape `threshold-current` below already uses for the share. */}
            <dd
              data-testid="team-member-count"
              data-member-count={currentMemberCount(roster)}
              className="inline font-medium text-ink"
            >
              {currentMemberCount(roster)}
            </dd>
          </div>
          <div>
            <dt className="inline">Created: </dt>
            <dd
              data-testid="team-created"
              data-created-at={team.createdAt}
              className="inline font-medium text-ink"
            >
              {createdOn}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col gap-6 border-t border-slate-200 pt-6">
        <header>
          {/* **AN `<h2>` SINCE SOLO 2026-09-11, AND THE WORDS ARE ADM-01's.** It was this screen's
              `<h1>`; the page now has a broader title and this is one of its two subjects. No spec
              asserts either heading's text — only `threshold-*` ids, which are untouched. */}
          <h2 className="text-base font-semibold">When is a day crowded?</h2>
          {/* AC-11, and it is permanent rather than a hint on the input. Charter refusal 6: a warning
              here never blocks anything, and an admin moving this number needs to know that before
              they move it rather than after somebody asks them why nothing happened. */}
          <p className="mt-2 text-sm opacity-70">
            A day is crowded when more than this share of the team is away. Nothing is ever blocked or
            refused because of it — the board says a day is crowded and everyone decides what to do.
          </p>
        </header>

      {/* AC-1. `data-threshold` carries the stored FRACTION, the way `month-threshold` already does
          in src/routes/MonthView.tsx — so a test asserts the share rather than parsing copy. */}
      <p data-testid="threshold-current" data-threshold={team.overloadThreshold} className="text-sm">
        Currently crowded above <strong>{toPercent(team.overloadThreshold)}%</strong> of the team.
      </p>

      <form onSubmit={onSave} className="flex flex-col gap-3" aria-label="Set the threshold">
        <label className="flex flex-col gap-1 text-sm">
          Crowded above this percentage of the team
          {/* NO `min`, `max`, `step` OR `required`, and that is the opposite of the reflex.
              A native constraint does not merely add a second check — it SUPPRESSES the submit
              handler, so `onSave` never runs, `threshold-input-error` is never rendered, and AC-7
              and AC-8's "the screen says…" is satisfied by a browser tooltip that names no
              percentage and that no selector in design section 4.3 can reach. Measured: with
              `min`/`max`/`step` present, both criteria failed on that selector being absent.
              It would also be a second copy of the range, in a second language, able to disagree
              with the one above. The range lives in `onSave` and nowhere else. */}
          <input
            data-testid="threshold-input"
            type="number"
            inputMode="numeric"
            value={percent}
            onChange={(e) => {
              setPercent(e.target.value);
              setInputError(null);
              setSaved(false);
            }}
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>

        {inputError ? (
          <p data-testid="threshold-input-error" role="alert" className="text-sm text-rose-600">
            {inputError}
          </p>
        ) : null}

        {saveError ? (
          <p data-testid="threshold-error" role="alert" className="text-sm text-rose-600">
            {saveError.message}
          </p>
        ) : null}

        {saved ? (
          <p data-testid="threshold-saved" role="status" className="text-sm text-emerald-700">
            Saved. Every day on the board is now measured against this share.
          </p>
        ) : null}

        <button
          data-testid="threshold-save"
          type="submit"
          disabled={saving}
          className="self-start rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save threshold"}
        </button>
      </form>

      </div>

      {/* SOLO, 2026-09-11 — the operator's `WFH_NEED_APPROVE` and `PTO_NEED_APPROVE`.

          **A CHECKED BOX MEANS "NEEDS APPROVAL"**, which is the operator's own polarity — the flag is
          named for the requirement, and a switch labelled the opposite way from the thing it stores
          is how an admin turns approval off while meaning to turn it on. Both start checked: that is
          the columns' default and what the product did before this block existed.

          **THE THIRD SENTENCE BELOW IS TRUE TODAY AND IS MEANT TO CHANGE.** The operator chose that an
          edited entry of a no-approval type be re-approved automatically. That is against INV-02's
          text and waits for an ADR; until it lands the datastore sends an edited approved entry back
          to `pending`, and a screen that promised otherwise would be describing a product that does
          not exist. When the ADR lands, this sentence is the one to delete.

          THE ENFORCEMENT IS THE DATASTORE'S, as everywhere on this screen: `team_update_admin` and the
          column grant refuse a member's write, and `entry_apply_approval_setting()` makes the
          approval. This form moves two switches and decides nothing. */}
      <form
        onSubmit={onSaveApproval}
        className="flex flex-col gap-4 border-t border-slate-200 pt-6"
        aria-label="Choose which entries need approval"
      >
        <header>
          <h2 className="text-base font-semibold">Which entries need an admin&rsquo;s approval?</h2>
          <p className="mt-2 text-sm opacity-70">
            A type that needs no approval is approved the moment it is saved. Entries already waiting
            stay in Pending approvals. Changing the dates, type or portion of an approved entry still
            sends it back for approval.
          </p>
        </header>

        {/* What is STORED, read from the row rather than from the two checkboxes — the shape
            `threshold-current` uses, so a spec asserts the saved state rather than the form's. */}
        <p
          data-testid="approval-current"
          data-wfh-need-approve={team.wfhNeedApprove}
          data-pto-need-approve={team.ptoNeedApprove}
          className="sr-only"
        >
          New WFH entries {team.wfhNeedApprove ? "wait for approval" : "are approved at once"}; new PTO
          entries {team.ptoNeedApprove ? "wait for approval" : "are approved at once"}.
        </p>

        <label className="flex items-center gap-3 text-sm">
          <input
            data-testid="approval-wfh"
            type="checkbox"
            checked={wfhNeed}
            onChange={(e) => {
              setWfhNeed(e.target.checked);
              setApprovalError(null);
              setApprovalSaved(false);
            }}
            className="size-4"
          />
          WFH needs approval
        </label>

        <label className="flex items-center gap-3 text-sm">
          <input
            data-testid="approval-pto"
            type="checkbox"
            checked={ptoNeed}
            onChange={(e) => {
              setPtoNeed(e.target.checked);
              setApprovalError(null);
              setApprovalSaved(false);
            }}
            className="size-4"
          />
          PTO needs approval
        </label>

        {approvalError ? (
          <p data-testid="approval-error" role="alert" className="text-sm text-rose-600">
            {approvalError.message}
          </p>
        ) : null}

        {approvalSaved ? (
          <p data-testid="approval-saved" role="status" className="text-sm text-emerald-700">
            Saved. New WFH entries {team.wfhNeedApprove ? "wait for approval" : "are approved at once"};
            new PTO entries {team.ptoNeedApprove ? "wait for approval" : "are approved at once"}.
          </p>
        ) : null}

        <button
          data-testid="approval-save"
          type="submit"
          disabled={approvalSaving}
          className="self-start rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
        >
          {approvalSaving ? "Saving…" : "Save approval settings"}
        </button>
      </form>
    </section>
  );
}

// SOLO, 2026-09-11 — whether a new entry of a given type waits for an admin.
//
// The operator: *"WFH_NEED_APPROVE và PTO_NEED_APPROVE. nếu WFH_NEED_APPROVE = true: thì khi đăng kí
// WFH phải được admin approve, ngược lại không cần APPROVE mà tự động approved."*
//
// **THE DATASTORE IS THE ENFORCEMENT AND THIS IS ITS STAND-IN.** In production the decision is made by
// `entry_apply_approval_setting()` in `supabase/migrations/20260911170000_solo_approval_settings.sql`,
// because the application cannot make it: the insert grant withholds `status` and clause (a) of
// `entry_enforce_decision()` refuses a non-admin who moves it. This function is what the MOCK seam
// runs so the acceptance suite observes the same behaviour, and it is the one place above the seam
// that answers the question — the mock imports it rather than writing a second copy inline, which is
// the discipline `busy.ts` and `absence.ts` keep for their own arithmetic.
//
// **THE TWO COPIES — THIS ONE AND THE SQL — ARE UNAVOIDABLE, AND THEY ARE KEPT IDENTICAL IN SHAPE.**
// Both switch on the type and read one column per type; neither has a default arm. A third type
// added to `entry_type` would fail to compile here (the switch is exhaustive over `EntryType`) and
// return null there, which leaves the entry `pending` — the fail-closed direction in both.
//
// IT FETCHES NOTHING. Every input is passed in.
import type { EntryType, Team } from "../domain/types";

/** The two settings, and nothing else of the team — so a caller holding only those can ask. */
export type ApprovalSettings = Pick<Team, "wfhNeedApprove" | "ptoNeedApprove">;

/**
 * `true` when a new entry of `type` must wait for an admin, `false` when it is approved the moment it
 * is stored.
 *
 * **IT ANSWERS FOR A NEW ENTRY ONLY.** An EDITED entry still returns to `pending` whatever this says,
 * because INV-02 says so in terms and no ADR has amended it yet. The operator chose automatic
 * re-approval on edit; that half waits for the ADR, and when it lands it belongs in the datastore's
 * `entry_enforce_decision()` and in the mock's `updateEntry` — both of which will call this.
 */
export function needsApproval(settings: ApprovalSettings, type: EntryType): boolean {
  switch (type) {
    case "wfh":
      return settings.wfhNeedApprove;
    case "pto":
      return settings.ptoNeedApprove;
  }
}

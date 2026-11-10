// SOLO, 2026-09-10 — what somebody sees between signing up and an admin deciding.
//
// **IT EXISTS BECAUSE THE `undecided` MEMBERSHIP STATE HAD NOWHERE TO LAND.** `App.tsx` routed
// `member` to the week view and `member-less` to `NotOnATeam`, and everything else to `/signin` —
// which for a caller who IS signed in redirects straight back to `/`, and back again. An infinite
// redirect, reachable by anybody who signed up, and it appeared the moment the allow-list stopped
// being the gate.
//
// **IT IS A SENTENCE AND NOT A REFUSAL.** Nothing is being denied here that this screen could grant:
// `public.member_team_id` returns null for anybody who is not `approved`, so every policy in the
// product already refuses them. What this screen does is say WHY, which is the thing a refusal alone
// never says — the reasoning `AllowList.tsx` and `TeamEntries.tsx` both recorded for keeping their
// own refusals in place rather than redirecting.
//
// **`rejected` AND `pending` GET DIFFERENT SENTENCES**, which is the whole reason `MemberStatus` has
// three values rather than being a boolean. Telling somebody who has been turned down to keep
// waiting is worse than telling them nothing.
import type { Member, Result } from "@/lib/domain/types";

export interface AwaitingApprovalProps {
  member: Member;
  signOut(): Promise<Result<void>>;
}

export default function AwaitingApproval({
  member,
  signOut,
}: AwaitingApprovalProps) {
  const rejected = member.status === "rejected";

  return (
    <section
      data-testid="awaiting-approval"
      data-status={member.status}
      className="mx-auto max-w-md rounded-card bg-card p-8 text-center shadow-soft"
    >
      <h1 className="text-xl font-semibold text-ink">
        {rejected ? "You are not on the team" : "Waiting for an admin"}
      </h1>

      <p className="mt-2 text-sm text-ink-2">
        {rejected
          ? "An admin has decided not to add this account to the team. If you think that is a mistake, ask them directly — nothing here can change it."
          : "Your account is made. An admin has to add you to the team before you can see its calendar or book anything."}
      </p>

      {/* The one control, and it writes nothing but the session. A person left on this screen with no
          way out would be stuck on a shared machine — the gap TEA-05 AC-6 exists to close. */}
      <p className="mt-6">
        <button
          data-testid="awaiting-approval-sign-out"
          type="button"
          onClick={() => void signOut()}
          className="rounded-pill border border-line bg-card px-4 py-1.5 text-sm font-semibold text-ink-2 transition-colors hover:bg-field hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Sign out
        </button>
      </p>
    </section>
  );
}

// TEA-05 — the member-less landing screen. AC-4, AC-6. 01-plan.md sections 4.4 and 8.
//
// This is the state ADR-009 §Consequences says "must be handled in the interface, not left to look
// like a bug": a person confirmed their address, the admission trigger found no allow-list entry for
// it, and they now have an account and no `member` row.
//
// **IT MUST NOT SAY WHETHER THEIR ADDRESS IS ON THE ALLOW-LIST.** It cannot know — nothing readable
// from here carries that fact — and ADR-009 plus TEA-01's AC-5 are why it must not appear to guess.
// A screen that announced "you are not on the allow-list" would turn sign-up into an
// address-enumeration oracle, which is the whole reason AC-4 is reachable only after a successful
// sign-in (AC-5).
import { useState } from "react";
import type { AuthUser, Result } from "@/lib/domain/types";

interface NotOnATeamProps {
  user: AuthUser;
  signOut(): Promise<Result<void>>;
}

export default function NotOnATeam({ user, signOut }: NotOnATeamProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      // The screen is routed away by the session change, so this only matters when the sign-out
      // failed — and then leaving the control disabled would strand the one way out of this state.
      setSigningOut(false);
    }
  }

  return (
    <section
      data-testid="not-on-a-team"
      className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm"
    >
      <h1 className="text-xl font-semibold">You are signed in</h1>
      <p className="mt-2 text-sm opacity-70">
        The account {user.email} is not on a team yet. Ask an admin to add this address to the
        allowed list first, then sign in again to join.
      </p>

      {/* AC-6. Somebody in this state has no other way out, which is why the control is here and not
          only on the landing screen a member reaches. */}
      <button
        data-testid="not-on-a-team-sign-out"
        type="button"
        onClick={onSignOut}
        disabled={signingOut}
        className="mt-6 rounded-xl border border-slate-200 px-4 py-2 text-sm disabled:opacity-40"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </section>
  );
}

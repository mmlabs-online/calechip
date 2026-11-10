// TEA-05 — the session, read here and nowhere else above the seam. 01-plan.md section 4.3.
//
// **This file is the answer to `.ai/standards/rbac-and-security.md:114`** — *"name where the session
// is read on the client, and what happens on expiry"* — answered FOR THIS TICKET, which is the most
// a board-plane artifact may do. That line is standards plane and human-owned under RULE-01, and it
// is still owed: until a human writes it, the answer lives in a ticket artifact and in this comment,
// where the next reader will not think to look.
//
// On expiry the client emits with a null session and this hook re-resolves to `{ state:
// "signed-out" }`, which `App.tsx` routes to the sign-in screen (AC-8). There is no timer here and
// there must not be one: `persistSession` and `autoRefreshToken` are the client's own defaults, and
// a second timer would be a second source of truth about whether somebody is signed in.
import { useCallback, useEffect, useState } from "react";
// The seam, through its one door. Nothing above the seam names an implementation, and this file
// must never import `./supabase` or `./mock` (RULE-02).
import { seam, type SignInInput } from "@/lib/data";
import type { Membership, Result, Session } from "@/lib/domain/types";

export interface SessionState {
  membership: Membership;
  /**
   * True until the first resolution completes. AC-9 must not flash the sign-in screen at somebody
   * who IS signed in, and `signed-out` is indistinguishable from `not yet known` without this.
   *
   * False after the first resolution and false thereafter: a later change re-resolves without
   * returning the screen to a spinner.
   */
  resolving: boolean;
  signIn(input: SignInInput): Promise<Result<Session>>;
  signOut(): Promise<Result<void>>;
  /**
   * SOLO 2026-09-10. Re-reads the membership now.
   *
   * **IT EXISTS BECAUSE ONE WRITE IN THIS PRODUCT CHANGES THE MEMBER ROW WITHOUT TOUCHING THE
   * SESSION.** Everything else that changes what this hook holds goes through the auth client, which
   * emits, and the subscription below re-resolves — that is the single path the comment on `signIn`
   * describes and it is unchanged. `updateOwnProfile` is a table write: it emits nothing, so after a
   * member renames themselves the sidebar and every screen holding `membership.member` keep drawing
   * the OLD name until the next reload. This is the way to say "read it again", and it is still one
   * path — it re-runs the same `resolve`, it does not set a membership of its own.
   *
   * The screen calls it AFTER the seam reports success, never instead of reading the seam's answer.
   */
  refresh(): void;
}

export function useSession(): SessionState {
  const [membership, setMembership] = useState<Membership>({ state: "signed-out" });
  const [resolving, setResolving] = useState(true);
  // SOLO 2026-09-10. Bumping this re-runs the effect below, which re-resolves. A counter and not a
  // lifted `resolve`: `resolve` closes over `live` and `latest`, the two guards that stop a slow
  // answer overwriting a newer one, and hoisting it out of the effect would leave those guards
  // outside the lifecycle they exist to track. The cost is that the subscription is torn down and
  // re-established on each refresh, which is two synchronous calls on the seam and no request.
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let live = true;
    // Later answers win. Two resolutions are in flight at once on an ordinary mount — this effect's
    // own, and the one the subscription's first event triggers — and without a sequence number the
    // slower of the two overwrites the newer answer with a stale one.
    let latest = 0;

    // The three states of section 4.3, resolved in this order. It re-reads the session from the
    // seam rather than trusting the one the listener carried, so there is ONE path to a membership
    // and not two that can disagree.
    async function resolve(): Promise<void> {
      const sequence = ++latest;
      let next: Membership = { state: "signed-out" };

      try {
        const session = await seam.getSession();
        if (session) {
          // AC-4's whole mechanism. "Signed in" and "on a team" are different facts, and ADR-009
          // §Consequences requires the second one's absence to be handled in the interface rather
          // than left to look like a bug.
          const member = await seam.getCurrentMember();

          // **SOLO, 2026-09-10 — A THIRD ANSWER, BECAUSE THERE ARE NOW THREE FACTS.** Until the
          // allow-list was removed a member row existed only for somebody an admin had already let
          // in, so "has a row" and "is on the team" were the same thing. They are not any more: a
          // sign-up creates a row immediately with no team and `status: "pending"`, so a caller can
          // hold a row and still be nobody.
          //
          // **THIS ROUTES; IT DOES NOT DECIDE.** `public.member_team_id` returns null for anything
          // but `approved`, and every row-level policy in the product is keyed on that function — so
          // an `undecided` caller is refused by the datastore whatever this line says. Reading
          // `status` here only chooses which true sentence to put on screen.
          next = !member
            ? { state: "member-less", user: session.user }
            : member.status === "approved"
              ? { state: "member", user: session.user, member }
              : { state: "undecided", user: session.user, member };
        }
      } catch {
        // A transport failure, or the Supabase client raising on an unusable configuration before
        // any request leaves — the throw SignUp.tsx and AllowList.tsx already had to handle. This
        // fails CLOSED: `signed-out` routes to the sign-in screen, which is the only state that
        // cannot show anybody something they may not be allowed to see. It is not a true sentence
        // about whether they are signed in, and it is the safe one.
        next = { state: "signed-out" };
      }

      if (!live || sequence !== latest) return;
      setMembership(next);
      setResolving(false);
    }

    // **SUBSCRIBING IS THE FIRST READ. THERE IS NO SECOND ONE, AND UNTIL SOLO 2026-09-10 THERE WAS.**
    //
    // This used to be `subscribe, then void resolve()`, with the comment *"Subscribe BEFORE the
    // first read, so a change arriving during that read is not missed."* The ordering was right and
    // the extra call was redundant: `onAuthStateChange` emits once, unconditionally, immediately
    // after subscribing — with the session if there is one and with `null` if the read failed.
    // VERIFIED ON DISK rather than recalled, at
    // `@supabase/auth-js@2.112.4/dist/module/GoTrueClient.js:3633-3644` (`_emitInitialSession`,
    // called from `onAuthStateChange` and awaited in both the locked and unlocked paths). So the
    // explicit call raced its own subscription's first event, and every mount of the application
    // issued `auth.getUser()` and the `member` select TWICE. The `latest` sequence guard hid it by
    // discarding whichever answer came second.
    //
    // **THE MOCK NOW EMITS ON SUBSCRIBE TOO, AND THAT IS A CONTRACT AND NOT AN IMPLEMENTATION
    // DETAIL** — `seam.onAuthStateChange`'s docblock in `lib/data/index.ts` says so, and
    // `mock.ts` reproduces it. If an implementation ever stops emitting, `resolving` never clears
    // and the application sits on `Loading…` for ever. That is the hazard this comment exists to
    // flag; it is caught by every acceptance test, all of which render the app before they do
    // anything else.
    const unsubscribe = seam.onAuthStateChange(() => {
      void resolve();
    });

    // The unsubscribe is not optional. A leaked subscription survives a hot reload and then
    // re-resolves against a stale closure, setting state on a component that is gone.
    return () => {
      live = false;
      unsubscribe();
    };
  }, [refreshCount]);

  // Both pass straight through. Neither sets state here: the seam notifies, the listener above
  // re-resolves, and that is the single path by which a membership changes. A local `setMembership`
  // beside these would be the second source of truth this hook exists to avoid.
  const signIn = useCallback((input: SignInInput) => seam.signIn(input), []);
  const signOut = useCallback(() => seam.signOut(), []);
  const refresh = useCallback(() => setRefreshCount((n) => n + 1), []);

  return { membership, resolving, signIn, signOut, refresh };
}

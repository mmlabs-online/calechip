// SOLO, 2026-09-10 — build-time configuration that is not the datastore seam.
//
// `src/lib/data/index.ts` already resolves `VITE_DATA_SEAM`, and this flag deliberately does NOT
// live beside it: the seam module decides which datastore answers, and this decides how sign-up
// BEHAVES against either. `SignUp.tsx` needs the answer and must not import the seam module for a
// reason that is not data access (RULE-02 is about the seam, and a component reaching into it for a
// constant is the habit that erodes the rule long before it breaks it).

/**
 * Whether a new account must open a confirmation link before it can sign in.
 *
 * **THE DEFAULT IS `false`, WHICH REVERSES WHAT THE PRODUCT SHIPPED**, and it is the operator's
 * instruction of 2026-09-10: *"thay đổi config, không cần verify email khi đăng kí"*. TEA-01 AC-7 is
 * written against `Confirm email` ON and is not repealed by this — it is now one of two configured
 * behaviours rather than the only one, and `playwright.config.ts` pins the flag ON so every one of
 * that ticket's assertions still runs against the setting it was written for.
 *
 * **THIS FLAG DOES NOT TURN CONFIRMATION OFF IN A REAL PROJECT AND CANNOT.** Against Supabase the
 * behaviour is decided by the project's own `Confirm email` setting in the dashboard, which is not
 * in this repository — `src/lib/data/supabase.ts` reports what the server did
 * (`needsEmailConfirmation: data.session === null`) and never asks this. What the flag does is make
 * the two agree: the SCREEN stops telling somebody to open an email that was never sent, and the
 * MOCK stops modelling a setting the project no longer has. **Flipping this without also turning the
 * dashboard setting off changes nothing about the real backend.**
 *
 * **THE DATABASE NEEDS NO CHANGE EITHER WAY.** `admit_allow_listed_member` fires on
 * `after insert or update of email_confirmed_at`, and its own comment records why that covers both
 * settings: with `Confirm email` OFF, Supabase sets `email_confirmed_at` at insert time, so the
 * trigger fires exactly once under either
 * (`supabase/migrations/20260831150024_tea01_membership.sql:85-87`).
 *
 * **READ PER CALL RATHER THAN CAPTURED AT MODULE LOAD.** Vite still inlines the value at build time,
 * so this costs nothing in the bundle; what it buys is that a test can stub the environment and
 * exercise both behaviours without re-importing the module graph — which is how
 * `tests/signup-confirmation.test.ts` covers the direction Playwright's single global `webServer`
 * cannot reach.
 *
 * Any value other than the exact string `"true"` means OFF, including an unset variable. A flag that
 * treated every non-empty string as ON would make `VITE_REQUIRE_EMAIL_CONFIRMATION=false` mean the
 * opposite of what it says.
 */
export function requiresEmailConfirmation(): boolean {
  return import.meta.env.VITE_REQUIRE_EMAIL_CONFIRMATION === "true";
}

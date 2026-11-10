// UIE-01 — the shell both auth screens sit in. 01-plan.md § 4.2 and § 4.3.
//
// PRESENTATIONAL, AND THAT IS A BOUNDARY CLAIM RATHER THAN A STYLE PREFERENCE. It imports react and
// react-router-dom and nothing else — no seam, no hook, no domain type. RULE-02 therefore holds by
// construction here rather than by inspection: eslint.config.js:60-79 has no import to fire on.
//
// TWO ROUTES SHARING THIS CARD, NOT ONE MERGED SCREEN. The segmented control is two <Link>s, so
// /signin and /signup stay separate addresses with separate guards. 01-plan.md § 8 records why the
// merge the reference implies was rejected: App.tsx:76 guards /signin on `signed-out` while /signup
// is deliberately reachable in every membership state (ADR-009), and sign-up's terminal `submitted`
// state cannot coexist with a toggle that lets you click away from it.
import type { JSX, ReactNode } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";

export type AuthTab = "signin" | "signup";

interface AuthCardProps {
  /** Which half of the segmented control is selected. */
  tab: AuthTab;
  /** Omit the control entirely — the terminal confirmation state, AC-14. */
  showTabs?: boolean;
  children: ReactNode;
}

// SOLO 2026-09-13. The title was the product name `Ai Nghỉ?` and a rabbit; the operator replaced
// both with `CaleChip` and a logo that links to `/`, drawn by `BrandLogo` as the sidebar draws it.

// AC-4: the selected half is distinguished by MORE THAN COLOUR — a filled white pill with its own
// elevation, a heavier weight, and `aria-current`, which is the half a screen reader gets.
const TAB_BASE =
  "flex-1 rounded-pill py-2 text-center text-sm transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const TAB_ON = "bg-card font-bold text-ink shadow-soft";
const TAB_OFF = "font-semibold text-ink-3 hover:text-ink-2";

export default function AuthCard({ tab, showTabs = true, children }: AuthCardProps): JSX.Element {
  return (
    // AC-2 horizontal centring, and AC-16: `w-full` under a 355px cap means the card SHRINKS on a
    // narrow viewport rather than being clipped by it. The gutter is App.tsx's `p-8`.
    //
    // Centred horizontally and NOT vertically, deliberately. AC-13: in a mock build App.tsx renders
    // a permanent banner above every screen, and a vertically centred card would either overlap it
    // or move the whole layout depending on whether the build is real — two different screens from
    // one stylesheet.
    <div className="mx-auto w-full max-w-[355px]">
      <section data-testid="auth-card" className="rounded-card bg-card p-8 shadow-soft">
        {/* AC-3. Identical on both routes, and identical again on the confirmation (AC-14) — it is
            what makes the third state read as the same card rather than as a different screen. */}
        <h1 className="flex justify-center">
          <BrandLogo size="lg" testId="auth-brand-logo" />
        </h1>
        <p className="mt-2 text-center text-[13px] text-ink-2">Plan your team&apos;s time away</p>

        {/* AC-4 and AC-5. Rhythm from 01-plan.md § 4.3: title block -> 20px -> control. */}
        {showTabs ? (
          <nav aria-label="Sign in or sign up" className="mt-5 flex gap-1 rounded-pill bg-track p-1">
            <Link
              data-testid="auth-tab-signin"
              to="/signin"
              aria-current={tab === "signin" ? "page" : undefined}
              className={`${TAB_BASE} ${tab === "signin" ? TAB_ON : TAB_OFF}`}
            >
              Sign in
            </Link>
            <Link
              data-testid="auth-tab-signup"
              to="/signup"
              aria-current={tab === "signup" ? "page" : undefined}
              className={`${TAB_BASE} ${tab === "signup" ? TAB_ON : TAB_OFF}`}
            >
              Sign up
            </Link>
          </nav>
        ) : null}

        <div className="mt-5">{children}</div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The card's shared vocabulary, exported so the two routes cannot drift apart.
//
// 01-plan.md § 4.3 specifies ONE input shape, ONE label shape and ONE button for both screens. Two
// routes each holding their own copy of those class strings is two things to keep equal, and the
// first restyle that touches one and not the other is the bug. They live here because this is the
// file that owns the card they sit in.

/** § 4.3: font-sans 700, ~10px, uppercase, letter-spaced, ink-3, above its input at 6px. */
export const FIELD_LABEL = "mb-1.5 block text-[10px] font-bold tracking-wider text-ink-3 uppercase";

/** § 4.3: full-width 44px, fully rounded, BORDERLESS on a filled ground. */
export const FIELD_INPUT =
  "h-11 w-full rounded-pill bg-field px-4 text-sm text-ink " +
  // AC-15, and the reason this is not optional: a borderless input on a filled ground has no
  // default focus affordance worth having. The outline is a second visual channel, not a fill
  // change, so it is distinct from hover as well as visible.
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * 16px between field groups — § 4.3's vertical rhythm, applied by the routes as a flex gap.
 *
 * IT IS ALSO THE BASE OF § 4.3'S TWO 24px VALUES. The gap falls between EVERY child of the form,
 * the error row and the button included, so those two add 8px of their own — see `FORM_ERROR` and
 * `primaryButtonClass` below. Change this number and both of them change with it.
 */
export const FIELD_STACK = "flex flex-col gap-4";

/**
 * AC-11: inside the card, between the last field and the button, `--color-danger` at ~13px.
 *
 * `mt-2` IS THE FIRST OF § 4.3'S TWO 24px VALUES, AND IT IS 24px BY ADDITION RATHER THAN BY
 * LITERAL. The form is a flex column carrying `FIELD_STACK`'s `gap-4`, and in flexbox a gap and a
 * margin both apply — 16px of gap plus 8px of margin is the 24px the rhythm asks for above the
 * error row. There is no literal spelling available here: every child of that column is separated
 * by the gap, so a `mt-6` would render 40px, not 24px. Expressing it any other way means taking the
 * gap off the form and wrapping the field groups in a second element, which is a DOM change to both
 * routes for an identical rendered result.
 *
 * IT LIVES ON THE SHARED CONSTANT, NOT IN THE TWO ROUTES, for the reason stated at the head of this
 * section: two copies of a spacing value is two things to keep equal.
 */
export const FORM_ERROR = "mt-2 text-[13px] text-danger";

/**
 * AC-12. THREE APPEARANCES, AND NONE OF THEM IS AN OPACITY OF ANOTHER.
 *
 * `disabled:opacity-40` on an indigo pill — what both screens do today — reads as a different
 * indigo rather than as a disabled control, which is why 01-plan.md § 4.3 rules it out by name.
 *
 * `submitting` is checked FIRST because the element is also `disabled` while a submission is in
 * flight. Checked the other way round, the in-flight state would wear the disabled fill and the
 * label swap would be its only signal.
 *
 * `mt-2` IS THE SECOND OF § 4.3'S TWO 24px VALUES — same mechanism and same reason as `FORM_ERROR`
 * above: 16px of `FIELD_STACK` gap plus 8px of margin.
 *
 * IT APPLIES WHETHER OR NOT THE ERROR IS RENDERED, and that is the reading of § 4.3 rather than an
 * accident of where the class sits. The rhythm names 24px above and 24px below an element that is
 * present "when present", so with the error absent the two values collapse to the one gap they
 * bracket: fields -> 24px -> button. The alternative reading — 16px with no error, 24px with one —
 * makes the button move down by 8px at the moment a refusal appears, on top of the error text
 * itself arriving, and § 4.3 states no such conditional. Suppressing it would also mean passing
 * error presence into this function, which is layout state the button has no other reason to know.
 */
export function primaryButtonClass(opts: { submitting: boolean; disabled: boolean }): string {
  const base =
    "mt-2 h-12 w-full rounded-pill text-sm font-bold text-white " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

  if (opts.submitting) return `${base} bg-primary cursor-progress`;
  if (opts.disabled) return `${base} bg-ink-3 cursor-not-allowed`;
  return `${base} bg-primary hover:bg-ink`;
}

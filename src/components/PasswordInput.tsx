// SOLO, 2026-09-28 — a password box with a reveal control, for every screen that has one.
//
// **THIS IS AN EXTRACTION AND NOT A NEW CONTROL, WHICH IS WHY IT LOOKS FINISHED ON ARRIVAL.** The
// eye, its two paths, the `type="button"` trap and the state-dependent `aria-label` were all written
// in `src/routes/Profile.tsx` on 2026-09-10, where three boxes on one screen made one copy
// obviously right. The operator asked for the same control on the other password boxes; a third and
// fourth copy would be three more chances to get the padding that keeps the text clear of the icon
// wrong, which is the reason Profile gave for writing it once in the first place.
//
// **PRESENTATIONAL.** It imports react and nothing else — no seam, no hook, no domain type — so
// RULE-02 holds here by construction, exactly as it does for `Modal` and `AuthCard`.
//
// **IT IS THE BOX AND THE BUTTON, AND DELIBERATELY NOT THE LABEL OR THE ERROR.** Profile draws a
// `<label htmlFor>` above the field and a `role="alert"` paragraph below it; the two auth screens
// wrap their input in a `<label className="block">` with a `<span>` caption and put their refusal at
// the foot of the card, one for the whole form. Those are three different layouts of the same
// control, and a component that owned the label would have to be told which one — so each screen
// keeps its own and this owns the part that is genuinely identical.
import { useState, type JSX } from "react";

/** The reveal eye. Inline SVG rather than `lucide-react`, following the decision recorded on
 *  `Sidebar.tsx`'s chevron: the package is a dependency that almost no file under `src/` imports,
 *  and a password box is not the change that should decide whether this product carries an icon set.
 *
 *  Open and closed are DIFFERENT PATHS and not one path with a strike-through added, because the
 *  difference has to survive at 16px. */
function EyeIcon({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1.8 10S4.8 4.5 10 4.5 18.2 10 18.2 10 15.2 15.5 10 15.5 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.6" />
      {open ? null : <path d="m3.5 3.5 13 13" />}
    </svg>
  );
}

export interface PasswordInputProps {
  /**
   * The input's `data-testid`, and its `id` when the caller has a `<label htmlFor>` pointing at it.
   *
   * **THE REVEAL BUTTON IS THIS PLUS `-reveal`**, which is the convention `Profile.tsx` established
   * and `tests/e2e/solo-profile.spec.ts` already addresses. A caller that named the two separately
   * would be able to make them disagree.
   */
  testId: string;
  value: string;
  onChange(next: string): void;
  /**
   * The classes for the input itself. **EACH SCREEN BRINGS ITS OWN FIELD STYLING** — the auth cards
   * use `FIELD_INPUT` from `AuthCard.tsx` and Profile uses its own `FIELD`, and they are not the
   * same shape. This component adds `pr-11` to whatever it is given, because the space the reveal
   * button occupies belongs to the button rather than to the screen that hosts it: a caller who had
   * to remember that padding is a caller who will eventually forget it, and the symptom is a
   * password whose last characters sit under an eye.
   */
  className: string;
  /** `current-password` or `new-password`. Required rather than optional: a password box with no
   *  `autocomplete` makes every password manager guess, and guessing wrong on a sign-in form is how
   *  somebody's stored password stops being offered. */
  autoComplete: string;
  required?: boolean;
  placeholder?: string;
  /** Set when the field's own value was refused, so the box is marked and points at the message. */
  invalid?: boolean;
  /** The id of the element carrying that message. */
  describedBy?: string;
}

export default function PasswordInput({
  testId,
  value,
  onChange,
  className,
  autoComplete,
  required,
  placeholder,
  invalid,
  describedBy,
}: PasswordInputProps): JSX.Element {
  // **THE STATE IS THIS COMPONENT'S AND IS NEVER LIFTED.** Whether a box is showing its contents is
  // nobody else's business: it is not a form value, it is not submitted, and a screen holding it
  // would be a screen that could accidentally persist it. It also resets to hidden whenever the
  // component unmounts, which is the behaviour anybody would expect on closing a dialog.
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative">
      <input
        id={testId}
        data-testid={testId}
        // The whole feature, in one expression. Nothing else about the box changes.
        type={revealed ? "text" : "password"}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className={`${className} pr-11`}
      />
      <button
        type="button"
        data-testid={`${testId}-reveal`}
        data-revealed={revealed}
        onClick={() => setRevealed((on) => !on)}
        // **`type="button"` IS LOAD-BEARING AND NOT TIDINESS.** Inside a form, a `<button>` with no
        // explicit type is a SUBMIT button — so an unset type here would mean that pressing the eye
        // submits the page. On `/signin` that is an attempt to sign in with a half-typed password;
        // on the profile screen it is a save. `tests/e2e/solo-profile.spec.ts` test 9 pins it, and
        // the spec this extraction added pins it on both auth screens.
        //
        // The label states what pressing it DOES, which is what a screen reader announces, and it
        // changes with the state — "Show password" on a hidden box, "Hide password" on a shown one.
        aria-label={revealed ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-pill text-ink-3 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <EyeIcon open={revealed} />
      </button>
    </div>
  );
}

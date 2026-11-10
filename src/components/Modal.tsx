// SOLO, 2026-09-10 — the dialog the entry form is drawn in, from the operator's design.
//
// PRESENTATIONAL, and that is a boundary claim rather than a style preference: it imports react and
// nothing else — no seam, no hook, no domain type — so RULE-02 holds here by construction, exactly
// as it does for `AuthCard`.
//
// The overlay, the radius, the blur and the round close button are `_figma/src/App.tsx`'s
// `NewEntryModal`, repainted from the tokens UIE-01 declared rather than from the prototype's own
// classes.
//
// **IT CLOSES ON ESCAPE AND ON THE BACKDROP, AND IT NEVER CLOSES ITSELF ON A SAVE.** Whether a
// successful write should dismiss the dialog is the caller's decision — the create routes keep it
// open so a second run of days can be declared without reopening, which is the behaviour the entry
// form's `afterSubmit: "clear"` has had since CAL-01.
import { useEffect, type JSX, type ReactNode } from "react";

export interface ModalProps {
  /** The selector family of whatever is inside — `new-entry` or `month-entry`. The close control is
   *  this prefix plus `-close`, so the dialog needs no selector vocabulary of its own. */
  testIdPrefix: string;
  /** Names the dialog for a screen reader. The visible heading is the form's own `<h1>`. */
  label: string;
  onClose(): void;
  children: ReactNode;
}

export default function Modal({ testIdPrefix, label, onClose, children }: ModalProps): JSX.Element {
  // Escape closes. Bound on the document rather than on the card, so it works before anything inside
  // has taken focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      data-testid={`${testIdPrefix}-modal`}
      // The backdrop closes, and the guard is what stops a click that STARTED inside the card and
      // ended on the backdrop — a drag across a text field — from dismissing the work.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-card bg-card p-6 shadow-soft md:p-8"
      >
        <button
          data-testid={`${testIdPrefix}-close`}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-pill bg-bg text-ink-2 transition-colors hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:right-7 md:top-7"
        >
          {/* An SVG and not `&times;`: U+00D7 is inside the diacritic range the § Language lint
              rule matches (eslint.config.js), and a JSXText node holding it fails `pnpm lint`. The
              glyph is the icon, so it is drawn rather than typed. */}
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>

        {children}
      </div>
    </div>
  );
}

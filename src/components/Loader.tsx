// SOLO, 2026-09-11 — the loading mark, in place of the sentence every screen used to print.
//
// The operator: *"thay đổi text lúc loading như 'loading the week...' bằng loading ví dụ như icon ở
// loading.html"*, then *"tôi mới update lại loading.html"* an hour later. `loading.html` is an
// untracked sketch in the repository root and it has changed once already — an orbiting pair of dots
// became a bar with a highlight sweeping across it. **THIS COMPONENT DID NOT CHANGE WHEN THAT DID,
// AND THAT IS THE POINT OF IT.** The mark is two class names, `src/index.css` is the only file that
// knows what they draw, and the fourteen call sites have never known. The sketch's geometry and
// motion are reproduced there exactly; its colours are not — the operator chose the product's own
// tokens when asked, and that file records why.
//
// PRESENTATIONAL, the boundary claim `Modal.tsx` makes in the same words: it imports react and
// nothing else — no seam, no hook, no domain type — so RULE-02 holds here by construction.
//
// **THE SENTENCE IS STILL THERE. IT IS ONLY VISUALLY HIDDEN, AND THAT IS THE WHOLE POINT OF THIS
// COMPONENT EXISTING RATHER THAN A BARE `<span className="cc-loader" />` AT ELEVEN CALL SITES.**
// Every one of those eleven is inside an element carrying `role="status"`, whose announcement is its
// text content — an element emptied of text announces nothing, so replacing the words with a picture
// would take the loading state away from a screen reader entirely while looking like a restyle. The
// mark is `aria-hidden`, the words are `sr-only`, and the screen reads exactly as it did before.
//
// **`label` IS REQUIRED AND HAS NO DEFAULT.** "Loading the week…" and "Loading the calendar…" are
// not the same announcement, and a default would make every screen that forgot to pass one say the
// same vague thing while looking correct.
import type { JSX } from "react";

export interface LoaderProps {
  /** What is loading, as the screen used to say it in words — "Loading the month…". Read aloud, and
   *  shown to nobody. */
  label: string;
  /** `sm` is the 20px mark for the sidebar's roster line, where the full one is furniture. */
  size?: "sm" | "md";
}

export default function Loader({ label, size = "md" }: LoaderProps): JSX.Element {
  return (
    <span data-testid="loader" className="inline-flex flex-col items-center justify-center gap-2">
      <span aria-hidden="true" className={size === "sm" ? "cc-loader cc-loader-sm" : "cc-loader"} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

// SOLO, 2026-09-26 — the floating control a person reports an issue with.
//
// **THE OPERATOR ASKED FOR A BUBBLE**: *"float button. như bubbles chat. hiện ở mọi trang"*. So it is
// `position: fixed` in the bottom-right corner, not a row in the sidebar and not a face in the top
// bar — both of which were offered and neither of which was chosen.
//
// **"EVERY PAGE" MEANS EVERY PAGE INSIDE THE SHELL, AND THAT IS WHERE IT IS MOUNTED.** `AppShell` is
// rendered by `src/App.tsx` only for `membership.state === "member"`, so this reaches an approved
// member on a team and nobody else: `/signin`, `/signup`, the awaiting-approval notice and the
// not-on-a-team notice are all outside it. That matches the table — `issue_report.member_id` is
// `not null` and `issue_report_insert_own` compares it with `auth.uid()`, so a report needs an
// author and a signed-out person has none.
//
// **IT IS NOT A CONTROL IN THE ADR-005 SENSE AND NOTHING HERE PRETENDS OTHERWISE.** The control is
// `issue_report_insert_own` plus the insert grant's column list, both in the database. A person who
// reached this component with a debugger and sent somebody else's `member_id` is refused by the
// policy and by nothing in `src/`.
import { useEffect, useState, type JSX } from "react";
import { useLocation } from "react-router-dom";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `@/lib/data/supabase` or `@/lib/data/mock` (RULE-02).
import { seam } from "@/lib/data";
import type { Failure, IssueKind } from "@/lib/domain/types";
// SOLO, 2026-09-26 (second run). RUNTIME imports: the `accept` list and the ceiling shown beside the
// picker. Both are repeated on the bucket, which is the control — see the migration's § 2.
import { ISSUE_IMAGE_MAX_COUNT, ISSUE_IMAGE_TYPES } from "@/lib/domain/types";
import Modal from "./Modal";

/**
 * The three kinds, with the words a person reads.
 *
 * **DECLARED HERE AS AN ORDERED ARRAY AND NOT DERIVED FROM THE TYPE**, because a union has no order
 * and the order is what the segmented control renders. `other` is LAST and is also the default the
 * form opens on — a required category with no escape makes somebody mis-file a report in order to
 * send it, and a person who does not care which of three it is should be able to type and send.
 */
const KINDS: readonly { value: IssueKind; label: string }[] = [
  { value: "bug", label: "Something is broken" },
  { value: "idea", label: "An idea" },
  { value: "other", label: "Something else" },
];

/** The ceiling the seam refuses above and `issue_report_message_length` refuses behind it. Shown as
 *  a counter rather than enforced with `maxLength`: a hard cap silently swallows the end of a
 *  pasted paragraph, and somebody who pasted one cannot see what was lost. */
const MESSAGE_MAX = 2000;

export default function ReportIssueButton(): JSX.Element {
  // **THE PAGE IS READ FROM THE ROUTER AND NEVER TYPED BY THE PERSON.** It is the one field on the
  // report nobody has to fill in, which is the whole reason the operator's chosen field set includes
  // it: an admin reading *"the week view is blank"* otherwise has to ask where.
  //
  // `pathname` AND NOT `pathname + search`: a query string on this product's addresses carries a
  // year or a date, and it would also carry anything a later route puts there. A pathname is enough
  // to name the screen and cannot grow into a place personal data leaks through.
  const { pathname } = useLocation();

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<IssueKind>("other");
  const [message, setMessage] = useState("");
  // SOLO, 2026-09-26 (second run). The chosen files, in the order they were picked. **`File`
  // OBJECTS AND NOT UPLOADS** — nothing leaves the browser until *Send report* is pressed, so
  // somebody who changes their mind has uploaded nothing and an abandoned dialog leaves no orphan in
  // the bucket.
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [sent, setSent] = useState(false);

  // Opening is always a fresh report. Without this, a second report opens carrying the first one's
  // thank-you note and the first one's refusal — state from a finished journey, rendered as though
  // it were about this one.
  useEffect(() => {
    if (!open) return;
    setKind("other");
    setMessage("");
    setImages([]);
    setError(null);
    setSent(false);
  }, [open]);

  async function onSend(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const result = await seam.createIssueReport({ kind, message, page: pathname, images });
      if (result.ok) {
        setSent(true);
      } else {
        setError(result.error);
      }
    } catch {
      // A THROW IS NOT A REFUSAL. A transport failure, or the Supabase client raising on an unusable
      // configuration before any request leaves, must not be rendered as "you are not allowed" —
      // that sentence would be false and would send somebody to ask for a permission they have.
      setError({ code: "unknown", message: "Could not send. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const remaining = MESSAGE_MAX - message.trim().length;

  return (
    <>
      {/* `z-40` AND NOT `z-50`: `Modal` uses 50, so the dialog this button opens paints over the
          button rather than under it. Bottom-RIGHT, which is the corner no screen in this product
          puts a control in.

          SOLO, 2026-09-26 (second run) — **THE BUTTON AND ITS TOOLTIP ARE ONE POSITIONED GROUP.**
          One `fixed` wrapper holding both, laid out as a row, so the tooltip sits to the LEFT of the
          button and moves with it. Two independently fixed elements would have to agree about a
          corner by arithmetic, and they would stop agreeing the first time the button's size
          changed.

          `group` is on the WRAPPER and not on the button, because the tooltip is the button's
          SIBLING and `group-hover` reads the nearest ancestor marked `group`, never a sibling.
          Hovering the wrapper is hovering the button: the tooltip is `pointer-events-none` and the
          wrapper is exactly the two of them. */}
      <div className="group fixed bottom-6 right-6 z-40 flex items-center gap-2">
        {/* **A DRAWN TOOLTIP AND NOT `title`, WHICH IS THE OPERATOR'S POINT.** The first version of
            this button carried `title="Report an issue"` and they asked for a tooltip anyway — which
            is the honest verdict on `title`: a one-second delay, an unstyleable box, no touch
            support, and nothing at all when the control is reached by keyboard. This one appears on
            hover AND on focus, so a keyboard user gets the same sentence a mouse user does.

            `group-hover` / `group-focus-within` rather than React state: there is nothing to
            remember between renders, and a tooltip driven by state re-renders the form beside it on
            every pointer move. `pointer-events-none` so the tooltip can never eat the click that was
            aimed at the button behind it.

            IT IS `aria-hidden` AND THE BUTTON KEEPS ITS `aria-label`. A screen reader announces the
            label; the tooltip is the same words drawn for people who can see them, and announcing
            both would say it twice. */}
        <span
          data-testid="report-issue-tooltip"
          aria-hidden="true"
          className="pointer-events-none rounded-pill bg-ink px-3 py-1.5 text-xs font-semibold text-card opacity-0 shadow-soft transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        >
          Report an issue
        </span>

        <button
          data-testid="report-issue-bubble"
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Report an issue"
          className="flex size-12 items-center justify-center rounded-pill border border-line bg-card text-ink-2 shadow-soft transition-colors hover:bg-field hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {/* SOLO, 2026-09-26 (second run) — **A FLAG, WHICH IS THE `report` GLYPH.** It replaces the
              speech bubble the first run drew, on the operator's instruction *"change the popup icon
              to report"*. A speech bubble means *talk to somebody*; a flag means *flag this*, which
              is the verb on every product that has this button. Chosen by `solo` under `CLAUDE.md`
              § No invention's one carve-out — the visual arrangement of a screen — because no image
              was attached.

              Inline SVG rather than `lucide-react`, the choice `DayPicker.tsx` and `Sidebar.tsx`
              both record: the package is a dependency and almost nothing under `src/` imports it, so
              one more import would make the mixed state harder to resolve rather than easier. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5.5"
          >
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </button>
      </div>

      {open ? (
        <Modal testIdPrefix="report-issue" label="Report an issue" onClose={() => setOpen(false)}>
          <div data-testid="report-issue" className="flex flex-col gap-4">
            {sent ? (
              // **THE CHARM MOMENT, AND IT IS HERE RATHER THAN IN THE GRID.** `CLAUDE.md` § Visual
              // direction: charm belongs in the empty states and the approval moment, and never
              // costs a row in the year view. Sending a report is one of those moments.
              <div data-testid="report-issue-sent" role="status" className="py-4 text-center">
                <p className="text-3xl" aria-hidden="true">
                  🌱
                </p>
                <h1 className="mt-2 text-lg font-semibold text-ink">Thank you — it is sent</h1>
                {/* MIR-17, ADR-088. An org admin no longer reads this — only the CaleChip team does,
                    through the system panel, since MIR-16. The sentence is updated so nobody is told
                    their own admin will see something the database refuses them (ADR-082 decision 1). */}
                <p className="mt-1 text-sm text-ink-2">
                  Thanks — the CaleChip team will see this.
                </p>
                <button
                  data-testid="report-issue-done"
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-4 rounded-pill bg-wfh px-4 py-1.5 text-xs font-semibold text-wfh-ink transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <header>
                  <h1 className="text-lg font-semibold text-ink">Report an issue</h1>
                  <p className="mt-1 text-sm text-ink-2">
                    Tell an admin what happened. This goes to the admins, not to the whole team.
                  </p>
                </header>

                {/* A SEGMENTED CONTROL AND NOT A `<select>`, because three options all fit on
                    screen and a menu hides two of them behind a press. `aria-pressed` is what a
                    screen reader announces; `data-selected` is for the suite and duplicates it
                    knowingly, because an attribute a test reads should not be one a refactor of the
                    accessibility layer can move. */}
                <fieldset className="flex flex-col gap-1">
                  <legend className="text-xs text-ink-3">What kind of thing is it?</legend>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {KINDS.map((option) => (
                      <button
                        key={option.value}
                        data-testid={`report-issue-kind-${option.value}`}
                        data-selected={kind === option.value}
                        type="button"
                        aria-pressed={kind === option.value}
                        onClick={() => setKind(option.value)}
                        className={`rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                          kind === option.value
                            ? "bg-ink text-card"
                            : "bg-track text-ink-2 hover:text-ink"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ink-3">What happened?</span>
                  <textarea
                    data-testid="report-issue-message"
                    value={message}
                    onChange={(event) => {
                      setMessage(event.target.value);
                      // The refusal clears as soon as the value it was about changes. A message
                      // still on screen beside a box somebody has just fixed reads as a second,
                      // fresh failure.
                      if (error) setError(null);
                    }}
                    rows={5}
                    placeholder="The week view shows nothing after I pick a date…"
                    className="resize-y rounded-card border border-line bg-field px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  />
                  {/* Only once it is close, so the counter is a warning rather than decoration. */}
                  {remaining <= 200 ? (
                    <span
                      data-testid="report-issue-remaining"
                      data-remaining={remaining}
                      className={`text-xs ${remaining < 0 ? "text-danger" : "text-ink-3"}`}
                    >
                      {remaining < 0
                        ? `${-remaining} characters over the limit`
                        : `${remaining} characters left`}
                    </span>
                  ) : null}
                </label>

                {/* SOLO, 2026-09-26 (second run) — **OPTIONAL, WHICH IS THE OPERATOR'S WORD.** No
                    asterisk, no requirement, and the send button does not care whether anything is
                    here. Most reports will carry none.

                    **THE `<input type="file">` IS VISUALLY HIDDEN AND NOT `display: none`.**
                    `sr-only` keeps it focusable and keeps it a real form control, so a keyboard user
                    tabs to it and a screen reader announces it; `display: none` would remove it from
                    the tab order and leave the label below as a button that nothing operates. The
                    browser's own file picker is the control and it is not restyled, which is the
                    right call for a dialog that must work on a phone.

                    `accept` IS A HINT AND NOT A CHECK. It filters the picker's default view and a
                    person can still choose *all files*; `issueImageFailure` in the seam and
                    `allowed_mime_types` on the bucket are what actually refuse. */}
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-xs text-ink-3">
                    Screenshots, if you have any (optional)
                  </legend>

                  <label className="mt-1 inline-flex w-fit cursor-pointer items-center gap-2 rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-field hover:text-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink">
                    <input
                      data-testid="report-issue-images"
                      type="file"
                      multiple
                      accept={ISSUE_IMAGE_TYPES.join(",")}
                      className="sr-only"
                      onChange={(event) => {
                        // **APPENDED, NOT REPLACED.** A file picker returns only what was chosen in
                        // that one visit, so assigning would silently drop the images a person
                        // picked a moment ago — the failure mode of every multi-select upload that
                        // does the obvious thing.
                        const chosen = Array.from(event.target.files ?? []);
                        if (chosen.length > 0) setImages((previous) => [...previous, ...chosen]);
                        // The input is CLEARED so choosing the same file twice in a row still fires
                        // a change event. Without it a person who removes an image and re-picks it
                        // gets nothing, with no explanation.
                        event.target.value = "";
                        if (error) setError(null);
                      }}
                    />
                    Choose images
                  </label>

                  {images.length > 0 ? (
                    <ul data-testid="report-issue-image-list" className="flex flex-col gap-1">
                      {images.map((file, index) => (
                        <li
                          // The index is part of the key because two files can carry the same name —
                          // two screenshots dragged from the same folder often do — and a key that
                          // repeats makes React reuse the wrong row when one is removed.
                          key={`${file.name}-${index}`}
                          data-testid="report-issue-image-row"
                          className="flex items-center gap-2 rounded-pill bg-field px-3 py-1 text-xs text-ink-2"
                        >
                          <span className="min-w-0 flex-1 truncate">{file.name}</span>
                          <button
                            data-testid="report-issue-image-remove"
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            onClick={() =>
                              setImages((previous) => previous.filter((_, i) => i !== index))
                            }
                            className="shrink-0 rounded-pill px-1 text-ink-3 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                          >
                            {/* A DRAWN CROSS AND NOT THE CHARACTER `×`. That glyph is U+00D7, which
                                sits inside the range `ui-language.json` scans for a Vietnamese
                                diacritic — so the lint rule refuses it, correctly by its own terms
                                and wrongly about this one character. An SVG is the right answer
                                anyway: it scales with the button and carries no font risk. */}
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 12 12"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              className="size-3"
                            >
                              <line x1="2" y1="2" x2="10" y2="10" />
                              <line x1="10" y1="2" x2="2" y2="10" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {/* The ceiling, stated rather than enforced by a disabled picker — for the reason
                      the send button records: a dead control says nothing about why. Somebody who
                      picks a fourth is refused by the seam, with a sentence. */}
                  <span
                    data-testid="report-issue-image-count"
                    data-count={images.length}
                    className={`text-xs ${images.length > ISSUE_IMAGE_MAX_COUNT ? "text-danger" : "text-ink-3"}`}
                  >
                    {images.length} of {ISSUE_IMAGE_MAX_COUNT} attached, up to 5 MB each.
                  </span>
                </fieldset>

                <p data-testid="report-issue-page" data-page={pathname} className="text-xs text-ink-3">
                  Sent from <span className="font-semibold text-ink-2">{pathname}</span>, so an admin
                  knows where you were.
                </p>

                {error ? (
                  <p
                    data-testid="report-issue-error"
                    data-code={error.code}
                    role="alert"
                    className="text-sm text-danger"
                  >
                    {error.message}
                  </p>
                ) : null}

                <div className="flex justify-end gap-2">
                  <button
                    data-testid="report-issue-cancel"
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-pill border border-line px-4 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-field hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    Cancel
                  </button>
                  {/* NOT DISABLED ON AN EMPTY MESSAGE, and that is deliberate: a dead button says
                      nothing about why, and `.ai/standards/ui-design-system.md` prefers a refusal
                      that explains itself. The seam refuses a blank message with a sentence, which
                      is what appears above. `busy` is the only thing that disables it. */}
                  <button
                    data-testid="report-issue-send"
                    type="button"
                    disabled={busy}
                    onClick={() => void onSend()}
                    className="rounded-pill bg-primary px-4 py-1.5 text-xs font-semibold text-card transition-colors hover:brightness-110 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    {busy ? "Sending…" : "Send report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

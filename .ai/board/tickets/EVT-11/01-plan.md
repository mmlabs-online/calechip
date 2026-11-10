---
ticket: EVT-11
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-13T04:14:00+00:00
inputs_read:
  - .ai/board/tickets/EVT-11/ticket.yaml
  - .ai/board/ideas/2026-10-12-an-event-description-cannot-carry-formatting-or-a-picture.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-056-an-event-description-is-sanitised-html-from-one-editor.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .ai/steward/context.md
  - .ai/standards/tech-stack.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/board/tickets/EVT-10/01-plan.md
  - .ai/board/tickets/EVT-10/03-impl-log.md
  - .ai/board/tickets/EVT-10/04-review.md
  - src/components/DescriptionHtml.tsx
  - src/components/DescriptionEditor.tsx
  - src/routes/EventEditor.tsx
  - src/routes/EventDetail.tsx
  - src/routes/GuestEvent.tsx
  - src/routes/Events.tsx
  - src/lib/viewed-team.ts
  - src/lib/event-layer.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20260926140000_solo_issue_report_images.sql
  - supabase/migrations/20261012230000_evt10_description_html.sql
  - tests/description-html.test.ts
  - tests/seam-parity.test.ts
  - tests/e2e/evt-10-description.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# EVT-11 — plan

## 1. Problem and scope

**EVT-11** (`.ai/registry/features.md:217`), transcribed:

> A creator puts pictures in an event's description, downscaled and capped in size

> From `.ai/board/ideas/2026-10-12-an-event-description-cannot-carry-formatting-or-a-picture.md`, same verdict and ADR as `EVT-10`, and `depends_on: [EVT-10]`. **SCOPE, each clause the operator's:** pictures embedded as base64 `data:` URLs inside the HTML, with no bucket and no URL (Q2-B); downscaled in the browser before embedding, with the description's total size capped by the database (Q6-A). `img` with `data:` sources only joins `EVT-10`'s allow-list; a `CHECK` on `octet_length(description)` holds the cap, and PLAN sets the number and the downscale. Lists and grids fetch the description through `EVENT_COLUMNS` and never render it, so they stop fetching it. **This reverses in practice the `/solo` issue-report decision that refused base64 for list weight** (`supabase/migrations/20260926140000_solo_issue_report_images.sql:14-16`). Q2-B accepts that cost knowingly, and this row pays it down. `schema_delta` is the `CHECK` constraint, not `none` (ADR-014). `Invariants touched` is PLAN's.

**Who gains what.** Anyone who may write an event's description (its creator, or an admin, as with
every other field of the event today, ADR-045 decision 5) can put a picture in it, for example a
venue map or a poster. Every surface that shows the description shows the picture as well:
`EventDetail` to members, and `GuestEvent` to guests (ADR-052). The cost is weight. Q2-B keeps the
picture inside the row, so three things bound it: the browser shrinks the picture before it is
embedded, the database refuses a description over a fixed size, and the lists and grids that never
show a description stop reading it (ADR-056 decisions 4–6).

**The numbers ADR-056 leaves to PLAN** (decision 5) are set here:

| Item | Value | Why |
|---|---|---|
| Accepted input | PNG, JPEG or WebP, at most 10 MB before downscale | The same three types the issue report accepts (`ISSUE_IMAGE_TYPES`, `src/lib/domain/types.ts:965-969`). 10 MB bounds what the browser has to decode. |
| Downscale | Longest edge at most 1200 px, aspect ratio kept, never enlarged | The figure the operator was shown in Q6 |
| Output | WebP at quality 0.8. Where the browser cannot encode WebP, JPEG at quality 0.85 | The smallest widely-encodable format; WebP keeps transparency |
| Cap | `octet_length(description) <= 1048576` (1 MiB) | Room for roughly four to eight downscaled pictures alongside the text |

**Out of scope:**
- Pasting or dragging an image *file* into the editor. The toolbar picker is the only way in.
  Pasted HTML that already carries a `data:` picture still passes through the sanitiser and the cap.
- Editing alt text. Pictures are stored with `alt=""`.
- Resizing, cropping, aligning, captioning or reordering a picture once it is placed.
- GIF, SVG, HEIC, AVIF or any input type other than the three above.
- Choosing more than one picture in one pick.
- A Storage bucket, an image URL, or any new anon or Storage policy (Q2-B, ADR-056 decision 4).
- Pictures in event email. The email stays unchanged (Q7-A).
- `EventEditor.tsx`. It already shows the seam's `message` on a refused save, and its pre-save
  `sanitizeDescription` call keeps pictures once the allow-list does.
- Standards-plane rows that are still owed: the size `CHECK` in `.ai/standards/data-model.md`
  (ADR-056 *Affected documents*), and the Tiptap and DOMPurify rows in `tech-stack.md`. These belong
  to a human or `/thuki`.

`size_estimate: M`.

## 2. Acceptance criteria

**AC-1 — a picture is inserted and shown**
- Given a member is creating an event
- When they choose a PNG file through the description toolbar's "Insert picture" control and save
- Then the editor showed the picture before save, and `EventDetail` shows one `img` inside
  `event-description` whose `src` begins `data:image/`

**AC-2 — the picture is downscaled and never enlarged**
- Given a member inserts a 3000×2000 PNG, and in a second description a 400×300 PNG
- When each event is saved and opened
- Then the first picture's natural size is 1200×800, and the second's is 400×300

**AC-3 — a guest sees the picture**
- Given an event opened to guests whose description holds a picture
- When anyone opens its guest link
- Then `guest-event-description` shows the same picture, with a `src` that begins `data:image/`

**AC-4 — a file that is not an accepted picture is refused**
- Given a member is editing a description
- When they choose a text file, or a PNG larger than 10 MB
- Then `event-description-picture-error` reads "Choose a PNG, JPEG or WebP picture of at most 10 MB."
  and the description is unchanged

**AC-5 — a picture that would pass the cap is refused at insertion**
- Given a description within 1 MiB, to which the next downscaled picture would add enough to pass it
- When the member chooses that picture
- Then `event-description-picture-error` reads "This picture would make the description larger
  than 1 MB. Remove a picture or choose a smaller one." and the description is unchanged

**AC-6 — the seam refuses a description over the cap**
- Given a `SaveEventInput` whose `description` is more than 1048576 bytes as UTF-8, after
  blank-to-null
- When it is passed to `createEvent` or `updateEvent`
- Then the result is `{ ok: false }` with `code: "description_too_large"` and
  `message: "The description is larger than 1 MB. Remove a picture to save."`, and nothing is
  written. In the real seam the same failure is returned when the database answers `23514` for
  that input

**AC-7 — only an embedded PNG, JPEG or WebP picture survives the render**
- Given a description written straight to the datastore, holding `img` elements whose `src` is
  `https://…`, `data:image/svg+xml;base64,…`, `data:image/png,` with no `;base64`, and
  `data:text/html;base64,…`, an `img` carrying `onerror`, `style`, `width` and `height`, and one
  `img` whose `src` is a valid `data:image/png;base64,…`
- When `EventDetail` and `GuestEvent` render it
- Then each surface shows exactly one `img`, the valid one, carrying no attribute but `src` and `alt`,
  and no script runs

**AC-8 — lists and grids no longer carry the description**
- Given events whose descriptions hold pictures
- When the Events list, the week grid or the month grid is read, for the viewer's own team or for
  another team
- Then `listEvents` and `listEventsForTeam` return every event with `description: null`, every event
  is still drawn, and `getEvent` still returns the full description

**AC-9 — the database holds the cap**
- Given the EVT-11 migration
- When it is read
- Then it adds constraint `event_description_bounded` on `public.event` as
  `check (description is null or octet_length(description) <= 1048576)`, idempotently

**AC-10 — an unchanged edit keeps the pictures**
- Given an event whose description holds a picture
- When a member opens it in the editor and saves without changes
- Then `EventDetail` still shows the same picture

**Invariants touched:** `[]`. INV-01 to INV-07 all concern entries, and an event is not an entry —
the idea file says so, and EVT-10's PLAN gave the same answer. "A warning never blocks" is charter
refusal 6, about the overload warning; the cap is a size refusal on an event, not a warning on an
entry.

**Open questions:** none. ADR-056 decision 5 gives the numbers to this stage, and § 1 sets them.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

- The toolbar `event-description-toolbar` gains one button, `event-description-picture` (lucide
  `ImagePlus`, label "Insert picture"), after the alignment group. It opens a hidden
  `event-description-picture-input` (`type="file"`, `accept="image/png,image/jpeg,image/webp"`).
- A picture is a block of its own, `max-width: 100%`, `height: auto`, with rounded corners. The rule
  goes on `DESCRIPTION_RENDER_CLASS`, so the editor and both surfaces look alike.
- A refusal shows inline directly under the toolbar as `event-description-picture-error`, in the
  form's existing error style. It clears on the next successful insertion.

## 3. Permission model

**Unchanged.** Who may write a description is still governed by `public.save_event`: the creator,
or an admin through `may_manage_event` (= `is_admin`, never `may_decide`). No role gains or loses an
action.

**The control is the `CHECK`, on the server.** The `authenticated` column grants
(`20260929120000_evt01_event.sql:334-335`) let any permitted writer update `description` directly,
bypassing `save_event` and the seam (ADR-005). `event_description_bounded` refuses an oversized row
whichever way it arrives. The editor's checks (AC-4, AC-5) and the seam's pre-check (AC-6) are
affordances only.

**The render is the security layer for content** (ADR-056 decision 2). A picture is allowed only as
a base64 PNG, JPEG or WebP `data:` URL. A remote `src` would let a description make every reader's
browser fetch a URL; an SVG can carry script. Both are refused (AC-7).

**Anon:** a guest reads pictures only through the existing `get_guest_event`. No grant, function or
policy changes.

**Denials:** a member who may not write an event still may not write its description. A guest still
writes nothing to an event. Nobody can raise the cap from the client.

## 4. Contract

### 4.1 `src/lib/domain/types.ts`

```ts
/** EVT-11. ADR-056 decision 5 — the database's `event_description_bounded` holds it. */
export const DESCRIPTION_MAX_BYTES = 1048576;
/** EVT-11. Accepted picker input; the stored picture is WebP or JPEG. */
export const DESCRIPTION_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const DESCRIPTION_IMAGE_MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const DESCRIPTION_IMAGE_MAX_EDGE = 1200;

/** UTF-8 byte length, as PostgreSQL's `octet_length` counts it. Null is 0. */
export function descriptionBytes(html: string | null): number;
```

The `CalEvent.description` docblock gains: *"Null on `listEvents` and `listEventsForTeam` reads,
which never carry it (ADR-056 decision 6). Read it through `getEvent`."*

### 4.2 `src/lib/description-image.ts` (new)

```ts
export const DESCRIPTION_IMAGE_REFUSED = "Choose a PNG, JPEG or WebP picture of at most 10 MB.";

/** Decodes with createImageBitmap, draws onto a canvas scaled so the longest edge is at most
 *  DESCRIPTION_IMAGE_MAX_EDGE (never enlarged), encodes with canvas.toBlob("image/webp", 0.8) —
 *  falling back to ("image/jpeg", 0.85) when the blob's type is not image/webp — and reads the
 *  blob as a data: URL. Refuses with code "description_image_refused" and the message above when
 *  the type is not in DESCRIPTION_IMAGE_TYPES, the size exceeds DESCRIPTION_IMAGE_MAX_INPUT_BYTES,
 *  or decoding fails. */
export function downscaleToDataUrl(file: File): Promise<Result<string>>;
```

`Result` is the seam's existing type. This is the first downscaler in the repository; nothing exists
to reuse.

### 4.3 `src/components/DescriptionHtml.tsx`

- `DESCRIPTION_TAGS` gains `"img"`. Nothing else joins (ADR-056 decision 2).
- `DESCRIPTION_ATTRIBUTES` gains `img: ["src", "alt"]`.
- New export:
  `export const DESCRIPTION_IMAGE_SRC = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;`
- The `uponSanitizeAttribute` hook drops `src` on `img` unless it matches `DESCRIPTION_IMAGE_SRC`.
- After the walk, every `img` without a `src` is removed. This is the same pass that unwraps an `a`
  without `href`.
- `ALLOWED_URI_REGEXP` stays `DESCRIPTION_HREF`. Links still refuse `data:`.
- `DESCRIPTION_RENDER_CLASS` gains the picture rule from § 2b.
- `TODO(verify)`: DOMPurify 3's `DATA_URI_TAGS` exception lets a `data:` `src` through on `img`
  regardless of `ALLOWED_URI_REGEXP`. The hook above is what narrows it, and AC-7's unit tests prove
  the result whichever way the exception behaves.

### 4.4 `src/components/DescriptionEditor.tsx`

- An in-house Tiptap node, no new dependency:

  ```ts
  const DescriptionImage = Node.create({
    name: "image", group: "block", atom: true, draggable: false,
    addAttributes() { return { src: { default: null }, alt: { default: "" } }; },
    parseHTML() { return [{ tag: 'img[src^="data:image/"]' }]; },
    renderHTML({ HTMLAttributes }) { return ["img", HTMLAttributes]; },
  });
  ```

  `Node` is imported from `@tiptap/react`. `TODO(verify)` that `@tiptap/react` 3.31.4 re-exports
  `@tiptap/core`, against the installed `.d.ts`. If it does not, stop and report: `@tiptap/core`
  is transitive under pnpm's strict layout, and adding it is a dependency change outside this plan.
- On pick:
  1. `downscaleToDataUrl(file)`. On failure, show its message.
  2. Build `<img src="…" alt="">`, measure `descriptionBytes(currentHtml) + descriptionBytes(imgHtml)`
     and refuse if it exceeds `DESCRIPTION_MAX_BYTES`, with
     `DESCRIPTION_PICTURE_TOO_LARGE = "This picture would make the description larger than 1 MB. Remove a picture or choose a smaller one."`.
  3. Otherwise `insertContent({ type: "image", attrs: { src, alt: "" } })`.
  4. Reset the input's value so that the same file can be chosen again.
- Selectors: `event-description-picture`, `event-description-picture-input`,
  `event-description-picture-error`.

### 4.5 `src/lib/data/supabase.ts`

```ts
const EVENT_LIST_COLUMNS =
  "id, creator_id, team_id, name, location, start_date, end_date, scope, " +
  "capacity, requires_approval, registration_deadline, created_at, updated_at";
const DESCRIPTION_TOO_LARGE = "The description is larger than 1 MB. Remove a picture to save.";
```

- `listEvents` (:3286) and `listEventsForTeam` (:3563) select `EVENT_LIST_COLUMNS`. `getEvent`
  (:3310) keeps `EVENT_COLUMNS`.
- `EventRow.description` becomes optional. `toEvent` maps an absent value to `null`.
- `eventInputFailure`, after the four existing checks:
  `if (descriptionBytes(blankToNull(input.description)) > DESCRIPTION_MAX_BYTES) return { code: "description_too_large", message: DESCRIPTION_TOO_LARGE };`
- `toEventFailure`, case `"23514"`: the same test is inserted **before** the
  `registrationDeadline != null` branch, which otherwise catches every remaining 23514.

### 4.6 `src/lib/data/mock.ts`

- `listEvents` and `listEventsForTeam` return copies with `description: null`.
- `createEvent` and `updateEvent` carry the same `description_too_large` check, in the same place
  and with the same wording. The mock repeats the seam-side refusals, as its docblock says.

### 4.7 Migration `supabase/migrations/20261013090000_evt11_description_bounded.sql`

```sql
-- EVT-11 — ADR-056 decision 5. The cap on an event description, pictures included.
-- NOT VERIFIED AGAINST A RUNNING POSTGRESQL. Applying it is human-only (RULE-09).
do $$ begin
  alter table public.event
    add constraint event_description_bounded
    check (description is null or octet_length(description) <= 1048576);
exception when duplicate_object then null;
end $$;
```

The check is row-local, so the "no subquery in a check constraint" error recorded in
`20260926140000_solo_issue_report_images.sql:38-45` does not arise. Existing rows are text that
EVT-10 converted, so they are far under 1 MiB and validation is not expected to fail. The migration
touches no trigger.

### 4.8 Tests

| File | Covers |
|---|---|
| `tests/description-html.test.ts` | Updates the EVT-10 allow-list assertions (`img` absent at :52 becomes `img` present with `src`/`alt` only). Adds AC-7's sanitiser cases. |
| `tests/description-pictures.test.ts` (new) | AC-6 against `mockSeam` for create and update. AC-6's real-seam mapping by source scan of `toEventFailure` order. AC-8 against `mockSeam`, plus a source check that `EVENT_LIST_COLUMNS` omits `description` and that both list reads use it. AC-9 against the migration text. `descriptionBytes` counts multi-byte characters. |
| `tests/e2e/evt-10-description.spec.ts` | AC-8 and AC-9 there change from "no `img`" to "no `img` but a valid `data:` picture, no `onerror`". |
| `tests/e2e/evt-11-description-pictures.spec.ts` (new) | AC-1 to AC-5, AC-7 and AC-10. Pictures are generated inside the test as PNG buffers for `setInputFiles`, never as files in the repo. AC-7 writes through `window.__calechipMockSeam`. |

Every test name carries its AC ID (`testing-standards.md`).

## 5. Seam impact

- **No function is added, removed or re-signed**, so `tests/seam-parity.test.ts` is untouched and
  holds.
- `listEvents` and `listEventsForTeam` keep their signatures. Their results now carry
  `description: null` in both implementations.
- `createEvent` and `updateEvent` gain one refusal, `description_too_large`, in both
  implementations.

## 6. Schema delta

`CHECK` constraint `event_description_bounded` on `public.event`:
`description is null or octet_length(description) <= 1048576`.

Decided by [ADR-056](../../../registry/decisions/ADR-056-an-event-description-is-sanitised-html-from-one-editor.md)
decision 5, `ACCEPTED by the operator` on 2026-10-12. It is a constraint, so it is not `none`
(ADR-014). No RPC, grant, policy or trigger changes.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20261013090000_evt11_description_bounded.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/description-image.ts"
  - "src/components/DescriptionHtml.tsx"
  - "src/components/DescriptionEditor.tsx"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "tests/description-html.test.ts"
  - "tests/description-pictures.test.ts"
  - "tests/e2e/evt-10-description.spec.ts"
  - "tests/e2e/evt-11-description-pictures.spec.ts"
```

Eleven paths, so `size: M`, which **agrees** with `size_estimate: M`. `glossary_owed` is `[]`. The
"Sanitised description" row already names EVT-11's `img` and needs no edit. `.ai/registry/glossary.md`
is therefore not on the list.

## 8. Rejected alternatives

**1. `@tiptap/extension-image`.** It is the obvious way to put pictures in a Tiptap editor, and it
is version-matched to the rest. It was rejected because ADR-056 counted the editor and the sanitiser
as the only two new runtime dependencies. A third needs ADR coverage under R8, and the node it would
provide is about fifteen lines here, configured to refuse anything but `data:` pictures — which the
package would need configuring to do anyway.

**2. A `CalEventSummary` type for list reads.** `Omit<CalEvent, "description">` returned by
`listEvents` and `listEventsForTeam` is the more honest type. A list read would then be unable even
to name the field. It was rejected on size: the type ripples into `event-layer.ts`,
`viewed-team.ts`, `EventChip.tsx`, `WeekView.tsx`, `MonthView.tsx` and `Events.tsx`. That is about
nineteen paths, size L, and a split this stage would have to make. `description: null` on list reads,
stated in the type's docblock and tested (AC-8), gives the same weight saving at M. If a later ticket
touches those files anyway, it can make the type change.

**3. A Storage bucket with URLs in the HTML.** This keeps rows light and matches the issue report's
design. It was refused by the operator in Q2 (answer B) and recorded in ADR-056 decision 4.

## Changelog

- `2026-10-13T04:14:00+00:00` — all sections written. Raised by `tech-lead-design`. Written on branch
  `claude/cool-noether-33uwk8`, not `feat/EVT-11`, because this cloud session is bound to that branch.

---
doc_version: 3
last_updated: 2026-10-12
governed_by: [RULE-01, RULE-09]
---

# ADR-056 — An event description is sanitised HTML, written by one editor and read through one sanitiser

## Status

`ACCEPTED by the operator` — 2026-10-12, in words, at `/idea` of
`.ai/board/ideas/2026-10-12-an-event-description-cannot-carry-formatting-or-a-picture.md`
§ *Evidence*. Drafted by `product` at `/triage` of that file, 2026-10-12T09:55:54Z, from a technical
half supplied by `tech-lead-design`, consulted and writing nothing.

**Recorded, not authored.** Each decision below is an option the operator picked from a question
that stated its cost. Their answers, verbatim from § *Evidence*:

> Q5 (Editor.js stores JSON blocks, not HTML): **"A: Editor xuất HTML"**
>
> Q1 (unsanitised HTML is an XSS hole): **"B: Lọc cả khi lưu"**
>
> Q2 (where pictures are kept): **"B: Nhúng base64"**
>
> Q6 (base64 weight): **"A: Nén + trần tổng"**
>
> Q4 (existing plain-text descriptions): **"A: Migration chuyển đổi"**

The request itself: *"cho phép user viết bằng Text editor có thể in đậm, in nghiêng,... và chèn ảnh
nhưng lúc lưu sẽ lưu thành dạng text thuần (mã HTML)"*.

**What is not the operator's, and is named rather than folded in.** The **package names** are not
decided here. Q5-A said *"e.g. Tiptap"* and *"the library is PLAN's"*; this ADR fixes the shape — one
HTML-writing editor, one sanitiser, one allow-list — and leaves the two packages to `/plan` of
`EVT-10`, which names them, verifies them against their installed sources (both likely candidates are
past reliable recall under `.ai/standards/tech-stack.md`), and records them on the tech-stack page.
The **lighter list reads** in decision 6 are `tech-lead-design`'s technical consequence of Q2-B and
Q6-A, not a separate operator answer.

**Supersedes nothing.** [ADR-005](ADR-005-authorization-in-rls.md) stands in full: sanitising is not
authorization, and nothing here moves an access decision out of row-level security.
[ADR-052](ADR-052-an-event-can-be-opened-to-guests-without-an-account.md) stands in full: its revert
condition 1 is about *which* data the anonymous role reads, and this ADR changes only the markup of
data it already reads.

## Context

- `public.event.description` is a plain `text` column
  (`supabase/migrations/20260929120000_evt01_event.sql:65`). The form edits it in a textarea
  (`src/routes/EventEditor.tsx:453`); the detail page and the guest page print it as
  `whitespace-pre-wrap` text (`src/routes/EventDetail.tsx:198`, `src/routes/GuestEvent.tsx:207`).
- The description is read by every member who can read the event and, since `EVT-06`, by anonymous
  guests holding the link (ADR-052). Whatever the render lets through reaches the internet.
- There is no server of our own in the read or write path (ADR-005). Anything the client does before
  saving can be bypassed by calling the API directly.
- Lists and the week and month grids read the event row through `EVENT_COLUMNS`, which includes the
  description, and never render it.
- `.ai/standards/tech-stack.md` § *Changing anything on this page*: a new runtime dependency needs an
  ADR, and review check R9 fails a dependency added without one. This change adds two.
- **Precedent pointing the other way.** The `/solo` issue-report images refused base64 in the row
  for exactly the list-weight reason
  (`supabase/migrations/20260926140000_solo_issue_report_images.sql:14-16`: *"the admin list would
  ship every image of every report on each read"*). That was an operator decision recorded in a
  migration comment, not an ADR, and it governed a different table; Q2-B is the operator choosing the
  other answer here, knowingly, with the weight stated in the question.

## Decision

1. **`public.event.description` stores HTML, as text** (the request, Q5-A). No JSON, no second
   column. **One editor** writes it, on both create and edit.
2. **One sanitiser, one shared render component.** Every surface that renders a description renders
   it through one component that sanitises against an allow-list: the formats Q3 selected (bold,
   italic, underline, strikethrough; H2/H3, bulleted and numbered lists; links; blockquote, text
   colour, alignment) plus `img` whose source is a `data:` image URL and nothing else. `EventDetail`
   and `GuestEvent` use it, and any surface `/plan` finds. **The render is the security layer.**
3. **The client also sanitises before saving** (Q1-B), with the same sanitiser and allow-list. It is
   **defence in depth only**: ADR-005 means it runs in the browser and can be bypassed, so no
   acceptance criterion may rest on it.
4. **Pictures are base64 `data:` URLs inside the HTML** (Q2-B), downscaled in the browser before
   embedding (Q6-A). No Storage bucket, no image URL, no new anon or Storage policy.
5. **The database caps the description's size** (Q6-A *"trần tổng"*): a `CHECK` on
   `octet_length(description)`. The number, and the downscale dimensions and format, are `/plan`'s.
6. **Compact surfaces never render the HTML and stop carrying it.** Lists and grids that fetch the
   description and do not show it stop fetching it, so the weight Q2-B adds is paid on the pages that
   show the picture and not on every list read.
7. **Existing rows are converted once, by a data migration** (Q4-A): plain text is HTML-escaped and
   its line breaks become `<p>` / `<br>`, so no existing description can become markup. The migration
   **must not** fire `notify_event_updated` and **must not** move `updated_at` — a format conversion is
   not an edit, and must not notify every participant of every event.
8. **Event email is unchanged** (Q7-A). `send-event-email` does not read the description.

## Rationale

**Rejected: Editor.js** — Q5-B and Q5-C, offered and not chosen. It stores JSON blocks; converting to
HTML on save re-opens lossily, its core has no underline, colour or alignment, and storing both needs a
second column.

**Rejected: sanitise at render only** — Q1-A. Technically sufficient; the operator chose the extra
layer knowing it is bypassable.

**Rejected: a public-read Storage bucket with URLs in the HTML** — Q2-A. Lighter rows and lists, at
the price of the product's second bucket and an anonymous read on it. **Rejected: paste a URL only** —
Q2-C, which does not let a creator put their own picture in.

**Rejected: no size limit** — Q6-B. A single full-size photo is several MB in every read of the row.

**Rejected: two render paths, one for old plain text and one for HTML** — Q4-B. A guessing render is
a second thing to sanitise correctly.

**Rejected, technically: a database-side sanitiser** (a trigger or definer function stripping tags).
It would be the only HTML parser in PostgreSQL in this product, a second allow-list to keep identical
to the client's, and still not the layer that protects the reader — the render is.

## Consequences

- **Two runtime dependencies enter the tree**: an editor and a sanitiser. Both are past reliable
  recall; `/plan` of `EVT-10` reads their installed sources before writing config against them.
- **The sanitiser becomes security-critical code we did not write.** A bypass in it is an XSS on the
  guest page, which anyone with a link can open. Keeping it current is now a standing cost.
- **Every description becomes HTML**, and anything that reads the column as text — a search, an
  excerpt, a future email — must strip tags first.
- **Rows get heavy.** One downscaled picture is tens to hundreds of KB of base64; the cap bounds it.
  The `/solo` issue-report decision refused exactly this cost; here it is accepted and paid down by
  decision 6.
- **The cap is a hard failure the creator can hit** — a save rejected by the database. The editor must
  say why rather than fail generically; that message is `/plan`'s to specify.
- **The migration rewrites every existing description once.** It is a data migration, applied by a
  human (RULE-09), and it is not reversible by a second migration without guessing which rows were
  converted.

## Revert condition

Any one occurrence:

1. **Markup outside the allow-list, or any script, event handler, or non-`data:` image source,
   executes or loads on a page that renders a description.** On observation: render descriptions as
   escaped text everywhere until the sanitiser or allow-list is fixed.
2. **A surface renders a description without the shared component.** On observation: that surface is
   a defect against this ADR and is fixed before anything else on it ships.
3. **A list or grid read carries the description after `EVT-11` ships**, or the cap is lifted without
   a new ADR. On observation: the operator decides between Q2-A (a bucket) and a lower cap; this ADR
   is not reverted silently.
4. **The conversion migration notifies anyone or moves `updated_at`.** On observation: the
   notifications are a defect; the migration is corrected before it is applied anywhere else.

## Affected documents

- `.ai/standards/tech-stack.md` — two new rows, the editor and the sanitiser, with the packages `/plan`
  of `EVT-10` names, both on the past-reliable-recall list. **Standards plane: a human's or the
  steward's edit**, not a ticket's, unless `/plan` puts it in `allowed_paths` with approval.
- `.ai/standards/data-model.md` — `public.event.description` is HTML; the size `CHECK` (`EVT-11`).
- `.ai/standards/rbac-and-security.md` — the render sanitiser as the XSS layer for description; not an
  authorization control.
- `.ai/registry/features.md` — the `EVT-10` and `EVT-11` rows cite this ADR.
- `.ai/registry/glossary.md` — *Sanitised description*, owed under ADR-047 and written at `/plan` of
  `EVT-10`.
- `.ai/registry/boundaries.json` — only if `/plan` names a revert condition of the form *this package
  may only be reachable from the shared render component*; this ADR does not require one.

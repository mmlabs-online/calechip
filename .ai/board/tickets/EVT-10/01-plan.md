---
ticket: EVT-10
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-12T23:26:45+0700
inputs_read:
  - .ai/board/tickets/EVT-10/ticket.yaml
  - .ai/board/ideas/2026-10-12-an-event-description-cannot-carry-formatting-or-a-picture.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-056-an-event-description-is-sanitised-html-from-one-editor.md
  - .ai/registry/decisions/ADR-024-the-seed-is-human-applied-and-converge-only.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .ai/steward/context.md
  - .ai/standards/tech-stack.md
  - .ai/standards/data-model.md
  - .ai/board/tickets/EVT-09/01-plan.md
  - src/routes/EventEditor.tsx
  - src/routes/EventDetail.tsx
  - src/routes/GuestEvent.tsx
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/main.tsx
  - src/index.css
  - eslint.config.js
  - vite.config.ts
  - playwright.config.ts
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
  - supabase/migrations/20261009120000_evt06_guest_link.sql
  - supabase/migrations/20261012100000_evt08_event_email_invitation.sql
  - tests/events.test.ts
  - tests/e2e/evt-01-events.spec.ts
  - tests/e2e/evt-06-guest-link.spec.ts
  - "npm pack: @tiptap/react, @tiptap/core, @tiptap/starter-kit, @tiptap/extension-link, @tiptap/extension-text-style, @tiptap/extension-text-align 3.31.4; dompurify 3.4.17 — dist/*.d.ts and dist/index.js read"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# EVT-10 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md` § EVT without paraphrase:**

| ID | Title |
|----|-------|
| EVT-10 | A creator formats an event's description, and every surface that shows it renders it sanitised |

The row's Notes are the scope, each clause the operator's answer in the idea's § *Evidence*: *"the
description stores HTML as text, written by one HTML-writing editor on create and edit (the request,
Q5-A); bold, italic, underline, strikethrough, H2/H3, lists, links, blockquote, text colour and
alignment (Q3); one shared render component sanitises against an allow-list on every surface that
shows the description, which includes `EventDetail` and the anon-readable `GuestEvent` (ADR-052); the
client also sanitises before saving, as **defence in depth only**, because ADR-005 lets the API be
called directly (Q1-B); a data migration HTML-escapes existing descriptions into `<p>`/`<br>` (Q4-A),
and **it must not fire `notify_event_updated` or move `updated_at`**; event email unchanged (Q7-A).
Package names are PLAN's."* Decided by ADR-056 (`ACCEPTED by the operator`), decisions 1, 2, 3, 7, 8.

**Who gains what.** A member creating or editing an event can today only type one block of plain
text. After this ticket they write the description in a small editor with a toolbar — headings,
bold, lists, a link to the venue, a coloured line, a centred title — and every reader sees it laid
out that way: members on the event's page, and anyone holding the guest link on the guest page,
which is the only page an outside invitee ever sees. Because that page is on the open internet, what
a reader's browser receives is passed through one sanitiser against one allow-list on every surface,
whatever was stored — a description written straight to the API, bypassing the editor, can carry
formatting and nothing else.

**Packages, named here as ADR-056 left them to PLAN** and verified against their published sources
(`inputs_read`, last line):

| Role | Packages | Major |
|---|---|---|
| The editor | `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-text-style`, `@tiptap/extension-text-align` | 3 |
| The sanitiser | `dompurify` | 3 |

Tiptap is one editor shipped as five packages; ADR-056's "two runtime dependencies" counts the
editor once. In 3.x `StarterKit` already carries Link and Underline (`@tiptap/starter-kit`
`package.json` dependencies); `Color` is exported by `@tiptap/extension-text-style`. `dompurify` 3
ships its own types (`dist/purify.es.d.mts`), so no `@types` package.

**Out of scope.**

- **Pictures** — `img` with `data:` sources, the browser downscale, the size `CHECK`, and lighter
  list reads. All `EVT-11`'s (ADR-056 decisions 4–6). In this ticket `img` is **not** on the
  allow-list at all, so a picture written straight to the datastore renders as nothing.
- **A size cap on the description.** `EVT-11`'s `CHECK`. EVT-10 adds no length limit.
- **The description in event email** (Q7-A). `send-event-email` does not read it and is not touched.
- **Any surface other than `EventDetail` and `GuestEvent` rendering the description.** None does
  today (§ 7's search); compact surfaces keep not showing it, and no excerpt is added.
- **Formats not in Q3** — tables, code, horizontal rules, H1/H4+, embedded video, mentions,
  highlight, font family or size (idea § *Out of scope*). Justify alignment is not offered either:
  Q3 said *alignment*, and left, centre, right are the three a creator can tell apart.
- **Preserving runs of spaces and leading indentation from old plain text.** `whitespace-pre-wrap`
  showed them; HTML collapses them. The migration keeps every character and every line break, not
  the width of whitespace (§ 8 alternative 3).
- **Editing the three standards pages ADR-056 § *Affected documents* names** —
  `.ai/standards/tech-stack.md` (the two package rows above), `.ai/standards/data-model.md`
  (`event.description` is HTML), `.ai/standards/rbac-and-security.md` (the render sanitiser as the
  XSS layer). Standards plane, human-only (`CLAUDE.md` § *Two planes*); ADR-056 names them as a
  human's or the steward's edit. Owed, named, not done here.
- **`supabase/db.sql`** — MD-033 owns bringing it level, as every EVT migration has said.
- **A lint rule for the two boundaries.** Enforced by a source-scanning unit test instead (§ 8
  alternative 4).
- **Seed data.** `supabase/seed.sql` and the mock hold no event description; nothing to convert.

**`size_estimate: M`** — two new components, three route files, one data migration, a dependency
install, and their tests. No seam function, no type, no RPC, no grant.

## 2. Acceptance criteria

Vocabulary as `EVT-01`'s (*the create form*, *the edit form*, *the event's page* `event-detail`) and
`EVT-06`'s (*the guest page* `guest-event`). Additionally:

- **The editor** — the description field on the create and the edit form, `event-description-input`,
  with its toolbar `event-description-toolbar`.
- **The ten formats** — bold, italic, underline, strikethrough, heading 2, heading 3, bulleted list,
  numbered list, blockquote, link; plus **text colour** and **alignment** (left, centre, right). Q3,
  all four groups.
- **Both surfaces** — `event-description` on the event's page and `guest-event-description` on the
  guest page.
- **Straight to the datastore** — a description saved by calling the seam's `updateEvent` directly,
  without the form. ADR-005: anyone holding a session can do this to the real API; it is the case the
  render must survive.
- **The hostile description** — this exact string, used by AC-7 and AC-8:

  ```html
  <h2 style="text-align: center">Title</h2><p>ok <strong>bold</strong></p><script>window.__xss=1</script><img src=x onerror="window.__xss=2"><img src="https://example.com/a.png"><a href="javascript:window.__xss=3">js</a><p onclick="window.__xss=4" style="text-align: center; background: url(https://example.com/b.png)">c</p><span style="color: #be123c; position: fixed">red</span><iframe src="https://example.com/"></iframe><h1>big</h1><style>body{display:none}</style><a href="https://example.com/x" id="clobber" class="x" data-x="1">ok link</a>
  ```

### Writing

**AC-1 — the editor offers the formats on both forms**
- Given the create form, or the edit form of an event the caller may edit (`EVT-01` AC-10, AC-16)
- When it is shown
- Then `event-description-input` is an editable rich-text area under the label *Description
  (optional)*, and `event-description-toolbar` above it holds one control per format, colour and
  alignment, each named in § 4.4
- And each toggle control reports whether its format applies at the caret (`aria-pressed`)
- And `Ctrl/⌘+B`, `+I`, `+U` apply bold, italic and underline

**AC-2 — what was formatted is what the event's page shows**
- Given the creator types a description and applies each of the ten formats, one colour and centre
  alignment to parts of it
- When they press `event-save`
- Then on the event's page `event-description` holds the text with each format drawn as such: an
  `h2` and an `h3`, `strong`, `em`, `u`, `s`, a `ul` and an `ol` of `li`, a `blockquote`, a link, a
  `span` whose computed colour is the one chosen, and a block whose computed `text-align` is
  `center`

**AC-3 — the guest page shows the same, the same way**
- Given that event opened to guests (`EVT-06`)
- When anyone opens its guest link
- Then `guest-event-description` holds the same elements, in the same order, with the same text, as
  `event-description` does for the same event

**AC-4 — re-opening is lossless**
- Given an event whose description was saved by the editor (AC-2)
- When its edit form is opened
- Then the editor shows every format, colour and alignment it was saved with
- And pressing `event-save` without changing anything stores a description equal, character for
  character, to the one stored before

**AC-5 — plain typing still works as before**
- Given the create form
- When the creator types *Bring your appetite* into `event-description-input` with no formatting and
  saves
- Then `event-description` reads exactly *Bring your appetite* — `EVT-01`'s and `EVT-06`'s existing
  end-to-end specs pass unchanged

**AC-6 — no text is no description**
- Given the editor holds no text — never touched, cleared, or holding only empty paragraphs,
  headings or list items
- When the form is saved
- Then the event has no description: neither `event-description` nor `guest-event-description` is
  drawn (`EVT-01` AC-2, unchanged)

### Links

**AC-7 — a link is http, https or mailto, and opens in a new tab**
- Given the creator selects text, presses `event-description-link`, types an address into
  `event-description-link-input` and presses `event-description-link-apply`
- Then an address starting `https://`, `http://` or `mailto:` (any letter case) makes the selection a
  link; a bare `example.com` becomes `https://example.com`; anything else (`javascript:…`,
  `data:…`, `ftp:…`) makes no link
- And on both surfaces every link carries `target="_blank"` and a `rel` containing `noopener` and
  `noreferrer`
- And in the hostile description written straight to the datastore, `js` is shown as plain text with
  no `href` anywhere on it, and `ok link` is a link to `https://example.com/x` carrying the same
  `target` and `rel`
- And `event-description-link-remove` turns the selected link back into text

### The render is the security layer

**AC-8 — whatever is stored, only the allow-list reaches the reader**
- Given an event whose description is the hostile description, written straight to the datastore,
  and opened to guests
- When its page and its guest page are each opened
- Then on both surfaces:
  - `window.__xss` is `undefined` after the page has settled
  - no request is made to `example.com`
  - the description holds no `script`, `img`, `iframe`, `style` or `h1` element, and no element
    carries an attribute whose name starts with `on`, nor `id`, `class` or any `data-*` attribute
  - *Title* is an `h2` whose `style` is exactly `text-align: center`; *c* is a `p` whose `style` is
    exactly `text-align: center`; *red* is a `span` whose `style` is exactly `color: #be123c`
  - *ok* **bold**, *c*, *red* and *big* are each shown as text; *big* is not a heading
  - the page outside the description is drawn as normal (the injected `style` did not hide it)
- And the same holds for any element or attribute outside § 4.1's allow-list, which is the
  allow-list for both surfaces and for AC-9

**AC-9 — saving through the form sanitises too (defence in depth)**
- Given the event of AC-8, whose stored description is the hostile description
- When its creator opens the edit form and presses `event-save` without touching the editor
- Then the stored description contains none of `<script`, `<img`, `<iframe`, `<style`, `<h1`,
  `onerror`, `onclick`, `javascript:`, `example.com/a.png`, `example.com/b.png`, `id=`, `class=`,
  `data-x`
- *This criterion describes the form. No other criterion rests on it: AC-8 holds for a stored value
  the form never saw, which is the only case ADR-005 lets us count on.*

### Existing descriptions

**AC-10 — the migration turns every old description into the HTML it already meant**
- Given an event whose description is plain text, as every description is before this ticket's
  migration is applied
- When the migration is applied
- Then that description is HTML in which `&`, `<` and `>` are written as `&amp;`, `&lt;` and `&gt;`;
  each run of lines separated by one or more blank lines is one `<p>…</p>`, in order; each single
  line break inside a run is `<br>`; Windows (`\r\n`) and old-Mac (`\r`) breaks count as line breaks;
  blank lines at the start and the end are dropped
- And so `a < b & c` followed by a blank line and `x` then `y` becomes
  `<p>a &lt; b &amp; c</p><p>x<br>y</p>`, and rendered shows the same characters on the same lines
- And a description that is empty or only whitespace becomes no description (`null`), as `EVT-01`
  AC-2 stores a blank one
- And a description that already begins with `<p`, `<h2`, `<h3`, `<ul`, `<ol` or `<blockquote`
  followed by a space or `>` is left as it is, so applying the migration a second time changes
  nothing

**AC-11 — the conversion is not an edit**
- Given the migration converts any number of descriptions
- Then no notification row is written — `notify_event_updated` does not fire, and so no event email
  is sent (`EVT-05` mails only from notification rows)
- And no event's `updated_at` changes
- And `event_stamp` and `notify_event_updated` are both enabled again when the migration finishes,
  so the next edit after it stamps and notifies exactly as before (`EVT-01`, `EVT-04` AC-5)

### Every surface

**AC-12 — one component renders a description, and only it**
- Given the source tree after this ticket
- Then `event-description` and `guest-event-description` are each drawn by § 4.2's `DescriptionHtml`
- And no other file under `src/` uses `dangerouslySetInnerHTML`, imports `dompurify`, or renders a
  description field
- And only § 4.3's `DescriptionEditor` imports `@tiptap/*`
- And event email (`supabase/functions/send-event-email/`) is unchanged by this ticket

**Invariants touched: `[]`.** Nothing here reads or writes an entry, a portion, an approval, a member's
team or the absence count. An event is not an entry (glossary *Event*; idea § *Constraints already
known*: *"INV-04, INV-05 and INV-07 are not engaged"*). The migration writes one column of
`public.event` and nothing else.

**Open questions.** None that block. This plan's own decisions, each cheap to reverse: links are
`http`, `https` and `mailto` only (idea assumption 3, kept); the editor offers a fixed palette of six
colours, not a free picker (§ 2b); alignment is left, centre, right without justify (§ 1); the
migration's re-run guard is the leading tag, not a ledger (§ 8 alternative 2).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No image is in `.ai/board/tickets/EVT-10/design/` (the folder does not exist) or cited by the idea
file. Nothing below is a behaviour beyond § 2.

**The editor (both forms).** In `EVT-01`'s slot, under the label *Description (optional)* in the
form's `LABEL` style. One rounded box (`rounded-[14px] bg-field`, the form's `FIELD` look) holding:

1. **The toolbar**, `event-description-toolbar`, one row that wraps on a phone, separated from the
   text by a `border-b border-line`. Icon buttons from `lucide-react`, 28 px square, `rounded-lg`,
   `text-ink-2`; pressed state `bg-card text-ink shadow-sm`. Groups, left to right, with a 1 px
   `bg-line` divider between groups:
   - **B** `Bold`, *I* `Italic`, U `Underline`, S `Strikethrough`
   - `Heading2`, `Heading3`
   - `List`, `ListOrdered`, `Quote`
   - `Link` — pressing it opens **the link row** directly under the toolbar: a `type="url"` field
     (`event-description-link-input`, placeholder *https://…*), **Apply**
     (`event-description-link-apply`) and, when the caret is on a link, **Remove link**
     (`event-description-link-remove`). Enter applies; Escape closes the row. No browser prompt.
   - `Palette` — opens a row of seven 20 px round swatches under the toolbar: **Default** (an
     outlined swatch, `event-description-color-default`) and six inks already in the theme, so the
     coloured text stays legible on `--color-card`: `ink` `#241f45`, `ink-2` `#5a5480`, `pto-ink`
     `#a0491a`, `wfh-ink` `#17694e`, `event-ink` `#6b230a`, `danger` `#be123c`
     (`event-description-color-ink` … `-danger`). Choosing one closes the row.
   - `AlignLeft`, `AlignCenter`, `AlignRight`
   Every button has an `aria-label` naming the format in English and a `title` with its shortcut
   where one exists.
2. **The text area**, `event-description-input`: the editable surface, `min-h-32`, `px-3.5 py-2.5`,
   `text-sm text-ink`, the same typography as the render below so what is typed is what is shown.
   Empty, it shows the placeholder *Tell people what to expect* in `text-ink-3`.

**The render (both surfaces).** In exactly the slot the plain paragraph held — the event's page and
the guest page keep `EVT-01`'s and `EVT-06`'s top-to-bottom order. A `div`, `text-sm text-ink`,
`break-words`, with spacing for its children: `p` `my-2`; `h2` `text-base font-extrabold mt-3 mb-1`;
`h3` `text-sm font-bold mt-3 mb-1`; `ul` `list-disc pl-5`, `ol` `list-decimal pl-5`; `blockquote`
`border-l-2 border-line pl-3 text-ink-2`; `a` `font-semibold text-ink underline`. First and last
children lose their outer margin. No card, no border — it reads as the page's body text, formatted.

English copy throughout (`.ai/standards/ui-design-system.md` § *Language*).

## 3. Permission model

**Nothing about who may do what changes.** Who may write a description is `EVT-01`'s column grant
(`grant update (… description …) on public.event to authenticated`,
`20260929120000_evt01_event.sql:335`) and its creator-or-admin update policy; who may read it is
`EVT-01`'s select policy and, for guests, `EVT-06`'s `get_guest_event(text)`. **Sanitising is not
authorization** (ADR-056, ADR-005): it decides what markup a reader's browser receives, never whether
they receive the row.

| Action | signed out | guest with link | `member` | `manager` | `admin` | Held by |
|---|---|---|---|---|---|---|
| Write a formatted description | ❌ | ❌ | ✅ own event | ✅ own event | ✅ any | `EVT-01` grant and policy, unchanged; the editor is an affordance |
| Read it, formatted | ❌ | ✅ if opened to guests | ✅ if in audience | ✅ if in audience | ✅ | `EVT-01` select policy; `EVT-06` `get_guest_event`, unchanged |
| Have stored markup outside the allow-list reach the reader's DOM | ❌ | ❌ | ❌ | ❌ | ❌ | `DescriptionHtml` (§ 4.2) — the render, in every reader's browser |
| Store markup outside the allow-list | ❌ | ❌ | ⚠️ yes, by calling the API directly | ⚠️ same | ⚠️ same | **Nothing prevents it, by decision** (ADR-056 decision 3, rationale *database-side sanitiser*). The form sanitises first as defence in depth; AC-8 is what makes the stored value harmless |
| Apply the conversion migration | ❌ | ❌ | ❌ | ❌ | ❌ | a human, RULE-09; runs as the table owner, which `alter table … disable trigger` needs |

**Where the check lives.** The only security control this ticket adds runs in the reader's browser,
inside `DescriptionHtml`, before the HTML reaches the DOM — which is the one place every reader's
copy passes, whoever wrote it and however. The form's sanitise is client-side and bypassable, and is
labelled an affordance in code.

**Denials the tests must assert:** AC-8 on both surfaces, including the anonymous one; AC-7's
`javascript:` link; AC-12's source scan.

## 4. Contract

**No seam function, no domain type, no `FailureCode`, no RPC and no grant changes.**
`SaveEventInput.description` and `CalEvent.description` / `GuestEventData.description` stay
`string | null`; they now carry HTML.

### 4.1 `src/components/DescriptionHtml.tsx` — the sanitiser and the render

```ts
import DOMPurify from "dompurify";
import type { JSX } from "react";

/** ADR-056 decision 2. THE allow-list — the one the render and the form's save both use. A tag not
 *  here is removed and its text kept (DOMPurify's default), except `script`, `style` and the like,
 *  whose contents DOMPurify drops. EVT-11 adds `img` with `data:` sources; nothing else joins
 *  without an ADR. */
export const DESCRIPTION_TAGS = [
  "p", "br", "strong", "em", "u", "s", "h2", "h3", "ul", "ol", "li", "blockquote", "a", "span",
] as const;

/** Attributes allowed, per tag. Anything not listed for a tag is removed from it. */
export const DESCRIPTION_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  a: ["href", "target", "rel"],
  p: ["style"],
  h2: ["style"],
  h3: ["style"],
  span: ["style"],
  ol: ["start"],
};

/** AC-7. Checked against `href` only. */
export const DESCRIPTION_HREF = /^(?:https?:|mailto:)/i;

/** The `style` declarations allowed, per tag, and the value each may take. A `style` is rebuilt
 *  from these alone, in the form Tiptap writes it — `text-align: center`, `color: #be123c` — so a
 *  description saved by the editor is unchanged by the sanitiser (AC-4). No declaration left: the
 *  attribute is removed. */
export const DESCRIPTION_STYLES: Readonly<Record<string, Readonly<Record<string, RegExp>>>> = {
  p: { "text-align": /^(?:left|center|right)$/ },
  h2: { "text-align": /^(?:left|center|right)$/ },
  h3: { "text-align": /^(?:left|center|right)$/ },
  span: { color: /^(?:#[0-9a-f]{6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i },
};

/** What every link carries after sanitising, whatever it carried before (AC-7). Tiptap's own
 *  defaults (`@tiptap/extension-link` 3.31.4, `addOptions().HTMLAttributes`), so AC-4 holds. */
export const LINK_TARGET = "_blank";
export const LINK_REL = "noopener noreferrer nofollow";

/** ADR-056 decisions 2 and 3. The one sanitiser. Pure string in, string out.
 *  - Builds its own DOMPurify instance on first call (`DOMPurify(window)`), so the hooks below
 *    never touch another caller's instance and importing this module under Vitest's `node`
 *    environment does not throw.
 *  - Config: `ALLOWED_TAGS: [...DESCRIPTION_TAGS]`, `ALLOWED_ATTR`: the union of
 *    DESCRIPTION_ATTRIBUTES' values, `ALLOWED_URI_REGEXP: DESCRIPTION_HREF`,
 *    `ALLOW_DATA_ATTR: false`, `ALLOW_ARIA_ATTR: false`.
 *  - Hook `uponSanitizeAttribute`: `keepAttr = false` for an attribute not in
 *    DESCRIPTION_ATTRIBUTES[tag]; for `style`, `attrValue` rebuilt per DESCRIPTION_STYLES[tag]
 *    (declarations joined with `; `), `keepAttr = false` if none survives.
 *  - Hook `afterSanitizeAttributes`: an `a` with no `href` left is replaced by its children; an `a`
 *    with one gets `target = LINK_TARGET` and `rel = LINK_REL`.
 *  - Fails closed: no `window`, or `isSupported` false → returns `""`, never the input. */
export function sanitizeDescription(html: string): string;

/** ADR-056 decision 2. THE render of a description — the only `dangerouslySetInnerHTML` under
 *  `src/` (AC-12). Draws nothing when `html` is null or sanitises to "". § 2b's classes. */
export function DescriptionHtml(props: { html: string | null; testId: string }): JSX.Element | null;
```

### 4.2 The two surfaces

`src/routes/EventDetail.tsx` — the `<p data-testid="event-description" className="whitespace-pre-wrap …">`
block becomes `<DescriptionHtml html={event.description} testId="event-description" />`.

`src/routes/GuestEvent.tsx` — the `<p data-testid="guest-event-description" …>` block becomes
`<DescriptionHtml html={event.description} testId="guest-event-description" />`.

Nothing else in either file changes.

### 4.3 `src/components/DescriptionEditor.tsx` — the editor

```ts
/** ADR-056 decision 1. The one editor, on the create and the edit form. Tiptap 3:
 *  `useEditor({ extensions, content: value, onUpdate })` and `<EditorContent />` from
 *  `@tiptap/react`. Extensions:
 *  - `StarterKit.configure({ heading: { levels: [2, 3] }, code: false, codeBlock: false,
 *     horizontalRule: false, link: { openOnClick: false, autolink: true, defaultProtocol: "https",
 *     isAllowedUri: (url) => DESCRIPTION_HREF.test(url) } })`
 *  - `TextStyle`, `Color` from `@tiptap/extension-text-style`
 *  - `TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] })`
 *    from `@tiptap/extension-text-align`
 *  `value` is read at mount only; the edit form mounts this after the event has loaded.
 *  The link row's Apply prepends `https://` to an address with no scheme (`!/^[a-z][a-z0-9+.-]*:/i`)
 *  and then calls `setLink` only if DESCRIPTION_HREF accepts the result (AC-7).
 *  `onChange` receives `""` when `editor.getText().trim() === ""` (AC-6), else `editor.getHTML()`.
 *  The editable element carries `data-testid="event-description-input"` and
 *  `aria-label="Description"` (via `editorProps.attributes`). */
export default function DescriptionEditor(props: {
  value: string;
  onChange: (html: string) => void;
}): JSX.Element;
```

`src/routes/EventEditor.tsx`:

- The `<textarea data-testid="event-description-input">` becomes
  `<DescriptionEditor value={values.description} onChange={(html) => set("description", html)} />`
  under the same label. `FormValues.description` stays `string` and now holds HTML.
- In `onSubmit`, `description: values.description` becomes
  `description: sanitizeDescription(values.description)` — commented as defence in depth, ADR-056
  decision 3. The seam's `blankToNull` turns `""` into `null`, as today.

### 4.4 Selectors

| Selector | Where | AC |
|---|---|---|
| `event-description-input` | the editable area (kept from `EVT-01`) | AC-1, AC-2, AC-5, AC-6 |
| `event-description-toolbar` | the toolbar | AC-1 |
| `event-description-bold` / `-italic` / `-underline` / `-strike` | toggles | AC-1, AC-2 |
| `event-description-h2` / `-h3` | toggles | AC-1, AC-2 |
| `event-description-bullet-list` / `-ordered-list` / `-blockquote` | toggles | AC-1, AC-2 |
| `event-description-link` | opens the link row | AC-7 |
| `event-description-link-input` / `-link-apply` / `-link-remove` | the link row | AC-7 |
| `event-description-color` | opens the swatches | AC-2 |
| `event-description-color-default` / `-ink` / `-ink-2` / `-pto-ink` / `-wfh-ink` / `-event-ink` / `-danger` | swatches | AC-2 |
| `event-description-align-left` / `-align-center` / `-align-right` | toggles | AC-1, AC-2 |
| `event-description` | event's page render (kept) | AC-2, AC-6, AC-7, AC-8 |
| `guest-event-description` | guest page render (kept) | AC-3, AC-6, AC-8 |

### 4.5 `src/main.tsx` — the test door to the mock seam

```ts
// EVT-10 AC-8, AC-9. The end-to-end suite must write a description STRAIGHT TO THE DATASTORE, as
// ADR-005 lets anyone do to the real API, without the form's sanitise. Only in a build pinned to
// the mock seam: `VITE_DATA_SEAM` is replaced at build time, so a real build drops this block.
declare global {
  interface Window {
    __calechipMockSeam?: DataSeam;
  }
}
if (import.meta.env.VITE_DATA_SEAM === "mock") window.__calechipMockSeam = seam;
```

`seam` and `DataSeam` imported from `@/lib/data` (RULE-02: through the seam's own entry).

### 4.6 `supabase/migrations/20261012230000_evt10_description_html.sql`

Header in the shape of `EVT-06`'s and `EVT-08`'s: human-applied (RULE-09), **not verified against a
running PostgreSQL**, decided by ADR-056 decision 7, idempotent by AC-10's guard, one transaction,
`supabase/db.sql` not updated (MD-033). Body, to be transcribed:

```sql
begin;

-- AC-11. A format conversion is not an edit: no `updated_at`, no notification, no email.
-- Disabled by name inside this transaction and re-enabled before it commits; the table lock that
-- `alter table` takes keeps every other write out until then.
alter table public.event disable trigger event_stamp;
alter table public.event disable trigger notify_event_updated;

-- AC-10. Blank is no description, as EVT-01 AC-2 stores one.
update public.event
   set description = null
 where description is not null
   and btrim(description, E' \t\r\n') = '';

-- AC-10. Escape `&` first, then `<` and `>` — the three a text node needs, and the three Tiptap
-- writes, so a converted description re-saved unchanged stays unchanged. Runs separated by blank
-- lines are paragraphs; a single break inside one is <br>.
update public.event e
   set description = (
     select string_agg('<p>' || replace(t.para, E'\n', '<br>') || '</p>', '' order by t.n)
       from regexp_split_to_table(
              btrim(
                replace(replace(replace(
                  replace(replace(e.description, E'\r\n', E'\n'), E'\r', E'\n'),
                  '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
                E'\n'),
              E'\n[ \t]*\n[ \t\n]*'
            ) with ordinality as t(para, n)
   )
 where e.description is not null
   and e.description !~ '^\s*<(p|h2|h3|ul|ol|blockquote)[ >]';

alter table public.event enable trigger notify_event_updated;
alter table public.event enable trigger event_stamp;

commit;
```

**Human step, owed at `/ship`:** apply this migration **before** deploying the build that carries
the editor, so no plain description is ever rendered as HTML. Either order is safe — the render
sanitises plain text too — but the other order shows old line breaks collapsed until it is applied.

### 4.7 Dependencies

`package.json` `dependencies` gains, at the majors in § 1 and through `pnpm add` so the lockfile
resolves them: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-text-style`,
`@tiptap/extension-text-align`, `dompurify`. Nothing else, and no devDependency — the sanitiser's
behaviour is tested in a real browser (§ 4.8), not under a DOM emulator.

### 4.8 Tests

`tests/description-html.test.ts` (Vitest, `node` — no DOM, so it reads data and files):

- the four exported policy constants equal § 4.1's values, exactly; no `img`, `h1`, `script`,
  `style`, `iframe` in `DESCRIPTION_TAGS`
- `sanitizeDescription` returns `""` with no `window` (fails closed)
- AC-12: a scan of `src/**/*.{ts,tsx}` — `dangerouslySetInnerHTML` only in
  `src/components/DescriptionHtml.tsx`; `from "dompurify"` only there; `from "@tiptap/` only in
  `src/components/DescriptionEditor.tsx`; `EventDetail.tsx` and `GuestEvent.tsx` each render
  `<DescriptionHtml` with their test id and no longer contain `whitespace-pre-wrap` beside a
  description
- AC-10, AC-11: the migration file read as text — `begin;`/`commit;`; both `disable trigger` lines
  before the first `update` and both `enable trigger` lines after the last; no `updated_at` in it;
  `'&', '&amp;'` replaced before `'<'` and `'>'`; the guard regex present

`tests/e2e/evt-10-description.spec.ts` (Playwright, mock seam): AC-1–AC-9, with AC-8 and AC-9
writing the hostile description through `window.__calechipMockSeam.updateEvent` (the caller signed
in as the creator), moving between pages client-side as `evt-06-guest-link.spec.ts` does, listening
on `page.on("request")` for `example.com`.

## 5. Seam impact

None. No function in `src/lib/data/` is added, removed or changed, and seam parity is untouched.
`main.tsx` reads `seam` from the seam's public entry as every route does; it adds nothing to the
seam's surface.

## 6. Schema delta

**A data migration, with no RPC or grant change** — agrees with `ticket.yaml`. It touches two
triggers (disabled and re-enabled inside its own transaction) and rewrites one column's values; it
creates, drops or alters no table, column, policy, function, constraint or grant. Not `none`
(ADR-014: it touches triggers). Covered by ADR-056 decision 7 (`ACCEPTED by the operator`); applying
it is human (RULE-09). § 4.6 holds the SQL.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/glossary.md"
  - "package.json"
  - "pnpm-lock.yaml"
  - "supabase/migrations/20261012230000_evt10_description_html.sql"
  - "src/main.tsx"
  - "src/components/DescriptionHtml.tsx"
  - "src/components/DescriptionEditor.tsx"
  - "src/routes/EventEditor.tsx"
  - "src/routes/EventDetail.tsx"
  - "src/routes/GuestEvent.tsx"
  - "tests/description-html.test.ts"
  - "tests/e2e/evt-10-description.spec.ts"
```

**Glossary:** *Sanitised description* — row written at this stage (ADR-047).

**Every surface, searched.** `grep -rn description src` finds the field rendered in
`EventDetail.tsx:287-290` and `GuestEvent.tsx:206-209` and nowhere else; the seam carries it
(`supabase.ts:138`, `:378`; `mock.ts`), the form edits it, and no list, grid, chip, notification or
email renders it. Both renders are on this list; nothing else needs to be.

**Deliberately absent:** `src/lib/data/**` and `src/lib/domain/types.ts` (no seam or type change —
if one is needed, the contract is wrong and the Developer stops); `src/index.css` (§ 2b's render
styles are Tailwind classes on the component); `eslint.config.js` (§ 8 alternative 4);
`tests/e2e/evt-01-events.spec.ts`, `tests/e2e/evt-06-guest-link.spec.ts` and every existing unit
test (AC-5: they must pass untouched); `supabase/functions/**` (Q7-A); the three standards pages
(§ 1).

**`size: M`** — twelve paths. Agrees with `size_estimate: M`.

## 8. Rejected alternatives

**1. Sanitise in the database — a trigger that strips the description before it is stored.** Every
reader would receive a clean value whatever the client did, and the render could trust the row.
Rejected by ADR-056 already (*Rejected, technically*), and nothing found in the source changes the
reason: it would be the only HTML parser in PostgreSQL here, a second allow-list to keep identical to
DOMPurify's, and still not the layer that protects the reader — a sanitiser bug would be fixed in two
places, one of them a migration a human must apply.

**2. Record the conversion in a ledger table instead of guarding on the leading tag.** Exact
idempotence: a row is converted once, never by guess. Rejected: a new table for a one-off migration,
which makes `schema_delta` a schema change and the ticket heavier, to protect against a plain-text
description that happens to begin with `<p>` or `<h2>` — which, if it exists, is rendered sanitised
and safe anyway, only not escaped.

**3. Convert old text with `white-space: pre-wrap` preserved — `<p style="white-space: pre-wrap">`.**
Keeps every run of spaces exactly. Rejected: `white-space` would join the allow-list for every
description, Tiptap would drop it on the first edit anyway (it has no extension for it), and AC-4's
"re-saved unchanged stays unchanged" would fail for every converted description the first time its
creator opened the form.

**4. An ESLint rule for the boundaries instead of a source-scanning test.** `no-restricted-imports`
for `dompurify` and `@tiptap/*`, `no-restricted-syntax` for `dangerouslySetInnerHTML`, enforced by
`pnpm lint`. Rejected for now: flat config does not merge a rule across blocks — a second
`no-restricted-imports` block for `src/**` would silently replace RULE-02's
(`eslint.config.js:60-79`), and the § Language block already owns `no-restricted-syntax` with its own
`ignores`. Done correctly it means restructuring the file that carries RULE-02, which is not this
ticket's to risk. The unit test asserts the same three facts and fails `pnpm test` instead.

**5. A DOM emulator (`jsdom` or `happy-dom`) so Vitest can run the sanitiser.** Faster than a
browser and closer to the function. Rejected: a third dependency ADR-056 does not cover (R9), and
DOMPurify's behaviour in an emulator is not its behaviour in Chromium — the guest page runs in a real
browser, so that is where AC-8 is asserted.

## Changelog

- 2026-10-12T23:26:45+0700 — created. Sections 1 and 2 were drafted from the feature row, the idea,
  and ADR-056 before the source was read. On reading the source: AC-5 was added — existing specs
  `.fill()` `event-description-input` and assert `toHaveText`, so keeping the selector on the
  editable area keeps them passing untouched; AC-10's escaping was narrowed from five characters
  (`& < > " '`) to three, because Tiptap serialises text with only those three escaped and the wider
  set would make every converted description with a quote change on its first unchanged re-save
  (AC-4), notifying its participants; AC-11 gained its last clause after reading `event_stamp` and
  `notify_event_updated` (`evt01_event.sql:99-116`, `evt04_notification.sql:181-212`); AC-8 and AC-9
  were made observable by § 4.5's door after finding Vitest runs in `node` with no DOM
  (`vite.config.ts` `environment: "node"`). No AC was loosened. Raised by `tech-lead-design`. Amended
  by `tech-lead-design`.

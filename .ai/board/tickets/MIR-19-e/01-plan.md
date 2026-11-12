---
ticket: MIR-19-e
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-12T02:39:03Z
inputs_read:
  - .ai/board/tickets/MIR-19-e/ticket.yaml
  - .ai/board/tickets/MIR-19-d/01-plan.md
  - .ai/board/tickets/MIR-19/01-plan.md (§ 1 out of scope)
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-097-an-org-address-is-served-beside-the-root-one-first-and-the-flip-is-mir-19-b.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-051-a-server-side-component-sends-event-email-and-authorizes-nothing.md
  - .ai/registry/decisions/ADR-067-the-runner-pushes-merges-and-decides-blocked-questions-on-its-own.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md (Phase 5, 261-283)
  - .ai/templates/plan.md
  - .ai/01-operating-model.md (Definition of Ready item 4)
  - supabase/functions/send-event-email/template.ts
  - supabase/functions/send-event-email/index.ts
  - supabase/migrations/20261009090000_evt05_event_email.sql (email_notification, grants)
  - supabase/migrations/20261014090000_evt12_invite_every_scope.sql (email_invitation, grants)
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql (member_org_id)
  - supabase/migrations/20261111150000_mir19_own_org_code.sql
  - supabase/tests/370-own-org-code.test.sql, supabase/tests/010-catalogue.test.sql (grep)
  - src/lib/org-path.ts
  - src/lib/data/system.ts (SystemSeam, MOCK_RESERVED_ORG_CODES, createOrg, systemSeamName)
  - src/lib/data/mock.ts (emailNotification, emailInvitation, outboxes)
  - docker/nginx.conf
  - tests/event-email.test.ts, tests/event-invitation.test.ts (parse round-trips, migration reads)
  - tests/org-path.test.ts
  - tests/e2e/mir-18-b-org-management.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-19-e — Email links carry the org, nginx drops `$uri/`, the panel's mock reserved list gains `tasks`

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:308`):

| ID | Feature | Group |
|---|---|---|
| MIR-19 | Every authenticated page is served under `/{org_code}` | MIR |

**Plan item:** Phase 5, *Org-scoped routing* (`.ai/board/plans/calechip-multi-tenancy-plan.md:261-283`),
ADR-097 decision 5, items 3, 4 and 5, split off at `/plan MIR-19-d` (its § 1). Three checklist lines of
Phase 5 that MIR-19 to MIR-19-d left open: *"Email template links carry no org"*, *"nginx: `try_files
$uri $uri/` collides with `fonts/`, `images/`"*, and the exit criterion *"No reserved word can be
registered as an `org_code`"* as far as the system panel's offline mock is concerned.

**Who gains what.** A **member** who opens an event email — announced, invited by name, invited by
address, a join request approved, declined or removed — lands directly on the event under their own
org (`/shared/events/<id>` for every member of Org public), and the email's *Profile* link opens their
profile there too. Since MIR-19-d an org-less link reaches the same page by one client-side hop; after
this ticket the address in the mail is the address the member works at. A **guest** gets exactly the
mail they get today: a token-only link, no org (ADR-097 decision 6). The **operator** gets an nginx
fallback that never answers a path with a directory redirect, and a **system admin** using the panel's
offline mock is refused `tasks` as an org code exactly as the database refuses it.

**Out of scope:**

- The logo URL and the *CaleChip* link in the email footer. They stay `APP_URL`-rooted: they appear in
  the guest mail as well, and `/` sends a member to their org (MIR-19-d). ADR-098 decision 5.
- Guest links under an org. ADR-097 decision 6; the guest invitation is unchanged.
- The mock seam's email outboxes (`src/lib/data/mock.ts`, `MockEventEmail`, `MockInvitationEmail`).
  They record who is mailed, not the body (no name, no event title today), so they gain no `orgCode`.
- Which members are mailed, and when. Every recipient rule of EVT-05, EVT-08 and EVT-12 is unchanged;
  the migration adds a key to the body and nothing to any `where`.
- An HTTP redirect from an org-less path at nginx. The flip stays client-side (MIR-19-d).
- Any other nginx `location` block (`/assets/`, `/healthz`, `/version.json`, `/index.html`,
  `/system.html`, the panel include). Only `location /` changes.
- The member app's reserved list (`src/lib/org-path.ts`) and the constraint. Both already carry
  `tasks` (MIR-19).
- The real system seam's `createOrg` (`supabaseSystemSeam`). The constraint is the control and already
  refuses `tasks`.
- A sign-up at `/{org_code}/signup` landing in that org. → **MIR-19-f.**
- Applying the migration to the hosted project and redeploying the function. Human, RULE-09 (§ 6).
- The `features.md` row. It stays `PLANNED` until MIR-19-f ships.

`size_estimate`: **M**.

## 2. Acceptance criteria

Terms. `APP` is `https://calechip.example`. **Event request:** a body `parseEventEmailRequest`
accepts (EVT-05 § 4.3). **Invitation request:** a body `parseInvitationEmailRequest` accepts (EVT-08
§ 4.3). The event id in examples is `ec000000-0000-4000-8000-000000000001`. "Both bodies" means the
rendered `html` and `text`.

**AC-1: a member's event email links into their org**
- Given an event request with `orgCode: "shared"`, for each of the five kinds
- When `renderEventEmail(request, APP)` runs
- Then both bodies contain `https://calechip.example/shared/events/ec000000-0000-4000-8000-000000000001`
  and `https://calechip.example/shared/profile`, and neither contains
  `https://calechip.example/events/` or `https://calechip.example/profile`.
- And the logo `https://calechip.example/logo.png?v=2` and the footer's product link
  `https://calechip.example` (as the `href` of the *CaleChip* footer link and the text line
  `CaleChip: https://calechip.example`) are unchanged.

**AC-2: a request without an org code renders exactly what it rendered before**
- Given an event request with no `orgCode` key, and the same request with `orgCode: null`
- When each is rendered
- Then both renderings are equal to each other in `subject`, `html` and `text`, and contain
  `https://calechip.example/events/ec000000-0000-4000-8000-000000000001` and
  `https://calechip.example/profile`.
- And `tests/event-email.test.ts` and `tests/event-invitation.test.ts` pass with no line of either
  changed.

**AC-3: the parser accepts an org code in the database's shape, and nothing else**
- Given an otherwise valid event request
- When `parseEventEmailRequest` reads it
- Then with no `orgCode` key the result has no `orgCode` key; with `orgCode: null` the result has
  `orgCode: null`; with `orgCode: "shared"` and `orgCode: "a1-b2"` the result carries that string.
- And it returns `null` (the sender answers 400) for `orgCode` equal to each of: `123`, `""`,
  `"Shared"`, `"-ab"`, `"ab-"`, `"a".repeat(33)`, `"shared/x"`, `"../x"`, `"shared x"`, `true`, `{}`.

**AC-4: a member's invitation by address links into their org**
- Given an invitation request of kind `invitation_member` with `orgCode: "shared"`
- When `renderInvitationEmail(request, APP)` runs
- Then the result equals `renderEventEmail` of the `event_invited` request built from it (as EVT-08
  AC-8 defines) with `orgCode: "shared"`, and both bodies contain
  `https://calechip.example/shared/events/<id>` and `https://calechip.example/shared/profile`.
- And `parseInvitationEmailRequest` accepts `invitation_member` with `orgCode` absent, `null`, or a
  shaped string, and refuses any value AC-3 refuses.

**AC-5: a guest's invitation carries no org**
- Given an invitation request of kind `invitation_guest`
- When `parseInvitationEmailRequest` reads it
- Then it is accepted with `orgCode` absent or `null`, and refused (`null`) with `orgCode: "shared"`.
- And `renderInvitationEmail` of an accepted guest request has its button at
  `https://calechip.example/guest/<64 hex>`, and neither body contains `/shared/`.

**AC-6: the database puts the recipient's own org code in each request, and changes nothing else**
- Given `supabase/migrations/20261112090000_mir19e_email_org_code.sql`
- When it is read
- Then it is one transaction (`begin;` … `commit;`) that re-creates `public.email_notification()` and
  `public.email_invitation()` and nothing else: it contains no `create trigger`, `drop trigger`,
  `create policy`, `alter policy`, `drop policy`, `alter table`, `create table`, `grant select`,
  `grant insert`, `grant update` or `grant delete`.
- And `email_notification()`'s body includes `'orgCode', o.org_code` and joins
  `public.org o on o.id = public.member_org_id(r.id)` with a `left join`.
- And `email_invitation()`'s member branch includes `'orgCode'` read from
  `public.member_org_id(v_member_id)`, and its guest branch includes `'orgCode', null::text`.
- And each function's body, with `--` comments removed, every line containing `org` removed and
  whitespace collapsed, equals the same treatment of its previous definition
  (`20261009090000_evt05_event_email.sql` for `email_notification`,
  `20261014090000_evt12_invite_every_scope.sql` for `email_invitation`).
- And the file ends with exactly these four grant lines, before `commit;`:
  `revoke all on function public.email_notification() from public, anon;`,
  `grant execute on function public.email_notification() to authenticated;`,
  `revoke all on function public.email_invitation() from public, anon;`,
  `grant execute on function public.email_invitation() to authenticated;`.

**AC-7: nginx's SPA fallback never tries a directory**
- Given `docker/nginx.conf`
- When it is read
- Then the `location / {` block's only directive is `try_files $uri /index.html;`, and the string
  `$uri/` appears nowhere in the file.
- And the `location /assets/` block still reads `try_files $uri =404;`, and the `location = /healthz`,
  `location = /version.json`, `location = /index.html`, `location = /system.html` blocks and the
  `include /tmp/nginx/system-panel.conf;` line are present unchanged.

**AC-8: the panel's mock refuses `tasks` as an org code**
- Given the system panel on the mock build, signed in as `ops@calechip.test` with password
  `calechip-demo` and code `246810`, with the org list shown (`system-orgs`)
- When `system-org-new` is clicked, `system-org-create-code` is filled with `tasks`,
  `system-org-create-name` with `Tasks Org`, and `system-org-create-submit` is clicked
- Then `system-org-create-error` is visible, `system-org-create-form` is still visible, and no
  `system-org-row` with `data-org-code="tasks"` exists; after `system-org-create-cancel` there are
  exactly 2 `system-org-row` elements.

**AC-9: the panel's mock list is the database's list**
- Given `src/lib/data/system.ts`
- When the quoted tokens of its `MOCK_RESERVED_ORG_CODES` array are read in order
- Then they equal `RESERVED_ORG_CODES` from `src/lib/org-path.ts` in order — 51 tokens, the last
  `"tasks"` (`tests/org-path.test.ts` already holds that list equal to the constraint).

**AC-10: everything else passes**
- Given this ticket's commit
- When `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm exec playwright test` run
- Then all pass, and no spec or test file outside § 7 is in the diff.

**Invariants touched:** `[]`. INV-01 to INV-07 are all properties of entries, their portions, their
approval state and the absence count. This ticket changes the body of an email request, one nginx
directive and one mock array; none reads or writes an entry, and the migration adds no condition that
decides which notification or invitation exists.

**Open questions:** none. Where the org code is read from was the one question the ticket left to
PLAN; ADR-098 answers it.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(There is no layout change in this ticket: the email's layout is SOLO 2026-10-09's and only two URLs
inside it change; the panel's create form is MIR-18-b's and is not edited.)

## 3. Permission model

No role gate is added, removed or moved. Per action:

| Action | Who | Where it is enforced | Change |
|---|---|---|---|
| A request is posted to the sender | The database only: the two trigger functions, `security definer`, fired by inserts the existing RLS and RPCs already permit | `email_notification()` / `email_invitation()`; the shared secret in `x-event-email-secret` (ADR-051 decision 3) | None. Grants restated as they stand (AC-6) |
| Which org code goes in a request | Nobody chooses it. It is `member_org_id(recipient)` — the recipient's own approved org, null for anyone not approved or removed | The trigger function, server side | New key, no new decision |
| Following a member link `/{org}/events/<id>` | The member it was sent to | MIR-19's router: own org serves, any other org shows `org-not-found` and mounts no screen (ADR-097 decision 4); RLS on every read behind it | None |
| Creating an org with code `tasks` | Nobody | `org_code_not_reserved` on `public.org` (the control); the panel mock mirrors it (an affordance, AC-8) | Mock only |
| Requesting any path from nginx | Anyone | nginx serves files or `index.html`; it authorizes nothing | Fallback only |

**Denials:**

- A **member** never receives another org's code: the value is computed from the recipient's own
  member row, never from a request parameter, and `member_org_id` returns only that member's org.
- A **guest** is never told an org code: the guest branch writes `null`, and the parser refuses a
  guest request carrying one (AC-5).
- The **sender** still reads nothing and authorizes nothing (ADR-051 decision 2): it gains no
  credential and no query.
- Nothing in the browser can call either trigger function: both return `trigger` and cannot be
  invoked through PostgREST, as EVT-05 § 5 records.
- No role can create an org named `tasks`, through the database or the panel mock.

## 4. Contract

### 4.1 `supabase/migrations/20261112090000_mir19e_email_org_code.sql`

Header comment: MIR-19-e, ADR-098; *"Two trigger functions replaced in place, nothing else"*;
idempotent (`create or replace`, ADR-024); one transaction; applying it is human (RULE-09).

Structure, in this order:

```sql
begin;

-- 1. email_notification(): 20261009090000_evt05_event_email.sql's body, copied verbatim, plus the
--    two lines marked below.
create or replace function public.email_notification() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
  -- … the EVT-05 body, unchanged, except in the `select jsonb_build_object(` … `into v_body` statement:
             'actorName',      a.display_name,
             'orgCode',        o.org_code,                                   -- ADDED, ADR-098 decision 1
             'event', jsonb_build_object(
  -- … and in its `from` list, after `join public.member a on a.id = new.actor_id`:
      left join public.org o on o.id = public.member_org_id(r.id)            -- ADDED
  -- … the rest of the EVT-05 body, unchanged.
$$;

-- 2. email_invitation(): 20261014090000_evt12_invite_every_scope.sql's body, copied verbatim, plus
--    the two lines marked below.
create or replace function public.email_invitation() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
  -- … the EVT-12 body, unchanged, except: in the member branch's jsonb_build_object, after
  --   'recipientName', v_member_name,
                  'orgCode',       (select o.org_code from public.org o where o.id = public.member_org_id(v_member_id)),   -- ADDED
  -- … and in the guest branch's jsonb_build_object, after 'recipientName', null::text,
                  'orgCode',       null::text,                                -- ADDED, ADR-097 decision 6
  -- … the rest of the EVT-12 body, unchanged.
$$;

-- 3. Grants, restated exactly as EVT-05 and EVT-12 wrote them.
revoke all on function public.email_notification() from public, anon;
grant execute on function public.email_notification() to authenticated;
revoke all on function public.email_invitation() from public, anon;
grant execute on function public.email_invitation() to authenticated;

commit;
```

Constraints on the Developer, because AC-6 tests them:

- **Every added line contains the substring `org`, and no other line of either body does.** Each
  `ADDED` line above is one physical line. The `-- ADDED` markers are explanatory here; in the file,
  a comment on an added line is optional, and any comment inside a body is removed before the
  comparison.
- The `left join` keeps a recipient whose `member_org_id` is null (removed between notify and mail)
  mailed with `orgCode: null` — a root link — rather than dropping the mail. Recipient rules are not
  changed (§ 1 Out of scope).
- No `drop function`: the signatures are unchanged, so the triggers keep pointing at the same
  functions.

### 4.2 `supabase/functions/send-event-email/template.ts`

The file still **imports nothing**. Additions and changes, exact:

```ts
/** MIR-19-e, ADR-098. `org_code_shape` (20261027120000_mir11_composite_foreign_keys.sql:44-47),
 *  restated: this file imports nothing. The constraint is the control; this only refuses a malformed
 *  request. */
const ORG_CODE_SHAPE = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;

export interface EventEmailRequest {
  notificationId: string;
  kind: EventEmailKind;
  to: string;
  recipientName: string;
  actorName: string;
  /** MIR-19-e, ADR-098. The recipient's own org code, or null. Absent from a request the database
   *  posted before 20261112090000_mir19e_email_org_code.sql; absent and null render root links. */
  orgCode?: string | null;
  event: {
    id: string;
    name: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    location: string | null;
  };
}

export interface InvitationEmailRequest {
  invitationId: string;
  kind: InvitationEmailKind;
  to: string;
  inviterName: string;
  recipientName: string | null;
  event: EventEmailRequest["event"];
  guestToken: string | null;
  /** MIR-19-e, ADR-098. As EventEmailRequest.orgCode for `invitation_member`; absent or null for
   *  `invitation_guest` (ADR-097 decision 6). */
  orgCode?: string | null;
}

/** MIR-19-e. The input's `orgCode`: `undefined` when the key is absent, `null` when null, the string
 *  when it matches ORG_CODE_SHAPE; `false` for anything else, which refuses the request. */
function readOrgCode(input: Record<string, unknown>): string | null | undefined | false;

/** MIR-19-e. `${appUrl}/${orgCode}` for a string, `appUrl` for null or undefined. */
function memberBase(appUrl: string, orgCode: string | null | undefined): string;
```

Behaviour:

- `parseEventEmailRequest(input)`: every existing rule unchanged; then `const orgCode =
  readOrgCode(input)`; `false` → `return null`. The returned object carries the key `orgCode` **only
  when the input had it** (`...(orgCode !== undefined ? { orgCode } : {})`), so a request without
  the key round-trips with `toEqual` exactly as today.
- `parseInvitationEmailRequest(input)`: as above; additionally, for `invitation_guest`, an `orgCode`
  that is a string returns `null`. Same conditional spread on the result.
- `renderEventEmail(request, appUrl)`: `const base = memberBase(appUrl, request.orgCode);` then
  `profileUrl = \`${base}/profile\`` and `buttonUrl: \`${base}/events/${encodeURIComponent(event.id)}\``.
  `renderLayout` and its `appUrl` argument (logo, product link) are unchanged.
- `renderInvitationEmail(request, appUrl)`: the `invitation_member` branch passes
  `orgCode: request.orgCode` into the `EventEmailRequest` it builds. The guest branch is unchanged.
- The file header gains one paragraph citing MIR-19-e and ADR-098. `index.ts` is not edited: it
  already passes the parsed request through.

### 4.3 `docker/nginx.conf`

```nginx
    # SPA fallback: every unknown path is a client-side route (`BrowserRouter`). No `$uri/`: a path
    # naming a directory (`/fonts`, `/images`) is a route too, never a 301 (MIR-19-e, ADR-097 5.4).
    location / {
      try_files $uri /index.html;
    }
```

Nothing else in the file changes. (The comment may be worded differently, but must not contain the
literal `$uri/` — AC-7 searches the whole file. Write it as "`$uri` with a trailing slash" if the
mention is kept.)

### 4.4 `src/lib/data/system.ts`

`MOCK_RESERVED_ORG_CODES` gains `"tasks"` as its last element, on its own line after
`"team", "www",`. The comment above it becomes:

```ts
// Copied from `org_code_not_reserved` as of `20261111150000_mir19_own_org_code.sql` (51 tokens,
// `tasks` last). `tests/system-reserved-org-codes.test.ts` holds it equal to src/lib/org-path.ts.
```

No other line of the file changes. `createOrg`'s check is unchanged and now refuses `tasks` with
`org_code_invalid`.

### 4.5 Tests

| File | Kind | Covers | Shape |
|---|---|---|---|
| `tests/email-org-links.test.ts` | Vitest, new | AC-1 to AC-6 | Imports `parseEventEmailRequest`, `parseInvitationEmailRequest`, `renderEventEmail`, `renderInvitationEmail` and the two request types from `../supabase/functions/send-event-email/template.ts` (as `tests/event-email.test.ts` does). AC-6 reads the new migration and the two previous ones with `readFileSync`, extracts each body with the same regex `tests/event-email.test.ts:57` uses, and normalises: `--…$` removed, lines matching `/org/` removed, `\s+` → one space |
| `tests/nginx-spa-fallback.test.ts` | Vitest, new | AC-7 | Reads `docker/nginx.conf`; extracts the `location / {` … `}` block |
| `tests/system-reserved-org-codes.test.ts` | Vitest, new | AC-9 | Reads `src/lib/data/system.ts` as text (it is **not** imported: the module chooses its seam from the environment); extracts the array after `const MOCK_RESERVED_ORG_CODES: readonly string[] = [` up to `];`, quoted tokens in order; compares with `RESERVED_ORG_CODES` from `@/lib/org-path` |
| `tests/e2e/mir-19-e-reserved-tasks.spec.ts` | Playwright, new | AC-8 | Signs in to `/system.html` as `tests/e2e/mir-18-b-org-management.spec.ts:16-24` does (copied, not imported); every locator a `data-testid` named in AC-8 |

Test names start with the AC ID (`"AC-3: …"`), as the MIR-19 files do.

## 5. Seam impact

**None.** No function is added to, removed from or re-signed on `DataSeam` or `SystemSeam`;
`tests/seam-parity.test.ts` is untouched. `src/lib/data/system.ts` changes one array inside the mock
implementation. The mock member seam (`src/lib/data/mock.ts`) is not edited (§ 1 Out of scope). The
email sender is not a seam: nothing in `src/` imports it (`tests/event-email.test.ts:585-595`).

## 6. Schema delta

**`20261112090000_mir19e_email_org_code.sql`** — re-creates the trigger functions
`public.email_notification()` and `public.email_invitation()` so each request carries `orgCode`.
No table, column, index, constraint, policy, trigger or grant changes; the four grant lines are
restated as they stand. **ADR-098**, written at this PLAN (*Delegated decisions* below). Under ADR-014
this is not `none`: it re-creates functions that triggers run. Recorded in `ticket.yaml` as
`schema_delta` with `requires_adr: true`.

**Human steps after merge (RULE-09), either order** — ADR-098 decision 4 makes both safe:

1. Apply the migration to the hosted project.
2. Redeploy `send-event-email` (`supabase functions deploy send-event-email --no-verify-jwt`, as
   EVT-05 shipped it).

`TODO(verify)`: one real `event_invited` mail after both steps, with its button opening
`/shared/events/<id>`. And one request to the running container for `/fonts` and `/fonts/`, each
answering `200` with `index.html` rather than `301`/`403`. Neither is runnable from the test suites:
no suite drives pg_net or the nginx image.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-098-an-email-to-a-member-carries-their-org-code-in-the-request-the-database-posts.md"
  - "supabase/migrations/20261112090000_mir19e_email_org_code.sql"
  - "supabase/functions/send-event-email/template.ts"
  - "docker/nginx.conf"
  - "src/lib/data/system.ts"
  - "tests/email-org-links.test.ts"
  - "tests/nginx-spa-fallback.test.ts"
  - "tests/system-reserved-org-codes.test.ts"
  - "tests/e2e/mir-19-e-reserved-tasks.spec.ts"
```

Nine paths, one of them the ADR written at this PLAN; eight for the Developer. **`size`: M.**
`size_estimate` (§ 1) is also M, and MIR-19-d's prediction was M: they agree. The count is higher
than *"three small edits"* suggested because item 3 needs a migration and an ADR, which MIR-19-d's
prediction did not foresee.

`glossary_owed` is `[]`: no glossary row is written, and `.ai/registry/glossary.md` is not listed.

## 8. Rejected alternatives

1. **The sender reads the org code from the database.** One `select` with a service-role key in
   `index.ts`, no migration. Rejected: it hands the one server-side component a database credential
   ADR-053 kept out of it, to fetch a value the trigger holds one join away. ADR-098 *Options*.
2. **The event's org code instead of the recipient's** (`event.org_id` → `org.org_code`). Equally
   cheap. Rejected: the link is for the reader, and the router serves the reader's own org only;
   where the two codes could differ, the event's is the one that shows `org-not-found`. ADR-098
   decision 2.
3. **Require `orgCode` in the parser.** Cleaner contract. Rejected: deployed before the migration, the
   function would refuse every request with 400 and ADR-053 decision 6 drops it unretried — a window
   with no event email at all, at the mercy of deploy order.
4. **Move every link in the mail, logo and product link included.** Rejected: those two are shared
   with the guest mail, which must not carry an org, and they are not member pages; splitting
   `renderLayout`'s `appUrl` in two for them buys nothing the flip does not already give.
5. **Item 5 by editing `tests/e2e/mir-18-b-org-management.spec.ts` AC-11** (one more `fill("tasks")`).
   One file fewer. Rejected: it changes another ticket's spec under its AC title; a separate spec
   keeps MIR-18-b's file as it shipped and names this ticket's criterion.

## Delegated decisions

- ADR-098 — where the email's org code comes from: the recipient's `member_org_id`, put in the
  request by the two trigger functions; absent or null renders root links. Written under ADR-008 and
  ADR-067; it reverses nothing.

## Changelog

- `2026-11-12T02:39:03Z` — all sections written. `schema_delta` set and `requires_adr: true` (the
  ticket created it as `none` pending this check against ADR-014). Raised by `tech-lead-design`.
  Amended by `tech-lead-design`.

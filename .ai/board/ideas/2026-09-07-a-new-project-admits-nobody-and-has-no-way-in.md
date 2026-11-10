---
stage: TRIAGE
agent: product
produced_at: 2026-09-07
inputs_read:
  - CLAUDE.md
  - .claude/commands/triage.md
  - .ai/templates/idea.md
  - .ai/steward/context.md
  - .ai/01-operating-model.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-024-the-seed-is-human-applied-and-converge-only.md
  - .ai/standards/ui-design-system.md
  - .ai/board/ideas/2026-08-31-nobody-can-join-the-board.md
  - .ai/board/tickets/TEA-01/02-design.md
  - .ai/board/tickets/UIE-02/design/README.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/seed.sql
  # Added at the verdict half, second dispatch of the same /triage run.
  - .ai/board/backlog.md
  - .ai/templates/ticket.yaml
  - .ai/board/tickets/OPS-002/ticket.yaml
  - .ai/standards/data-model.md
  - tech-lead-design's technical half of this triage (scratchpad, uncommitted)
consulted: [tech-lead-design]
gate: PASS
blocking_reason: ""
next_state: BACKLOG
---

# A new project admits nobody, and there is no way in through the interface

**No verdict is recorded in this file yet.** This is the problem half of `/triage`, written before the
verdict per `.claude/commands/triage.md:23-26`. The TRIAGE gate is not satisfied until a verdict of
REJECT, NEEDS-ADR or PROMOTE with a reason is appended below. Nothing here allocates a feature ID,
and this idea has none.

**SUPERSEDED LATER THE SAME DAY, and left standing rather than rewritten** — the paragraph above was
true when the problem half was written and stopped being true at the second dispatch of this same
`/triage` run. **The verdict is `NEEDS-ADR`** and it is at *Triage verdict* below, followed by a
*Re-triage verdict* covering the half of it that is unblocked. The sentence *this idea has none* still
holds: **no feature ID was allocated anywhere by this file**, and the re-triage deliberately creates a
chore ticket with no feature row. Everything above this line is the problem as stated before either
verdict was reached, and is not amended to agree with them.

**Written with no `Bash` tool.** Every claim below is a file read, cited as `path:line`. Nothing was
measured against a running database, and nothing here asserts the state of the hosted project.

---

## Provenance, and one correction to how this arrived

The operator described this as *"Appendix A trong `.ai/board/tickets/TEA-01/02-design.md`"*. **It is
not Appendix A.** That appendix is titled *"Provision a disposable Supabase database that tests can
run against"* (`.ai/board/tickets/TEA-01/02-design.md:840`, title at `:848`) — a test-infrastructure
chore about a container runtime and CI wiring. It is a different, also-unticketed thing, and it is
**out of scope here** (see below).

The problem the operator describes **is** on the record, in two places:

- `.ai/board/ideas/2026-08-31-nobody-can-join-the-board.md:338-361`, section *The bootstrap
  circularity, and how it breaks*.
- The `TODO(project):` on TEA-01's row in `.ai/registry/features.md:126` — *"the first-team and
  first-admin bootstrap is not a capability of this feature — a human applies a seed"*.

The correction is recorded so that a later reader is not sent to the wrong appendix. It is not the
subject of this idea.

## Problem

**On a Supabase project that this repository has just been pointed at, no person can become a member
of the team, and no sequence of actions in the interface changes that.** The first person to sign up
lands on the member-less screen, and stays there.

Three facts close the loop on each other:

1. **Admission only happens against a row that is already in `allowed_email`.**
   `public.admit_allow_listed_member()` fires after insert or update of `email_confirmed_at` on
   `auth.users` (`supabase/migrations/20260831150024_tea01_membership.sql:78-136`). It consumes a
   matching allow-list row and reads the team from it; when there is no match it returns without
   inserting anything — `if v_team_id is null then return new;` (`:107-109`), sign-up succeeds and
   admits nobody. **No other statement anywhere inserts into `public.member` on sign-up.**
2. **An `allowed_email` row cannot exist before a member does.** `added_by uuid not null references
   public.member (id) on delete restrict` (same file, `:44`). The column is not nullable and nothing
   cascades.
3. **The only path that has ever produced the first `member` row is `supabase/seed.sql`, and that
   file now refuses to run anywhere it would be needed.** Its opening guard raises unless
   `calechip.seed_target` is set to `local` (`supabase/seed.sql:16-49`). It is plain SQL with no psql
   meta-commands, and it fails closed: unset means refuse.

So the first allow-list row needs an admin, the admin needs a `member` row, and the `member` row
needs an allow-list row. **A correctly built, correctly deployed product admits nobody, ever.**

**What is new, and it is the whole reason this is worth writing down rather than re-litigating.** On
2026-08-31 this circularity was examined and ruled to need no decision, because ADR-009 already
contained an exit: admin zero signs up and gets an auth user with no member row, then *a human
applies a seed* that inserts the `team` row and one admin `member` row, and that admin allow-lists
everyone else (`.ai/board/ideas/2026-08-31-nobody-can-join-the-board.md:338-361`). **That exit has
since closed.** The guard at `supabase/seed.sql:16-49` was added under
[ADR-024](../../registry/decisions/ADR-024-the-seed-is-human-applied-and-converge-only.md) precisely
because every password in that file is published in this repository and the file had already been
applied by hand to the hosted project. The seed's own comment says so at `supabase/seed.sql:17-23`.
The accepted answer no longer runs where the problem is.

**This idea states no answer.** What replaces the closed exit — a schema change, an operational
procedure, a screen, or a decision that the state is acceptable — is not settled here.

## Who has it

**Whoever stands up a fresh Supabase project for this product, on the first day, before anybody has
used it.** That is not a hypothetical role in this repository: the product is public, `SETUP.md`
describes standing it up from a template, and **anyone who clones this repository and points it at
their own Supabase project meets this on their first sign-up.** It happens exactly once per project,
and until it is resolved nothing else in the product can be reached by anybody.

The second population is smaller and permanent: whoever holds the database credentials for an
existing project, every time the first admin has to be replaced or re-established.

## Evidence

**The empty loop is in the source, not inferred.** The three citations under *Problem* are the whole
of it — the not-null foreign key, the trigger's null-team return, and the seed guard.

**A screen that nobody can open.** TEA-02 shipped allow-list management (`.ai/registry/features.md:127`,
`src/routes/AllowList.tsx`) and it is admin-only. On a fresh project there is no admin, so the screen
that would break the loop is behind the loop.

**The remaining way in is hand-run SQL against the production database.** That is not a
characterisation; it is what the record says. `supabase/seed.sql:17-23` states that this seed *"has
only ever been applied by hand, and it was applied by hand to the hosted project"*, and ADR-024 exists
because of the consequence — accounts existed on the hosted project carrying passwords published in
this repository.

**No confirmed defect report from a second person.** Nobody has stood up a second project and
reported this; it is derived from the files and from the operator's own account. Recorded so this is
not read as field evidence.

### Visual reference — an attached screenshot, transcribed

**Visual reference:** this section. **THERE IS NO IMAGE FILE ON DISK.** One screenshot was attached in
conversation on 2026-09-07 and was never committed; `.ai/standards/ui-design-system.md:110-112` puts
an image attached at `/triage` in the idea's `Evidence` section, so the transcription is here. On
REJECT or NEEDS-ADR it stays here and **specifies nothing**; only on PROMOTE does it move to
`.ai/board/tickets/<ID>/design/`. This is the same situation as UIE-01 and UIE-02 and is handled the
same way — `.ai/board/tickets/UIE-02/design/README.md:1-23` is the canonical precedent, including its
statement of what a transcription costs: **a later reader cannot check a single line below against
the picture it came from.**

**What it is meant to settle:** nothing, by itself. It is evidence that the operator has a shape in
mind for where the answer would live. It is not a specification, and *"looks like the screenshot"* is
not an acceptance criterion (`.ai/standards/ui-design-system.md:137-138`).

**Shell.** Left sidebar ~245px on a pale lavender ground, full height. Top: `Ai Nghỉ?` bold deep
indigo ~22px, under it `Lịch vắng mặt team` ~11px grey. Section label `TEAM (8)` in ~11px letterspaced
uppercase grey-indigo, then eight rows — circular emoji avatar, name ~14px medium deep indigo, team
name ~10px grey beneath: Min (Bạn) / Core Engineering, Huy / Frontend Team, Trâm / Core Engineering,
Đạt / Backend Team, Ngọc / Frontend Team, Khoa / Backend Team, Linh / QA / Testing, Bảo / Design /
Product. Lower down a rounded card holding a four-row legend, each a coloured dot plus label: peach
`Nghỉ phép (PTO)`, mint `Làm ở nhà (WFH)`, lavender `Ngày lễ`, pink `Quá tải (>50%)`. Below a divider,
the current-user footer: avatar, `Min` bold, `ADMIN` in ~10px pink beneath, and at the right two icon
buttons — a palette and a sign-out arrow.

**Top bar**, white. Title `Quản Lý Thành Viên & Duyệt Phép` bold ~20px deep indigo at left. At the
right, a pill segmented control on pale lavender with three segments `Tuần | Tháng | Năm`, none
appearing selected; then a dark-navy rounded pill `Quản trị & Duyệt`; then a second dark-navy pill
`+ Đăng ký…`, clipped at the right edge of the screenshot.

**Main pane**, very pale lavender ground.

- A tab strip in a white rounded container, two tabs. Active: dark-navy filled pill, white text
  `Duyệt Member & Quản lý Team`. Inactive: plain deep-indigo text `Duyệt Đơn Nghỉ Phép` followed by a
  small pink circular badge reading `5`.
- Heading `YÊU CẦU ĐĂNG KÝ MỚI (0)` in ~11px letterspaced uppercase grey-indigo. Beneath it a white
  rounded card (~16px radius, soft shadow) whose only content is centred grey text
  `Không có thành viên mới nào đang chờ duyệt.` — **the empty state, and the only state shown**.
- Heading `DANH SÁCH THÀNH VIÊN CHÍNH THỨC (8)`. Beneath it a white rounded card holding a table.
  Header row ~10px letterspaced uppercase grey: `THÀNH VIÊN | TÀI KHOẢN | VAI TRÒ | NHÓM (TEAM) |` and
  right-aligned `TRẠNG THÁI`. Eight body rows on hairline rules. **THÀNH VIÊN**: emoji avatar plus
  bold name — Min, Huy, Trâm, Đạt, Ngọc, Khoa, Linh, Bảo. **TÀI KHOẢN**: grey handle
  `@min @huy @tram @dat @ngoc @khoa @linh @bao`. **VAI TRÒ**: a small rounded badge, pink ground with
  pink text `ADMIN` on Min and Trâm, pale lavender ground with indigo text `MEMBER` on the other six —
  a static badge, **not** a control. **NHÓM (TEAM)**: a bordered rounded native `<select>` with a
  caret, showing Core Engineering, Frontend Team, Core Engineering, Backend Team, Frontend Team,
  Backend Team, QA / Testing, Design / Product. **TRẠNG THÁI**: right-aligned peach rounded pill with a
  leading dot, text `Đã hoạt động`.
- Footer line, centred, small grey: `Hệ thống có tổng cộng 8 thành viên (0 chờ duyệt).`

**What the image does not show. Silence is not removal, and nothing below may be read out of it:** a
single pending request row, so the approve and reject controls on one are unseen; **any path by which
the first admin comes to exist, which is the problem this idea is about**; the allow-list screen TEA-02
shipped; any editable role control; anything behind the `Duyệt Đơn Nghỉ Phép` tab; hover, focus and
active states; any width narrower than desktop; and dark mode.

**The roster of eight is fictional.** `src/lib/fixtures.ts` holds four members on the main team who
have not been removed — the same warning UIE-04's row carries (`.ai/registry/features.md:152`).

## Impact if ignored

**The only remaining way into a new project is a human opening a SQL console on the production
database and writing rows by hand.** Not once at setup — every time the first admin has to be
established or re-established.

What that costs, beyond being inconvenient:

- **It is an unreviewed write to the authorization model.** Under ADR-005 there is no server and RLS
  is the entire authorization mechanism; a hand-written `member` row with `role = 'admin'` grants
  every admin power in the product, and no pull request, no CODEOWNERS review and no migration records
  that it happened.
- **It is invisible afterwards.** Nothing in the repository compares the database against the files —
  ADR-024 declined a drift detector, and the anon key cannot read `auth.users`
  (`supabase/migrations/20260831150024_tea01_membership.sql:145`). A wrong team id, a typo'd email or a
  second admin nobody meant to create leaves no trace anybody can find later.
- **It reproduces the exact failure ADR-024 was written to stop.** The nearest thing to a documented
  procedure is `supabase/seed.sql`, whose every password is published in this repository; the reflex
  under time pressure is to set `calechip.seed_target` to `local` on a hosted database and run it,
  which is the defect the guard exists to refuse.
- **The published product cannot be adopted.** Anyone who clones this repository reaches a working
  application, signs up, and is told they are not on a team — with no instruction anywhere that the
  next step is a database console.
- **A shipped feature stays unreachable.** TEA-02's allow-list screen is the intended answer to *how
  does anyone join*, and on a fresh project nobody can open it.

## Constraints already known

**In force, and nothing here may be answered in a way that contradicts them:**

- **[ADR-005](../../registry/decisions/ADR-005-authorization-in-rls.md) — Supabase Auth authenticates,
  RLS authorizes, and there is no server.** No answer to this problem may assume a server, an Edge
  Function or any component holding the service-role key. That is the envelope, not a preference.
- **[ADR-009](../../registry/decisions/ADR-009-how-a-person-becomes-a-member.md) — a person joins by
  signing up against an allow-list, and there is no invitation email.** Admission is *pre*-listing: an
  address is on the list before its owner signs up.
- **[ADR-024](../../registry/decisions/ADR-024-the-seed-is-human-applied-and-converge-only.md)** — the
  seed is human-applied, converge-only, guarded to a disposable target, and nothing compares it to the
  project.
- **[ADR-014](../../registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md)** — a
  migration touching a policy, trigger or constraint is **not** `schema_delta: none`.
- **RULE-01 and RULE-09** — the registry needs human approval at merge, and the seed is applied by a
  human, never by an agent.
- **INV-07** — an entry belongs to exactly one member and is counted only against that member's team.
  The migration comment at `:114` records that a new member's team comes from the allow-list entry
  *and nowhere else*.
- **INV-04** — the absence count is a share of the team's current member count, so anything that
  creates a `member` row moves everybody's overload threshold.
- **[ADR-027](../../registry/decisions/ADR-027-the-datastore-becomes-sqlite-behind-a-written-server.md)
  is `WITHDRAWN` and was never in force.** It must not be read as an available alternative.
- **Feature groups are `CAL`, `ADM`, `TEA`, `UIE`** (`.ai/registry/features.md:66`). `OPS-nnn` is the
  chore series and is not a feature prefix (`.ai/01-operating-model.md:317`). TEA-01 through TEA-05
  exist and are all `DONE`.
- **`.ai/board/ideas/2026-08-31-nobody-can-join-the-board.md:372` already ruled on one shape:** making
  `allowed_email.added_by` nullable *"would amend ADR-009's table and would need its own ADR"*.

### Three things the attached image reverses, and none of them is mine to decide

Named here because whoever rules on this needs them in front of them, not because this idea proposes
any of them.

1. **The copy is Vietnamese.** `.ai/standards/ui-design-system.md` § *Language* makes interface copy
   English, enforced by a lint rule in `eslint.config.js`, with a single exception for fixture and
   seed *user content* (`:61-74`). Every string in the transcription above — `Quản Lý Thành Viên &
   Duyệt Phép`, `YÊU CẦU ĐĂNG KÝ MỚI`, `Đã hoạt động` — is interface copy and reverses that standard.
   The same reversal was already ruled out of scope twice, on UIE-01 (`.ai/registry/features.md:149`).
2. **Identity is an `@handle`.** `@min`, `@huy`, `@tram`. Under ADR-009 and ADR-005 the identity is the
   **email address**: it is the allow-list's primary key (`extensions.citext primary key`,
   migration `:42`) and the join key the trigger matches on (`:103`). `username` exists nowhere in this
   product. Also already ruled out of scope on UIE-01.
3. **`YÊU CẦU ĐĂNG KÝ MỚI` is a different admission model from ADR-009's, and this is the one that
   matters.** A queue of people who signed up and are waiting to be approved admits a person
   *because an admin approved them after the fact*. ADR-009 admits a person *because their address was
   listed before they signed up* — the trigger consumes a pre-existing row and there is no pending
   state anywhere in the schema. These are two different answers to *how does a person become a
   member*, and adopting the second changes the envelope rather than working inside it. The `(0)` in
   that heading, and the empty-state card beneath it, are the only state the image shows.

**And one more, smaller but cited:** the per-member team `<select>` in the `NHÓM (TEAM)` column is a
control for **changing a member's team**. TEA-04's registry row is *"Remove a member, and promote a
member to admin"* (`.ai/registry/features.md:129`) — removal and promotion only, and no row anywhere
covers moving a member between teams. INV-07 is engaged the moment one does: an entry is counted only
against the team its member belongs to, so moving a member moves the arithmetic for every date they
already have entries on, past dates included. The role badge in that same table is static and is not
a control, so TEA-04's promotion power is not what is drawn.

## Out of scope

- **Appendix A of `.ai/board/tickets/TEA-01/02-design.md:840`** — provisioning a disposable Supabase
  database for tests to run against. Related by neighbourhood only; it is a test-infrastructure chore
  about a container runtime and CI wiring, it is also unticketed, and folding it in here would put two
  unrelated problems behind one verdict.
- **The whole of the screen in the transcription.** This idea is about the way in, not about the admin
  console it was drawn on. The member table, the roster sidebar, the tab strip and the top bar are a
  layout for surfaces that mostly already exist (TEA-02, TEA-03, TEA-04, ADM-04, ADM-05, ADM-06).
- **The leave-approval half** — the `Duyệt Đơn Nghỉ Phép` tab and its `5` badge. ADM-04, ADM-05 and
  ADM-06 are shipped and `DONE`; nothing here reopens them.
- **Changing a member's team.** Named above as a constraint so it is visible, and explicitly not asked
  for here.
- **Anything that puts a credential on a server.** ADR-005 forbids it and this idea does not reopen it.
- **Weakening or removing the seed guard**, or republishing credentials. The passwords in
  `supabase/seed.sql` are in the repository's history and stay unusable on a real project.
- **The state of the currently hosted project.** No claim is made here about what rows it holds; that
  cannot be read from this repository and was not measured.
- **An invitation email.** ADR-009 decided there is none.

## Open questions

1. **Is establishing the first admin a capability of the product at all, or an operational step
   outside it?** The 2026-08-31 verdict answered *outside* — *"the first admin gets no feature row"*
   (`:358-361`), on the reasoning that the charter names no self-service admin path. That reasoning is
   untouched by anything here. What changed is only that the operational step it pointed at no longer
   executes. **Whichever way this is answered decides whether this idea can produce a feature row at
   all.**
2. **If it stays operational, what is the artifact?** The seed cannot be it — its passwords are
   published and its guard refuses a hosted target. Nothing in the repository currently documents a
   procedure, and a procedure that exists only in a person's memory is what produced the state ADR-024
   was written about.
3. **Must `allowed_email.added_by` stay `not null`?** `:372` of the 2026-08-31 idea says relaxing it
   amends ADR-009's table and needs its own ADR. That is a live question again now that the exit which
   made relaxing it unnecessary has closed — but it is a decision, not a fact, and it is not answered
   here.
4. **Does the approval-queue model in the image replace ADR-009's allow-list, sit beside it, or not
   arrive at all?** Constraint 3 above. Nobody has decided, and the image is not a decision.
5. **How does the very first `team` row come to exist?** `allowed_email.team_id` and `member.team_id`
   are both `not null` against `public.team`, which has one row in v1 and no creation path in the
   product. The 2026-08-31 answer folded this into the same seed step, so it closed with it.
6. **Who confirms what the hosted project currently contains?** Not answerable from this repository —
   ADR-024 declined the drift detector and the anon key cannot read `auth.users`
   (`migration:145`). Any answer that assumes the hosted project is empty, or that it already has an
   admin, is assuming.

---

## Triage verdict: NEEDS-ADR

**One verdict, and the reason is that this is not one decision — it is two, and they arrived in the
same message.** The deadlock the problem half describes is real, closed at two independent links, and
the only exit the repository ever documented now refuses to run where it is needed. That much needs a
decision. The attached image, separately, proposes a *different answer to how a person becomes a
member*, which needs a different decision from a different person. **They are decided apart, and the
rest of this section is the argument for why.**

Written by `product` after reading `tech-lead-design`'s technical half of this same run in full. Where
this section states a mechanical fact about the schema, that half measured it; where it states what
the two halves disagreed about, *The split* below is the record.

### The two decisions, and why they must not be bundled

| | What is being decided | Who may take it |
|---|---|---|
| **1. The bootstrap** | How the first `team` row and the first admin `member` row come to exist on a project nobody has used | **An agent, under ADR-008.** It supersedes nothing |
| **2. The approval queue** | Whether a person becomes a member by being allow-listed *before* they sign up, or by signing up and being approved *after* | **The operator, and nobody else.** It reverses ADR-009 |

**The argument that they must not be taken together is `tech-lead-design`'s and it is cited, not
paraphrased.** Taking a membership-model decision as a side effect of fixing a deadlock is the exact
failure `ADR-009:55-58` recorded when it refused the Edge Function. Bundling them would also buy
nothing, because **the queue does not solve the bootstrap**: every state the image draws presupposes a
signed-in admin, and on a fresh project `public.is_admin((select auth.uid()))` is false for everybody,
forever. Even with that screen shipped, somebody still has to be the first admin by exactly the
hand-applied SQL this idea is about.

### Decision 1 — the bootstrap. `ACCEPTED by tech-lead-design`, and the ADR is written

The answer is a **password-free bootstrap file parameterised on an auth user that already exists**:
admin zero signs up through the shipped interface, lands on the member-less state ADR-009 already
documents as correct behaviour (`ADR-009:78-81`), and a human runs one committed, reviewable SQL file
that inserts the `team` row and one admin `member` row for that user's id. That admin then allow-lists
everybody else and the ordinary ADR-009 flow runs from there.

**The ADR is
[`ADR-030-the-first-admin-arrives-by-a-password-free-bootstrap-file.md`](../../registry/decisions/ADR-030-the-first-admin-arrives-by-a-password-free-bootstrap-file.md).**
It is drafted by `tech-lead-design` in this same `/triage` run, in parallel with this verdict, and
carries `ACCEPTED by tech-lead-design` under ADR-008. `product` did not write it, did not read it and
did not wait on it; it is cited here by path because that is what this verdict rests on. **If it is
not on disk when you look, it was written in the same run and its absence is a fact about ordering,
not about the decision.** The operator reviews it at merge under CODEOWNERS, which is where RULE-01
puts approval.

**Why an agent may accept it, stated as the test rather than as a conclusion.**
`.claude/commands/triage.md:49-51` lets an agent accept a decision that sits inside what is already
decided. This one **supersedes nothing**: it *is* ADR-009's own recorded exit — the three steps at
`.ai/board/ideas/2026-08-31-nobody-can-join-the-board.md:346-351` — made runnable on a hosted project
after ADR-024 closed the file that used to carry it. It is inside ADR-005 (no server, no elevated key
in any bundle), inside ADR-009 (the allow-list still governs everyone after the first), and inside
ADR-024 (human-applied, converge-only, named rather than performed). The precedent for an agent
accepting an ADR of exactly this shape is ADR-024 itself, which carries `ACCEPTED by
tech-lead-design`.

**The three alternatives are on the record and each was refused for a stated reason**, in § 2 of the
technical half: making `added_by` nullable is **not an exit at all** — the insert still fails
`allowed_email_insert_admin` and `allowed_email.team_id` still points at a table with no rows and no
insert path, so it costs an amendment to ADR-009's table and buys nothing; a `security definer`
first-admin function works but adds a permanent privileged surface and a **new permission row in a
human-only standard** to perform a one-time act; an Edge Function holding the service-role key
supersedes ADR-005 and is out of bounds without the operator. Doing it by hand in the SQL editor is
what `supabase/db.sql:996-999` already prescribes, and the bootstrap file is that, with the SQL
committed, parameterised and reviewable.

### Decision 2 — the approval queue. Stopped, and returned as one question

**Not decided here, and no agent may sign it.** `YÊU CẦU ĐĂNG KÝ MỚI` is a queue of people who signed
up and are waiting to be approved. That admits a person *because an admin approved them after the
fact*; ADR-009 admits a person *because their address was listed before they signed up*. It reverses
**ADR-009 decision points 1 and 3** (`ADR-009:38-46`), both of which carry `ACCEPTED by the operator`.
`.claude/commands/triage.md:52-53` is unambiguous about what happens then: an agent stops and asks,
because `ACCEPTED by the operator` is a claim about a person that no agent may write on their behalf.
**So there is no ADR for this half, no ticket for it, and no recommendation dressed as one.**

Three mechanical findings the operator should have when they answer, all `tech-lead-design`'s:

1. **The queue's data source does not exist and cannot be read.** A person who signs up
   un-allow-listed exists only in `auth.users`, which is granted to `authenticated` nowhere, and
   ADR-024 decision point 3 (`:99-104`) says reading it needs the service-role key or the database
   URL. The queue needs a new table plus a trigger, which ADR-014 makes explicitly not
   `schema_delta: none`.
2. **Approving would have to insert a `member` row**, which the schema says twice must never be
   reachable by a policy (`…tea01_membership.sql:171-173`, repeated at `supabase/db.sql:740`).
3. **The cheap reading also fails.** "Approve" meaning "add their address to the allow-list" does not
   work, because the admission trigger fires on `email_confirmed_at` and that confirmation already
   happened for anybody in the queue — the row would sit unconsumed and the person would have to sign
   up a second time.

And one thing in the operator's favour, which is why this is a question and not a refusal:
**ADR-009's own revert condition fires here.** `:100-106` names *"the first time the team needs to
onboard somebody whose email address nobody knows in advance"*, which is precisely what a sign-up
queue serves. The request is within that ADR's own terms. The ADR names the **claim token**, not an
approval queue, as the cheaper correction, and says anything further must supersede it on its own
terms. The operator is entitled to choose the queue; they must choose it knowingly.

**The question, reproduced verbatim from § 4 of `tech-lead-design`'s technical half.** It is
reproduced as written there — English, which is what this repository's artifacts are — rather than
rewritten:

> The first-admin deadlock is fixable today with a password-free bootstrap SQL file — no ADR
> supersession, no new screen. Separately, the image's `YÊU CẦU ĐĂNG KÝ MỚI` queue would replace
> ADR-009's allow-list with sign-up-then-approve, which needs your signature. Do you want (a) the
> bootstrap file only, (b) the bootstrap file now and the queue as its own later ADR, or (c) both
> together as one decision?

**No agent may sign this.** Answering (a), (b) or (c) is the operator's, and the *Re-triage verdict*
below deliberately does not wait for it, for a reason it states there.

**ANSWERED BY THE OPERATOR ON 2026-09-07, IN THE SAME `/triage` RUN THAT ASKED IT: (b).** The
question was put to them by the dispatching session immediately after both halves reported, and the
answer chosen was *"bootstrap trước, queue để sau"* — **the bootstrap file now, and the approval
queue as its own later ADR**. The paragraph above is left exactly as written rather than rewritten,
because a question recorded as open and then answered is more informative than one that only ever
appears settled.

**Three consequences, none of which changes a line already written above.**

1. **The *Re-triage verdict* below is unaffected**, which is the point its own reasoning makes: it
   was written not to wait, and (b) is the answer under which not waiting was already correct. `OPS-004`
   stands as created.
2. **No ADR was signed here.** (b) is a decision about *sequencing*, not about the membership model:
   it authorises `ADR-030` to proceed alone and it defers the queue. It does **not** accept the queue,
   does not pre-approve it, and does not reverse any clause of ADR-009. Whoever writes that later ADR
   starts from ADR-009 in force and unamended, and still needs the operator's own signature under
   ADR-008 — `.claude/commands/triage.md:52-53`.
3. **The queue has no ticket, no feature row and no idea file of its own**, and this sentence is the
   only record that it is owed. It re-enters the loop at a fresh `/triage`, against an image the
   operator attaches at that stage — the transcription in *Evidence* above specifies nothing
   (`.ai/standards/ui-design-system.md` § *Visual specification*) and must not be treated at that
   point as a specification it never became. The five reversals priced below are the cost estimate
   that triage inherits.

### The image reverses five things, priced

Four of these are named in *Three things the attached image reverses* and the paragraph after it,
above. They are repriced here at the weight `tech-lead-design` measured, and a fifth is added that
nobody had named.

**(a) The Vietnamese copy — price near zero, and it is not a decision.**
`.ai/standards/ui-design-system.md` § *Language* makes interface copy English on the operator's own
2026-09-03 instruction, and it is mechanised: `eslint.config.js:80-93` restricts diacritics in
`Literal`, `TemplateElement` and `JSXText`, and `copyDebt` in `ui-language.json` **is now empty**
because OPS-002 emptied it on 2026-09-07 — so the ignore list can no longer absorb a new file.
Vietnamese copy on a new screen fails lint, which is review check R3. **Adopt the layout, ship the
strings in English.** UIE-01 set the precedent and found the English fits the same pills at the same
widths (`.ai/board/tickets/UIE-01/01-plan.md:78-83`).

**(b) The `@handle` identity — worse than "there is no username".**
UIE-01 already scoped this out. The new finding: `public.member` carries
`id, team_id, display_name, avatar, role, removed_at, created_at` and **no email**
(`…tea01_membership.sql:31-39`); the email lives in `auth.users`, which `authenticated` cannot read;
and `allowed_email` carries an address but only the *adder*'s member id. **So the `TÀI KHOẢN` column
cannot be populated for anybody but the caller themselves, by any means available to a client
today** — not "shows the wrong thing", shows nothing. Price: drop the column, or accept a schema
delta (denormalising the email onto `member` at admission is a trigger change, and ADR-014 makes that
not `none`).

**(c) The per-member team `<select>` — the most expensive control on the screen.** Four independent
refusals: **no grant** (`…tea04_member_writes.sql:29` grants `update (role, removed_at)` only —
`team_id` is deliberately withheld); **a policy already written to refuse it** —
`member_update_admin`'s `with check (team_id = public.member_team_id(...))` at `:48-50`, which the
comment at `:40-41` describes as *"the second lock … if a later ticket ever grants that column, this
policy already refuses a move across teams"*, so somebody wrote that predicate specifically against
this control; **no permission row** in `.ai/standards/rbac-and-security.md:28-46`, which has *Remove a
member* and *Promote a member to admin* and nothing about changing a team; and **INV-07**
(`.ai/registry/invariants.md:39`, note at `:163-168`), which is why `…tea01:114` says a member's team
comes from the allow-list entry *and nowhere else*. Price: a row in a human-only standard (RULE-01), a
column grant, a policy amendment and an INV-07 argument — for a control the image renders in the same
table where it renders `VAI TRÒ` as a static badge and explicitly not a control. **Cheapest correct
move: render `NHÓM (TEAM)` as static text too.**

**(d) A fourth collision nobody named, and it is second in size only to the queue: the image is
multi-team and v1 is not.** The eight members sit across **five** teams — Core Engineering, Frontend
Team, Backend Team, QA / Testing, Design / Product — in both the sidebar and the `NHÓM (TEAM)` column.
`.ai/00-charter.md:30` is *"One team of five to thirty people"*, and `:64-66` defers *multiple teams in
one workspace* to P2 as **deferred, not refused**. Mechanically, `member_select_team` scopes the roster
to `team_id = public.member_team_id((select auth.uid()))`
(`20260901093000_tea03_member_select_team.sql:34-36`), so **one admin cannot see eight members across
five teams** — they would see only their own. Price: draw one team, or it is a charter-scope question
for the operator. This is `tech-lead-design`'s finding and it is recorded as theirs.

**(e) Adopting the table as drawn would delete two shipped powers in favour of one that has none.**
Also `tech-lead-design`'s. The image shows **no remove control and no promote control** on any row.
Both are shipped, permission-backed and tested — `src/routes/MemberList.tsx:73-96`
(`onPromote` → `seam.promoteMember`), `:100-118` (`onConfirmRemove` → `seam.removeMember`), gated at
`:171-173`. The one control the image *does* add to that table is the team `<select>` of (c), which
has no permission row at all. And the queue is drawn only in its **empty** state, so its approve and
reject controls are unseen: nothing in the transcription says what approving does.

### The image specifies nothing, and stays where it is

`.claude/commands/triage.md:68-69` and `.ai/standards/ui-design-system.md` § *Visual specification*:
**on REJECT or NEEDS-ADR there is no ticket, the image stays with the idea, and it specifies
nothing.** This verdict is NEEDS-ADR, so the transcription stays in `Evidence` above and is not moved
to any `design/` directory — including `OPS-004`'s, created below. OPS-004 builds a SQL file and no
screen; there is nothing in that transcription for it to look like. Nothing below may be read as
adopting any part of the layout.

The transcription's own cost is restated because it does not go away: **a later reader cannot check a
single line of it against the picture it came from.** There is no image file on disk.

### PROMOTE is wrong, and no feature row is written

**Stated as a finding rather than left as an omission, because ADR-007 makes PROMOTE the default that
writes a row.** The 2026-08-31 verdict ruled that establishing the first admin **is not a capability
the product offers** — *"So the first admin gets no feature row"*
(`.ai/board/ideas/2026-08-31-nobody-can-join-the-board.md:358-361`) — on the reasoning that the
charter names no self-service admin path and that creating one from inside the product would need a
privileged write ADR-005 forbids. **Nothing found in this run overturns that reasoning.** What changed
is only that the operational step it pointed at no longer executes, which is a fact about the seed
guard and not about what the product contains.

A new row in the `TEA` group reading *"the first admin comes to exist"* would file an **operational
procedure** as a capability, in the file `CLAUDE.md` calls *the only valid source of feature IDs*.
(The number that row would have taken is deliberately not written here: check D1 polices every
three-letter feature token in every document against `.ai/registry/features.md`, so naming the ID of
a row this paragraph exists to argue *against* writing would fail the audit — correctly, since a
citation of an ID that does not exist must not read as evidence that somebody planned it.) That is the same
deliberate departure from ADR-007's PROMOTE default that **BUG-001, OPS-001 and OPS-002** took, and it
is why the re-triage below creates `OPS-004` with no row of its own —
`.ai/01-operating-model.md:317`, *"Defects are `BUG-nnn`, chores are `OPS-nnn`"*.

**The provenance a reviewer gets instead is one sentence appended to TEA-01's `Notes` cell in
`.ai/registry/features.md`**, in the form the UI-copy and visual-restyle chores already use on that
same cell. Nothing else in `.ai/registry/**` moves at this verdict, and no feature row is created,
renamed or renumbered anywhere.

**One caveat that is not this verdict's to resolve.** ADR-028 overruled exactly this argument once
before — the visual-restyle chore was written as `OPS-003` with no row, and the operator's instruction
gave UI work a feature group, so it became `UIE-01` with a row. That overruling turned on the operator
declaring a *group* for a class of work. No group exists for operational bootstrap procedures, and
declaring one is an ADR and the operator's. If they want one, this verdict is the thing to overrule.

### The split: a disagreement resolved, not a consensus

The two halves reached the same verdict and did not agree on its shape. Recorded because a split
presented as agreement hides which argument won, and because `product`'s position is not weakened by
being written down as it was actually held.

- **`product` held that the whole thing is stop-and-ask.** The reasoning: every remaining shape needs
  a decision nobody has taken, the *Open questions* section above lists six of them, and question 1 —
  *is establishing the first admin a capability of the product at all* — is the one whose answer
  decides what any of the others mean. On that reading, accepting any part of it under an agent's name
  chooses an answer to question 1 by implication.
- **`tech-lead-design` held that it is two decisions and that they must not be taken together.** The
  bootstrap supersedes nothing — it is ADR-009's own recorded exit made runnable after ADR-024 closed
  the file that used to carry it — so `.claude/commands/triage.md:49-51` and ADR-008 permit an agent
  to accept it. The queue reverses ADR-009 decision points 1 and 3, which carry `ACCEPTED by the
  operator`, so `:52-53` stops it and returns it as one question.

**It resolved to `tech-lead-design`'s reading, and the argument that won is the citation.** ADR-009's
consequences already record the three-step exit; ADR-024 closed the file that carried step 2 without
ever deciding that step 2 should stop happening. So the bootstrap file is not a new answer to question
1 — it is the *existing* answer, made executable. `product`'s objection is answered narrowly rather
than dismissed: it is right that nobody has re-affirmed the operational-step answer since ADR-024, and
the operator reviews ADR-030 at merge, where a disagreement with that answer costs one comment rather
than a shipped ticket.

**`product` was not overruled on the second half and did not need to be** — both halves agree the
queue stops. And both agree PROMOTE is wrong; that finding is `product`'s and `tech-lead-design`'s
technical half does not contradict it.

---

## Re-triage verdict

**The bootstrap half does not wait for the operator's answer, and the reason is worth saying out
loud: it is unblocked under all three of (a), (b) and (c).** Somebody has to be the first admin in
every one of them. A queue whose approve action inserts a `member` row still needs an admin to press
it; a queue that files allow-list rows still needs an admin whose id goes in `added_by`. There is no
answer to that question under which the first `team` row and the first admin `member` row arrive by
themselves. **So the ticket below is created now, and answering (a), (b) or (c) neither unblocks it
nor invalidates it.**

What it waits on instead is ADR-030 being accepted, which happened in this same run under ADR-008.

### `OPS-004` — a chore ticket, and no feature row

**The ID is `OPS-004`, and `OPS-003` is deliberately skipped.** `OPS-003` was issued on 2026-09-05 and
then vacated the same day when the visual-restyle chore was renumbered to `UIE-01` under
[ADR-028](../../registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md). Reusing the number would
make two documents mean different things by the same token — `.ai/board/backlog.md` and TEA-01's and
TEA-05's `Notes` cells all still say `OPS-003` and all mean the restyle. A vacated ID stays vacated.

Written: `.ai/board/tickets/OPS-004/ticket.yaml` from `.ai/templates/ticket.yaml`, `state: BACKLOG`,
with Definition of Ready items 1, 3, 4 and 6 filled and items 2 and 5 left as the template ships them
— they are `tech-lead-design`'s at PLAN, and the gate sits after PLAN so that they can be. A row is
appended to `## BACKLOG` in `.ai/board/backlog.md`. The full reasoning for each field is in that
`ticket.yaml`; what follows is only what a reader of *this* file needs.

- **`feature_ids: [TEA-01]`**, on the BUG-001 precedent. Definition of Ready item 1 requires it
  non-empty with every ID present in the registry, so `[]` fails the gate outright; and item 1
  constrains `feature_ids`, **not the ticket `id`**, which is why a `TEA` feature list sits under an
  `OPS` ticket without contradiction. TEA-01 is the right row rather than a convenient one: its cell
  carries the `TODO(project)` this chore closes, and its trigger is the mechanism the bootstrap steps
  around. One group, `TEA`, so item 6 is satisfied without a split rationale.
- **`depends_on: []`, measured rather than inherited.** Every ticket on this board is `DONE` and
  `## BACKLOG` was empty before this row, so no live ticket claims a path. **Appendix A's provisioning
  chore is not a prerequisite** — `tech-lead-design` found that on a hosted project the Supabase SQL
  editor is the only surface available while that chore is unlanded, which is precisely the surface
  this file is applied through. It is also not a ticket and has no ID, so it could not go in that
  field in any case.
- **`schema_delta: none`, decided rather than defaulted.** The bootstrap file creates *rows*. It adds
  no table, no column, no policy, no trigger and no constraint, so ADR-014 does not fire. ADR-030 is
  linked in the ticket regardless — as the decision the whole ticket rests on, not as a schema-delta
  ADR. **If PLAN concludes otherwise it stops and asks** rather than correcting the field quietly.
- **`invariants_touched` and `size_estimate` left empty.** PLAN's.

**One scope boundary found while writing the shell, and it is named here because it costs a plan
otherwise.** `tech-lead-design`'s costing of this exit includes a paragraph in
`.ai/standards/data-model.md` § *Seed data* (`:187-203`) distinguishing the bootstrap file from the two
things already described there. **That file is human plane** — `CLAUDE.md` § *Two planes*, and RULE-01
— so it is not `OPS-004`'s to write, and the ticket says so. It belongs to `/thuki` on an `ops/<slug>`
branch, and it is the third such item now waiting on that session.

**Nothing here is committed.** The registry sentence and the board row travel with the ticket and land
on its branch at `/ship`, in the same pull request — ADR-023. The operator approves at merge under
CODEOWNERS, which is where RULE-01 says enforcement lives.

### What is deliberately not created

- **No ticket for the approval queue.** It is not decided, and a shell for it would be a decision
  taken by whoever wrote the shell.
- **No feature row anywhere**, for the reasons under *PROMOTE is wrong* above.
- **No `design/` directory on OPS-004** and no image moved into one. NEEDS-ADR, so the transcription
  stays in `Evidence`.
- **No edit to `supabase/seed.sql`, its guard, or any migration.** Weakening the guard is out of scope
  in the problem half and stays out.

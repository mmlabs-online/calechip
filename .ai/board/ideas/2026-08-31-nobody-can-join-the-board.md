---
stage: TRIAGE
agent: product
produced_at: 2026-08-31
inputs_read:
  - product_brief.md
  - .ai/00-charter.md
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - .ai/registry/rules.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-007-triage-issues-feature-ids.md
  - .ai/registry/decisions/ADR-008-agents-may-accept-adrs.md
  - .ai/registry/decisions/ADR-009-how-a-person-becomes-a-member.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/steward/context.md
  - .ai/01-operating-model.md
  - .claude/commands/triage.md
consulted:
  - tech-lead-design
gate: PASS
blocking_reason: ""
next_state: BACKLOG
---

# Nobody can join the board, so there is no team for a calendar to belong to

## Problem

There is no way for a person to become a member of this team inside the product, and no way for the
product to tell one person's declaration from another's. A new joiner cannot get onto the board at
all. Somebody who leaves stays on it. And the number the whole coordination mechanism divides by —
how many people are on this team right now — has no source.

This is stated as a problem rather than as "build sign-in and invitations" deliberately: the brief
writes it as a requirement (7.6), and the thing underneath the requirement is that **every other part
of the product is a statement about a person and a team, and neither exists yet.**

## Who has it

- **An admin**, each time somebody joins or leaves the team. On a team of five to thirty, several
  times a year, and every occurrence is silent — nothing prompts it and nothing shows it is overdue.
- **Every new member**, exactly once, at the moment they first have a plan to declare. This is the
  worst possible moment for friction: they came to the product with something to say and cannot say
  it.

## Evidence

Three registry statements exist today with no surface in the product to hold them:

- **INV-07** — every entry belongs to exactly one member and is counted only against that member's
  team. There is no member and no team.
- **INV-04** — the absence count's threshold multiplies the team's **current** member count. Nothing
  supplies that count.
- The charter's Roles table names *invite and remove members* and *promote a member to admin* as
  powers only an admin has. None of the three is reachable.

Two further facts from decisions already recorded, both of which make this idea's shape less free
than it looks:

- [ADR-005](../../registry/decisions/ADR-005-authorization-in-rls.md) places authentication in
  Supabase Auth and authorization in row-level security. Every policy in the system will be written
  against an authenticated identity that currently has no way to come into existence.
- `.ai/standards/data-model.md` records that a member row cannot precede its auth user, because the
  member's primary key **is** that user's id. ~~So "invite a member" is an Auth invitation, not a row
  this application inserts, and how the row then appears is open — it is that file's open question 4.~~
  **Struck 2026-08-31 by [ADR-009](../../registry/decisions/ADR-009-how-a-person-becomes-a-member.md).**
  It is not an Auth invitation: `inviteUserByEmail` lives on Supabase's admin surface and needs the
  service-role key, which ADR-005 leaves no server to hold. The person signs themselves up on the
  ordinary client and a trigger on the auth user creates the member row if the address is
  allow-listed. The first sentence above still stands — the row still cannot precede its auth user,
  which is why the sequence is sign-up first and member row second.

## Impact if ignored

Nothing else in the product can be built. An entry has no author, a calendar has no roster to draw
rows for, the overload threshold has no denominator, and an approval has nobody who is entitled to
give it. This is not the most valuable idea on the board; it is the one that the valuable ones are
standing on.

The second-order cost, if it is built late and thinly: the team's roster becomes whoever happened to
sign in, the absence count starts dividing by a number nobody maintains, and the warning that the
product exists to produce quietly reports the wrong thing while looking correct.

## Constraints already known

- **INV-07** — one member, one team, and the count is taken against that team. The data has to carry
  the team from the first migration even though v1 has one team.
- **INV-04** — the denominator is the current member count, read at evaluation time, and
  `.ai/standards/data-model.md` defines "current" as the team's members with `removed_at` null. So
  removal is a soft delete, and this idea inherits that.
- **`.ai/00-charter.md` Roles** — two roles only. An admin may invite, remove and promote; a removed
  member's entries stay.
- **`.ai/standards/rbac-and-security.md`** records two rows as **denied by default rather than by
  decision**: creating an entry on behalf of another member, and demoting an admin. Neither is
  settled; both sit inside this idea's boundary.
- **ADR-005** — no custom authentication API. Whatever this becomes, it is Supabase Auth plus
  row-level security, and a permission expressed only in the interface is not a control.

## Out of scope

- **Multiple teams or departments in one workspace.** Deferred to P2 by the brief and explicitly not
  refused by the charter. This idea must leave room for it (INV-07 already does) and must not build
  it.
- **Slack, Teams or Zalo identity.** P1, and a different problem — this idea is about who is on the
  team, not about where they are notified.
- **Role-based constraints** such as "these two may not be away on the same day". P2.
- **Anything about leave quota or the HR record of a person.** Charter refusal 1.
- **Four further exclusions were added on 2026-08-31**, all consequences of
  [ADR-009](../../registry/decisions/ADR-009-how-a-person-becomes-a-member.md). They are written once,
  in the re-triage verdict below under *Out of scope, added at re-triage*, rather than copied here.

## Open questions

1. ~~**How does a member row come into existence after an Auth invitation?** Three defensible answers —
   a database trigger on the auth user, creation at first sign-in, or an admin completing a profile.
   Open question 4 in `.ai/standards/data-model.md`, unanswered, and it decides the shape of the
   whole invitation flow.~~ **Answered 2026-08-31 by
   [ADR-009](../../registry/decisions/ADR-009-how-a-person-becomes-a-member.md):** a trigger on the
   auth user, gated on the allow-list, which also consumes the allow-list entry. Open question 4 in
   `.ai/standards/data-model.md` is struck through and answered in that file.
2. ~~**Is an invitation a single-use email invite, a reusable team link, or both?** The brief (7.6) says
   *"qua email hoặc link"* and does not say whether the link expires, or who may hold it.~~
   **Answered 2026-08-31 by
   [ADR-009](../../registry/decisions/ADR-009-how-a-person-becomes-a-member.md): it is neither.**
   An admin adds an address to the allow-list and tells the person out of band. There is no email, no
   link and no token, so nothing expires and there is nothing to hold. The claim-token shape was
   considered and rejected in the ADR, and it survives only as that ADR's revert condition.
3. ~~**Do a removed member's future entries still count toward the absence count?**~~ **Answered by
   the operator, 2026-08-31: they do not count** — the entries stay and stay visible, but they leave
   the absence count on removal. Extending INV-04's note from the denominator to the numerator is a
   registry amendment; it needs an ADR under RULE-01. Original wording follows.
   The operator decided
   their entries stay. INV-04's *denominator* is current members only, but the invariant says nothing
   about excluding a removed member's entries from the *numerator* — so a departed colleague can make
   a future day look overloaded. This needs an answer before the warning is built, not after.
4. ~~**Who is the first admin?** Nothing in the brief or the charter says how the first account of a
   brand-new team acquires the admin role.~~ **Answered 2026-08-31 at re-triage, from inside
   [ADR-009](../../registry/decisions/ADR-009-how-a-person-becomes-a-member.md) rather than by a new
   decision:** the first admin arrives by a seed a human applies, not by a product capability. The
   reasoning and the exact sequence are in the re-triage verdict below, under *The bootstrap
   circularity*. It gets no feature row.

## Triage verdict: NEEDS-ADR

**Decided 2026-08-31 by `product` and `tech-lead-design`**, running the two halves of triage
independently and reaching the same verdict without reconciling first.

**`next_state` is `TRIAGE`, deliberately.** The state enum in
[.ai/01-operating-model.md](../../01-operating-model.md) has twelve values and none of them means
*waiting on a human decision at the board plane*. `ESCALATED` is the closest in meaning — *a human
decides; it does not self-resume* — but it is a `ticket.yaml` state on the implementation loop and
this idea has no ticket. So the idea stays where it is and is re-triaged once the ADR lands.

### Why

The idea is correct, it is foundational, and nothing in `.ai/registry/features.md` covers it — the
`TEA` table is empty and no other idea on the board claims this ground. It does not fail on merit. It
fails on a decision that was already recorded as unanswered and already declared blocking:
[.ai/standards/data-model.md](../../standards/data-model.md) open question 4 says of itself
*"Blocks: the first story touching team management"*, and this is that story. The same file's
*Migrations* section is independently decisive: *"A ticket whose `schema_delta` is anything but
`none` needs an approved ADR linked before it can pass Definition of Ready"* — which is also item 4
of the Definition of Ready table in `.ai/01-operating-model.md`. This idea creates the first
migration in the project. There is no version of it with `schema_delta: none`.

One ADR settles all of it, because every item below is the same question at a different depth: **how
does a person become a member of this team.** Writing it is the operator's, under RULE-09 and
RULE-01; `/thuki` records it once the decision exists in words. No feature row is issued at
NEEDS-ADR — ADR-007 authorises a row on `PROMOTE` only.

### What the ADR must decide

1. **How a `member` row comes into existence after an Auth invitation** — *schema, and under ADR-005
   also security.* Three defensible answers (a trigger on `auth.users`, creation at first sign-in, an
   admin completing a profile) and they are not equivalent: the trigger option is a `SECURITY
   DEFINER` write path that row-level security does not see, which under ADR-005 is the entire
   authorization model being bypassed by design rather than by accident.
2. **Where `display_name` and `avatar` come from** — *schema.* Both are `not null` with no default in
   `.ai/standards/data-model.md`, so whichever answer item 1 takes has to supply two values at the
   moment the row appears. First sign-in and a trigger can supply neither without a source.
3. **Whether an invited-but-not-yet-signed-in person is a member** — *registry.* This is not
   bookkeeping: `removed_at is null` is the definition of INV-04's denominator, so if the row exists
   at invitation the team size rises — and every overload warning in the product changes — on the day
   the invite is sent rather than the day the person arrives.
4. **The invitation model, and whether an `invitation` entity exists at all** — *schema.* The brief
   (7.6) says *"qua email hoặc link"* and does not say whether a link expires or who may hold it.
   A reusable link with no entity behind it and a single-use invite with one are different data
   models, not different copy.
5. **Where the invite is sent from** — *dependency.* See *The architectural fork* below. This is the
   item most likely to change the answer to item 4.
6. **The first-team and first-admin bootstrap** — *schema.* `data-model.md` gives `team` one row in
   v1 and no creation path, and `member.role` defaults to `member`. As the model stands, a correctly
   built product has one team nobody created and zero admins, permanently. Whether the first admin is
   a product capability or a seed step decides whether it is a feature at all.
7. **The name of the `is_admin(uid)` helper, and the migration that defines it** — *registry.*
   [.ai/standards/rbac-and-security.md](../../standards/rbac-and-security.md) still carries this as
   `TODO(project)` and says plainly that until it is filled the section *"describes an intent rather
   than a mechanism"*. Every admin action in this idea — invite, remove, promote — is a policy that
   calls it.

### Invariants engaged

- **INV-07**, directly. Every `member` row this idea creates carries `team_id`, from the first
  migration, and `.ai/registry/invariants.md` records that this has to be a property of the data
  rather than a constant parameterised later.
- **INV-04**, twice and indirectly. Once through item 3 above — when a member enters the denominator.
  Once through removal: `removed_at` is that denominator's definition, so removing somebody changes
  the absence count for **past** dates, which the INV-04 note already records as an accepted
  consequence.
- **INV-01, INV-02, INV-03, INV-05, INV-06 — not engaged.** This idea writes no `entry` row. Stated
  rather than left blank, because `.ai/registry/invariants.md` warns that concluding no invariant is
  engaged is exactly where the reasoning is usually skipped.

### The architectural fork this idea missed

The idea treats *"invite a member"* as settled to mean a Supabase Auth invitation. It is not settled,
and this is the most consequential finding of the run.

`inviteUserByEmail` is a method on the **admin** surface — see
[GoTrueAdminApi.d.ts:131](../../../node_modules/.pnpm/@supabase+auth-js@2.112.4/node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.d.ts),
read from the installed types rather than recalled. That surface is keyed by the service role key,
which `.ai/standards/rbac-and-security.md` places **nowhere in this repository and nowhere in the
browser**, and names as *"the whole authorization model in a single string"*. ADR-005 leaves no
server to call it from.

So the admin invite path forces a choice the idea does not contain:

- **An Edge Function**, which is precisely the *thin server seam* ADR-005 rejected — and its revert
  condition is *"the first permission requirement that cannot be expressed as an RLS policy without
  duplicating the rule in application code"*. Sending an invite may or may not meet that test; that
  is the operator's call, and it is a call about ADR-005, not only about this idea.
- **Or a different model** — self-serve `signUp` behind an allow-list table, or a claim token the
  admin generates and the joiner redeems — which keeps everything inside row-level security and
  changes what an invitation *is*.

`TODO(verify):` confirm against Supabase's own documentation which invite paths exist without a
service-role key, before the ADR is drafted. `.ai/standards/tech-stack.md` lists the Supabase client
under *versions the model cannot recall*, and this is the exact case that list exists for.

### Proposed feature split — a proposal, not issued

**No row was written to `.ai/registry/features.md`, and no ID exists.** The two halves of triage
disagreed on the split and the disagreement is recorded rather than resolved, because the ADR may
settle it either way: if item 4 above concludes there is no `invitation` entity, one of the proposed
rows disappears; if it concludes there is, that row may split into issuing and redeeming.

- **`product` proposed five `TEA` rows**, in build order: *Sign in and establish the member record*,
  *Invite a member*, *Team member list*, *Remove a member*, *Promote a member to admin*. The last
  three titles are transcribed from the permission table in `.ai/standards/rbac-and-security.md`.
  Deliberately not a sixth: *the first admin*, because a row for it presumes the answer to item 6.
- **`tech-lead-design` proposed three**, on the grounds that the member list is a surface rather than
  a feature and that removal and promotion are one admin screen.

Both readings are defensible and neither is adopted here. The split is settled at re-triage, after
the ADR.

### Two consequences that are decisions-by-default

Both are already true in the registry, and both will read as settled to anyone who does not notice
the marking — `.ai/standards/rbac-and-security.md` lists them as known weakness 6.

1. **Promotion is one-way in v1.** *Demote an admin to member* is denied by default rather than by
   decision, so a member promoted in error can only be un-promoted by removing them from the team.
2. **No permission row exists for reading the member list.** The permission table has fifteen actions
   and none of them is this one. A member's right to see the roster is currently inferred from *"read
   any entry in the team"*, and an inference is not a policy — under ADR-005 somebody has to write
   the `select` policy on `member`, and there is nothing to write it against.

### Open question 3 does not block this idea

Extending INV-04 from the denominator to the numerator — so that a removed member's future entries
leave the absence count — is a **separate registry chore for `/thuki`**, not a blocker here. Removal
in this idea only sets `removed_at`; the numerator is read by the count. It is needed before the
overload warning is built, not before this idea proceeds.

One caveat worth carrying, from `tech-lead-design`: because INV-04 insists there is **exactly one**
implementation of the count — a single function inside the seam, per
[.ai/standards/architecture.md](../../standards/architecture.md) and the *Where invariants are held*
table in `data-model.md` — the amendment changes that one function's filter regardless of which
ticket owns the UI. It cannot be scoped to whichever view happens to be built first.

That amendment needs its own ADR: `.ai/registry/invariants.md` is **not** exempt under ADR-007, which
exempts feature and glossary rows only.

## Re-triage verdict: PROMOTE

**Decided 2026-08-31 by `product` and `tech-lead-design`**, each running its half against the ADR
before reconciling. Both halves returned PROMOTE independently.

Four feature rows were written to `.ai/registry/features.md` under ADR-007 — **TEA-01**, **TEA-02**,
**TEA-03** and **TEA-04**. Each cites this file in `Notes`, which is the only provenance a reviewer
has.

### What changed since the NEEDS-ADR verdict

The earlier verdict stands as written and is not restated; it is the section above, and it failed on a
decision rather than on merit. Three things happened after it:

- **[ADR-009](../../registry/decisions/ADR-009-how-a-person-becomes-a-member.md) was accepted by the
  operator** — a person joins by signing themselves up against an allow-list.
- **`.ai/standards/data-model.md` absorbed it**: open question 4 struck through and answered, and the
  allow-list table added, with its own name flagged as the Tech Lead's to confirm at DESIGN.
- **`.ai/standards/rbac-and-security.md` absorbed it**: three allow-list rows entered the permission
  table, and the file states in words that sign-up itself needs no permission because the trigger is
  the gate.

### The seven items, dispositioned

Five closed, two open, and **neither open item blocks a story being written**.

| # | Item | Disposition |
|---|---|---|
| 1 | How a `member` row comes into existence | **Closed by ADR-009.** A trigger on the auth user, gated on the allow-list, consuming the entry. |
| 2 | Where `display_name` and `avatar` come from | **Open. Not blocking.** Both are still not-null with no default. The field names exist, so nothing is invented; only the source is undecided, and RULE-04 puts that in design section 1. Carried into DESIGN below. |
| 3 | Whether an invited-but-not-signed-in person is a member | **Closed by the updated standards.** An allow-list entry is not a member row, so the INV-04 denominator rises when the person arrives, not when the address is added. |
| 4 | The invitation model, and whether an entity exists | **Closed.** There is an entity and it is an allow-list, not an invitation: an address, the team it admits to, who added it, and whether it has been consumed. No token, no expiry, no link. |
| 5 | Where the invite is sent from | **Dissolved rather than answered, and never actually blocking.** Nothing is sent. |
| 6 | The first-team and first-admin bootstrap | **Open in the standards, resolved here without a new decision.** See *The bootstrap circularity* below. It is a seed step, not a feature. |
| 7 | The name of the `is_admin(uid)` helper | **Open. Not blocking.** `.ai/standards/rbac-and-security.md` says itself that the name waits on migrations, and the first membership ticket creates the first migration. Carried into DESIGN below, with a constraint attached. |

### ADR-009 is the linkable ADR for the migration

`.ai/standards/data-model.md` requires a ticket whose schema delta is anything but none to link an
approved ADR before Definition of Ready, and item 4 of the Definition of Ready table in
`.ai/01-operating-model.md` says the same. The earlier verdict read that as unsatisfiable. It is
satisfied now, and the reasoning is `tech-lead-design`'s: **what was declared blocking was open
question 4 specifically**, and that is exactly the thing ADR-009 removed. The table shapes themselves —
`team`, `member`, `entry` and their columns — were decided by the operator on 2026-08-31 and recorded
in the data model; they were never the open question.

**The ticket links both ADR-005 and ADR-009.** ADR-005 is not decoration on that link: it is what
makes the member's primary key be the auth user's id, and therefore what makes the migration the
security surface rather than a schema convenience.

### The bootstrap circularity, and how it breaks

The allow-list entry records who added it, not-null, against a member — and that member must be an
admin. So the first allow-list row needs an admin, who needs a member row, which needs an allow-list
row. As the model stands, a correctly built product admits nobody, ever. The allow-list also carries
the team it admits to, not-null, against a `team` table that has one row in v1 and no creation path.

**ADR-009 already contains the exit, so no new decision was needed.** Its own consequences record that
a person who signs up before being allow-listed gets an auth user with no member row. That is the
bootstrap:

1. Admin zero signs up. They get an auth user and no member row — the documented state, not a defect.
2. A human applies a seed that inserts the `team` row and one `member` row carrying that user's id
   with the admin role.
3. That admin adds everyone else to the allow-list, and the ordinary flow runs from there.

**No schema change, and specifically not making the who-added-it column nullable.** That would amend
ADR-009's table and would need its own ADR — which is the expensive way to buy something a seed
already provides. Applying the seed is human under RULE-09 either way.

**So the first admin gets no feature row.** It is not a capability the product offers: the charter
names no self-service admin path, and creating one from inside the product would need an
unauthenticated privileged write, which ADR-005 forbids. The marker on TEA-01 records it as
known-incomplete until the seed exists.

### The ADR-008 test, stated although it did not fire

The verdict is PROMOTE, so **no ADR was drafted and none was accepted under an agent's name**. That is
worth recording rather than leaving silent, because two paths through this idea would have changed the
envelope rather than worked inside it, and both were available:

- **An Edge Function holding the service-role key**, so that a real invitation email could be sent.
  That supersedes ADR-005, which is the case where `.claude/commands/triage.md` says an agent stops and
  asks rather than deciding.
- **Making the who-added-it column nullable** to break the bootstrap circularity. That amends ADR-009's
  table, an accepted decision, one day old.

Neither was taken, and neither had to be. **Avoiding both is why this is PROMOTE rather than a second
NEEDS-ADR.**

### The split: a disagreement resolved, not a consensus

The two halves did not agree. `product` proposed five rows and `tech-lead-design` proposed three, as
recorded in the earlier verdict; at re-triage `product` held at five and `tech-lead-design` held at
three. It resolved to **four**, and both movements are recorded because a split presented as
agreement hides which argument won:

- **Removal and promotion merged into one row.** `product` had offered this concession conditionally
  and `tech-lead-design` held, so it was taken: they are one admin screen and one policy surface. The
  argument against — two permission rows, and INV-04 engaged by only one of them — is real and is
  answered by the merged row carrying INV-04.
- **The roster stayed its own row**, against `tech-lead-design`'s reading. They dropped the original
  reason for merging it — that a member list is a surface rather than a feature — and conceded that it
  needs its own select policy. What remained was a screen-shaped argument against a cited one: the
  roster is the only row carrying the unresolved read-the-member-list permission gap, and folding it
  into removal would hide that gap inside a story about something else.
- **The invite row was retitled, not deleted.** ADR-009 did not collapse it; it moved it and made it
  larger. *Invite a member* no longer describes anything the product does — TEA-02 is allow-list
  management, over three permission rows and a table of its own.

### Invariants engaged

- **INV-07, directly.** Every member row carries its team from the first migration, and the allow-list
  entry is what fixes which team a joiner lands in.
- **INV-04, through the denominator.** Admission raises the current member count; removal lowers it,
  and because team size is read at evaluation time, removing somebody changes the absence count for
  past dates. That consequence is already accepted in the INV-04 note.
- **INV-01, INV-02, INV-03, INV-05 and INV-06 — not engaged.** None of these four rows writes an
  `entry`. Stated rather than left blank, per the warning in `.ai/registry/invariants.md` that
  concluding no invariant is engaged is where the reasoning is usually skipped.

### Out of scope, added at re-triage

Four additions, all consequences of ADR-009:

- **The invitation email.** There is none. The story must say so rather than implying one arrives.
- **A join link, a claim token, or any expiring invitation.** The brief's *"qua email hoặc link"* is
  satisfied by neither: the address itself is the gate. The claim-token shape survives only as
  ADR-009's revert condition.
- **Any Edge Function or service-role key path**, including Supabase's admin invite method. Reaching
  for it requires superseding ADR-005 on its own terms first.
- **Demoting an admin.** Denied by default rather than by decision. Named explicitly now that
  promotion becomes half of TEA-04, so the pair does not read as symmetric.

### Carried into DESIGN rather than settled here

Three items, from `tech-lead-design`, each with its verification marker intact. None is a registry
question; all three are design section 1 under RULE-04.

1. **`display_name` and `avatar` ride in on sign-up's metadata** and reach the trigger as the auth
   user's raw metadata. The client half is confirmed against the installed types — the sign-up
   credentials accept a data object, `GoTrueClient.d.ts:456`, typed at `lib/types.d.ts:548`.
   `TODO(verify):` the server half is unverifiable here, because no Supabase project is provisioned
   and the column the trigger reads cannot be inspected. Confirm before writing the trigger.
2. **The admin-rank helper must be `security definer stable` with a pinned `search_path`.** Without
   `security definer` a select policy on the member table that calls it recurses under row-level
   security — the policy calls the function, the function reads the table, the table applies the
   policy. `TODO(verify):` the exact declaration against the PostgreSQL major, which is on the
   past-reliable-recall list in `.ai/standards/tech-stack.md`.
3. **The allow-list address being case-insensitive requires the `citext` extension.**
   `TODO(verify):` unverified against a hosted Supabase project. If it is unavailable, the fallback is
   a lowercase-normalising constraint, which is a different column definition and not a rename.

### One story-level residual for TEA-01

**If Supabase's email confirmation is on, the auth user — and therefore the member row — exists before
the address is confirmed.** The denominator then rises for somebody who may never arrive, which is
INV-04 being fed by a person who is not on the team.

Both fixes sit inside ADR-009 and neither needs an ADR: fire the trigger on insert, or fire it on the
update that sets the confirmation timestamp. **The story needs an acceptance criterion pinning which**,
because the two behave identically in a project with confirmation switched off and differently in one
without.

### Two steward chores, recorded and not fixed

Both are in `.ai/standards/rbac-and-security.md`, which is human plane. Neither blocks these rows.

1. **The permission table still carries an *Invite a member* row**, which after ADR-009 is the same act
   as *Add an address to the allow-list*. One capability under two names in one table is the shape of
   a permission that gets implemented twice.
2. **The permission table carries no read-the-member-list row at all.** Not denied — absent. Under
   ADR-005 somebody has to write the select policy on the member table, and there is nothing to write
   it against. This is the marker on TEA-03.

**The INV-04 numerator amendment remains a separate chore**, exactly as the earlier verdict recorded:
it is needed before the overload warning is built, not before this idea proceeds, and it needs its own
ADR because the invariants ledger is not exempt under ADR-007.

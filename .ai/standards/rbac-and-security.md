---
doc_version: 5
last_updated: 2026-11-04
governed_by: [RULE-01, RULE-02, RULE-09]
---

# Roles, permissions and security

Design section 2 gates against this file and review check R6 compares an implementation to it.

## Roles

Three, in rank order. The rank is what a permission helper compares, and it is what makes the model
testable — two unrelated role names are not comparable, two ranks are.

| Rank | Role | The difference from the rank below |
|---|---|---|
| 1 | `member` | The baseline. Writes their own entries, reads everyone's. |
| 2 | `manager` | A member who also **decides another member's entry** — approve or reject — on a team where they hold `team_role = 'manager'`, and their own entry too (ADR-073 decision 3, recorded as `self_approved`); and does nothing else a member cannot. No calendar, no roster, no threshold. *Until 2026-11-03 (MIR-14): "Not their own entry".* |
| 3 | `admin` | A manager who also decides the rest — the holiday calendar, who is in the team, and the threshold — who may edit any entry rather than only their own, and who may approve their own. |

There is no fourth rank, no owner, and no billing role. `.ai/00-charter.md` carries the same three
and is the authority on what the product is; this file is the authority on what each may do.

**`system_admin` is not a rank on this table.** It is a separate account in `public.system_admin`
([ADR-074](../registry/decisions/ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md)),
holds no member row, and the database treats it as one only at `aal2` through
`public.is_system_admin()`. Until MIR-16 it holds no right on any table in this file. *Added
2026-11-04 by MIR-18.* Since MIR-18-b, a system admin lists, creates and edits orgs through
`list_orgs`, `create_org` and `update_org`, each refusing unless `is_system_admin()` is true;
`create_org` copies Org public's holidays into the new org
([ADR-075](../registry/decisions/ADR-075-a-system-admin-manages-orgs-through-three-aal2-gated-rpcs.md)).
That is its only right on any table in this file until MIR-16.

**RANK 2 WAS ADDED 2026-09-12 BY [ADR-035](../registry/decisions/ADR-035-a-third-role-manager-decides-entries-and-nothing-else.md),
AND THE `manager` COLUMN BELOW IS MOSTLY DEFAULTS.** The operator decided one cell — approve or
reject another member's entry. Every other `❌` in that column is this file's standing convention
applied, not an answer anybody gave, and each is marked `·` so the two can be told apart. Widening
one is a decision, not a bug fix.

**`public.is_admin` DOES NOT ANSWER TRUE FOR A MANAGER, AND THAT IS THE MECHANISM RATHER THAN AN
OVERSIGHT.** Every row below that a manager may not perform is enforced by that helper continuing to
mean `role = 'admin'` exactly. The widening lives in a second helper, `public.may_decide`, used by
the decision guard alone.

## The permission table

Both directions. A table listing only what each role may do cannot be tested for what it must not do,
and the permission-model test in [testing-standards.md](testing-standards.md) requires the denials.

A `·` in the `manager` column marks a denial that is this file's DEFAULT rather than an answer the
operator gave — see the note under § *Roles*. A bare `❌` there is a denial that was decided, and a
`✅` is the one cell ADR-035 settled.

| Action | `member` | `manager` | `admin` |
|---|---|---|---|
| Read any entry in the team | ✅ | ✅ | ✅ |
| Create an entry for themselves | ✅ | ✅ | ✅ |
| Create an entry on behalf of another member | ❌ | ❌ · | ❌ **not decided — denied until it is** |
| Edit or delete their own entry | ✅ | ✅ | ✅ |
| Edit or delete another member's entry | ❌ | ❌ **decided — ADR-035 § Rationale** | ✅ |
| Approve or reject another member's entry | ❌ | ✅ **ADR-035** | ✅ |
| Approve or reject their own entry | ❌ | ✅ **decided — ADR-073 decision 3**, recorded as `self_approved` *(was ❌ under ADR-035 § Decision item 3 until MIR-14)* | ✅ |
| Read the name and teams of an entry's owner, for an entry they may decide | ❌ | ✅ **ADR-073 decisions 1 and 8** — `list_entry_owners`, filtered by `may_decide_entry` (MIR-14-b) | ✅ **ADR-073 decisions 1 and 8** — on a team they share with the owner (MIR-14-b) |
| Read the holiday calendar | ✅ | ✅ | ✅ |
| Add, edit or delete a holiday or swap day | ❌ | ❌ · | ✅ |
| Read the member list | ✅ | ✅ | ✅ |
| Remove a member | ❌ | ❌ · | ✅ |
| Promote a member to manager | ❌ | ❌ · | ✅ **ADR-035 § Decision item 6** |
| Promote a member or a manager to admin | ❌ | ❌ · | ✅ |
| Demote an admin to member | ❌ | ❌ · | ❌ **not decided — denied until it is** |
| Demote a manager to member | ❌ | ❌ · | ✅ **ADR-035 § Decision item 6** |
| Read the list of pending sign-ups | ❌ | ❌ · | ✅ |
| Approve a sign-up onto the approving admin's own team | ❌ | ❌ · | ✅ |
| Reject a sign-up | ❌ | ❌ · | ✅ |
| Re-decide somebody already approved onto a team | ❌ | ❌ · | ❌ **not decided — denied until it is** |
| Read the overload threshold | ✅ | ✅ | ✅ |
| Set the overload threshold | ❌ | ❌ · | ✅ |
| Read their own notifications (EVT-04) | ✅ | ✅ | ✅ |
| Read, count or mark another person's notifications | ❌ | ❌ | ❌ **ADR-050 decision 4 — no admin clause** |
| Mark their own notifications read | ✅ | ✅ | ✅ |
| Change any column of a notification other than `read_at` | ❌ | ❌ | ❌ |
| Insert or delete a notification | ❌ | ❌ | ❌ **ADR-050 decision 2 — only the database's triggers write** |
| Be notified of an event they cannot read, or of their own action | ❌ | ❌ | ❌ **ADR-050 decisions 3 and 5** |
| Turn their own event email on or off (EVT-05) | ✅ | ✅ | ✅ |
| Change another person's event email switch | ❌ | ❌ | ❌ **by name — `set_event_email` takes no member id; no column grant exists** |
| Write `member.event_email_enabled` with a plain update, own row included | ❌ | ❌ | ❌ **no `update` grant on the column — only `set_event_email` writes it** |
| Change their event email switch once removed | ❌ | ❌ | ❌ |
| Cause an email to someone | only through a write that writes them an email-kind notification, or (EVT-08) by inviting an address to an event they may manage | same | same |
| Call the event email sender (`send-event-email`) | ❌ | ❌ | ❌ **ADR-051 decision 3 — only the database's `email_notification` and (EVT-08, ADR-055 decision 7) `email_invitation` triggers, with the shared secret** |
| Open an event they created to guests (EVT-06) | ✅ | ✅ | ✅ |
| Open someone else's event to guests | ❌ | ❌ **as a manager, nothing — `may_manage_event` is `is_admin`, never `may_decide`** | ✅ **ADR-052 decision 1** |
| Close an event's guest link | own event only | own event only | ✅ any |
| Read an event's guest link (the token) | own event only | own event only | ✅ any **— 01-plan.md AC-3: never to a reader who may not manage it** |
| Choose a guest link's token, or the time it was opened | ❌ | ❌ | ❌ **column grant `insert (event_id)` only; no `update` grant** |
| Open, close or read a guest link once removed or no longer approved | ❌ | ❌ | ❌ |
| Read an open event's public fields and attendee names, with its token | ✅ | ✅ | ✅ **— and signed out; see below** |
| Read anything through a token that is not an open event's | ❌ | ❌ | ❌ |
| List open events, or learn whether an event exists, through the guest reads | ❌ | ❌ | ❌ **ADR-052 § Consequences — both reads take only a token** |
| Learn the event id behind an open guest link (EVT-13) | only for an event they can read | same as member | ✅ any open link **`guest_link_event_id(text)` — granted to `authenticated` only; returns `event_id` only when `may_read_event(event_id, auth.uid())`, and null for "no such open link" and "not a reader" alike (ADR-061 decision 8)** |
| Register on an event through its open guest link (EVT-07) | ✅ | ✅ | ✅ **— and signed out; `register_guest`, the only door: no role holds an insert grant on `event_guest`** |
| Register through any other token, or choose a registration's state, manage token or event | ❌ | ❌ | ❌ **`register_guest` takes none; `event_guest_guard` sets the state** |
| Read one's own registration, or cancel it while registration is open, with its manage token | ✅ | ✅ | ✅ **— and signed out; `get_guest_registration`, `cancel_guest_registration`** |
| Read attending guests' names and states, of an event they can read | ✅ | ✅ | ✅ **`event_guest_select_visible`; never signed out except through the guest page** |
| Read pending, rejected, removed or cancelled guests | own event only | own event only | ✅ any |
| Read guests' emails | own event only | own event only **— as a manager, nothing more** | ✅ any **`list_event_guest_emails` — `may_manage_event`, never `may_decide` (ADR-052 decision 7)** |
| Read a manage token, or its hash | ❌ | ❌ | ❌ **column grant; only the SHA-256 is stored, and `register_guest` returns the token once** |
| Approve, reject or remove a guest | own event only | own event only | ✅ any **`event_guest_update_manage`; column grant `update (status)`** |
| Set a guest's state to cancelled, or change their name, email or event | ❌ | ❌ | ❌ **the update policy's `with check`; only the manage link cancels** |
| Delete a guest registration | ❌ | ❌ | ❌ **ADR-052 decision 8 — no delete grant; deleting the event sets `event_id` null** |
| Invite addresses by email to an event of any scope (EVT-08, EVT-12) | own event only | own event only **— as a manager, nothing more** | ✅ any **`invite_to_event` — `may_manage_event` (42501); no scope check since EVT-12 (ADR-061 decision 1). ADR-055** |
| Add a member who cannot read an Own team or Limited people event to its people, by inviting their address (EVT-12) | own event only | own event only | ✅ any **`invite_to_event`, team/named branch, after `may_manage_event`; on an Own team event this converts it to `named`, naming its team as it stands without the creator, and notifies nobody but the added member (ADR-061 decisions 2–4)** |
| Add a member, or convert the scope, by inviting to a public event | ❌ | ❌ | ❌ **`invite_to_event`'s public branch reads no member and writes no `event_invitee` (EVT-12 AC-12)** |
| Suppress a notification, or choose who a conversion names | ❌ | ❌ | ❌ **the transaction-local `calechip.event_conversion` is set and cleared inside `invite_to_event` only; no function in `public` takes a setting name (EVT-12 § 3)** |
| Open an event to guests by inviting by email | own event only | own event only | ✅ any **`invite_to_event`, after the same two checks — EVT-06's opener by a new path (ADR-055 decision 2)** |
| Insert, update or delete an email invitation row directly | ❌ | ❌ | ❌ **no insert, update or delete grant on `event_email_invitation`; nothing deletes a row (Q9-A)** |
| Choose an invitation's guest token, inviter, time, or which mail is sent | ❌ | ❌ | ❌ **`invite_to_event` takes none; the table's defaults and `email_invitation()` decide** |
| Read an event's invited addresses | own event only | own event only | ✅ any **`event_email_invitation_select_manage` — `may_manage_event`, never `may_decide`** |
| Learn whether an invited address is a member's, on a public event | ❌ | ❌ | ❌ **ADR-055 revert condition 1 — no column, return or read carries it; only the `email_invitation()` trigger looks it up** |
| Learn whether an invited address is a member's, on an Own team or Limited people event | own event only, from the event's people | own event only | ✅ any **not from `invite_to_event`'s answer (`sent`/`ignored` only); from `event_invitee_select_manage`, unchanged — ADR-061 decision 5** |
| Invite by email, or read invitations, once removed or no longer approved | ❌ | ❌ | ❌ |

**Signed out — the `anon` role (EVT-06, EVT-07, ADR-052).** A caller holding only the public anon
key, no session, may call exactly six functions, all `security definer`, each taking a token and
returning a fixed column list: `get_guest_event(text)` and `list_guest_event_attendees(text)`
(EVT-06), and `get_guest_event_terms(text)`, `register_guest(text, text, text)`,
`get_guest_registration(text)` and `cancel_guest_registration(text)` (EVT-07). The last two of those
are the anon role's only writes. None returns a guest's email, a manage token other than the one
`register_guest` just created, a guest's id, or any field of an event beyond EVT-06 AC-12's and the
two of EVT-07 AC-22. Nothing else: no table (`event`, `event_attendance`, `event_invitee`,
`event_guest_link`, `event_guest`, `member`, `entry`, `notification`), no other function —
`list_event_guest_emails` included — and no open or close. No `anon` policy exists on any table, and
none on `public.member` (INV-04). `supabase/migrations/20261009120000_evt06_guest_link.sql` § 4 and
`supabase/migrations/20261009150000_evt07_guest_registration.sql` § 7 hold the grants.
`guest_link_event_id(text)` (EVT-13) is not granted to `anon`: a signed-out caller holding a token
never learns the event id behind it (`supabase/migrations/20261015090000_evt13_guest_link_event_id.sql`).

*Amended 2026-10-09 by EVT-07 (01-plan.md AC-21). Read: "may call exactly two functions —
`get_guest_event(text)` and `list_guest_event_attendees(text)` … `supabase/migrations/20261009120000_evt06_guest_link.sql`
§ 4 holds the grants." — false the moment EVT-07's migration is applied.*

**THE TWO ROWS TO READ TWICE ARE THE TWO MARKED `decided`.** *Edit or delete another member's entry*
is denied to a manager because granting it is what the update POLICY would do if it were widened, and
ADR-035 § *Rationale* refuses exactly that: approving is a four-column write, and the row it sits on
carries the entry's dates, type and note. *Approve or reject their own entry* was denied because the
`✅` beside it was decided for `admin` on 2026-08-31 and for nothing else. **MIR-14 reversed it**: the
operator agreed in the multi-tenancy plan (`calechip-multi-tenancy-plan.md:34`) that a manager may
approve their own entry, and ADR-073 decision 3 records it; the database marks such a decision
`self_approved`.

Every row above except the two marked was decided by the operator on 2026-08-31 or is stated in
`.ai/00-charter.md`. The two marked rows are denials by default rather than by decision: a denial
that turns out to be wrong surfaces as a blocked story, which is cheap; a permission that turns out
to be wrong surfaces as data somebody should not have touched.

**Three allow-list rows became three sign-up rows on 2026-09-10, under
[ADR-033](../registry/decisions/ADR-033-a-person-joins-by-signing-up-and-an-admin-decides-afterwards.md).**
Read, add and remove an address are gone with the table; read the queue, approve and reject replace
them. The power is the same one — an admin decides who is on the team — and only the moment moved,
from before the person arrives to after. **The fourth row is new and is a denial by default, not a
decision:** the `member_decide_admin` policy admits only rows with no team and `status = 'pending'`,
so an approval cannot be taken back through this surface, and nothing has been decided about whether
it should be. *Since 2026-11-07 (MIR-21-f) the policy is dropped. It had been inert since MIR-02
revoked the column grants; a decision is made only through `admit_member` and `reject_member`, which
admit only a pending row with no roster team.*

**Two changes to this table on 2026-08-31, after [ADR-009](../registry/decisions/ADR-009-how-a-person-becomes-a-member.md), kept because they are the record of how the rows above came to exist:**

- **`Invite a member` was removed.** ADR-009 decided that joining happens through the allow-list and
  that no invitation is sent, which left this row meaning exactly what
  `Add an address to the allow-list` already means. Two names for one power is two things to keep in
  agreement, and the charter's invite-a-member language is realised by the three allow-list rows. The
  row is recorded here rather than silently dropped so a reader who remembers it can see where it
  went.
- **`Read the member list` was derived rather than decided, and the operator confirmed it on
  2026-08-31.** The derivation stands and is kept because it is the reasoning, not just the outcome:
  `Read any entry in the team` is already ✅ for a member, and the year view renders one row per
  member, so a member who could not read the member list could still enumerate it from the entries
  they are entitled to read. Denying it would have denied nothing while leaving TEA-03's select
  policy with nothing to be written against.

  It is recorded this way — derived, flagged, then confirmed — rather than quietly promoted to
  settled, because the flag is what made the confirmation possible.

**Signing up is how somebody joins, and an admin decides afterwards**
([ADR-033](../registry/decisions/ADR-033-a-person-joins-by-signing-up-and-an-admin-decides-afterwards.md)).
Sign-up itself needs no permission: the trigger creates a `member` row for anybody who confirms an
address, with no team and `status = 'pending'`. **That row grants nothing.** `public.member_team_ids`
and `public.member_primary_team_id` return a team only for an `approved` member, every team-scoped
policy resolves through one of them (*until 2026-11-07 this named `public.member_team_id`*), and `public.is_admin` carries the same clause — so an undecided person is refused by
all of them at once, and an admin who is later rejected stops being an admin rather than keeping
admin powers over no team.

A member must not read the pending queue: it is a list of people who have asked and not yet been
answered, which is admin information rather than team information. The policy that exposes it is
deliberately **not** team-scoped — a pending member has no team to scope it by — so with more than
one team every admin sees every pending sign-up and may claim one for their own team. Many teams
exist since ADR-039, which widened the claim to any team. Under ADR-059 the queue is bounded by the
org, and MIR-16 re-points it (plan P4-1, *"Re-point the four system-scope groups: sign-up queue, …"*).
*Until 2026-10-13 this read "v1 has one team; ADR-033 names this as the first thing to revisit if a
second is created."*

**Removing a member does not remove their entries.** They stay, and the absence count for past dates
changes because team size is read at evaluation time — the consequence recorded in the INV-04 note in
`.ai/registry/invariants.md`.

**Rejection always carries a reason** (INV-03). It is the one admin action with a mandatory field,
because a rejection with nothing attached gives the member nothing to act on.

## Where the check runs

**In row-level security policies, and nowhere else.**
[ADR-005](../registry/decisions/ADR-005-authorization-in-rls.md).

This is not the usual answer and the reason is in the deployment shape rather than in taste: there is
no server, so the browser holds the user's own token and reaches PostgREST directly. A check written
in the interface — or in the data seam, which also runs in the browser — can be skipped by issuing
the same request from anywhere else. Such a check is an **affordance**: it hides a control the user
cannot use, avoids a pointless round trip, and shows a better message. It is decoration over the
policy, and every one of them carries a comment saying so.

TODO(project): name the SQL helper that performs the rank comparison — something of the shape
`is_admin(uid)` — and cite the migration that defines it, once migrations exist. Until then this
section describes an intent rather than a mechanism, which is the failure the *Known weaknesses*
section below exists to prevent going unrecorded.

## Authentication

**Supabase Auth.** It establishes identity; the policies above decide what that identity may do. No
authentication API is written — ADR-005.

System admins sign in to the panel with a password and a TOTP second factor (Supabase Auth MFA); the
second factor is checked in the database by `is_system_admin()`, not in the panel (ADR-074 decision
4, MIR-18).

**Which surfaces may construct a client:** only `src/lib/data/`, the data-access seam declared in
[architecture.md](architecture.md). A Supabase client constructed anywhere else is a second door into
the data, so this is not left to review — it is the `supabase-client-in-seam` boundary in
[boundaries.json](../registry/boundaries.json), enforced by check D12, and it is what the RULE-02
lint rule will enforce at build time once it is written.

TODO(project): name where the session is read on the client, and what happens on expiry.

## Secrets

| Secret | Where it lives | Who may see it |
|---|---|---|
| Supabase project URL | Build-time environment, prefixed for Vite | Everyone. It ships in the bundle. |
| Anon / publishable key | Build-time environment, prefixed for Vite | Everyone. **It ships in the bundle by design.** |
| Service role key | Nowhere in this repository and nowhere in the browser | Nobody, in normal operation |

**The anon key being public is not a leak, it is the design.** It identifies the project, not the
user; what it may do is decided entirely by the policies. This is worth stating because it looks
alarming and is not, and because the thing that *is* alarming sits next to it.

**The service role key bypasses row-level security entirely.** Under ADR-005 that is not one control
among several — it is the whole authorization model in a single string. It must never be committed,
never be prefixed for Vite, and never be present in a browser build.

TODO(project): Vite exposes only variables prefixed `VITE_`, so an unprefixed name cannot reach the
bundle by accident. Confirm the exact prefix against the installed Vite major before writing it into
config — the major in use is on the *past reliable recall* list in
[tech-stack.md](tech-stack.md).

## Known weaknesses

The controls that are weaker than they read. A permission held **by intent rather than by a control**
is the most expensive kind of documentation error, because every downstream reader assumes a
guarantee.

1. **Row-level security is not the last line of defence. It is the only one.** The anon key is public
   and the endpoint is reachable without this application, so there is nothing behind a policy. A
   policy written too permissively **fails open and silently** — no error, no log, just data that
   should not have been returned. The only thing that catches it is the permission-model test
   asserting the denials; a test asserting only the allowed cases stays green after the policy is
   deleted.

2. **`.gitignore` does not ignore `.env` or `.env.local`.** Operator decision, 2026-08-31, taken
   after the exposure was raised. Any file with those names is one `git add -A` away from the remote,
   and a service-role key published to a remote is not undone by deleting the file afterwards —
   rotation is the only remedy. Nothing in this repository prevents that; the control is attention.

3. **An admin may edit any member's entry, and v1 records no trace of it.** The change feed is on the
   brief's P1 list, so until it exists an admin's edit to somebody else's entry is indistinguishable
   from that member's own. The entry stops being purely its author's statement, which is a change to
   what the product is — recorded in the charter amendment of the same date.

4. **Approval is not an independent check on an admin's own entries.** Self-approval is permitted, so
   the star on an admin's entry means "an admin said so" and that admin is themselves. This was
   chosen deliberately: with one admin on a small team, forbidding it would leave that person's
   entries permanently unapproved.
   **Since MIR-14 (ADR-073 decision 3) the same holds for a manager's own entries.** The record is
   `entry.self_approved`, set by `entry_enforce_decision()` clause (b) when the approver is the owner
   — for an admin and a manager alike. It records the weakness; it does not close it.

5. **RULE-02's lint rule is not written yet.** Until it is, nothing prevents a component importing
   the Supabase client at build time. D12 reports a manifest or import crossing after the fact and
   review check R4 reads the diff; neither stops the write. The enforcement map in
   [rules.md](../registry/rules.md) says the same thing.

6. **A `WITH CHECK` policy cannot say "this column did not change", and the entry table needs
   exactly that.** `WITH CHECK` sees only the new row; it has no access to the old one. So an update
   policy of the shape `member_id = auth.uid()` — the obvious way to let a member edit their own
   entry — **accepts a raw `PATCH {"status":"approved"}` against that member's own row.** The
   member's own id matches, the predicate passes, and the entry is approved by the person who wrote
   it.

   **Column-level grants do not close this**, and it is worth saying why, because they closed the
   equivalent hole on `team`. There it worked because *nobody* may rename a team, so the privilege
   could simply be withheld. Here member and admin are **the same PostgreSQL role**,
   `authenticated` — the distinction between them lives in the policy predicate, not in the role — so
   a grant that lets an admin write `status` lets a member write it too.

   What actually closes it is a `BEFORE UPDATE` trigger comparing `OLD` and `NEW` and rejecting a
   `status` transition from a non-admin. That is the same shape ADR-016 uses to stop `approved_by`
   being forged, and the same reasoning ADR-005 already accepted when it put INV-02 in a trigger
   rather than a policy.

   **This opens the moment CAL-02 grants a member `update`**, and it was found by both halves of a
   triage independently, on a different idea. Recorded here rather than only on that ticket, because
   it is a property of the authorization model and it will outlive the row that exposed it.

7. **Two permission rows are denials by default rather than by decision** — creating an entry on
   behalf of another member, and demoting an admin. They will read as settled to anyone who does not
   notice the marking.

## Open weaknesses from the multi-tenancy audit (2026-10-12)

Appended 2026-10-12 from [the audit](../board/audits/multi-tenancy-audit-2026-10-12.md) and
[the plan](../board/plans/calechip-multi-tenancy-plan.md). Each carries the MIR item that closes it,
so this list and [the status index](../board/plans/multi-tenancy-status.md) name the same items. The
list above is unchanged; where an entry here bears on one there, it says which. Reproduction steps
for the phase 0 entries are in
[multi-tenancy-audit-2026-10-12-repro.md](../board/audits/multi-tenancy-audit-2026-10-12-repro.md),
not here.

| # | Weakness | Source | Closed by |
|---|---|---|---|
| A1 | **A service role key once committed may still be valid.** The repository does not record a rotation. | `.gitignore:18`; audit §5 | MIR-01 |
| A2 | **A member's own `role`, `status` and `team_id` are not protected by the `member` trigger.** The column grants to `authenticated` and the `member_update_own` policy admit the caller's own row. The comment at `profile_self_update.sql:13-17` is no longer true. | `tea04:29`, `member_approval:173`, `profile_self_update:61-64`, `profile_self_update:117-204`; audit:11-36 | MIR-02 |
| A3 | **`set_member_role` has no team condition, can promote to admin, and records no actor.** | `cross_team_role:92-120`, `supabase.ts:1628-1634`; audit §4 | MIR-03 |
| A4 | **`list_member_directory` returns every member of every team to any member**, and the event-invitee check requires only that the invitee has a team. | `evt01:154-163`, `evt01:215-220`, `evt01:306-311`; audit §2 | MIR-04 |
| A5 | **No test executes SQL or a real policy.** Every isolation assertion runs against the mock, the mock is looser than SQL (`currentAdmin` skips `status === 'approved'`), and one test asserts a refusal its mock does not implement. This is known weakness 1's "only thing that catches it", absent. | `.github/workflows/verify.yml:39`, `:51`, `tests/e2e/seam.setup.ts:17`, `:32`, `mock.ts:366-369`, `tests/signup-confirmation.test.ts:195-211` / `mock.ts:1412`; audit §8 | MIR-05, MIR-06, MIR-07 |
| A6 | **`supabase/db.sql` calls itself the whole schema and is stale** in twelve places, including the old `is_admin` / `member_team_id` bodies without `status = 'approved'`. | `db.sql:1`, `db.sql:317/329`; audit §1 | MIR-08, MIR-09 |
| A7 | **The `security definer` team and member functions trust a client-supplied `p_team_id`, gated only by `is_admin`.** `admit_member` puts a sign-up into any team; `move_member`, `rename_team`, `delete_team` and the three cross-team reads take any team. `public.is_admin(auth.uid())` is the only bound, with no org condition. | `many_teams:53-206`, `cal11:33-65`; audit §4, §5 | MIR-13, MIR-16 |
| A8 | **`setOverloadThreshold` and `setApprovalSettings` send no id** and update every row the policy admits. | `supabase.ts:2135-2140`, `supabase.ts:2374-2379`; audit §2 | MIR-13 |
| A9 | **The sign-up queue is global.** Every admin sees and may decide every pending sign-up — the arrangement § *The permission table* already names as the first thing to revisit once a second team exists. | `member_approval:138-167`; audit §2, §3 | MIR-13, MIR-16 |
| A10 | **Rejection, bulk rejection and auto-approval record no actor, and there is no audit table.** Only `approved_by` and `notification.actor_id` exist. Extends known weakness 3. | `mgr_gen_cols:107-109`, `adm06:73-86`, `approval_settings:102-129`; audit §7 | MIR-14, MIR-20 — **rejection half closed by MIR-14**: `entry.rejected_by` / `rejected_at`, written by the trigger for a single and a bulk rejection alike. Auto-approval's actor and the audit table stay MIR-20's. |
| A11 | **The holiday calendar is one global table that any admin writes.** | `adm02:33`, `adm02:58-59`, `adm03:35-50`; audit §2 | MIR-10, MIR-15, MIR-16 |
| A12 | **An admin reads and manages every event of every team, and a `public` event reaches and notifies every team.** Guest email addresses are readable by any admin through `list_event_guest_emails`. | `evt01:134-142`, `evt02:332-346`, `evt04:154-174`, `evt07:434-442`; audit §2 | MIR-13, MIR-15, MIR-16 |
| A13 | **Issue reports and their images are readable by any admin.** | `issue:108-132`, `issue_img:148-153`; audit §2 | MIR-16 |
| A14 | **Client role checks carry no team, and the router has no role guards.** Affordances only, per § *Where the check runs*, but they are what the interface shows. | `src/lib/roles.ts:24-49`, `src/App.tsx`; audit §3 | MIR-17 |
| A15 | **There is no notion of acting as another identity, and "read-only" is an affordance** (`isReadOnly(viewed)`). | `supabase.ts:1034-1052`, `src/lib/viewed-team.ts:90-92`; audit (f) | MIR-20 |

**One permission row changes under MIR-14.** The plan lets a manager approve their own entry,
recorded as `self_approved = true` (plan:34). Today `mgr_gen_cols:58-61` refuses it, and § *The
permission table* marks the manager's cell of *Approve or reject their own entry* `decided — ADR-035 §
Decision item 3`. Known weakness 4 — the same self-approval, for an admin — then extends to managers,
with the flag as its only record. MIR-14's pull request owes that row, weakness 4 and ADR-035 an
amendment; nothing is amended here.
*Done by MIR-14, 2026-11-03: the row, the `manager` rank line and known weakness 4 are amended above,
and ADR-073 supersedes ADR-035 § Decision item 3.*

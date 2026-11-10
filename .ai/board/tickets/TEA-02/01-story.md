---
ticket: TEA-02
stage: SPEC
agent: ba
produced_at: 2026-08-31T16:56:07Z
branch: feat/TEA-02
inputs_read:
  - .ai/board/tickets/TEA-02/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-009-how-a-person-becomes-a-member.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/board/ideas/2026-08-31-nobody-can-join-the-board.md
  - .ai/board/tickets/TEA-01/01-story.md
  - .ai/board/tickets/TEA-01/02-design.md   # section 4 only, for which policies already exist
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# TEA-02 — Manage the allow-list

## Feature

**TEA-02 — Manage the allow-list**, transcribed from `.ai/registry/features.md`:

> From 2026-08-31-nobody-can-join-the-board.md. The three allow-list rows in rbac-and-security.md —
> read, add, remove — admin only. This is how the charter's invite-a-member power is realised after
> ADR-009. Fixes which team a joiner lands in, through the allow-list entry's team.

Invariant named on that row: INV-07.

## User value

TEA-01 built the door and left it with no handle on the inside. The `allowed_email` table exists, the
trigger admits whoever is on it, and an admin can read it — but nothing can put an address there
except SQL run by hand, which means the only way to let somebody onto the board today is for a person
with database access to do it. This ticket gives the admin the three acts the permission table already
grants them: see who has been let in and who has not yet arrived, add an address, and take one back
off before it is used. It is the whole of the charter's *invite people* power as ADR-009 reshaped it,
and every person who ever joins this board passes through it.

## Acceptance criteria

**AC-1 — an admin sees the allow-list for their own team**
- Given a signed-in admin of team T, and allow-list entries for team T, some consumed and some not
- When they open the allow-list screen
- Then every entry for team T is shown with its address, who added it, when, and whether it has been
  consumed — and entries belonging to any other team are not shown

**AC-2 — an admin adds an address**
- Given a signed-in admin of team T
- When they add `an@example.com` to the allow-list
- Then an entry exists for `an@example.com` with `team_id` T, `added_by` set to that admin, `added_at`
  set, and `consumed_at` null — and it appears in the list of AC-1

**AC-3 — the address the admin adds decides which team the person joins**
- Given an admin of team T adds `an@example.com`
- When that person later signs up and is admitted
- Then their `member` row's `team_id` is T

  *This is the INV-07 half of the feature: a member belongs to exactly one team, and the allow-list
  entry is where that team is fixed. The admission itself is TEA-01's trigger and is not rebuilt here;
  this criterion asserts the value that reaches it.*

**AC-4 — an admin cannot add an address to another team**
- Given a signed-in admin of team T
- When they attempt to create an allow-list entry whose `team_id` is not T, by any route including one
  that does not go through this application's interface
- Then the write is refused

**AC-5 — an address already on the list is refused, disregarding case**
- Given an allow-list entry exists for `an@example.com`
- When an admin adds `an@example.com`, or `An@Example.COM`
- Then no second entry is created, and the admin is told the address is already on the list rather
  than being shown a raw database error

  *`allowed_email.email` is `citext` and is the primary key, so the two spellings are one row — the
  same property TEA-01's AC-4 relies on when it matches at sign-up.*

**AC-6 — an admin removes an address that has not been used**
- Given an allow-list entry for `an@example.com` with `consumed_at` null
- When the admin removes it
- Then the entry no longer exists, it is gone from the list of AC-1, and a person signing up with that
  address is no longer admitted

**AC-7 — an entry that has been used cannot be removed**
- Given an allow-list entry for `an@example.com` with `consumed_at` set
- When the admin attempts to remove it, by any route including one that does not go through this
  application's interface
- Then the write is refused and the entry remains

  *`.ai/standards/data-model.md` calls `added_by` "the only provenance for who let somebody in".
  Deleting a consumed entry destroys that record while leaving the member it admitted in place, so the
  refusal protects a property the standard states in words. It also keeps the address from being
  re-added and re-consumed, which AC-5 and the primary key would otherwise allow after a delete.
  Removing the **member** is TEA-04 and is a soft delete; this criterion does not touch it.*

**AC-8 — a member can do none of the three**
- Given a signed-in person whose `role` is `member`
- When they read, add to, or remove from the allow-list, by any route including one that does not go
  through this application's interface
- Then the read returns no rows and both writes are refused

  *The read half is TEA-01's AC-11 and its policy already exists; it is restated here because this is
  the ticket that builds a screen over it, and a screen is where a denial stops being theoretical.*

**AC-9 — the allow-list screen is not offered to a member**
- Given a signed-in person whose `role` is `member`
- When they use the application
- Then no control leads them to the allow-list screen

  *An affordance over AC-8, in the sense `.ai/standards/rbac-and-security.md` uses the word — it hides
  a control the person cannot use and is decoration over the policy, never the check itself.*

**AC-10 — adding an address sends nothing to it**
- Given an admin adds an address to the allow-list
- When the write completes
- Then the system sends no email and no notification of any kind, and the screen says the admin must
  tell the person themselves

  *ADR-009 *Consequences*, and TEA-01's AC-10. It recurs here because this is the screen where an
  admin will expect an invitation to be sent, and the screen has to say that one is not.*

## Invariants touched

- **INV-07 — one member, one team.** The allow-list entry carries the `team_id` that the admission
  trigger copies onto the `member` row, so this ticket is where that value is chosen. AC-3 asserts the
  result and AC-4 asserts that an admin cannot choose a team that is not their own.

**INV-04 is deliberately not listed.** Adding an address does not change the team's member count —
the count moves when the person signs up and is admitted, which is TEA-01's trigger. The idea file
settled this in its item 3: *"An allow-list entry is not a member row, so the INV-04 denominator rises
when the person arrives, not when the address is added."* Recorded here rather than left silent so
that R8 has the reasoning and does not have to re-derive it.

## Permissions

Against the table in `.ai/standards/rbac-and-security.md`, which already carries all three rows.

| Action | `member` | `admin` |
|---|---|---|
| Read the allow-list | ❌ | ✅ |
| Add an address to the allow-list | ❌ | ✅ |
| Remove an address from the allow-list | ❌ | ✅ |

The admin's ✅ is bounded twice, and both bounds are criteria above rather than notes: to their own
team (AC-1, AC-4) and to entries that have not been consumed (AC-7).

What must not be possible:

- A `member` doing any of the three (AC-8).
- An admin reaching another team's entries in either direction (AC-1, AC-4).
- Anyone deleting the provenance of a member who has already joined (AC-7).
- Anyone editing an entry in place. There is no update policy and this ticket does not add one: an
  address that is wrong is removed and re-added, which leaves `added_by` and `added_at` honest.

## Out of scope

- **The sign-in half of feature TEA-01 — and no ticket exists for it.** TEA-01 shipped as the sign-up
  half after the split recorded in its own story; `useSession`, `SignIn`, `NotOnATeam`, `Home` and the
  session half of the seam were carved out and never ticketed. **Every criterion above begins "given a
  signed-in admin", and today there is no way to sign in.** This ticket does not build it and must not:
  it is the other half of a different feature. It is named here because it is a hard prerequisite for
  TEA-02 being exercisable end to end, and because the board currently shows no row for it.
- **The member list** — TEA-03. This screen lists addresses, not people.
- **Removing a member, and promotion** — TEA-04. AC-7 refuses to delete a consumed entry; what happens
  to the person is that ticket's question, and removal there is a soft delete.
- **Re-admitting somebody who was removed.** The primary key plus AC-7 mean their consumed entry
  stays and their address cannot be re-added. Nothing decides what should happen instead, and nothing
  needs to until TEA-04 exists.
- **Editing an allow-list entry in place.** No update policy, by the decision in *Permissions* above.
- **Validating that an address is well formed** beyond it being non-empty. No standard names a rule,
  inventing one would be inventing an acceptance criterion, and a malformed address is harmless: it
  simply never matches a sign-up. Worth revisiting only if it turns out to confuse admins in use.
- **Choosing which team an entry belongs to.** Exactly one team exists in v1 (glossary, *Team*), and
  AC-4 fixes the entry to the admin's own team, so there is no team picker to build.
- **Any email or notification** (AC-10).

## Open questions

None blocking. Two things this story decided rather than deferred:

- **A consumed entry cannot be removed** — AC-7, reasoned from the data model's own description of
  `added_by`. The alternative, allowing the delete, was not chosen because it destroys the only record
  of who admitted an existing member.
- **No update path** — an entry is removed and re-added rather than edited, so `added_by` and
  `added_at` never describe an act that did not happen.

One thing outside this story that changes how it reaches DESIGN and is not the BA's field to fix:
`ticket.yaml` arrived with `schema_delta: none`, which cannot be right. Every write in this ticket is
denied today — TEA-01 created `allowed_email` with a select policy and no insert, update or delete
policy, and granted `authenticated` only `select` — so AC-2, AC-4, AC-6 and AC-7 all require a
migration that adds policies and grants. **ADR-014 says a migration touching a policy is not `none`.**
The field has been corrected to cite **ADR-009**, which is approved and is the decision that says this
write is an ordinary one: *"An admin adds an email address to an allow-list table. This is an ordinary
write, governed by the same row-level security as everything else."* No new ADR is needed; the
citation was missing, not the decision.

## Changelog

- `2026-08-31T16:56:07Z` — sections 1–8 created. Raised by `ba`. Amended by `ba`.

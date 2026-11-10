---
ticket: TEA-01
stage: SPEC
agent: ba
produced_at: 2026-08-31T09:23:25Z
revision_of: 2026-08-31T09:05:34Z
branch: feat/TEA-01
inputs_read:
  - .ai/board/tickets/TEA-01/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-009-how-a-person-becomes-a-member.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/board/ideas/2026-08-31-nobody-can-join-the-board.md
  - .ai/board/tickets/TEA-01/02-design.md   # the FAIL that routed this ticket back here
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# TEA-01 — Sign up and establish the member record

## Feature

**TEA-01 — Sign up and establish the member record**, transcribed from `.ai/registry/features.md`:

> From 2026-08-31-nobody-can-join-the-board.md. ADR-009: self-serve sign-up against the allow-list, a
> trigger on the auth user that admits and consumes the entry, and **no invitation email** — the story
> says so rather than implying one arrives. A person who signs up before being allow-listed gets an
> auth user with no member row; presenting that state is part of this feature. TODO(project): the
> first-team and first-admin bootstrap is not a capability of this feature — a human applies a seed,
> per the re-triage verdict in the idea file.

Invariants named on that row: INV-04, INV-07.

## User value

Today the board has no door. A person who should be on the team has no way to become a **member**, and
an admin has no way to let them in that does not require a credential the system deliberately does not
have. This ticket builds the door: an address on the allow-list, a sign-up the person performs
themselves, and a `member` row that comes into existence as a consequence. What the admin gains is
control over who joins without any elevated key existing anywhere; what the person gains is the
ability to arrive at all. Every other feature in the TEA group — managing the allow-list, seeing the
member list, removing or promoting somebody — presupposes that a member row can exist, and none of
them can be built until this one is.

## Acceptance criteria

Each AC is observable from outside the system. The refusals are here as first-class criteria, because
under ADR-005 the trigger and the row-level security policies **are** the feature — the interface is
decoration over them, and a criterion that only exercises the interface proves nothing.

**AC-1 — an allow-listed person signs up and becomes a member**
- Given an entry on the allow-list for `an@example.com`, belonging to team T, not consumed
- When a person signs up with `an@example.com` and confirms the address
- Then a `member` row exists whose `id` is that auth user's id, whose `team_id` is T, whose `role` is
  `member`, and whose `removed_at` is null

**AC-2 — the allow-list entry is consumed**
- Given AC-1 has occurred
- When the allow-list entry for `an@example.com` is read
- Then its `consumed_at` is set to the moment the `member` row was created, and the entry no longer
  admits anybody

**AC-3 — a consumed entry does not admit a second person**
- Given the allow-list entry for `an@example.com` has `consumed_at` set
- When a different auth user is created for `an@example.com` — by any route, not only through this
  application's interface
- Then no second `member` row is created, and the existing `member` row is unchanged

**AC-4 — the address matches without regard to case**
- Given an allow-list entry for `an@example.com`
- When a person signs up with `An@Example.COM`
- Then the entry matches, a `member` row is created per AC-1, and that entry is consumed

**AC-5 — an address that is not on the allow-list creates no member**
- Given no allow-list entry exists for `khach@example.com`
- When a person signs up with `khach@example.com`
- Then sign-up succeeds and returns the same result it returns for an allow-listed address, and **no
  `member` row is created**

**AC-6 — moved out of this ticket by the split of 2026-08-31.** It is now the first criterion of
the sign-in ticket described under *Out of scope*, and it reads there exactly as it read here. **The
number is retained and deliberately left as a gap** — `02-design.md` cites AC-6 by name in section 6
and in its split analysis, and renumbering the criteria under a design that is already written would
silently repoint every one of those citations.

**AC-7 — the member row appears only once the address is confirmed**
- Given an allow-listed address and a project with email confirmation switched on
- When the auth user has been created but the address is not yet confirmed
- Then no `member` row exists; and when the address is subsequently confirmed, the `member` row is
  created at that moment

  *This AC pins the residual the re-triage left to the story: fire on the confirmation, not on the
  insert. Two reasons, and both are consequences already recorded elsewhere. First, INV-04's
  denominator is the team's current members, so a person who created an account and never confirmed
  it would raise the absence-count threshold for everybody without ever being on the team. Second,
  AC-5 and the moved AC-6 together tell a signed-in person whether their address is allow-listed;
  requiring
  confirmation first means only somebody who controls the mailbox learns it, which is what keeps AC-5
  from being an address-enumeration oracle. In a project with confirmation switched off the two
  candidate behaviours are indistinguishable, which is exactly why the choice had to be written down
  rather than discovered.*

**AC-8 — the person supplies their own display name and avatar**
- Given a person signing up with an allow-listed address
- When they complete the sign-up form
- Then they have supplied a display name and chosen an avatar, and both are stored on the `member` row
  created in AC-1

  *`display_name` and `avatar` are `not null` with no default in `.ai/standards/data-model.md`, and
  ADR-005 leaves no server to fill them in. Collecting them at sign-up is the only source available.
  The alternative — deriving a name from the address' local part and assigning a default avatar — was
  not chosen because it produces a board of near-identical rows that every member then has to correct,
  and the correction screen does not exist in v1.*

**AC-9 — the new member is never an admin**
- Given any sign-up, allow-listed or not
- When the resulting `member` row is read
- Then its `role` is `member`

**AC-10 — the system sends no invitation email**
- Given an admin adds an address to the allow-list
- When that write completes
- Then the system sends nothing to that address; the admin tells the person by whatever channel the
  team already uses

  *ADR-009 *Consequences*. Recorded as a criterion rather than a note because the idea this feature
  came from assumed an invitation arrives, and a reader who carries that assumption into DESIGN will
  build for it.*

**AC-11 — a member cannot read the allow-list**
- Given a signed-in person whose `role` is `member`
- When they read the allow-list by any route, including one that does not go through this
  application's interface
- Then they receive no rows

**AC-12 — an admin can read the allow-list**
- Given a signed-in person whose `role` is `admin`
- When they read the allow-list
- Then they receive the entries for their own team, consumed and unconsumed alike

**AC-13 — sign-up ends on its own answer, and needs no sign-in to be observed**
- Given a person has completed the sign-up form with an allow-listed address
- When the sign-up call returns
- Then the screen shows a notice telling them to check their email, and it does not redirect to a
  signed-in view

  *Added by the split. It is what makes this ticket exercisable end to end without the sign-in half:
  the operation begins and ends on one screen, and its effect on the data is observable through the
  permission-model test. `02-design.md` verified the mechanism — with email confirmation on, `signUp`
  returns a user and a **null session**, so there is no signed-in view to redirect to.*

## Invariants touched

- **INV-04 — one definition of the absence count.** This ticket does not compute the count, but it
  creates the rows that form its denominator: the threshold is a share of the team's **current**
  member count, so every `member` row created here changes what "overloaded" means for every date,
  past and future. AC-7 exists because of this — an unconfirmed account must not enter the
  denominator.
- **INV-07 — one member, one team.** The `member` row's `team_id` comes from the allow-list entry and
  from nowhere else, so a member belongs to exactly one team from the instant they exist. AC-1 asserts
  it. There is no path in this ticket that creates a member without a team.

## Permissions

Against the table in `.ai/standards/rbac-and-security.md`.

| Action | anonymous | `member` | `admin` |
|---|---|---|---|
| Sign up | ✅ | — | — |
| Read the allow-list | ❌ | ❌ | ✅ |

**Sign-up itself needs no permission, and that is deliberate.** The gate is the trigger, not a policy
on the sign-up call: it refuses to create a `member` row for an address that is not listed, so an
unlisted sign-up produces an auth user that can see nothing. This holds against anybody signing up,
not only against this application's interface.

What each role must **not** be able to do, within this ticket:

- A `member` must not read the allow-list (AC-11), and must not add or remove an address — those
  writes belong to TEA-02 and are admin-only in both.
- Nobody, of either role, may create a `member` row directly. The trigger is the only writer, and a
  direct insert into `member` must be refused — otherwise the allow-list is a suggestion.
- Nobody may set `role` to `admin` through this flow (AC-9). There is no self-service admin path; the
  first admin arrives by seed, which is out of scope below.

## Out of scope

### Carved out by the split of 2026-08-31 — signing in, and the person who is not on a team

`02-design.md` sized this ticket at **L**, fifteen files, against an estimate of **M**, and routed it
back here rather than splitting it itself. This section is that split.

**Re-estimating TEA-01 as L and building it whole — which the design says it would have chosen — is
not reachable.** Definition of Ready item 5 requires `size_estimate` to be S or M, and the Sizing
table says an L ticket must split. An L estimate fails DoR, so the ticket would return to BACKLOG and
never reach DESIGN again. The split is the only path through the gates, and this is worth stating
because the design recommended the other answer.

**What leaves this ticket**, as one whole operation rather than as a layer:

| | |
|---|---|
| Criteria | AC-6 as written above the split, plus a criterion for signing in itself that this story does not write — the ticket that owns the operation writes its own |
| Files, from `02-design.md` section 5 | `src/hooks/useSession.ts`, `src/routes/SignIn.tsx`, `src/routes/NotOnATeam.tsx`, `src/routes/Home.tsx`, a second pass over `src/App.tsx`, and the session half of the seam — `getSession`, `onAuthStateChange`, `signIn`, `signOut` |
| Estimate | S |
| Feature | **TEA-01.** Both halves carry `feature_ids: [TEA-01]`; the split is of the work, not of the capability, and the feature is delivered only when both are DONE |

**The design's objection to its own split, answered rather than inherited.** It observed that a person
who signs up and closes the tab has nowhere to go until the second half lands, and worried that this is
the backend-from-frontend split the model forbids. Two things make it not that. `src/App.tsx` stays in
**this** ticket, so `/signup` is reachable and this half is a running screen rather than a migration
nobody can touch — the design had put `App.tsx` in the second half, which is what left the first one
unexercisable. And the second half is a whole operation with its own end-to-end test: sign in as a
seeded member and land on the board, sign in as an auth user with no member row and land on the
member-less screen. The prohibition exists to stop a ticket reaching QA with nothing to run, and
neither half is in that position.

**This story does not create that ticket.** Shells are created by `product` at `/triage` (ADR-010),
the ID scheme gives splits `-a` and `-b`, and `.claude/hooks/guard-allowed-paths.mjs` scopes every
write on `feat/TEA-01` to this ticket's own folder — so the BA cannot write a sibling ticket's shell
from here even if the model wanted it to. Everything needed to create it is in the table above.

### Out of scope for reasons that predate the split

- **The admin interface for the allow-list** — reading it, adding an address, removing one. That is
  **TEA-02**. This ticket creates the table and the policies AC-11 and AC-12 describe; for testing and
  for the first real joiner, entries are inserted by the seed or by SQL.
- **The member list screen** — **TEA-03**.
- **Removing a member, and promoting a member to admin** — **TEA-04**. `removed_at` exists on the row
  this ticket creates and is always null here.
- **The first team and the first admin.** A human applies a seed. It is not a capability this feature
  offers: the charter names no self-service admin path, and creating one would need an unauthenticated
  privileged write that ADR-005 forbids. Recorded on the TEA-01 row in `.ai/registry/features.md` as
  `TODO(project):` and it stays open after this ticket.
- **Any email this system sends.** Not an invitation (AC-10), and nothing else either. Whether
  Supabase's own confirmation email is enabled is a project configuration, not a feature — AC-7 pins
  the behaviour for both settings.
- **Password reset, changing an address, and deleting an account.** No feature row exists for any of
  them.
- **Demoting an admin.** Denied by default in `rbac-and-security.md` and not decided.
- **Confirming the name `allowed_email`.** `.ai/standards/data-model.md` flags it as the one invented
  name in that file and the Tech Lead's to confirm at DESIGN — RULE-04 lets the name settle there. This
  story deliberately says "the allow-list" everywhere and asserts no table name.
- **Entries, the holiday calendar, the absence count and the threshold.** Nothing in this ticket reads
  or writes them. The INV-04 relationship above is that this ticket changes the denominator's inputs,
  not that it computes anything.

## Open questions

None blocking. Two things this story decided rather than deferred, each recorded where it was decided
so a reader can overturn it with the reasoning in front of them:

- The confirmation-timing residual the re-triage handed to this story — decided in **AC-7**.
- Where `display_name` and `avatar` come from — decided in **AC-8**.

- Whether to split or to re-estimate — decided in **Out of scope** above, and it was not a free
  choice: DoR item 5 makes the re-estimate unreachable.

One thing outside this story that is worth knowing and is not blocking it: `citext` for the
case-insensitive address in AC-4 is `TODO(verify):` against a hosted Supabase project, per the idea
file. If the extension is unavailable, the fallback is a lowercase-normalising constraint. AC-4 states
the behaviour and not the mechanism, so either implementation satisfies it and this does not block
DESIGN.

## Changelog

- `2026-08-31T09:05:34Z` — sections 1–8 created. Raised by `ba`. Amended by `ba`.
- `2026-08-31T09:23:25Z` — **rework, routed here by the DESIGN gate** (`02-design.md`, `gate: FAIL`, `size` L against `size_estimate` M). AC-6 moved out to the sign-in ticket and its number retained as a gap; AC-13 added so this half ends on its own answer; *Out of scope* gained the split and the reasoning for it. Raised by `tech-lead-design`. Amended by `ba`.

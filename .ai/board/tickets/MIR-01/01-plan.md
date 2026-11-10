---
ticket: MIR-01
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-21T15:08:11+07:00
inputs_read:
  - .ai/board/tickets/MIR-01/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-063-mir-is-an-eighth-feature-group.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/plans/multi-tenancy-status.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12-repro.md
  - .ai/board/tickets/MIR-04/01-plan.md
  - .ai/board/tickets/MIR-04/verification.md
  - .ai/standards/tech-stack.md
  - .ai/standards/rbac-and-security.md
  - .gitignore
  - .env.example
  - docs/ops/ci-cd.md
  - .github/workflows/build-image.yml
  - .github/workflows/release.yml
  - supabase/functions/send-event-email/index.ts
  - supabase/migrations/20261009090000_evt05_event_email.sql
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-01 — PLAN

## 1. Problem and scope

**Feature implemented**, transcribed from `.ai/registry/features.md:290`:

> | MIR-01 | The service role key and the anon key are rotated, and the rotation is recorded | MIR |
> PLANNED | |

Plan item P0-1 (`.ai/board/plans/calechip-multi-tenancy-plan.md:67-74`), verbatim:

> - Confirm whether the key committed at `5a29434` is still valid
> - Rotate the service role key and the anon key in Supabase
> - Update every deployment environment and CI secret
> - Verify the old key is rejected
> - Record the rotation date in the repo
>
> Until this is done, every RLS analysis in the audit is moot — that key bypasses all of it.

**Who gains what.** Nobody gains a capability. The **operator** (the person holding the Supabase
project and the GitHub repository) removes one: whoever has read commit `5a29434` today holds a
`SUPABASE_SERVICE_ROLE_KEY` that, under ADR-005, bypasses every row-level security policy — the whole
authorization model (`.gitignore:17-20`). **This repository is public** (`gh repo view`:
`visibility: PUBLIC`, read 2026-10-21) and `5a29434` is still reachable from
`origin/ops/architecture` (`git branch -r --contains 5a29434`), so "whoever has read it" is anyone.
MIR-02, MIR-03 and MIR-04 closed holes in the policies; until this ticket ships, those policies are
skippable with one string.

**This ticket is an operator action with a repository record.** The rotation itself happens in the
Supabase dashboard and the GitHub settings page; no agent holds either credential and none may be
given one. What the loop delivers is the record (`docs/ops/key-rotation.md`), the verification steps
(`verification.md` in this folder, results filled by the operator, as MIR-04 did), and the pointers
from the two files that already speak about the leak. `verification_required: true` — the
`Verified` cell in `.ai/board/plans/multi-tenancy-status.md:53` is filled from the operator's results,
not by any agent.

**Out of scope:**

- **Removing `5a29434` from history or deleting `origin/ops/architecture`.** Irreversible, and it
  does not un-publish anything: a public repository has clones, forks and caches. Rotation is the
  only remedy (`.env.example:4-5`). After rotation the string is dead; whether to delete the branch
  is a separate operator decision with no ticket.
- **Renaming `VITE_SUPABASE_ANON_KEY`** even if the new value is a publishable key rather than a
  legacy anon JWT. A rename touches the workflow, the `Dockerfile`, `.env.example`, `ci-cd.md` and
  the seam; the value is what matters here.
- **Secret scanning in CI** (gitleaks or GitHub push protection). Worth doing; it prevents the next
  leak, this ticket ends the current one. Goes to `/idea`.
- **Rotating `EMAIL_HOOK_SECRET`, `DOCKERHUB_TOKEN`, `DEPLOY_REPO_TOKEN`.** None was in `5a29434`'s
  `.env` per the record at `.gitignore:17-20`, and none is a Supabase API key.
- **`.ai/standards/rbac-and-security.md` § Secrets.** Human-only plane; it is already correct.
- **Any code under `src/`, `supabase/` or `.github/`.** Nothing reads a key by a name that changes.

`size_estimate: S`.

## 2. Acceptance criteria

All ACs are verified manually by the operator against the production Supabase project and recorded
in `.ai/board/tickets/MIR-01/verification.md` — there is no automated path that can hold a key, and
there must not be one. "The old service role key" means the value of `SUPABASE_SERVICE_ROLE_KEY` in
`.env` at commit `5a29434`. "The old anon key" means the value in the `VITE_SUPABASE_ANON_KEY`
Actions secret before rotation (equivalently, the value baked into every image built before it).

**AC-1 — the old key's state before rotation is recorded**
- Given the old service role key, and the rotation not yet performed
- When the operator sends it as both `apikey` and `Authorization: Bearer` to
  `GET <project URL>/rest/v1/member?select=id&limit=1`
- Then the HTTP status is recorded in `verification.md` part 1 as found — a 2xx means the key was
  live until rotation; a 401 means it was already dead. Either answer passes; an empty line does not.

**AC-2 — the old service role key is rejected after rotation**
- Given the rotation performed
- When the AC-1 request is repeated with the old service role key
- Then the response is not 2xx and returns no row, and the status is recorded in part 2.

**AC-3 — the old anon key is rejected after rotation**
- Given the rotation performed
- When the old anon key is sent as `apikey` to `GET <project URL>/auth/v1/settings`
- Then the response is not 2xx, and the status is recorded in part 2.

**AC-4 — production runs on the new anon key**
- Given the new anon (or publishable) key stored in the `VITE_SUPABASE_ANON_KEY` Actions secret
- When `build-image` runs on the merge of this ticket's pull request and the resulting image is
  released (`release`) and deployed through the deployment repository
- Then an existing member signs in to production, the calendar loads with their team's entries, and
  `seam-banner` does not report the mock. The image tag and the time are recorded in part 2.

**AC-5 — the email hand-off still works**
- Given the rotation performed and AC-4 deployed
- When a member invites someone to an event
- Then the invitation email arrives. (It should: the trigger authenticates with the Vault secret
  `event_email_hook_secret`, not a Supabase key — `20261009090000_evt05_event_email.sql:52-54`,
  `send-event-email/index.ts:75`. This AC exists to catch the case where that reading is wrong.)

**AC-6 — a session open across the rotation does not break the app**
- Given a member signed in to production before the rotation
- When they reload the app after AC-4 is deployed
- Then either their session continues or they land on the sign-in screen and can sign in again; the
  app never shows an empty calendar or a seam error instead. Which of the two happened is recorded.

**AC-7 — the rotation is recorded in the repository**
- Given `docs/ops/key-rotation.md` on `main`
- When it is read
- Then it carries one row for this rotation with every field in § 4.1 filled: the date (`YYYY-MM-DD`),
  the keys rotated, the method, who performed it, every place the new value was installed, the first
  image tag built with the new key, and a link to `verification.md`.

**AC-8 — no key is written anywhere (refusal)**
- Given this ticket's branch
- When the operator runs `git grep -c -F "$OLD_SERVICE"`, `git grep -c -F "$OLD_ANON"`, and the same
  for each new value, with the values held only in shell variables
- Then every command finds nothing; and `git diff origin/main -- . | grep -E 'eyJ[A-Za-z0-9_-]{20,}|sb_secret_|sb_publishable_'`
  finds nothing. No key, prefix or fragment of one appears in any file this ticket writes.

**AC-9 — the service role key stays out of CI (refusal)**
- Given the rotation performed
- When the operator runs `gh secret list` and `gh variable list` on this repository
- Then no name carries a service role or secret key, and the list of names equals the table at
  `docs/ops/ci-cd.md:44-51` — rotating does not add a secret.

**Invariants touched: `[]`.** INV-01 to INV-07 are rules about entries and the absence count; no
entry, count or membership is read or written by this ticket.

**Open questions.** None blocking. One non-blocking, settled at the moment of rotation and recorded
in the AC-7 `method` field rather than here:

- **Which rotation path.** `TODO(verify)` against the Supabase dashboard on the day — Supabase is
  past reliable recall. Two paths are known to have existed: (a) rotate the legacy JWT secret, which
  re-issues the anon and service role JWTs together and, as recalled, invalidates every existing
  user session; (b) issue new publishable and secret API keys and disable the legacy keys. Every AC
  above holds for either path, which is why this does not block. If (b) is taken, the publishable
  key goes into the existing `VITE_SUPABASE_ANON_KEY` name (Out of scope: renaming).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No screen changes. The only "layout" originated here is the record's table in § 4.1.

## 3. Permission model

No application role changes. INV-free, policy-free, seam-free.

| Actor | May | Must not |
|---|---|---|
| Operator (Supabase project owner, repository admin) | Rotate the keys; set the Actions secret; release and deploy; fill every `Result` line in `verification.md` and every field of the § 4.1 row | Paste any key value into a file, a commit message, a PR body, an issue, or a chat with an agent |
| `developer` | Write `docs/ops/key-rotation.md` with an empty row to be filled, `verification.md` with steps and empty results, and the two pointers in § 7 | Fill any `Result` line or the date; ask for, read, echo or log a key; run any request against the production project |
| `tech-lead-review` | Check AC-7's structure and AC-8's grep on the diff | Treat empty operator fields as a FAIL of the implementation — they are filled after rotation, before `Verified` (`multi-tenancy-status.md:42-48`) |

Where the check lives: Supabase itself refuses the old keys (AC-2, AC-3). Nothing in this repository
can enforce or bypass that, which is the point.

## 4. Contract

No code signature changes. The contract is the shape of the two files, so the reviewer can check
structure without the values.

### 4.1 `docs/ops/key-rotation.md`

A new, permanent, append-only log. Front-matter and headings exactly:

```markdown
---
doc_version: 1
last_updated: <YYYY-MM-DD>
governed_by: [ADR-005]
---

# Supabase key rotations

Append-only. One row per rotation, newest last. **Never write a key, a prefix of one, or any part of
one here.** Values live in the Supabase dashboard and in the places listed in `installed_in`.

| date | keys_rotated | method | performed_by | installed_in | first_image_built_with_new_key | trigger | verification |
|---|---|---|---|---|---|---|---|
| <YYYY-MM-DD> | service role; anon | <legacy JWT secret rotated, or new publishable/secret keys with legacy disabled> | <name> | Actions secret `VITE_SUPABASE_ANON_KEY`; <each developer `.env.local` updated, or "none"> | `mingming21400/calechip:<tag>` | `SUPABASE_SERVICE_ROLE_KEY` committed at `5a29434` (`.gitignore:17-20`); MIR-01 | [MIR-01 verification](../../.ai/board/tickets/MIR-01/verification.md) |

## Consequences of a rotation

- Every image built before `first_image_built_with_new_key` carries a dead key: rolling back to one
  of those tags produces an app that cannot reach Supabase. Roll forward instead.
- <whether sessions open at rotation time were ended — AC-6's recorded outcome>
```

The developer writes the row with the placeholders above; the operator replaces them. The
`Consequences` section's first bullet is written by the developer as is.

### 4.2 `.ai/board/tickets/MIR-01/verification.md`

Same front-matter shape as `.ai/board/tickets/MIR-04/verification.md:1-9` (`steps_written_by:
developer`, `results_filled_by: operator`), and:

- **Setup** — shell variables only: `SUPABASE_URL`, `OLD_SERVICE`, `OLD_ANON`, `NEW_ANON`, plus a
  note that the old service key is read with `git show 5a29434:.env` **into a variable**, never to
  the terminal (e.g. `OLD_SERVICE=$(git show 5a29434:.env | sed -n 's/^SUPABASE_SERVICE_ROLE_KEY=//p')`).
  The `curl` commands print `-w '%{http_code}'` and `-o /dev/null` — a status, never a body that
  could echo a header.
- **Part 1 — before rotation:** AC-1.
- **Part 2 — after rotation and deploy:** AC-2, AC-3, AC-4, AC-5, AC-6, AC-8, AC-9, in that order.
- Each step: the command, the expected outcome, and an empty `Result:` line.
- A last line: once every `Result` is filled, the operator fills the § 4.1 row and the `Verified`
  cell of MIR-01 in `.ai/board/plans/multi-tenancy-status.md`.

### 4.3 Pointers — one line each, additive

- `.gitignore`, directly under line 20 (`# model. The rule below stops the next commit; …`):
  `# Rotation record: docs/ops/key-rotation.md (MIR-01).`
- `docs/ops/ci-cd.md`, a new bullet appended to the list after the secrets table (after line 63):
  `- **Rotating the Supabase keys** changes the value of \`VITE_SUPABASE_ANON_KEY\`, never the name, and needs a new image — the old key is baked into every earlier one. Each rotation is logged in [key-rotation.md](key-rotation.md).`

## 5. Seam impact

None.

## 6. Schema delta

`none`. No migration, policy, trigger or constraint. `requires_adr: false`.

## 7. allowed_paths

```yaml
allowed_paths:
  - "docs/ops/key-rotation.md"
  - "docs/ops/ci-cd.md"          # one appended bullet, § 4.3
  - ".gitignore"                 # one comment line, § 4.3
  - ".ai/board/tickets/MIR-01/**"
```

`glossary_owed` is `[]`; no glossary row written, `.ai/registry/glossary.md` not listed.

`size: S` (four entries, one new file, two one-line edits). Agrees with `size_estimate`.

**Found while planning, not this stage's to fix:** `ticket.yaml` still carries `feature_ids: []` and
`group: ""`, though `features.md:290` has held the MIR-01 row since ADR-063 and MIR-02..04 had both
fields written by the steward. DoR item 1 (`.ai/01-operating-model.md:405`) requires `feature_ids`
non-empty, so `/next-ticket` will refuse READY until the steward writes `[MIR-01]` and `MIR` — the
same correction MIR-04's `ticket.yaml:6-7` records.

## 8. Rejected alternatives

**Delete `origin/ops/architecture` and rewrite history instead of rotating.** Plausible because it
removes the visible string. Rejected: the repository is public, so the commit has already been
available to every clone, fork and cache, and GitHub keeps unreferenced commits reachable by SHA for
some time. It also leaves the key valid. Rotation is the remedy `.env.example:4-5` already names; the
branch deletion is out of scope and can follow, harmlessly, once the key is dead.

**Record the date only as a comment in `.gitignore`.** Plausible because that is where the leak is
already recorded, and it would be one line. Rejected: a comment holds no method, no verification
link and no second rotation; the next rotation would rewrite a sentence rather than append a row,
and "rotated on X" with no evidence is the same unverifiable claim the audit flagged (audit:721-722).

**Have an agent run the verification `curl` calls.** Rejected outright: it requires handing an agent
the old service role key, which is the exposure this ticket ends.

## Changelog

- 2026-10-21T15:08:11+07:00 — first version. Raised by `tech-lead-design`.

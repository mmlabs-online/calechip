---
ticket: MIR-02
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-20T06:56:56+00:00
purpose: "Manual verification of record for AC-1 to AC-6, until MIR-05 lets pgTAP run them (plan:81; 01-plan.md § 4.7)"
steps_written_by: developer
results_filled_by: operator
---

# MIR-02 — manual verification

**Steps are the developer's; every `Result` line is the operator's.** No result below is filled in
by an agent. Run against the real project — part 1 **before** applying
`supabase/migrations/20261020120000_mir02_member_self_writes.sql`, part 2 **after**. Applying the
migration is human (RULE-09). The pull request links this file.

**No key, token or password is written into this file.** Set them in your shell only.

## Setup — once, in your shell

```
export SUPABASE_URL="https://<project-ref>.supabase.co"
export ANON="<the project's current anon key>"

# An access token for a person, by email and password. Repeat for each account below.
token() {
  curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r .access_token
}
```

Accounts needed — any real ones that fit; write only their **ids** in the results, never an email
or password:

| Name below | What it must be |
|---|---|
| `MEMBER` / `$MEMBER_ID` | approved, not removed, `role = 'member'`, on team A |
| `PENDING` / `$PENDING_ID` | `status = 'pending'`, `team_id` null |
| `ADMIN` / `$ADMIN_ID` | approved admin, on team A |
| `$TEAM_A`, `$TEAM_B` | two existing team ids; `MEMBER` and `ADMIN` are on A |

```
export MEMBER_TOKEN=$(token '<member email>' '<password>')
export PENDING_TOKEN=$(token '<pending email>' '<password>')
export ADMIN_TOKEN=$(token '<admin email>' '<password>')
```

Every request below prints the HTTP status and the body. **Record both as returned.** Refused means
the body's `code` is `42501`.

```
patch() {  # patch <token> <member id> <json>
  curl -s -w '\nHTTP %{http_code}\n' -X PATCH "$SUPABASE_URL/rest/v1/member?id=eq.$2" \
    -H "apikey: $ANON" -H "Authorization: Bearer $1" \
    -H "Content-Type: application/json" -H "Prefer: return=representation" -d "$3"
}
```

The row check after each step, in the SQL editor:

```sql
select id, role, status, team_id from public.member where id = '<id>';
```

## Part 1 — before the migration: the reproduction P0-2 asks for first

**R-1.** An ordinary member makes themselves admin.

```
patch "$MEMBER_TOKEN" "$MEMBER_ID" '{"role":"admin"}'
```

- Expected if the audit finding is real: HTTP 200 and a body whose `role` is `admin`.
- Then the row check on `$MEMBER_ID`.
- **Then put the row back** in the SQL editor — `update public.member set role = 'member' where id = '<MEMBER_ID>';`
  — and run the row check again.

```
Result R-1:   at:            HTTP:      body code/role:
              row role after PATCH:          row role after put-back:
```

## Part 2 — after the migration

Apply the migration, then:

**AC-1 — a member cannot make themselves admin.**
```
patch "$MEMBER_TOKEN" "$MEMBER_ID" '{"role":"admin"}'
```
Expected `42501`; row check: `role` still `member`.
```
Result AC-1:  at:            HTTP:      code:      row role:
```

**AC-2 — a member cannot change their own team.**
```
patch "$MEMBER_TOKEN" "$MEMBER_ID" "{\"team_id\":\"$TEAM_B\"}"
```
Expected `42501`; row check: `team_id` still `$TEAM_A`.
```
Result AC-2:  at:            HTTP:      code:      row team_id:
```

**AC-3 — a pending sign-up cannot admit themselves.**
```
patch "$PENDING_TOKEN" "$PENDING_ID" "{\"status\":\"approved\",\"team_id\":\"$TEAM_A\"}"
```
Expected `42501`; row check: `status` still `pending`, `team_id` still null.
```
Result AC-3:  at:            HTTP:      code:      row status / team_id:
```

**AC-4 — an admin cannot change their own status, team or role through the table.** Three requests:
```
patch "$ADMIN_TOKEN" "$ADMIN_ID" '{"status":"rejected"}'
patch "$ADMIN_TOKEN" "$ADMIN_ID" "{\"team_id\":\"$TEAM_B\"}"
patch "$ADMIN_TOKEN" "$ADMIN_ID" '{"role":"member"}'
```
Expected `42501` for each; row check: unchanged.
```
Result AC-4:  at:            status: HTTP   code      team_id: HTTP   code      role: HTTP   code
              row after all three:
```

**AC-5 — an admin cannot move themselves through `move_member`.**
```
curl -s -w '\nHTTP %{http_code}\n' -X POST "$SUPABASE_URL/rest/v1/rpc/move_member" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"p_member_id\":\"$ADMIN_ID\",\"p_team_id\":\"$TEAM_B\"}"
```
Expected `42501`; row check: `team_id` still `$TEAM_A`.
```
Result AC-5:  at:            HTTP:      code:      row team_id:
```

**AC-6 — nobody writes the three columns through the table, on anybody's row.** The admin, on the
member of their own team:
```
patch "$ADMIN_TOKEN" "$MEMBER_ID" '{"role":"manager"}'
patch "$ADMIN_TOKEN" "$MEMBER_ID" '{"status":"rejected"}'
patch "$ADMIN_TOKEN" "$MEMBER_ID" "{\"team_id\":\"$TEAM_A\"}"
```
Expected `42501` for each; row check: unchanged.
```
Result AC-6:  at:            role: HTTP   code      status: HTTP   code      team_id: HTTP   code
              row after all three:
```

**AC-8 — an admin still rejects a sign-up, through the application.** Signed in as `ADMIN` on the
deployed app, open *Members*, reject a pending sign-up (a disposable one — a rejection is one-way).
Expected: it leaves the list; row check: `status = 'rejected'`, `team_id` null.
```
Result AC-8:  at:            image tag:          row status / team_id:
```

**AC-10 — the member edit panel still saves, through the application.** Signed in as `ADMIN`, open
the edit panel of a member of the admin's own team and save. Expected: the save succeeds and the
member is still on that team.
```
Result AC-10: at:            image tag:          saved:      row team_id:
```

## Not covered here

AC-7, AC-9 and AC-11 are observed through the seam by `tests/member-self-writes.test.ts`, against
the mock. A real-database check of them is welcome but not required by the plan.

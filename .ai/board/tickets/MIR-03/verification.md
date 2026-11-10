---
ticket: MIR-03
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-20T08:09:37+00:00
purpose: "Manual verification of record for AC-1 to AC-11, until MIR-05 lets pgTAP run them (plan:85-86, plan:98; 01-plan.md § 4.7)"
steps_written_by: developer
results_filled_by: operator
---

# MIR-03 — manual verification

**Steps are the developer's; every `Result` line is the operator's.** No result below is filled in
by an agent. Run against the real project — part 1 **before** applying
`supabase/migrations/20261020150000_mir03_bounded_role_changes.sql`, part 2 **after**. Applying the
migration is human (RULE-09). The pull request links this file.

**No key, token or password is written into this file.** Set them in your shell only.

**Part 2 promotes two people to admin, and that cannot be undone from the product** (an admin
cannot be demoted). Use disposable accounts for `MEMBER2`, or be ready to put the row back in the SQL
editor.

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
| `ADMIN` / `$ADMIN_ID` | approved admin, on team A |
| `MEMBER` / `$MEMBER_ID` | approved, not removed, `role = 'member'`, on team A |
| `MEMBER2` / `$MEMBER2_ID` | approved, not removed, `role = 'member'`, on team A — **disposable**: AC-4 promotes them |
| `MANAGER` / `$MANAGER_ID` | approved, not removed, `role = 'manager'`, on any team |
| `OTHER` / `$OTHER_ID` | approved, not removed, `role = 'member'`, on team B |
| `REMOVED_ID` | a member of team A with `removed_at` set |
| `OTHER_ADMIN_ID` | an approved admin on team A other than `ADMIN` |

```
export ADMIN_TOKEN=$(token '<admin email>' '<password>')
export MEMBER_TOKEN=$(token '<member email>' '<password>')
export MANAGER_TOKEN=$(token '<manager email>' '<password>')
```

Every request below prints the HTTP status and the body. **Record both as returned.** Refused means
the body's `code` is `42501`.

```
rpc() {  # rpc <token-or-empty> <function> <json>
  curl -s -w '\nHTTP %{http_code}\n' -X POST "$SUPABASE_URL/rest/v1/rpc/$2" \
    -H "apikey: $ANON" ${1:+-H "Authorization: Bearer $1"} \
    -H "Content-Type: application/json" -d "$3"
}
rank()    { rpc "$1" set_member_role "{\"p_member_id\":\"$2\",\"p_role\":\"$3\"}"; }
promote() { rpc "$1" promote_member_to_admin "{\"p_member_id\":\"$2\"}"; }
```

The two checks after each step, in the SQL editor:

```sql
select id, role, team_id from public.member where id = '<id>';
select * from public.member_role_change order by changed_at desc limit 5;
```

Before part 2, note the newest `member_role_change.id` (none exist before the migration). "No row
added" below means that newest row is unchanged.

## Part 1 — before the migration: the reproduction

**R-1.** An admin of team A sets the rank of a member of team B.

```
rank "$ADMIN_TOKEN" "$OTHER_ID" manager
```

- Expected if the audit finding is real: HTTP 200 and a body whose `role` is `manager`.
- Then the row check on `$OTHER_ID`.
- **Then put the row back** in the SQL editor —
  `update public.member set role = 'member' where id = '<OTHER_ID>';` — and run the row check again.

```
Result R-1:   at:            HTTP:      body role:
              row role after call:          row role after put-back:
```

## Part 2 — after the migration

Apply the migration, then:

**AC-1 — an admin changes a rank on their own team, and both changes are recorded.**
```
rank "$ADMIN_TOKEN" "$MEMBER_ID" manager
rank "$ADMIN_TOKEN" "$MEMBER_ID" member
```
Expected HTTP 200 for both; row check: `role` is `member`, `team_id` unchanged. The record shows two
new rows for `$MEMBER_ID`, newest first: `manager → member` then `member → manager`, each with
`changed_by = $ADMIN_ID` and a `changed_at` from the database.
```
Result AC-1:  at:            HTTP 1:      HTTP 2:      row role / team_id:
              record rows (from_role → to_role, changed_by):
```

**AC-2 — another team's member is refused.**
```
rank "$ADMIN_TOKEN" "$OTHER_ID" manager
```
Expected `42501`; row check: `role` still `member`; no record row added.
```
Result AC-2:  at:            HTTP:      code:      row role:      record row added (y/n):
```

**AC-3 — the rank write refuses `admin`.**
```
rank "$ADMIN_TOKEN" "$MEMBER_ID" admin
```
Expected `42501`; row check: `role` still `member`; no record row added.
```
Result AC-3:  at:            HTTP:      code:      row role:      record row added (y/n):
```

**AC-4 and AC-5 — promotion through the application, with its confirmation.** Signed in as `ADMIN`
on the deployed app, open *Members*.
1. Press *Promote* on `MEMBER2`'s row. Expected: a dialog naming them and saying this cannot be
   undone; nothing changed yet (row check: `role` still `member`).
2. Press *Cancel*. Expected: the dialog closes; row check: `role` still `member`; no record row added.
3. Press *Promote* again, then *Make admin*. Expected: the dialog closes, the roster shows `MEMBER2`
   as admin; row check: `role = 'admin'`, `team_id` unchanged; one new record row
   `member → admin` with `changed_by = $ADMIN_ID`.
```
Result AC-5:  at:            image tag:          after Cancel role:      record row added (y/n):
Result AC-4:  at:            image tag:          dialog named them (y/n):
              row role / team_id:          record row (from → to, changed_by):
```

**AC-6 — promotion on another team is refused.**
```
promote "$ADMIN_TOKEN" "$OTHER_ID"
```
Expected `42501`; row check: `role` still `member`; no record row added.
```
Result AC-6:  at:            HTTP:      code:      row role:      record row added (y/n):
```

**AC-7 — only an admin changes a rank or promotes.** Six requests:
```
rank    "$MEMBER_TOKEN"  "$MEMBER2_ID" manager
promote "$MEMBER_TOKEN"  "$MEMBER2_ID"
rank    "$MANAGER_TOKEN" "$MEMBER_ID"  manager
promote "$MANAGER_TOKEN" "$MEMBER_ID"
rank    ""               "$MEMBER_ID"  manager
promote ""               "$MEMBER_ID"
```
Expected each refused (`42501`, or `401`/`PGRST301` for the two without a token); row checks
unchanged; no record row added.
```
Result AC-7:  at:            member rank:      member promote:      manager rank:      manager promote:
              anon rank:      anon promote:      rows unchanged (y/n):      record row added (y/n):
```

**AC-8 — the row conditions on both paths, one answer each.**
```
rank    "$ADMIN_TOKEN" "$REMOVED_ID"     manager
promote "$ADMIN_TOKEN" "$REMOVED_ID"
rank    "$ADMIN_TOKEN" "$OTHER_ADMIN_ID" manager
promote "$ADMIN_TOKEN" "$OTHER_ADMIN_ID"
rank    "$ADMIN_TOKEN" "00000000-0000-4000-8000-000000000000" manager
promote "$ADMIN_TOKEN" "00000000-0000-4000-8000-000000000000"
```
Expected `42501` for each, with the same `message` for all three `rank` calls and the same `message`
for all three `promote` calls; rows unchanged; no record row added.
```
Result AC-8:  at:            rank messages identical (y/n):      promote messages identical (y/n):
              rows unchanged (y/n):      record row added (y/n):
```

**AC-9 — the record covers the SQL editor, with a null actor, and ignores a no-op.** In the SQL
editor:
```sql
update public.member set role = 'manager' where id = '<MEMBER_ID>';
update public.member set role = 'manager' where id = '<MEMBER_ID>';   -- no change of value
update public.member set role = 'member'  where id = '<MEMBER_ID>';   -- put back
```
Expected: exactly two new record rows for `$MEMBER_ID` — `member → manager` and `manager → member` —
each with `changed_by` null. The middle statement adds none.
```
Result AC-9:  at:            new record rows (from → to, changed_by):
```

**AC-10 — the record cannot be read or forged through the API.** As each of `ADMIN`, `MANAGER` and
`MEMBER`:
```
T="$ADMIN_TOKEN"   # then "$MANAGER_TOKEN", then "$MEMBER_TOKEN"
curl -s -w '\nHTTP %{http_code}\n' "$SUPABASE_URL/rest/v1/member_role_change?select=*" \
  -H "apikey: $ANON" -H "Authorization: Bearer $T"
curl -s -w '\nHTTP %{http_code}\n' -X POST "$SUPABASE_URL/rest/v1/member_role_change" \
  -H "apikey: $ANON" -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -d "{\"member_id\":\"$MEMBER_ID\",\"from_role\":\"member\",\"to_role\":\"admin\"}"
curl -s -w '\nHTTP %{http_code}\n' -X PATCH "$SUPABASE_URL/rest/v1/member_role_change?member_id=eq.$MEMBER_ID" \
  -H "apikey: $ANON" -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -d '{"changed_by":null}'
curl -s -w '\nHTTP %{http_code}\n' -X DELETE "$SUPABASE_URL/rest/v1/member_role_change?member_id=eq.$MEMBER_ID" \
  -H "apikey: $ANON" -H "Authorization: Bearer $T"
```
Expected: every request refused (`42501` / HTTP 401 or 403) or answering `[]`; the record's row count
and contents are unchanged afterwards (SQL editor: `select count(*) from public.member_role_change;`
before and after).
```
Result AC-10: at:            admin select/insert/update/delete:
              manager select/insert/update/delete:
              member select/insert/update/delete:
              row count before / after:
```

**AC-11 — the screen draws rank controls on the own team only.** Signed in as `ADMIN` on the
deployed app, open *Members* with *All teams*. Expected: *Make manager* / *Remove manager* and
*Promote* on team A's rows (as before) and on **no** team B row; *Delete account* unchanged. Signed
in as `MEMBER`: none of the three drawn on any row.
```
Result AC-11: at:            image tag:          admin, team B rows have no rank control (y/n):
              member sees no rank control (y/n):
```

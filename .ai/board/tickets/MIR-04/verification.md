---
ticket: MIR-04
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-21T08:30:00+07:00
purpose: "Manual verification of record for AC-1 to AC-13, until MIR-05 lets pgTAP run them (plan:98; 01-plan.md § 4.7)"
steps_written_by: developer
results_filled_by: operator
---

# MIR-04 — manual verification

**The developer wrote the steps. The operator fills in every `Result` line.** No agent fills in a
result. Run this against the real project: part 1 **before** applying
`supabase/migrations/20261020180000_mir04_scoped_member_directory.sql`, part 2 **after**. A human
applies the migration (RULE-09). The pull request links this file.

**Never write a key, token or password into this file.** Set them in your shell only.

Each step creates its own events and deletes them at the end, so the steps can run in any order.
Everything here can be undone: no role, team or member row is changed.

## Setup, once, in your shell

```
export SUPABASE_URL="https://<project-ref>.supabase.co"
export ANON="<the project's current anon key>"

token() {
  curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r .access_token
}

# The directory as one caller: HTTP status, row count, distinct team names, ids.
dir() {
  curl -s -w '\n%{http_code}\n' -X POST "$SUPABASE_URL/rest/v1/rpc/list_member_directory" \
    -H "apikey: $ANON" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -d '{}' \
    | tee /dev/stderr | head -n1 | jq '{count: length, teams: ([.[].team_name] | unique), ids: [.[].id]}'
}
```

You need these accounts. Any real ones that fit will do. Write only their **ids** in the results,
never an email or a password.

| Name below | What it must be |
|---|---|
| `C` / `$C_ID` | approved, not removed, `role` member or manager, on team T |
| `T2` / `$T2_ID` | approved, not removed, member, on team T, not C |
| `ADMIN` / `$ADMIN_ID` | approved admin |
| `X` / `$X_ID` | approved, not removed, member, on team U |
| `Y` / `$Y_ID` | approved, not removed, member, on team U, not X |
| `Z` / `$Z_ID` | approved, not removed, member, on team U, not X or Y |
| `REMOVED_ID` | a member of team T with `removed_at` set |
| `PENDING` | a pending sign-up (signed up, not yet decided) |

```
export C_TOKEN=$(token '<c email>' '<password>')
export T2_TOKEN=$(token '<t2 email>' '<password>')
export ADMIN_TOKEN=$(token '<admin email>' '<password>')
export X_TOKEN=$(token '<x email>' '<password>')
export Y_TOKEN=$(token '<y email>' '<password>')
export Z_TOKEN=$(token '<z email>' '<password>')
export PENDING_TOKEN=$(token '<pending email>' '<password>')
```

**Before starting part 2, check that no event connects C to X, Y or Z.** They should share no event,
attendance or notification. The simplest way is fresh accounts, or deleting the events that would
connect them.

## Part 1: before the migration (the finding)

**1.1** Run `dir "$C_TOKEN"`.
Expected: HTTP 200, and `teams` holds **every** team's name, U included. Record the count and the
team names.

Result: ____________________

**1.2** In the SQL editor, run
`select policyname, cmd, qual from pg_policies where schemaname = 'public' and tablename = 'member' order by policyname;`
and keep the output for AC-13.

Result: (attach or paste) ____________________

## Part 2: after the migration

**AC-1 and AC-2.** Run `dir "$C_TOKEN"`.
Expected: `teams` is exactly `[<T's name>]`. `ids` holds `$C_ID` and `$T2_ID` and none of `$X_ID`,
`$Y_ID`, `$Z_ID`, `$REMOVED_ID`. Every row has exactly the keys `id, display_name, avatar, team_id,
team_name`.

Result: ____________________

**AC-3.** As X in the app, create a **Limited people** event naming Y only. Run `dir "$C_TOKEN"`.
Expected: `$X_ID` absent. Then as X, create a **Public** event. Run `dir "$C_TOKEN"`.
Expected: `$X_ID` present, with `team_name` = U's name. Delete both events as X.

Result: ____________________

**AC-4.** As T2, create a **Public** event without approval. As Y, join it. Run `dir "$C_TOKEN"`.
Expected: `$Y_ID` present. Delete the event as T2. Then as T2, create a **Public** event with
*requires approval* on. As Y, join it, so the attendance is pending. Run `dir "$C_TOKEN"`. Expected:
`$Y_ID` **absent**. Run `dir "$T2_TOKEN"`. Expected: `$Y_ID` present. Delete the event as T2.

Result: ____________________

**AC-5.** As C, create a **Limited people** event naming Z and T2. Run `dir "$C_TOKEN"`. Expected:
`$Z_ID` present. Run `dir "$T2_TOKEN"`. Expected: `$Z_ID` **absent**. Then, on the same event's page
as C, invite X **by email**. Expected: X appears by name under the event's people, without a reload.
Run `dir "$C_TOKEN"`. Expected: `$X_ID` present. Delete the event as C.

Result: ____________________

**AC-6.** As X, create a **Public** event, so C gets an *event created* notification from X. Then
delete it as X. Run `dir "$C_TOKEN"`. Expected: `$X_ID` present. In the app as C, the bell shows the
notification with X's display name, not *Former member*.

Result: ____________________

**AC-7.** In the SQL editor, find a removed member who created a public event, or a removed member of
T, and record their id. Run `dir "$C_TOKEN"` and `dir "$ADMIN_TOKEN"`. Expected: `$REMOVED_ID` and
the pending sign-up's id absent from both.

Result: ____________________

**AC-8.** Run `dir "$PENDING_TOKEN"`. Expected: HTTP 200 and `count: 0`. Then run it signed out:
```
curl -s -w '\n%{http_code}\n' -X POST "$SUPABASE_URL/rest/v1/rpc/list_member_directory" \
  -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}'
```
Expected: refused, either HTTP 401 or 404 with a `permission denied` body (no `execute` for `anon`).

Result: ____________________

**AC-9.** Run `dir "$ADMIN_TOKEN"`. Expected: `teams` holds every team's name, with the same count as
step 1.1 had for C before the migration, give or take sign-ups decided in between.

Result: ____________________

**AC-10, in the app.** As C, open *New event*, choose **Limited people**. Expected: one group, headed
with T's name. No member of U is offered, even after AC-3 or AC-6 has connected one. As C, create a
Limited people event naming Z by email, open *Edit*. Expected: Z is offered, checked, under a group
headed with U's name. Uncheck Z and save. Expected: the save succeeds. As ADMIN, open *New event*,
choose **Limited people**. Expected: every team's members are offered, as before.

Result: ____________________

**AC-11.** Name a team-U member through the seam. As C:
```
curl -s -w '\n%{http_code}\n' -X POST "$SUPABASE_URL/rest/v1/rpc/save_event" \
  -H "apikey: $ANON" -H "Authorization: Bearer $C_TOKEN" -H "Content-Type: application/json" \
  -d "{\"p_event_id\":null,\"p_name\":\"MIR-04 check\",\"p_description\":null,\"p_location\":null,\"p_start_date\":\"2099-01-01\",\"p_end_date\":\"2099-01-01\",\"p_scope\":\"named\",\"p_invitee_ids\":[\"$X_ID\"]}"
```
(The argument names are those of `save_event` in
`supabase/migrations/20260929140000_evt02_attendance.sql`. If the call returns 404, check the names
there.) Expected: success, and X sees *MIR-04 check* in the app. Repeat with `$REMOVED_ID` in place
of `$X_ID`. Expected: refused with `invalid_event_invitee`. Delete the event as C.

Result: ____________________

**AC-12, in the app.** During AC-3 to AC-6, open as C the event list, each event's detail page and
the notification bell. Expected: the creator, attendee, invitee and actor names show as display
names, never as *Former member*.

Result: ____________________

**AC-13.** Re-run the `pg_policies` query from 1.2. Expected: identical output. Also, as C, run
```
curl -s "$SUPABASE_URL/rest/v1/member?select=id" -H "apikey: $ANON" -H "Authorization: Bearer $C_TOKEN" | jq length
```
before and after. Expected: the same count.

Result: ____________________

-- MIR-07 AC-4, AC-5, AC-6: the mock is no looser than SQL on any permission decision. 01-plan.md § 4.
--
-- THE CASE TABLE BELOW IS THE ONLY COPY. `tests/mock-sql-parity.test.ts` reads this file, takes the
-- text between the two dollar-quote markers and asserts every case against `src/lib/data/mock.ts`;
-- this file asserts the same cases against real SQL. Each side is held to one written table, so a
-- side that moves without the other fails its own suite (01-plan.md § 2, assumption 3).
--
-- Every expected value is written by hand from the SQL definitions — `public.is_admin`,
-- `public.member_primary_team_id` (`20261103120000_mir13_write_path_org_bound.sql:54-64`), and for
-- the own-row writes the grant, the revoke and the trigger of
-- `20261020120000_mir02_member_self_writes.sql` with `member_update_own`
-- (`20260910093000_solo_profile_self_update.sql:66-69`). Never computed, in either test.
--
-- MIR-16-c retired `public.may_decide(uuid)` (ADR-085 decision 1): the SQL-side assertion of the
-- `may_decide` predicate is gone, but the JSON document below keeps the `may_decide` field — it is
-- the mock's predicate, and the mock side is the document's other reader.
--
-- The marker appears exactly twice in this file — at the opening and the closing of the literal —
-- and the vitest side asserts that; do not write it anywhere else, comments included.
begin;
\ir _isolation.psql

create temp table parity as select $parity$
{
  "predicates": [
    { "id": "P-01", "role": "member",  "status": "pending",  "removed": false, "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-02", "role": "member",  "status": "pending",  "removed": false, "on_team": true,  "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-03", "role": "member",  "status": "pending",  "removed": true,  "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-04", "role": "member",  "status": "pending",  "removed": true,  "on_team": true,  "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-05", "role": "member",  "status": "approved", "removed": false, "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-06", "role": "member",  "status": "approved", "removed": false, "on_team": true,  "is_admin": false, "has_team": true,  "may_decide": false },
    { "id": "P-07", "role": "member",  "status": "approved", "removed": true,  "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-08", "role": "member",  "status": "approved", "removed": true,  "on_team": true,  "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-09", "role": "member",  "status": "rejected", "removed": false, "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-10", "role": "member",  "status": "rejected", "removed": false, "on_team": true,  "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-11", "role": "member",  "status": "rejected", "removed": true,  "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-12", "role": "member",  "status": "rejected", "removed": true,  "on_team": true,  "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-13", "role": "manager", "status": "pending",  "removed": false, "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-14", "role": "manager", "status": "pending",  "removed": false, "on_team": true,  "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-15", "role": "manager", "status": "pending",  "removed": true,  "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-16", "role": "manager", "status": "pending",  "removed": true,  "on_team": true,  "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-17", "role": "manager", "status": "approved", "removed": false, "on_team": false, "is_admin": false, "has_team": false, "may_decide": true  },
    { "id": "P-18", "role": "manager", "status": "approved", "removed": false, "on_team": true,  "is_admin": false, "has_team": true,  "may_decide": true  },
    { "id": "P-19", "role": "manager", "status": "approved", "removed": true,  "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-20", "role": "manager", "status": "approved", "removed": true,  "on_team": true,  "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-21", "role": "manager", "status": "rejected", "removed": false, "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-22", "role": "manager", "status": "rejected", "removed": false, "on_team": true,  "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-23", "role": "manager", "status": "rejected", "removed": true,  "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-24", "role": "manager", "status": "rejected", "removed": true,  "on_team": true,  "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-25", "role": "admin",   "status": "pending",  "removed": false, "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-26", "role": "admin",   "status": "pending",  "removed": false, "on_team": true,  "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-27", "role": "admin",   "status": "pending",  "removed": true,  "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-28", "role": "admin",   "status": "pending",  "removed": true,  "on_team": true,  "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-29", "role": "admin",   "status": "approved", "removed": false, "on_team": false, "is_admin": true,  "has_team": false, "may_decide": true  },
    { "id": "P-30", "role": "admin",   "status": "approved", "removed": false, "on_team": true,  "is_admin": true,  "has_team": true,  "may_decide": true  },
    { "id": "P-31", "role": "admin",   "status": "approved", "removed": true,  "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-32", "role": "admin",   "status": "approved", "removed": true,  "on_team": true,  "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-33", "role": "admin",   "status": "rejected", "removed": false, "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-34", "role": "admin",   "status": "rejected", "removed": false, "on_team": true,  "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-35", "role": "admin",   "status": "rejected", "removed": true,  "on_team": false, "is_admin": false, "has_team": false, "may_decide": false },
    { "id": "P-36", "role": "admin",   "status": "rejected", "removed": true,  "on_team": true,  "is_admin": false, "has_team": false, "may_decide": false }
  ],
  "own_update": [
    { "id": "U-01", "subject": "approved_member",  "column": "display_name", "value": "Parity Name", "expected": "allowed" },
    { "id": "U-02", "subject": "approved_member",  "column": "avatar",       "value": "2.png",       "expected": "allowed" },
    { "id": "U-03", "subject": "approved_member",  "column": "role",         "value": "admin",       "expected": "refused" },
    { "id": "U-04", "subject": "approved_member",  "column": "status",       "value": "pending",     "expected": "refused" },
    { "id": "U-05", "subject": "approved_member",  "column": "team_id",      "value": "U",           "expected": "refused" },
    { "id": "U-06", "subject": "approved_member",  "column": "removed_at",   "value": "now",         "expected": "refused" },
    { "id": "U-07", "subject": "approved_manager", "column": "display_name", "value": "Parity Name", "expected": "allowed" },
    { "id": "U-08", "subject": "approved_manager", "column": "avatar",       "value": "2.png",       "expected": "allowed" },
    { "id": "U-09", "subject": "approved_manager", "column": "role",         "value": "admin",       "expected": "refused" },
    { "id": "U-10", "subject": "approved_manager", "column": "status",       "value": "pending",     "expected": "refused" },
    { "id": "U-11", "subject": "approved_manager", "column": "team_id",      "value": "U",           "expected": "refused" },
    { "id": "U-12", "subject": "approved_manager", "column": "removed_at",   "value": "now",         "expected": "refused" },
    { "id": "U-13", "subject": "approved_admin",   "column": "display_name", "value": "Parity Name", "expected": "allowed" },
    { "id": "U-14", "subject": "approved_admin",   "column": "avatar",       "value": "2.png",       "expected": "allowed" },
    { "id": "U-15", "subject": "approved_admin",   "column": "role",         "value": "member",      "expected": "refused" },
    { "id": "U-16", "subject": "approved_admin",   "column": "status",       "value": "pending",     "expected": "refused" },
    { "id": "U-17", "subject": "approved_admin",   "column": "team_id",      "value": "U",           "expected": "refused" },
    { "id": "U-18", "subject": "approved_admin",   "column": "removed_at",   "value": "now",         "expected": "refused" },
    { "id": "U-19", "subject": "pending",          "column": "display_name", "value": "Parity Name", "expected": "allowed" },
    { "id": "U-20", "subject": "pending",          "column": "avatar",       "value": "2.png",       "expected": "allowed" },
    { "id": "U-21", "subject": "pending",          "column": "role",         "value": "admin",       "expected": "refused" },
    { "id": "U-22", "subject": "pending",          "column": "status",       "value": "approved",    "expected": "refused" },
    { "id": "U-23", "subject": "pending",          "column": "team_id",      "value": "U",           "expected": "refused" },
    { "id": "U-24", "subject": "pending",          "column": "removed_at",   "value": "now",         "expected": "refused" },
    { "id": "U-25", "subject": "rejected",         "column": "display_name", "value": "Parity Name", "expected": "allowed" },
    { "id": "U-26", "subject": "rejected",         "column": "avatar",       "value": "2.png",       "expected": "allowed" },
    { "id": "U-27", "subject": "rejected",         "column": "role",         "value": "admin",       "expected": "refused" },
    { "id": "U-28", "subject": "rejected",         "column": "status",       "value": "approved",    "expected": "refused" },
    { "id": "U-29", "subject": "rejected",         "column": "team_id",      "value": "U",           "expected": "refused" },
    { "id": "U-30", "subject": "rejected",         "column": "removed_at",   "value": "now",         "expected": "refused" },
    { "id": "U-31", "subject": "removed",          "column": "display_name", "value": "Parity Name", "expected": "refused" },
    { "id": "U-32", "subject": "removed",          "column": "avatar",       "value": "2.png",       "expected": "refused" },
    { "id": "U-33", "subject": "removed",          "column": "role",         "value": "admin",       "expected": "refused" },
    { "id": "U-34", "subject": "removed",          "column": "status",       "value": "pending",     "expected": "refused" },
    { "id": "U-35", "subject": "removed",          "column": "team_id",      "value": "U",           "expected": "refused" },
    { "id": "U-36", "subject": "removed",          "column": "removed_at",   "value": "now",         "expected": "refused" }
  ]
}
$parity$::jsonb as doc;

select plan(108);   -- 36 predicate rows x 2, and 36 own-row writes. MIR-16-c dropped the
                     -- may_decide assertion each predicate row carried (was x3, plan(144)).
select tests.seed();   -- for team_t and team_u only

-- A case id to its subject's id: P-NN is ...7000+NN, U-NN is ...7100+NN. Every case has a row of
-- its own, so an allowed write in one case cannot change another case's starting state.
create function tests.parity_id(p_case_id text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('00000000-0000-4000-8000-00000000'
          || (case left(p_case_id, 1) when 'P' then 7000 else 7100 end
              + substr(p_case_id, 3)::int)::text)::uuid;
$$;

-- One subject, inserted as the session user. email_confirmed_at stays null, as in tests.seed(), so
-- admit_allow_listed_member admits nobody.
create function tests.parity_subject(p_case_id text, p_role text, p_status text, p_removed boolean,
                                     p_on_team boolean) returns void
  language plpgsql security invoker set search_path = '' as $$
begin
  insert into auth.users (id, email)
  values (tests.parity_id(p_case_id), lower(p_case_id) || '@mir07.test');
  insert into public.member (id, display_name, avatar, role, status, removed_at, email)
  values (tests.parity_id(p_case_id),
          p_case_id, '1.png',
          tests.member_role(p_role), p_status::public.member_status,
          case when p_removed then now() end,
          lower(p_case_id) || '@mir07.test');
  -- MIR-21-f: a member has no team column; the team is the membership row. The seed's teams and
  -- these members are both in the shared tenant, so no org_id is named.
  if p_on_team then
    perform tests.put_on_team(tests.parity_id(p_case_id), tests.id('team_t'),
                              tests.team_role_for(p_role));
  end if;
end;
$$;

select tests.parity_subject(c->>'id', c->>'role', c->>'status', (c->>'removed')::boolean,
                            (c->>'on_team')::boolean)
  from parity, jsonb_array_elements(doc->'predicates') c;

-- The own-update subjects of 01-plan.md § 4.2: the three approved ones on T with their role; pending
-- and rejected as a member with no team; removed as an approved member on T, removed.
select tests.parity_subject(c->>'id', s.role, s.status, s.removed, s.on_team)
  from parity, jsonb_array_elements(doc->'own_update') c
  join (values
    ('approved_member',  'member',  'approved', false, true),
    ('approved_manager', 'manager', 'approved', false, true),
    ('approved_admin',   'admin',   'approved', false, true),
    ('pending',          'member',  'pending',  false, false),
    ('rejected',         'member',  'rejected', false, false),
    ('removed',          'member',  'approved', true,  true)
  ) as s(subject, role, status, removed, on_team) on s.subject = c->>'subject';

-- Runs one own-row write as the subject, with their own JWT, and answers 'allowed' or 'refused'.
-- 'allowed' only if one row was affected AND the column reads back the new value. 'refused' on zero
-- rows or SQLSTATE 42501, and only after checking, as the session user, that the row is unchanged —
-- otherwise 'refused, but the row changed', which fails the assertion. Any other error is re-raised.
create function tests.parity_own_update(p_case jsonb) returns text
  language plpgsql security invoker set search_path = '' as $$
declare
  v_id     uuid := tests.parity_id(p_case->>'id');
  v_column text := p_case->>'column';
  v_value  text := case
                     when p_case->>'value' = 'U' then tests.id('team_u')::text
                     when p_case->>'column' = 'role' then tests.member_role(p_case->>'value')::text
                     else p_case->>'value'
                   end;
  v_before jsonb;
  v_after  jsonb;
  v_n      bigint := 0;
begin
  select to_jsonb(m) into v_before from public.member m where m.id = v_id;

  perform tests.authenticate_as(v_id);
  begin
    if v_column = 'removed_at' then
      execute format('update public.member set removed_at = now() where id = %L', v_id);
    else
      execute format('update public.member set %I = %L where id = %L', v_column, v_value, v_id);
    end if;
    get diagnostics v_n = row_count;
  -- MIR-21-f: the six team_id cases are still the attack, a PATCH naming the column, and it is
  -- still refused: now because the column does not exist (42703), and the row check below holds.
  exception when insufficient_privilege or undefined_column then
    v_n := 0;
  end;
  perform tests.clear_authentication();

  select to_jsonb(m) into v_after from public.member m where m.id = v_id;

  if v_n = 1 and (case v_column
                    when 'removed_at' then v_after->>'removed_at' is not null
                    else v_after->>v_column = v_value
                  end) then
    return 'allowed';
  end if;
  if v_n = 0 and v_after = v_before then
    return 'refused';
  end if;
  return 'refused, but the row changed';
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- AC-5. The three shared predicates, one assertion each per row.
select is(public.is_org_admin(tests.parity_id(c->>'id'), public.member_org_id(tests.parity_id(c->>'id'))), (c->>'is_admin')::boolean,
          format('AC-5 %s: is_admin', c->>'id'))
  from parity, jsonb_array_elements(doc->'predicates') c;
select is(public.member_primary_team_id(tests.parity_id(c->>'id')) is not null, (c->>'has_team')::boolean,
          format('AC-5 %s: member_primary_team_id is not null', c->>'id'))
  from parity, jsonb_array_elements(doc->'predicates') c;

-- AC-6. Each subject writes one column of their own row, as `authenticated`.
select is(tests.parity_own_update(c), c->>'expected',
          format('AC-6 %s: %s writes own %s', c->>'id', c->>'subject', c->>'column'))
  from parity, jsonb_array_elements(doc->'own_update') c;

select * from finish();
rollback;

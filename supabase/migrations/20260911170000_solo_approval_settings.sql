-- SOLO, 2026-09-11. Whether each entry type waits for an admin's approval — per team, set by an admin.
--
-- The operator: *"WFH_NEED_APPROVE và PTO_NEED_APPROVE. nếu WFH_NEED_APPROVE = true: thì khi đăng kí
-- WFH phải được admin approve, ngược lại không cần APPROVE mà tự động approved. Tương tự với
-- PTO_NEED_APPROVE cho đăng kí PTO."* The column names are theirs, lower-cased.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL.** No project is provisioned for this repository;
-- `.ai/registry/features.md` records `tests/permission-model.test.ts` as owed for that reason.
--
-- **AN ADR IS OWED BEFORE THIS IS APPLIED, AND IT IS NOT MINE TO WRITE.** Until now `approved` meant
-- "an admin looked at this", and INV-02's own rationale leans on exactly that reading. After this file
-- an entry can be `approved` that no admin ever saw. The operator chose that knowingly — including
-- that an auto-approved entry carries the same star as any other — and the ADR text is printed in the
-- reply for them to paste under RULE-01.
--
-- ============================================================================================
-- WHAT THIS FILE DOES
-- ============================================================================================
--
-- 1. Two columns on `public.team`, BOTH DEFAULTING TO `true`. The default is what today's product
--    already does — every entry waits — so applying this file changes nobody's behaviour until an
--    admin moves a switch.
--
-- 2. `grant update` on those two columns, and NO POLICY. `team_update_admin`
--    (`20260905000000_adm01_team_threshold.sql:62`) already bounds both halves of an update to the
--    caller's own team and to an admin; a grant is per column, so this adds two writable columns and
--    exposes nothing else. `20260911160000_solo_team_name_update.sql` records the same reasoning for
--    `name` one file earlier.
--
-- 3. A `before insert` trigger that approves a NEW entry when its type does not need approval.
--
-- ============================================================================================
-- WHY THE AUTO-APPROVAL IS IN THE DATASTORE AND NOT IN THE APPLICATION
-- ============================================================================================
--
-- Because the application CANNOT do it, by design. CAL-01's insert grant names
-- `(member_id, type, portion, start_date, end_date, tentative, note)` and withholds `status` on
-- purpose — *"An admin approves by UPDATING an entry under ADM-05, never by creating one already
-- approved"* — and `entry_enforce_decision()` clause (a) refuses any non-admin who moves a decision
-- column. A client that sent `status: 'approved'` would be refused twice. The only writer that may
-- decide on the member's behalf is the datastore itself, reading a setting an admin chose.
--
-- ============================================================================================
-- WHAT THIS FILE DELIBERATELY DOES NOT DO
-- ============================================================================================
--
-- **IT DOES NOT TOUCH `entry_enforce_decision()`, AND SO AN EDIT STILL RETURNS AN ENTRY TO
-- `pending`.** The operator chose that an edited entry of a no-approval type should be re-approved
-- automatically. That is against INV-02's text — *"An approved entry whose dates, type, portion or
-- tentative flag change returns to `pending`"* — and `.claude/agents/solo.md` refuses to proceed
-- against an invariant even on confirmation: it needs an ADR amending INV-02 first. Until one is
-- merged, clause (c) of that function is unchanged and INV-02 holds exactly as written. The follow-up
-- is a `create or replace` of that ONE function, after clause (c), in the same file as nothing else —
-- ADR-016 section 1 is why it must stay one function rather than become a second `before update`
-- trigger.
--
-- **A BEFORE-INSERT TRIGGER IS NOT THE SECOND `before update` TRIGGER ADR-016 FORBIDS.** PostgreSQL
-- orders same-EVENT triggers alphabetically; this is a different event, and nothing else fires
-- `before insert` on `public.entry`. Its correctness depends on no spelling.
--
-- **IT DOES NOT SWEEP ENTRIES THAT ARE ALREADY PENDING.** Switching a type from "needs approval" to
-- "does not" applies to entries written from then on. The operator chose that: a switch that quietly
-- approved a hundred waiting rows would be a bulk decision nobody made. They stay in the worklist.
--
-- **IT ONLY EVER TURNS `pending` INTO `approved`.** A row that arrives with any other status — a
-- seed file, a service-role import — is left exactly as it was sent. Today the insert grant makes
-- `pending` the only status a client can produce, so this guard costs nothing and forecloses a
-- trigger that overwrites a deliberate `rejected`.
--
-- **IT FAILS CLOSED.** If the member's team cannot be read — a caller whose row the policies hide, a
-- member removed mid-request — `v_needs` is null, `is false` is not true, and the entry stays
-- `pending`. An entry wrongly left waiting is an admin's click; an entry wrongly approved is the false
-- record INV-02 exists to prevent.
--
-- ============================================================================================
-- PROVENANCE OF AN AUTOMATIC APPROVAL
-- ============================================================================================
--
-- `approved_by` IS NULL AND `approved_at` IS SET. Null is the honest value: no member approved it,
-- and writing an admin's id would put a name on a decision that person never took — the exact forgery
-- clause (b) of `entry_enforce_decision()` exists to prevent from the wire. It is also the one mark
-- that tells an automatic approval from a manual one after the fact, since the setting that caused it
-- may since have changed.
--
-- `security invoker`, for the reason `entry_enforce_decision()` records: it needs no privilege of its
-- own. The inserting member can already read their own `member` row and, through `team_select_own`,
-- their own team — which is the only row this reads.
--
-- **IDEMPOTENT.** Applied by hand through the Supabase SQL editor (ADR-024): `add column if not
-- exists`, `create or replace function`, `drop trigger if exists` and `grant` each re-run as a no-op.

begin;

alter table public.team
  add column if not exists wfh_need_approve boolean not null default true,
  add column if not exists pto_need_approve boolean not null default true;

grant update (wfh_need_approve, pto_need_approve) on public.team to authenticated;

create or replace function public.entry_apply_approval_setting() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare
  v_needs boolean;
begin
  if new.status is distinct from 'pending'::public.entry_status then
    return new;
  end if;

  select case new.type
           when 'wfh'::public.entry_type then t.wfh_need_approve
           when 'pto'::public.entry_type then t.pto_need_approve
         end
    into v_needs
    from public.member m
    join public.team t on t.id = m.team_id
   where m.id = new.member_id;

  if v_needs is false then
    new.status           := 'approved'::public.entry_status;
    new.approved_by      := null;
    new.approved_at      := now();
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;

drop trigger if exists entry_apply_approval_setting on public.entry;
create trigger entry_apply_approval_setting
  before insert on public.entry
  for each row execute function public.entry_apply_approval_setting();

commit;

-- TSK-06. A task may carry an optional time of day.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL**, like TSK-01's. `tests/tasks.test.ts` reads this file
-- for its shape; it cannot prove it.
--
-- Decided by ADR-062 (ACCEPTED by the operator); 01-plan.md § 6, transcribed.
--
-- **ONE TIME-BEARING COLUMN, AND ONLY ONE** (ADR-062 decisions 1 and 6, TSK-06 AC-6): a wall-clock
-- `time` with no zone, whole minutes, nullable — null is no time, the default. No end time, interval,
-- duration, estimate, hours or reminder lead time, here or anywhere.
--
-- **IT DRIVES NOTHING BUT DISPLAY AND A DAY'S ORDER** (ADR-062 decisions 4 and 5). No policy,
-- function, trigger, view or publication is created or altered (decision 7): the four TSK-01 policies
-- cover the new column as they cover every other, so it is the owner's alone.
--
-- **THE GRANTS ARE RE-ISSUED WHOLE**, in TSK-01's shape: revoke everything, then grant the column
-- lists again with `time_of_day` added to insert and update. `member_id`, `id` and `created_at` stay
-- out of both. The TSK-01 migration is not edited.
--
-- **IDEMPOTENT** (ADR-024): `add column if not exists`, the constraint guarded by `pg_constraint`, and
-- grants that re-run to the same state. One transaction.
--
-- `supabase/db.sql` holds no `task` table, so nothing is brought level here (01-plan.md § 6).

begin;

alter table public.task add column if not exists time_of_day time without time zone null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'task_time_of_day_shape') then
    alter table public.task add constraint task_time_of_day_shape
      check (time_of_day is null or extract(second from time_of_day) = 0);
  end if;
end $$;

revoke all on public.task from anon, authenticated;
grant select, delete on public.task to authenticated;
grant insert (date, title, note, time_of_day) on public.task to authenticated;
grant update (date, title, note, done, time_of_day) on public.task to authenticated;

commit;

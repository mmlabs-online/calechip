-- MIR-05 AC-4: the harness proves itself. Not an isolation test — those are MIR-06.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select pass('pgTAP is executing');
select ok(
  (select count(*) from supabase_migrations.schema_migrations) > 0,
  'at least one migration is recorded as applied'
);
select has_table('public', 'team',   'public.team exists');
select has_table('public', 'member', 'public.member exists');

select * from finish();
rollback;

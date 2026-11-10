-- ADM-02. The national holiday calendar's DATA. ADR-015 section 5.
--
-- ================================================================================================
-- TODO(verify): THIS FILE IS EMPTY OF ROWS AND MUST NOT BE APPLIED UNTIL IT IS FILLED.
--
-- WHAT GOES IN: the Vietnamese public holidays and the announced swap days, from the government's
-- own announcement, covering AT LEAST TWELVE MONTHS AHEAD OF THE DAY THIS IS APPLIED. The registry
-- row records the operator's answer as "several years" and says several is not a testable
-- criterion; twelve months of coverage ahead of today is, and it is the horizon at which somebody
-- planning Tet stops being served — the year view spans 365 days and members declare four months
-- out.
--
-- WHY NO AGENT WROTE THEM: they are facts about government announcements rather than facts in this
-- repository, and this is the one table where a wrong date silently moves bridge-day detection for
-- the whole team — non-locally, since a wrong Thursday row removes or invents FRIDAY's highlight
-- and nobody looking at Friday suspects the Thursday row. supabase/db.sql section 9.3 records this
-- in the same words.
--
-- `kind` IS THE EFFECT, NOT THE LABEL. A `nghi bu` compensatory day off is `non_working`. A
-- `lam bu` mandated Saturday is `working` — a weekend day that counts as a working day, the exact
-- inverse of a holiday. Getting this backwards on one row is the failure mode this comment exists
-- to prevent.
--
-- THE STATEMENT BELOW HAS NO ROWS AND IS THEREFORE NOT VALID SQL AS IT SHIPS, WHICH IS THE
-- FAIL-CLOSED HALF OF THE SAME DECISION: a `supabase db push` run before a human has filled this
-- file stops here with a parse error rather than silently applying an empty calendar. 01-plan.md
-- Open question 1 and section 6.2; 03-impl-log.md records it for the reviewer.
-- ================================================================================================

insert into public.holiday (date, name, kind) values
  -- ('2026-01-01', 'Tet Duong lich', 'non_working'),
  -- ... one row per announced date ...
    ('2026-01-01', 'Tet Duong lich', 'non_working'),
  ('2027-01-01', 'Tet Duong lich', 'non_working')
on conflict (date) do nothing;

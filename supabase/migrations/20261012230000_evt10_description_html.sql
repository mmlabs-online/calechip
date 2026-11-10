-- EVT-10. An event's description becomes HTML: every description already stored, which is plain
-- text, is converted into the HTML it already meant.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`. **Apply it BEFORE
-- deploying the build that carries the editor**, so no plain description is ever rendered as HTML.
-- The other order is safe too — the render sanitises plain text as well — but shows old line breaks
-- collapsed until this file is applied.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL**, like EVT-01's to EVT-08's. `tests/description-html
-- .test.ts` reads this file for its shape; it cannot prove it.
--
-- Decided by ADR-056 decision 7 (ACCEPTED by the operator). The body is 01-plan.md § 4.6's,
-- transcribed.
--
-- **A FORMAT CONVERSION IS NOT AN EDIT** (AC-11). `event_stamp` would move `updated_at`, and
-- `notify_event_updated` would write a notification row for every participant — which EVT-05 then
-- mails. Both are disabled by name inside this transaction and re-enabled before it commits; the
-- table lock `alter table` takes keeps every other write out until then. Running as the table owner
-- is what `disable trigger` needs. `event_capacity_guard` fires on `update of capacity` only and is
-- not reached; no other trigger on `public.event` fires on update.
--
-- **IDEMPOTENT** by AC-10's guard: a description that already begins with one of the block tags the
-- editor writes is left as it is, so a second application changes nothing. No ledger (01-plan.md
-- § 8 alternative 2). One transaction.
--
-- **NOTHING ELSE CHANGES.** No table, column, policy, function, constraint or grant is created,
-- dropped or altered. `supabase/db.sql` is not updated here — MD-033 owns bringing it level.

begin;

-- AC-11. A format conversion is not an edit: no `updated_at`, no notification, no email.
-- Disabled by name inside this transaction and re-enabled before it commits; the table lock that
-- `alter table` takes keeps every other write out until then.
alter table public.event disable trigger event_stamp;
alter table public.event disable trigger notify_event_updated;

-- AC-10. Blank is no description, as EVT-01 AC-2 stores one.
update public.event
   set description = null
 where description is not null
   and btrim(description, E' \t\r\n') = '';

-- AC-10. Escape `&` first, then `<` and `>` — the three a text node needs, and the three Tiptap
-- writes, so a converted description re-saved unchanged stays unchanged. Runs separated by blank
-- lines are paragraphs; a single break inside one is <br>.
update public.event e
   set description = (
     select string_agg('<p>' || replace(t.para, E'\n', '<br>') || '</p>', '' order by t.n)
       from regexp_split_to_table(
              btrim(
                replace(replace(replace(
                  replace(replace(e.description, E'\r\n', E'\n'), E'\r', E'\n'),
                  '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
                E'\n'),
              E'\n[ \t]*\n[ \t\n]*'
            ) with ordinality as t(para, n)
   )
 where e.description is not null
   and e.description !~ '^\s*<(p|h2|h3|ul|ol|blockquote)[ >]';

alter table public.event enable trigger notify_event_updated;
alter table public.event enable trigger event_stamp;

commit;

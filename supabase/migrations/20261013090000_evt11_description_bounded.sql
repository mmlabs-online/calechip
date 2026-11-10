-- EVT-11 — ADR-056 decision 5. The cap on an event description, pictures included.
-- NOT VERIFIED AGAINST A RUNNING POSTGRESQL. Applying it is human-only (RULE-09).
--
-- Q2-B keeps a description's pictures inside the row as base64 `data:` URLs, so this is the only
-- bound on how heavy one event can make every read of it. Row-local, so the "no subquery in a check
-- constraint" error recorded in 20260926140000_solo_issue_report_images.sql does not arise. The
-- seam measures the same thing first (`description_too_large`) only so a person is told before the
-- round trip; this is the control, whichever way a write arrives (ADR-005).
do $$ begin
  alter table public.event
    add constraint event_description_bounded
    check (description is null or octet_length(description) <= 1048576);
exception when duplicate_object then null;
end $$;

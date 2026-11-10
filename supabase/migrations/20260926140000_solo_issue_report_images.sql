-- SOLO, 2026-09-26 (second run of the day). A report may carry images, and it usually will not.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL, AND THIS FILE IS THE LEAST VERIFIED ONE YET.** Every
-- migration since 20260910093000 carries that warning; this one adds a second kind of unverified,
-- because `storage.objects` is Supabase's own table and its policies are not exercised by the mock
-- at all — the mock has no bucket and cannot have one. `tests/issue-reports.test.ts` asserts the
-- seam's refusals and the mock's bookkeeping; it asserts NOTHING about the four policies below.
-- `tests/permission-model.test.ts` is still owed — `.ai/standards/rbac-and-security.md`
-- § Known weaknesses 1.
--
-- **THE OPERATOR'S TWO DECISIONS, 2026-09-26, asked as explicit questions with their costs.**
--   1. **Supabase Storage, with the table holding object PATHS** — not base64 in the row, which was
--      offered and refused on the cost stated: a screenshot is half a megabyte to two megabytes of
--      base64, and the admin list would ship every image of every report on each read.
--   2. **At most three images, five megabytes each**, PNG, JPEG or WebP.
--
-- **THIS IS THE FIRST STORAGE IN THE PRODUCT.** Nothing in `src/` or `supabase/` touched
-- `storage.*` before today; avatars are static files under `public/images/` and `member.avatar` is a
-- filename from a fixed list. So there is no precedent here to follow and the four policies below
-- are written from Supabase's documented pattern rather than from this repository's own.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The column.
-- ---------------------------------------------------------------------------------------------
-- **PATHS, NEVER URLS.** The bucket is private, so a path is not something a browser can load; it is
-- exchanged for a short-lived signed URL at read time. A URL in this column would be a credential
-- stored in a table row, and a stale one on every read after it expired.
--
-- `not null default '{}'` so every row written before this migration reads as *no images* rather
-- than as null — which is what stops `report.images.length` being a crash on old data.
alter table public.issue_report
  add column if not exists images text[] not null default '{}';

-- The operator's second decision, held where a client cannot reach past it. `coalesce` because
-- `array_length` of an empty array is NULL and not 0, which would make this check pass on anything.
--
-- **THIS CLAUSE WAS WRITTEN WRONG THE FIRST TIME AND THE CORRECTION IS RECORDED RATHER THAN
-- SILENT.** It read `not exists (select 1 from unnest(images) …)`, and PostgreSQL refuses that with
-- `0A000: cannot use subquery in check constraint` — a CHECK is a row-local expression and may not
-- look at anything, including an unnesting of its own column. The operator hit it in the SQL editor
-- on 2026-09-26; the whole first transaction rolled back, so nothing was half-applied.
--
-- `'' <> all(images)` is the subquery-free form. `ALL` over an ARRAY is an ordinary operator and not
-- a subquery — the same spelling over a `(select …)` would be one, which is the distinction worth
-- knowing before somebody edits this line again.
--
-- **WHAT THE CORRECTED CLAUSE NO LONGER CATCHES, STATED PLAINLY.** The rejected version compared
-- `btrim(p) = ''`, so it refused a whitespace-only path as well as an empty one; there is no
-- array-wide `btrim` without a subquery or a helper function, and adding a function to the schema to
-- catch a case nothing can produce is a worse trade than saying so here. A NULL element slips
-- through for the same structural reason: `'' <> NULL` is NULL, and a CHECK passes on NULL.
--
-- It is acceptable because **NO PERSON EVER TYPES THESE VALUES.** `issueObjectPath` in
-- `src/lib/data/supabase.ts` builds every path as `<uid>/<uuid>.<ext>`, and the column is not in the
-- update grant, so the only way a blank or null path reaches this table is a hand-written request
-- from something that is not this application. If one did, `IssueReports.tsx` renders it as a dead
-- slot reading *Image unavailable* rather than as a broken image — which is the same outcome the
-- rejected clause was protecting, arrived at one layer later.
alter table public.issue_report
  drop constraint if exists issue_report_images_bounded;
alter table public.issue_report
  add constraint issue_report_images_bounded check (
    coalesce(array_length(images, 1), 0) <= 3
    and '' <> all(images)
  );

-- **THE COLUMN JOINS THE INSERT GRANT AND NOTHING ELSE JOINS IT.** `status` and `created_at` are
-- still withheld, which is what stops a report arriving pre-`done` or backdated — the reasoning in
-- 20260926100000's header is unchanged and this adds exactly one name to that list.
--
-- IT IS DELIBERATELY NOT ADDED TO THE UPDATE GRANT. `grant update (status)` is still the whole of
-- what an admin may write, so an admin cannot attach, replace or strip the images on somebody's
-- report any more than they can edit the message.
grant insert (member_id, kind, message, page, images) on public.issue_report to authenticated;

commit;

-- ---------------------------------------------------------------------------------------------
-- 2. The bucket.
-- ---------------------------------------------------------------------------------------------
-- **A SEPARATE TRANSACTION**, because everything below touches `storage.*`, which is Supabase's
-- schema and not this product's. Keeping it apart means a failure here leaves the column above
-- applied rather than rolling back a change that is correct on its own.
--
-- **PRIVATE — `public = false` — AND THAT IS THE WHOLE SECURITY PROPERTY.** A public bucket serves
-- every object to anybody holding the URL, with no policy consulted and no session required. These
-- are screenshots of a private team's calendar, sent by somebody reporting a fault; the unguessable
-- path would be the only thing protecting them, and an unguessable path in a chat message is a
-- guessable path. `createSignedUrl` is what the admin screen uses instead.
--
-- `file_size_limit` AND `allowed_mime_types` ARE THE CONTROL. `src/lib/domain/types.ts` repeats both
-- numbers so a person is refused before five megabytes leave their machine; that is a courtesy, and
-- this is the thing that actually refuses.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'issue-report',
  'issue-report',
  false,
  5242880, -- 5 MiB, the operator's number
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
-- `do update` and NOT `do nothing`: re-applying this file must be able to CORRECT a bucket that was
-- created by hand in the dashboard as public, which is the most likely way this goes wrong and the
-- one mistake that silently removes every protection below.

-- ---------------------------------------------------------------------------------------------
-- 3. Who may put an object in it.
-- ---------------------------------------------------------------------------------------------
-- **THE FIRST PATH SEGMENT IS THE OWNER'S UID, AND THAT IS WHY THE PATH SHAPE IS A RULE AND NOT A
-- CONVENTION.** `src/lib/data/supabase.ts` writes `<auth.uid()>/<uuid>.<ext>`, and this policy is
-- what makes that true rather than merely intended: a caller who uploads under somebody else's
-- folder is refused. It is `issue_report_insert_own`'s clause expressed in the only vocabulary
-- storage has.
--
-- `storage.foldername(name)` returns the path segments as an array; `[1]` is the first. Postgres
-- arrays are 1-indexed, and a `[0]` here would compare against NULL and admit everything — which is
-- the single most likely way this file is got wrong by a later edit.
drop policy if exists issue_image_insert_own on storage.objects;
create policy issue_image_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'issue-report'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------------------------
-- 4. Who may read one.
-- ---------------------------------------------------------------------------------------------
-- **ADMINS, AND NOT THE PERSON WHO UPLOADED IT.** That asymmetry is deliberate and matches the table
-- exactly: there is no `issue_report_select_own` either, because a reporter has no screen that reads
-- a report back. The form previews what a person chose from the `File` objects in their own browser,
-- so nothing is fetched and no read permission is needed for it.
--
-- **THIS IS WHAT `createSignedUrl` IS CHECKED AGAINST.** A signed URL is minted only if the caller
-- could have read the object themselves, so the signature does not widen anything — it just moves
-- the check to minting time and lets an `<img>` tag load without a session.
drop policy if exists issue_image_select_admin on storage.objects;
create policy issue_image_select_admin on storage.objects
  for select to authenticated
  using (
    bucket_id = 'issue-report'
    and public.is_admin((select auth.uid()))
  );

-- **NO UPDATE POLICY AND NO DELETE POLICY, DELIBERATELY**, which is the table's shape carried over:
-- the operator's third decision on 2026-09-26 stopped at *mark done*, and nothing in this feature
-- destroys what a person sent. It has one consequence worth stating plainly rather than discovering:
-- an upload that succeeds while the row insert afterwards FAILS leaves an orphaned object that
-- nobody can remove through the product. There is no transaction spanning storage and a table, so
-- some such window exists in any design; this one is narrow and its residue is invisible rather than
-- harmful. `src/lib/data/supabase.ts` records the same fact at the call site.

commit;

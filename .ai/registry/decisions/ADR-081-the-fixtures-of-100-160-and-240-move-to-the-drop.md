---
doc_version: 3
last_updated: 2026-11-07
governed_by: [RULE-01, RULE-03, RULE-09]
---

# ADR-081 — The fixtures of pgTAP files 100, 160 and 240 stop naming `member.team_id` in MIR-21-f, not MIR-21-e

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-07 — at `/plan MIR-21-e` (ADR-008, ADR-067).

This ADR amends the allocation in
[ADR-080](ADR-080-the-team-lock-moves-to-membership-first-and-the-drop-splits-into-four-slices.md)
decisions 3 and 4. It moves three files from MIR-21-e to MIR-21-f. It reverses no decision: every
fixture still stops naming the column before the column is dropped, and the drop still happens in
MIR-21-f.

## Context

Counted on 2026-11-07, at `origin/main` `53221d0` (MIR-21-d shipped).

- **Thirteen files outside `migrations/` hold an `insert into public.member` that names `team_id`.**
  They are `_isolation.psql`, 100, 120, 140, 150, 160, 190, 210, 220, 230 and 240, plus `seed.sql`
  and `bootstrap.sql`. ADR-080 decision 3 listed twelve of them. `240-org-public-holidays.test.sql`
  is missing from that list: it was written by MIR-15-b on the same day ADR-080 was, and it names the
  column in its fixture.
- **Thirteen files is `L`** (`.ai/01-operating-model.md` § Sizing: more than 12 files must split at
  PLAN).
- **MIR-21-f already edits 100 and 160.** ADR-080 decision 4 gives it the catalogue and self-lock
  assertions of 010, 040, 100, 110 and 160. So moving their fixture edits there adds no path to
  MIR-21-f's count. Moving 240 adds one.
- **Splitting off a new ticket costs more.** It needs a ticket folder, an ADR, and `depends_on`
  edits to MIR-21-f and to the four features ADR-080 decision 6 blocks — the overhead ADR-080
  *Context* counted at eight paths.

## Decision

1. **MIR-21-e stops the column being named in the fixtures of `_isolation.psql` (`tests.seed()`),
   120, 140, 150, 190, 210, 220, 230, `seed.sql` and `bootstrap.sql`.** It also retires 220 AC-1 and
   AC-2, as ADR-080 decision 3 says.
2. **MIR-21-f does the same for the fixtures of 100, 160 and 240**, in the same change as its
   drop. It already edits 100 and 160. Its predicted count rises from about nine paths to about ten.
3. **ADR-080 decision 5 is unchanged.** No test or fixture written from now on names
   `member.team_id`.

## Options considered

- **Keep all thirteen in MIR-21-e.** Rejected: thirteen files is `L`, and `L` must split.
- **Split MIR-21-e by surface**: pgTAP fixtures in one ticket, `seed.sql` and `bootstrap.sql` in a
  new one. Rejected: a new ticket pays the overhead counted in *Context* to move two files.
- **Move only 240 to MIR-21-f.** That leaves MIR-21-e at twelve work paths plus this ADR and
  MIR-21-f's `ticket.yaml`, which is fourteen, so it is still `L`. Rejected.
- **Leave 240 unlisted and let MIR-21-f's drop discover it.** Rejected: 240 would fail at the drop
  with no ticket owning the fix.

## Consequences

- From MIR-21-e until MIR-21-f, three pgTAP files still name the column in an insert. Nothing reads
  the column back for an answer after MIR-21-d, so those inserts only reach the mirror's INSERT
  branch. That branch keeps their `membership` rows correct until MIR-21-f drops it in the same
  change that rewrites them.
- MIR-21-f's `ticket.yaml` `mir_detail` gains the three files.

## Revert condition

None. This is a re-allocation of work, not a design. If MIR-21-f counts `L` with the three files in
it, its PLAN splits it as ADR-080 decision 6 already provides.

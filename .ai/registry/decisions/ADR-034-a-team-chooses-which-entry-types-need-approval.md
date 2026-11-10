---
doc_version: 3
last_updated: 2026-09-11
governed_by: [RULE-01, RULE-09]
---

# ADR-034 — A team chooses, per entry type, whether a new entry waits for an admin

Status: Proposed — 2026-09-11

## Context
The operator asked for WFH_NEED_APPROVE and PTO_NEED_APPROVE: when a flag is false, a new entry of
that type is approved without an admin. Until now `approved` meant "an admin looked at this", and
INV-02's rationale depends on that reading.

## Decision
1. `public.team` gains `wfh_need_approve` and `pto_need_approve`, boolean, not null, default true.
   Admins set them under `team_update_admin` with a column grant; no new policy.
2. A `before insert` trigger, `entry_apply_approval_setting()`, stores a new `pending` entry as
   `approved` when its team's flag for its type is false, with `approved_by = null` and
   `approved_at = now()`. It fails closed: an unreadable team leaves the entry pending.
3. `approved` no longer implies an admin looked. `approved_by is null` on an approved entry is the
   mark of an automatic approval. An auto-approved entry carries the ordinary star (operator's choice).
4. Turning a flag off does not touch entries already pending.

## Not decided here — proposed amendment to INV-02
The operator wants an edited entry of a no-approval type re-approved automatically. Proposed text:
"An approved entry whose dates, type, portion or tentative flag change returns to `pending`, unless
its team does not require approval for its type after the edit, in which case it is approved again
automatically." Until accepted, INV-02 holds as written.

## Rejected alternatives
- Approving in the application: the insert grant withholds `status` and clause (a) of
  `entry_enforce_decision()` refuses non-admins; the client cannot do it.
- Sweeping pending entries when a flag is turned off: a bulk decision nobody reviewed.

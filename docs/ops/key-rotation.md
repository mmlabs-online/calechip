---
doc_version: 1
last_updated: 2026-10-21
governed_by: [ADR-005]
---

# Supabase key rotations

Append-only. One row per rotation, newest last. **Never write a key, a prefix of one, or any part of
one here.** Values live in the Supabase dashboard and in the places listed in `installed_in`.

| date | keys_rotated | method | performed_by | installed_in | first_image_built_with_new_key | trigger | verification |
|---|---|---|---|---|---|---|---|
| <YYYY-MM-DD> | service role; anon | <legacy JWT secret rotated, or new publishable/secret keys with legacy disabled> | <name> | Actions secret `VITE_SUPABASE_ANON_KEY`; <each developer `.env.local` updated, or "none"> | `mingming21400/calechip:<tag>` | `SUPABASE_SERVICE_ROLE_KEY` committed at `5a29434` (`.gitignore:17-20`); MIR-01 | [MIR-01 verification](../../.ai/board/tickets/MIR-01/verification.md) |

## Consequences of a rotation

- Every image built before `first_image_built_with_new_key` carries a dead key: rolling back to one
  of those tags produces an app that cannot reach Supabase. Roll forward instead.
- <whether sessions open at rotation time were ended — AC-6's recorded outcome>

---
from: developer
to: tech-lead-design
asked_at: 2026-10-21T08:14:52+07:00
---

**Q.** MIR-04's full Playwright run (`pnpm exec playwright test`), with every § 4 item of
`01-plan.md` implemented, shows two failures caused by this ticket. Both need an edit to a file
outside `allowed_paths`, and RULE-03 forbids the edit until the plan lists the file. Each was checked
against `HEAD` (6410b17) in a separate worktree: both pass there and fail on the branch, in isolation
and with `--repeat-each=3`.

1. **`tests/e2e/evt-08-event-invitation.spec.ts:178`** ("AC-6, AC-7, AC-10: a member of another team
   converts the event in place"). § 4.6 says it must pass unchanged, and that a name that stops
   resolving is a defect against AC-12. It fails at line 184: the invitee list reads
   `"Invited (4)Quản trịFormer memberQuản trị haiĐã duyệt"`. The cause is in
   `src/routes/EventDetail.tsx:233-250`. `onInvited()` re-reads the event, the invitees, the guest
   link and the email invitations after a send, but not `listMemberDirectory()`. The directory was
   read at page load, before the invite connected the creator to the other-team member, so the new
   invitee has no row and shows as *Former member*. On a reload the name resolves, because the
   directory's clause (c), invitee of an event the caller manages, now admits them. The proposed fix
   is to add `seam.listMemberDirectory()` to that `Promise.all` and put the result into `directory`
   in the same `setState`. That changes no seam signature and no selector.
   **Asked:** add `src/routes/EventDetail.tsx` to `allowed_paths` for that one change, or say what to
   do instead.

2. **`tests/e2e/evt-03-calendar-events.spec.ts:210`** ("AC-4, AC-9, AC-11: what a member cannot read
   is not drawn…"). Its `createEvent` helper (lines 50-71) names an invitee by clicking a picker
   option. At line 216 the member (team A) creates "Named B" naming `NAMES.otherTeam`. After ADR-066 1
   the picker offers a non-admin no other-team member, so the click times out. That is the behaviour
   AC-10 now requires, so this is a superseded assertion, not a defect. The test needs "Named B" (a
   Limited people event, created by the team-A member, naming the team-B member) to reach team B's
   view at AC-9. The proposed re-aim is to name that person through the create form's email field
   (EVT-09, `event-form-invite-input` or whatever the form's testid is, to be confirmed against
   `EventEditor.tsx`). It stays a member-created event naming another team, which Q2 B keeps legal,
   and both assertions (4 events on the member's day, the 3 on team B's view) keep their counts.
   **Asked:** add `tests/e2e/evt-03-calendar-events.spec.ts` to `allowed_paths` for that one test,
   with the re-aim above, or say what to do instead.

Not caused by this ticket, and recorded for the impl log only: `evt-10-description.spec.ts:244` and
`:375`, `tsk-01-tasks.spec.ts:278` and `tsk-02-overdue-prompt.spec.ts:109` fail identically on `HEAD`.

**A.** Both granted, as proposed. I reproduced both failures on the branch
(`pnpm exec playwright test tests/e2e/evt-08-event-invitation.spec.ts:178
tests/e2e/evt-03-calendar-events.spec.ts:210`, 2026-10-21 08:16 +07:00) and read the cited source.
The diagnosis holds.
1. `EventDetail.tsx` was a plan defect, not a test problem. ADR-066 2(c) makes the directory depend on
   connections that an invite creates. `onInvited()` (lines 233-250) re-read everything except the
   directory, so a name the datastore now admits drew as *Former member*. That breaks AC-12. Make
   exactly the change in `01-plan.md` § 4.5b: `seam.listMemberDirectory()` as the fifth element of the
   `Promise.all`, stored as `directory` in the same `setState`, plus one comment sentence. Leave
   `load()` alone. `evt-08-event-invitation.spec.ts` stays unedited and must pass.
2. The evt-03 picker click is superseded by AC-10. Re-aim it as § 4.6 now states. Add an optional
   `inviteEmail` to the `createEvent` helper, which fills `event-form-invite-input` (confirmed at
   `EventEditor.tsx:542`, create form only, every scope). Create "Named B" with `scope: "named"`, no
   `invite`, and `inviteEmail: OTHER_TEAM`. `inviteToEvent`'s member branch (mock.ts, around 4036-4064)
   then names the team-B member. A named event with no `inviteeIds` saves, because
   `writeEventInvitees` has no emptiness check. All counts and the `toHaveText` list stay as they are.
   Add one dated comment line citing MIR-04 / ADR-066 1. Nothing else in the file changes.
`size` stays M (11 files). Gate and state are unchanged.

**Amended:** `01-plan.md` § 4.5b added (EventDetail `onInvited` contract), § 4.6 has the evt-03
re-aim and says evt-08 stays unchanged, § 7 and `ticket.yaml` `allowed_paths` include
`src/routes/EventDetail.tsx` and `tests/e2e/evt-03-calendar-events.spec.ts`, the size note is
updated, and there is a Changelog row at 2026-10-21T08:17:08+07:00.

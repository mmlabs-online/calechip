# UIE-01 — the visual reference, and it is not an image

**THIS IS A TRANSCRIPTION OF TWO IMAGES SHOWN IN CONVERSATION ON 2026-09-05 THAT WERE NEVER ON DISK.
IT IS NOT AN ATTACHED IMAGE.** No file was committed, `git ls-files` holds no image of any kind, and
nothing moved into this folder from the idea's `Evidence` section. `.ai/standards/ui-design-system.md:105-125`
describes an image attached at `/triage` moving to `.ai/board/tickets/<ID>/design/` on PROMOTE; **there
was no file to move**, so this file was written by hand at that canonical path instead.

**What that costs, stated rather than glossed.** A later reader cannot check a single statement below
against the picture it came from. Under `.ai/standards/ui-design-system.md:140-150` the absence of an
image puts the layout in `tech-lead-design`'s hands at PLAN, **including the obligation that comes with
the grant**: `01-plan.md` § 2b must carry the line that the layout is the Tech Lead's own and was never
specified. This document is evidence of intent; it is not a specification, and
`.ai/standards/ui-design-system.md:137-138` already says *"looks like the screenshot" is not an
acceptance criterion*. A transcription of an image nobody can reopen is weaker than that again.

**Written by `product` at `/triage` on 2026-09-05**, from
`.ai/board/ideas/2026-09-05-the-first-screen-does-not-look-like-the-product.md`, which cites this file
from its `Evidence` section.

**The ticket was renumbered `OPS-003` → `UIE-01` later the same day**, when the operator instructed
that UI-enhancement work get a feature group of its own and ADR-028 declared `UIE`. Only the ID and
this file's path moved; not one word of the transcription below was changed by that.

---

## 1. The operator's request, verbatim

> I need to chnage the login/signup page into UI like that attachment.

Reproduced with its typo intact. Two images were attached to that message. Neither is in the
repository.

---

## 2. Image 1 — sign-in state, transcribed

Flat pale-lavender viewport (~`#F0EEFA`), no pattern or gradient. One centred white card, ~355px wide,
~24px corner radius, ~32px padding, one large very soft shadow, no border, centred on both axes in an
otherwise empty viewport. Title `Ai Nghỉ?` — heavy rounded face, ~28px, deep indigo ~`#2E2350`, with a
rabbit emoji 🐰 on the same baseline immediately after. Centred subtitle directly beneath, ~13px, muted
grey-purple: `Lên lịch vắng mặt cùng team`. Then a **segmented control**: one full-width ~44px
fully-rounded pill on a pale lavender track (~`#EDEBF9`), two equal halves — the active half a **white
pill inset inside the track** with its own soft shadow and a bold deep-indigo label, the inactive half
transparent with a medium purple-grey label; here left `Đăng nhập` is active, right `Đăng ký` is not.
Then two field groups, each an uppercase ~10px letter-spaced muted purple-grey label left-aligned above
a full-width ~44px fully-rounded **borderless** input filled pale lavender-grey (~`#EDEBF7`):
`TÀI KHOẢN` / placeholder `VD: min, tram, huy...`, then `MẬT KHẨU` / placeholder `Nhập mật khẩu...`.
Then a full-width ~48px fully-rounded solid deep-indigo (~`#2A2145`) button with a white bold centred
label `Đăng nhập`. Then a footer of two centred ~11px lines: `Tài khoản Admin: min, tram` and
`Tài khoản Member: huy, dat, ngoc, khoa, linh, bao`, the prefixes light purple-grey and the names bold
indigo. Vertical rhythm: title block → ~20px → segmented control → ~20px → fields (~6px label-to-input,
~16px between groups) → ~24px → button → ~24px → footer.

## 3. Image 2 — sign-up state, transcribed

The same card, background, title and subtitle, only taller. The segmented control's **right** half is
now the active white pill: `Đăng ký` active, `Đăng nhập` not. Three field groups in this order, styled
exactly as above: `TÊN HIỂN THỊ` / `VD: Hải, Tuấn...`; `TÀI KHOẢN` /
`Nhập username viết liền không dấu...`; `MẬT KHẨU` / `Tạo mật khẩu...`. Primary button `Tạo tài khoản`,
same deep-indigo pill. **No footer credential block in this state. No avatar picker. No email field. No
link out of the card.**

---

## 4. What neither image shows

Error state, submitting state, the post-sign-up "check your email" confirmation, avatar selection,
focus / hover / disabled states, any width other than desktop, dark mode, and the member-less landing
state.

**Every one of those exists on screen today, and silence is not removal.** `src/routes/SignIn.tsx:95-99`
renders the seam's failure message; `:107` swaps the button label to `Signing in…`;
`src/routes/SignUp.tsx:123-150` is a required avatar picker with a `radiogroup`; `:61-73` is the
terminal confirmation that ends sign-up; `src/routes/NotOnATeam.tsx` is the member-less landing state.
The list above is what PLAN must originate under the § *Visual specification* grant — `ticket.yaml` § 8
enumerates it.

---

## 5. Three things this transcription asserts that the ticket does NOT adopt

Recorded here so nobody reads the transcription as scope. Each reverses a decision already taken, and
each is scoped out in `ticket.yaml` § 4 with its citation.

1. **Every string above is Vietnamese.** The interface is English —
   `.ai/standards/ui-design-system.md` § Language, lint-enforced at `eslint.config.js:83-92`.
2. **The identity field is a username.** This product's join key is the email address — ADR-009, and
   ADR-005 beneath it. `username` appears zero times under `src/`, `supabase/` and
   `.ai/standards/data-model.md`.
3. **The footer prints working credentials for eight accounts**, and those eight are not this
   repository's fixtures either (`src/lib/fixtures.ts:237-285` holds `quan`, `thanh`, `dung`, `chi`,
   `cu`, `hoa`, `khanh`).

**The layout is what this ticket takes from these images. The copy, the identity model and the footer
are not.**

# UIE-10 — the visual reference. It is a TRANSCRIPTION, NOT AN IMAGE, and most of what it shows is NOT this ticket

**The half of the picture this ticket answers is the sidebar** — specifically § *What the sidebar
does NOT contain* (read against decision 1: the operator's words govern, so the three general links
stay and only the four admin ones go) and the **role word beneath each member's name**. The
**five collapsible groups and their count pills are DEFERRED and are not this ticket's**; the
**fourth legend row** and the **palette icon** are refused. The top bar's outline pill is `UIE-09`'s.

**Copied verbatim by `product` at /triage on 2026-09-09** from the scratchpad path where the
dispatching session wrote it. It is copied into two ticket folders — this one and
`.ai/board/tickets/UIE-09/design/README.md` — because one picture was cut into two tickets, and a
scratchpad path does not survive the session that made it. **The copy is what makes it durable
evidence; it does not make it a reference.** Nothing below was added, removed or reworded.

---

# Visual reference — TRANSCRIPTION, NOT AN IMAGE

**There is no image file beside this one, and there never was.** The operator pasted a screenshot
into the `/triage` conversation on 2026-09-09. A pasted image arrives as conversation content, the
harness writes no temporary copy on disk, and no role in this loop can write image bytes — this is
`.ai/board/model-debt.md` MD-030, and `.ai/standards/ui-design-system.md` § *Visual specification*
carries the same correction. What follows was written by hand by the dispatching `/triage` session,
which is the only party that ever saw the picture.

**A later reader cannot check a single sentence of this against the picture it describes.** It is
evidence of intent. It is not a reference.

Source image: 3895 × 2121, viewed at 2000 × 1089. All measurements below are in the viewed
coordinate space and are read off the picture, not computed.

---

## The frame

The whole application sits inside a rounded white/pale frame with a visible outer margin on all
sides. Two panes: a fixed sidebar on the left (~285px of 2000, ≈ 14%), and the content pane filling
the rest on the pale lavender page background.

## The sidebar — left pane, white card, full height

Top to bottom:

1. **Brand.** `Ai Nghỉ?` — bold rounded display face, dark ink, ~20px.
2. **Tagline.** `Lịch vắng mặt team` — ~11px, grey, directly beneath the brand.
3. **Roster section label.** `TEAM (8)` — uppercase, letter-spaced, ~10px, grey.
4. **Five collapsible groups.** Each group header is one row: an uppercase letter-spaced grey label,
   a small count pill on a pale lavender fill, and a `▲` collapse chevron pushed to the right edge.
   The five, in this order, with the member rows under each:

   | Group header | Count pill | Member rows (name / second line) |
   |---|---|---|
   | `CORE ENGINEERING` | 2 | `Min (Bạn)` / `Admin`; `Trâm` / `Admin` |
   | `FRONTEND TEAM` | 2 | `Huy` / `Member`; `Ngọc` / `Member` |
   | `BACKEND TEAM` | 2 | `Đạt` / `Member`; `Khoa` / `Member` |
   | `QA / TESTING` | 1 | `Linh` / `Member` |
   | `DESIGN / PRODUCT` | 1 | `Bảo` / `Member` |

   A **member row** is: a ~26px circular avatar chip carrying an animal emoji on a light grey field,
   then two stacked lines — the display name (~13px, semibold, ink) and beneath it the role word
   (~9px, grey). A **thin vertical hairline** runs down the left of the member rows inside each
   group, as an indent guide. The signed-in member is marked by `(Bạn)` appended to the name.

   The group counts sum to 8, which is the number in the `TEAM (8)` label.

5. **A large empty vertical gap** — roughly a third of the pane's height — separating the roster
   from the bottom cluster.

6. **Legend card.** Rounded, on a pale lavender field. **Four** rows, each a small filled circular
   dot then a label:

   | Dot | Label |
   |---|---|
   | peach / orange | `Nghỉ phép (PTO)` |
   | mint | `Làm ở nhà (WFH)` |
   | lavender | `Ngày lễ` |
   | pink | `Quá tải (>50%)` |

7. **A hairline divider.**

8. **Account footer.** One row: avatar chip (rabbit emoji), then `Min` in bold ~12px, and beneath it
   `ADMIN` in ~9px uppercase letter-spaced **pink/magenta**. Pushed to the right edge, two icon-only
   controls with no label: a **palette** icon, then a **sign-out** (arrow-leaving-a-box) icon.

### What the sidebar does NOT contain

**No navigation links of any kind.** There is no `This week`, no `The year`, no `Public holidays`,
and none of the four admin links. The nav block that sits between the roster and the legend in the
shipped sidebar is simply absent from the picture.

## The top bar — content pane only, ~70px tall, on the page background

Left cluster, in order: a `‹` icon button; then `2026` in large (~22px) semibold ink with a small
`▾` caret immediately after it — the anchor reads as a **dropdown**, not as static text; then a `›`
icon button.

Right cluster, pushed to the right edge, in order:

1. A pill-shaped **segmented control** on a light track: `Tuần` / `Tháng` / `Năm`. `Năm` is active —
   white fill, soft shadow, bold ink; the other two are grey and unfilled.
2. An **outline pill**, no fill: `Quản trị & Duyệt`. *This is the single admin affordance the
   operator's instruction asks for.*
3. A **primary filled pill** in dark navy/near-black with white bold text: `+ Đăng ký`.

### What the top bar does NOT contain

No `Today` / `Hôm nay` control. The shipped bar renders one; the picture does not.

## The content pane

Entirely empty pale lavender. **The year grid is not drawn in this mockup** — no month columns, no
member rows, no cells. The picture makes no statement about the calendar surface.

Floating at the bottom-right corner of the content pane, clear of everything: a small rounded-square
white button carrying a **keyboard** icon. It sits over the empty pane, is unlabelled, and nothing
in the picture says what it does.

## Copy

Every string in the picture is **Vietnamese**. The shipped interface is English by the operator's
own instruction of 2026-09-03, lint-enforced, with a `copyDebt` list that only ever shrinks. The
picture's copy is therefore a rendering of the operator's own language and not a request to
translate the interface — the same reading UIE-01 recorded for the same reason.

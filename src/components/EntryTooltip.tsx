import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Entry, Member } from "@/lib/domain/types";
import { PORTION_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";

// SOLO, 2026-09-13 — the week chip's hover card. Operator: *"những card trên calendar hover show
// tooltip đầy đủ info"*, scoped by them to the Week view chip, drawn (not the browser's `title`),
// carrying the name, the type, the portion, the date range, the status with the approver, and the note.
//
// **IT ATTACHES TO ITS PARENT, SO THE CHIP NEEDS NO HANDLERS OF ITS OWN.** Rendered as a child of
// the element it describes, it listens on `parentElement` for hover and keyboard focus. The chip is
// built inside a `.map` in WeekView.tsx, where a hook cannot be called per row; this keeps that loop
// unchanged apart from making the chip focusable.
//
// **A PORTAL, POSITIONED `fixed`.** Two things inside the chip would otherwise break it: the page pane
// scrolls (`overflow-y-auto` in AppShell), which clips an absolutely placed box at its edge, and a
// tentative chip is at reduced opacity, which a child cannot opt out of. It hides on any scroll
// rather than chasing its anchor.
//
// **NOT A CONTROL.** No button, no input: cal-05-week-view.spec.ts AC-8 holds this screen to no
// control over an entry, and a card that only reads is none.

interface EntryTooltipProps {
  entry: Entry;
  member: Member;
  approver: Member | undefined;
}

/** `2026-09-07` -> `07/09`, by slicing. Never `new Date(...)`: a date-only string parses as UTC
 *  midnight and reads as the previous day west of UTC. */
function dayMonth(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

const GAP = 8;

export default function EntryTooltip({ entry, member, approver }: EntryTooltipProps) {
  const id = useId();
  const markerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const target = markerRef.current?.parentElement;
    if (!target) return;
    const show = () => setAnchor(target.getBoundingClientRect());
    const hide = () => {
      setAnchor(null);
      setPosition(null);
    };
    target.setAttribute("aria-describedby", id);
    target.addEventListener("mouseenter", show);
    target.addEventListener("mouseleave", hide);
    target.addEventListener("focusin", show);
    target.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      target.removeAttribute("aria-describedby");
      target.removeEventListener("mouseenter", show);
      target.removeEventListener("mouseleave", hide);
      target.removeEventListener("focusin", show);
      target.removeEventListener("focusout", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, [id]);

  // Measured after render so the card's own size decides where it fits: above the chip by default,
  // below it when there is no room above, and clamped inside the viewport sideways.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!anchor || !card) return;
    const { width, height } = card.getBoundingClientRect();
    const above = anchor.top - GAP - height;
    const top = above >= GAP ? above : anchor.bottom + GAP;
    const centred = anchor.left + anchor.width / 2 - width / 2;
    const left = Math.min(Math.max(centred, GAP), window.innerWidth - width - GAP);
    setPosition({ top, left });
  }, [anchor]);

  const range =
    entry.startDate === entry.endDate
      ? dayMonth(entry.startDate)
      : `${dayMonth(entry.startDate)} → ${dayMonth(entry.endDate)}`;
  const hasNote = entry.note !== null && entry.note !== "";

  return (
    <>
      <span ref={markerRef} hidden />
      {anchor
        ? createPortal(
            <div
              ref={cardRef}
              id={id}
              role="tooltip"
              data-testid="week-row-tooltip"
              data-entry-id={entry.id}
              style={{
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                visibility: position ? "visible" : "hidden",
              }}
              className="pointer-events-none fixed z-50 flex w-max max-w-64 flex-col gap-1 rounded-card border border-line bg-card p-3 text-xs text-ink-2 shadow-soft"
            >
              <span data-testid="week-row-tooltip-name" className="text-sm font-bold text-ink">
                {member.displayName}
              </span>
              <span data-testid="week-row-tooltip-kind">
                <span className={entry.type === "wfh" ? "font-semibold text-wfh-ink" : "font-semibold text-pto-ink"}>
                  {TYPE_LABELS[entry.type]}
                </span>
                {" · "}
                {PORTION_LABELS[entry.portion]}
              </span>
              <span data-testid="week-row-tooltip-dates">{range}</span>
              <span data-testid="week-row-tooltip-status" data-status={entry.status}>
                {STATUS_LABELS[entry.status]}
                {entry.tentative ? " · Tentative" : ""}
              </span>
              {approver ? (
                <span data-testid="week-row-tooltip-approver" data-approver-id={approver.id}>
                  ⭐ Approved by {approver.displayName}
                </span>
              ) : null}
              {hasNote ? (
                <span data-testid="week-row-tooltip-note" className="whitespace-pre-line break-words italic text-ink">
                  {entry.note}
                </span>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

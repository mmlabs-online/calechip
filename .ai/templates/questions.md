---
doc_version: 1
last_updated: 2026-09-01
governed_by: [RULE-11, RULE-12, RULE-14, RULE-15, RULE-16]
---

# Template: questions

Written as `99-questions.md` in the ticket folder. This is the **only** channel between agents —
there is no live message API. See `.ai/standards/session-model.md`.

**The format below is parsed, not decorative.** `.claude/hooks/chat-guard.mjs` reads `to:` to enforce
RULE-12 and counts entries to enforce RULE-15. An entry written without a `to:` line is invisible to
the guard, so it is not a shortcut — it is an unguarded conversation, and a reviewer finding one
should treat the artifact it produced as unsourced.

Append one block per question. Never rewrite an earlier block: the file is a record, and a question
that turned out to be wrong is more useful than a question that was quietly deleted.

---

```markdown
---
from: developer
to: tech-lead-design
asked_at: 2026-08-11T10:00:00Z
---

**Q.** <the question, answerable as written by someone who has not read your working notes>

**A.** <the answer, written by the addressed agent>

**Amended:** `01-plan.md` §4 — <what changed>, or `none — the artifact was already correct`
```

## Rules of use

**Ask backwards, never forwards.** Every allowed edge points toward whoever declared intent. The
topology table is in `.ai/01-operating-model.md`; the three forbidden pairs are blocked by the hook
and the rest are governed by the table.

**Answering is amending.** If the answer contains information that belongs in the story or the
design, it goes into that artifact and gets a `## Changelog` line there (RULE-14). Answering here
alone is prohibited — that is how the real specification ends up living in a transcript.

If the answer needed no amendment, write `none — the artifact was already correct`. That is a
legitimate outcome and a measured one: the amendment rate is a tracked metric, and ADR-001 names the
threshold below which the chat model is reverted.

**Each question stands alone** (RULE-16). "As discussed" and equivalents are banned here too. The
addressee may be a session that has never seen your context, and six tickets from now the reader
certainly has not.

**The budget is six per pair per ticket** (RULE-15). Exhausting it produces a BLOCKED artifact, not a
seventh question. Running out of budget is a signal that the upstream artifact is inadequate and a
human should look at it — not an obstacle to route around.

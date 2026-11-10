// EVT-14 — the way back to a page after signing in. 01-plan.md § 2 AC-7, AC-9; § 4.1.
//
// **THE RETURN-TO IS READ FROM THE URL, SO IT IS ATTACKER-CHOSEN.** A phishing link
// `/signin?next=https://evil.example` must land on `/`, never off this origin. `safeReturnTo` accepts
// a path on this origin and nothing else; every other value is `/`, which is where `/signin` sent a
// signed-in caller before this ticket (AC-10).
//
// Pure: no router, no `window`. The only writer of the parameter is the guest page; `App.tsx`'s
// `/signin` route is the only reader.

/** EVT-14 AC-9. The query parameter `/signin` reads, and the only name for it. */
export const RETURN_TO_PARAM = "next";

/** U+0000..U+001F, U+007F, or any whitespace character. A loop rather than a regex class, which
 *  `no-control-regex` refuses. */
function hasControlOrSpace(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    if (code <= 0x1f || code === 0x7f || /\s/.test(ch)) return true;
  }
  return false;
}

/**
 * EVT-14 AC-9. `raw` when it is a path on this origin, otherwise "/".
 * A path on this origin: begins with exactly one "/", the next character is neither "/" nor "\",
 * and it contains no "\", no character in U+0000..U+001F or U+007F, and no whitespace.
 * Takes the value as `URLSearchParams.get` returns it — already percent-decoded — and never decodes
 * again.
 */
export function safeReturnTo(raw: string | null): string {
  if (raw === null || !raw.startsWith("/")) return "/";
  // "//host" and "/\host" are protocol-relative to a browser; a "\" anywhere is read as "/" by some.
  if (raw[1] === "/" || raw.includes("\\")) return "/";
  if (hasControlOrSpace(raw)) return "/";
  return raw;
}

/** EVT-14 AC-7. The `/signin` address that returns to `path`: "/signin?next=" + encodeURIComponent(path). */
export function signInReturningTo(path: string): string {
  return `/signin?${RETURN_TO_PARAM}=${encodeURIComponent(path)}`;
}

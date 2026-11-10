// EVT-14 — the return-to `/signin` honours. 01-plan.md § 2 AC-7, AC-9; § 4.1.
//
// AC-9 is the only security-relevant rule in the ticket: a value read from the URL is attacker-chosen,
// so every value that is not a path on this origin must come back as "/". The refusal list below is
// AC-9's own list, one case each, plus the boundaries of each clause of the rule.
import { describe, expect, it } from "vitest";
import { RETURN_TO_PARAM, safeReturnTo, signInReturningTo } from "@/lib/return-to";

const TOKEN = "a".repeat(64);

describe("safeReturnTo — accepted (AC-9)", () => {
  it.each([
    "/",
    `/guest/${TOKEN}`,
    "/events/e0000000-0000-4000-8000-000000000001",
    "/year/2026/members?team=x#top",
    "/a/b%2Fc",
  ])("%s is a path on this origin and is returned as it is", (raw) => {
    expect(safeReturnTo(raw)).toBe(raw);
  });
});

describe("safeReturnTo — refused, to / (AC-9)", () => {
  it.each([
    ["absent", null],
    ["empty", ""],
    ["protocol-relative", "//evil.example"],
    ["protocol-relative with a path", "//evil.example/guest/x"],
    ["backslash after the slash", "/\\evil.example"],
    ["an absolute URL", "https://evil.example"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a bare host", "evil.example"],
    ["a relative path", "guest/x"],
    ["a newline once decoded", "/a\nb"],
    ["a carriage return", "/a\rb"],
    ["a tab", "/a\tb"],
    ["NUL", "/a\u0000b"],
    ["DEL", "/a\u007fb"],
    ["a space", "/a b"],
    ["a no-break space", "/a b"],
    ["a backslash later in the path", "/guest/\\evil.example"],
    ["a backslash at the end", "/guest\\"],
  ])("%s", (_, raw) => {
    expect(safeReturnTo(raw)).toBe("/");
  });

  it("/a%0Ab arrives decoded from URLSearchParams and is refused", () => {
    const raw = new URLSearchParams("next=/a%0Ab").get(RETURN_TO_PARAM);
    expect(raw).toBe("/a\nb");
    expect(safeReturnTo(raw)).toBe("/");
  });

  it("never decodes again: a still-encoded value is taken literally", () => {
    // "%2F%2Fevil.example" is not a path that begins with "/", so it is refused rather than decoded.
    expect(safeReturnTo("%2F%2Fevil.example")).toBe("/");
    // An encoded "//" inside an accepted path stays encoded and stays on this origin.
    expect(safeReturnTo("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });

  it("whatever it returns resolves on this origin", () => {
    const origin = "https://calechip.example";
    for (const raw of ["//evil.example", "/\\evil.example", "https://evil.example", "/guest/x", "/%2F%2Fevil"]) {
      expect(new URL(safeReturnTo(raw), origin).origin).toBe(origin);
    }
  });
});

describe("signInReturningTo (AC-7)", () => {
  it("names /signin with the path URL-encoded in the one parameter", () => {
    expect(RETURN_TO_PARAM).toBe("next");
    expect(signInReturningTo(`/guest/${TOKEN}`)).toBe(`/signin?next=%2Fguest%2F${TOKEN}`);
  });

  it("round-trips through URLSearchParams and safeReturnTo to the same path", () => {
    const path = `/guest/${TOKEN}`;
    const query = new URL(signInReturningTo(path), "https://calechip.example").searchParams;
    expect(safeReturnTo(query.get(RETURN_TO_PARAM))).toBe(path);
  });
});

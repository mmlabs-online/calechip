// EVT-10 — the description's sanitiser policy, its two boundaries, and the conversion migration.
//
// **VITEST RUNS IN `node`, WITH NO DOM** (`vite.config.ts` `environment: "node"`), and no emulator
// was added (01-plan.md § 8 alternative 5). So this file asserts what is DATA or a FILE: the policy
// constants, the fail-closed path, the source tree (AC-12) and the migration's text (AC-10, AC-11).
// What DOMPurify does with the policy is asserted in a real browser, on both surfaces, by
// `tests/e2e/evt-10-description.spec.ts` (AC-7, AC-8, AC-9).
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_ATTRIBUTES,
  DESCRIPTION_HREF,
  DESCRIPTION_IMAGE_SRC,
  DESCRIPTION_STYLES,
  DESCRIPTION_TAGS,
  LINK_REL,
  LINK_TARGET,
  sanitizeDescription,
} from "@/components/DescriptionHtml";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = path.join(ROOT, "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

function rel(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function filesContaining(needle: string | RegExp): string[] {
  return sourceFiles(SRC)
    .filter((file) => {
      const text = readFileSync(file, "utf8");
      return typeof needle === "string" ? text.includes(needle) : needle.test(text);
    })
    .map(rel)
    .sort();
}

describe("EVT-10 § 4.1 — the allow-list is exactly the plan's", () => {
  it("tags", () => {
    // EVT-11 § 4.3 added `img`, and nothing else.
    expect([...DESCRIPTION_TAGS]).toEqual([
      "p", "br", "strong", "em", "u", "s", "h2", "h3", "ul", "ol", "li", "blockquote", "a", "span",
      "img",
    ]);
    for (const banned of ["h1", "script", "style", "iframe", "svg", "picture", "source"]) {
      expect(DESCRIPTION_TAGS as readonly string[]).not.toContain(banned);
    }
  });

  it("attributes per tag", () => {
    expect(DESCRIPTION_ATTRIBUTES).toEqual({
      a: ["href", "target", "rel"],
      p: ["style"],
      h2: ["style"],
      h3: ["style"],
      span: ["style"],
      ol: ["start"],
      img: ["src", "alt"],
    });
  });

  it("links are http, https or mailto, any letter case (AC-7)", () => {
    expect(DESCRIPTION_HREF.source).toBe("^(?:https?:|mailto:)");
    expect(DESCRIPTION_HREF.flags).toBe("i");
    for (const ok of ["https://a.b", "HTTP://a.b", "mailto:x@y.z", "MailTo:x@y.z"]) {
      expect(DESCRIPTION_HREF.test(ok), ok).toBe(true);
    }
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://a.b", "example.com", "//a.b"]) {
      expect(DESCRIPTION_HREF.test(bad), bad).toBe(false);
    }
  });

  it("style declarations per tag", () => {
    expect(Object.keys(DESCRIPTION_STYLES).sort()).toEqual(["h2", "h3", "p", "span"]);
    for (const tag of ["p", "h2", "h3"]) {
      expect(Object.keys(DESCRIPTION_STYLES[tag]!)).toEqual(["text-align"]);
      expect(DESCRIPTION_STYLES[tag]!["text-align"]!.source).toBe("^(?:left|center|right)$");
    }
    expect(Object.keys(DESCRIPTION_STYLES.span!)).toEqual(["color"]);
    const color = DESCRIPTION_STYLES.span!.color!;
    expect(color.test("#be123c")).toBe(true);
    expect(color.test("rgb(190, 18, 60)")).toBe(true);
    expect(color.test("red")).toBe(false);
    expect(color.test("#be123c; position: fixed")).toBe(false);
    expect(DESCRIPTION_STYLES.p!["text-align"]!.test("justify")).toBe(false);
  });

  it("every link's target and rel are Tiptap's own defaults", () => {
    expect(LINK_TARGET).toBe("_blank");
    expect(LINK_REL).toBe("noopener noreferrer nofollow");
  });
});

describe("EVT-11 AC-7 — a picture's src is an embedded PNG, JPEG or WebP and nothing else", () => {
  it("accepts base64 PNG, JPEG and WebP data: URLs", () => {
    for (const ok of [
      "data:image/png;base64,iVBORw0KGgo=",
      "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
      "data:image/webp;base64,UklGRhYAAABXRUJQ",
    ]) {
      expect(DESCRIPTION_IMAGE_SRC.test(ok), ok).toBe(true);
    }
  });

  it("refuses a remote, SVG, non-base64, non-image or malformed source", () => {
    for (const bad of [
      "https://example.com/a.png",
      "http://example.com/a.png",
      "//example.com/a.png",
      "data:image/svg+xml;base64,PHN2Zz4=",
      "data:image/png,rawbytes",
      "data:text/html;base64,PHNjcmlwdD4=",
      "data:image/gif;base64,R0lGODlh",
      "DATA:IMAGE/PNG;BASE64,iVBORw0KGgo=",
      "data:image/png;base64,iVBOR w0KGgo=",
      'data:image/png;base64,iVBORw0KGgo=" onerror="x',
      "data:image/png;base64,",
      "javascript:alert(1)",
    ]) {
      expect(DESCRIPTION_IMAGE_SRC.test(bad), bad).toBe(false);
    }
  });

  it("the sanitiser narrows src on img with DESCRIPTION_IMAGE_SRC, and drops an img left without one", () => {
    const text = readFileSync(path.join(SRC, "components", "DescriptionHtml.tsx"), "utf8");
    expect(text).toMatch(/tag === "img" && event\.attrName === "src" && !DESCRIPTION_IMAGE_SRC\.test\(event\.attrValue\)/);
    expect(text).toContain('body.querySelectorAll("img:not([src])")');
    // Links still refuse `data:` — the URI regexp is unchanged.
    expect(text).toContain("ALLOWED_URI_REGEXP: DESCRIPTION_HREF");
  });
});

describe("EVT-10 § 4.1 — the sanitiser fails closed", () => {
  it("returns an empty string, never the input, where there is no window", () => {
    expect(typeof window).toBe("undefined");
    expect(sanitizeDescription("<p>ok</p><script>x()</script>")).toBe("");
  });
});

describe("EVT-10 AC-12 — one render, one sanitiser, one editor", () => {
  it("dangerouslySetInnerHTML appears only in DescriptionHtml", () => {
    expect(filesContaining("dangerouslySetInnerHTML")).toEqual([
      "src/components/DescriptionHtml.tsx",
    ]);
  });

  it("dompurify is imported only by DescriptionHtml", () => {
    expect(filesContaining('from "dompurify"')).toEqual(["src/components/DescriptionHtml.tsx"]);
  });

  it("@tiptap is imported only by DescriptionEditor", () => {
    expect(filesContaining('from "@tiptap/')).toEqual(["src/components/DescriptionEditor.tsx"]);
  });

  it("both surfaces render the description through DescriptionHtml, and no longer as plain text", () => {
    const surfaces: [string, string][] = [
      ["src/routes/EventDetail.tsx", "event-description"],
      ["src/routes/GuestEvent.tsx", "guest-event-description"],
    ];
    for (const [file, testId] of surfaces) {
      const text = readFileSync(path.join(ROOT, file), "utf8");
      expect(text, file).toContain(`<DescriptionHtml html={event.description} testId="${testId}" />`);
      // A JSX child `{event.description}` — the plain-text render — and not the prop `={…}`.
      expect(text, file).not.toMatch(/[^=]\{event\.description\}/);
      expect(text, file).not.toMatch(/whitespace-pre-wrap[^\n]*description|description[^\n]*whitespace-pre-wrap/);
    }
  });

  it("no other file under src/ renders a description field", () => {
    // Any `{x.description}` drawn as a JSX child; `html={event.description}` is a prop, not a render.
    expect(filesContaining(/[^=]\{\w+\.description\}/)).toEqual([]);
  });

  it("event email is not touched: send-event-email never reads the description", () => {
    const dir = path.join(ROOT, "supabase", "functions", "send-event-email");
    for (const file of readdirSync(dir)) {
      expect(readFileSync(path.join(dir, file), "utf8"), file).not.toContain("description");
    }
  });
});

describe("EVT-10 AC-10, AC-11 — the conversion migration", () => {
  const sql = readFileSync(
    path.join(ROOT, "supabase", "migrations", "20261012230000_evt10_description_html.sql"),
    "utf8",
  );
  // Comments carry the words this file must not contain as code; strip whole-line `--` comments.
  const body = sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  it("is one transaction", () => {
    expect(body.trim().startsWith("begin;")).toBe(true);
    expect(body.trim().endsWith("commit;")).toBe(true);
  });

  it("disables both triggers before the first update and re-enables them after the last", () => {
    const firstUpdate = body.indexOf("update public.event");
    const lastUpdate = body.lastIndexOf("update public.event");
    for (const trigger of ["event_stamp", "notify_event_updated"]) {
      const off = body.indexOf(`alter table public.event disable trigger ${trigger};`);
      const on = body.indexOf(`alter table public.event enable trigger ${trigger};`);
      expect(off, trigger).toBeGreaterThan(-1);
      expect(on, trigger).toBeGreaterThan(-1);
      expect(off, trigger).toBeLessThan(firstUpdate);
      expect(on, trigger).toBeGreaterThan(lastUpdate);
    }
  });

  it("never writes updated_at", () => {
    expect(body).not.toContain("updated_at");
  });

  it("escapes & before < and >", () => {
    const amp = body.indexOf("'&', '&amp;'");
    expect(amp).toBeGreaterThan(-1);
    expect(amp).toBeLessThan(body.indexOf("'<', '&lt;'"));
    expect(amp).toBeLessThan(body.indexOf("'>', '&gt;'"));
  });

  it("turns blank into null, and guards re-application on the leading block tag", () => {
    expect(body).toContain("set description = null");
    expect(body).toContain("e.description !~ '^\\s*<(p|h2|h3|ul|ol|blockquote)[ >]'");
  });
});

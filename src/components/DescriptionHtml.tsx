// EVT-10, ADR-056 decisions 2 and 3. **THE ONE SANITISER AND THE ONE RENDER OF AN EVENT'S
// DESCRIPTION.** The description is HTML stored as text, and nothing stops a caller writing any HTML
// they like straight to the API (ADR-005). So the security layer is here, in every reader's browser,
// between the stored value and the DOM — on the event's page and on the anon-readable guest page
// alike (AC-8). The form's sanitise before saving uses the same function, but only as defence in
// depth: no criterion rests on it (AC-9).
//
// **THIS IS THE ONLY `dangerouslySetInnerHTML` UNDER `src/`, AND THE ONLY IMPORT OF `dompurify`**
// (AC-12) — `tests/description-html.test.ts` scans the tree for both.
import DOMPurify, { type DOMPurify as DOMPurifyInstance } from "dompurify";
import type { JSX } from "react";

/** ADR-056 decision 2. THE allow-list — the one the render and the form's save both use. A tag not
 *  here is removed and its text kept (DOMPurify's default), except `script`, `style` and the like,
 *  whose contents DOMPurify drops. EVT-11 added `img`, with `data:` sources only
 *  (DESCRIPTION_IMAGE_SRC); nothing else joins without an ADR. */
export const DESCRIPTION_TAGS = [
  "p", "br", "strong", "em", "u", "s", "h2", "h3", "ul", "ol", "li", "blockquote", "a", "span",
  "img",
] as const;

/** Attributes allowed, per tag. Anything not listed for a tag is removed from it. */
export const DESCRIPTION_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  a: ["href", "target", "rel"],
  p: ["style"],
  h2: ["style"],
  h3: ["style"],
  span: ["style"],
  ol: ["start"],
  img: ["src", "alt"],
};

/** AC-7. Checked against `href` only. */
export const DESCRIPTION_HREF = /^(?:https?:|mailto:)/i;

/** EVT-11 AC-7. The only `src` an `img` may carry: an embedded base64 PNG, JPEG or WebP. A remote
 *  `src` would make every reader's browser fetch a URL; an SVG can carry script. */
export const DESCRIPTION_IMAGE_SRC = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** The `style` declarations allowed, per tag, and the value each may take. A `style` is rebuilt
 *  from these alone, in the form Tiptap writes it — `text-align: center`, `color: #be123c` — so a
 *  description saved by the editor is unchanged by the sanitiser (AC-4). No declaration left: the
 *  attribute is removed. */
export const DESCRIPTION_STYLES: Readonly<Record<string, Readonly<Record<string, RegExp>>>> = {
  p: { "text-align": /^(?:left|center|right)$/ },
  h2: { "text-align": /^(?:left|center|right)$/ },
  h3: { "text-align": /^(?:left|center|right)$/ },
  span: { color: /^(?:#[0-9a-f]{6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i },
};

/** What every link carries after sanitising, whatever it carried before (AC-7). Tiptap's own
 *  defaults (`@tiptap/extension-link` 3.31.4, `addOptions().HTMLAttributes`), so AC-4 holds. */
export const LINK_TARGET = "_blank";
export const LINK_REL = "noopener noreferrer nofollow";

const ALLOWED_ATTR = [...new Set(Object.values(DESCRIPTION_ATTRIBUTES).flat())];

/** Rebuilds a `style` value from the declarations DESCRIPTION_STYLES allows on `tag`, in the order
 *  the policy lists them. A declaration that appears twice keeps its last value, as CSS would. */
function rebuildStyle(tag: string, style: string): string {
  const allowed = DESCRIPTION_STYLES[tag];
  if (!allowed) return "";
  const found = new Map<string, string>();
  for (const declaration of style.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    const pattern = allowed[property];
    if (pattern && pattern.test(value)) found.set(property, value);
  }
  return Object.keys(allowed)
    .filter((property) => found.has(property))
    .map((property) => `${property}: ${found.get(property)}`)
    .join("; ");
}

// Built on first use, never at import: Vitest imports this module under `node`, where there is no
// `window`. Its own instance, so the hooks below never reach another caller's DOMPurify.
let purifier: DOMPurifyInstance | null = null;

function getPurifier(): DOMPurifyInstance | null {
  if (purifier) return purifier;
  if (typeof window === "undefined") return null;
  const instance = DOMPurify(window);
  if (!instance.isSupported) return null;

  instance.addHook("uponSanitizeAttribute", (node, event) => {
    const tag = node.nodeName.toLowerCase();
    if (!(DESCRIPTION_ATTRIBUTES[tag] ?? []).includes(event.attrName)) {
      event.keepAttr = false;
      return;
    }
    if (event.attrName === "style") {
      event.attrValue = rebuildStyle(tag, event.attrValue);
      if (event.attrValue === "") event.keepAttr = false;
    }
    // EVT-11 AC-7. DOMPurify lets any `data:` `src` through on `img` (its DATA_URI_TAGS exception,
    // which ignores ALLOWED_URI_REGEXP), and `https:` through by DESCRIPTION_HREF. This narrows both.
    if (tag === "img" && event.attrName === "src" && !DESCRIPTION_IMAGE_SRC.test(event.attrValue)) {
      event.keepAttr = false;
    }
  });

  // AC-7. Setting an attribute on the node being visited is safe inside the walk; moving its
  // children is not (they would land behind the iterator, unvisited) — that half is in
  // `sanitizeDescription`, after the walk.
  instance.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName.toLowerCase() !== "a" || !node.hasAttribute("href")) return;
    node.setAttribute("target", LINK_TARGET);
    node.setAttribute("rel", LINK_REL);
  });

  purifier = instance;
  return purifier;
}

/** ADR-056 decisions 2 and 3. The one sanitiser. Pure string in, string out. Fails closed: no
 *  `window`, or a browser DOMPurify does not support, returns `""` — never the input. */
export function sanitizeDescription(html: string): string {
  const instance = getPurifier();
  if (!instance) return "";
  const body = instance.sanitize(html, {
    ALLOWED_TAGS: [...DESCRIPTION_TAGS],
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: DESCRIPTION_HREF,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_DOM: true,
    // DOMPurify types a returned DOM as `Node`; it is the `body` it parsed into.
  }) as HTMLElement;
  // AC-7. A link whose `href` did not survive is not a link: its text stays, the `a` goes.
  for (const anchor of Array.from(body.querySelectorAll("a:not([href])"))) {
    anchor.replaceWith(...Array.from(anchor.childNodes));
  }
  // EVT-11 AC-7. A picture whose `src` did not survive is not a picture.
  for (const image of Array.from(body.querySelectorAll("img:not([src])"))) image.remove();
  return body.innerHTML;
}

/** § 2b. Body text, formatted — no card, no border. The child spacing is here rather than in
 *  `index.css` so the render's look lives beside the allow-list it draws; the editor's text area
 *  wears the same classes, so what is typed is what is shown. */
export const DESCRIPTION_RENDER_CLASS =
  "break-words text-sm text-ink [&>:first-child]:mt-0 [&>:last-child]:mb-0 " +
  "[&_p]:my-2 [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-extrabold " +
  "[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-bold " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-ink-2 " +
  "[&_a]:font-semibold [&_a]:text-ink [&_a]:underline " +
  // EVT-11 § 2b. A picture is a block of its own, never wider than the text.
  "[&_img]:my-2 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl";

/** ADR-056 decision 2. THE render of a description. Draws nothing when `html` is null or sanitises
 *  to "" (EVT-01 AC-2: no description, no block). */
export function DescriptionHtml({
  html,
  testId,
}: {
  html: string | null;
  testId: string;
}): JSX.Element | null {
  if (html === null) return null;
  const clean = sanitizeDescription(html);
  if (clean === "") return null;
  return (
    <div data-testid={testId} className={DESCRIPTION_RENDER_CLASS} dangerouslySetInnerHTML={{ __html: clean }} />
  );
}

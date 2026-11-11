// MIR-19-b — how a spec reads an in-app link or the page's own path once an address may carry an org.
//
// NOT A SPEC FILE: `playwright.config.ts` collects `.*\.spec\.ts$` only. It has no runtime import (the
// only import is a type, erased by the compiler) so vitest can load it without the Playwright runner.
// It does not import from `src/`: a check that used the product's own `splitOrgPath` could not catch
// that function being wrong.
import type { Locator, Page } from "@playwright/test";

/**
 * The org code of Org public, the org every fixture member is in (ADR-097 Consequences). MIR-19-b.
 * The only code stripped: a spec that stripped any org-shaped segment would pass at another org's address.
 */
export const E2E_ORG_CODE = "shared";

const ORG_SEGMENT = `/${E2E_ORG_CODE}`;

/**
 * `path` with one leading `/shared` segment removed. `path` is a pathname, optionally followed by
 * `?search` and/or `#hash`. A segment is `/shared` when the next character is `/`, `?`, `#` or the
 * end of the string. When removing it leaves nothing, or leaves a string that starts with `?` or `#`,
 * a `/` is put in front. Anything else, including a string that does not start with `/`, is returned
 * unchanged. Examples: 01-plan.md AC-1.
 */
export function stripOrg(path: string): string {
  if (!path.startsWith(ORG_SEGMENT)) return path;
  const rest = path.slice(ORG_SEGMENT.length);
  if (rest === "") return "/";
  const next = rest[0];
  if (next === "/") return rest;
  if (next === "?" || next === "#") return `/${rest}`;
  return path;
}

/** `stripOrg(new URL(page.url()).pathname)`. Pathname only: no search and no hash. Synchronous. */
export function appPathname(page: Pick<Page, "url">): string {
  return stripOrg(new URL(page.url()).pathname);
}

/**
 * `stripOrg` of the locator's `href` attribute, or `null` when it has none. It reads once through
 * `locator.getAttribute("href")`, so a spec polls it: `await expect.poll(() => appHref(x)).toBe(P)`.
 */
export async function appHref(locator: Pick<Locator, "getAttribute">): Promise<string | null> {
  const href = await locator.getAttribute("href");
  return href === null ? null : stripOrg(href);
}

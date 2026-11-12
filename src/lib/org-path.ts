// MIR-19, ADR-097 — the org address. 01-plan.md § 4.2. Imports nothing.
//
// Pure string functions: the router's basename is the URL's org segment, and this file is the one
// place that says what an org segment looks like. It is a COPY of the database's rule, not a second
// rule: `tests/org-path.test.ts` reads the migration and fails when the two lists drift.

/** `org_code_shape` (20261027120000_mir11_composite_foreign_keys.sql:44-47), reproduced. */
export const ORG_CODE_SHAPE: RegExp = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;

/**
 * `org_code_not_reserved` as of 20261111150000_mir19_own_org_code.sql: the 50 MIR-11 tokens in their
 * order, then "tasks". A copy; the member app may not import src/lib/data/system.ts (MIR-18 AC-14).
 */
export const RESERVED_ORG_CODES: readonly string[] = [
  "system", "api", "admin", "login", "signin", "signup", "app",
  "static", "public", "assets", "healthz", "fonts", "images",
  "_next", "index.html",
  "signups", "members", "entries", "month", "week", "year",
  "setting", "threshold", "teams", "reports", "holidays",
  "events", "profile", "guest",
  "auth", "billing", "calechip", "calendar", "create", "dashboard",
  "dev", "docs", "help", "invite", "join", "logout", "manage",
  "new", "onboarding", "org", "orgs", "settings", "support",
  "team", "www",
  "tasks",
];

/** True when `segment` matches ORG_CODE_SHAPE, is 2..32 characters, and is not in RESERVED_ORG_CODES. */
export function isOrgCode(segment: string): boolean {
  return (
    segment.length >= 2 &&
    segment.length <= 32 &&
    ORG_CODE_SHAPE.test(segment) &&
    !RESERVED_ORG_CODES.includes(segment)
  );
}

export interface OrgPath {
  /** The first segment when isOrgCode(it), else null. */
  orgCode: string | null;
  /** The pathname with that segment removed; "/" when nothing is left. The input unchanged when orgCode is null. */
  rest: string;
}

/**
 * "/shared/month/2026-10" → { orgCode: "shared", rest: "/month/2026-10" }
 * "/shared" and "/shared/" → { orgCode: "shared", rest: "/" }
 * "/month/2026-10" → { orgCode: null, rest: "/month/2026-10" };  "/" → { orgCode: null, rest: "/" }
 */
export function splitOrgPath(pathname: string): OrgPath {
  const match = /^\/([^/]+)(\/.*)?$/.exec(pathname);
  const first = match?.[1];
  if (!match || first === undefined || !isOrgCode(first)) return { orgCode: null, rest: pathname };
  return { orgCode: first, rest: match[2] ?? "/" };
}

/** "/" + orgCode + rest, with rest "/" giving "/" + orgCode. orgPath("shared", "/year") === "/shared/year". */
export function orgPath(orgCode: string, rest: string): string {
  return rest === "/" || rest === "" ? `/${orgCode}` : `/${orgCode}${rest}`;
}

/** The router basename for a pathname: "/" + orgCode when splitOrgPath finds one, else "/". */
export function routerBase(pathname: string): string {
  const { orgCode } = splitOrgPath(pathname);
  return orgCode === null ? "/" : `/${orgCode}`;
}

/** MIR-19-d, ADR-097 decisions 1 and 6. First path segments that stay at the root for everybody:
 *  the two account addresses and the guest links. */
export const ROOT_ONLY_SEGMENTS: readonly string[] = ["signin", "signup", "guest"];

/**
 * MIR-19-d, ADR-097 decision 5.2. The address a member of `orgCode` is sent to from the root address
 * `pathname` + `suffix`: `orgPath(orgCode, pathname) + suffix`. `null` when that pathname is not sent:
 * its first segment is an org code (`splitOrgPath(pathname).orgCode !== null`), or is in
 * ROOT_ONLY_SEGMENTS. `suffix` is the search and the hash, appended unchanged.
 *
 * ownOrgAddress("shared", "/", "") === "/shared"
 * ownOrgAddress("shared", "/month/2026-10", "?team=x") === "/shared/month/2026-10?team=x"
 * ownOrgAddress("shared", "/events", "?probe=1#top") === "/shared/events?probe=1#top"
 * ownOrgAddress("shared", "/no/such/page", "") === "/shared/no/such/page"
 * ownOrgAddress("shared", "/signins", "") === "/shared/signins"
 * ownOrgAddress("shared", "/signin", "?next=%2Fevents") === null
 * ownOrgAddress("shared", "/signup", "") === null
 * ownOrgAddress("shared", "/guest", "") === null
 * ownOrgAddress("shared", "/guest/abc", "") === null
 * ownOrgAddress("shared", "/shared/week", "") === null
 * ownOrgAddress("shared", "/acme/week", "") === null
 */
export function ownOrgAddress(orgCode: string, pathname: string, suffix: string): string | null {
  if (splitOrgPath(pathname).orgCode !== null) return null;
  const first = /^\/([^/]*)/.exec(pathname)?.[1] ?? "";
  if (ROOT_ONLY_SEGMENTS.includes(first)) return null;
  return orgPath(orgCode, pathname) + suffix;
}

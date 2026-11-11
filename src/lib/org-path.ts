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

// MIR-17-g, ADR-096 — the admin screens' in-place refusals are the role guards, and the router
// guards membership only. A source-text test, the shape of `tests/role-guards.test.ts`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** Comments removed: `//` lines and `/* … *\/` blocks, which includes JSX `{/* … *\/}`. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Whitespace collapsed to one space, and the space just inside `{` and `}` removed, so a
 *  route's `element={ … }` written over several lines compares equal to the one-line form. */
function normalise(code: string): string {
  return code.replace(/\s+/g, " ").replace(/\{ /g, "{").replace(/ \}/g, "}");
}

type RoleHelper = "mayAdminister" | "mayDecide";

interface RefusingRoute {
  path: string;
  element: string;
  file: string;
  asks: RoleHelper;
  refusal: string;
}

interface OpenRoute {
  path: string;
  element: string;
  why: string;
}

const MEMBER_ONLY = (screen: string): string =>
  `membership.state === "member" ? <${screen} /> : <Navigate to="/" replace />`;

const REFUSING_ROUTES: readonly RefusingRoute[] = [
  { path: "/signups", element: "<NewSignups />", file: "src/routes/NewSignups.tsx", asks: "mayAdminister", refusal: "signups-refused" },
  { path: "/entries/team", element: MEMBER_ONLY("TeamEntries"), file: "src/routes/TeamEntries.tsx", asks: "mayAdminister", refusal: "team-entries-refused" },
  { path: "/entries/pending", element: MEMBER_ONLY("PendingEntries"), file: "src/routes/PendingEntries.tsx", asks: "mayDecide", refusal: "pending-entries-refused" },
  { path: "/setting", element: MEMBER_ONLY("Threshold"), file: "src/routes/Threshold.tsx", asks: "mayAdminister", refusal: "threshold-refused" },
  { path: "/teams", element: MEMBER_ONLY("Teams"), file: "src/routes/Teams.tsx", asks: "mayAdminister", refusal: "teams-refused" },
  { path: "/admin", element: MEMBER_ONLY("AdminHub"), file: "src/routes/AdminHub.tsx", asks: "mayAdminister", refusal: "admin-hub-refused" },
];

const SIGNED_IN = `membership.state === "signed-out" ? <Navigate to="/" replace /> : <Holidays />`;

const OPEN_ROUTES: readonly OpenRoute[] = [
  { path: "/members", element: "<MemberList />", why: "TEA-03: every signed-in role reads the roster" },
  { path: "/holidays", element: SIGNED_IN, why: "ADM-02: Read the holiday calendar is checked for both roles" },
  { path: "/holidays/:year", element: SIGNED_IN, why: "ADM-02: as /holidays" },
  { path: "/reports", element: MEMBER_ONLY("IssueReports"), why: "MIR-17 AC-3: every role is told where reports go" },
  { path: "/threshold", element: `<Navigate to="/setting" replace />`, why: "a redirect to /setting" },
];

const appSource = readFileSync(repoRoot + "src/App.tsx", "utf8");
const appCode = normalise(stripComments(appSource));

/** The paths inside every `<Route element={<AdminLayout …>}>` … `</Route>` block. The inner routes
 *  are self-closing, so the first `</Route>` after the opening closes the block. */
function adminLayoutPaths(code: string): { blocks: number; paths: string[] } {
  const blocks = code.match(/<Route element=\{<AdminLayout [\s\S]*?<\/Route>/g) ?? [];
  return {
    blocks: blocks.length,
    paths: blocks.flatMap((block) => [...block.matchAll(/path="([^"]+)"/g)].map((m) => m[1] as string)),
  };
}

/** The `element` of the route at `path`, as written between `element={` and the `} />` that closes
 *  the route. `null` when the route is not found. */
function routeElement(code: string, path: string): string | null {
  const escaped = path.replace(/[/:]/g, (c) => `\\${c}`);
  const match = code.match(new RegExp(`path="${escaped}" element=\\{(.*?)\\} \\/>`));
  return match ? (match[1] ?? null) : null;
}

describe("MIR-17-g: every path under AdminLayout is classified", () => {
  it("AC-1: the collected paths equal the refusing and open routes, and blocks were found", () => {
    const { blocks, paths } = adminLayoutPaths(appCode);
    expect(blocks).toBeGreaterThanOrEqual(4);
    const classified = [...REFUSING_ROUTES, ...OPEN_ROUTES].map((r) => r.path);
    expect([...paths].sort()).toEqual([...classified].sort());
  });
});

describe("MIR-17-g: the router asks no rank", () => {
  for (const row of REFUSING_ROUTES) {
    it(`AC-2: ${row.path} reaches its screen`, () => {
      expect(routeElement(appCode, row.path)).toBe(row.element);
    });
  }

  it("AC-2: src/App.tsx imports no role helper and calls none", () => {
    expect(appSource).not.toMatch(/from\s+"@\/lib\/roles"/);
    expect(appCode).not.toContain("mayAdminister(");
    expect(appCode).not.toContain("mayDecide(");
  });

  it("AC-6: the router records the decision", () => {
    expect(appSource).toContain("MIR-17-g, ADR-096");
    expect(appSource).toContain("The role guards are the screens' own refusals.");
  });
});

describe("MIR-17-g: each refusing screen asks its helper and draws its refusal", () => {
  for (const row of REFUSING_ROUTES) {
    it(`AC-3: ${row.file} asks ${row.asks} and renders ${row.refusal}`, () => {
      const source = readFileSync(repoRoot + row.file, "utf8");
      expect(source).toMatch(
        new RegExp(`import\\s*\\{[^}]*\\b${row.asks}\\b[^}]*\\}\\s*from\\s*"@/lib/roles"`),
      );
      const code = stripComments(source);
      expect(code).toContain(`${row.asks}(me.role)`);
      expect(code).toContain('setView({ phase: "refused" })');
      expect(source).toContain(`data-testid="${row.refusal}"`);
    });
  }
});

describe("MIR-17-g: each open route stays open", () => {
  for (const row of OPEN_ROUTES) {
    it(`AC-4: ${row.path} (${row.why})`, () => {
      expect(routeElement(appCode, row.path)).toBe(row.element);
    });
  }
});

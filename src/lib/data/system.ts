// MIR-18 — the system panel's seam. 01-plan.md § 4.4, ADR-074 decision 6.
//
// A SECOND SEAM MODULE, NOT MORE FUNCTIONS ON `DataSeam`. The panel must not carry the member seam,
// and the member app must not carry the panel: this file imports neither `./index`, `./mock` nor
// `./supabase`, and nothing in the member app imports it (AC-14). It sits inside the seam directory
// so the `supabase-client-in-seam` lint rule allows its client (RULE-02).
//
// ITS OWN CLIENT, UNDER ITS OWN `storageKey`. Two clients on one origin with the default key share —
// and on sign-out destroy — one stored session, so a panel sign-out would end the member app's.
// `signOut` is `scope: "local"` for the same reason: it never ends a member's other sessions.
//
// THE DATABASE IS THE CONTROL. `gate()` reaching `signed-in` is an affordance; every system-scope
// read is gated on `public.is_system_admin()`, which requires the row AND `aal2` (ADR-074 decision 4).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DateRange, Holiday, HolidayKind, IssueKind, IssueStatus, Result } from "@/lib/domain/types";
import { HOLIDAY_LIMIT, ISSUE_REPORT_LIMIT } from "@/lib/domain/types";
import { FIXTURE_HOLIDAYS, FIXTURE_ISSUE_REPORT, FIXTURE_MEMBER } from "@/lib/fixtures";

/** Where a panel visitor stands. Each state is one screen (01-plan.md § 2b). */
export type SystemGate =
  | { state: "signed-out" }
  | { state: "not-system-admin" }
  | { state: "enrol"; email: string } // aal1, no verified TOTP factor
  | { state: "verify"; email: string } // aal1, a verified TOTP factor exists
  | { state: "signed-in"; email: string }; // aal2 and is_system_admin() returned true

export interface TotpEnrolment {
  factorId: string;
  /** An image URL — Supabase returns an SVG data URI. */
  qrCode: string;
  secret: string;
}

export interface SystemSeam {
  /** The gate for the current panel session. Never throws: a transport failure is `signed-out`. */
  gate(): Promise<SystemGate>;
  /** Password sign-in. A non-system-admin is signed out again (scope local) and gets `not-system-admin`. */
  signIn(email: string, password: string): Promise<Result<SystemGate>>;
  /** THROWS on failure. Removes any unverified TOTP factor first, then enrols a new one. */
  startEnrolment(): Promise<TotpEnrolment>;
  /** Challenge and verify. `factorId` from `startEnrolment`, or omitted to use the verified factor. */
  verifyCode(code: string, factorId?: string): Promise<Result<SystemGate>>;
  /** Signs out of the panel only — `scope: "local"`. */
  signOut(): Promise<void>;
  /** `rpc("list_orgs")`, mapped to camelCase. Never throws. MIR-18-b. */
  listOrgs(): Promise<OrgResult<OrgSummary[]>>;
  /** `rpc("create_org", { p_org_code, p_name, p_timezone })`. Value is the new id. Never throws. */
  createOrg(input: CreateOrgInput): Promise<OrgResult<string>>;
  /** `rpc("update_org", { p_org_id, p_name, p_max_members, p_max_teams, p_plan, p_licence_expires_on })`. Never throws. */
  updateOrg(input: UpdateOrgInput): Promise<OrgResult<null>>;
  /** `rpc("list_national_holidays", { p_start, p_end })`, ascending, limited to HOLIDAY_LIMIT. Never throws. MIR-15-b. */
  listNationalHolidays(range: DateRange): Promise<HolidayResult<Holiday[]>>;
  /** `rpc("add_national_holiday", { p_date, p_name, p_kind })`. Value is the new id. Never throws. */
  addNationalHoliday(input: NationalHolidayInput): Promise<HolidayResult<string>>;
  /** `rpc("update_national_holiday", { p_id, p_date, p_name, p_kind })`. Never throws. */
  updateNationalHoliday(holidayId: string, input: NationalHolidayInput): Promise<HolidayResult<null>>;
  /** `rpc("delete_national_holiday", { p_id })`. Never throws. */
  deleteNationalHoliday(holidayId: string): Promise<HolidayResult<null>>;
  /** `rpc("list_issue_reports")`, newest first. Never throws. MIR-16. */
  listIssueReports(): Promise<IssueResult<SystemIssueReport[]>>;
  /** `rpc("set_issue_report_status", { p_id, p_status })`. Never throws. */
  setIssueReportStatus(reportId: string, status: IssueStatus): Promise<IssueResult<null>>;
  /** `storage.from("issue-report").createSignedUrls(paths, 3600)`. Same order and length; `null`
   *  where a URL was not minted. Never throws. */
  issueImageUrls(paths: string[]): Promise<(string | null)[]>;
}

// =============================================================================================
// MIR-15-b — Org public's holidays. 01-plan.md § 4.5, ADR-079.
// =============================================================================================

export interface NationalHolidayInput {
  date: string; // yyyy-MM-dd
  name: string; // sent as given; the RPC trims and refuses blank
  kind: HolidayKind;
}

export type HolidayFailureCode =
  | "not_permitted" // 42501
  | "holiday_not_found" // P0002
  | "holiday_date_taken" // 23505
  | "invalid_holiday" // 22023, or the list reached HOLIDAY_LIMIT
  | "network"; // anything else, or a throw

export type HolidayResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: HolidayFailureCode; message: string } };

export const HOLIDAY_FAILURE_MESSAGES: Record<HolidayFailureCode, string> = {
  not_permitted: "You do not have permission to do that.",
  holiday_not_found: "That day is no longer in the calendar. Reload to see the current list.",
  holiday_date_taken: "The calendar already has a row for that date. Edit that row instead.",
  invalid_holiday: "A date and a name are required.",
  network: "Could not reach the server. Try again.",
};

function holidayRefusal(code: HolidayFailureCode): { ok: false; error: { code: HolidayFailureCode; message: string } } {
  return { ok: false, error: { code, message: HOLIDAY_FAILURE_MESSAGES[code] } };
}

// =============================================================================================
// MIR-18-b — org management. 01-plan.md § 4.4, ADR-075.
// =============================================================================================

/** One row of `public.list_orgs()`. ADR-075. */
export interface OrgSummary {
  id: string;
  orgCode: string;
  name: string;
  isSharedTenant: boolean;
  timezone: string;
  maxMembers: number | null;
  maxTeams: number | null;
  plan: string;
  /** `yyyy-MM-dd` in the org's timezone, or null. */
  licenceExpiresOn: string | null;
  createdAt: string;
}

export interface CreateOrgInput {
  orgCode: string;
  name: string;
  timezone: string;
}

export interface UpdateOrgInput {
  orgId: string;
  name: string;
  maxMembers: number | null;
  maxTeams: number | null;
  plan: string;
  licenceExpiresOn: string | null;
}

/** The panel's own refusal codes. Local to the panel: `src/lib/domain/types.ts` is not edited. */
export type OrgFailureCode =
  | "not_permitted" // 42501, P0002
  | "org_code_taken" // 23505
  | "org_code_invalid" // 23514 on org_code_shape or org_code_not_reserved
  | "invalid_org_field" // any other 23514, or 23502; also the panel's own cap parse
  | "unknown_timezone" // 22023
  | "network"; // anything else, or a throw

export type OrgResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: OrgFailureCode; message: string } };

export const ORG_FAILURE_MESSAGES: Record<OrgFailureCode, string> = {
  not_permitted: "You do not have permission to do that.",
  org_code_taken: "That org code is already in use.",
  org_code_invalid:
    "Org codes are 2 to 32 lowercase letters, digits or hyphens, and some words are reserved.",
  invalid_org_field: "A name and a plan are required, and caps are whole numbers of 1 or more.",
  unknown_timezone: "That timezone is not recognised.",
  network: "Could not reach the server. Try again.",
};

function orgRefusal(code: OrgFailureCode): { ok: false; error: { code: OrgFailureCode; message: string } } {
  return { ok: false, error: { code, message: ORG_FAILURE_MESSAGES[code] } };
}

// =============================================================================================
// MIR-16 — issue reports move to the system panel. 01-plan.md § 4.4, ADR-082 decision 1.
// =============================================================================================

/** One row of `public.list_issue_reports()`. ADR-082. */
export interface SystemIssueReport {
  id: string;
  orgId: string;
  orgName: string;
  memberId: string;
  memberName: string | null; // null when the author's member row is gone
  kind: IssueKind;
  message: string;
  page: string;
  status: IssueStatus;
  createdAt: string; // ISO 8601
  images: string[]; // storage paths, in the order written
}

export type IssueFailureCode =
  | "not_permitted" // 42501
  | "issue_not_found" // P0002
  | "network"; // anything else, a throw, or the list reaching ISSUE_REPORT_LIMIT

export type IssueResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: IssueFailureCode; message: string } };

export const ISSUE_FAILURE_MESSAGES: Record<IssueFailureCode, string> = {
  not_permitted: "You do not have permission to do that.",
  issue_not_found: "That report no longer exists. Reload to see the current list.",
  network: "Could not reach the server. Try again.",
};

function issueRefusal(code: IssueFailureCode): { ok: false; error: { code: IssueFailureCode; message: string } } {
  return { ok: false, error: { code, message: ISSUE_FAILURE_MESSAGES[code] } };
}

// The two refusals share `invalid_credentials`: both are a refused credential, and no other existing
// `FailureCode` means that (01-plan.md § 4.4; `types.ts` is not edited).
const WRONG_PASSWORD = "Email or password is incorrect.";
const WRONG_CODE = "That code did not match. Try again.";

// =============================================================================================
// Supabase implementation
// =============================================================================================

const url = () => import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = () => import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

// Lazy, as `supabase.ts` builds the member client: `createClient` throws on an empty URL, and the
// mock build must be able to import this file without one.
let cached: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (!cached) {
    cached = createClient(url(), anonKey(), { auth: { storageKey: "calechip-system-auth" } });
  }
  return cached;
}

async function supabaseGate(): Promise<SystemGate> {
  try {
    const auth = client().auth;
    const { data: sessionData } = await auth.getSession();
    const session = sessionData.session;
    if (!session) return { state: "signed-out" };
    const email = session.user.email ?? "";

    // ADR-074 decision 5: the caller's own row is readable at any assurance level, so a non-admin is
    // turned away before being asked for a code.
    const { data: row, error: rowError } = await client()
      .from("system_admin")
      .select("id")
      .maybeSingle();
    if (rowError) return { state: "signed-out" };
    if (!row) {
      await auth.signOut({ scope: "local" });
      return { state: "not-system-admin" };
    }

    const { data: aal, error: aalError } = await auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) return { state: "signed-out" };
    if (aal.currentLevel === "aal2") {
      const { data: isAdmin, error: rpcError } = await client().rpc("is_system_admin");
      if (rpcError) return { state: "signed-out" };
      return isAdmin === true ? { state: "signed-in", email } : { state: "not-system-admin" };
    }
    if (aal.nextLevel === "aal2") return { state: "verify", email };
    return { state: "enrol", email };
  } catch {
    return { state: "signed-out" };
  }
}

const supabaseSystemSeam: SystemSeam = {
  gate: supabaseGate,

  async signIn(email, password) {
    try {
      const { error } = await client().auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: { code: "invalid_credentials", message: WRONG_PASSWORD } };
    } catch {
      return { ok: false, error: { code: "invalid_credentials", message: WRONG_PASSWORD } };
    }
    return { ok: true, value: await supabaseGate() };
  },

  async startEnrolment() {
    const mfa = client().auth.mfa;
    const { data: factors, error: listError } = await mfa.listFactors();
    if (listError) throw listError;
    for (const factor of factors.all) {
      if (factor.factor_type === "totp" && factor.status === "unverified") {
        const { error } = await mfa.unenroll({ factorId: factor.id });
        if (error) throw error;
      }
    }
    const { data, error } = await mfa.enroll({ factorType: "totp" });
    if (error) throw error;
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  },

  async verifyCode(code, factorId) {
    const refused = { ok: false as const, error: { code: "invalid_credentials" as const, message: WRONG_CODE } };
    try {
      const mfa = client().auth.mfa;
      let id = factorId;
      if (!id) {
        const { data: factors, error } = await mfa.listFactors();
        if (error) return refused;
        id = factors.totp[0]?.id;
      }
      if (!id) return refused;
      const { error } = await mfa.challengeAndVerify({ factorId: id, code });
      if (error) return refused;
    } catch {
      return refused;
    }
    return { ok: true, value: await supabaseGate() };
  },

  async signOut() {
    try {
      await client().auth.signOut({ scope: "local" });
    } catch {
      // A failed sign-out leaves nothing to show; the next `gate()` reads the truth.
    }
  },

  async listOrgs() {
    try {
      const { data, error } = await client().rpc("list_orgs");
      if (error) return orgRefusal(orgFailureCode(error));
      const rows = (data ?? []) as OrgRow[];
      return { ok: true, value: rows.map(toOrgSummary) };
    } catch {
      return orgRefusal("network");
    }
  },

  async createOrg(input) {
    try {
      const { data, error } = await client().rpc("create_org", {
        p_org_code: input.orgCode,
        p_name: input.name,
        p_timezone: input.timezone,
      });
      if (error) return orgRefusal(orgFailureCode(error));
      return { ok: true, value: data as string };
    } catch {
      return orgRefusal("network");
    }
  },

  async updateOrg(input) {
    try {
      const { error } = await client().rpc("update_org", {
        p_org_id: input.orgId,
        p_name: input.name,
        p_max_members: input.maxMembers,
        p_max_teams: input.maxTeams,
        p_plan: input.plan,
        p_licence_expires_on: input.licenceExpiresOn,
      });
      if (error) return orgRefusal(orgFailureCode(error));
      return { ok: true, value: null };
    } catch {
      return orgRefusal("network");
    }
  },

  async listNationalHolidays(range) {
    try {
      const { data, error } = await client()
        .rpc("list_national_holidays", { p_start: range.start, p_end: range.end })
        .limit(HOLIDAY_LIMIT);
      if (error) return holidayRefusal(holidayFailureCode(error));
      const rows = (data ?? []) as HolidayRpcRow[];
      // ADM-02's truncation rule for `listHolidays`: a list at the limit may be short, and a short
      // calendar is a wrong one, so it is not shown.
      if (rows.length >= HOLIDAY_LIMIT) return holidayRefusal("network");
      return { ok: true, value: rows.map(toNationalHoliday) };
    } catch {
      return holidayRefusal("network");
    }
  },

  async addNationalHoliday(input) {
    try {
      const { data, error } = await client().rpc("add_national_holiday", {
        p_date: input.date,
        p_name: input.name,
        p_kind: input.kind,
      });
      if (error) return holidayRefusal(holidayFailureCode(error));
      return { ok: true, value: data as string };
    } catch {
      return holidayRefusal("network");
    }
  },

  async updateNationalHoliday(holidayId, input) {
    try {
      const { error } = await client().rpc("update_national_holiday", {
        p_id: holidayId,
        p_date: input.date,
        p_name: input.name,
        p_kind: input.kind,
      });
      if (error) return holidayRefusal(holidayFailureCode(error));
      return { ok: true, value: null };
    } catch {
      return holidayRefusal("network");
    }
  },

  async deleteNationalHoliday(holidayId) {
    try {
      const { error } = await client().rpc("delete_national_holiday", { p_id: holidayId });
      if (error) return holidayRefusal(holidayFailureCode(error));
      return { ok: true, value: null };
    } catch {
      return holidayRefusal("network");
    }
  },

  async listIssueReports() {
    try {
      const { data, error } = await client().rpc("list_issue_reports");
      if (error) return issueRefusal(issueFailureCode(error));
      const rows = (data ?? []) as IssueReportRpcRow[];
      // ISSUE_REPORT_LIMIT's truncation rule (src/lib/domain/types.ts): a list at the limit may be
      // short, and a short list is a report silently not shown to the person it was written for.
      if (rows.length >= ISSUE_REPORT_LIMIT) return issueRefusal("network");
      return { ok: true, value: rows.map(toSystemIssueReport) };
    } catch {
      return issueRefusal("network");
    }
  },

  async setIssueReportStatus(reportId, status) {
    try {
      const { error } = await client().rpc("set_issue_report_status", { p_id: reportId, p_status: status });
      if (error) return issueRefusal(issueFailureCode(error));
      return { ok: true, value: null };
    } catch {
      return issueRefusal("network");
    }
  },

  async issueImageUrls(paths) {
    if (paths.length === 0) return [];
    try {
      const { data, error } = await client().storage.from("issue-report").createSignedUrls(paths, 60 * 60);
      if (error || !data) return paths.map(() => null);
      // Same order and length as `paths`: createSignedUrls answers one result per input path, in order.
      return data.map((entry) => (entry.error ? null : entry.signedUrl));
    } catch {
      return paths.map(() => null);
    }
  },
};

/** A row of `list_national_holidays()` as PostgREST returns it. */
interface HolidayRpcRow {
  id: string;
  date: string;
  name: string;
  kind: HolidayKind;
  created_at: string;
}

function toNationalHoliday(row: HolidayRpcRow): Holiday {
  return { id: row.id, date: row.date, name: row.name, kind: row.kind, createdAt: row.created_at };
}

function holidayFailureCode(error: { code?: string }): HolidayFailureCode {
  switch (error.code) {
    case "42501":
      return "not_permitted";
    case "P0002":
      return "holiday_not_found";
    case "23505":
      return "holiday_date_taken";
    case "22023":
      return "invalid_holiday";
    default:
      return "network";
  }
}

/** A row of `list_issue_reports()` as PostgREST returns it. */
interface IssueReportRpcRow {
  id: string;
  org_id: string;
  org_name: string;
  member_id: string;
  member_name: string | null;
  kind: IssueKind;
  message: string;
  page: string;
  status: IssueStatus;
  created_at: string;
  images: string[];
}

function toSystemIssueReport(row: IssueReportRpcRow): SystemIssueReport {
  return {
    id: row.id,
    orgId: row.org_id,
    orgName: row.org_name,
    memberId: row.member_id,
    memberName: row.member_name,
    kind: row.kind,
    message: row.message,
    page: row.page,
    status: row.status,
    createdAt: row.created_at,
    images: row.images,
  };
}

function issueFailureCode(error: { code?: string }): IssueFailureCode {
  switch (error.code) {
    case "42501":
      return "not_permitted";
    case "P0002":
      return "issue_not_found";
    default:
      return "network";
  }
}

/** A row of `list_orgs()` as PostgREST returns it. */
interface OrgRow {
  id: string;
  org_code: string;
  name: string;
  is_shared_tenant: boolean;
  timezone: string;
  max_members: number | null;
  max_teams: number | null;
  plan: string;
  licence_expires_on: string | null;
  created_at: string;
}

function toOrgSummary(row: OrgRow): OrgSummary {
  return {
    id: row.id,
    orgCode: row.org_code,
    name: row.name,
    isSharedTenant: row.is_shared_tenant,
    timezone: row.timezone,
    maxMembers: row.max_members,
    maxTeams: row.max_teams,
    plan: row.plan,
    licenceExpiresOn: row.licence_expires_on,
    createdAt: row.created_at,
  };
}

// The SQLSTATE is PostgREST's `code`. Inputs are sent as given, so the database's refusal is the one
// shown (01-plan.md § 4.4).
function orgFailureCode(error: { code?: string; message?: string }): OrgFailureCode {
  switch (error.code) {
    case "42501":
    case "P0002":
      return "not_permitted";
    case "23505":
      return "org_code_taken";
    case "23514": {
      const message = error.message ?? "";
      return message.includes("org_code_shape") || message.includes("org_code_not_reserved")
        ? "org_code_invalid"
        : "invalid_org_field";
    }
    case "23502":
      return "invalid_org_field";
    case "22023":
      return "unknown_timezone";
    default:
      return "network";
  }
}

// =============================================================================================
// Mock implementation — in memory, reset on reload. Fixtures are 01-plan.md § 2's table.
// =============================================================================================

const MOCK_SYSTEM_PASSWORD = "calechip-demo";
const MOCK_SYSTEM_CODE = "246810";
const MOCK_SYSTEM_SECRET = "JBSWY3DPEHPK3PXP";
const MOCK_SYSTEM_QR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges">' +
      '<rect width="8" height="8" fill="#fff"/>' +
      '<path d="M0 0h3v3H0zM5 0h3v3H5zM0 5h3v3H0zM4 4h1v1H4zM6 5h2v1H6zM5 7h1v1H5z" fill="#000"/>' +
      "</svg>",
  );

interface MockAccount {
  isSystemAdmin: boolean;
  hasVerifiedFactor: boolean;
}

const mockAccounts = new Map<string, MockAccount>([
  ["root@calechip.test", { isSystemAdmin: true, hasVerifiedFactor: false }],
  ["ops@calechip.test", { isSystemAdmin: true, hasVerifiedFactor: true }],
  ["member@calechip.test", { isSystemAdmin: false, hasVerifiedFactor: false }],
]);

let mockSession: { email: string; aal2: boolean } | null = null;
let mockPendingFactorId: string | null = null;
let mockFactorCounter = 0;

// MIR-18-b. The two orgs of 01-plan.md § 2's panel table. The mock mirrors the database's checks so
// the panel can be driven offline. Of holidays it models Org public's only (MIR-15-b), and not the
// copy `create_org` makes into a new org (MIR-18-b AC-4 is the database's).
const MOCK_ORG_CODE_SHAPE = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;
// Copied from `20261027120000_mir11_composite_foreign_keys.sql:46-58` (`org_code_not_reserved`).
const MOCK_RESERVED_ORG_CODES: readonly string[] = [
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
];

const mockOrgs: OrgSummary[] = [
  {
    id: "00000000-0000-4000-8000-00000000c000",
    orgCode: "shared",
    name: "Org public",
    isSharedTenant: true,
    timezone: "Asia/Ho_Chi_Minh",
    maxMembers: null,
    maxTeams: null,
    plan: "free",
    licenceExpiresOn: null,
    createdAt: "2026-10-31T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-00000000c001",
    orgCode: "acme",
    name: "Acme Studio",
    isSharedTenant: false,
    timezone: "Asia/Ho_Chi_Minh",
    maxMembers: 30,
    maxTeams: 3,
    plan: "free",
    licenceExpiresOn: "2027-06-30",
    createdAt: "2026-11-01T00:00:00.000Z",
  },
];
let mockOrgCounter = 1;

/** The database's `is_system_admin()`: a system admin, at aal2. */
function mockMaySeeOrgs(): boolean {
  if (!mockSession?.aal2) return false;
  return mockAccounts.get(mockSession.email)?.isSystemAdmin === true;
}

/** `list_orgs()`'s order: the shared tenant first, then `org_code` ascending. Copies, not the store. */
function mockOrgsInOrder(): OrgSummary[] {
  return [...mockOrgs]
    .sort((a, b) =>
      a.isSharedTenant !== b.isSharedTenant
        ? Number(b.isSharedTenant) - Number(a.isSharedTenant)
        : a.orgCode < b.orgCode
          ? -1
          : a.orgCode > b.orgCode
            ? 1
            : 0,
    )
    .map((org) => ({ ...org }));
}

/** `org_name_not_blank`, on the trimmed name. */
function mockNameValid(name: string): boolean {
  return name !== "" && name.length <= 80;
}

/** `org_max_*_positive`. */
function mockCapValid(cap: number | null): boolean {
  return cap === null || (Number.isInteger(cap) && cap >= 1);
}

/** The browser's stand-in for `pg_timezone_names`. */
function mockTimezoneKnown(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

// MIR-15-b. Org public's calendar, seeded with copies of the member app's fixture rows so the panel
// and the member mock start from the same dates.
const mockNationalHolidays: Holiday[] = FIXTURE_HOLIDAYS.map((holiday) => ({ ...holiday }));
let mockHolidayCounter = 0;

/** `add_`/`update_national_holiday`'s value checks, then `holiday_org_id_date_key`. */
function mockHolidayRefusal(input: NationalHolidayInput, exceptId: string | null): HolidayFailureCode | null {
  if (input.date === "" || input.name.trim() === "") return "invalid_holiday";
  if (mockNationalHolidays.some((holiday) => holiday.date === input.date && holiday.id !== exceptId)) {
    return "holiday_date_taken";
  }
  return null;
}

// MIR-16. Seeded with one copy of the member app's own fixture report, so the panel and the member
// mock start from the same row. `orgName` and `memberName` are filled in directly: the database's
// `list_issue_reports()` resolves them with a join the mock has no table behind, so they are written
// out here instead (ADR-082).
const mockIssueReports: SystemIssueReport[] = [
  {
    id: FIXTURE_ISSUE_REPORT.id,
    orgId: mockOrgs.find((org) => org.isSharedTenant)!.id,
    orgName: "Org public",
    memberId: FIXTURE_ISSUE_REPORT.memberId,
    memberName: FIXTURE_MEMBER.displayName,
    kind: FIXTURE_ISSUE_REPORT.kind,
    message: FIXTURE_ISSUE_REPORT.message,
    page: FIXTURE_ISSUE_REPORT.page,
    status: FIXTURE_ISSUE_REPORT.status,
    createdAt: FIXTURE_ISSUE_REPORT.createdAt,
    images: [...FIXTURE_ISSUE_REPORT.images],
  },
];

/** Test-only. Replaces the mock's whole issue-report store, so AC-8 (no reports) and AC-10 (a report
 *  carrying images) can be driven from the e2e suite, which cannot import this module. Exported
 *  beside `systemSeam` and read by nothing in `src/` outside this file. */
export function __setMockIssueReports(rows: SystemIssueReport[]): void {
  mockIssueReports.length = 0;
  mockIssueReports.push(...rows.map((row) => ({ ...row, images: [...row.images] })));
}

function mockGate(): SystemGate {
  if (!mockSession) return { state: "signed-out" };
  const { email, aal2 } = mockSession;
  const account = mockAccounts.get(email);
  if (!account?.isSystemAdmin) {
    mockSession = null;
    return { state: "not-system-admin" };
  }
  if (aal2) return { state: "signed-in", email };
  return account.hasVerifiedFactor ? { state: "verify", email } : { state: "enrol", email };
}

const mockSystemSeam: SystemSeam = {
  async gate() {
    return mockGate();
  },

  async signIn(email, password) {
    const normalised = email.trim().toLowerCase();
    if (!mockAccounts.has(normalised) || password !== MOCK_SYSTEM_PASSWORD) {
      return { ok: false, error: { code: "invalid_credentials", message: WRONG_PASSWORD } };
    }
    mockSession = { email: normalised, aal2: false };
    return { ok: true, value: mockGate() };
  },

  async startEnrolment() {
    if (!mockSession) throw new Error("No panel session.");
    mockFactorCounter += 1;
    mockPendingFactorId = `mock-factor-${mockFactorCounter}`;
    return { factorId: mockPendingFactorId, qrCode: MOCK_SYSTEM_QR, secret: MOCK_SYSTEM_SECRET };
  },

  async verifyCode(code, factorId) {
    const refused = { ok: false as const, error: { code: "invalid_credentials" as const, message: WRONG_CODE } };
    if (!mockSession) return refused;
    const account = mockAccounts.get(mockSession.email);
    if (!account?.isSystemAdmin) return refused;
    if (factorId !== undefined ? factorId !== mockPendingFactorId : !account.hasVerifiedFactor) {
      return refused;
    }
    if (code.trim() !== MOCK_SYSTEM_CODE) return refused;
    account.hasVerifiedFactor = true;
    mockPendingFactorId = null;
    mockSession = { ...mockSession, aal2: true };
    return { ok: true, value: mockGate() };
  },

  async signOut() {
    mockSession = null;
    mockPendingFactorId = null;
  },

  async listOrgs() {
    if (!mockMaySeeOrgs()) return orgRefusal("not_permitted");
    return { ok: true, value: mockOrgsInOrder() };
  },

  async createOrg(input) {
    if (!mockMaySeeOrgs()) return orgRefusal("not_permitted");
    const name = input.name.trim();
    if (!MOCK_ORG_CODE_SHAPE.test(input.orgCode) || MOCK_RESERVED_ORG_CODES.includes(input.orgCode)) {
      return orgRefusal("org_code_invalid");
    }
    if (mockOrgs.some((org) => org.orgCode === input.orgCode)) return orgRefusal("org_code_taken");
    if (!mockNameValid(name)) return orgRefusal("invalid_org_field");
    if (!mockTimezoneKnown(input.timezone)) return orgRefusal("unknown_timezone");
    mockOrgCounter += 1;
    const id = `00000000-0000-4000-8000-00000000c${String(mockOrgCounter).padStart(3, "0")}`;
    mockOrgs.push({
      id,
      orgCode: input.orgCode,
      name,
      isSharedTenant: false,
      timezone: input.timezone,
      maxMembers: null,
      maxTeams: null,
      plan: "free",
      licenceExpiresOn: null,
      createdAt: new Date().toISOString(),
    });
    return { ok: true, value: id };
  },

  async updateOrg(input) {
    if (!mockMaySeeOrgs()) return orgRefusal("not_permitted");
    const org = mockOrgs.find((candidate) => candidate.id === input.orgId);
    if (!org || org.isSharedTenant) return orgRefusal("not_permitted");
    const name = input.name.trim();
    const plan = input.plan.trim();
    if (!mockNameValid(name) || plan === "" || !mockCapValid(input.maxMembers) || !mockCapValid(input.maxTeams)) {
      return orgRefusal("invalid_org_field");
    }
    Object.assign(org, {
      name,
      maxMembers: input.maxMembers,
      maxTeams: input.maxTeams,
      plan,
      licenceExpiresOn: input.licenceExpiresOn,
    });
    return { ok: true, value: null };
  },

  async listNationalHolidays(range) {
    if (!mockMaySeeOrgs()) return holidayRefusal("not_permitted");
    const rows = mockNationalHolidays
      .filter((holiday) => holiday.date >= range.start && holiday.date <= range.end)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .map((holiday) => ({ ...holiday }));
    return { ok: true, value: rows };
  },

  async addNationalHoliday(input) {
    if (!mockMaySeeOrgs()) return holidayRefusal("not_permitted");
    const refusal = mockHolidayRefusal(input, null);
    if (refusal) return holidayRefusal(refusal);
    mockHolidayCounter += 1;
    const id = `00000000-0000-4000-8000-0000000d${String(mockHolidayCounter).padStart(4, "0")}`;
    mockNationalHolidays.push({
      id,
      date: input.date,
      name: input.name.trim(),
      kind: input.kind,
      createdAt: new Date().toISOString(),
    });
    return { ok: true, value: id };
  },

  async updateNationalHoliday(holidayId, input) {
    if (!mockMaySeeOrgs()) return holidayRefusal("not_permitted");
    const holiday = mockNationalHolidays.find((candidate) => candidate.id === holidayId);
    if (!holiday) return holidayRefusal("holiday_not_found");
    const refusal = mockHolidayRefusal(input, holidayId);
    if (refusal) return holidayRefusal(refusal);
    Object.assign(holiday, { date: input.date, name: input.name.trim(), kind: input.kind });
    return { ok: true, value: null };
  },

  async deleteNationalHoliday(holidayId) {
    if (!mockMaySeeOrgs()) return holidayRefusal("not_permitted");
    const index = mockNationalHolidays.findIndex((candidate) => candidate.id === holidayId);
    if (index < 0) return holidayRefusal("holiday_not_found");
    mockNationalHolidays.splice(index, 1);
    return { ok: true, value: null };
  },

  async listIssueReports() {
    if (!mockMaySeeOrgs()) return issueRefusal("not_permitted");
    // Newest first, as `list_issue_reports()` orders. Copies, not the store.
    const rows = [...mockIssueReports]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .map((row) => ({ ...row, images: [...row.images] }));
    return { ok: true, value: rows };
  },

  async setIssueReportStatus(reportId, status) {
    if (!mockMaySeeOrgs()) return issueRefusal("not_permitted");
    const report = mockIssueReports.find((candidate) => candidate.id === reportId);
    if (!report) return issueRefusal("issue_not_found");
    report.status = status;
    return { ok: true, value: null };
  },

  async issueImageUrls(paths) {
    return paths.map(() => null);
  },
};

// The same test `index.ts` uses to choose the member seam.
const usesMock = import.meta.env.VITE_DATA_SEAM === "mock" || !import.meta.env.VITE_SUPABASE_URL;

export const systemSeamName: "mock" | "supabase" = usesMock ? "mock" : "supabase";

export const systemSeam: SystemSeam = usesMock ? mockSystemSeam : supabaseSystemSeam;

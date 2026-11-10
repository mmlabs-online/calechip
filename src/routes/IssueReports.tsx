// SOLO, 2026-09-26 — the admin's list of reports people have sent.
//
// **MIR-17, ADR-088 — THIS SCREEN NO LONGER LISTS ANYTHING.** MIR-16
// (`20261107210000_mir16_issue_reports_system_scope.sql`) drops `issue_report_select_admin`,
// `issue_report_update_admin` and the storage policy `issue_image_select_admin`: only a system admin
// at `aal2` reads or triages a report now (ADR-082 decision 1), through the system panel (MIR-16).
// Everything this file used to render — the four phases, the roster lookup, the signed-URL round
// trip, the toggle, the list markup — went with the read it was drawn from.
//
// What is left is the one honest sentence: reports are not read here any more, and they never were
// read by an org admin's own authority — the database refused every member all along (ADR-005), this
// screen is only the affordance catching up with it.
export default function IssueReports() {
  return (
    <p
      data-testid="issue-reports-moved"
      className="mx-auto max-w-3xl rounded-card bg-card p-8 text-center text-sm text-ink-2 shadow-soft"
    >
      Reports are read by the CaleChip team, not by your organisation&rsquo;s admins.
    </p>
  );
}

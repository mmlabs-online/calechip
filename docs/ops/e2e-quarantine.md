# End-to-end quarantine register

This is the register that [ADR-060](../../.ai/registry/decisions/ADR-060-a-failing-e2e-test-may-be-quarantined-with-a-register-and-a-ticket.md)
requires: one row for every end-to-end test that is quarantined or known to be flaky.

A failing test may be marked `test.fixme` only while all three of these hold: a comment on the line
above it names a tracking ticket; this file has a row for it with its suspected cause, its first
failing PR and that ticket; and the row's expiry is no more than 30 days out.

Check D15 in `scripts/check-docs.mjs` enforces this. It fails the documentation audit on an
unregistered `test.fixme`, an expired row, a row more than 30 days out, a row whose ticket has no
`ticket.yaml`, and a row whose test no longer matches the spec file (deleted, renamed, or running
again).

Past its expiry a row is fixed (the test runs again and the row is deleted), deleted with a reason,
or re-dated by the operator. Nobody else re-dates a row.

Rows of kind *flaky* are not quarantined. Those tests keep running under the bounded CI retry in
`playwright.config.ts` (`retries`), and the row exists so the retry is visible rather than silent.

Revert condition (ADR-060): if any row is more than 60 days old, the quarantine has become permanent
debt and the decision is reopened.

| Test | Kind | Suspected cause | First failing PR | Ticket | Expiry |
|---|---|---|---|---|---|

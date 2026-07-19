# Scenario 14 — Accounting Daily & Month-End Run — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "Accounting — the daily and month-end run."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3d19rz](https://app.clickup.com/t/86d3d19rz) — "AA Accountant, ISBAT have POS sales automatically post journal entries for revenue, tax, COGS, and payment to the GL" — _Sprint 4, to do_ — matches step 1 (also cross-listed under Scenario 01)
- [86d3d19tn](https://app.clickup.com/t/86d3d19tn) — "AA Accountant, ISBAT have gross income from POS sales reconcile with the accounting GL view, so both systems report consistent revenue figures" — _Sprint 4, to do_ — closest ticket to the "gross (internal) vs net (reports)" gap, though framed as a reconciliation check between two systems rather than a distinct report variant — confirm which one the business actually means before implementing (see this doc's Closing Gap 3)
- [86d3aeax6](https://app.clickup.com/t/86d3aeax6) — "AA Accountant, ISBAT manage bank accounts and run reconciliations" — _Sprint 4, done_ — the bank reconciliation feature already confirmed working in this doc's "What's already done"
- [86d3aeb2p](https://app.clickup.com/t/86d3aeb2p) — "AA Business Owner, ISBAT manage tax rates and view tax filing summaries" — _Sprint 4, done_ — covers tax rate CRUD, but doesn't mention approval — likely does not close Closing Gap 1 (approver-gating on tax code changes) as-is
- [86d3aeb1c](https://app.clickup.com/t/86d3aeb1c) — "AA Accountant, ISBAT view financial reports including trial balance, P&L, balance sheet, and cash flow" — _Sprint 4, done_
- [86d3aeb1w](https://app.clickup.com/t/86d3aeb1w) — "AA Accountant, ISBAT view AR and AP aging reports and generate customer and supplier statements" — _Sprint 4, done_ — cross-listed under Scenario 11
- [86d3aepp5](https://app.clickup.com/t/86d3aepp5) / [86d39peg5](https://app.clickup.com/t/86d39peg5) — "ISBAT view a sales summary report/dashboard by date range across branches / by branch and date range" — _Sprint 4, to do_ — a branch-scoped **sales** report exists as a ticket; not the same as branch-scoped **P&L** (Closing Gap 2), but close enough to check before assuming a new ticket is needed — may just need scope-widening.

**Not found in Sprint 3-5:** No ticket for approver-controlled tax code changes specifically (as opposed to plain tax-rate CRUD), and none for cost-center reporting (Closing Gap 4) — `costCenter` is captured on several models per this doc's own findings, but nothing in the backlog tracks building a report on top of it either.

## The scenario we're building toward

The accountant keeps the books current and closes the month:

1. Auto journals — POS sales auto-post (sale, VAT, COGS, payment) to the chart of accounts (Balance Sheet 1-3, P&L 4-6).
2. Tax — Output/Input VAT and 1% withholding post to their GL accounts; tax codes are approver-controlled; BIR filing stays manual.
3. Bank reconciliation — statement balance entered, reconciled to zero; discrepancies explained or carried forward.
4. Reports — per-branch P&L, AR aging, gross(internal) vs net(reports), cost centres.

## What's already done ✅

1. **Chart of accounts follows the stated numbering exactly.** 1xxx Assets, 2xxx Liabilities, 3xxx Equity (Balance Sheet); 4xxx Revenue, 5xxx COGS, 6xxx-7xxx Expense (P&L) — `backend/src/accounting/coa-seed/coa-seed.service.ts:18-238`.
2. **POS auto-posting — CONFIRMED**, `pos-posting.service.ts:219-285` (`postSaleJEFromPayments`), covering sale/VAT/COGS/payment (with the COGS caveats already flagged in scenario 01).
3. **Output VAT, Input VAT, and Withholding each have dedicated GL accounts** — Output VAT (`2050`), Input VAT (`1250`), Withholding Payable/Receivable (`2060`/`1150`) — `coa-seed.service.ts:47-52, 61-66, 94-106`.
4. **BIR e-filing correctly stays manual, as expected.** A `bir_export` permission exists in the seed but is never referenced by any controller/service, and no "BIR"-named file exists under `src/accounting` — this isn't a gap, it's the intended scope boundary; flagged only so it isn't mistaken for an oversight.
5. **Bank reconciliation — CONFIRMED, a real, complete feature.** `accounting/bank-reconciliation/_components/BankRecon.tsx` — a "New Reconciliation" form captures `statementBalance` vs. `systemBalance`, lists reconciliations with a computed `Difference` column and `Reconciled`/`Pending` status, plus a separate "Adjusting Entry" flow that posts bank-charge/interest adjustments to GL to carry discrepancies forward. Backed by `BankAccounts.createReconciliation`/`completeReconciliation` (`backend/src/accounting/bank-accounts/bank-accounts.service.ts`).
6. **AR aging report — CONFIRMED**, bucketed Current/1-30/31-60/61-90/90+ (`reports.service.ts:246-272`) — see scenario 11 for why this single-clock model falls short of the _collections-specific_ three-clock ask, but as a standard accounting AR aging report it's complete and correct.
7. A broad general report set already exists: trial balance, P&L, balance sheet, general ledger, cash flow, AR/AP aging, customer/supplier statement, BI summary (`reports.controller.ts`).

## What's not done / gaps ❌⚠️

1. **Tax codes aren't approver-controlled.** `tax-rates.controller.ts:34-82` gates create/update/delete purely by static RBAC permission (`accounting:tax:create/update/delete`) — no pending/approval state, no workflow field, no approver step anywhere in `tax-rates.service.ts`/its DTOs. Anyone with the permission can change a tax rate immediately and unilaterally.
2. **No per-branch P&L.** `profitAndLoss(startDate, endDate)` (`reports.service.ts:81-110`) takes no `branchId` parameter, and neither `reports.controller.ts` nor `ReportsHub.tsx` has a branch selector on any report tab — P&L is company-wide only.
3. **No gross(internal)-vs-net(external) report distinction.** Only "gross profit" (Revenue − COGS) exists as a normal accounting subtotal (`reports.service.ts:98`) — there's no separate internal/external report variant or toggle implementing whatever distinction the scenario means by "gross (internal) vs net (reports)."
4. **No cost-center reporting.** `costCenter` is only a free-text tag field on `Expense`/`APBill`/`ARInvoice`/`FixedAsset` records (`schema.prisma:775, 851, 906, 998`) — no report endpoint or UI anywhere groups or aggregates by it, so the tag is currently write-only.

## Closing the gaps

### 1. Add approver-gating to tax rate changes

**Problem**: any RBAC-permitted user can change a tax rate/code with no second sign-off, which the scenario explicitly calls out as a control requirement.
**Fix**: add a `pending`/`approved` status to tax rate changes — a create/update goes to `pending` and only takes effect once a second, distinct approver (someone other than the submitter) confirms it. Model this on whatever approval-status pattern is cleanest to reuse in this codebase (the `PurchaseRequestApproval` shape referenced in scenarios 06/07 is a reasonable template, even though it's a different domain) rather than inventing a new one.

### 2. Add branch scoping to P&L

**Problem**: `profitAndLoss()` has no branch dimension at all.
**Fix**: add an optional `branchId` parameter to `reports.service.ts::profitAndLoss()`, filtering the underlying JE-line query by the branch tag already present on posted journal lines (confirm this tag exists on `JournalEntryLine` — if postings aren't currently branch-tagged at the line level, that's a prerequisite sub-gap to fix first, since you can't filter by something that was never recorded). Add a branch selector to the P&L tab in `ReportsHub.tsx`.

### 3. Clarify and build the gross-vs-net report distinction

**Problem**: the scenario's wording ("gross (internal) vs net (reports)") is genuinely ambiguous without more context — this needs a definition before it can be built.
**Fix**: before writing code, confirm with the business what this means concretely — likely candidates: (a) an "internal" P&L view showing raw/unadjusted figures for management vs. a "net" view with formal adjustments/eliminations for external reporting, or (b) gross revenue vs. revenue net of discounts/returns. Once defined, this is most likely a report-variant/toggle on the existing P&L, not a new report from scratch.

### 4. Add cost-center reporting

**Problem**: `costCenter` is captured everywhere relevant but never surfaced in any report.
**Fix**: add a cost-center-grouped report — likely a new tab in `ReportsHub.tsx` querying `Expense`/`APBill`/`ARInvoice`/`FixedAsset` grouped by `costCenter`, reusing the existing tag field (no schema change needed, purely a new read/aggregation query plus UI).

## Dead code / unused-feature flags

- **`costCenter` field** — not dead exactly (it's actively written to on several models), but currently write-only with no read/report path. Flagged here rather than under "delete" since the fix is to build the missing report (Closing Gap 4), not remove the field.

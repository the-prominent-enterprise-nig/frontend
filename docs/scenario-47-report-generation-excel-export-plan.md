# Scenario 47 — Client-Requested Reports & Excel Extraction — Gap Analysis & Closing Plan

**Source**: direct client ask, relayed 2026-09-08:

> "Can you guys also show us how to extract data. Our expectation is that we can generate reports based on time lines we set and then extract those reports in the form of an excel file.
>
> - Sales Per branch (include brand, category, model of unit)
> - Sales per brand (include category, model and branch)
> - Expenses per branch
> - Aging of accounts per branch"

Two asks in one: (a) four specific reports, each **filtered by a user-set date range**, and (b) a **real `.xlsx` extraction** of whatever is on screen. Today the app has neither the four reports in that shape nor any Excel output at all.

## Related ClickUp Tickets

- [86d3958g5](https://app.clickup.com/t/86d3958g5) — **"BI & Reporting branch / management reports & exports configured"** — _Weeks 7–8 — Accounting, Aging & Reports Staging → Weekly Deliverables, to do_, currently assigned to Chloe Belle. Description: "Configure BI & Reporting: branch and management reports plus exports." This is the umbrella ticket for all four reports plus the Excel extraction; no per-report or per-persona split tickets exist.

No separate tickets found for expenses-per-branch or aging-per-branch specifically — both fall under the ticket above.

## Decisions already taken (developer, 2026-09-08)

1. **Expense branch dimension** → add `branchId` to the `BusinessExpense` **header**, defaulted server-side from the creating user's branch (the convention `ARInvoice`/`ARPayment` already document). Not per-line, not a reuse of `costCenter`.
2. **"Aging of accounts" scope** → AR invoices **and** installment accounts. Not AP.
3. **Excel generation** → **server-side**, `exceljs`, streamed as a binary response. Not client-side SheetJS, not CSV.
4. **Placement** → **per-module tabs**, no new top-level Reports hub. Sales reports under POS; expenses + aging as tabs on the existing accounting `ReportsHub`.

## The scenario we're building toward

A manager sets a date range (or picks a preset — MTD, QTD, YTD, Last Month), optionally narrows by branch/brand/category, reads the report on screen, and clicks **Export to Excel** to get a `.xlsx` they can hand to management or pivot themselves. The downloaded file carries a Summary sheet, a line-level Detail sheet, and a Parameters sheet recording exactly which filters produced it.

## What's already done ✅

1. **A backend reports module exists** — `backend/src/accounting/reports/reports.controller.ts` serves trial balance, P&L (already branch-scopable), balance sheet, cash flow, `aging/:type`, GRNI, cost-center, and GL reconciliation. New report endpoints have a clear home and an established permission decorator pattern (`accounting:financial_report:read`).
2. **A per-branch sales total already exists** — `TransactionsService.getSalesByBranch()` (`backend/src/pos/transactions.service.ts:2929`, exposed at `transactions.controller.ts:318`). It already establishes the two things the new reports need: branch derivation via `session.terminal.branchId`, and caller-branch forcing for non-privileged users. It returns totals + transaction count only — no item dimension.
3. **Every field the two sales reports need is on `Item`** — `primaryCategoryId` (`schema.prisma:4387`), `brandId` (`:4438`, → `ItemBrand`), `modelNumber` (`:4443`, the catalog model/part number, explicitly distinct from a unit's serial).
4. **Report #4 is ~70% built already.** `InstallmentAccountService.agingReport()` (`backend/src/crm/installment-account/installment-account.service.ts:875`) returns active installment accounts **already grouped by branch and collector**, with `asOf` / `branchId` / `collectorId` filters and caller-branch forcing — built to match the client's own "AGING OF ACCOUNTS RECEIVABLE" sheet. Its UI is `AgingReportView.tsx` (under `crm/installment-accounts/aging-report/`), already reused as the `ar-aging` tab of the accounting `ReportsHub`, and it already has a **Print** action via `printAgingReportDocument()`.
5. **`ARInvoice.branchId` exists** (`schema.prisma:798`), set at creation time from the POS session's branch or the creating user's branch — so the AR-invoice half of report #4 is joinable to branch without any schema work.
6. **Binary responses already flow to the browser.** The catch-all proxy (`src/app/api/[...path]/route.ts`) explicitly streams binary through, and `src/app/api/payslips/[id]/download/route.ts` is a working precedent for a file download with `Content-Disposition`. **No proxy work is needed for `.xlsx`.**
7. **`PostingService.post()` already accepts `branchId`** (`backend/src/accounting/posting/posting.service.ts:166`, written at `:304`) — so branch-tagging the expense journal entry is a one-argument change, not new plumbing.

## What's not done / gaps ❌⚠️

1. **No Excel anywhere, on either side.** Backend deps have `pdfkit` and `csv-parse` but no `exceljs`/`xlsx`; frontend has no spreadsheet dep either. All existing "export" is CSV: one shared `downloadCsv()` (`src/libs/format/csv-export.ts`) plus at least three hand-rolled `exportToCsv()` copies inside individual report components (e.g. `inventory/reports/_components/AgingReport.tsx`). CSV loses number formats, column widths, multiple sheets, and the parameters record.
2. **`PosTransactionLine` has no Prisma relation to `Item`.** It carries a bare `itemId String` (`schema.prisma:3627`) with no `item Item @relation(...)` — so today there is no way to `include` brand/category/model onto a sale line. Both sales reports are blocked on this.
3. **No sale-line-level sales report exists at all.** `getSalesByBranch` aggregates at the transaction level and never touches `lines`. Nothing in the codebase groups sales by brand, category, or model.
4. **`BusinessExpense` has no branch dimension whatsoever.** `schema.prisma:1588` — the only near-miss is free-text `costCenter`, and `costCenterReport()` (`reports.service.ts:705`) buckets by that string with an `'Unassigned'` fallback. Worse, `ExpensesService.record()` calls `this.posting.post({...})` (`expenses.service.ts:921`) **without passing `branchId`**, so even the resulting journal entry is branch-null. Report #3 is fully blocked until this is added.
5. **The generic `aging()` ignores branch entirely.** `reports.service.ts:372` queries `aRInvoice.findMany` with no `branchId` filter, selects no branch, and returns a flat per-invoice list with a single `bucket` string — no branch grouping and no Current/1‑30/31‑60/61‑90/90+ matrix. The installment-account report (What's-done #4) has branch grouping; this one does not, and the two are not combined anywhere.
6. **No shared date-range control.** `ReportsHub.tsx` hand-rolls `asOf` / `startDate` / `endDate` as three `useState`s over bare `<input type="date">`, with a `YEAR_START` constant and no presets; `AgingReportView.tsx` hand-rolls its own `asOf`. "Timelines we set" needs one reusable control with presets.
7. **No export permission story, and `sales:reports:read` does not actually exist.** It is declared in `frontend/src/libs/guards/sales-permissions.ts:25` and referenced by **nothing else in either repo** — the backend permission seed (`backend/prisma/seed.ts`, where every real permission string lives as a `{module, resource, action, description}` entry plus explicit per-role grants) has **no `sales` module at all**. So it is a dead frontend constant, not a wired permission: using it would mean seeding it and granting it per role, not just adding a decorator. Separately, export has no audit-log trail.

## Closing the gaps

Sequenced so each part ships and can be tested on its own. Parts 2–4 all depend on Part 1.

### Part 1 — Excel export foundation (shared by all four reports)

- Add `exceljs` to the backend. New `backend/src/common/export/xlsx.util.ts`: `buildWorkbook(sheets: SheetSpec[]): Promise<Buffer>`, where a `SheetSpec` declares `{ name, columns: [{ header, key, width, numFmt }], rows, totalsRow? }` — bold frozen header, `#,##0.00` on money, auto width.
- **Convention**: every report gets a JSON endpoint plus a sibling `GET .../export` taking the _identical_ query DTO, so the file can never disagree with the screen. Response: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` + `Content-Disposition: attachment; filename="<report>-<from>-<to>.xlsx"`.
- **Every workbook ships three sheets**: `Summary` (grouped subtotals) · `Detail` (line level) · `Parameters` (date range, each filter, generated-by, generated-at) — so an extracted file is self-documenting once it leaves the app.
- Frontend: `src/libs/export/downloadXlsx.ts` (fetch → blob → anchor, with error toast) and a reusable `<ExportButton>` in `src/components/common/`.
- Frontend: reusable `<ReportDateRange>` — from/to plus presets (Today, This Week, MTD, QTD, YTD, Last Month, Custom). Retrofitting the existing hand-rolled date inputs is **not** in this part's scope; new reports use it, existing ones can migrate later.

### Part 2 — Sales per branch & Sales per brand

- **Schema**: add `item Item @relation(fields: [itemId], references: [id])` to `PosTransactionLine` + the `posTransactionLines` back-relation on `Item`, and an `@@index([itemId])`. Column-free migration; the index is the only DDL.
- **New module** `backend/src/pos/reports/`. One `salesAnalytics(tenantId, params, callerBranchId)` service, `groupBy: 'branch' | 'brand'` — the two client reports are the same dataset read two ways, not two services.
  - Params: `startDate`, `endDate`, `branchIds[]`, `brandIds[]`, `categoryIds[]`, `invoiceType?`.
  - Excludes voided sales and refund-type transactions, matching `getSalesByBranch`'s existing `where`.
  - Detail row: branch · brand · category · model · SKU · item · qty · gross · discount · net · unit cost · margin · txn# · date · invoice type · selling agent.
  - Response `{ summary, rows, meta }`; summary nests branch→brand→category for `groupBy: 'branch'` and brand→category→branch for `'brand'`, exactly mirroring the client's two bullet orderings.
- Caller-branch forcing reuses the `getSalesByBranch` pattern. Permission: **decision pending** — see Gap 7; `sales:reports:read` is a frontend-only dead constant with no backend counterpart, so this is either a reuse of `pos:transactions:read` or a new seeded permission.
- **Frontend**: new `/pos/reports` page, two tabs (Sales per Branch, Sales per Brand), sidebar entry in the POS group of `SideBar.tsx`.

### Part 3 — Expenses per branch

- **Schema**: `BusinessExpense.branchId String?` + `branch Branch?` relation + `@@index([branchId])`; `Branch.businessExpenses` back-relation. Existing rows stay null → reported as **"Unassigned"**, same convention as `costCenter`'s.
- **Service**: default `branchId` from the creating user's branch in `ExpensesService.create()`; allow an explicit override only for users with multi-branch scope. Pass it into the `posting.post({ ... })` call at `expenses.service.ts:921` so the GL entry is branch-tagged too — this is what makes the report tie back to the P&L's existing branch filter.
- **Form**: deliberately unchanged. A Branch field was built and then removed (developer decision 2026-09-08) — the server already knows the recording user's branch, so asking for it on the form would only be a second place to get it wrong. Consequence, accepted: an expense recorded by a **Business Owner** (who has no branch of their own) has no branch to stamp and reports as **"Unassigned"**. The `branchId` field stays on the DTO, so attribution is still possible via the API without re-adding UI.
- **Report**: `GET /reports/expenses-by-branch?startDate&endDate&branchId` → summary of branch × expense category account, plus detail rows (expense#, date, payee, category, description, amount, status). `costCenter` rides along as a column, not as the grouping key.
- **Frontend**: new **Expenses** tab on the existing `ReportsHub`, deep-linkable at `?tab=expenses` (labelled just "Expenses" per developer decision 2026-09-08 — the branch grouping is what the report _does_, not what the tab is called). The backend endpoint and export filename stay `expenses-by-branch` / `expenses-per-branch.xlsx`, which describe the data itself.

### Part 4 — Aging of accounts per branch

**Re-verified 2026-09-08 at the start of this part — the plan below was written against a stale reading; two of its three items were already built.** `agingReport()` (`backend/src/crm/installment-account/installment-account.service.ts:875`) **already** pulls AR invoices alongside installment accounts (`invoiceRows`), and **already** dedups them exactly as decided — `installmentAccount: null, installmentScheduleLine: null` excludes any invoice already represented by an account. It also already groups Branch → Collector with subtotals at both levels plus a grand total, and already forces the caller's own branch. What actually remains:

- Extend the existing `agingReport()` rather than writing a new one — it already matches the client's real sheet.
- ~~Add AR invoices alongside installment accounts~~ — **already done**; add only a `source: 'installment' | 'invoice'` column so the two kinds are distinguishable in the output.
- ~~Dedup rule~~ — **already implemented** as "installment account wins".
- Add an explicit bucket matrix — Current / 1‑30 / 31‑60 / 61‑90 / 90+ — per branch, which the current output lacks. The code carries `over: null` with a comment explicitly deferring exactly this ("no penalty/days-overdue rule exists to compute this from yet; deferred rather than guessed").
- Add the `/export` sibling; the Summary sheet is the branch × bucket matrix, Detail is per account/invoice. The existing **Print** action stays as-is.
- **Frontend**: extend `AgingReportView.tsx` in place (it is already the `ar-aging` tab of `ReportsHub`, so both entry points get it for free).

### Part 5 — Cross-cutting

- Audit-log every export via the existing `audit-log` module: who, which report, which parameters.
- Playwright e2e per part, following the `implement-scenario` convention.
- `pnpm generate:types` after each backend part to refresh `src/libs/generated/`.

## AR aging coverage — what the report does and doesn't age

Confirmed against the code 2026-09-08 (the service doc comment at `installment-account.service.ts:860` states the intent; the UI subtitle contradicted it and has been corrected).

**In scope**: active `InstallmentAccount`s (`status: active`), plus every standalone `ARInvoice` in `SENT`/`PARTIAL`/`OVERDUE` with no linked installment account or schedule line. A plain charge invoice with no financing _is_ aged. The new `source` column distinguishes the two.

**Correctly out**: `DRAFT` (never issued), `PAID`, `CANCELLED` invoices; `closed`/`early_closed` accounts. AP/payables, excluded by decision.

**Two exclusions that are policy choices, not oversights — flag to the business:**

1. **`written_off` installment accounts are excluded.** Standard practice (written off = off the AR ledger), but nobody has written that decision down. If NIG still pursues written-off balances, they are invisible in this report.
2. **TPF (third-party-financed) receivables are aged nowhere.** Money a financier owes NIG rides on `PosTransaction.tpfProviderId` / `tpfApprovedAmount`, settled via `TpfSettlementApplication` — it is neither an `ARInvoice` nor an `InstallmentAccount`, so it falls through both row sources. Whether a financier belongs in a customer-aging report is a business call, but the exposure is currently unreported anywhere.

## AR aging report does not scale — measured 2026-09-08

Not introduced by Scenario 47 (the no-pagination design predates it), but measured while adding the bucket matrix, so recorded here rather than lost. Test DB loaded with **5,015 outstanding receivables across 39 branches**:

| Metric                                                        | Result                  |
| ------------------------------------------------------------- | ----------------------- |
| Backend query (`GET /crm/installment-accounts/reports/aging`) | 507 ms — fine           |
| JSON payload                                                  | **3.15 MB**             |
| Browser time to settle                                        | **1.63 s**              |
| `<tr>` elements rendered                                      | **5,055**               |
| Total DOM nodes                                               | **77,477**              |
| `.xlsx` export                                                | 519 ms / 0.38 MB — fine |

**The backend is not the problem; the payload and the DOM are.** `agingReport()` has no pagination — it returns every row nested branch → collector → rows, and `AgingReportView` renders all of it eagerly. The fetch also re-runs on _every_ filter change (there is no Run button), so each As-of tweak repays the full cost. Scaling is roughly linear: ~20k receivables ≈ 12 MB and ~300k DOM nodes, which is a multi-second freeze per interaction; ~50k is likely an unresponsive tab.

**Proposed fix — summary-first, detail on demand.** Render only the branch × bucket matrix by default (39 rows regardless of scale — and it is what management actually reads), then load one branch's rows on expand. Needs a `summaryOnly` server param so the API stops shipping rows nobody renders; makes the payload flat rather than linear. Cheaper fallbacks if that is too much: virtualise the detail tables, or gate the fetch behind an explicit Run button. The export needs no change — xlsx compresses well and Excel is the right home for bulk detail.

**Deferred by developer decision 2026-09-08** — not urgent while AR is a single row, but it will bite well before "thousands". To be scheduled as its own part/scenario.

## Open questions

- **"Sales" definition** — gross of discounts, or net? Include or exclude the transaction-level `deliveryFee`? Include VAT, or show `vatableAmount` net? The client's sheet will imply an answer; worth confirming before the numbers are shown to management.
- **Should refunds/returns net against the period's sales**, or be reported as a separate column? `PosTransaction` carries `refundTransactions` and a `ReturnRefundRequest` flow, so both are computable.
- **Model of unit** — `Item.modelNumber` is the catalog model/part number. For serial-tracked units the client may instead mean the physical serial on the sale line (`serialNumberId` / `secondarySerialNumberId`). Confirm which; the detail sheet can carry both.
- **Expense branch backfill** — leave historical expenses as "Unassigned", or backfill from the creating user's branch where it can be inferred? Backfilling changes numbers for closed periods.
- **Row ceiling** — is a full-year line-level export expected to be openable in Excel (~1M row limit is not the concern; browser/API timeout is)? If YTD detail runs to six figures of rows, the export endpoint needs streaming rather than a buffered workbook.
- **Installment aging + AR invoice double-counting** — a POS charge invoice that later became an installment account could appear in both halves of report #4. Needs a dedup rule (`ARInvoice.installmentAccount` relation exists, so it is detectable).

## Not in scope for this doc

- **Retrofitting the existing reports** (trial balance, P&L, cash flow, inventory valuation/turnover, etc.) with Excel export — the foundation in Part 1 makes it a small follow-up per report, but only the client's four are being built here.
- **Replacing the existing CSV exports** in the inventory report components — they keep working; migration is optional cleanup.
- **Scheduled/emailed report delivery** — the ask is on-demand extraction only.
- **AP aging by branch** — explicitly excluded by decision #2, and `APBill` has no `branchId` anyway.
- **A new top-level Reports hub** — explicitly excluded by decision #4.

## Implementation Log — 2026-09-08

**For this scenario, I have done:**

- **Part 1 — Excel export foundation.** Added `exceljs`; `backend/src/common/export/xlsx.util.ts` (`buildReportWorkbook()`, `NUM_FMT`, bold+frozen headers, autofilter, optional bold TOTAL rows, sheet-name sanitising, `exportFilename()`, a 100k-row `ExportTooLargeError` cap) and `send-xlsx.util.ts` (the shared `@Res()` responder, mirroring `files.controller.ts:89`; over-cap becomes a 400 with an actionable message, not a 500). Frontend: `downloadXlsx.ts`, `<ExportButton>`, `<ReportDateRange>` (Today/This Week/MTD/QTD/YTD/Last Month, Monday week start, local-date ISO). Every workbook ships Summary / Detail / **Parameters** — the last appended by the builder itself, so no report can forget it. 12/12 unit tests, each round-tripping a real `.xlsx` buffer back through exceljs rather than asserting on the spec object.
- **Part 2 — Sales per Branch & Sales per Brand** (plan Part 2). Added the missing `PosTransactionLine.item` relation + index (migration `20260908042045`). New `backend/src/pos/reports/`: one `salesAnalytics()` with `groupBy: 'branch' | 'brand'`, four endpoints (two JSON + two `/export` sharing the identical DTO and service call). Gross/discount/net/VAT/cost/margin each their own column; refunds their own column, never netted; both `modelNumber` and serial per line. New `/pos/reports` page, two tabs, sidebar entry. 17/17 backend e2e, 5/5 Playwright.
- **Part 3 — Expenses per branch** (plan Part 3). `BusinessExpense.branchId` (migration `20260908050105`), stamped server-side from the recording user's session; branch-scoped users can't override, Business Owner may name one. New `expenses-by-branch.service.ts` grouped branch × expense category, RECORDED-only by default. New **Expenses** tab on `ReportsHub` (`?tab=expenses`). 13/13 backend e2e, 4/4 Playwright.
- **Part 4 — Aging buckets & export** (plan Part 4, reduced — see the re-verification note in that section). Added `AGING_BUCKETS`/`daysOverdue()`/`agingBucketOf()`, a `source` column, per-bucket subtotals at collector/branch/grand-total level, the branch × bucket matrix in `AgingReportView`, and `/crm/installment-accounts/reports/aging/export`. Existing **Print** untouched. 10/10 backend e2e, 4/4 Playwright.
- **Part 5 — Audit logging & cross-cutting** (plan Part 5). Extended `AuditLogOptions` with `resolveMetadata`, and added `@AuditReportExport(slug)` — applied to all four `/export` routes — recording who pulled which report with which filters. Regenerated `src/libs/generated/types/generated.ts`. 5/5 backend e2e.

Totals: **12 unit + 45 backend e2e + 14 Playwright = 71 tests**, both repos `type-check` and lint clean.

**Worth flagging:**

- **Two real bugs found outside this scenario's scope, both fixed.** (1) `ExpensesService.record()` called `posting.post()` without `branchId`, so every expense journal entry posted branch-null and a **branch-filtered P&L silently excluded every expense** — now threaded through, with an e2e pinning it. (2) The aging export endpoint was first written as `/installment-accounts/...` when the controller prefix is `crm/installment-accounts`; caught by e2e, would have shipped a dead Export button.
- **A permission trap.** Cashier's grant is `modulePermIdsExcept('pos', ...)`, so the new `pos:reports:read` would have been granted to Cashier automatically. Added to its exclusion list — these reports expose unit cost and margin. Verified in-DB: Business Owner ✅, Branch Manager ✅ (via `pos:*:*`), Cashier ✗.
- **The plan doc was stale on Part 4** and has been corrected in place: `agingReport()` already pulled AR invoices and already deduped them ("installment account wins"), so two of that part's three items were already built. Caught by re-verifying before writing code rather than after.
- **Prisma bundled unrelated pre-existing drift into both migrations** (dropping/re-adding `landed_costs_goodsReceiptId_fkey`, dropping two indexes). Both migrations were stripped to only their own change. **That drift still exists and is unowned** — worth someone investigating separately.
- **`sales:reports:read` is a dead frontend constant.** Declared in `sales-permissions.ts:25`, referenced nowhere else, and the backend seed has no `sales` module at all. Left as-is; `pos:reports:read` was seeded instead.
- **Three findings deferred, documented above rather than dropped**: the AR aging report does not scale (measured: 3.15 MB payload / 77k DOM nodes / 1.63 s at 5k rows), `asOf` is only half-implemented (balances are current; only the aging arithmetic honours the date, so back-dated reports are wrong), and TPF receivables are aged nowhere.
- **The expense form's Branch field was built and then removed** at the developer's request — the server already knows the recording user's branch. Consequence accepted: Business-Owner-recorded expenses report as "Unassigned".
- **Manual verification is incomplete.** Parts 1-2 were handed over with click-through steps; Parts 3-5 have not been manually confirmed — the developer was waiting on an unrelated feature merge to test the expense flow. All four reports are covered by automated e2e, but no part of Parts 3-5 has been seen working in a browser by a human.
- **Test infrastructure notes.** `.env.test` did not exist and was created (gitignored), along with the `the-prominent-enterprise-test` database. `npm run test:e2e` and Playwright's `webServer` both run `prisma migrate reset`, which the AI-agent guard blocks without explicit user consent — specs were run via `DOTENV_CONFIG_PATH=.env.test npx jest ...` against an already-seeded DB, and the isolated backend started by hand on :3011. `backend/scripts/s47-e2e-fixture.ts` (`--sales`/`--expenses`/`--receivables`, `--clean`) seeds data the download assertions need; without it they self-skip with an annotation rather than passing quietly. It was also run against the **dev** DB (receivables + sale only, at the developer's request) — 15 invoices across 3 branches, removable with `--clean`.

# Scenario 62 — Reports: Drill-down to Source, Raw Data Export, Data Query Center — Gap Analysis & Closing Plan

**Source**: client meeting notes, relayed 2026-09-30 (the "Reports" half; the Fund Transfer half is [Scenario 61](./scenario-61-inter-account-transfer-plan.md)). Built on `feat/scenario-62-reports-drilldown-query-center` in both repos.

## Related ClickUp Tickets

None found. This is new scope.

## What the client asked for

1. Beginning balances: to be worked out **with Ms Bem**. This is a data session, not code, and is not part of this branch.
2. Ms Bem needs the **raw data exported to Excel**.
3. Accounting figures should be **clickable**, so users can see the source and trace the records.
4. A **Data Query Center**: pull data from whichever module it comes from, **read-only**, export to CSV/XLSX, "similar to SQL".

## Decisions taken (developer, 2026-09-30)

| Question                | Decision                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Data Query Center shape | **Dataset picker**, not a raw SQL editor. The user picks a table, chooses columns, adds filters, sorts, previews, and exports. |
| Who gets it             | **Business Owner only.**                                                                                                       |
| Which raw data          | **All of it**, every module.                                                                                                   |

## What was built

### 1. Drill-down: report figure → General Ledger → journal entry → source document

- **Reports hub** (`ReportsHub.tsx`): every account figure on Trial Balance, P&L, Balance Sheet and Cash Flow links to `/accounting/general-ledger?accountId=…&startDate=…&endDate=…`. The link covers the report's own period: an as-of report uses an empty `startDate` ("from the beginning"). A P&L link also carries its `branchId` and `view=internal`, so the GL lists exactly the lines behind the figure.
- **General Ledger**:
  - It reads `startDate`/`endDate`/`branchId`/`view` from the URL. It used to read `accountId` only.
  - The Reference column links to the journal entry.
  - A new Source column links to the source document.
  - The backend `GET /reports/general-ledger` (and `/export`) now accepts `branchId`/`view`, the same scoping `generalLedger()` already supported internally. It also returns `sourceDocumentId`/`sourceDocumentNo`/`journalDescription` per line.
- **Journal entry detail**: "Source document" is now a link.
- **`libs/format/sourceDocumentLink.ts`** maps a JE's `sourceModule`/`sourceDocumentId`/`sourceDocumentNo`/code/description to a page:
  - Several modules post more than one kind of document under one `sourceModule`. For example, AR alone posts invoices, installment plans, penalties, advances, unapplied collections and acknowledgement receipts. Each kind is told apart by the description or code prefix its posting code writes; the rules mirror those call sites.
  - Where a document has no page of its own, the link goes to the closest list.
  - Customer advances have no screen at all, so they show without a link.
  - A Scenario 61 transfer (`IAT-…`) links to its transfer detail page.

### 2 & 4. Data Query Center (covers "all raw data")

- **Backend** `src/query-center/`, routes `GET /query-center/datasets`, `…/datasets/:key/preview?q=`, and `…/datasets/:key/export?q=&format=xlsx|csv`.
  - **The catalogue is generated from the Prisma schema** (`dataset-registry.ts`), rather than hand-curated, so "all raw data" stays true after every migration. It currently holds 208 datasets across Accounting, POS, CRM & Credit, Inventory, Procurement, People & Organization, Restaurant and System.
  - Each to-one relation (the codebase's `foo` + `fooId` convention) adds a readable label column. For example, a GL line shows "1000 Cash on Hand", not an account uuid.
  - **Excluded:** auth and secret tables (`PasswordResetToken`, `SuperAdmin`, `BusinessInvite`, `Subscription`), fields matching password/token/secret/hash/otp/auth0, and Json/Bytes blobs.
  - **Encrypted columns** (GL line amounts, JE payee/TIN/check number, disbursement payee/amount) are decrypted on the way out and can't be filtered or sorted.
  - **Read-only by construction**: only `findMany`/`count`. Every filter and sort column must come from the whitelist; an unknown column is a 400, never passed to Prisma.
  - **Forced scoping:**
    - `tenantId`/`enterpriseOwnerId` = the caller's business. On `EnterpriseOwner` itself it is the row's own `id`.
    - `branchId`, when the caller is branch-restricted.
  - **Filter operators:** is, is not, contains, starts with, ≥, ≤, >, <, is one of, is empty, is not empty. A date "is" means that whole day. A two-part label (account "number name", employee "first last") matches on either part.
  - **Exports:**
    - Use the existing `sendReportWorkbook` (xlsx, Parameters sheet) or RFC-4180 CSV with a BOM, and neutralise formula injection.
    - Are capped at `MAX_EXPORT_ROWS` (100k) like every other export.
    - Are audited via `@AuditReportExport('query-center')`. The whole query rides in `?q=`, so the audit row records exactly what was pulled.
  - **Business Owner only, via `QueryCenterGuard`**, which requires the _exact_ `accounting:query-center:read` row:
    - The normal `PermissionsGuard` wildcard-matches, and the Accountant's `accounting:*` grant (in every live DB) would otherwise qualify.
    - The platform super-admin bypass is deliberately not honoured.
  - **Permission:** added to `seed.ts`. For live DBs: `npm run backfill:query-center-permission` (additive, Business Owner only).
- **Frontend** `/accounting/query-center`:
  - Sidebar entry "Data Query Center" under Accounting, gated by the new `hasExactPermission()`. That helper does no wildcard match and has no Business Owner shortcut.
  - The page does the same exact check server-side.
  - Layout:
    - Left: a searchable dataset list grouped by module.
    - Right: a SELECT (column picker, IDs hidden by default) / WHERE (filter rows) / ORDER BY builder.
    - A paged preview, 100 rows per page.
    - Excel and CSV export buttons.

### 3. Raw data export to Excel

This is covered by the Query Center: any table, any columns and filters, straight to .xlsx or .csv. For Ms Bem's accounting work the Transaction dataset is the one she'll want — GL lines with decrypted debit/credit, account, JE code and date. The existing per-report Excel exports are unchanged.

## Implementation Log — 2026-09-30

- Backend:
  - `tsc` and `eslint` are clean. Query Center unit tests pass, 11/11. Reports and export tests pass, 41/41.
  - Live against the local backend:
    - Business Owner sees 208 datasets.
    - **All 208 return a preview without error.**
    - Filtering and sorting through relation labels works.
    - An unknown column → 400; an excluded table → 404.
    - Both exports download: xlsx is a valid Excel 2007+ file, and CSV is correct.
    - An Accountant (`accounting:*` wildcard) gets **403**, while still reading the GL (200).
- Frontend:
  - `tsc` and `eslint` are clean.
  - Walked through in Chrome as the Business Owner:
    - The Query Center loads.
    - Picking Transaction, adding "Account contains Cash" and running gives 7 rows, matching the API.
    - Trial Balance "Cash on Hand ₱19,000.00" → GL (scoped as-of, running balance −₱19,000.00, matching) → journal entry → its Expense `EXP-1789351307433`.
- Local DB changes this session:
  - Applied the 5 newer `development` migrations.
  - Ran the permission backfill: 1 permission row + 1 Business Owner grant.
- On deploy: run `npm run backfill:query-center-permission` once per environment.

## Worth flagging

- The Query Center shows raw rows in any status. For example, the Transaction dataset includes lines whose status is not POSTED, which the GL and reports exclude. That is the point of raw data, but filter on Status = POSTED to reconcile against a report.
- Accounting tables (JournalEntry, Transaction, bank accounts…) have no tenant column anywhere in the schema, so for them the scoping is the same single-tenant assumption the existing reports already make.
- The GL drill-down from a branch-scoped P&L relies on the JE's `branchId`. Entries posted without one appear only in the unscoped view — also existing behaviour.
- Not built: CSV on the existing per-report exports, and a saved-query feature. Say if either is wanted.

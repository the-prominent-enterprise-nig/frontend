# Scenario 31 — Accounting Screen Linking & Balance Visibility — Gap Analysis & Closing Plan

Source: developer's own first-pass review of the Accounting sidebar (2026-08-18) — no accounting background, sanity-checking the module against standard accounting-software UX before trusting the existing build. Two concerns raised: no linking between related screens (an AR Invoice not showing which POS sale created it, a Credit Memo not tied back to its invoice), and no visible balance/aging indicators (no running balance on the General Ledger, no "days overdue" on AR Invoices). Verified against live code (both repos) before this doc was written.

## What's already fine — verified, not re-scoped here

A third concern from the same review — "are there missing screens for bank reconciliation, fixed assets, tax, fiscal periods, financial statements?" — turned out to be unfounded. All of it exists and is already linked in the sidebar: Bank Accounts, Bank Reconciliation, Fixed Assets, Fiscal Periods, Tax, Budgets, Cash Forecast, and Reports (which contains Profit & Loss, Balance Sheet, Trial Balance, AR/AP Aging, and General Ledger as tabs) — 23 nav items total, just further down than the first screenshot showed. Nothing to build there.

Also confirmed already correct and not touched by this doc: Credit Memo/Debit Memo already receive the linked invoice's `id` from the backend (`credit-memos.service.ts`/`debit-memos.service.ts`'s `include`) — only the frontend rendering is the gap, not the data.

## Closing the gaps

### 1. AR Invoice doesn't show its source POS sale

**Problem**: `ARInvoice` has a real database relation to the POS transaction that created it (`PosTransaction.arInvoiceId` → `ARInvoice.posTransaction`), but `ar-invoices.service.ts`'s `findAll()`/`findOne()` never `include` it, so the API never returns it, and neither `ARInvoicesList.tsx` nor `ARInvoiceDetail.tsx` render it. Staff can _search_ an invoice by its POS transaction number (the search box resolves through the relation), but can't see or click through to the sale from the invoice itself.

**Fix**: add `posTransaction: { select: { id, transactionNumber, createdAt } }` to both backend `include`s. On the frontend, show a small "Sale: `<transactionNumber>`" line under the invoice number (list) and a "Source sale" row (detail), linking to `/pos/transactions?search=<transactionNumber>`. That link only works once `TransactionsList.tsx` reads an initial search value from the URL (`useSearchParams`) — it currently only supports typed-in search, not a deep link.

**Status**: not started.

### 2. Credit/Debit Memo invoice reference isn't clickable

**Problem**: `CreditMemosList.tsx`/`DebitMemosList.tsx` render the linked invoice's number as plain text (`{m.arInvoice?.invoiceNumber ?? '—'}`) even though the invoice's `id` is already present in the same object — the data is there, only the JSX never turns it into a link.

**Fix**: wrap the invoice number in a `next/link` to `/accounting/ar-invoices/${m.arInvoice.id}`, in both files. Both rows have a row-level `onClick` that expands details, so the link needs `stopPropagation` to navigate instead of just expanding the row.

**Status**: not started.

### 3. General Ledger has no account filter or running balance

**Problem**: `GET /reports/general-ledger` returns flat debit/credit rows with no cumulative balance, and the frontend GL tab (inside Reports) doesn't even offer an account filter — a running balance across multiple mixed accounts wouldn't be meaningful anyway.

**Fix**: add an account filter to the GL tab (loaded via the same `getAccounts()` already used on Chart of Accounts). When one account is selected, the backend computes a running balance per row — classifying the account debit-normal (`ASSET`/`EXPENSE`) or credit-normal (`LIABILITY`/`EQUITY`/`REVENUE`) using the same split already defined in `AccountMappingPanel.tsx`, seeding the opening balance from that account's POSTED transactions before the selected start date (same pattern `getAccountBalances()` already uses elsewhere in `reports.service.ts`). The frontend GL table gains a "Balance" column only when an account is selected; with no account picked, the view is unchanged from today.

**Status**: not started.

### 4. AR Invoices don't show "days overdue"

**Problem**: `ARInvoicesList.tsx`/`ARInvoiceDetail.tsx` already compute overdue state for a red "Due" amount and an OVERDUE badge, but never show the actual day count — that math only exists inside the separate AR Aging report tab, not on the invoice itself.

**Fix**: purely frontend — compute days overdue from the invoice's existing `dueDate` and show it next to the OVERDUE badge/status on both list and detail (e.g. "OVERDUE · 14 days"). No backend change.

**Status**: not started.

## Not in this pass — flagged, not fixed

Found live during verification, real and working but intentionally out of scope for "necessary now":

- **Bank Reconciliation is a manually-entered header record** (`bank-accounts.service.ts`'s `createReconciliation()`), not a computed/matched reconciliation — the caller supplies both the statement balance and the system balance themselves.
- **Cash Flow report is an explicitly simplified category-based classification** (own code comment: "Simplified: classify activity by account category"), not a true indirect-method operating/investing/financing breakdown.
- **Collections monitoring lives outside the Accounting module entirely** — split across CRM ("Collections Calendar", "Collection Incentives") and POS ("Collections") nav sections, not present under Accounting at all. Worth a naming/IA conversation, not a bug.

## Verification (once implemented)

- `npx tsc --noEmit` in both repos.
- Manual pass in the running dev app: open a POS-originated AR Invoice → confirm the sale link works and lands pre-filtered; click a Credit Memo's and a Debit Memo's invoice reference → confirm navigation; open Reports → General Ledger, select one account → confirm the Balance column appears and its last row roughly matches that account's known current balance; confirm no account selected → unchanged view; open an overdue AR Invoice → confirm "X days overdue" shows.

## Implementation Log — 2026-08-18

**For this scenario, I have done:**

- Item 1 (AR Invoice source sale link): resolved via the Installment path (`InstallmentSchedule.posTransactionId`), not the originally-planned `ARInvoice.posTransaction` relation — that relation only ever populates for `'charge'` invoiceType sales, which turned out to be fully dropped as a checkout option (confirmed live: no path, including the manager-approval release-form-request route, can create one anymore). Shows "Sale: `<transactionNumber>`" on both list and detail, deep-linking into POS Transactions pre-searched.
- Item 2 (Credit/Debit Memo invoice links): the invoice number in both memo lists is now a real link to that invoice's detail page.
- Item 3 (General Ledger account filter + running balance): account filter added, running balance computed server-side (debit/credit-normal aware, opening balance seeded from that account's prior POSTED transactions), Balance column shown only once one account is selected. **Same-day follow-up, developer instruction**: General Ledger pulled out of the Reports hub entirely into its own standalone page (`/accounting/general-ledger`) rather than staying a Reports tab — same permission gate (`accounting:generalLedger:read`), same filter/balance behavior, just its own route now.
- Item 4 (AR Invoices "days overdue"): computed client-side from the existing `dueDate`, shown next to the OVERDUE badge on both list and detail.

All 4 items backed by e2e tests, run individually per this project's convention: backend `ar-invoice-source-sale-link.e2e-spec.ts` (3/3), `general-ledger-running-balance.e2e-spec.ts` (3/3); frontend `ar-invoice-detail-view.spec.ts` (extended, 2/2), `credit-memos-list.spec.ts` / `debit-memos-list.spec.ts` (extended, new assertions passing), `general-ledger-account-filter.spec.ts` (2/2), `ar-invoice-days-overdue.spec.ts` (2/2).

**Worth flagging:**

- The original plan for Item 1 assumed the `'charge'` invoiceType flow was still live; live testing found it had been fully disabled for new sales server-side (`validateAndPrepare()`'s unconditional block, `transactions.service.ts`) — the fix was redirected to the Installment path instead, the only mechanism that currently produces a POS-originated AR Invoice.
- One pre-existing test unrelated to this scenario, `ar-invoices-transaction-search.spec.ts`'s "searching AR Invoices by the POS transaction number finds its charge invoice", is now broken by that same `'charge'` deprecation. Flagged, not fixed — out of this scenario's scope.
- Two pre-existing tests in `credit-memos-list.spec.ts` (also unrelated to this scenario) rely on shared dev-DB data left by other spec files rather than creating their own fixtures — they fail in isolation against a freshly-reset DB. Flagged, not fixed.
- **Also fixed, surfaced live during this session (not in this doc's original scope)**: Credit Application's co-maker is no longer required (real schema migration — `coMakerId` is now nullable), and Credit Applications are now editable any time before a decision is made (draft/submitted/under_investigation/pending_approval), not just while in draft — both direct developer requests made mid-session, unrelated to Accounting/AR/GL.
- A Turbopack dev-server "stale module graph" runtime error surfaced mid-session on an unrelated page (`pos/checkout`) — a side effect of running the e2e suite, not a real code bug (confirmed via `tsc`); resolved by restarting the dev server, not a lasting issue.

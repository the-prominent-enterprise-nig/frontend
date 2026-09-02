# Scenario 41 — AP Bill "Purchase Invoice" Naming & PO → Invoice Visibility — Gap Analysis & Closing Plan

Source: developer request, 2026-09-01 — raised live while reviewing the POS/Accounting/Inventory screens against the client's own paper "Purchase Invoice" and "Purchase Order" documents. Not sourced from either scenario PDF.

## Related ClickUp Tickets

None found. Net-new scope — create via the `clickup-create-ticket` skill if tracking is wanted.

## The scenario we're building toward

An Accountant opens a bill under **AP Invoices** and downloads it — instead of today's bare, unbranded printout, they get a letterhead "Purchase Invoice" matching every other document family (PO, AR Invoice, Receiving Report): NIG logo, two-party header, RR#/PO# references, Sub-total → Withholding → Total → Includes VAT → payment history (CK#/date) → Balance due. The detail page itself also identifies the document as a "Purchase Invoice" the moment you open one. The module you navigate through to get there — the sidebar item, the list page — still reads "AP Invoices," unchanged; only the single document, once opened, carries the client's own document name.

Separately, a Procurement/Inventory user looking at a received Purchase Order can now click a "View Invoice" button — same place as the existing "View delivery receipts" button — and land directly on that PO's billed invoice, instead of leaving Inventory to search AP Invoices manually.

## What's already done ✅

1. AP Bill (`backend/src/accounting/ap-bills/`) is already the functional equivalent of a "Purchase Invoice" — subtotal/VAT/withholding/total, matched receiving reports, payments with cheque numbers — confirmed directly against the client's own paper "Purchase Invoice" sample.
2. Every sibling print document already has its own bespoke, letterhead-branded `build*Html()` in `frontend/src/libs/print/printInventoryDocument.ts` (Purchase Order, AR Invoice, Receiving Report, Stock Transfer) — logo top-right, two-party info row, bordered items table. AP Bill was the one holdout still on the old generic `printInventoryDocument()` shell (bare, no logo) — `APBillDetail.tsx:123`, `renderApBillBody()` (lines 21-82).
3. `APBillsService.getDocument()`/`findOne()` (`backend/src/accounting/ap-bills/ap-bills.service.ts:546-601`) already includes everything a bespoke template needs — `supplier`, `purchaseOrder`, `goodsReceipts.lines.item`, `payments` — no backend change required for the PDF itself.
4. `PurchaseOrder.apBills` is an existing Prisma relation (`schema.prisma:5017`) — just never selected by `purchase-order.service.ts`'s `poInclude` (lines 33-48), so PO screens today have no way to know a bill exists.
5. `PurchaseOrderList.tsx` already has the exact UX pattern to mirror — a "View delivery receipts" `IconBtn` (~L688-698) that only renders once a PO has receiving activity (`partially_received`/`fully_received`/`closed`).
6. `ACCOUNTING_PERMISSIONS.AP_BILLS_READ` already exists (`frontend/src/libs/guards/accounting-permissions.ts:65`), and the PO page already threads permission booleans (`canReceive`, `canEdit`, etc.) `page.tsx` → `ProcurementHub.tsx` → `PurchaseOrderList.tsx` — adding `canViewApBill` is mechanical, not a new pattern.

## What's not done / gaps ❌⚠️

1. **AP Bill's printed/downloaded document is unbranded and labeled "AP Bill,"** not "Purchase Invoice" — inconsistent with every sibling document and with the client's own paper form.
2. **The bill detail page never identifies the document type on screen**, and its two "back to list" links actually disagree with each other today — "Back to AP Invoices" (`APBillDetail.tsx:137`, error state) vs. "Back to AP Bills" (line 166, loaded state).
3. **A Purchase Order gives no way to jump to its billed invoice** — a user has to leave Inventory and search AP Invoices manually by supplier or PO code.

## Closing the gaps

### 1. Bespoke "Purchase Invoice" PDF for AP Bills

**Fix**: add `buildAPBillHtml()` / `printAPBillDocument()` to `printInventoryDocument.ts`, modeled on `buildARInvoiceHtml()` (AP Bill and AR Invoice are structural mirrors — payable vs. receivable): `<h1>Purchase Invoice</h1>` + logo, Supplier/Meta/Enterprise info row (Invoice date, Due date, Invoice number, Order number, Payee's TIN), RR# line, items table from `goodsReceipts[].lines`, totals block (Sub-total, Withholding tax, Total, Includes VAT, one row per payment as `Payment — CK#{chequeNumber} — {date}`, Balance due). `APBillDetail.tsx` swaps its old generic call for the new one and drops the now-dead `renderApBillBody`.

**Scope note**: the client's reference sample has a per-line Tax column. This schema only tracks tax at the bill level (`APBill.taxAmount`), not per goods-receipt-line/item — the new template keeps tax in the totals block rather than fabricating per-line data.

### 2. "Purchase Invoice" label on the bill detail page + back-link fix

**Fix**: add a small uppercase kicker ("Purchase Invoice") above the bill-number `<h1>` on `APBillDetail.tsx` — the one screen where a single document, not the module, is being viewed. Align both back-links to "AP Invoices" (both point at the module list, not the document, so both should say the module's name). Module-facing names — `SideBar.tsx` nav label, `ap-bills/page.tsx` metadata title, `APBillsList.tsx`'s `<h2>AP Invoices</h2>` — stay unchanged by design.

### 3. "View Invoice" action from Inventory ▸ Purchase Orders

**Fix**: backend adds `apBills: { select: { id, billNumber, status }, orderBy: { billDate: 'desc' } }` to `poInclude` (cheap, no migration). Frontend adds `apBills` to `PurchaseOrderSummarySchema` and a `canViewApBill` permission prop (`ACCOUNTING_PERMISSIONS.AP_BILLS_READ`, threaded `page.tsx` → `ProcurementHub.tsx` → `PurchaseOrderList.tsx`). A "View Invoice" `IconBtn` (Receipt icon, distinct from the delivery-receipts `FileText` icon) renders next to "View delivery receipts" only when `po.apBills.length > 0` — no dead link on a PO nothing's been billed against yet — and navigates to `/accounting/ap-bills/{po.apBills[0].id}`, the most recent bill.

**Not in scope**: multiple-bills-per-PO handling beyond "link to most recent" — in practice a PO has at most one bill, since receiving auto-generates/consolidates onto a single draft (`APBill.isAutoGenerated` doc comment, `schema.prisma:~1237`).

## Not in scope for this doc

- Renaming the "AP Invoices" module itself (nav, list page, page title) — explicitly kept as-is per the request.

## Implementation Log — 2026-09-01

**For this scenario, I have done:**

- **Part 1** (Closing the gaps #1) — added `buildAPBillHtml()`/`printAPBillDocument()` to `printInventoryDocument.ts`, matching the branded letterhead style every sibling document already has (logo, two-party header, RR#/PO# references, Sub-total/Withholding/Total/Includes VAT/payment-history/Balance-due totals). `APBillDetail.tsx` swapped over to it; the old generic `renderApBillBody()` deleted.
- **Part 2** (Closing the gaps #2) — added the "Purchase Invoice" kicker label above the bill number on `APBillDetail.tsx`, and fixed the pre-existing back-link inconsistency ("Back to AP Bills" vs. "Back to AP Invoices" — both now say "AP Invoices"). Module-facing names left untouched, as scoped.
- **Part 4** (developer feedback mid-implementation, not originally in this doc — folded in ahead of Part 3, since Part 3's "View Invoice" link needed a real invoice number to point at) — `APBill.billNumber` is no longer auto-generated (was `` `AP-${Date.now()}` ``). It's now the supplier's own invoice number: required to create a bill by hand (`CreateAPBillDto`), nullable only on a DRAFT bill auto-scaffolded off a goods receipt (`createOrAttachDraftFromReceipt()`, before the real invoice arrives), and `receive()` now blocks posting to the GL until it's filled in. Uniqueness moved from a bare global `@unique` to `@@unique([supplierId, billNumber])` (migration `20260901035959_ap_bill_number_supplier_invoice`) — different suppliers commonly reuse the same numbering — with a friendly `ConflictException` on a real duplicate instead of a raw DB error. The now-fully-redundant `supplierInvoiceReferenceNo` field was retired entirely (dropped from schema/DTOs/frontend — same real-world value as `billNumber` once it stopped being auto-generated; dev DB had 0 real rows using it, confirmed before dropping). Frontend: "New Bill" form's field renamed to "Invoice Number \*" (required on create, optional on editing an existing DRAFT); list/detail/PDF show "Pending SI #"/"Purchase Invoice" placeholders instead of blank when null.
- **Part 3** (Closing the gaps #3) — `purchase-order.service.ts`'s `poInclude` now selects each PO's matched `apBills` (id/billNumber/status). Frontend: `PurchaseOrderSummarySchema` carries `apBills`; a new `canViewApBill` permission prop (`ACCOUNTING_PERMISSIONS.AP_BILLS_READ`) threads `page.tsx` → `ProcurementHub.tsx` → `PurchaseOrderList.tsx`; a "View Invoice" button (Receipt icon) renders next to "View delivery receipts" only when a bill actually exists, linking straight to it.

All 4 parts manually confirmed by the developer, one at a time, between implementation steps.

**Worth flagging:**

- Part 4's required-billNumber change broke 19+ existing backend e2e tests that relied on the old auto-generate fallback (`purchasing-ap.e2e-spec.ts`, `stock-receiving-gl-ap-posting.e2e-spec.ts`) — all fixed with explicit unique `billNumber` values; `accounting-audit-log-ap-bills`, `accounting-rbac-coverage-sweep`, `supplier-debit-memos`, `scenario14-cost-center-report` were checked and already correct.
- Fixing `stock-receiving-gl-ap-posting.e2e-spec.ts` surfaced a genuinely **pre-existing, unrelated** bug (not introduced by this scenario): `createOrAttachDraftFromReceipt()` has always auto-attached a DRAFT bill to a PO-linked, cost-resolved goods receipt immediately at receiving time, but 6 tests + a crashing `afterAll` assumed the receipt stayed unmatched until the test itself created a bill — only surfaced as visible failures once the auto-draft's `billNumber` stopped being a fake unique string. Reworked those tests to fetch and fill in the pre-existing auto-draft instead of fighting it (file now 17/17 passing); also swept 4 sets of leaked dev-DB fixture rows left behind by the crashed runs.
- `purchasing-ap.e2e-spec.ts` has 3 remaining failures, confirmed pre-existing and unrelated to this scenario (a different in-flight change to `matchCheck()`'s `rrTotal` calculation, combined with a test helper that doesn't set up `GoodsReceiptLine`s) — flagged, not fixed, out of scope here.
- The client's reference "Purchase Invoice" sample had a per-line Tax column that this schema doesn't support (tax is bill-level only, not per goods-receipt-line/item) — the new PDF keeps tax in the totals block instead of fabricating per-line data, per the scope note above.

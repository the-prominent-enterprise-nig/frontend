# Scenario 25 — Per-Invoice Detail View & Whole-Invoice Collections — Gap Analysis & Closing Plan

Source: developer-defined, 2026-08-08 — not sourced from either client PDF. Requested directly as a **counter-check scenario**, same class as Scenarios 21-24: operationalizing a CRM/Collections team meeting comment from last week. The comment: _"AR Invoices - have another view for per invoice. View the total. View the specific due date. Collections - collection and payments will be for all the items under 1 invoice. Cannot be collected per item or product but for the complete monthly due."_

## Related ClickUp Tickets

Not checked this pass.

## Related docs

- `scenario-23-transaction-invoice-lookup-plan.md` — **direct dependency**. This scenario's "whole invoice, not per item" collections rule is already structurally guaranteed by Scenario 23's Closing Gap 5 (combining same-term installment lines into one invoice instead of one per product line) — see below.
- `scenario-11-collections-ar-aging-plan.md` — the AR Invoices module this scenario's new view lives in.

## The scenario we're building toward

1. Staff can open a **focused, single-invoice view** — a real page, not a modal or panel — formatted as an actual invoice document ready to print or download, not just a data screen showing the total and due date.
2. This view is reachable from the CRM/customer side, not only by navigating into the Accounting module's general invoice list.
3. A collection/payment is always recorded against **one whole invoice** — never split to cover just part of what's on it (e.g. one product out of several sharing the same monthly due). This should be true by construction, not by convention.

**Result**: staff can drill into exactly one invoice from a customer's record without hunting through a large table, and it's structurally impossible to under-collect a monthly due by only paying for part of what's on it.

## What's already done ✅

1. **The data this view needs already exists and is already displayed — just not per-invoice.** `totalAmount` and `dueDate` are real, populated fields on every `ARInvoice`, already rendered as columns in the existing flat list (`ARInvoicesList.tsx:108-109`, `:135-136`). No new data capture is needed, only a new way to view it.
2. **`ARInvoice` has no line-item breakdown at all today** — it's a single flat record (`subtotal`, `taxAmount`, `totalAmount`, `dueDate`, `amountPaid`, `status`; `prisma/schema.prisma:840-865`), with no `ARInvoiceLine` model anywhere in the schema. So "collect per item" isn't even a supported _shape_ today — there's nothing at the item level to split. The collections rule this scenario asks for is already true in the data model itself.
3. **The one real gap that could defeat rule #3 is already identified and already has a fix planned** — see Related docs. Scenario 23's Closing Gap 5 fixes the actual loophole (today, 2 items on the same term get 2 separate invoices for the same month, so a collector _can_ pay one and skip the other). Once that lands, "whole invoice, not per item" holds structurally, with nothing further needed here.
4. **A reusable "real document, printable/downloadable" pattern already exists in this codebase — this doesn't need to be invented from scratch.** Purchase Orders (`PurchaseOrderList.tsx:323-330`'s `downloadPdf()` → `getPurchaseOrderDocument()` + `printInventoryDocument()`) and POS receipt reprints (`TransactionsList.tsx`'s `html` template + browser print, `:730-744`) both already follow the same shape: fetch the record's structured data, render it into a formatted HTML template client-side, then trigger the browser's print dialog — which also covers "download" via the browser's own Print → Save as PDF. No server-side PDF generation needed (the one place that exists, Payslips' `/api/payslips/[id]/download`, is a heavier, different pattern used nowhere else — not worth introducing a second document-generation approach just for this).

## What's not done / gaps ❌⚠️

1. **No per-invoice detail view exists anywhere.** The only AR Invoices screen is the flat table at `/accounting/ar-invoices` (`ARInvoicesList.tsx`) — every invoice is a row, with a payment-history modal as the only drill-down. There's no `/accounting/ar-invoices/[id]` route or equivalent focused page.
2. **Nothing reachable from CRM shows a single invoice's detail.** Customer360 only links out to the same Accounting flat list, filtered by customer (`"View full AR ledger →"`, `Customer360.tsx:295-300`) — it doesn't surface an invoice's own detail view, because none exists to link to.
3. **The one real loophole in "whole invoice, not per item" is tracked elsewhere, not here** — flagging for completeness: until Scenario 23's Closing Gap 5 lands, same-term installment items still generate separate invoices per product, so a collector can technically satisfy one product's due while leaving another's open for the same month. Not a new gap to fix in this doc — just don't consider this scenario's collections rule "closed" until that dependency lands too.

## Closing the gaps

### 1. Build a per-invoice detail view, formatted as a real printable/downloadable invoice

**Fix** (resolved per Open Question 1 — real page, not a panel): add a real route, `/accounting/ar-invoices/[id]`, that renders the invoice as an actual formatted document — invoice number, customer, invoice date, due date, line total, tax, amount paid, outstanding balance, status, payment history — following the same client-side render-to-HTML-then-print pattern already used by Purchase Orders and POS receipts (see "already done" #4 above), not a new document pipeline. Printing already covers "download" via the browser's Print → Save as PDF, matching how those existing patterns work today.

### 2. Make it reachable from CRM

**Fix**: from Customer360's installment/ledger section (the same rows Scenario 23's Closing Gap 2 is already enriching with invoice number/product/brand/rebate), link each row directly into this new per-invoice view — instead of only offering a generic "view full AR ledger" link out to the unfiltered Accounting table.

### 3. Confirm whole-invoice collection stays true once Scenario 23 lands

**Fix**: no new work in this doc — this is a verification dependency. Once Scenario 23's Closing Gap 5 ships (same-term lines combined into one invoice), re-run this doc's verification check below to confirm the loophole is actually closed in practice, not just in theory.

## Open questions requiring developer/business confirmation

1. ~~Route vs. panel?~~ **RESOLVED 2026-08-08 (developer confirmed): real page**, formatted as an actual invoice document ready to print or download — see the updated Closing Gap 1 above.
2. **Does this view need anything beyond the standard invoice fields (total/due date/status/payments)** — e.g. should it also show the product/brand/rebate detail Scenario 23 is adding to Customer360, so the printed document and the CRM screen don't disagree on what's included?

## Verification — the counter-check test matrix

Concrete pass/fail steps, to run after each closing-gap item lands. Current (2026-08-08) expected result noted for each.

### Per-invoice view

- Open a specific invoice from the Accounting AR Invoices list → lands on a real page (own URL) for that one invoice, formatted as an actual invoice document, not just a highlighted row in the table. **Currently: FAIL — no such page exists.**
- Open a specific invoice from a customer's record in CRM → same page, without first landing in the general Accounting list. **Currently: FAIL — Customer360 only links to the unfiltered/customer-filtered list, no per-invoice destination exists.**
- From that page, print or save-as-PDF the invoice → produces a clean, formatted document (not the raw app UI with buttons/nav chrome), same standard as the existing Purchase Order and POS receipt print flows. **Currently: FAIL — nothing to print, the page doesn't exist.**

### Whole-invoice collections

- Record a payment against an invoice covering 2+ items on the same installment term (once Scenario 23's Closing Gap 5 ships) → the payment applies to the whole invoice; there is no UI or API path to pay for only one of the items on it. **Currently: N/A until Scenario 23's Closing Gap 5 lands — today those items are still separate invoices, so this can't yet be tested as intended.**

## Implementation Log — 2026-08-10

**For this scenario, I have done:**

- **Closing Gap 1** (per-invoice detail view) — new `/accounting/ar-invoices/[id]` route, a real page (own URL) formatted as an actual printable document, mirroring the exact `printInventoryDocument()` shell Purchase Orders already use (not a new document pipeline). `ARInvoicesService.findOne()` now returns an `installmentDetail` field (product/brand/quantity/unit price/line total, plus the rebate and term) whenever the invoice is one due-date line of a POS installment schedule — `null` for charge-mode invoices, nothing to show, not an error. A new `GET /ar-invoices/:id/document` endpoint (mirroring `PurchaseOrderService.getDocument()`'s exact envelope shape) serves the print-ready payload; the Print/Download button opens it in a new tab via the browser's own Print → Save as PDF, same standard as Purchase Orders and POS receipts. Reachable from the AR Invoices list too — resolved Open Question 2 (developer confirmed: yes, include product/brand/rebate) by extending `findOne()`'s own query rather than calling the separately-permissioned `pos:collections:manage`-gated installment-schedules endpoint, so this stays under the single existing `accounting:ar-invoices:read` check with no permission conflict.
- **Closing Gap 2** (reachable from CRM) — Customer360's Installment Plan modal now links each due-date row straight into its own invoice's detail page, instead of only offering the customer-filtered "View AR Ledger" list link (which stays as-is, unchanged — it's still the right destination when there's no specific invoice to jump to, e.g. a charge-only customer with no installment plans).
- **Closing Gap 3** (verify whole-invoice collection holds) — no new code needed; confirmed via Phase 1 re-verification that Scenario 23's Closing Gap 5 (grouping same-term installment lines into one schedule) is live in `transactions.service.ts`, so the loophole this scenario's "whole invoice, not per item" rule depended on closing is in fact closed.
- Developer-requested follow-up after live testing: the AR Invoices list's row is now fully clickable (not just the invoice number cell), matching the same convention already applied to Collectors/Installment Accounts/Customers lists — the 6 existing per-row action buttons (Send, Record payment, Payment history, Issue credit memo, Edit, Delete) are guarded with `stopPropagation()` so they still work without triggering navigation.

**Worth flagging:**

- Items 1 and 2 were implemented and confirmed together as one combined part (developer's call, given they're tightly coupled — there's nothing to click into from CRM until the detail page exists to link to).
- No product/business decisions were deferred this run — the one open question (Open Question 2, product/brand/rebate scope) was resolved before implementation started.

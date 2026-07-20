# Scenario 10 — Purchasing & Accounts Payable — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "Purchasing & accounts payable — restocking from a supplier."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3d19rp](https://app.clickup.com/t/86d3d19rp) — "AA Accountant, ISBAT perform a three-way match between the Purchase Order, Receiving Report, and supplier invoice before approving payment, so we only pay for verified deliveries" — _Sprint 4, to do_ — direct match to step 2's missing RR↔Invoice leg (Closing Gap 2)
- [86d3aeaue](https://app.clickup.com/t/86d3aeaue) — "AA Accountant, ISBAT create and manage AP bills" — _Sprint 4, done_
- [86d3aeav2](https://app.clickup.com/t/86d3aeav2) — "AA Accountant, ISBAT record payments against AP bills" — _Sprint 4, done_
- [86d3aeary](https://app.clickup.com/t/86d3aeary) — "AA Accountant, ISBAT create and manage AP vendors" — _Sprint 4, done_ — this is the `Vendor` entity this doc's Closing Gap 1 flags as disconnected from `Supplier`; the ticket itself treats "AP vendors" as the correct, intended model, which is useful context for the Vendor-vs-Supplier product decision this doc asks for.
- [86d3aat0b](https://app.clickup.com/t/86d3aat0b) — "INV-69 — AA Warehouse Manager, ISBAT receive goods against a purchase order with batch capture" — _Sprint 3, for qa_

**Not found in Sprint 3-5:** No ticket for voucher creation (manual number, attachments, dual online/onsite approval — step 3), none for cheque printing, and — same gap as Scenario 13 — **none for supplier-side returns/debit memos** (step 4's "supplier returns are handled as write-offs / debit memos"). This is a real, unticketed gap on both the code side and the backlog side.

## The scenario we're building toward

Head office replenishes stock from a supplier:

1. PR → PO, quota enforced, supplier maintained in Inventory.
2. Receive & match — RR raised (partial deliveries all RRs against one main invoice); 3-way match PO ↔ RR ↔ Invoice.
3. Create the voucher — manual #, supplier auto-fills payee, attachments; online and onsite approval.
4. Pay — cheque printed, 1% withholding applied; supplier returns handled as write-offs/debit memos.

## What's already done ✅

1. **PR → PO with quota enforcement — CONFIRMED-WORKING.** Full pipeline: `backend/src/inventory/services/{purchase-request,purchase-order,procurement-quota}.service.ts`, controllers, and frontend pages under `inventory/{purchase-requests,purchase-orders,procurement-quotas}/`. `ProcurementQuota` is a distinct Prisma model (`schema.prisma:4341`); `PurchaseOrderService` calls `quotaService.enforceQuota(...)` on PO create/update/approve (`purchase-order.service.ts:139, 243, 297`). Suppliers live in Inventory as intended: `model Supplier` (`schema.prisma:1104`), `backend/src/supplier/supplier.service.ts`, UI at `inventory/suppliers/`.
2. **PO ↔ RR match — CONFIRMED-WORKING.** `stock.service.ts::receiveStock` links receipt lines to `PurchaseOrderLine` via `purchaseOrderLineId` (`GoodsReceiptLine`, `schema.prisma:3161`), increments `receivedQuantity` per PO line, and drives PO status through `partially_received`/`fully_received` (`stock.service.ts:404-467`) — multiple partial RRs against one PO/PO line are correctly supported.

## What's not done / gaps ❌⚠️

Ordered by risk/value.

1. **The RR ↔ Invoice leg of the 3-way match is entirely missing — a genuine architectural gap, not an assumption.** `GoodsReceipt` has no field linking to an `APBill`/invoice at all. Worse: `APBill` (`schema.prisma:838`) references a separate `Vendor` model (`schema.prisma:553`), **not** `Supplier` — and has no `purchaseOrderId`/`goodsReceiptId`/`supplierId` field whatsoever. There is no code anywhere matching a PO/RR against an invoice total. **Procurement and AP currently use two different, disconnected notions of "who we owe money to"** (`Supplier` vs. `Vendor`) — this is the root cause of the missing match, not just a missing field.
2. **Voucher creation doesn't exist.** `APBillsController`/`APBillsService` is generic and untyped (`create(dto: any)`), with no manual voucher-number field, no file-attachment field, and no approval workflow — statuses are just `DRAFT/RECEIVED/PARTIAL/PAID/OVERDUE/CANCELLED`. No "online approval + onsite approval" concept anywhere (grep for `voucher`/`Voucher` across both repos returns nothing relevant).
3. **No cheque printing.** `recordPayment` (`ap-bills.service.ts:168`) posts a payment JE with free-text `method`/`reference` fields — no cheque-number field, no PDF/print generation.
4. **Withholding is correctly flexible, not hardcoded — mostly fine, worth confirming.** `withholdingAmount` is client-supplied (`ap-bills.service.ts:176,189,225-234`), not hardcoded to 1% — this matches the scenario's general "applies 1% withholding" intent as a _default_, as long as something upstream actually defaults it to 1% for standard supplier payments (worth confirming UI-side rather than assuming a gap).
5. **Supplier-return handling is a genuine, currently-unimplemented gap.** Write-offs were fully removed (commits `96334e6` backend/`de5b0d8` frontend — route, service methods, DTOs, permissions, UI, dashboard tiles, even a stale write-off suggestion in `CreateReturnModal.tsx`, ~1774 lines removed frontend-side). What remains: the generic `POST /inventory/adjustments` (`createAdjustment`) still technically accepts `reasonCode: write_off` via `inventory:stock:adjust` — but with no supplier linkage, no photo evidence, no dedicated approval flow, and no UI at all. Credit memos (`backend/src/accounting/credit-memos/`) only exist customer-side (`customerId`) — no debit-memo-to-supplier equivalent was ever built. Net: there is currently **no way** to formally record sending defective/wrong goods back to a supplier.

## Closing the gaps

### 1. Unify `Vendor` and `Supplier` (do this first — everything else in this scenario depends on it)

**Problem**: AP bills bill against a `Vendor`, while Procurement/Inventory maintains `Supplier` — the scenario explicitly says "supplier maintained in Inventory," implying one entity, not two disconnected ones.
**Fix**: this needs a product/data decision before any code: either (a) migrate `APBill` to reference `Supplier` directly (retire `Vendor`, backfill existing `APBill.vendorId` rows to matching/new `Supplier` records), or (b) if `Vendor`/`Supplier` are deliberately meant to serve different purposes (e.g. `Vendor` = general expense payees, `Supplier` = inventory-restocking sources specifically), keep both but add an explicit optional `supplierId` link on `APBill` for the subset of bills that originate from a PO/RR. Option (a) is cleaner and matches the scenario's stated intent; flag for a decision either way before implementing.

### 2. Add the RR ↔ Invoice link

**Problem**: no field connects a `GoodsReceipt` to an `APBill`.
**Fix**: once #1 resolves the entity question, add `purchaseOrderId`/`goodsReceiptId` (or a many-to-many join, since "partial deliveries are all RRs against one main invoice" implies one invoice can match multiple RRs) on `APBill`, and add a 3-way-match check (PO total vs. sum of matched RRs vs. invoice total) surfaced in the AP bill creation/approval UI.

### 3. Add voucher creation

**Problem**: no voucher entity/workflow exists.
**Fix**: extend `APBill` (or a new child `PaymentVoucher` record) with `voucherNumber` (manual entry), auto-fill payee from the linked `Supplier` (post-#1), file-attachment support (reuse whatever attachment mechanism already exists elsewhere in accounting, e.g. credit memos or bank reconciliation if either has one), and a two-step approval status (`pending_online_approval → pending_onsite_approval → approved`).

### 4. Add cheque printing

**Problem**: no cheque-number field or print artifact.
**Fix**: add a `chequeNumber` field to the payment record and a simple print template (reuse whatever print/PDF approach gets adopted for scenario 01's RFD gap, if any, to avoid introducing a second PDF-generation method in the codebase).

### 5. Design supplier-return handling — a real decision, not a re-add of write-offs

**Problem**: write-offs were deliberately removed; supplier returns currently have no mechanism at all.
**Fix**: **don't reflexively rebuild the old write-off feature** — confirm with the business why it was removed first (same flag as scenario 07's repair-disposal gap, which hits the identical wall). If a genuine supplier-return flow is wanted, the natural shape is a `SupplierDebitMemo` (mirroring the existing customer-side `CreditMemo`, adjusted to also update `Inventory` — reduce stock, and `AP` — reduce what's owed), not a resurrection of the generic write-off/adjustment mechanism.

## Dead code / unused-feature flags

- **`Vendor` vs `Supplier`** — not dead code exactly, but a duplicated/inconsistent domain concept that should be resolved per Closing Gap 1, not left as two parallel models.
- **`AdjustmentReasonCode.write_off`** enum value — still exists and is technically reachable via the generic adjustments endpoint, but with no supporting UI or supplier linkage. Leave as-is until the Closing Gap 5 decision is made; don't build UI on top of it without that decision first.

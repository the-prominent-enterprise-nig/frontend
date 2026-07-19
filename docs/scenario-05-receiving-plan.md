# Scenario 05 — Receiving — Gap Analysis & Closing Plan

> Recreates a doc of the same scope (`receiving-inventory-intake-plan.md`) found deleted from disk mid-session; content re-verified fresh against current code rather than assumed from memory.

Source: `module-scenarios.md`, scenario "Receiving — a delivery arrives at the branch."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3p2vey](https://app.clickup.com/t/86d3p2vey) — "AA Accountant, ISBAT see a Receiving Report automatically post to the General Ledger" — _Sprint 3, for qa_ — relates to Gap "GL posting not atomic with stock/PO update" (this ticket covers that posting happens, not that it's transactionally safe — worth re-testing the failure path specifically, not just the happy path, before treating this as fully closing the gap)
- [86d3p2vdy](https://app.clickup.com/t/86d3p2vdy) — "AA Stock Controller, ISBAT see accurate delivered-vs-outstanding quantities on a PO across multiple partial receipts" — _Sprint 3, for qa_
- [86d3p2vbz](https://app.clickup.com/t/86d3p2vbz) — "AA Accountant, ISBAT flag 1% supplier withholding tax on a Receiving Report and see it summarized" — _Sprint 3, for qa_
- [86d3p2v9n](https://app.clickup.com/t/86d3p2v9n) — "AA Stock Controller, ISBAT record the supplier and PO date on a Receiving Report so the source of goods is traceable" — _Sprint 3, for qa_
- [86d3aat0b](https://app.clickup.com/t/86d3aat0b) — "INV-69 — AA Warehouse Manager, ISBAT receive goods against a purchase order with batch capture" — _Sprint 3, for qa_
  ~~INV-29 — "AA Warehouse Manager, ISBAT attach photos when recording an item write-off" (Sprint 3, was: for qa)~~ — **deleted from ClickUp**. Confirmed stale: described a feature (write-off photo attachment) that was fully removed from the codebase in commits `96334e6`/`de5b0d8`.

**Not found in Sprint 3-5:** No ticket for branch-scoping the receive endpoint, none for enforcing `Item.isSerialTracked` server-side, none for manual serial-number entry — all three are Gaps in this doc with no tracked ticket.

## The scenario we're building toward

A supplier or warehouse delivery lands at a branch:

1. Encode the RR on the tablet (with or without a PO): reference, date, PO # & date, origin, mode, destination, cost.
2. Flag the 1% supplier withholding where applicable.
3. Link to the PO to monitor delivered versus lacking.
4. Post — saving updates stock (by serial/SKU) and auto-updates the account ledger.

## What's already done ✅

1. **RR with or without a PO** — `resolveSupplierId()` (`backend/src/inventory/services/stock.service.ts:144-160`) only requires a `supplierId` directly or via a linked PO line; no PO is ever mandated. `purchaseOrderNumber`/`poDate` are `@IsOptional()` (`stock.dto.ts:199-214`).
2. **1% supplier withholding** — `stock.service.ts:219-223` computes `withheldAmount` from `WithholdingType.pct_1`, defaulting from `supplier.defaultWithholding`, and nets it against AP in the GL lines (`:511, 532-541`). UI toggle at `ReceiveStockModal.tsx:312,327`.
3. **PO link / Ordered-Received-Remaining** — server-computed, not just client-side display. `purchaseOrderLine.receivedQuantity` is incremented server-side (`stock.service.ts:426-434`); discrepancy (`qtyOrdered`/`qtyReceived`/`qtyVariance`) computed server-side in `attachDiscrepancy()` (`:1092-1119`) and surfaced in `ReceivingReportsTab.tsx:209-236` and `PoReceiptsPanel.tsx:108,206-211`.
4. **Quality-hold / discrepancy flagging** — per-line `qualityHold` boolean skips the balance update (`stock.service.ts:370`) and sets `hasConditionIssue` in the discrepancy payload (`:1117`); UI checkbox at `ReceiveStockModal.tsx:452-462`.
5. **RR field capture** — `code`, `receivedAt`, `purchaseOrderNumber`/`poDate`, `modeOfTransfer`, `warehouseId` (destination), `nndpCost`/line `unitCost` all present (`stock.dto.ts:135-233`; `ReceiveStockModal.tsx:159-303`). Minor gap: no dedicated "origin" field — origin is only implicit via `supplierId`.

## What's not done / gaps ❌⚠️

Ordered by risk (correctness/security first).

1. **No branch-scoping on the receive endpoint — security gap.** `stock.controller.ts:73-78` (`receiveStock()`) passes only `user.enterpriseOwnerId` and the DTO — no `user.branchId`, unlike the read endpoints in the same file (`:116-120, 141-145`), which explicitly force `branchId: user.branchId ?? filters.branchId` with the comment "A branch-assigned caller is always scoped to their own branch, regardless of what branchId is submitted." `receiveStock()` in `stock.service.ts:200-401` never references `branchId` and never validates that `dto.warehouseId` even belongs to the caller's tenant. **Any user holding `inventory:receive:create` can post a receipt into any warehouse/branch by supplying its ID.**
2. **`Item.isSerialTracked` is never enforced server-side — correctness gap.** A full-file grep of `stock.service.ts` shows `isSerialTracked` referenced nowhere inside `receiveStock`. `serialNumbers`/`autoGenerateSerials` are optional with no cross-field validation (`stock.dto.ts:77-94`); the create path (`:272-315`) will happily create a `GoodsReceiptLine`/stock balance for a serial-tracked item with zero serials and `autoGenerateSerials` false. The only enforcement is client-side (`ReceiveStockModal.tsx:103,108` disables the auto-generate checkbox) — cosmetic, trivially bypassed via a direct API call.
3. **GL journal entry is not atomic with the stock/PO update — financial-integrity gap.** Stock ledger, cost layers, balances, and PO `receivedQuantity`/status all commit inside `this.prisma.$transaction(...)` (`stock.service.ts:243`). GL posting (`this.posting.post(...)`, line 512) runs _after_ that transaction has already committed — the code even says so: "GL posting happens after the stock transaction commits — never nested inside the $transaction above" (`:507-508`). The outer `try/catch` reformats errors but does not roll back already-committed stock/PO changes if `posting.post()` throws. `posting.service.ts:193` shows `post()` already accepts an optional `tx` client, so this is fixable without a new capability — it's just not wired through here.
4. **No manual serial-number entry UI.** Backend supports it — `ReceiveStockLineDto.serialNumbers?: string[]` (`stock.dto.ts:77-84`) is consumed directly into `GoodsReceiptLine.serialNumbers` (`stock.service.ts:280`) — but `ReceiveStockModal.tsx` only has the `autoGenerateSerials` checkbox (`:465-481`); serials are only ever _displayed_ read-only elsewhere (`PoReceiptsPanel.tsx:227-230`). Real manufacturer-assigned serials can't be typed in through the UI today.

## Closing the gaps

### 1. Branch-scope the receive endpoint (security — do this first)

**Problem**: `POST /inventory/stock/receive` never validates `warehouseId` against the caller's own branch.
**Fix**: mirror the exact pattern already used for `getLedger`/`getReceivingReports` — resolve the warehouse's `branchId`, and for a branch-restricted caller (`user.branchId` set), throw `ForbiddenException` if it doesn't match. Small, isolated, no schema change.

### 2. Enforce SKU-vs-Serial server-side

**Problem**: `receiveStock()` never checks `item.isSerialTracked`, so the client controls whether serials attach, regardless of the item's real tracking mode.
**Fix**: in `stock.service.ts::receiveStock()`, for each line, look up `item.isSerialTracked` and: if `true` and `autoGenerateSerials` is false with an empty `serialNumbers` array → `BadRequestException` (serials required); if `false` and either `autoGenerateSerials` is true or `serialNumbers` is non-empty → `BadRequestException` (serials not applicable). The existing client-side checkbox-disable logic can stay as a soft UX nudge on top of this.

### 3. Make GL posting atomic (or add a compensating rollback)

**Problem**: stock/ledger commits, then GL posts separately with no rollback on failure.
**Fix**, in order of preference: (a) move `this.posting.post(...)` inside the same `$transaction` as the stock/ledger writes — `JournalPostingService.post()` already accepts a transaction client, so this is a straightforward wiring change, not new capability; or (b) if transaction-size/timeout limits make (a) infeasible, add a compensating rollback on JE-post failure that reverses the already-committed `StockBalance`/`StockLedger`/`receivedQuantity` writes (the same claim-then-compensate idiom already used in `BankAccountsService.clearCashInTransit()`).

### 4. Add manual serial-number entry

**Problem**: real manufacturer serials can't be typed in — only auto-generated ones.
**Fix**: add a text-input mode alongside the existing `autoGenerateSerials` checkbox in `ReceiveStockModal.tsx` — per-line, a small repeatable input list matching the line's quantity, populating `serialNumbers[]` directly instead of leaving it to auto-generation. Validate count-matches-quantity client-side before submit; the backend already accepts this shape.

### 5. (Optional, low priority) Add a dedicated "origin" field

**Problem**: origin is only implicit via `supplierId` today; the scenario names it as its own captured field.
**Fix**: low priority — confirm whether "origin" is meant to be something distinct from the supplier (e.g. a specific warehouse/DC the goods shipped from, for multi-leg logistics) before adding a field; if it's just "which supplier," this is already covered and no gap exists.

## Dead code / unused-feature flags

None found specific to receiving in this pass.

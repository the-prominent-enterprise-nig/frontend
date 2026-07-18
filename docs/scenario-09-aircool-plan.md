# Scenario 09 — Aircool (Aircon Sale + Installation) — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "Aircool — aircon sale plus installation."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3pg8v5](https://app.clickup.com/t/86d3pg8v5) — "AA Cashier, ISBAT open a reopenable service draft with estimated materials when selling an aircon install, so the job can be revisited and edited until it's done" — _Sprint 3, to do_ — direct match to step 2 (this doc's Closing Gap 2, the `ServiceDraft`/`JobEstimate` entity)
- [86d3pg8vr](https://app.clickup.com/t/86d3pg8vr) — "AA Stock Controller, ISBAT raise a Purchase Request for materials missing from an aircon install job, so only what that job needs is ordered and tracked back to it" — _Sprint 3, to do_ — direct match to step 3 (Closing Gap 3)
- [86d3pg8wx](https://app.clickup.com/t/86d3pg8wx) — "AA Warehouse Manager, ISBAT return unused install materials to inventory when an aircon job closes, so leftover stock doesn't disappear off the books" — _Sprint 3, to do_ — direct match to step 5 (Closing Gap 5)
- [86d3p2w2z](https://app.clickup.com/t/86d3p2w2z) — "AA Cashier, ISBAT have POS automatically capture the correct serial/SKU set for a multi-part or bundled item at sale" — _Sprint 3, for qa_ — relates to step 1's dual-serial capture, already confirmed working in this doc's "What's already done"

**Not found in Sprint 3-5:** No ticket for step 1's "installation service" as its own sellable item type, and none for step 4 (technician records actual vs. estimated materials — the work-order/job-execution layer this doc's Closing Gap 4 calls "the biggest net-new piece"). Worth raising as new tickets given they're the two steps with no code either.

## The scenario we're building toward

A customer buys a split-type aircon and needs it installed:

1. Sell aircon + installation service in one POS sale (aircon captures indoor+outdoor serials).
2. Open a reopenable service draft estimating install materials.
3. Source materials from warehouse; if short, raise PR→PO to an area supplier (estimates carried on PO).
4. Technician installs, records actual vs. estimate.
5. Unused materials return to inventory; finalize/bill aircon + service + materials together; close the draft.

## What's already done ✅

**Not a distinct workflow at all** — zero hits for "Aircool," "service draft," or "installation service" anywhere. Only individual, generic building blocks exist:

1. **Dual-serial aircon capture at POS — CONFIRMED, real and working.** `secondarySerialNumberId` for split-type items, explicitly commented "e.g. aircon indoor+outdoor unit" (`backend/src/pos/dto/pos.dto.ts:339`); `requiresSecondarySerial` on `Item` (`schema.prisma:2447`); validation requiring both serials at `transactions.service.ts:2180-2227`; a seeded demo item, "Split-Type Aircon 1.5HP (Indoor + Outdoor)" (`prisma/seed.ts:4607-4680`).
2. **Generic PR→PO procurement pipeline — CONFIRMED, reusable but not aircon-specific.** `PurchaseRequest`/`PurchaseOrder` models (`schema.prisma:3002, 3075`), services in `backend/src/inventory/services/{purchase-request,purchase-order,procurement-quota,projection}.service.ts`. See scenario 10 for its own gaps.
3. **Generic multi-line POS sale + `ParkedSale` hold** — structurally similar to what steps 1/2 need, but not semantically equivalent: no BOM concept, no estimate-vs-actual tracking. `ParkedSalesService` (`backend/src/pos/parked-sales.service.ts`, `ParkSaleDto` at `pos.dto.ts:768`) is a generic serialized-cart hold-for-resumption, not an estimate/BOM object separate from the sale.

## What's not done / gaps ❌⚠️

1. **No distinct "installation service" SKU/item-type.** Grep for `service` (case-insensitive) in `items.dto.ts` returns nothing — POS multi-line sales are generic enough that a service _could_ be added as a normal non-serialized line item today, but nothing marks it as a service line tied to a job.
2. **No BOM/service-draft object — MISSING entirely.** No bill-of-materials model, no reopenable estimate concept distinct from a sale or a parked cart.
3. **No linkage from a job/service-draft to a PR/PO**, and PR/PO quantities aren't tied to any install-estimate concept.
4. **No technician/work-order/job-order concept — MISSING entirely.** No actual-vs-estimated-materials tracking anywhere in schema, backend, or frontend.
5. **No job-linked material return to inventory.** Only `ReturnRefundRequest` (`schema.prisma:1813`) exists, and it's for customer sales returns, not warehouse-bound unused-material returns from an install job. No stock-issuance/requisition model tied to a job exists either.

## Closing the gaps

This is a genuinely new, fairly large feature (job/work-order management layered on top of POS + Inventory + Procurement). Sequenced.

### 1. Add a "service" item type

**Problem**: nothing distinguishes a sellable service line from a stock item today.
**Fix**: add an `itemType: 'stock' | 'service'` (or similar) discriminator on `Item`, or a boolean `isService` flag — service items skip serial/stock requirements entirely at checkout, which the current model doesn't special-case.

### 2. Design the `ServiceDraft`/`JobEstimate` entity

**Problem**: no BOM/estimate object exists, and it needs to bridge a POS sale, a materials estimate, and (eventually) a PR/PO.
**Fix**: new model — `id`, `tenantId`, `branchId`, `posTransactionId` (nullable until the sale finalizes, or created alongside a parked sale), `status` (`draft | sourcing | installing | completed | cancelled`), with child `ServiceDraftLine` rows (`itemId`, `estimatedQty`, `actualQty`, source: `warehouse | purchase_order`). Reopenable = just a normal CRUD entity with a status that isn't terminal, not a special mechanism.

### 3. Link sourcing shortfall to PR→PO

**Problem**: PR/PO exists but nothing connects "this job needs materials" to it.
**Fix**: when confirming a `ServiceDraft`'s materials, check on-hand stock per line; for any shortfall, create a `PurchaseRequest` pre-filled with the shortfall quantities and a reference back to the `ServiceDraft` (a `sourceServiceDraftId`-style tag, matching the existing `triggeredByReorder` pattern on `PurchaseRequest`).

### 4. Technician / work-order layer

**Problem**: no job-execution tracking exists at all — this is the biggest net-new piece.
**Fix**: add a lightweight `technicianId` (could reuse the existing `User`/`Employee` model if technicians are just staff, rather than inventing a new entity) on the `ServiceDraft`, and let the install step update each `ServiceDraftLine.actualQty` against its `estimatedQty`. Keep this simple initially — full job-scheduling/dispatch is a separate, larger scope than "record actual vs. estimate."

### 5. Return unused materials + finalize/bill

**Problem**: no stock-issuance/requisition-return model tied to a job.
**Fix**: on `ServiceDraft` completion, diff `estimatedQty` vs `actualQty` per line; anything issued-but-unused gets a stock-ledger entry returning it to the warehouse (reuse the existing stock-ledger write pattern from `stock.service.ts`, don't invent a new one). Finalizing bills the aircon + service line + actual materials together as one `PosTransaction`, closing the `ServiceDraft`.

## Dead code / unused-feature flags

None — this scenario's building blocks (dual-serial capture, PR/PO, ParkedSale) are all actively used for other purposes and should be extended, not touched destructively.

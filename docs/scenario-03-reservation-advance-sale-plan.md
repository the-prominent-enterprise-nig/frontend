# Scenario 03 — Reservation / Advance Sale — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "Reservation / advance sale — item not in stock yet."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3592b6](https://app.clickup.com/t/86d3592b6) — "AA Sales Rep, ISBAT reserve an item against expected inbound stock with optional payment — none, deposit, partial, or full — held as a customer advance until the sale closes" — _Sprint 4, to do_ — **this is the ticket for the whole scenario**, worded almost identically to steps 1-2 below.

Related but a different concept — don't conflate:

- [86d3phg2z](https://app.clickup.com/t/86d3phg2z) / [86d3phg1q](https://app.clickup.com/t/86d3phg1q) / [86d3phg08](https://app.clickup.com/t/86d3phg08) — "ISBAT have a selected serial reserved and routed for approval before my sale finalizes" (Business Owner / Branch Manager / Cashier) — _Sprint 3, for qa_ — this is a manager-override approval hold on a serial already in an active checkout, not a SKU-level advance/deposit reservation against future stock. Same word ("reserve"), different feature.

**Not found in Sprint 3-5:** No ticket for the "hold against incoming stock, auto-earmark an arriving serial" step, and none for cancel + deposit refund specifically — the one ticket found (86d3592b6) covers the concept at a high level but doesn't break out these sub-steps.

## The scenario we're building toward

A customer wants furniture the branch doesn't have on hand:

1. Reserve by SKU (no serial yet).
2. Payment optional — nothing, deposit, partial, or full; split/multi-tender; held as a customer advance in AR.
3. Reservation flags a backorder; an arriving serial is earmarked to it.
4. On arrival: serial assigned, balance collected, invoice issued, inventory deducted, revenue recognized.
5. Cancel: reservation closes, any deposit refunded.

## What's already done ✅

Nothing in this scenario is done end-to-end. Two adjacent, disconnected building blocks exist and are worth knowing about before designing the real feature:

1. **`StockReservation`** (`backend/prisma/schema.prisma:3638-3660`, `backend/src/inventory/services/reservations.service.ts:36-54`, frontend `frontend/src/app/(app)/(dashboard)/inventory/reservations/`) — a soft hold on stock that's _already on hand_. `create()` explicitly requires `balance.availableQty >= dto.reservedQty` and throws otherwise (`reservations.service.ts:41-54`) — the opposite of reserving something not in stock. `referenceType` is constrained to `quotation | sales_order` (`schema.prisma:3648`) with no POS/CRM/customer linkage and no payment field. Status enum is only `active | expired | released` (`schema.prisma:3574-3578`).
2. **`Backorder`** (`backend/prisma/schema.prisma:3675-3697`, `backend/src/inventory/services/backorders.service.ts`) — created from a sales-order line that exceeds available quantity. Has `linkedPoId` (plain string, not a real FK) and `commitmentDate`/`expectedFulfillAt`. `fulfill()` (`backorders.service.ts:93-127`) is a manual quantity bump only — grep confirms the only other reference to `Backorder` is in `projection.service.ts` (forward-stock reporting), so **nothing in goods receiving auto-triggers fulfillment**.
3. **POS has no reservation concept at all.** `PosTransactionStatus` is only `completed | voided` (`schema.prisma:1459-1462`) — no "reserved"/"pending" state. Checkout even has a defensive comment about this: `frontend/.../pos/checkout/page.tsx:1118-1120` notes "Backend has no dedicated error code yet for a serial that was reserved..." — the reservation concept is absent from POS's mental model entirely, only handled defensively as a stale-serial race condition.
4. **No customer-advance/deposit-in-AR mechanism.** `ar-invoices.service.ts` has no overpayment/credit-balance/unapplied-cash concept (confirmed via grep for `overpay|creditBalance|unapplied` — zero hits).

## What's not done / gaps ❌⚠️

Everything the scenario describes is missing:

1. No serial-less, SKU-only reservation entity (both existing "reservation-shaped" models require either on-hand stock or an existing sales order).
2. No optional/partial/split payment captured at reservation time.
3. No "customer advance" liability concept in AR at all.
4. No automatic earmark of an arriving serial to a specific reservation during receiving.
5. No fulfil-on-arrival flow (collect balance, issue invoice, deduct inventory, recognize revenue at that point, not before).
6. No cancel + deposit-refund flow (nothing to refund, since no payment can currently attach to a reservation).

## Closing the gaps

This is a net-new feature, not a set of small fixes — sequence matters because later steps depend on earlier ones existing.

### 1. Design the core `Reservation` entity (new, not a reuse of `StockReservation`)

**Problem**: `StockReservation` is structurally wrong for this (requires available stock). Reusing it would mean relaxing its core invariant for an unrelated use case, risking regressions in its existing quotation/sales-order callers.
**Fix**: add a new model, e.g. `SkuReservation` — `id`, `tenantId`, `branchId`, `itemId` (SKU-level, no serial), `customerId`, `quantity`, `status` (`open | fulfilled | cancelled`), `depositAmount`, `createdAt`. Keep it separate from `StockReservation` deliberately.

### 2. Customer-advance-in-AR mechanism

**Problem**: no way to record money held against a future, not-yet-invoiced obligation.
**Fix**: this is the highest-leverage piece to get right since scenario 03 isn't the only place a customer deposit might be needed later. Add a liability-side concept — e.g. a `CustomerAdvance` ledger entry (Dr Cash / Cr Customer Advances Payable) posted at deposit time, applied against the final invoice at fulfillment (Dr Customer Advances Payable / Cr AR or directly into the sale). Reuse the existing `JournalPostingService`/`AccountMapping` pattern (a new `CUSTOMER_ADVANCES` mapping key) rather than inventing a new posting mechanism.

### 3. Wire reservation creation into POS checkout

**Problem**: POS has zero reservation awareness.
**Fix**: add a new checkout mode (alongside Cash/Charge/Installment) — "Reserve" — that creates a `SkuReservation` + optional payment via the customer-advance mechanism (#2) instead of a `PosTransaction`.

### 4. Auto-earmark on receiving

**Problem**: `Backorder.fulfill()` is manual only; nothing in `stock.service.ts::receiveStock` looks for open reservations against the item being received.
**Fix**: in the receiving flow, after a serial/stock is added, check for open `SkuReservation` rows on that `itemId` (oldest-first or explicit priority) and flag a match for staff to confirm/assign — auto-assigning without confirmation risks giving a specific serial to the wrong queued customer when multiple reservations exist.

### 5. Fulfil-on-arrival flow

**Problem**: no UI/flow to convert a matched reservation into a real sale.
**Fix**: once a serial is earmarked (#4), surface it in a "Ready to fulfil" queue (could live under the new Reservation module or POS); fulfilling collects the remaining balance and creates a normal `PosTransaction`, applying the deposit via the customer-advance mechanism, then deducts inventory and closes the reservation.

### 6. Cancel + refund

**Problem**: nothing to refund today.
**Fix**: once #2 exists, cancellation just reverses the `CustomerAdvance` entry (refund payment or credit) and marks the reservation `cancelled`.

## Dead code / unused-feature flags

None specific to this scenario — the closest building blocks (`StockReservation`, `Backorder`) are actively used for their own real purposes and should not be touched/repurposed.

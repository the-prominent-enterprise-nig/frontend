# Scenario 03 — Reservation / Advance Sale — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "Reservation / advance sale — item not in stock yet."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3592b6](https://app.clickup.com/t/86d3592b6) — "AA Sales Rep, ISBAT reserve an item against expected inbound stock with optional payment — none, deposit, partial, or full — held as a customer advance until the sale closes" — _Sprint 4, in review_ — **this is the ticket for the whole scenario**, worded almost identically to steps 1-2 below.

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

## Implementation Log — 2026-07-21

**For this scenario, I have done:**

- **Closing Gap 1 (core `SkuReservation` entity):** new `SkuReservation` model (branch-scoped, SKU+quantity, no serial) with `open|earmarked|fulfilled|cancel_requested|cancelled` lifecycle; `create()`/`findAll()`/`findOne()` CRUD, branch-scoping mirrors the `actorBranchId ?? dto.branchId` pattern already used for transfers. `depositAmount`/`amountPaid` deliberately inert at this stage (no payment mechanism existed yet).
- **Closing Gap 2 (customer-advance-in-AR mechanism):** new `CustomerAdvance` model + `CUSTOMER_ADVANCES` GL mapping key (2070 Customer Advances Payable) + `record()` — posts Dr Cash / Cr Customer Advances Payable. Deliberately generic (`referenceType`/`referenceId`, no hard FK to `SkuReservation`) per the doc's own framing that this isn't reservation-exclusive.
- **Closing Gap 3 (POS checkout wiring):** a 4th "Reserve" checkout mode in `pos/checkout/page.tsx` — reuses the existing customer picker and cart/catalog UI (capped at one line, serial-forcing suppressed), an optional single deposit via the existing Payment card, and its own success screen. Calls the Part 1/2 endpoints directly; never touches `/pos/transactions`.
- **Closing Gap 4 (auto-earmark on receiving):** `StockService.earmarkOpenReservations()`, called from `receiveStock()` right after a line's balance update (skipped for quality-hold lines). Strict oldest-first FIFO — the oldest open reservation must be fully coverable by the item's running available balance before it earmarks; a smaller newer one never jumps the queue. Matches against the running balance (not just one receipt's delta) so a reservation larger than any single receipt still clears once enough accumulates across several. Records `earmarkedSerialNumberId` (real, currently-unclaimed serials only) and `earmarkedWarehouseId` (added after Part 5 surfaced that a branch can have more than one warehouse — see "Worth flagging").
- **Closing Gap 5 (fulfil-on-arrival):** `SkuReservationsService.fulfil()` — applies any `CustomerAdvance` deposit via `CustomerAdvancesService.apply()` (new), collects any remaining balance (posts its own JE), deducts inventory (`StockService.deductStockTx`, extended with an optional `referenceType`), flips the earmarked serial to `sold` if any, marks the reservation `fulfilled`. Deliberately simplified vs. a full POS checkout — no VAT/promo/discount, matching Part 1's own SKU+quantity-only scope.
- **Closing Gap 6 (cancel + refund):** Cashier `request-cancel` → the reservation's own branch's Branch Manager (or Business Owner) `approve-cancel` (refunds via `CustomerAdvancesService.refund()`, new) or `reject-cancel` (reverts to `open`/`earmarked`, inferred from whether `earmarkedWarehouseId` is set). Inline-column pattern (mirrors `StockTransfer`'s per-stage actor/timestamp/reason columns) plus a CAS `updateMany`+`count` concurrency guard (borrowed from `release-form-requests.service.ts`). Cancel-approve and refund are Branch-Manager-scoped only — confirmed with the developer that a Cashier must never self-approve.

**Confirmed decisions (Phase 2):**

- Earmark ordering: strict oldest-first FIFO, no skip-ahead for a smaller reservation that would otherwise fit.
- Cancel + refund requires Branch Manager (or Business Owner) approval — a Cashier can only request, never self-approve.

**Worth flagging:**

- **A real bug found and fixed during Part 5's own e2e testing**: the first version of `fulfil()` re-derived a bulk (non-serial) reservation's warehouse via `warehouse.findFirst({ branchId })` — ambiguous and silently wrong the moment a branch has more than one warehouse (which this project's own e2e fixtures now do, across scenario-03's several isolated test warehouses tied to the same real Manila HQ branch). Fixed by having the Part 4 earmarking hook record `earmarkedWarehouseId` directly, so `fulfil()` never re-guesses it. Caught by the e2e suite itself (intermittent 400s that traced back to "insufficient stock" against the wrong warehouse), not by inspection — a good argument for this project's "run it, don't just read it" testing convention.
- **No frontend UI exists for anything beyond Part 3's POS Reserve mode.** Parts 1, 2, 4, 5, and 6 are API-only — there's no reservations list/detail screen, and no UI for a Cashier to request cancellation or a Branch Manager to approve/reject one. Staff would need to hit the API directly (Swagger, etc.) today. This wasn't in this run's confirmed scope, but is a real gap if NIG expects staff to use this without a UI.
- **Reservation creation at POS defaults to the same roles who can do a normal sale** (Cashier/Branch Manager, cumulative to Business Owner) — this was stated as an assumption in Phase 2's recap and never corrected, so it stands as confirmed.
- `generateGrnCode()` (pre-existing, `stock.service.ts`) is count-based and collides once any same-day receipt has been deleted — the same class of bug already flagged and fixed for TRF-/GRN- codes in Scenario 06's transfers work, just not here. Not fixed as part of this run (out of scope) — the e2e specs sidestep it by passing an explicit unique `code`.
- `apply()`/`refund()` on `CustomerAdvancesService` are deliberately generic (not reservation-exclusive), per the model's own doc comment — reusable by a future scenario needing the same "money held against a future obligation" primitive.

## Implementation Log — 2026-07-21 (bug-fix round)

**Context:** after Parts 1-6 above were implemented and individually verified, a self-initiated 4-dimension adversarial review (correctness, security/RBAC, financial-integrity, frontend-and-tests) was run against the full diff before treating the scenario as done. It surfaced 11 confirmed findings, all fixed in this same run — none were carried forward as known-broken.

**Backend fixes:**

- **Earmarking ignored `variantId` and wasn't tenant-scoped** (`stock.service.ts::earmarkOpenReservations`): a receipt for one variant of an item could earmark an open reservation for a _different_ variant of the same item (StockBalance/availableQty is scoped by `itemId+variantId`, but the match query wasn't). The "already-claimed serials" lookup was also missing a `tenantId` filter. Both now scoped correctly; covered by a new earmarking test using two real `ItemVariant` rows on the same base item.
- **`fulfil()` never posted a COGS/Inventory-Asset journal entry** — inventory was deducted and revenue/deposit JEs posted, but the cost side of the sale was silently dropped. Now posts Dr COGS Expense / Cr Inventory Asset via `CostingService.computeCogs()` + `JournalPostingService`, consuming FIFO/LIFO cost layers when applicable (mirrors `TransactionsService.create()`'s own pattern). Covered by a new test asserting the JE exists.
- **`fulfil()` had no concurrency guard** — two near-simultaneous fulfil calls on the same reservation could both pass the initial status check and double-deduct inventory/double-apply the deposit. Added the same CAS (`updateMany` + `count`) guard already used by `release-form-requests.service.ts`. Covered by a new test firing two concurrent fulfil calls and asserting stock is decremented exactly once.
- **`approveCancel()` didn't clear earmark fields** — a cancelled reservation kept `earmarkedSerialNumberId`/`earmarkedWarehouseId`/`earmarkedAt` set, permanently tying up a real serial that could never be reassigned. Now cleared on approval. Covered by a new test.
- **`create()` had no cross-tenant validation** on `itemId`/`variantId`/`customerId` — these are plain global-UUID PKs with no compound tenant key, so a caller could reference another tenant's item/customer and the row would silently be created. Now validated tenant-scoped (mirrors `CustomerAdvancesService.record()`'s own pattern), 404s on a foreign id. Covered by two new tests using a throwaway second tenant (same convention as `aircool.e2e-spec.ts`).
- **No guard against two ACTIVE `CustomerAdvance` rows for the same reference** — `record()` would happily create a second deposit against a reference that already had an outstanding one, and `apply()`/`refund()` on either would settle against the same underlying obligation independently. Now rejected with 400 while a prior one is still ACTIVE (a new advance is allowed once the old one is APPLIED/REFUNDED). Covered by two new tests.
- **`apply()`/`refund()`'s boundary check allowed a 1-cent negative balance** — the old `amount > unapplied + 0.01` tolerance let `amount` exceed `unapplied` by up to a cent, driving `unappliedAmount` negative. Replaced with integer-cents comparison (`Math.round(x * 100)`), which also removes the float-tolerance hack entirely. Covered by two new tests (one for `apply()`, one for `refund()`) each asserting the over-the-boundary amount 400s and the exact boundary amount succeeds.
- **Documented, not changed:** three e2e spec files intentionally leave behind `GoodsReceipt`/`SerialNumber` rows from their `receive()` helper — this matches the project's existing "E2E items archived, not deleted" convention (already true of other specs that exercise receiving), not an oversight. Added an explicit comment at each `receive()` helper saying so; also deleted an earmarking-spec array (`createdGoodsReceiptIds`) that tracked ids for a cleanup step that was never wired up.

**Frontend fixes** (`pos/checkout/page.tsx`):

- **Switching checkout mode didn't reset the cart** — a cart line built while in Reserve mode has `isSerialTracked` forced to `false` (Reserve mode doesn't collect serials yet); switching back to Cash/Charge/Installment with that stale line still in the cart could skip serial selection for an item that actually requires one. All four mode-selector buttons now go through `handleInvoiceTypeChange()`, which clears the cart whenever the mode actually changes.
- **Reserve mode's deposit cap used the tax/promo-inclusive `totalAmount`** instead of the backend's flat `item.sellingPrice × quantity` reservation value (`SkuReservationsService.fulfil()` has no VAT/promo/SC-PWD concept at all) — a deposit that looked valid against the on-screen (VAT-inclusive) total could still get rejected server-side, or vice-versa. Added a dedicated `reserveValue`/`reserveBalance` pair used only by Reserve mode's cap check and its "Remaining at fulfilment" display; every other mode's totals are untouched.

**Verification:** all 5 backend e2e spec files (42 tests total, up from 31) and the frontend Playwright reserve-mode spec pass individually per this project's no-batch-run convention; `tsc --noEmit` and `eslint` are clean on every touched file (two pre-existing, unrelated lint errors in `prisma/seed.ts` from Scenario 06's text were left alone — not part of this diff).

## Implementation Log — 2026-07-21 (Part 7 — Reservations UI)

**Context:** Parts 1-6 (and the bug-fix round above) were API-only for anything past creation — no in-app way to view a reservation or act on it (fulfil, request-cancel, approve/reject-cancel) except by calling the endpoints directly. This closes that gap.

**For this scenario, I have done:**

- **New `/pos/reservations` page**, added to the POS nav (Overview | Checkout | Reservations | Transactions). Lists reservations with item/customer/qty/deposit/status, a status filter, and role-gated actions reusing the exact permissions Parts 1-6 already established (no new roles/grants introduced):
  - **Fulfil** (Cashier+) on `earmarked` rows — modal shows deposit collected / remaining due and a payment-method picker when a balance remains.
  - **Request Cancel** (Cashier+) on `open`/`earmarked` rows — reason required.
  - **Approve / Reject** (Branch Manager+ only, matching Part 6's confirmed decision) on `cancel_requested` rows.
- **Fixed a real display bug caught while testing this against a real reservation**: `SkuReservation.depositAmount` stays `0` until fulfilment by design (the deposit lives on a separate `CustomerAdvance` row until then) — the list's first pass showed "Deposit: ₱0.00" for a reservation that actually had money collected. Added a `getCustomerAdvances` action/hook (didn't exist before) so the list joins in the real `CustomerAdvance` amount instead.
- Added `item.sellingPrice` to the backend's `includeRelations` (additive, non-breaking) so the frontend can compute remaining-balance-due without duplicating `fulfil()`'s pricing math.
- **Parked Sales tab hidden from the POS nav** per developer request — the underlying `ParkedSalesService`/route/controller are untouched and still real (confirmed via a doc search: it's an actively-used building block for Scenario 09/Aircool, explicitly not something to remove) — only its nav entry point was removed.

**Confirmed decisions:**

- Investigated whether "Parked Sales" was a real, load-bearing feature before touching it (per developer's own request to check first) — confirmed it is (`ParkedSalesController`/`ParkedSalesService`, its own route, referenced as an active dependency by Scenario 09's gap-analysis doc) — so only the nav tab was hidden, not the feature itself.
- Reservations get their own nav tab rather than folding into (or replacing) Parked Sales — the two are different concepts (pause-my-cart vs. a customer-facing future commitment).

**Verification:** new Playwright spec (`e2e/pos-reservations-list.spec.ts`, 2 tests) plus the existing reserve-mode spec, both pass; `tsc --noEmit`/`eslint` clean on every touched file; full backend regression (all 5 specs, 42 tests) re-verified after the `includeRelations` change.

**Worth flagging:**

- Backend e2e specs run against the real shared dev DB (this project's existing convention) and leave `E2E-*` test items in the live catalog on every run — cleaned up twice this session (32 items, then 24 more after re-running for verification). This will recur on every future test run against this DB; ask if you'd like a standing cleanup script instead of ad hoc cleanup each time.

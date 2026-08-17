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

   **Superseded 2026-08-14 (Scenario 27 — Warehouse Tier Correction, Part 3):** the fix actually shipped for this gap (see 2026-07-27 Implementation Log below) — a branch-ownership check comparing the destination warehouse's `branchId` to the caller's own — was itself later replaced. Goods are now always received into one of the 2 real warehouses (PANAY/NEGROS, `branchId: null`), never a branch's own local stock, so a branch-ownership comparison no longer makes sense. `stock.service.ts:356-377` now runs a real-warehouse integrity check instead: any authenticated receiver picks between the same 2 real warehouses, and the check simply rejects a `warehouseId` that isn't one of them (`ForbiddenException` if `warehouse.branchId !== null`). The underlying gap (an unauthorized destination) is still closed — just via different logic than described below.

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

## Implementation Log — 2026-07-27

**For this scenario, I have done:**

- Gap 1 — Branch-scoped the receive endpoint: a branch-restricted caller now gets rejected (`ForbiddenException`) if `warehouseId` doesn't belong to their own branch, mirroring the existing `getLedger`/`getReceivingReports` pattern.
- Gap 2 — Enforced `Item.isSerialTracked` server-side: a serial-tracked item now requires `serialNumbers` or `autoGenerateSerials`; a non-serial-tracked item is rejected if given either; a mismatched `serialNumbers.length` vs `quantityReceived` is rejected.
- Gap 3 — Made GL posting atomic: `posting.post(...)` now runs inside the same `$transaction` as the stock/ledger/balance writes, passing `tx` through (the capability already existed on `PostingService.post()`, just wasn't wired here) — a posting failure (e.g. a hard-closed fiscal period) now rolls back the whole receipt instead of leaving stock updated with no journal entry.

**Worth flagging:**

- Gaps 4 (manual serial-number entry) and 5 (dedicated origin field) were not touched this run — out of scope for this pass, which focused on the three correctness/security gaps found during a live gap audit against `development`.
- Found and fixed unrelated drift while testing: two migrations from an earlier merge (`add_pr_source_service_draft`, `add_service_draft_technician`) had never been applied to the local dev database, and the `WHT_PAYABLE` account mapping was missing entirely — both backfilled.
- Found one pre-existing, unrelated broken test (`procurement-closeout.e2e-spec.ts`'s write-off test calls a `/inventory/adjustments/write-off` route that no longer exists — write-offs now live under the UDS/Repair Transfer flow) — left as-is, out of scope for this pass.
- New coverage: `test/inventory-receiving-branch-serial-gl.e2e-spec.ts` (9 tests, including a hard-closed-period test proving the atomic rollback). Full regression pass across all Receiving-adjacent suites (receiving-enhancements, stock-balance-serial-tracked, sku-reservation-\*, phase5-valuation, procurement-closeout, pos.smoke) confirmed green.

## Implementation Log — 2026-07-31

**For this scenario, I have done:**

- **Doc drift correction** — Gap 4 (manual serial-number entry) was recorded as "not touched" in the 2026-07-27 log, but a live re-check found it fully built (`ReceiveStockModal.tsx`'s `parseSerials()`/"Enter serials" toggle). Correcting the record: Gap 4 is closed, not open.
- **Gap 5 resolved as a non-gap** — confirmed with the developer that "origin" means the supplier, nothing distinct. No field added; closing this item.
- **Updates #2 (item cost hidden from Branch Manager/Employee)** — new `inventory:receive:cost-view` permission, granted to Business Owner (automatic, full grant) and Accountant only. Enforced both ways: server-side, `receiveStock()` now strips `unitCost` (all lines) and `nndpCost` (header) when the caller lacks the permission — not just a client-side hide, matching this scenario's own precedent from Gaps 1/2; client-side, the Unit Cost column, NNDP Cost field, and the derived withheld-amount preview are hidden entirely in both `ReceiveStockModal` and `ReceiveAgainstPoModal` for roles without it. Scope, confirmed with the developer: Receiving-flow-only for this pass — the updates doc's broader "may need to apply beyond the RR itself, to inventory list/detail views too" note surfaced 14 files (Item Master, Costing/Valuation, Bundles, PO screens) that also display cost; none of those were touched here, see "Worth flagging."
- **Updates #4 (freebies section)** — new `GoodsReceiptLine.isFreebie` boolean (migration `20260731051256_add_goods_receipt_line_freebie`), a first-class flag distinct from "cost wasn't entered." Server forces `unitCost` to 0 for any line marked as a freebie, regardless of who submits it or what value they send — a freebie is zero-cost by definition, not a permission question. UI: a "Freebie" checkbox per line in `ReceiveStockModal` replaces the Unit Cost cell with a plain "Free" label when checked; the Receiving Reports detail view and the printed Goods Receipt Note both now show a "Freebie" indicator on marked lines. Scope, confirmed with the developer: captured at RR time only (not PO time) — this system already supports receiving without a PO at all, so RR-time is the one capture point that works for every receiving path.
- **Found and fixed while verifying Updates #4 in the browser:** `ReceivingReportsTab.tsx`'s detail panel rendered literally nothing (`null`) when the receipt-detail fetch failed, since `getReceivingReport()` resolves rather than throws on a backend error — there was no error branch at all. Added one (`detailError` surfaced from the hook, red error box with a Close action in the UI).
- **Refactored the detail panel to expand inline**, directly under the clicked row (as an expandable `<tr>`), instead of rendering in a separate section below the entire receipts table — on a page with dozens of receipts, the old layout meant scrolling past every remaining row to see what you'd just clicked. Also removed the panel's redundant white-card-in-a-gray-box styling (it's now visually tied to the row via a purple left-accent border and a soft purple-tinted header, matching the row's own selected-state highlight) and removed the header's explicit close (X) button, since clicking the row/chevron already toggles it — Print is now the only header action.

**Worth flagging:**

- **Not extended to `ReceiveAgainstPoModal`** — neither the freebies checkbox nor (this matters less, since cost-view _was_ extended there) anything else new in this pass touches "Receive against PO." That modal is architecturally fixed to the PO's own line items with no "add an arbitrary extra item" capability at all; adding freebie support there means adding that capability first, a materially bigger change. If a freebie arrives alongside a PO delivery today, it needs a separate standalone receipt via the plain Receiving form.
- **Cost-visibility inventory-wide expansion deferred** — confirmed with the developer to scope this pass to the Receiving flow only. The updates doc's broader ask (also restrict cost on Item Master list/detail, Costing/Valuation, Bundles, PO screens — 14 files total) is still open; worth its own pass. (Originally suggested this belonged under Scenario 16 — Item Master Governance — but that scenario closed 2026-08-04 without picking it up, and its plan doc was removed 2026-08-14; this item needs a new home.)
- **`WHT_PAYABLE` GL mapping was missing again** — this is the _second_ time (previously backfilled 2026-07-27, per the log above). Root cause now understood: `prisma/seed.ts`'s own base account list never creates GL account 2060 (WHT Payable) or its mapping at all — only the separate, UI-triggered "Seed PH Defaults" flow (`coa-seed.service.ts`'s `seedPH()`) does. A necessary re-seed for this run's new permission wiped the earlier manual patch, breaking 14 tests in `inventory-receiving-enhancements`/`sku-reservation-*`/`inventory-phase5-valuation`. Restored by calling the app's own `POST /coa-seed/ph` endpoint (legitimate, idempotent, no manual data hacking) — all 51 tests in those suites pass again. The underlying gap (base CLI seed incomplete relative to the full PH chart of accounts) will resurface on the next fresh seed; worth a real fix in `prisma/seed.ts` itself, out of scope here.
- **Correcting an earlier claim in this same log entry** — the "hard-closed period" test failure noted above as "confirmed-unrelated, root cause not investigated" was re-investigated on a second pass and traced to a real, self-inflicted cause: this file's `describe('Atomic GL posting', ...)` test creates a fiscal period covering the _entire current month_ marked `HARD_CLOSED`, torn down only by the file's single outer `afterAll` — not per-describe-block. The new "Cost visibility" and "Freebies" blocks were originally appended _after_ that block in file order, so once the current date rolled past 2026-07-31 into August, both blocks' real-cost receive attempts started hitting that same closed period and failing. **Fixed** by moving "Atomic GL posting" to run last (after every describe block that does a real-cost receive), with a comment explaining why the ordering matters here.
- **Also fixed**: the same spec file's `afterAll` cleanup was throwing on every run (`stock_cost_layers_itemId_fkey` violation deleting `Item` before its `StockCostLayer` rows, predating this pass) — added the missing `stockCostLayer.deleteMany()` before the `item.deleteMany()` it was violating.
- New coverage: 4 new backend e2e tests (2 cost-visibility, 2 freebies) in `test/inventory-receiving-branch-serial-gl.e2e-spec.ts`; 3 new frontend e2e specs (`inventory-receiving-cost-visibility.spec.ts`, `inventory-receiving-freebies.spec.ts`). Full regression, final pass: `inventory-receiving-branch-serial-gl` (13/13), `inventory-receiving-enhancements`, `inventory-phase5-valuation`, `sku-reservation-*` — 7 suites, 64 tests, all green, zero suite-level hook failures. Frontend: 4/4 e2e tests green.

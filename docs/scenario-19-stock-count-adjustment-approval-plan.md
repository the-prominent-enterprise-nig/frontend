# Scenario 19 — Stock Count & Inventory Adjustment Approval — Gap Analysis & Closing Plan

Source: `NIG_ERP_Core_Operational_Scenarios_Draft_2_20260727.pdf`, row "13. Counting stock and approving an inventory adjustment." New scenario, mapped from this row — no equivalent existed in the original `module-scenarios.md` source, and it doesn't fit any of Scenarios 01-14 (Scenario 07's write-off path is the closest existing neighbor, but is repair-specific, not a general count/adjustment workflow).

## Related ClickUp Tickets

None found. Net-new scope.

## The scenario we're building toward

A cycle count, monthly audit or variance alert is due:

1. Stock Custodian counts without editing on-hand.
2. The system compares by SKU/serial and produces the variance.
3. Branch Manager confirms the count.
4. HO Inventory/Audit investigates.
5. An Authorized Approver posts or rejects the adjustment.
6. The system updates inventory/GL and logs before and after values.

**Result**: variance is resolved through an approved transaction; saleable and non-saleable statuses remain distinct.

## What's already done ✅

1. **`StockCount` model + full lifecycle already exists.** Enums `StockCountType`/`StockCountStatus` (`backend/prisma/schema.prisma:2579-2590`), model at `:3179-3196`; create → start → submit → cancel in `src/inventory/services/counts.service.ts`, `src/inventory/controllers/counts.controller.ts`, `src/inventory/dto/counts.dto.ts`.
2. **`AdjustmentsService.createAdjustment()` already supports multiple variance reasons**, not just write-off — `AdjustmentReasonCode` includes damaged, miscounted, expired, theft, write_off, found (`schema.prisma:2570-2577`).
3. **Frontend UI for physical counts + live variance already exists.** `frontend/.../inventory/stock-counts/_components/CountSessionView.tsx`; also `cycle-counts/` and `mobile-count/` pages.
4. **`StockLedger` already records a delta + reason code** per movement (`schema.prisma:3071-3095`).

## What's not done / gaps ❌⚠️

1. **No server-generated system snapshot to diff against.** `submit()` takes `expectedQty` as caller-supplied input (`counts.dto.ts:59-65`), not a snapshot the system captured at count-start time — so the "variance" isn't provably against a true system-of-record baseline.
2. **No approval chain on `StockAdjustment` at all.** No status field; adjustments post immediately on creation, gated only by a single `inventory:stock:adjust` permission (`adjustments.controller.ts:38-52`). The PDF's confirm → investigate → approve/reject chain doesn't exist anywhere.
3. **No explicit before/after audit log.** `StockLedger` records deltas (`quantityChange`), not the before/after on-hand values themselves — balances mutate via `increment`.
4. **No serial-level counting UI.** SKU-level only; single-step submit with no serial reconciliation.
5. **No general "saleable/non-saleable" status bucket.** Only per-serial `SerialNumberStatus` (defective/held) and per-batch `BatchStatus.quarantine` exist — no general concept a count could flag a unit into.

## Closing the gaps

Ordered by risk/value.

### 1. Snapshot the expected quantity server-side

**Problem**: a caller-supplied `expectedQty` means the "variance" can't be trusted as a true system comparison.
**Fix**: have `counts.service.ts` snapshot `expectedQty` from current `StockLedger` balances at session start, not accept it as input. This is an integrity fix and should land first regardless of what else gets built.

### 2. Add an approval chain to `StockAdjustment`

**Problem**: adjustments post immediately with no review.
**Fix**: add a status field (`submitted` → `confirmed` → `investigating` → `approved`/`rejected`) mirroring the PDF's chain, carrying the existing reason codes through unchanged.

### 3. Add explicit before/after values

**Problem**: reconstructing an audit trail from deltas alone is fragile.
**Fix**: add `beforeQty`/`afterQty` columns (or a computed view) alongside the existing delta.

### 4. Confirm serial-level counting scope

**Problem**: serialized categories (aircon, appliances) may need serial-by-serial reconciliation, which is materially more UI/scan-flow work than SKU-level counting.
**Fix**: confirm with the business whether this is actually needed before building it.

### 5. Decide on a "non-saleable" status

**Problem**: no general status exists for a unit a count finds to be damaged/questionable.
**Fix**: decide whether this needs a new general Item/SerialNumber-level status, or whether the existing per-serial/per-batch statuses already cover it once surfaced consistently in the count UI.

## Dead code / unused-feature flags

None found.

## Implementation Log — 2026-08-04

**For this scenario, I have done:**

- Item #1 (snapshot expected quantity) — Part 1: new `StockCountLine` model, snapshotted from live `StockBalance` when `start()` runs. `submit()` no longer accepts `expectedQty` from the caller at all (removed from the DTO) — it diffs the counter's `countedQty` against the snapshot. New `GET /inventory/counts/:id/lines` exposes the snapshot; the Count Sheet UI shows Expected as read-only, with an "Add Found Item" path for genuine finds with no prior balance.
- Item #2 (approval chain) — Part 2: new `StockAdjustmentStatus` (`submitted → confirmed → investigating → approved`/`rejected`) and `StockAdjustmentLine` model holding pending line data. Both creation paths (manual `POST /inventory/adjustments` and Part 1's count-triggered adjustments) now hold pending — actual `StockLedger`/`StockBalance`/GL posting only happens on `approve()`. Four new endpoints (`confirm`/`investigate`/`approve`/`reject`), three new permissions, and a new frontend **Stock Adjustments** page (`/inventory/adjustments`) with list + detail/action views.
- Item #3 (before/after audit values) — Part 3: nullable `beforeQty`/`afterQty` added to `StockLedger`, captured from the live balance at the moment `approve()` actually posts — not copied from the line's `expectedQty`, which can be stale by the time a reviewed adjustment finally posts. Backend-only; no UI surface for this one.
- Item #5 (non-saleable status) — Part 4: no new status field. The existing `BatchStatus` (quarantine/expired/recalled) and `SerialNumberStatus` (held/defective/in_repair/pulled_out) now surface directly on adjustment lines — a Batch/Serial picker with a "Non-saleable" badge on the Create Adjustment form, and the same on the Stock Adjustments detail view so every approver sees it too.

**Worth flagging:**

- Item #4 (serial-level counting) — explicitly deferred/excluded from this run's scope, per developer decision in Phase 2. Counting stays SKU/batch-level only.
- Decision (Phase 3, Part 2 fork): approval reaching **approved** is the point stock/GL actually posts (deferred posting), not an after-the-fact rubber stamp on an already-posted adjustment — matches the doc's own wording ("An Authorized Approver posts or rejects the adjustment. The system updates inventory/GL") and is what actually closes gap #2's stated problem.
- Decision: the chain applies uniformly to both creation paths (manual adjustments and Part 1's count-triggered ones) — a count variance is exactly the kind of thing this chain exists to review, not a carve-out.
- Decision: no existing role cleanly maps to "HO Inventory/Audit" or "Authorized Approver" — mapped **Branch Manager → confirm**, **Inventory role → investigate**, **Accountant → approve/reject**. Business Owner bypasses every step automatically (existing `inventory:*` / full-permission-grant pattern). Worth a dedicated role if the business later wants tighter separation from Accountant's broader financial access.
- Decision: Scenario 07's Repair Transfer write-off (`UdsService.writeOff`) also calls the adjustment creator and expected immediate posting (no approval chain in its own doc) — added `AdjustmentsService.createAndAutoApprove()` so that flow keeps posting instantly, unchanged, rather than silently picking up a multi-step review it never had.
- Found and fixed two real pre-existing bugs surfaced while re-verifying/building on this area (both outside this scenario's own gaps, fixed because they blocked or were directly adjacent to this work): (1) `e2e/utils.ts`'s `ensureItemStock()` helper (used by the Aircool specs) posted stock via the same endpoint Part 2 changed to defer — updated it to drive the new chain itself so those specs keep getting real stock; (2) the frontend's `SerialStatusSchema` only had 5 of the backend's 8 real `SerialNumberStatus` values (missing `held`, `in_repair`, `pulled_out`) — silently broke the existing Serial Numbers list/filter page for those statuses too, not just Part 4's new UI.
- Confirmed pre-existing, unrelated to this scenario (do not attribute to this work if seen failing again): `procurement-closeout.e2e-spec.ts`'s "GL posting — write-off" test hits `POST /inventory/adjustments/write-off`, a route that has never existed (404) — its own bug, Scenario 10 territory. The same file's "Spending quota enforcement"/"PO receipt linkage"/"Purchase Order lifecycle" tests are flaky under repeated same-day runs (a day-based sequential PO-code generator race, same class of bug as the ADJ-/CNT- number generators noted elsewhere in this doc's own fix). `repair-transfer.e2e-spec.ts`'s "auto-paired transfer dispatches and receives with no approval gate" test fails identically on a clean `development` checkout with none of this scenario's changes applied (verified via `git stash`) — pre-existing, not caused by this work.
- Hit the same recurring DB-tooling friction Scenario 16 flagged: every `migrate dev`/`migrate deploy` run against the shared local DB re-drops `items_name_trgm_idx` (Scenario 16's pg_trgm index) as spurious drift, since it's raw-SQL-only and not declared in `schema.prisma` — caught and stripped from each of this run's three migrations before applying, and restored the index each time it slipped through once. Also hit new tables landing owned by `karmslajo` instead of `postgres` (same root cause as Scenario 16's note) — fixed via `ALTER TABLE ... OWNER TO postgres` after each migration with a new table. Still worth a real fix (declare the extension/index properly, and sort out the DB owner) so it stops costing a manual step on every migration that touches this schema.
- Part 4's non-saleable-batch path has no batch-tracked item in the seed data to click through manually — verified via backend e2e instead (`inventory-stock-adjustment-approval-chain.e2e-spec.ts`). Worth seeding one if batch-tracked scenarios keep coming up.

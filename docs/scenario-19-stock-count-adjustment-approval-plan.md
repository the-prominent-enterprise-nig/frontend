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

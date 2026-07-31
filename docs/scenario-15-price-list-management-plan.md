# Scenario 15 — Price List Management & Approval — Gap Analysis & Closing Plan

Source: `NIG_ERP_Core_Operational_Scenarios_Draft_2_20260727.pdf`, row "1. Encoding and activating multiple price lists." New scenario, mapped from this row — no equivalent existed in the original `module-scenarios.md` source, and it doesn't fit any of Scenarios 01-14.

## Related ClickUp Tickets

None found. Net-new scope — no existing ticket covers price-list versioning, branch scoping, or approval.

## The scenario we're building toward

An approved new price or price change is issued:

1. Sales Admin creates a dated price-list version (SKU, price-list type, allowed branches, effective dates, DP/term/installment, floor price).
2. The system checks SKU/branch validity, date overlaps, and calculations.
3. A Sales/Finance Approver approves or rejects it.
4. On the effective date, the system activates the new version and expires the prior one.

**Result**: branches see only valid prices and terms; overrides require approval; version history is retained.

## What's already done ✅

1. **A real `PriceList` / `PriceListItem` module exists (INV-32), not a stub.** `PriceList` (`backend/prisma/schema.prisma:4149-4189`): name, `listType` enum, `currency`, `effectiveFrom`/`effectiveTo`, `priority`, `segmentIds[]`, `customerIds[]`, `status` enum (`active`/`inactive`/`expired`). `PriceListItem`: per-item/variant price + `minQty` tier. Full CRUD + `resolvePrice(customerId, itemId, date)` in `backend/src/inventory/services/price-lists.service.ts` / `.controller.ts`, picking the highest-priority active list overlapping the given date.
2. **Frontend UI exists** — `frontend/src/app/(app)/(dashboard)/inventory/price-lists/` (list view, create/edit modal, hooks, server actions).
3. **The flat baseline still works underneath it** — `Item.sellingPrice`/`costPrice`, `PosConfig.defaultPricingMode` (VAT-inclusive/exclusive toggle) — for items with no active price list.

## What's not done / gaps ❌⚠️

1. **No branch scoping.** No `allowedBranches`/`branchId` field on `PriceList` at all — a list applies company-wide today, not to "allowed branches" as the scenario requires.
2. **No approval workflow.** `status` is only `active`/`inactive`/`expired`; `create()`/`update()` write and can activate immediately — no pending/approve/reject step, no approver field. (Contrast: `PurchaseRequestApproval` elsewhere in the app already has a working tiered-approval pattern to mirror.)
3. **No floor price.** No floor-price field anywhere in the pricing models.
4. **No DP/term/installment linkage.** That lives in a separate, unrelated model (`FinancingTerm`: `termMonths`, `factorRate`, nullable `branchId`) with no relation to `PriceList`.
5. **No true versioning.** `update()` mutates the row in place; nothing snapshots history or auto-expires a prior version when a new one activates for the same SKU/branch. `PriceListStatus.expired` exists but nothing ever sets it — no date-triggered transition job found.
6. **No overlap/SKU/branch validation.** `create`/`upsertItems` rely on FK existence only; no explicit SKU-branch date-overlap rejection.

## Closing the gaps

Ordered by risk/value.

### 1. Branch scoping

**Problem**: a price list can't be restricted to specific branches at all.
**Fix**: decide with the business whether a list can span multiple branches or is always single-branch, then add branch scoping to `PriceList`. Note the dead-code flag below before building this from scratch.

### 2. Approval workflow

**Problem**: a price change goes live the moment it's saved — no Sales/Finance Approver gate.
**Fix**: mirror `PurchaseRequestApproval`'s pattern — draft → pending_approval → active/rejected, approver field, a "Sales/Finance Approver" permission.

### 3. Floor price + version history

**Problem**: no minimum-price guard, and no retained history when a list changes.
**Fix**: add a `floorPrice` field with activation-time validation; snapshot the prior version (or add an append-only version table) instead of mutating in place, and auto-expire the prior version when a new one activates.

### 4. Date-overlap validation

**Problem**: two price-list versions could silently overlap for the same SKU+branch with no rejection.
**Fix**: add explicit overlap validation in `create`/`upsertItems` before allowing activation.

### 5. DP/term/installment linkage — confirm scope first

**Problem**: the scenario mentions DP/term/installment as price-list inputs, but that's currently a separate model (`FinancingTerm`).
**Fix**: this is a product decision, not a pure engineering one — confirm with the business whether these are actually meant to be coupled to a price list before merging or cross-referencing the two models.

## Dead code / unused-feature flags

- **`BranchPricing`** (`schema.prisma` ~line 2343 — branch+item price, optional `effectiveFrom`/`To`) appears unused by any service/controller — likely a prior, abandoned attempt at exactly this feature's branch-scoping half. Flag for a developer decision: resurrect its pattern for Closing Gap 1, or delete it outright rather than building parallel branch-pricing logic from scratch.

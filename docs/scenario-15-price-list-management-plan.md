# Scenario 15 — Price List Management & Approval — Gap Analysis & Closing Plan

Source: `NIG_ERP_Core_Operational_Scenarios_Draft_2_20260727.pdf`, row "1. Encoding and activating multiple price lists." New scenario, mapped from this row — no equivalent existed in the original `module-scenarios.md` source, and it doesn't fit any of Scenarios 01-14.

Reopened 2026-08-09: the developer supplied NIG's actual appliance price list (`APPLIANCE PRICELIST AUG_07_26.xlsx`) — real per-SKU, per-price-use-type pricing that directly resolves this doc's own Closing Gap 5 ("DP/term/installment linkage — confirm scope first") and surfaces new gaps. See Closing Gaps 6-8 below.

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
4. **No DP/term/installment linkage — RESOLVED as a real gap, 2026-08-09.** That lives in a separate, unrelated model (`FinancingTerm`: `termMonths`, `factorRate`, nullable `branchId`) with no relation to `PriceList`. NIG's real price list confirms these are meant to be coupled: every SKU has its own Down Payment (one value) and its own Monthly Installment per offered term (3/6/9/12 months, not every SKU offers all four) — not a single blanket `factorRate` applied uniformly. `PriceListItem` today only has `price`/`floorPrice`/`minQty` (`schema.prisma:4959-4979`) — no field for any of this.
5. **No true versioning.** `update()` mutates the row in place; nothing snapshots history or auto-expires a prior version when a new one activates for the same SKU/branch. `PriceListStatus.expired` exists but nothing ever sets it — no date-triggered transition job found.
6. **No overlap/SKU/branch validation.** `create`/`upsertItems` rely on FK existence only; no explicit SKU-branch date-overlap rejection.
7. **Three price-use-types NIG actually uses aren't seeded at all — found 2026-08-09.** The seed has WIP/CR-BR/SSC/PROMO/ZI (`seed.ts:4989-5022`); the real price list also has **TONIK**, **SKYRO** (both real Philippine BNPL/lending fintechs), and **CREDIT CARD**. All three carry only a flat price, no DP/term breakdown — financing for Tonik/Skyro happens entirely in the lender's own app, outside this system.
8. **The coded PPD rounding doesn't always match the real rate card — found 2026-08-09.** `ppd = round2(monthlyInstallment * 0.075)` (`installment-account.service.ts:254`) is close but not exact against real numbers — e.g. MI ₱1,655 computes to PPD ₱124, but the real price list shows ₱120 for that exact row. NIG's actual rounding convention differs slightly from the coded formula.

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

### 5. DP/term/installment linkage — RESOLVED, real fix below

**Problem**: the scenario mentions DP/term/installment as price-list inputs, but that's currently a separate model (`FinancingTerm`).
**Fix** (resolved 2026-08-09 — real data confirms these are coupled, this is no longer a scope question): add `downPayment: Decimal?` directly on `PriceListItem` (one value per SKU+price-use-type, not per term). Add a new child table, `PriceListItemTerm` (`priceListItemId`, `termMonths`, `monthlyInstallment`, `ppd`) — sparse, one row per term actually offered for that SKU+price-use-type, same child-row shape `ServiceDraftLine` already uses elsewhere in this schema. Store the exact `ppd` from the real rate card rather than trusting the live 7.5% formula to reproduce it (see gap 8 — they don't always agree); the formula becomes a fallback for SKUs without curated data yet, not the source of truth once real data exists. At checkout, look up the SKU + selected price-use-type's `PriceListItemTerm` for the chosen term first, and only fall back to the generic `FinancingTerm.factorRate` calculation when no curated row exists.

### 6. Seed the missing price-use-types

**Problem**: TONIK, SKYRO, and CREDIT CARD don't exist as `PriceUseType` rows at all.
**Fix**: seed three more rows the same way WIP/CR-BR/etc. already are. Each gets a `PriceListItem.price` per SKU with zero `PriceListItemTerm` rows (no installment breakdown needed — financing is entirely external). Explicit scope boundary: no integration with Tonik's or Skyro's own systems, just a reference price to sell at.

### 7. Import the real price data

**Problem**: the seed currently fakes per-price-use-type pricing with a synthetic `sellingPrice * 0.85` formula (`seed.ts:5061`), not real numbers.
**Fix**: a loader/import task mapping NIG's real price list into `PriceList` + `PriceListItem` + `PriceListItemTerm`, replacing the synthetic formula. Mechanical once gaps 5-6's schema lands — no design work left, just data loading.

## Open questions requiring developer/business confirmation

1. **What do the price list's "CM" and "CREDIT" columns mean?** Pattern observed: "CM" ≈ 10% of price for WIP rows, ≈2% for CR-BR, a small flat amount for Zero Interest, 0 for SSC, blank for Credit Card/Tonik/Skyro — looks like it could be a sales commission that varies by price-use-type (which would conflict with today's flat `AgentCommission.commissionRate * subtotal`, unaware of price-use-type). "CREDIT" mirrors `price` for most rows but is exactly half of `price` for SSC rows specifically. Neither the "commission" theory nor an alternative "Credit Memo" reading cleanly fits — `CreditMemo` as coded is customer/AR-side, tied to one invoice + reason, not a static price-list percentage. Blocking: don't build anything against these two columns until their real meaning is confirmed.
2. **Does `PROMO` need separate handling?** It's seeded as a `PriceUseType` but doesn't appear anywhere in the real price list — likely tracked/updated more dynamically elsewhere rather than a contradiction, but worth confirming rather than assuming.
3. **Do Tonik/Skyro need anything beyond a reference price** — e.g. eventually syncing application/approval status back from the lender — or does this stay purely "the price shown when a customer is financing through them," with the rest handled entirely outside this system?

## Dead code / unused-feature flags

- **`BranchPricing`** (`schema.prisma` ~line 2343 — branch+item price, optional `effectiveFrom`/`To`) appears unused by any service/controller — likely a prior, abandoned attempt at exactly this feature's branch-scoping half. Flag for a developer decision: resurrect its pattern for Closing Gap 1, or delete it outright rather than building parallel branch-pricing logic from scratch.

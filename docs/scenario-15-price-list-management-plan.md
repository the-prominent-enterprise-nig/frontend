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
  - **Corrected 2026-08-10, re-verified via direct code search: this claim is stale.** `branch-pricing.controller.ts`/`.service.ts` are real, registered in `pos.module.ts`, consumed by `catalog.service.ts`, seeded, and covered by `test/pos-branch-scoping-sweep.e2e-spec.ts` — plus a full frontend page at `pos/branch-pricing`. It's a live, separate POS-side per-branch price-override feature that predates this scenario's `PriceList` module, not dead code. Do not delete it or resurrect its pattern for anything here.

## Implementation Log — 2026-08-10

**For this scenario, I have done:**

- **Re-verification found the doc's own "What's not done" section stale for Closing Gaps 1-4** (branch scoping, approval workflow, floor price + versioning, date-overlap validation) — all four were already fully implemented and merged well before this run (backend `044ab1b`, frontend `7a58bf9`, both 2026-08-04, confirmed via `git merge-base --is-ancestor` against `development`). This matches what `scenario-checklist.md` already said; only this plan doc's own gap list hadn't been corrected. No work needed on gaps 1-4 this run — see the checklist for the fuller backend/frontend evidence trail.
- **Open Questions 1-3 — all resolved with the developer this run:**
  1. **CM/CREDIT columns** — confirmed sales commission, varying by price-use-type. Developer chose "capture only, defer wiring": both are now real fields on `PriceListItem` (`cmAmount`, `creditAmount`), settable via the API, but `AgentCommission`'s flat `commissionRate × subtotal` calculation is untouched — wiring them in is an explicit, separate follow-up, not done here.
  2. **PROMO** — confirmed no special handling needed; left exactly as-is.
  3. **Tonik/Skyro** — confirmed reference-price-only, no lender integration; matches what was already built.
- **Closing Gap 6 (seed the missing price-use-types)** — `TONIK`, `SKYRO`, `CREDIT CARD` added to `prisma/seed.ts` alongside the existing 5, each with only a flat reference price (no DP/term breakdown), matching the confirmed scope.
- **Closing Gap 5 (DP/term/installment linkage)** — implemented as a real schema + full wiring, not just the fields:
  - Schema: `PriceListItem.downPayment`/`cmAmount`/`creditAmount`, new `PriceListItemTerm` (`termMonths`, `monthlyInstallment`, `ppd`) child table.
  - A curated `PriceListItemTerm` now wins over the generic `FinancingTerm.factorRate` calculation, in both the live checkout preview (`POST /pos/financing-terms/preview`) and actual posting (`TransactionsService.createAndPostInstallmentPlan`) — the two share one calculation path so they can never disagree, mirroring this codebase's existing design principle for the formula path. **Developer-unconfirmed judgment call, flagging explicitly**: for a multi-item cart sharing one financing term (Scenario 23 Gap 5's grouping), curated MI/PPD are summed only when _every_ line in the group has curated data; if any line lacks it, the whole group falls back to the formula rather than mixing curated and computed figures in one schedule.
  - The resulting curated PPD also overrides `InstallmentAccountService`'s 7.5%-of-MI formula (`ppdOverride` on `CreateInstallmentAccountDto`) — this closes the loop the doc's own gap 8 example (MI ₱1,655 → formula gives ₱124, real card says ₱120) was about.
  - Admin UI: a "Down Payment" field added to the Price List item form/table (`PriceListItemsModal.tsx`), so a curated value can actually be entered — checkout now auto-fills it on financing-term selection, ahead of the generic 10%-floor fallback (Scenario 01 Gap 4). `cmAmount`/`creditAmount` are reachable via the API only — no manual-entry UI yet, since their consuming behavior is still deferred.
- **New closing gap found during re-verification, confirmed in scope by the developer and closed this run**: the backend's version-history mechanism (`PriceList.supersedesId`, auto-expiring the prior version on approval) was live and tested but had no UI to actually set it. Added a "Supersedes" picker to the New/Edit Price List form, filtered to same-Price-Use-Type candidates only.
- **Closing Gap 7 (import the real NIG price data) — done, in a follow-up pass after the developer provided the actual source file.** `APPLIANCE PRICELIST AUG_07_26.xlsx` (686 unique products × up to 7 price-use-types, 4,193 rows) was read directly from disk (not retyped, to avoid any transcription risk on real pricing data) and committed to the repo at `prisma/data/appliance-pricelist-2026-08-07.csv`, with a new `prisma/price-list-import.util.ts` parser (using the already-installed `csv-parse` dependency) wired into `seedNigAgingCatalog()` in `prisma/seed.ts`.
  - **Blocking finding, resolved with the developer**: only 42 of the 686 products in the source file have a matching `Item` in this environment's catalog (matched by normalizing hyphens/spaces out of `modelNumber`) — the other 644 have no `Item` row to attach a price to. Confirmed scope: import prices for the 42 matches only; the rest are skipped and logged (count only, not the full list, to keep seed output readable). Catalog-building for the other 644 is explicitly out of scope for this pass.
  - Real curated data (price, down payment, `cmAmount`/`creditAmount`, and per-term MI/PPD where the source has it) now lives in `WIP`/`CR-BR` (extending the existing active lists — the 35 non-matched NIG items keep their prior flat-`sellingPrice` entry, never left without a WIP price) plus 5 newly-created active lists (`SSC`, `ZI`, `Credit Card`, `Tonik`, `Skyro`) that didn't exist before this pass.
  - **Two data-quality issues found and resolved in the parser, not the source file**: (1) the source labels this use-type "ZERO INTEREST"; the seeded `PriceUseType` is named `ZI` — aliased explicitly in the parser, not a fuzzy match. (2) `SINGER SINGER323D` appears twice under every price-use-type with different numbers (a duplicate row in the source spreadsheet) — confirmed with the developer to use the later occurrence; the parser's natural "later row overwrites earlier" behavior when building the lookup map handles this without special-casing.
  - **Sign convention resolved via the doc's own worked example**: the source shows PPD as a negative deduction (e.g. `-120`); the app's own formula fallback (`monthlyInstallment × 0.075`) is a positive magnitude. The doc's Gap 8 example (`MI ₱1,655 → formula ₱124, real card ₱120`) is literally `abs(-120)` from the source — confirms `Math.abs()` on import, verified against that exact row after reseeding (WIP, 2TC32GF2000X, 9 months: MI 1,655 / PPD 120, byte-for-byte match).
  - Verified via a full destructive `npx prisma db seed` (developer-authorized) and direct `psql` inspection: counts match exactly (WIP 83 = 5 demo + 1 furniture-kit + 35 flat NIG + 42 curated; CR-BR 47 = 5 demo + 42 curated; SSC/Credit Card/Tonik/Skyro 42 each; ZI 23 — only the subset of the 42 that actually have a Zero Interest row); a sample item's every field (price, DP, CM, credit, and all 4 terms across WIP/CR-BR/ZI) matches the source CSV exactly. Full backend e2e regression (151 tests across price-list/POS/installment specs) and frontend e2e regression (9 tests across every price-list spec) both green after the reseed; confirmed none of the 42 newly-curated SKUs are referenced by name anywhere in either test suite, so no existing test depended on their old flat prices.

**Worth flagging:**

- A real bug was found and fixed via end-to-end UI testing (not just API-level checks): `PriceListItem.downPayment` comes over the wire as a string (Prisma `Decimal` JSON serialization), not a number — a first attempt at the checkout auto-fill crashed on `.toFixed is not a function`. Fixed with explicit `Number()` coercion at the point of use, matching this codebase's existing convention of treating Decimal-typed API fields as `unknown` and coercing on the consumer side (`price`/`floorPrice`/`minQty` already work this way).
- New backend e2e: `test/price-list-installment-terms.e2e-spec.ts` (5 tests: curated preview, curated posting, all-curated grouping sums, mixed-group all-or-nothing fallback). New frontend e2e: `inventory-price-list-installment-terms.spec.ts` (admin entry → checkout consumption, full round-trip), `inventory-price-list-supersedes.spec.ts` (2 tests: auto-expiry on approval, same-type-only filtering). Full regression run across every existing price-list and installment-checkout e2e spec in both repos — all green except one already-flagged, pre-existing, unrelated failure (`inventory-price-list-branch-scoping.spec.ts` referenced a "Manila HQ" branch checkbox that no longer existed since the seed switched to real NIG branch names — predated this work, not fixed here at the time; fixed separately on 2026-08-14 as part of a repo-wide stale-branch-name cleanup, see `docs/seed-data-reference.md`).
- **Unplanned fix, raised by the developer after Part 3's verification runs**: repeated Playwright test runs against the shared dev DB during this session's verification left ~24 `E2E Price List …` fixture rows visible on `/inventory/price-lists`. Root cause isn't a broken cleanup — `sweepE2EPriceLists` (`e2e/utils.ts`) did deactivate them as designed, but `PriceList` has no hard-delete (only deactivate, to preserve an audit trail for real business price changes), and the page rendered every status with no filter. Manually purged the leftover rows via direct DB delete, and — since the same problem will recur for any real lapsed price list, not just test data — added a durable fix: `/inventory/price-lists` now hides `inactive`/`expired` statuses by default with a "Show inactive/expired" toggle to reveal them (`get-price-lists.ts`, `usePriceLists.ts`, `PriceListsPageView.tsx`). Updated `inventory-price-list-supersedes.spec.ts`'s first test to check the toggle before asserting on an expired row, since that's no longer visible by default. Regression: full frontend price-list suite (9 tests) green after the change.

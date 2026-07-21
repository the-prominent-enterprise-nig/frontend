# Scenario 09 — Aircool (Aircon Sale + Installation) — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "Aircool — aircon sale plus installation."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3pg8v5](https://app.clickup.com/t/86d3pg8v5) — "AA Cashier, ISBAT open a reopenable service draft with estimated materials when selling an aircon install, so the job can be revisited and edited until it's done" — _Sprint 3, in review_ — direct match to step 2 (this doc's Closing Gap 2, the `ServiceDraft`/`JobEstimate` entity) — implemented 2026-07-20, see Implementation Log below
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

## Implementation Log — 2026-07-20

**For this scenario, I have done:**

- **Closing Gap 1 (service item type):** added an `isService` boolean to `Item`, enforced server-side on both create and update that a service item is never batch/serial/expiry-tracked regardless of what the caller passes, and centralized the POS-side exclusion in `PosInventoryService.expandLine()` so service lines are skipped by stock checks, deduction, AND void/refund restock uniformly. Frontend: a "Service Item" checkbox (disables/clears the other tracking checkboxes when checked) on the item create/edit forms, and a "Service" badge in the item list. e2e-tested (`test/aircool.e2e-spec.ts`), including a regression test for a real bug found during review — voiding a same-day sale containing a service line was fabricating phantom stock for it.
- **Closing Gap 2 (`ServiceDraft`/`JobEstimate` entity):** new `ServiceDraft`/`ServiceDraftLine` models with a reopenable-by-default lifecycle (`draft | sourcing | installing | completed | cancelled`), CRUD API (create with nested lines, list, detail, bulk-replace-while-draft update, dedicated cancel), and RBAC (`pos:service-drafts:{create,read,update,cancel}`, granted to Cashier, Branch Manager, and Business Owner). Frontend: a minimal "Service Jobs" module (POS sidebar) — list, create/edit modal with a dynamic materials-line array, read-only detail view, cancel action. e2e-tested (20 tests total across both gaps, in the same file, two mutation-tested for real teeth).

**Worth flagging:**

- Closing Gaps 3-5 (PR/PO shortfall linkage, technician actual-vs-estimate recording, return-unused-materials + finalize/bill) are **not implemented**. `ServiceDraft.status` only ever moves between `draft` and `cancelled` right now — `sourcing`/`installing`/`completed` exist in the schema (matching the doc's original field design) but have no driving business logic or UI action yet, deliberately, since that logic doesn't exist until Gaps 3-5 land. The Service Jobs UI has no "Cancel"-adjacent actions for those states for the same reason.
- Role decision (confirmed with the developer, since the doc's own ClickUp tickets referenced a role — "Warehouse Manager" — that no longer exists in this codebase, having been removed as out-of-scope/redundant during an earlier RBAC cleanup, and "technician" was never a role at all): both Gap 4's job-execution actor and Gap 5's return/finalize actor were resolved to **Stock Controller**, the existing role whose description already covers "receiving, adjustments, counts, batch and serial tracking." This decision will need to be re-applied when Gaps 4-5 are actually built.
- Item-type modeling choice: `isService` is a boolean matching the existing `isBatchTracked`/`isSerialTracked`/`isBundle` sibling-flag convention on `Item`, not the enum alternative the doc's own Fix text also considered — chosen to match established precedent in this codebase.
- No ClickUp ticket exists for Gap 1 (the service item type itself) — the doc already flagged this ("Not found in Sprint 3-5"); still true, worth raising as a new ticket if it should be tracked.
- Both repos are on branch `feat/aircool-install-jobs`; nothing has been committed in either repo — PR text for Gaps 1-2 was generated this same session and is ready to use once the developer commits/pushes.

## Implementation Log — 2026-07-21

**For this scenario, I have done:**

- **Closing Gap 3 (PR/PO shortfall linkage):** `GET /pos/service-drafts/:id/stock-check` previews the per-line shortfall against on-hand branch stock (no commit); `POST /pos/service-drafts/:id/source` commits it — raises a single `PurchaseRequest` for any shortfall lines (new `PurchaseRequest.sourceServiceDraftId` tag, mirroring the existing `triggeredByReorder` pattern), tags each line's `source` (`warehouse`/`purchase_order`), and moves `draft -> sourcing` (every draft passes through `sourcing` regardless of whether a shortfall exists). New `pos:service-drafts:source` permission, Stock Controller + Branch Manager + Business Owner (Cashier explicitly excluded, confirmed with the developer). Frontend: "Check Stock & Source" action on the detail view opens a preview-then-confirm modal; linked PRs shown as chips; line source shown once past draft. e2e-tested both sides (6 backend, 2 frontend).
- **Closing Gap 4 (technician actual-vs-estimate):** `POST /pos/service-drafts/:id/start-install` assigns a `technicianId` (plain id, no Prisma relation — matches `createdByUserId`'s existing convention on this model; display name resolved via a batched manual lookup) and moves `sourcing -> installing`. `PATCH /pos/service-drafts/:id/actuals` partially records `ServiceDraftLine.actualQty` per line (only submitted lines change, so a technician can record incrementally). New `pos:service-drafts:install` permission, same role grant as Gap 3. Frontend: "Start Install" modal with a staff search (reuses the existing `/users/search` action, no role filter — "technicians are just staff" per the doc's own Fix text), and the Actual Qty column becomes an editable input while installing, with a "Save Actuals" action. e2e-tested both sides (7 backend, 2 frontend).
- **Closing Gap 5 (return unused materials + finalize):** `POST /pos/service-drafts/:id/complete` requires every line to have an `actualQty` recorded, then deducts exactly each line's `actualQty` from branch stock (one `StockLedger` entry per line, `transactionType: adjustment`, `referenceType: 'service_draft'`) and moves `installing -> completed`. Frontend: "Complete Job" action (confirm dialog, since it's irreversible) on the detail view. e2e-tested both sides (5 backend, 2 frontend).

**Worth flagging:**

- **Design decisions confirmed with the developer before implementation** (both depart from the doc's original Fix text, for reasons specific to what Gaps 1-3 actually built):
  - **No separate "issue" then "return unused" step.** Gaps 3-4 never move `StockBalance` (sourcing only raises a PR; starting install only assigns a technician) — there is no prior issuance to reverse. Gap 5 instead deducts exactly each line's `actualQty` at completion (a single ledger movement, not issue-then-return). Net stock effect is the same as the doc's original framing; the mechanism is simpler because nothing was ever over-issued to begin with.
  - **No auto-generated `PosTransaction`.** The doc's Fix text described Gap 5 "billing the aircon + service line + actual materials together as one `PosTransaction`" — ruled out. `TransactionsService.create()` is ~600 lines of BIR tax computation (VAT-inclusive/exclusive, SC/PWD discount, vat/vat_exempt/zero_rated bucketing) and GL posting; auto-generating a transaction from Gap 5 would mean touching that tax-law-sensitive code path. Billing the actual materials is a normal, separate POS sale — the aircon + install service are already sold via POS in step 1 of the scenario, before the draft even exists, so nothing needs re-billing there either.
- Both repos moved off `feat/aircool-install-jobs` onto a fresh `feat/aircool-service-draft-lifecycle` branch (created off `development`) for this run's work — the old branch's frontend copy had a large stash of unrelated other-scenario WIP sitting on it. Nothing has been committed on the new branch yet.
- Fixed two pre-existing, unrelated bugs found while getting this scenario's own tooling working (both were fully blocking, not scoped to Aircool):
  - `prisma/seed.ts`'s `cleanDatabase()` never accounted for the `ServiceDraft`/`ServiceDraftLine` tables Gap 2 added, so any reseed FK-violated once real data existed in them.
  - `frontend/e2e/auth.setup.ts` filled the login form once and only retried the submit click, unlike the already-correct pattern in `loginAs()` in the same file — a hydration race could leave every retry submitting an empty form, intermittently failing the _entire_ e2e suite regardless of what's being tested.
- **Known pre-existing, unrelated issue — not fixed:** `frontend/e2e/inventory-stock-adjustment.spec.ts` hardcodes a stale dev-bypass password (`dev-prominent-enterprise-2025`, one year off the real current value in `backend/.env`), so both its tests fail on login. Out of scope for this scenario; flagging for a separate fix.
- No ClickUp ticket exists for Gap 4's own actor role or the technician concept generally — the doc already flagged this ("Not found in Sprint 3-5"); still true.

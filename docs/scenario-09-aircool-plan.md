# Scenario 09 — Aircool (Aircon Sale + Installation) — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "Aircool — aircon sale plus installation."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3pg8v5](https://app.clickup.com/t/86d3pg8v5) — "AA Cashier, ISBAT open a reopenable service draft with estimated materials when selling an aircon install, so the job can be revisited and edited until it's done" — _Sprint 3, in review_ — direct match to step 2 (this doc's Closing Gap 2, the `ServiceDraft`/`JobEstimate` entity) — implemented 2026-07-20, see Implementation Log below
- [86d3pg8vr](https://app.clickup.com/t/86d3pg8vr) — "AA Stock Controller, ISBAT raise a Purchase Request for materials missing from an aircon install job, so only what that job needs is ordered and tracked back to it" — _Sprint 3, in review_ — direct match to step 3 (Closing Gap 3) — implemented 2026-07-21, see Implementation Log below
- [86d3pg8wx](https://app.clickup.com/t/86d3pg8wx) — "AA Warehouse Manager, ISBAT return unused install materials to inventory when an aircon job closes, so leftover stock doesn't disappear off the books" — _Sprint 3, for qa_ (moved further along outside this doc's own tracking since the last update; left as-is, never downgraded) — direct match to step 5 (Closing Gap 5) — implemented 2026-07-21 (actor resolved to Stock Controller), true issue-then-return + materials invoice landed 2026-07-28, see Implementation Log below
- [86d3p2w2z](https://app.clickup.com/t/86d3p2w2z) — "AA Cashier, ISBAT have POS automatically capture the correct serial/SKU set for a multi-part or bundled item at sale" — _Sprint 3, for qa_ — relates to step 1's dual-serial capture, already confirmed working in this doc's "What's already done"

**Not found in Sprint 3-5:** No ticket for step 1's "installation service" as its own sellable item type, and none for step 4 (technician records actual vs. estimated materials — the work-order/job-execution layer this doc's Closing Gap 4 calls "the biggest net-new piece"). Worth raising as new tickets given they're the two steps with no code either.

**Also not found:** no ticket for Closing Gap 6 below (service type at job creation) — developer-defined, 2026-08-08, from a direct meeting comment plus NIG's own "Services Offered" rate card (provided directly, not from a ClickUp ticket or either client PDF).

## The scenario we're building toward

A customer buys a split-type aircon and needs it installed:

1. Sell aircon + installation service in one POS sale (aircon captures indoor+outdoor serials).
2. Open a reopenable service draft estimating install materials.
3. Source materials from warehouse; if short, raise PR→PO to an area supplier (estimates carried on PO).
4. Technician installs, records actual vs. estimate.
5. Unused materials return to inventory; finalize/bill aircon + service + materials together; close the draft.
6. At job creation, the job is tagged with one or more **types of service** from NIG's actual service catalog (General Cleaning, Replacement of Minor/Major Electrical Part(s), Repair Leakage/Recharging, Compressor Replacement + Recharging, Relocation — each with specific sub-items), each carrying its own quoted labor amount — not a single free-text title.

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
6. **No "type of service" concept at job creation — MISSING entirely, added to scope 2026-08-08.** `ServiceDraft` has `title` (free text), `status`, `notes`, `technicianName` — nothing structured categorizing what kind of job this is. The create form (`ServiceJobFormModal.tsx:264-315`) only collects Branch/Title/Customer/Notes before the Estimated Materials array; there's no service-type picker anywhere. Confirmed with the developer: pricing is a manual quote per job, not a fixed price per service type, and a job can carry more than one service type at once (e.g. General Cleaning + Replacement of Capacitor in the same visit) — so this can't be a single field, it needs to be a repeatable list, structurally similar to how `ServiceDraftLine` already works for materials.

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

### 6. Add "type of service" at job creation, from NIG's real service catalog

**Problem**: no structured way to say what kind of job this is; `title` is free text only.

**NIG's actual service catalog** (developer-provided 2026-08-08, "Services Offered"), 6 categories with fixed sub-items each:

| Category                                                                    | Sub-items                                                                                                                                                                   |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| General Cleaning                                                            | Window Type; Split Type — Wall/Floor/Ceiling Mounted; Split Type — Ceiling Cassette; FCU; Check-up (Window & Split Type)                                                    |
| Replacement of Minor Electrical Part                                        | Capacitor; Switches; Magnetic Contactor; Temperature Sensor; Bearing; Thermostat; Relays; Thermistor; Overload Protector                                                    |
| Replacement of Major Electrical Parts                                       | Fan Motor; Fan Blower; Fan Blade; Blower Wheel; Motor Compressor; Printed Circuit Board; Expansion Valve; Evaporator Coil; Condenser Fan; Air Filter; Condensate Drain Pump |
| Repair Leakage, Recharging & Reprocessing the System                        | Window Type; Split Type                                                                                                                                                     |
| Replacement of Motor Compressor, Reprocessing and Recharging of Refrigerant | Window Type; Split Type                                                                                                                                                     |
| Relocation of Split Type Aircon                                             | Pull Out Existing Unit; Excess Piping After 10ft; Lay Out of Electrical Supply; Chipping Works                                                                              |

**Fix**: add a repeatable `ServiceDraftServiceType` child model (sibling to `ServiceDraftLine`, same `serviceDraftId` FK shape) — `category`, `subType` (both matching the fixed list above, likely a seeded lookup table or enum pair rather than free text, so the list stays authoritative), and `quotedAmount` (manually entered per entry, not looked up — confirmed no fixed price list exists per category/sub-item). Surface as a new repeatable section on `ServiceJobFormModal.tsx`, above or alongside Estimated Materials.

**Materials auto-suggestion** (confirmed in scope): when the sub-type picked belongs to "Replacement of Minor Electrical Part" or "Replacement of Major Electrical Parts" — i.e. it's literally named after a physical part (Capacitor, Fan Motor, Motor Compressor, etc.) — pre-fill a matching Estimated Materials line for that same-named item (cashier can still adjust or remove it). The other four categories (General Cleaning, Repair Leakage/Recharging, Compressor Replacement, Relocation) don't map to a specific part, so no auto-suggestion fires for those — just the quoted labor line.

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

## Implementation Log — 2026-07-28

**For this scenario, I have done:**

- **Reopened and closed the two "by design, not overlooked" items from the 2026-07-21 log**, per a specific client ask (confirmed with the developer): a true issue-then-return materials flow, and an auto-generated bill for materials used.
  - **Issue-then-return.** `startInstall()` now issues every line's `estimatedQty` out of branch stock the moment install begins (an `adjustment` ledger entry per line) — this **supersedes** the 2026-07-21 note "No separate issue then return unused step," which is no longer accurate. `complete()` now reconciles actual usage against what was issued: `actual < estimated` returns the unused remainder (`return` ledger entry), `actual > estimated` deducts the extra consumed beyond the original issue (`adjustment` entry). `cancel()` while a job is `installing` now returns everything that was issued, since none of it was ever billed — this case didn't exist before (materials couldn't be issued pre-completion, so there was nothing to return on cancel).
  - **Materials invoice.** New `ServiceDraftInvoice`/`ServiceDraftInvoiceLine` models — auto-generated inside `complete()` whenever at least one line has actual usage above zero, numbered `SDI-YYYYMMDD-NNNN` (mirrors `PurchaseRequestService`'s own numbering pattern), one row per billable line at the item's current selling price, linked back to the draft via a unique `serviceDraftId`. Skipped entirely if every line's actual comes out to zero (nothing to bill). Shown in the Service Job detail view as a new "Materials Invoice" section.
  - **Still holds from 2026-07-21, unchanged by this run:** no auto-generated `PosTransaction`. The new invoice is deliberately a separate, lightweight record — not a fiscal/BIR-compliant document — so `TransactionsService.create()`'s ~600 lines of tax/GL logic are still never touched from this flow. Billing the customer for the materials invoice is still a manual, separate POS sale; the invoice is a reference document for that sale, not the sale itself. This was a developer-confirmed tradeoff (two documents instead of one) specifically to avoid touching tax-compliance-sensitive code.
- e2e-tested both sides: backend 46/46 (`test/aircool.e2e-spec.ts` — 5 new tests for issue/insufficient-stock/cancel-returns under Install, 3 new tests for invoice generation/skip/sequencing under Complete), frontend 8/8 across `pos-service-draft-{sourcing,install,complete}.spec.ts` (1 new invoice test, 1 new "no invoice when unused" assertion).

**Worth flagging:**

- **A real bug was found and fixed during this run**, not present in any prior log: the new Materials Invoice UI initially called `.toFixed()` directly on `unitPrice`/`lineTotal`/`totalAmount`, which crashed the page — Decimal fields serialize as strings over the API, not numbers, so these now go through `Number(...)` first before formatting. Worth a broader look at whether other numeric-display code in this module (`estimatedQty`, `actualQty`, etc.) has the same latent issue — those happen not to crash today only because they're interpolated directly into JSX rather than having a number-only method called on them, not because they're actually typed correctly at runtime. Out of scope for this run.
- Two more pre-existing, unrelated environment blockers were found and fixed while getting this run's own tooling working (neither scoped to Aircool, both fully blocking any e2e test from running at all): the locally generated Prisma client was stale relative to `prisma/schema.prisma` (fixed via `npx prisma generate`), and the local dev database was missing 8 already-merged migrations for the Collections/CRM module (fixed via `npx prisma migrate deploy`, purely additive, no data loss).
- **Still not fixed, still out of scope:** `frontend/e2e/inventory-stock-adjustment.spec.ts`'s stale `dev-prominent-enterprise-2025` hardcoded password, flagged again in the 2026-07-21 log. Continues to be unrelated to Aircool.
- The frontend's generated OpenAPI types (`src/libs/generated/types/generated.ts`) were found to be significantly stale relative to `development`'s actual backend (a ~51k-line diff on `pnpm generate:types`) — not touched, since this feature's frontend code reads `ServiceDraft` through a hand-maintained Zod schema (`src/schema/pos/service-drafts.ts`), not the generated types. Worth a dedicated regeneration pass at some point, just not bundled into this scenario's diff.
- Two new Prisma migrations added: `20260728032600_add_service_draft_invoice`, `20260728032837_service_draft_invoice_cascade_delete`. Both purely additive (new tables/constraint only).
- Both repos are on a new branch `feat/aircool-issue-return-billing` (created off `development`) for this run's work. Nothing has been committed in either repo yet.

## Implementation Log — 2026-08-05

**For this scenario, I have done:**

- **Serial-number capture on Estimated Materials lines** (client ask, not a numbered Closing Gap in this doc's original scope): a serial-tracked material (e.g. a Fan Motor with individually tracked units) previously had **no way to record which physical unit** was estimated for a job — `ServiceDraftLine` had no serial field at all, and `startInstall()`/`complete()`/`cancel()` unconditionally ran the plain-quantity `StockBalance` deduction path for every line. Since serial-tracked items never carry a `StockBalance` row (`CatalogService.findAll()`'s own comment confirms this), a serial-tracked item added to a service draft today would silently fail `startInstall()` with a false "insufficient stock" error — a real, previously-undiscovered gap this closes rather than just a UI addition.
  - **Design decisions confirmed with the developer before implementation:**
    - Serial is picked **at estimate time** (the "Estimated Materials" create/edit form), not deferred to `startInstall()`. `estimatedQty` is force-locked to exactly 1 whenever the picked material is serial-tracked — a serial identifies one physical unit, never a batch.
    - Nothing is held/claimed at estimate time — the pick is just a reference (validated to be a real, currently `in_stock` unit of that item at the job's branch) until `startInstall()`, which is where the CAS-guarded claim (`in_stock -> held`) actually happens. This mirrors how plain-quantity issuance is already deferred to `startInstall()`, so a draft can be freely re-edited without needing to release/re-claim anything.
  - **Schema**: `ServiceDraftLine.serialNumberId` (nullable FK to `SerialNumber`), migration `20260805090000_add_service_draft_line_serial_number` (purely additive — new nullable column, index, FK). `SerialNumber` gained the reciprocal `serviceDraftLines` relation, matching its existing `stockTransferLines`/`stockAdjustmentLines`/`stockCountLines` sibling-relation convention.
  - **Backend** (`service-drafts.service.ts`): new `validateLineSerials()` (shared by `create()`/`update()`) enforces — serial required iff the item is serial-tracked; `estimatedQty` must be 1 for a serial-tracked line; the serial must exist, belong to that exact item, be `in_stock`, and be available at the draft's branch; no serial reused across two lines in the same request. `startInstall()` now branches per line: a serial-tracked line does a CAS `serialNumber.updateMany` claim (`in_stock -> held`, 0-count throws — same optimistic-concurrency pattern `release-form-requests.service.ts` already uses for its own serial holds) instead of the quantity-based `applyStockDelta`, plus an audit `StockLedger` entry. `complete()` resolves a held serial to `sold` (`actualQty` 1 — sets `soldToCustomerId`/`saleDate` the same way `TransactionsService`'s own sold-transition does) or back to `in_stock` (`actualQty` 0, unused). `cancel()` while `installing` returns a held serial to `in_stock`. `recordActuals()`/`complete()` both reject an `actualQty` other than 0 or 1 on a serial-tracked line.
  - **Frontend**: `SearchCombobox` gained an optional `meta`/`onSelect` passthrough (backward-compatible, every other caller unaffected) so `MaterialItemSearchCombobox` can report the picked item's `isSerialTracked` flag back to the form — the generic `onChange(id)` alone doesn't carry that. New `SerialNumberSearchCombobox` (branch-scoped `in_stock` lookup, reusing the same `getAvailableSerialNumbers` action POS checkout's own serial picker calls). `ServiceJobFormModal`: a serial-tracked line now shows a required Serial Number field and a locked "1" Estimated Qty; submitting without a serial for a serial-tracked line is blocked client-side with an inline error (the backend re-validates regardless). `ServiceJobDetailModal`: shows `SN: <serial>` under the material on the Estimated Materials table when present.
  - **Deliberately out of scope**: `ServiceDraftInvoiceLine` was not extended with a serial reference — the invoice still just records item/qty/price, not which physical unit was billed. Cross-branch "available elsewhere" visibility (POS checkout's picker has this) was also left out — this picker only shows serials already at the job's own branch. Both would be straightforward follow-ups if wanted.
- e2e-tested both sides: backend 10/10 new tests in a new `ServiceDraft — Serial Number Tracking E2E` block in `test/aircool.e2e-spec.ts` (create-time validation: missing serial, wrong qty, serial on a non-serial item, unavailable serial, duplicate serial across lines; full lifecycle: install-hold → complete-sold-with-invoice, install-hold → complete-unused-returned, invalid actuals rejected, cancel-while-installing returns the serial). Frontend: 1 new Playwright spec (`pos-service-draft-serial-number.spec.ts`) covering the create-form happy path (serial required, picked, submitted, shown on the detail view) against the seeded dual-serial "Split-Type Aircon" item (used purely as a convenient already-registered serial-tracked fixture — this flow never touches its own secondary/dual-serial checkout behavior).

**Worth flagging:**

- **This branch (`fix/scenario-19-followups`) already had substantial, unrelated uncommitted work in progress when this session started** — a POS per-line installment-financing feature touching `installment-account.*`, `pos.dto.ts`, `pos.module.ts`, `release-form-requests.service.ts`, `transactions.service.ts`, `checkout/page.tsx`, `ChartOfAccountsList.tsx`, `AccountMappingPanel.tsx`, and others, plus its own pending migration. Confirmed with the developer to leave it untouched and build alongside it. Two pre-existing test breakages traced back to it, not to this run's changes (verified both ways with `git stash`):
  - `test/aircool.e2e-spec.ts`'s existing POS mixed-sale test 400s (cascading into a second test) — root cause is in that other WIP's `transactions.service.ts` changes, not `service-drafts.service.ts`.
  - Six pre-existing frontend specs (`pos-service-draft-{sourcing,install,complete}.spec.ts`) now fail on a Playwright strict-mode violation — the seeded catalog has grown a **second** "Split-Type Aircon" variant since those specs were written, so their `getByText('Split-Type Aircon', { exact: false })` now matches two buttons instead of one. This is seed-data drift, unrelated to serial-number tracking; this run's own new spec matches on the exact fetched item name instead to avoid the same ambiguity, but the three older specs were left as-is (out of scope for this run).
- Shadow-database migration replay (`prisma migrate dev`) currently fails on this branch for an unrelated pre-existing reason (`20260803031913_link_reminder_interaction_to_collections` references an index name from a later-renumbered migration — this branch's migration timestamps were already reshuffled by other work before this session started). Worked around by hand-writing the new migration file in the established style and applying it with `prisma migrate deploy` (which doesn't use the shadow DB) instead — the migration itself is fine, this is purely a local shadow-DB tooling issue on this branch.
- Not a Closing Gap in this doc's original numbered list — filed here since it's a direct extension of Gap 2's `ServiceDraftLine` model and Gap 4/5's issue/return lifecycle, not a new scenario.

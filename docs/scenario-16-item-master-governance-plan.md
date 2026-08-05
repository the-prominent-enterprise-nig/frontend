# Scenario 16 — Item Master Governance — Gap Analysis & Closing Plan

Source: `NIG_ERP_Core_Operational_Scenarios_Draft_2_20260727.pdf`, row "2. Creating or updating an item master record." New scenario, mapped from this row — no equivalent existed in the original `module-scenarios.md` source, and it doesn't fit any of Scenarios 01-14.

## Related ClickUp Tickets

None found. Net-new scope — no existing ticket covers an item-creation approval workflow or a Master Data Approver role.

## The scenario we're building toward

A new SKU/model is introduced or an approved item detail changes:

1. HO Inventory searches existing items and encodes a draft (SKU/model, brand/category/UOM, serialized flag, tax/GL mapping, reorder point, warranty).
2. The system flags duplicate SKU/model and missing fields.
3. Accounting confirms tax and account mapping.
4. A Master Data Approver approves.
5. The system publishes one record to PO, receiving, inventory, POS and reports.

**Result**: one permanent item record is used everywhere; serialization and reorder rules remain consistent.

## What's already done ✅

1. **`Item` already has the target fields.** `sku` (unique per `tenantId`, `@@unique([tenantId, sku])`), classification (`groupId`/`subgroupId`/`brandId`/`typeId`), `baseUnitId` (UOM), `isSerialTracked`/`requiresSecondarySerial`, tax/GL mapping (`taxRateId`, `revenueAccountId`, `cogsAccountId`, `inventoryAccountId`), `warrantyPeriodDays` — `backend/prisma/schema.prisma` ~line 2766.
2. **Reorder point exists**, just on a separate model — `ReorderRule` (`schema.prisma:3254`: `reorderPoint`/`reorderQuantity`/`safetyStock`), linked via `Item.reorderRules`.
3. **Hard dedupe already exists at the DB level.** The `@@unique([tenantId, sku])` constraint's P2002 is caught and surfaced as a clean `ConflictException('sku_already_exists')` (`items.service.ts:54-59`), not a raw DB error.
4. **"One record used everywhere" already holds structurally** — PO, receiving, inventory, POS and reports all read the same `Item` table, so publishing is inherently a single source of truth today; there's no separate per-module copy to keep in sync.

## What's not done / gaps ❌⚠️

1. **No draft/review state machine.** `ItemsService.create()` (`src/inventory/services/items.service.ts:75`) is a single direct `prisma.item.create(...)` — live immediately. `ItemLifecycle` (`active`/`discontinued`/`archived`, `schema.prisma:2516`) is a post-publish status only, not a pre-publish workflow state.
2. **No "Master Data Approver" role/permission exists anywhere** — checked `schema.prisma`, `prisma/seed.ts`, `src/auth` — zero hits.
3. **No Accounting confirmation step gating tax/GL mapping before publish** — whoever holds `inventory:items:create` sets (or misets) GL mapping unilaterally, live immediately.
4. **Dedupe is exact-SKU-only.** No fuzzy/near-duplicate match on brand+model+name to catch a different SKU for what's effectively the same item — the PDF's "flags duplicate SKU/model" language implies a warning on near-matches too, not just a hard unique-constraint reject.

## Closing the gaps

Ordered by risk/value.

### 1. Confirm whether a real approval workflow is actually wanted

**Problem**: the PDF describes a 4-actor governance chain (HO Inventory → Accounting → Master Data Approver → publish); the app today is single-actor, instant-publish.
**Fix**: this is a product decision, not a pure engineering one — confirm with the business whether NIG's item-creation volume and risk profile actually justifies this friction, or whether the existing hard-constraint + single-permission gate is sufficient. Don't build a workflow state machine on spec.

### 2. If confirmed: add the workflow state machine

**Problem**: no way to hold an item as a draft pending review today.
**Fix**: add a draft/pending-approval status to `Item` (or a parallel review entity so `Item` itself stays the single published source of truth), a "Master Data Approver" permission, and gate PO/receiving/inventory/POS visibility to approved items only.

### 3. Add near-duplicate warning

**Problem**: two items for the same physical model under different SKUs currently sail through with no warning.
**Fix**: add a non-blocking fuzzy-match check (e.g. trigram/similarity on brand+model+name) surfaced to HO Inventory at creation time.

## Dead code / unused-feature flags

None found.

## Implementation Log — 2026-08-04

**For this scenario, I have done:**

- Item #2 (workflow state machine) — Part 1, backend: new `ItemApprovalStatus` state machine on `Item` (`draft → pending_accounting_confirmation → pending_approval → approved`, or `rejected`), five new endpoints (`submit`/`confirm-accounting`/`reject-accounting`/`approve`/`reject`), a new **Master Data Approver** role, two new permissions (`inventory:items:confirm_tax_mapping`, `inventory:items:approve`), and an approved-only visibility gate on `GET /inventory/items` for callers without an item-governance permission (POS/PO/receiving pickers). Migration backfills every pre-existing item to `approved` so nothing already live dropped out of POS/PO/reports.
- Item #2 (workflow state machine) — Part 2, frontend: status badges, Submit/Confirm/Reject/Approve row actions + modals (`ItemApprovalActionModal`, `ItemRejectModal`), permission-gated visibility, a draft-start notice on the Add Item modal, an Item Master table actions-column cleanup (overflow menu for secondary actions, since the row was crowded after adding governance buttons), and a Status-column fix so lifecycle (e.g. "active") and approval status (e.g. "Pending Approval") never render simultaneously (was confusing/contradictory). Also removed the Selling Price field from the Add/Edit Item forms per an ad hoc request mid-implementation (unrelated to governance, landed in this same pass) — POS still falls back to `Item.sellingPrice` at checkout today, so new items need a `BranchPricing` entry (or similar) set separately or they'll show ₱0.
- Item #3 (near-duplicate warning) — Part 3: `pg_trgm` trigram similarity index on `items.name`, `GET /inventory/items/check-duplicates` (up to 5 candidates, non-blocking), and a debounced warning banner on the Add Item modal.

**Worth flagging:**

- Decision (Phase 2): the full 4-actor governance chain was confirmed wanted — not the lighter-weight "existing hard-constraint is sufficient" alternative gap #1 raised.
- Decision: governance gates **new-item creation only** — edits to already-approved items stay instant/unrestricted, unchanged from prior behavior.
- Decision: Branch Manager also holds `confirm_tax_mapping` and `approve` (alongside Accountant/Master Data Approver respectively), for branches without dedicated staff — Business Owner has both automatically via the seed's full-permission grant.
- The backend's `confirm-accounting` endpoint accepts optional tax/GL corrections inline, but the frontend modal only exposes a remarks field, not inline correction — today, fixing a wrong mapping goes through reject-with-reason → HO Inventory edits → resubmits, not inline editing in the confirm step. Worth a follow-up if Accounting finds that friction annoying in practice.
- Hit unrelated pre-existing DB drift twice while implementing: (1) the shared local dev DB had Scenario 15's price-list migrations applied without being merged to `development` — resolved by the developer resetting/reseeding that DB; (2) the shared DB's owner is `karmslajo`, not `postgres`, which blocked `CREATE EXTENSION pg_trgm` via `migrate deploy` — resolved by applying the SQL as the DB owner and marking the migration resolved in Prisma's tracking table. Worth fixing DB ownership at some point so this doesn't recur on the next extension-requiring migration.

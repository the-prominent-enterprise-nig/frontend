# Scenario 07 — Repair Transfer — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "Repair transfer — a unit needs repair."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3d19k6](https://app.clickup.com/t/86d3d19k6) — "AA Stock Controller, ISBAT raise a Repair Transfer that auto-creates the paired stock transfer to main, with the RFS form attached as supporting document" — _Sprint 3, for qa_ — direct match to steps 1-2, worded almost identically. Fully addressed by Parts 1-2 (2026-07-21).
- [86d3d19pu](https://app.clickup.com/t/86d3d19pu) — "AA Warehouse Manager, ISBAT receive a Repair Transfer at main, assess it as repairable or unrepairable, and route it via Delivery Receipt or a manual write-off decision" — _Sprint 3, for qa_ — direct match to step 3, including the "manual decision, no auto-junk" nuance this doc's Closing Gap 4 flagged as needing a product decision. Fully addressed by Parts 3-4 (2026-07-21): the "write-off decision" wording is satisfied by reusing `createAdjustment()` rather than rebuilding the removed dedicated write-off feature (same discrepancy flagged in Scenario 05/10).
- [86d3phfw4](https://app.clickup.com/t/86d3phfw4) / [86d3phfux](https://app.clickup.com/t/86d3phfux) / [86d3phfuk](https://app.clickup.com/t/86d3phfuk) — "ISBAT have a unit returned through POS route to repair when it's marked as damaged" (Business Owner / Branch Manager / Warehouse Manager) — _Sprint 3, for qa_ — this is the POS-return-to-repair flagging already confirmed working in this doc's "What's already done" (via UDS), not the Repair Transfer entity itself.

Both core steps (raise the transfer, assess and decide at main) have direct tickets — the gap is between what those tickets ask for and what currently exists in code, not a missing-ticket problem.

## The scenario we're building toward

A sold or stock unit is found defective and needs service:

1. Raise a Repair Transfer; an RFS form is attached as the supporting document.
2. Transfer to main branch for assessment (auto-paired stock transfer); main issues the RR, no approval.
3. Assess & decide — repairable units go DR to the repair provider; unrepairable units need a manual decision (no auto-junk), then a write-off.

## What's already done ✅

**Nothing directly.** No matches for "Repair Transfer," "RFS," or "repair provider" anywhere in either codebase. One adjacent building block exists:

- **UDS (Unit Document Sheet)** — `backend/src/inventory/services/uds.service.ts`, `backend/src/inventory/controllers/uds.controller.ts`, model `UnitDocumentSheet`/`UnitDocumentSheetLine` (`backend/prisma/schema.prisma:4297-4327`). Its `UdsReason` enum already includes `repair` and `pull_out` (`schema.prisma:2280-2286`), with a status flow `issued → in_transit → received → completed/cancelled` (`:2288-2294`). The controller's own doc comment says "Issue a Unit Document Sheet for repair or pull-out" (`uds.controller.ts:32`) — this was clearly built with something like Repair Transfer in mind, but it's a documentation/tracking artifact only: no RFS-form field, no linkage to an actual stock transfer, no DR/debit entry to an external provider, no approval logic.
- The general **Inter-branch Transfer mechanism** (`backend/src/inventory/services/transfers.service.ts`, `StockTransfer` model — see scenario 06) is the natural engine for "moves to main branch," but has no auto-pairing to a UDS and no branch-specific no-approval-required path.
- The general **Receiving Report** mechanism (`stock.service.ts`) exists but nothing wires it to a repair-transfer receipt.

## What's not done / gaps ❌⚠️

1. No "Repair Transfer" entity or workflow at all — only the adjacent UDS artifact.
2. No RFS-form attachment concept.
3. No auto-pairing between a Repair Transfer and an actual stock transfer to the main branch.
4. No "main branch issues RR with no approval" special-cased receiving path.
5. No DR/debit-to-repair-provider concept, and no external repair-provider entity anywhere in the schema.
6. **No write-off mechanism exists at all to hang final disposal on.** A dedicated write-off feature (route, service methods, DTOs, permissions, UI, dashboard tiles) was fully removed in commits `96334e6` and `de5b0d8`. Only the generic `createAdjustment()` (`backend/src/inventory/services/adjustments.service.ts`) remains, used today for stock-count discrepancy reconciliation — it has no supplier/provider linkage, no photo evidence, no dedicated approval flow. The "manual decision, no auto-junk, then write-off" step in the scenario has nowhere to land.

## Closing the gaps

This is a net-new workflow. Sequence matters — later steps depend on earlier entities existing.

### 1. Decide how "Repair Transfer" relates to UDS — extend, don't duplicate

**Problem**: UDS already models "issue a document for a repair-bound unit" with the right reason code and status flow, but nothing else about the scenario.
**Fix**: extend `UnitDocumentSheet` rather than building a parallel entity — add an `rfsFormUrl`/attachment field, a `linkedStockTransferId` (nullable FK to `StockTransfer`), and a `repairProviderId` (new lightweight entity, or reuse `Supplier` if repair providers are effectively vendors in this business). This keeps one document type for "unit is moving for a repair/pull-out reason" instead of two overlapping ones.

### 2. Auto-pair the stock transfer to main branch

**Problem**: no linkage between issuing a repair document and moving the physical unit.
**Fix**: on UDS creation with `reason: repair`, auto-create a `StockTransfer` to the tenant's main/head branch (needs a "main branch" concept — check if one exists on `Branch`/`BusinessSettings`; if not, add a simple `isMainBranch` flag), and set `UnitDocumentSheet.linkedStockTransferId` from #1.

### 3. No-approval receiving at main branch

**Problem**: normal transfers (post-scenario-06 changes) may gain approval gating; repair transfers should bypass that.
**Fix**: either exempt `reason: repair`-originated transfers from the scenario-06 approval toggle, or keep repair transfers on the plain `transfers.service.ts` `dispatch`/`receive` path entirely separate from scenario 06's new request/approval flow.

### 4. Decide the write-off replacement before building "unrepairable → write-off"

**Problem**: write-offs were deliberately removed; re-adding the old feature verbatim would undo that decision without knowing why it was removed.
**Fix**: **don't silently rebuild write-offs.** First confirm with the business/whoever made the removal decision whether disposal-of-unrepairable-units genuinely needs its own dedicated flow (photo evidence, approval, GL posting to a loss/scrap account) or whether the generic `createAdjustment()` (`reasonCode: write_off` already exists in `AdjustmentReasonCode`) is an intentionally lighter-weight replacement that should just get a UI. This is a product decision, not a pure engineering one — flag it before implementing.

### 5. DR to repair provider

**Problem**: no external repair-provider entity or debit-entry concept exists.
**Fix**: depends on #1's `repairProviderId` decision (new entity vs. reusing `Supplier`). If reusing `Supplier`, the debit entry can likely reuse the existing AP-bill posting pattern (scenario 10); if a genuinely new "service provider" concept, it needs its own lightweight AP-adjacent posting.

## Dead code / unused-feature flags

- **UDS's `repair`/`pull_out` reason codes** — not dead, but currently under-built relative to what their own doc comment implies they're for. Not a delete candidate; a build-out candidate per Closing Gap 1.

## Implementation Log — 2026-07-21

**For this scenario, I have done:**

- Closing Gap 1 (Part 1): extended `UnitDocumentSheet` with `rfsFormFileId` (→ `File`), `repairProviderId` (→ `Supplier`, reused rather than a new entity), and `linkedStockTransferId` (→ `StockTransfer`). Seeded the `inventory:uds:read`/`inventory:uds:manage` permissions that the controller referenced but were never actually in the catalog. Backend PR: [backend#66](https://github.com/the-prominent-enterprise-nig/backend/pull/66). Frontend: RFS-form upload control, repair-provider picker, searchable serial picker. Frontend PR: [frontend#67](https://github.com/the-prominent-enterprise-nig/frontend/pull/67).
- Closing Gap 2 (Part 2): raising a repair-reason UDS at a non-main branch now auto-creates a draft `StockTransfer` to the tenant's main branch (`Branch.isMainBranch`, seeded on Manila HQ) and links it via `linkedStockTransferId`, atomically in the same transaction. No-op if already at main. Granted Stock Controller/Branch Manager the `inventory:transfers:*` permissions needed to follow through (previously neither had any). Backend PR: [backend#67](https://github.com/the-prominent-enterprise-nig/backend/pull/67). Frontend: linked-transfer badge, a new read-only UDS detail view, and a redesigned card-based status-update UX. Frontend PR: [frontend#68](https://github.com/the-prominent-enterprise-nig/frontend/pull/68).
- Closing Gap 3 (no-approval receiving at main): confirmed moot when originally implemented — scenario 06's approval-gating toggle hadn't shipped yet. It has since merged into this branch's ancestry (adding `pending_manager_approval`/`pending_hq_approval` routing to `TransfersService.create()`), so re-verified rather than assumed: `UdsService.autoPairRepairTransfer()` now calls `create()` with `{ internal: true }`, which skips that routing entirely and forces `status: 'draft'` — `dispatch()`/`receive()` have no approval-path-only gates, so the auto-paired transfer still goes straight through with no approval step.
- Closing Gap 5 (Part 3): assessing a received repair-reason UDS as repairable posts an immediate accrual debit (Dr `5150 REPAIR_EXPENSE` / Cr `2600 REPAIR_PROVIDER_PAYABLE`, both new GL accounts + mappings) for the estimated cost and flips the serial to `in_repair`; unrepairable just records the verdict (no JE) and flips the serial to `defective`. Also added a follow-up `PATCH :id/repair-provider` endpoint (with matching UI) after manual testing showed there was no way to set/correct a repair provider once a UDS had already been issued without one. Backend PR: [backend#69](https://github.com/the-prominent-enterprise-nig/backend/pull/69). Frontend: verdict/cost UI, redesigned list table, repair-provider edit affordance. Frontend PR: [frontend#70](https://github.com/the-prominent-enterprise-nig/frontend/pull/70).
- Closing Gap 4 (Part 4): writing off an unrepairable UDS reuses the generic `createAdjustment()` (`reasonCode: write_off`) rather than rebuilding the removed dedicated write-off feature — the decision flagged as needing reconciliation in this doc's ticket table. Extended `createAdjustment()`'s line DTO with an optional `serialNumberId` (validates it belongs to the item, scraps it after posting) since the existing method was purely item+quantity based with no serial awareness at all. Added `UnitDocumentSheet.writeOffAdjustmentId` (mirrors `repairDebitJournalEntryId`) so the UI can show "written off" and block writing off the same UDS twice. New `PATCH /inventory/uds/:id/write-off` endpoint, gated on `assessment: unrepairable`. Frontend: a "Write Off" row action (parallel to "Assess") opening a purpose-built modal, and a "written off" indicator in the detail view.
- Part 5: with all 5 closing gaps implemented, re-verified against live code (not just prior claims) whether anything was still missing. Found none — but the auto-paired transfer's `dispatch`/`receive` path had never actually been exercised end-to-end by this scenario's own tests (only read access was asserted; the UDS was flipped to `received` directly). Added one backend e2e test driving the real dispatch → receive flow, confirming both the no-approval claim (re-checked above) and that `receive()` still issues a `GoodsReceipt`/GRN for the auto-paired transfer, same as any other. Test-coverage only, no product changes.

**Worth flagging:**

- Found and fixed two unrelated pre-existing bugs while implementing Parts 1-2: (1) `cleanDatabase()` in `prisma/seed.ts` never cleared `UnitDocumentSheet`/`UnitDocumentSheetLine` before `SerialNumber`, blocking reseeding once any UDS existed; (2) frontend `FILES_PERMISSIONS` guard constants didn't match what the backend actually seeds — dead code with zero prior consumers, so the drift was invisible until this scenario's RFS-upload feature became its first real consumer.
- All four parts are stacked (`part-2` on `part-1`, `part-3` on `part-2`, `part-4` on `part-3`), not on `main` — merge order matters. Parts 1-2 have since been merged into `part-1`, which also picked up `development` (including the unrelated scenario-06 stock-request-transfer work) via a manual merge partway through this run.
- Both Scenario 07 tickets are now status **for qa**: [86d3d19k6](https://app.clickup.com/t/86d3d19k6) (Parts 1-2) and [86d3d19pu](https://app.clickup.com/t/86d3d19pu) (Parts 3-4, closing Gaps 4/5) — the latter's "write-off decision" wording is satisfied by Part 4's `createAdjustment()` reuse, not a rebuilt dedicated feature.

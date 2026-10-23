# Scenario 55 — Standalone RR for Repair Returns & Repossessions, Under Inventory > Stock — Gap Analysis

**Source**: colleague's raw UAT/feedback notes, relayed by the developer, 2026-09-20. Original note: _"Can make RR even without the PO / for repairs and repo. Under Stock."_ Read together with an earlier line in the same batch: _"should be able to make RR without PO, can make standalone RR"_ (originally logged under Accounting in that pass).

## Related ClickUp Tickets

Not checked yet — recommend a `clickup_search` before further work.

## Related docs

- [scenario-53-manual-rr-accounting-plan.md](./scenario-53-manual-rr-accounting-plan.md) — the existing standalone/no-PO RR feature (built 2026-09-19, this same branch). Directly relevant: it already solved "RR without a PO," but scoped the entry point to Accounting only, and its Implementation Log item 4 records that a `reasonCode` field (originally meant to capture "why this delivery has no PO/transfer/count context") was deliberately removed during the build.
- [scenario-50-inventory-uat-batch-plan.md](./scenario-50-inventory-uat-batch-plan.md) (its "Repair Journey for Customer" row) — the existing UDS (Unit Document Sheet) repair flow. Its `receive-from-provider` step already writes a real second RR when a repaired unit comes back from an external provider — but only for units that went through the full formal dispatch-to-provider journey.
- [scenario-18-returns-exchanges-disposition-plan.md](./scenario-18-returns-exchanges-disposition-plan.md) — where a POS return gets flagged `flag_for_repair` and raises a UDS in the first place.

---

## What's already done ✅

1. **Standalone/no-PO RR creation exists** (Scenario 53) — multi-line, source and item both optional-registration (type a name, system finds-or-creates the `Supplier`/`Item` row), lives at `/accounting/receiving-reports/manual-rr/new` (`frontend/src/app/(app)/(dashboard)/accounting/receiving-reports/manual-rr/new/page.tsx`). Backend: `POST /inventory/manual-receiving-reports`, gated by `inventory:manual-rr:create` OR `accounting:manual-rr:create` (`backend/src/inventory/controllers/manual-receiving-report.controller.ts:49-52`). No `poNumber` FK on the DTO — it's a free-text reference field only (`backend/src/inventory/dto/manual-receiving-report.dto.ts:170,175`), confirming it's genuinely PO-optional by design.
2. **Repair already has a mature, separate flow: the UDS module.** `create → assess (repairable/unrepairable) → set provider → dispatch-to-provider → receive-from-provider → release-to-customer`. `UdsReason` enum = `repair | maintenance | quality_check | pull_out | loan`; `UdsStatus` includes `at_provider` and `repaired`, with schema comments noting `at_provider` is "dispatched... on a DR" and `repaired` is "back from the provider on an RR, actual cost known" (`backend/prisma/schema.prisma:4667-4684`). `SerialNumber.status` already includes `in_repair` (`schema.prisma:4647-4657`) and is already surfaced as a status filter + colored pill on the Inventory > Stock > Serial Numbers tab.
3. **Repossession: nothing exists.** A full grep for "repossess" across the backend, frontend, and Prisma schema returns zero hits. No status, no flow, no linkage from `InstallmentAccount` to a repossession event.

---

## What's not done / gaps ❌⚠️

1. **No RR-creation entry point lives under Inventory > Stock at all, today.** Stock's own tabs are Balance / Serial Numbers / Stock Ledger / Receiving Reports (`frontend/src/app/(app)/(dashboard)/inventory/stock/_components/StockHub.tsx:22-25`) — the Receiving Reports tab is list/view only, its "+" action opens `ReceiveStockModal`, which still requires resolving a registered Supplier and catalog Item, not the no-PO/optional-registration flow. Manual RR (Scenario 53) only opens from `/accounting/receiving-reports`; the old Inventory-side shell at `inventory/manual-receiving-reports/` has actions and hooks but no `page.tsx` — confirmed still unreachable.
2. **Manual RR has no "reason"/source-type field at all.** There's no way today to tag a no-PO RR as "repair return" vs. "repossession" vs. an ordinary miscellaneous receipt — that concept was built once (as `reasonCode`) and explicitly removed in Scenario 53.
3. **The UDS repair-return RR only fires inside the full, formal dispatch-to-provider journey.** There's no lightweight path for a repair return that never went through a tracked UDS dispatch — e.g. a unit repaired in-house, or a pre-existing repair from before this system was used.
4. **Repossession has no receiving path of any kind.** A repossessed unit has nowhere to re-enter stock — no serial status, no RR reason, no link back to the `InstallmentAccount`/default that caused it.

---

## Decisions (developer, 2026-09-20)

| Question                                              | Decision                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extend Scenario 53's Manual RR, or build under Stock? | **Under Stock — extend the existing Create RR flow** (`ReceiveStockModal` → `receiveStock()`), reachable from `/inventory/stock?tab=reports`. Accounting's Manual RR (Scenario 53) is untouched.                                                                                                                             |
| Does the branch-warehouse guard need an exception?    | **Yes.** `receiveStock()` currently refuses any no-PO receipt into a branch-local warehouse (`stock.service.ts:900-916`) — the reasons introduced here are carved out to allow receiving directly into the actor's own branch warehouse.                                                                                     |
| Does this touch UDS's own repair-return step?         | **Yes.** `UdsService.receiveFromProvider()` today only flips the serial's status and stores a free-text reference number — no real `StockLedger` entry, no persisted RR (`uds.service.ts:1016-1037`). It gets wired into this same new receiving path so a UDS-tracked repair return produces a real, ledger-visible RR too. |
| How deep does repossession tracking go?               | **Reference link only.** A new `repossessedFromInstallmentAccountId`-style field on `SerialNumber` (mirroring the existing `consignedToSupplierId` pattern) plus a new `repossessed` `SerialNumberStatus` value. Not a separate, independently-reportable repossession record.                                               |
| Who can create it?                                    | **Stock Controller, directly under Stock.** Already covered by the existing `inventory:receive:create` permission, which Stock Controller already holds — unlike `inventory:manual-rr:create`, which deliberately excludes them (`prisma/seed.ts:4116`). No RBAC change needed for this endpoint.                            |
| Does "repair" mean only formal UDS-tracked repairs?   | **No.** Also covers in-house/informal repairs that never opened a UDS record — the reason is available on a standalone Create RR like any other no-PO receipt.                                                                                                                                                               |
| Is the reason limited to just these two values?       | **No.** Built as a general, extensible reason field (e.g. `repair_return`, `repossession`, `other`), not hardcoded to two values.                                                                                                                                                                                            |

---

## Design

- **New reason field on `ReceiveStockDto`** (new enum, distinct from `AdjustmentReasonCode` — that one belongs to Stock Adjustments, a different feature). When set, `resolveSupplierId()` (`stock.service.ts:794-810`) no longer throws `supplier_required_when_no_po_linked` — Supplier stays fully optional for a reasoned receipt.
- **Branch-warehouse guard carve-out** (`stock.service.ts:900-916`): a no-PO receipt with a `reason` set is allowed into the actor's own branch warehouse. A plain no-PO/no-reason receipt is still blocked there, unchanged.
- **Repossession linkage**: `SerialNumberStatus.repossessed` (new enum value) + `SerialNumber.repossessedFromInstallmentAccountId` (new nullable FK, mirroring `consignedToSupplierId`), set when `reason: repossession` and an `InstallmentAccount` is picked on the line.
- **UDS wiring**: `receiveFromProvider()` calls into the same new receiving path (reason: `repair_return`) instead of only updating the serial directly, so the return produces a real `StockLedger` receipt row.
- **Frontend** (`ReceivingReportsTab.tsx` → `ReceiveStockModal.tsx`): a reason picker; Supplier field becomes optional/hidden once a reason is picked; an `InstallmentAccount` search appears when reason = repossession; branch warehouses become selectable for these reasons.
- **RBAC**: no new permission — `inventory:receive:create` already covers Stock Controller (and Branch Manager/Business Owner per the existing hierarchy).

## Parts to build — confirmed scope, `implement-scenario` run starting 2026-09-20

All 5 parts confirmed in scope this run, on the current branch (`feat/scenario-53-manual-rr-accounting`). Each part gets its own e2e coverage and manual test steps, and stops for developer confirmation before the next begins.

1. **Backend — no-PO reason support + branch-warehouse carve-out.** New reason enum on `ReceiveStockDto`/schema; `resolveSupplierId()` skips its required-supplier throw when a reason is set; the branch-warehouse guard allows a reasoned no-PO receipt into the actor's own branch warehouse. (Combined from the original Parts 1+2 — same guard logic, not separately testable.)
2. **Backend — repossession linkage.** New `repossessed` status + `repossessedFromInstallmentAccountId` field, wired into the reasoned-receipt path.
3. **Backend — UDS integration.** `receiveFromProvider()` routes through the new receiving path so a UDS-tracked repair return creates a real ledger entry.
4. **Frontend — Create RR UI.** Reason picker, optional Supplier, `InstallmentAccount` picker for repossession, branch warehouse selectable.
5. **RBAC verification.** Prove `inventory:receive:create` is sufficient end-to-end for the new path — e2e coverage, not a seed change.

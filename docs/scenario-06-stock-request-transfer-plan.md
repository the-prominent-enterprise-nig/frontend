# Scenario 06 — Stock Request & Inter-branch Transfer — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "Stock request & inter-branch transfer — a branch needs stock."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3p2vgj](https://app.clickup.com/t/86d3p2vgj) — "AA Branch Manager, ISBAT see Brand, Model, Available, Reserved, and Remaining balance per warehouse before raising a stock request" — _Sprint 3, to do_ — direct match to step 1
- [86d3p2vp6](https://app.clickup.com/t/86d3p2vp6) — "AA Cashier, ISBAT open the stock request module directly from POS" — _Sprint 3, to do_
- [86d3p2vxj](https://app.clickup.com/t/86d3p2vxj) — "AA Business Owner, ISBAT turn head-office approval for inter-branch transfers on or off as an admin setting" — _Sprint 3, to do_ — direct match to step 3 (the configurable HQ-approval toggle this doc's Closing Gap 2 recommends)
- [86d3p2vyv](https://app.clickup.com/t/86d3p2vyv) — "AA Branch Manager, ISBAT accept or reject an incoming stock transfer request before it moves" — _Sprint 3, to do_ — direct match to step 4
- [86d3p2vjc](https://app.clickup.com/t/86d3p2vjc) — "AA Branch Manager, ISBAT have an approved stock request automatically create the matching inter-branch stock transfer" — _Sprint 3, to do_
- [86d3p2vzz](https://app.clickup.com/t/86d3p2vzz) — "AA Stock Controller, ISBAT see the serial number carried through a stock transfer and shown on the resulting Receiving Report" — _Sprint 3, to do_ — matches Closing Gap 1 (serial-level requesting)
- [86d3p2w0r](https://app.clickup.com/t/86d3p2w0r) — "AA Branch Manager, ISBAT be notified when my stock transfer or request is rejected" — _Sprint 3, to do_
- [86d3d19va](https://app.clickup.com/t/86d3d19va) — "AA Business Owner, ISBAT configure approval routing rules by amount threshold, transaction type, and department" — _Sprint 5, to do_ — a general-purpose approval-routing engine; may be the intended broader mechanism behind the HQ-approval toggle above rather than a scenario-06-specific build. Worth checking whether these two tickets are meant to be the same piece of work before scoping Closing Gap 2.

Good news: unlike several other scenarios in this batch, every numbered step in this scenario has at least one matching ticket in Sprint 3-5.

## The scenario we're building toward

A branch is out of a model a customer wants:

1. Check availability — open Stock Request, pick a warehouse, see Available/Reserved/Remaining (no serial needed).
2. Raise the request (Brand/Model/Serial), often straight from the POS serial view.
3. Approval (configurable) — if head-office-approval is on, route for approval first; if off, go straight to the source branch.
4. Accept or reject — source branch accepts/rejects; on accept, transfers and issues the RR (serial on the RR). 1-2 day wait expected.

## What's already done ✅

1. **Availability check** — effectively covered by the existing Stock Balance screen, not a purpose-built "Stock Request" entry point. `StockBalance` has exactly `onHandQty`/`reservedQty`/`availableQty` (`backend/prisma/schema.prisma:2710-2712`); frontend `StockBalanceList.tsx:159-213` renders those columns with a warehouse filter, no serial required.
2. **Basic transfer mechanism exists** (not what the scenario describes, but the foundation to build on) — `StockTransfer`/`StockTransferLine` (`schema.prisma:2746-2789`), full `create/dispatch/receive/cancel` lifecycle in `backend/src/inventory/services/transfers.service.ts`, frontend at `frontend/src/app/(app)/(dashboard)/inventory/transfers`.

## What's not done / gaps ❌⚠️

**No "Stock Request" or approval-routed inter-branch module exists.** What's there is a plain two-warehouse `StockTransfer` (`draft → in_transit → received → cancelled`), with no request/approve/reject semantics and no approval routing at all.

1. **Raising a serialized request** — MISSING. `CreateTransferModal.tsx` only captures `fromWarehouseId`, `toWarehouseId`, `transferDate`, `reason`, and line `itemId` + `quantity` (`:205-253`). `CreateTransferLineDto`/`StockTransferLine` have no `serialNumber` field at all — only `itemId`, `variantId`, `batchId`, `quantity` (`backend/src/inventory/dto/transfers.dto.ts:18-43`; `schema.prisma:2773-2788`). No linkage to POS or the serial-numbers module.
2. **Configurable head-office-approval routing** — MISSING, confirmed absent, not just unconfigured. `StockTransferStatus` enum is only `draft | in_transit | received | cancelled` (`schema.prisma:2225-2230`) — no `pending_approval`/`requested` state. No tenant setting resembling "head-office-approval" exists anywhere (grep across backend for `headOffice|hqApproval|requiresApproval|approval` inside `inventory/` and `schema.prisma` returns zero hits); `BusinessSettings` (`schema.prisma:1392-1408`) has no such toggle. The only approval-tiered workflow in the codebase is `PurchaseRequestService`/`PurchaseRequestApproval` (`purchase-request.service.ts:16-21,182-216`) — procurement-to-supplier, unrelated, and explicitly commented "Single-tier by design for now."
3. **Accept/reject with RR + serial on accept** — MISSING. `TransfersController`/`TransfersService` has `dispatch` and `receive` only (`transfers.controller.ts:90-120`; `transfers.service.ts:195-360`) — no `accept`/`reject` endpoints. Receiving Reports (`GoodsReceipt`, `schema.prisma:3130-3161`) are wired only to `PurchaseOrder` receiving (`stock.service.ts:1086+`), not to `StockTransfer` — transfer "receive" just flips status and writes a ledger entry, with **no RR document and no serial capture** (`StockTransferLine` has no `serialNumber` field, only `batchId`).

## Closing the gaps

Sequenced — later steps build on earlier ones.

### 1. Add serial-level requesting to transfers

**Problem**: transfers only move `itemId` + `quantity`; there's no way to request/track a _specific_ serial, which POS scenario 04 needs to hand off into.
**Fix**: add an optional `serialNumberId` to `StockTransferLine` (nullable — bulk/non-serialized items still transfer by quantity only), and extend `CreateTransferModal.tsx`/`CreateTransferLineDto` to accept a specific serial when the source item is serial-tracked.

### 2. Add request/approval states and a configurable HQ-approval toggle

**Problem**: transfers today have no request phase at all — `draft` already implies "decided," not "asked for."
**Fix**: extend `StockTransferStatus` with `requested` and `pending_hq_approval` states ahead of `draft`/`in_transit`. Add a `BusinessSettings` boolean (e.g. `requireHqApprovalForTransfers`) — when true, a new request routes to a head-office approver queue before reaching the source branch; when false, it goes straight to the source branch's accept/reject queue (see #3). Model the approval step loosely on the existing `PurchaseRequestApproval` pattern rather than inventing a new one, even though that pattern is procurement-specific — the shape (submit → approve/reject → proceed) transfers cleanly.

### 3. Add accept/reject endpoints + RR on accept

**Problem**: only `dispatch`/`receive` exist; there's no "the source branch says yes/no" step, and receiving never produces a document or captures a serial.
**Fix**: add `accept(transferId)`/`reject(transferId, reason)` to `TransfersService`, gating `dispatch` on `accept` having happened first. On accept, generate a `GoodsReceipt`-equivalent document scoped to transfers (either extend `GoodsReceipt` to optionally reference a `StockTransfer` instead of only a `PurchaseOrder`, or add a lightweight transfer-specific receipt record) that captures the serial from #1.

### 4. Wire POS's "request from another branch" (scenario 04) into this once built

**Problem**: scenario 04's one-tap request action has nothing to create today.
**Fix**: once #1-3 exist, scenario 04's action simply creates a `StockTransfer` request pre-filled with the item/serial and a note that it originated from an active POS sale.

## Dead code / unused-feature flags

None found — the existing `StockTransfer` mechanism is real, used, and simple by design; it's a legitimate foundation to extend, not something to remove.

## Implementation Log — 2026-07-20

**For this scenario, I have done:**

- Closing Gap 1 (serial-level requesting): added optional `serialNumberId` to `StockTransferLine` (`backend/prisma/schema.prisma`, migration `20260720073033_add_serial_to_transfer_line`), validated in `TransfersService.create()` (belongs to the item, in-stock at the source warehouse, not reused across lines, quantity forced to 1). `CreateTransferModal.tsx` shows a serial picker whenever the selected item is serial-tracked, and the transfer detail view / print document show the captured serial.

**Worth flagging:**

- Confirmed decisions carried into this run (see conversation, not repeated here in full): HQ-approval toggle will be a simple scenario-06-specific `BusinessSettings` boolean built now rather than waiting on the Sprint-5 general approval-routing engine (ticket `86d3d19va`); the HQ approver is Business Owner only; source-branch accept/reject stays Branch Manager + Business Owner (no Stock Controller); raising a request is Branch Manager + Business Owner (inventory module) plus Cashier via the Gap-4 POS one-tap action only.
- Mid-Part-2 scoping revision (not yet implemented): every new transfer will now go through the request/approval flow — there is no bypass to a directly-decided `draft`. A new `inventory:transfers:request` permission will gate raising a request (granted to Branch Manager + Business Owner), left alongside the existing `inventory:transfers:create` permission (still Business-Owner-only, now effectively redundant with `request` for that role) rather than repurposing it, so ticket `86d3p2vzz` ("serial number carried through a transfer and shown on the resulting Receiving Report") stays open until Part 3 adds the Receiving Report — Part 1 only carries the serial through creation and the detail view, not onto a Receiving Report yet.
- Fixed a real bug caught during manual testing: the create form was resetting `serialNumberId` to `''` (not `undefined`) on item/warehouse change, and the backend DTO's `@IsOptional()` + `@IsNotEmpty()` combo rejected `''` as "provided but invalid." Fixed in `create-transfer.ts` (strip empty string before posting) with a regression e2e test covering a non-serial-tracked item submission.
- `docs/seed-data-reference.md`'s serial-number counts for `TN-FURN-SET-001` had drifted badly (documented 6, actual 144 from repeated manual testing) — corrected the note in place rather than re-enumerate a moving target.

# Scenario 04 — POS Cross-Branch Serial Availability — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "POS serial availability — the item is in another branch."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3p2w49](https://app.clickup.com/t/86d3p2w49) — "AA Cashier, ISBAT see which branch holds each serial for an item I search at POS, with my own branch highlighted first" — _Sprint 3, to do_ — direct match to steps 1-2
- [86d3p2w5c](https://app.clickup.com/t/86d3p2w5c) — "AA Cashier, ISBAT raise a stock request for a specific serial in one tap directly from the POS serial picker" — _Sprint 3, to do_ — direct match to step 3
- [86d3aby76](https://app.clickup.com/t/86d3aby76) — "AA Cashier, ISBAT check cross-branch stock for an item at checkout" — _Sprint 3, for qa_
- [86d3qbvfd](https://app.clickup.com/t/86d3qbvfd) — "AA Cashier, ISBAT be blocked from selecting a serial that belongs to a different branch, with a search box in the serial picker, so units at other branches can't be accidentally sold from mine" — _Sprint 3, for qa_ — **this looks like the ticket behind the regression this doc describes**: it's marked "for qa" (implying shipped) and its wording ("blocked from selecting... units can't be accidentally sold") only covers the sell-side block, not the "shown, with a request option" behavior scenario 04 wants. Worth confirming directly with whoever closed this ticket whether "shown to browse + request" was ever in scope, or if 86d3p2w49/86d3p2w5c above are meant to be the follow-up tickets that add it back.

## The scenario we're building toward

The model the customer wants is out at this branch:

1. Search at POS — every serial company-wide listed, own-branch serials highlighted.
2. See other branches — for serials elsewhere, POS shows which branch holds each one.
3. One-tap request — raise a stock request from another branch straight from POS, without leaving the sale.
4. Feeds the transfer — the request flows into inter-branch transfer.

## What's already done ✅

Nothing — all 4 points are missing, and this is a **regression**, not an original gap.

A prior session's branch-scoping fix (correctly closing a different bug — a serial in stock at one branch being sellable from another) went further than intended: it removed cross-branch visibility **entirely** rather than adding "shown, with a request option" as this scenario wants.

- `frontend/.../pos/checkout/page.tsx:487` sends `activeBranchId` on every serial-number fetch.
- Backend hard-enforces it regardless of what's asked for: `backend/src/inventory/controllers/serial-numbers.controller.ts:59-62` — _"A branch-assigned caller is always scoped to their own branch, regardless of what branchId is submitted."_ Other-branch serials never reach the frontend at all.
- The picker only ever renders `sn.serialNumber` (`checkout/page.tsx:3078-3080`) — no branch/location label anywhere in the modal, even though `SerialNumberRecord.currentWarehouseId` exists on the type (`pos-actions.ts:1966-1970`) and is simply unused.
- The empty state's copy — _"No available serial numbers in stock for this item at this branch"_ (`checkout/page.tsx:3062`) — implicitly confirms other-branch stock, if any, is both invisible and unmentioned to the cashier.
- No "Request Stock"/"Request Transfer" action exists anywhere in checkout — the only "Request" action present is the unrelated `handleRequestCancellation` ("Request Cancellation," `checkout.tsx:1345,2755-2764`).
- A transfer mechanism exists elsewhere in the backend (`backend/src/inventory/inventory.module.ts`, see scenario 06), but nothing in checkout/serial-picker code references it.

## What's not done / gaps ❌⚠️

1. Company-wide serial search with own-branch highlighting — MISSING (server actively excludes other branches).
2. "Which branch holds this serial" display — MISSING (field exists, unused).
3. One-tap stock request from the picker — MISSING (no such action anywhere).
4. Feeding into inter-branch transfer — MISSING as a consequence of #3, and scenario 06 (the transfer/approval mechanism itself) has its own larger gaps — see that doc.

## Closing the gaps

### 1. Add a deliberate "browse other branches" read path (don't reopen the original bug)

**Problem**: the backend's forced-`branchId`-override (`serial-numbers.controller.ts:59-62`) was a correct fix for _sellability_ — a Cashier should never be able to sell a serial physically located elsewhere. Simply removing that override to "fix" this scenario would reintroduce the original bug.
**Fix**: keep the sell-path exactly as-is (branch-forced, no regression), but add a **separate, explicitly read-only** endpoint/query mode — e.g. `GET /inventory/serial-numbers?itemId=...&scope=company` — that returns all matching serials across branches with their `warehouseId`/branch label, used only to populate the "also available elsewhere" section of the picker. Never let this path be used to actually add a line item to the cart; only the branch-scoped path can do that.

### 2. Show branch labels in the serial picker

**Problem**: `currentWarehouseId` is fetched but never displayed.
**Fix**: in the picker (`checkout/page.tsx:~3064-3086`), split results into two sections: "In this branch" (sellable, from the existing scoped call) and "Also available at [Branch Name]" (informational only, from the new company-wide read path in #1) — resolve `currentWarehouseId` → branch/warehouse name via the existing branch list already loaded in the POS branch-switcher context.

### 3. Add a one-tap "Request from [Branch]" action

**Problem**: no request action exists.
**Fix**: on each "also available elsewhere" row, add a button that raises a stock request (depends on scenario 06's request/approval mechanism existing — today there's no request entity to create at all, only a plain `StockTransfer`). Sequence this after scenario 06's gaps are closed, since there's currently no serialized, approvable request to create.

### 4. Feed into inter-branch transfer

**Problem**: depends entirely on #3 and on scenario 06 existing.
**Fix**: once scenario 06 has a real serialized stock-request entity, the POS-side request action in #3 simply creates one of those records with the sale/customer context attached (so the receiving branch's approver can see it originated from an active POS sale, not a generic restock request).

## Dead code / unused-feature flags

- **`SerialNumberRecord.currentWarehouseId`** — fetched, never rendered. Directly needed for Closing Gap 2 above — don't delete it, use it.

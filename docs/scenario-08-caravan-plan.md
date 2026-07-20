# Scenario 08 — Caravan — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "Caravan — a caravan sale at a host branch."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3pg8tz](https://app.clickup.com/t/86d3pg8tz) — "AA Stock Controller, ISBAT move stock to a host branch for a caravan event on its own consignment tab, so ownership stays with the origin branch" — _Sprint 3, to do_ — direct match to step 1, matches this doc's Closing Gap 1 (a "consigned" stock state distinct from a transfer) almost word for word
- [86d3pg8un](https://app.clickup.com/t/86d3pg8un) — "AA Branch Manager, ISBAT have a caravan sale's quota credit and inventory deduction follow the unit back to its origin branch, so the branch that owns the stock gets credit for the sale" — _Sprint 3, to do_ — direct match to step 3

**Not found in Sprint 3-5:** No ticket for "sell at the host" (step 2 — likely assumed to be normal POS checkout once consignment exists, not a separate ticket) or for the onward/return-at-event-close flow (step 4). Only 2 of the 4 scenario steps have explicit ticket coverage.

## The scenario we're building toward

The company runs a caravan event at a host branch:

1. Set up consignment — head office sends stock to the host: location moves, ownership/serial stay with origin; units sit in a "Caravan @ host" tab.
2. Sell at the host — rings, collects, receipts normally; serial captured at sale.
3. Attribution — quota credit and inventory deduction follow the serial to origin; cash/CIT sit with the host; serial tagged for accounting.
4. Onward or return — unsold units return to origin (or move on) at event close.

## What's already done ✅

**Nothing.** No matches for "Caravan" anywhere in either codebase. "Consign"/"Consignment" appears in exactly one place — `frontend/docs/inventory-user-stories.md:62,1091-1108,1393`, a **planned, unbuilt** user story (#52, "⭐ NEW," priority Medium) titled "Consignment Stock." That story describes **supplier-owned consignment inventory** (received without a payable until sold) — a different concept from this scenario's branch-to-branch, event-based consignment, despite the shared word.

Closest existing building blocks:

- **Inter-branch Transfer mechanism** (`backend/src/inventory/services/transfers.service.ts`, `StockTransfer` model — see scenario 06) could carry the physical relocation to the host branch, but it moves ownership/stock-of-record _along with_ the transfer today — there's no concept of "physical location moves, home-branch/ownership stays."
- **Serial-number tracking** exists (`SerialNumber` model, `inventory/serial-numbers` route) and could carry a future accounting "tag," but no such field exists today.
- No sales-quota-vs-origin-branch attribution logic and no cash-to-host concept found anywhere in POS/transactions services.

## What's not done / gaps ❌⚠️

Everything:

1. No "physical location moves, ownership stays" stock state — every existing movement mechanism (`StockTransfer`) conflates the two.
2. No "Caravan @ host" view/tab distinguishing consigned-in stock from the host branch's own inventory.
3. No split-attribution logic (quota + inventory deduction to origin, cash/CIT to host) anywhere in POS transaction/session posting.
4. No serial "tag" for this kind of cross-branch accounting split.
5. No onward/return-to-origin flow at event close.

## Closing the gaps

This is a net-new feature spanning Inventory + POS + Accounting. Sequenced.

### 1. Add a "consigned" stock state, distinct from a transfer

**Problem**: the existing `StockTransfer` model has no way to say "this unit is physically at Branch B but still belongs to Branch A."
**Fix**: add a `consignedToBranchId` (nullable) field on the unit's stock record (or `SerialNumber`, for serialized items) — separate from `warehouseId`/`branchId` (which continues to mean "home/ownership branch"). A caravan setup writes `consignedToBranchId = host`, leaving the item's actual owning branch untouched. This is the foundational primitive everything else depends on.

### 2. "Caravan @ host" view

**Problem**: no UI distinguishes consigned-in stock from a branch's own.
**Fix**: once #1 exists, add a filtered view/tab in the host branch's inventory screen showing items where `consignedToBranchId == currentBranch && homeBranchId != currentBranch`.

### 3. Split attribution at sale time

**Problem**: POS/session posting has no concept of "sell from here, credit/deduct there."
**Fix**: when a POS sale's item has a non-null `consignedToBranchId` matching the selling branch, route quota credit and inventory deduction to the item's home branch (`homeBranchId`) while cash/session/CIT posting stays with the selling (host) branch as normal. This touches `transactions.service.ts`'s posting logic and whatever quota-attribution exists in CRM/Agent commission — check both, since quota itself is currently absent from POS (see scenario 01, "Sales Quota... fully reverted") — attribution logic may need to wait until/unless quota is reintroduced, or be scoped to inventory-deduction-only if quota stays out of scope.

### 4. Serial tag for accounting

**Problem**: no field exists to mark a serial as "sold via caravan, origin X" for downstream reporting.
**Fix**: add a lightweight tag/note on the sale line or serial record at time of caravan sale, referencing the event and origin branch — mainly a reporting/audit convenience once #3's split-posting exists.

### 5. Event close — onward or return

**Problem**: no flow to clear `consignedToBranchId` back to null (return) or reassign it (onward to another branch).
**Fix**: a simple bulk action on the "Caravan @ host" view (#2) — select remaining unsold units, choose "Return to origin" (clears `consignedToBranchId`) or "Move to [branch]" (reassigns it), reusing the physical-movement side of the existing Inter-branch Transfer mechanism if the units need to physically travel back.

## Dead code / unused-feature flags

None — nothing exists yet to flag. Note for whoever picks this up: don't confuse this with the unbuilt "Consignment Stock" user story (#52 in `inventory-user-stories.md`) — that's supplier-side consignment, a separate feature that happens to share a name.

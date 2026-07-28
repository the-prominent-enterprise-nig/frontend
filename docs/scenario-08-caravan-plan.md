# Scenario 08 — Caravan — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "Caravan — a caravan sale at a host branch."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3pg8tz](https://app.clickup.com/t/86d3pg8tz) — "AA Stock Controller, ISBAT move stock to a host branch for a caravan event on its own consignment tab, so ownership stays with the origin branch" — _Sprint 3, in review_ — direct match to step 1, matches this doc's Closing Gap 1 (a "consigned" stock state distinct from a transfer) almost word for word. Minor gaps vs. the ticket's exact spec: no "Event name / dates" field, and no dedicated "Send to Caravan" UI button (consign is still API-only — see Implementation Log below).
- [86d3pg8un](https://app.clickup.com/t/86d3pg8un) — "AA Branch Manager, ISBAT have a caravan sale's quota credit and inventory deduction follow the unit back to its origin branch, so the branch that owns the stock gets credit for the sale" — _Sprint 3, to do_ — direct match to step 3. **Not moved**: this ticket's own scope is broader than what shipped — inventory/COGS attribution is done, but quota-credit routing is confirmed out of scope (no Sales Quota exists in the app), and the ticket's two open questions (receipt series for a caravan sale; cash/revenue attribution between host and origin) were never part of this closing plan and remain unaddressed.

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

## Implementation Log — 2026-07-27

**For this scenario, I have done:**

- Closing Gap 1 (consigned stock state): `SerialNumber.consignedToBranchId` + `Branch` relation, migration, `POST /inventory/serial-numbers/consign` — validates in-stock/not-already-consigned/not-same-branch, branch-restricted callers can only consign their own branch's stock.
- Closing Gap 2 ("Caravan @ host" view): a **Caravan** tab on Inventory → Serial Number Tracking (`GET /inventory/serial-numbers?consignedToBranchId=...`) — a branch-restricted caller is forced to their own branch; Business Owner picks one explicitly. Shows a "Home Branch" column via a `currentWarehouse.branch` enrichment.
- Closing Gap 3 (split attribution at sale time) + Closing Gap 4 (serial tag for accounting), implemented together since they share the same sale-time code path: a caravan-consigned serial is now sellable at the host branch even though its `currentWarehouseId` still points to the origin; COGS/StockLedger for FIFO/LIFO items route to the origin branch's warehouse; `PosTransactionLine.caravanOriginBranchId` tags the line for reporting; selling the serial resolves (clears) its consignment.
- Closing Gap 5 (event close): `POST /inventory/serial-numbers/close-consignment` — return to origin (clears the consignment) or move onward to a new host branch. Only the branch currently holding the consignment (or Business Owner) may act. Frontend: row selection + a "Return to Origin" / "Move to…" action bar on the Caravan tab.
- Attribution scope decision (flagged in this doc's own Closing Gap 3 as needing confirmation): **inventory-only, no quota** — confirmed with the developer. Sales Quota doesn't exist anywhere in the app (cleanly reverted per scenario 01), so quota-credit routing was out of scope; only inventory/COGS deduction and the reporting tag route to origin.

**Worth flagging:**

- A real gap was found and fixed beyond the original 5-item plan: the POS checkout serial picker (`GET /inventory/serial-numbers?itemId&status=in_stock&branchId`) still filtered strictly to the caller's own warehouse, so a cashier could never actually see/select a consigned-in serial even though the sale API would have accepted it. Fixed as part of Closing Gap 3 — "sellable at this branch" now means owned-and-on-hand OR consigned-here, and a unit consigned out correctly disappears from the origin's own picker.
- This work was ported forward from a stale, previously-unmerged branch (`feat/scenario-08-caravan`, backend `b9c8fad` / frontend `0b237ac`) that predated the scenario 04 and scenario 09 work already on `development` — reconciled by hand rather than merged directly, since a straight merge would have reverted both of those.
- No in-app UI exists yet to actually trigger a consignment — `POST /inventory/serial-numbers/consign` is API-only (matches the ported reference's own scope). A future pass could add a "Consign to Branch" bulk action on the "All Serials" tab, mirroring Closing Gap 5's "Move to…" pattern, if wanted.
- New `inventory:caravan:read`/`inventory:caravan:manage` permissions required a manual backfill (`backend/scripts/backfill-caravan-permissions.ts`) against the live dev DB, since `prisma/seed.ts` itself is a full destructive reseed and can't be safely re-run — matches this repo's existing pattern for this exact situation.
- The "Caravan @ Host" tab/view label was shortened to just "Caravan" per developer request after initial implementation.

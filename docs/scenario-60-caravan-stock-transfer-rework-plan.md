# Scenario 60 — Caravan Rework: Real Branch, Folded Into Stock Transfer — Gap Analysis & Closing Plan

**Source**: client feedback on the Inventory module, relayed 2026-09-24, "Inventory" section:

> - Have an option to view all movement of transfers PER SERIAL. Make it intuitive, and should be easily findable under the stock balance. Currently sold serials cannot be searched to check their movement.
> - Stock: Consign to Caravan – can be changed to STOCK TRANSFER and can identify in the modular that it is for the caravan. Remove the "one of our branches" and "somewhere else". Should have a host branch, make it required. But specify the location and the caravan name, so that the staff are aware that the items are intended for the caravan.
> - For branches with ongoing caravan: separate reporting of the sales. The items can be transferred to different branches after the caravan. Items in the caravan should always be transferred out if the caravan has ended.
> - CARAVAN: should be a temporary branch which means it will appear in the list of branches until the end date. Should have an RR every time it is received in the host branch. Fields: Host Branch, Event Name, Start and End Date. Remove "somewhere else"/"one of our branches" toggle. Currently caravan items cannot be transferred. Caravan items should belong in the Host Branch — when someone buys from the Caravan the money goes to the hosted branch and gets counted on their daily collection. Caravan items should be transferred to the host branch itself, any branch, or another Caravan.

## This is not a new feature — Caravan already shipped as Scenario 08

Worth stating first, because most of this list reads like a build request and isn't one. **Scenario 08 — Caravan** is fully closed (`docs/scenario-checklist.md:87`) — consign, event metadata, the Caravan tab, split inventory/COGS attribution to origin with cash staying at the host, the `caravanOriginBranchId` accounting tag, and return/onward-at-close all shipped 2026-07-27 through 2026-08-07. Its own plan doc was removed 2026-08-14 as part of the routine cleanup for closed scenarios, so there is nothing to diff against directly — this doc supersedes it. This client note is a **rework** of that shipped feature, not its initial build, and treating it as green-field would mean re-doing things that already work.

Two stale branches exist in both repos (`feat/scenario-08-caravan-v2`, `feat/scenario-08-caravan-consign-ui`) — confirmed to already be reflected in `development` (the exact commits are just not fast-forward-reachable after a squash-merge); there is no unmerged work sitting on them to recover.

## What's already done ✅

Verified against `development` in both repos, 2026-09-24:

- **The consign flow, with exactly the fields being asked for.** `ConsignToBranchModal.tsx` already captures Host Branch, Event Name, Start Date, End Date — it just also offers a "Somewhere else" (free-text venue) path alongside "One of our branches," which is the toggle this ask wants gone.
- **Per-serial movement history exists and is reachable from Stock Balance.** Stock Balance → row → Item 360 drawer → Stock tab → search a serial → `SerialMovementsTab` shows a real timeline (receipt/transfer/adjustment/sale/refund/credit memo/debit memo/service).
- **Money from a caravan sale already lands on the host branch's daily collection**, today, with zero caravan-aware code in POS. `PosTransaction` resolves its branch from `session.terminal.branchId`, and a caravan sale rings up on the _host's own terminal_ — there is nothing to fix here.
- **COGS/quota already stays with the origin branch.** `PosTransactionLine.caravanOriginBranchId` tags every caravan sale for this exact purpose; it's a backend-only field today (no frontend surface — see gaps).
- **Return/move-onward at close already exists.** `closeConsignment` lets a host either return stock to origin or move it onward to a new host.

## What's not done / gaps ❌

1. **Sold serials can't be searched for their movement history.** ❌ Item 360's Stock tab explicitly filters `GONE_STATUSES = {sold, scrapped, pulled_out}` out of its serial search (`StockTab.tsx:19,98`) — deliberate when it was written (a sold unit isn't "on the shelf" at any location), but it means the one case this ask cares about — checking a _sold_ unit's history — is the one case blocked.
2. **The venue ("somewhere else") path exists and this ask wants it gone**, with Host Branch made required instead.
3. **Caravan is fields on `SerialNumber`, not a branch.** It doesn't appear in any branch picker, has no lifecycle of its own, and nothing expires it at `caravanEventEndDate`.
4. **Consignment and Stock Transfer are two disconnected systems.** No shared DTO, controller, or status enum between `consignToBranch`/`closeConsignment` and `StockTransfer`. This is why "caravan items currently cannot be transferred" (through the normal transfer flow) is literally true — the two never talk to each other.
5. **The origin branch cannot recall its own consigned stock from a host.** `closeConsignment` is host-scoped (or branchless-owner); the sending branch gets a 403 trying to pull its own stock back. Documented, unfixed, since Scenario 50 Gap 6.
6. **No RR is issued when stock arrives at the host branch.** `consignToBranch` is a pure field mutation (`consignedToBranchId`, `currentWarehouseId`) — unlike `transfers.service.ts#receive()`, which already creates a `GoodsReceipt` as a side effect of receiving.
7. **No sales reporting split for caravans**, despite the backend field existing. `caravanOriginBranchId` is never read anywhere under `src/schema/accounting` or any report screen.
8. **No end-of-caravan enforcement.** Nothing currently checks whether a caravan still holds stock once its `endDate` has passed, let alone surfaces or blocks on it.

## Decisions taken (developer, 2026-09-24)

Three architecture calls were needed before this could be sequenced into parts — each changes what the later parts actually build:

1. **Caravan becomes a real `Branch` row** (`isTemporary` + `endDate`), not a lightweight entity merged into branch-list UI at read time. Chosen over the lighter alternative specifically so every branch-aware feature (transfer destinations, branch pickers, reporting) gets it for free instead of needing a caravan-aware branch and everywhere.
2. **"Consign to Caravan" is folded into the Stock Transfer flow itself** — one modal/endpoint, with a destination mode for "a Caravan," rather than a relabeled-but-still-separate system. Chosen over the cosmetic-rename alternative, matching the client note's literal wording.
3. **Existing venue-consigned (`consignedToVenue`) records are frozen, not migrated.** New consignments require a Host Branch going forward; historical venue records stay visible read-only in history/reports rather than being backfilled onto a branch that was never chosen for them.

**Resolving the tension decision #1 creates**: if a Caravan is a real Branch, does it get its own POS terminal, and does that break "the money goes to the host's daily collection"? — **No new terminal.** A caravan branch is given identity for stock/transfer/branch-list purposes only; it deliberately gets **no POS terminal of its own**. Sales at a caravan keep ringing on the _host_ branch's existing terminal exactly as today, which is already how daily-collection attribution ends up correct — there is no cash-redirect hook anywhere in the codebase today, and building one would be solving a problem decision #1 doesn't actually create once terminals are scoped this way.

## Conventions this scenario must follow

- **Role access hierarchy** — Caravan create/manage stays gated on `inventory:caravan:manage` (existing permission); folding it into Transfers must not silently grant caravan creation to everyone who already holds `inventory:transfers:create`. Needs an explicit check during Part 2, not an assumption.
- **Branch data scoping** — a branch-restricted user may only consign/transfer _their own_ branch's stock (already enforced in today's `consignToBranch`); this rule must survive the merge into Stock Transfer, where the equivalent check lives in the approval-chain fields, not in a single-branch guard.
- **Data model changes are additive** — `Branch.isTemporary`/`hostBranchId`/`eventName`/`startDate`/`endDate` are new nullable columns; no existing Branch row's meaning changes. `SerialNumber.consignedToVenue`/`consignedToBranchId` stay in the schema for historical reads (per decision #3), just unwritten by anything new.

## Closing the gaps — proposed parts

### Part 1 — Data model foundation (backend)

- `Branch` gains `isTemporary: Boolean` (default false), `hostBranchId` (self-relation, nullable — the physical branch a caravan is parked at), `eventName`, `startDate`, `endDate`.
- A caravan branch gets its own shadow `Warehouse`, distinct from the host's own — required so it can be a genuine, separate Stock Transfer destination in Part 2, not just a label on the host's existing stock.
- `GET /branches` (and everything built on it) excludes temporary branches whose `endDate` has passed, by default; an explicit "include ended" filter is available for reporting/history use.
- No `PosTerminal` is ever created against a caravan branch (see Decision above) — worth an explicit guard/validation, not just an omission, so it can't accidentally happen later.
- Closes gap 3.

### Part 2 — Fold Consign-to-Caravan into Stock Transfer (backend + frontend)

- `CreateTransferModal` gains a destination mode: an existing Branch, an existing Caravan, or "New Caravan" (inline Host Branch — required — + Event Name + Start/End Date; no venue option).
- Retire `ConsignToBranchModal`, `consign-to-branch.ts`, the `/inventory/serial-numbers/consign` endpoint, `close-consignment.ts`, and `/inventory/serial-numbers/close-consignment`. Receiving, dispatch, and return/move-onward all become the ordinary `StockTransfer` lifecycle (create → dispatch → receive), targeting a caravan's own warehouse from Part 1.
- Because receiving is now the same `transfers.service.ts#receive()` path, **Part 6 (RR-on-receipt) is closed as a side effect of this part**, not built separately.
- Because recall is now an ordinary transfer (any branch → any branch, permission rules apply per Convention above, not a host-only endpoint), **gap 5 (origin can't recall its own stock) closes as a side effect too**.
- Closes gaps 2, 4, 5, 6.

### Part 3 — Caravan lifecycle guardrails (backend + frontend)

- Surface "Ongoing Caravans" wherever branches are managed/listed, with a visible countdown to `endDate`.
- When a caravan's `endDate` has passed and it still holds stock (open transfer lines with this caravan as current destination, not yet transferred onward), surface an alert / required-action list.
- **Open question below**: alert-only, or a hard block on further sales at an ended caravan? The client note ("should always be transferred out") reads as a rule to enforce, not just a suggestion — needs a call before this part starts.
- Closes gap 8.

### Part 4 — Serial movement search fix (frontend only, no dependency on Parts 1-3)

- Item 360 → Stock tab: stop excluding `sold`/`scrapped`/`pulled_out` from serial search. A matched sold serial opens straight into its movement history; it just has no "on shelf" location row to expand into, which is fine — the history view doesn't need one.
- Lowest-risk part in this doc — can ship first, independently, including ahead of Part 1.
- Closes gap 1.

### Part 5 — Caravan sales reporting (frontend, needs Part 1's branch identity to exist)

- Add a "Caravan" breakdown to the Sales Report and Daily Collection views, driven off the existing `caravanOriginBranchId` tag (COGS/quota side) and the new caravan-branch identity from Part 1 (so a report can filter/group "sales while item was out at a caravan" cleanly instead of only via the tag).
- Genuinely new UI; the backend data for the COGS half already exists.
- Closes gap 7.

**Dependency order**: Part 1 → Part 2 → Part 3, sequential. Part 4 is independent and can go anytime. Part 5 needs Part 1 only, not Parts 2-3.

## Open questions

1. **Hard block or alert-only when a caravan's stock isn't transferred out by its end date?** Part 3 is written assuming alert-only (no sales block) unless told otherwise — the client wording ("should always be transferred out") could mean either.
2. **New `BranchType.caravan` enum value, or reuse an existing type (`mixed`) plus the new `isTemporary` flag?** Doesn't change behavior, only how branch-type-based logic elsewhere (icons, filters, permission checks keyed on `BranchType`) needs to treat a caravan — worth deciding at Part 1 implementation time rather than guessing now.
3. **Does "transferred to another Caravan" (last bullet) mean a caravan-to-caravan transfer is a normal Stock Transfer between two temporary-branch warehouses (Part 2 already supports this for free), or does it imply something about the _event_ carrying over (e.g., closing one event and opening a new one on the same stock)?** Assumed the former (no special-casing needed) unless corrected.

## Related ClickUp Tickets

None identified yet — to be matched before implementation.

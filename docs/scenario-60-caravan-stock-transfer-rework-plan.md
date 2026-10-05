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

## Implementation Log — 2026-09-29

**For this scenario, I have done:**

- **Part 1 (gap 3)** — already shipped before this run (backend `ed1c53c`): caravan is a real `Branch` row (`isTemporary`, `hostBranchId`, `eventName`, `startDate`, `endDate`, `BranchType.caravan`) with its own warehouse; ended caravans drop out of `GET /branches`; a caravan can never get a POS terminal. Recorded here since this doc never logged it.
- **Part 4 (gap 1)** — already shipped before this run (frontend `4cf9602a`): sold serials are searchable for their movement history.
- **Part 2a — caravan through Stock Transfer, backend (gaps 4, 5, 6).** A caravan warehouse is an ordinary transfer source and destination. Transfer branch scoping treats a caravan as its host's (`resolveActorBranchIds` in `transfers.service.ts`), so host staff see, dispatch, and **receive into** it — receiving is the normal `receive()` path, so **every receipt issues an RR**. Caravan legs are serial-tracked only, and nothing new can go into a caravan past its end date (stock can always go _out_). The host's POS lists, accepts and costs units in its caravans' warehouses (`resolveHostedCaravanWarehouseIds`). Warehouse and transfer responses carry the caravan's event, dates, location and host.
- **Part 2b — Stock Transfer screen (gap 2).** "This is a consignment" and its "A place / Another branch" toggle removed. A **"For a caravan"** switch (gated on `inventory:caravan:manage`) hides "To" and shows the caravan's details: Host Branch (required, prefilled from the source), Event Name (required), Location (optional, unmarked — stored as the caravan branch's `addressLine1`), Start/End date (required). The caravan is created first (`POST /inventory/caravans` now returns its `warehouseId`), then the transfer into it. "Caravans take serial-tracked items only" shows above the item lines. The error-summary panel was removed from the screen entirely (inline field errors only). Caravans read everywhere as "Caravan · Event — Location (hosted by Host)" via one shared `caravanLabel()` (`src/libs/format/locationLabel.ts`).
- **Part 2c — Serial Numbers screen (gaps 2, 4).** "Consign for Caravan", its modal (with the "One of our branches / Somewhere else" toggle), row selection and the "Return to Origin / Move to" bar removed; `POST /inventory/serial-numbers/consign` deleted. The Caravan tab now lists units sitting in caravan warehouses (`?caravanId=`, `/serial-numbers/caravan-summary`), with an "All caravans" filter, Caravan (event, location, dates, "Ended" badge) and Host branch columns, and a **Transfer out** action that opens New Stock Transfer with the caravan as source.
- **Sold / out-of-stock items can't be transferred (developer request, 2026-09-29)** — applies to every transfer, caravan or not, since both are the same path now. _Request_ (create and edit): refused when the source doesn't have enough free stock — in-stock, unclaimed serial units for serial-tracked items, available quantity otherwise — and a named serial must be in stock at the source. _Dispatch_: a sold, held, scrapped, pulled-out, lost or in-transit unit is refused **even under the supervisor serial override** (the override still corrects a recorded location or condition); a non-serial quantity must be available, so the balance can't go negative (UDS repair legs exempt). The transfer screen's availability note now reads as an error. Six existing transfer specs were requesting items their source never held and now seed source stock; `stock-transfer-serial-request` gained tests for override-can't-ship-sold and both request refusals.
- Backend e2e: `scenario-60-caravan-transfer` 12/12, `scenario-60-caravan-branch` 9/9, `inventory-caravan` 10/10 (cut down to the legacy close-consignment behavior), `pos-caravan-sale` 4/4; `inventory-branch-scoping` and 7 stock-transfer specs re-run green. Frontend: `e2e/scenario-60-caravan-transfer.spec.ts` written; old `stock-transfer-consignment`, `inventory-caravan-view` and `inventory-caravan-consign` specs deleted, one consign test dropped from `inventory-caravan-gap6`.

**Worth flagging:**

- **Decisions (developer, 2026-09-29):** caravan stock sits on the **host branch's books** (the transfer in moves it; sales cost from the caravan warehouse, no `caravanOriginBranchId` tag for new sales); caravans take **serial-tracked items only**; **Location is optional and deliberately not labelled "optional"**.
- **A caravan can only be _created_ as a transfer destination, never picked as an existing one** — reached after several rounds (existing-caravan picker added, removed, re-added, removed). Consequence the client should know: a second delivery to a running event, or "caravan to another caravan", creates a _new_ caravan. Stock at a caravan moves on by choosing it as the source or via Transfer out. The rationale for allowing existing caravans (restocking an event, one caravan per event, caravan-to-caravan) was written up in chat for the client if it comes up.
- **Frontend Playwright never ran.** `npm run test:e2e` cold-starts a backend that resets `the-prominent-enterprise-test`, which Prisma's AI-agent gate blocks. Verification is backend e2e + developer manual testing.
- **Legacy consignments:** none exist locally; production is unchecked. `close-consignment` is kept backend-only for them — there is no UI to bring a legacy unit home.
- **Pre-existing, not this scenario:** `stock-transfer-hq-approval` has 1 failing test (Branch Manager gets 200 on approve-HQ — a pure permission-grant question); `inventory-caravan-gap6`'s "ST #"/"RR #" column-header test may be stale against the current list headers.
- **Commit hygiene:** backend `4923a80` and frontend `580917cb` hold Part 2b and part of 2c but carry the message "refactor(inventory): unify serial history…". Worth rewording before the PR.
- **Still open — Part 3 (gap 8):** end-of-caravan enforcement ("items in the caravan should always be transferred out if the caravan has ended"); the alert-vs-hard-block question is unanswered. The Caravan tab's "Ended" badge is the only signal today.
- **Still open — Part 5 (gap 7):** separate sales reporting for branches with an ongoing caravan (client note, 2026-09-29).

## Implementation Log — 2026-09-29 (second run: plan Parts 3 and 5)

Built in four confirmed parts (this run's own numbering), each manually tested before the next.

**For this scenario, I have done:**

- **Gap 8 / plan Part 3a — an ended caravan stops selling.** The host's POS no longer offers or accepts a unit sitting in a caravan whose end date has passed; checkout refuses it with "…is at caravan "X", which has ended — transfer it out before selling it." Only the POS pickers ask for this (`forSale=true` on `GET /inventory/serial-numbers`), so Stock Balance, Item 360 and the Caravan tab still show the units staff have to move. "Ended" means the day after the end date — the rule transfers already used — so a caravan still sells on its last day. Transfers out of an ended caravan stay allowed. Backend: `WarehousesService.listHostedCaravanWarehouses` / `isCaravanEnded`.
- **Gap 8 / plan Part 3b — ended-caravan alerts.** New `GET /inventory/caravans/alerts`: running caravans with their end dates, and ended ones still holding units (in stock or held); an emptied ended caravan drops off. Readable with `inventory:transfers:create` **or** `pos:transactions:create` (so the host's cashier gets it too); branch-scoped to the caravans the caller's branch hosts, Business Owner unrestricted with an optional `hostBranchId`. Surfaced as: an amber banner on Serial Numbers (All Serials) and Stock Transfers, a countdown card strip on the Caravan tab (click filters to that caravan), and a notice on the host's POS checkout. `?caravan=<id>` on Serial Numbers opens the Caravan tab on that caravan.
- **Gap 7 / plan Part 5a — caravan sales recorded and split in Sales by Branch.** New nullable `PosTransactionLine.caravanBranchId` (migration `20260929130000_scenario_60_caravan_sale_line`, with backfill from the stock ledger, then the sold unit's warehouse, then refunds from their sale). Checkout tags each line with the caravan its unit came out of — outside the COGS loop so a costing failure can't drop the tag; a refund copies the tag from the original sale's line. Sales by Branch reports those lines under "<host> — Caravan · <event>", their own rows next to the host's; the .xlsx Detail sheet gains a trailing **Caravan** column.
- **Gap 7 / plan Part 5b — Daily Collection caravan section.** The cash ledger and every total are unchanged (a caravan's money is the host's collection). Added: a "Caravan sales (included above)" block per caravan (units, amount) on the screen, the printed form and the workbook's Summary sheet; a caravan tag on each ledger row whose sale included caravan units; a trailing **Caravan** column on the workbook's Ledger sheet.
- Backend e2e: `scenario-60-caravan-transfer` 18/18 (6 new), new `scenario-60-caravan-sales` 5/5, `scenario-60-caravan-branch` 14/14, `pos-caravan-sale` 4/4, `sales-reports` 18/18; unit suites under `src/pos`, `src/inventory`, `src/common/export` 525/525.

**Worth flagging:**

- **Decisions (developer, 2026-09-29):** an ended caravan with stock is **alert + stop POS sales** (not alert-only, not a full freeze); alerts go to anyone who can create transfers, plus the host's POS; caravan sales are **recorded on the sale** (new column) rather than derived at report time; the split goes into **Sales by Branch and Daily Collection** (no separate caravan report).
- **Plan drift:** Part 5 was written to report off `caravanOriginBranchId`, but since Part 2 caravan stock sits on the host's books and new sales no longer set that tag. Weighted-average items (the default, and every seeded one) also never write a stock-ledger row, so the ledger alone couldn't identify caravan sales — hence the new column, backfilled mostly from the sold unit's warehouse.
- **Backfill limit:** a caravan unit that was sold, refunded and has since moved elsewhere can't be traced back by the backfill (its warehouse no longer points at the caravan, and weighted-average sales have no ledger row). Sales made after the migration are always tagged.
- **Migration** `20260929130000_scenario_60_caravan_sale_line` was applied to the local test DB only; it needs `prisma migrate deploy` on dev and every other environment. The test DB was also missing `20260929120000_scenario_60_transfer_dispatched_at`, applied at the same time.
- **Service jobs** use the same POS serial lookup, so they also stop offering an ended caravan's units — consistent (a service job consumes the unit), but not separately asked for.
- **Frontend Playwright still never ran** (Prisma's AI-agent gate on the test-DB reset). No new Playwright specs this run; the screens read endpoints the backend e2e covers.
- **Pre-existing, not this scenario:** `closing-session-record`'s S53P6-01 fails with or without this run's changes (it still looks for non-cash rows in `rows`, which Scenario 53 later moved to their own block); `pos-cross-branch-serial-visibility` has 4 failures from Cashier's deliberate lack of `inventory:transfers:create` on `request-from-pos`. `transactions.service.spec.ts` needed its POS-inventory and transaction mocks extended for this run's code.
- **Also this session, reverted:** picking exact serials on a transfer request (`e0a11da3`) was built and then reverted by the developer (`5c1b03b4`), so transfer requests stay count-only; the backend edit/serial-recheck work from that attempt is not in the branch either.
- **Still to confirm with the client:** existing caravans still can't be picked as a transfer destination (a second delivery to a running event creates a new caravan).

## Implementation Log — 2026-09-30 (caravan registers)

Reverses the Part 1 decision that a caravan never gets a POS terminal. Driven by manual testing: a caravan at Lemery hosted by Ajuy needed to be findable in POS, sell only the stock physically at Lemery, and still have its cash land on Ajuy.

**For this scenario, I have done:**

- **A caravan has its own register.** New nullable `PosTerminal.caravanBranchId` (migration `20260930120000_scenario_60_caravan_terminal`). A terminal set up for a caravan is stored with `branchId` = the **host** and the caravan linked, so the ~100 places that read a sale's branch from its terminal (sales, sessions, daily collection, GL, refunds) still land on the host with no caravan-aware code. `TerminalsService.resolvePlacement` does the mapping on create and edit; the old "a caravan cannot have its own POS terminal" guard is gone.
- **Staff set up a caravan's register themselves** — in POS Settings → Terminals, picking the caravan as the branch. It is not created with the caravan (auto-creation was built, then removed at the developer's request). Changing a caravan's host moves its terminals with it, and is refused while one of them has an open session.
- **A caravan's units sell only on its own register.** Checkout validation: a caravan terminal accepts only its caravan's units; the host's own terminals refuse a caravan unit with "…is at caravan "X" — sell it from that caravan's terminal." `forSale=true` serial lookups and the POS catalog stock count no longer add hosted caravans to the host; a caravan's terminal asks for the caravan itself (`stockBranchId` in checkout) and gets its warehouse only — empty once the caravan has ended. Prices, payment methods, financing terms and the daily collection stay on the host. Stock views (Stock Balance, Serial Numbers) still count caravan units under the host.
- **Branch-assigned callers may ask for a caravan their branch hosts** (`resolveStockBranchId`, `src/common/caravan-scope.util.ts`) — the catalog and serial lookups otherwise force the caller's own branch.
- **POS lists filter by terminal branch _or_ caravan** (`terminalInBranch`, `src/pos/terminal-branch.ts`): sessions, transactions, parked sales, release/refund/cancellation approvals, voids, missing-COGS, POS customer history. Filtering by a real branch returns what it did before (caravan terminals included); filtering by a caravan returns its registers. Daily collection, cash-in-transit and accounting stay host-only on purpose.
- **Caravans read by place in POS.** Branch pickers (POS and dashboard switchers, terminal/pricing/financing/collections pickers, sales-report filter) show a caravan as "Caravan · <location>" (`branchDisplayName` / `caravanPlaceLabel`), falling back to the event when no location was given; the shared branch store refreshes its saved name on load. Checkout's session picker labels a caravan register "Caravan · Lemery · <code>", and "Also available elsewhere" groups caravan units under the same label. Terminal settings list a caravan terminal as "Caravan · <location>".
- POS top bar: the right-hand group now sits on white like the nav.
- **Owner and Branch Manager can file the Daily Collection (for now).** An unfiled branch's report is no longer withheld from the owner, so they can open it and file it (`WITHHOLD_UNFILED_FROM_OWNER = false` in `daily-collection.service.ts` — flip back to restore "the branch files, the owner reviews"). Branch Manager already could: its `pos:*:*` wildcard covers `pos:daily-collection:read/update`. Cashier keeps both permissions.
- Backend e2e: `scenario-60-caravan-branch` 14/14, `scenario-60-caravan-sales` 7/7 (2 new: host terminal refuses a caravan unit, caravan terminal refuses a host unit), `scenario-60-caravan-transfer` 18/18, `pos-caravan-sale` 4/4; unit suites under `src/pos`, `src/inventory` 492/492.

**Worth flagging:**

- **Decisions (developer, 2026-09-30):** caravans get their own terminal, **set up manually by staff** (not auto-created); a caravan's stock sells **only** at the caravan's terminal, never the host's; the caravan stays in branch pickers, labelled by its location.
- **A caravan without a register can't sell.** Until someone creates its terminal, its units sit unsold (they show under "Also available elsewhere" at the host). The ended/running caravan alerts don't warn about a missing register.
- **Cashiers can't reach Terminals yet.** The Cashier role holds `pos:terminals:manage`, but the POS Settings layout only admits admins, Branch Managers and `pos-manager` (`canManagePosSettings`) — so today a Branch Manager or the owner sets up the caravan's register.
- **Plan drift:** Part 1's "no POS terminal for a caravan" and Part 2a's "the host's POS sells its caravans' units" are both superseded by this run.
- **Two terminals both named "Counter 1"** exist on Ajuy in dev data (one is the caravan's) — worth renaming to avoid mix-ups at checkout.
- **Cashier terminal assignments:** a cashier restricted to specific terminals (POS-52) must be assigned the caravan's terminal before they can open a session on it.
- **Stock requests from a caravan register** still go to the host, not the caravan (existing caravans can't be a transfer destination — see the open question above).
- **Migration** `20260930120000_…caravan_terminal` is applied to the local dev and test DBs only. (A backfill migration that gave existing caravans a terminal was applied and then rolled back — folder, `_prisma_migrations` row and its one dev terminal removed.)
- **Tests were run with jest directly**, not `pnpm test:e2e` — its pre-step resets the test DB, which Prisma blocks for AI agents without consent.

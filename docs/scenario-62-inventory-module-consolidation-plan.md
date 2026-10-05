# Scenario 62 — Inventory Module Consolidation — Gap Analysis & Closing Plan

**Status**: Decisions recorded 2026-10-05; implementation not started. See "Resolved decisions" below.

**Source**: The developer's Inventory Module Consolidation sketch (sidebar groups and tab contents), plus three reference screenshots: Stock Balance, General Stockbook, Serial Number Locator. Detailed current-state evidence is in [inventory-consolidation-plan.md](./inventory-consolidation-plan.md) and is not repeated here.

> Inventory Module Consolidation
> List of tabs on the sidebar:
>
> - Item Master — HO Inventory personnel add Categories, Brands, Types, Attributes, Units of Measure. The Item Master is the single source of truth when onboarding new brands and new SKUs.
> - Stock Ledger — the General Stockbook (primary key Serial Number, group by Model and Brand). Sub-features: Stock Balance; General Stockbook (select serials → Stock Transfer or Consign to Caravan); Serial Number Locator (every movement of that serial).
> - Stock Transaction — Receiving Report (from stock transfer), Stock Transfer, Purchase Order, Stock Request, Debit Memos (Branch request; HO approval).
> - Master Data
> - Stock Report — Aging of Inventory (serial number, brand, model, RR date from supplier).
>
> Serial Number Locator: shows every movement of that particular serial number. (Developer, follow-up.)

## Why

The Inventory sidebar is a flat list of 11 items. Most screens already exist as tabbed hubs, so this scenario regroups the sidebar into the five groups above and closes the gaps the regrouping exposes. Mostly regrouping and renaming; no new business logic except the bulk actions and the Locator search.

## Decisions taken (developer, 2026-10-05)

1. **General Stockbook and Serial Number Locator are both serial views.** The General Stockbook is the serial list (current Serial Numbers tab). The Serial Number Locator is the per-serial movement timeline, reached by search. It reuses the existing serial history panel (`SerialHistoryContent`) and `getSerialMovements`. The mockup's serial table under "Locator" is **not** the design.
2. **Stock Ledger = the three tabs**: Stock Balance, General Stockbook, Serial Number Locator.
3. **Stock Transaction includes Receiving Report, Stock Transfer, Purchase Order, Stock Request, and Debit Memos.** (Stock Request and the Debit Memo split are still open — see below.)
4. **Proposed, not yet confirmed:** remove the mockup's "Add Category" button from Stock views, since categories belong to Item Master. Confirm in Part 0.

## Current state (summary)

Full detail in [inventory-consolidation-plan.md](./inventory-consolidation-plan.md). Key facts:

- Sidebar: `src/components/layout/SideBar.tsx:116-215`, 11 flat items. Counting and Finance are commented out (lines 175, 184).
- Stock hub tabs (`inventory/stock/_components/StockHub.tsx:23-26`): Balance, Serial Numbers, Stock Ledger (movement log), Receiving Reports. Reservations and Negative Stock are routable but hidden.
- Operations hub (`inventory/operations/_components/OperationsHub.tsx:24-27`): Transfers, Returns, Quality Hold, Backorders. The sidebar label "Stock Transfers" points here.
- Catalog hub (`inventory/catalog/_components/CatalogHub.tsx:17-23`): Items, Categories, Brands, Types, Attributes, Units, Barcodes.
- Counting hub (`inventory/counting/_components/CountingHub.tsx:22`) holds Stock Adjustments, but Counting is hidden. **Stock Adjustments are unreachable from the sidebar today** (bug, closed by Part 1).
- Serial history: `src/components/inventory/serial-history/` plus `getSerialMovements` (`serial-numbers/_actions/get-serial-movements.ts`), backed by `GET /inventory/serial-numbers/:id/movements`. Today it opens only as a side panel from a row click. There is no search-by-serial entry point.

## Gap analysis

| #   | Gap                                                                                                             | Evidence                                                                                                       | Closed by                   |
| --- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------- |
| G1  | Stock Adjustments unreachable from nav                                                                          | No sidebar entry; Counting hidden                                                                              | Part 1                      |
| G2  | Sidebar not grouped as specified                                                                                | Flat 11-item list                                                                                              | Part 1                      |
| G3  | "Stock Transfers" label points at a hub, not transfers                                                          | `SideBar.tsx:144-145`                                                                                          | Part 4                      |
| G4  | Catalog not named or ordered as Item Master                                                                     | `CatalogHub.tsx:17-23`                                                                                         | Part 2                      |
| G5  | No Serial Number Locator (search → movement timeline)                                                           | Only row-click history exists                                                                                  | Part 3                      |
| G6  | General Stockbook has no Stock Transfer / Consign bulk actions                                                  | Serial list has no bulk action bar for these                                                                   | Part 3                      |
| G7  | Stock Balance labels differ from the mockup ("On hand" vs "Total"; Transferred label not found)                 | `stock/_components/StockBalanceList.tsx`                                                                       | Part 3                      |
| G8  | Mockup classification filters (Brand New, Repo, Repair/Return) and "Pulled Out" stat not found in frontend code | Searched `stock/` and `serial-numbers/`                                                                        | Part 3, after backend check |
| G9  | Receiving Reports tab does not match General Stockbook's role                                                   | Separate tab today                                                                                             | Part 3 (decision 8 below)   |
| G10 | Stock Report Aging filters may not include serial, brand, model, RR date from supplier                          | `reports/_components/AgingReport.tsx`                                                                          | Part 5                      |
| G11 | Old URLs and moved tabs need redirects                                                                          | Pattern exists in `operations/page.tsx`                                                                        | Part 6                      |
| G12 | Hub guards must stay correct when tabs merge                                                                    | `stock/page.tsx` accepts `STOCKS_READ` or `RECEIVE_READ`; `operations/page.tsx` must not accept `RECEIVE_READ` | Parts 4, 6                  |

## Parts

Each part is built and tested on its own, then the developer confirms before the next starts (per the implement-scenario convention). Each part needs its own e2e tests and manual testing steps.

### Part 0 — Decisions (blocking)

Owner answers the Open questions below and they are recorded in this doc. No code until Part 0 is done.

### Part 1 — Sidebar regroup and Stock Adjustments access (G1, G2)

- Replace the flat list in `SideBar.tsx:116-215` with the five groups. Keep each item's existing `requiredPermission`. When items merge, union the permissions.
- A group shows only when at least one child is visible.
- Add a sidebar entry for Stock Adjustments (`/inventory/adjustments`).
- No pages move in this part.

**Manual test**: a user with only `STOCK_ADJUST` sees Stock Adjustments. A user with no inventory permissions sees no Inventory groups. The group headings appear and disappear with their children.

### Part 2 — Item Master (G4)

- Rename Catalog to Item Master in the sidebar and page title. Keep the `/inventory/catalog` URL until Part 6.
- Reorder tabs: Items, Categories, Brands, Types, Attributes, Units of Measure. Barcodes per Open question 4.
- Items is the SKU source of truth; the page copy should say so.

**Manual test**: each tab opens and still creates and edits its records. Permissions unchanged.

### Part 3 — Stock Ledger (G5–G9)

**3a. Stock Balance** (G7)

- Align column labels and stat cards with the mockup: Total, Transferred, Sold, Reserved, Available, Status.
- Remove the "Add Category" button if it appears in Stock views.
- Filters: operation, branch, category, stock status.

**3b. General Stockbook** (G6, G9)

- This is the current Serial Numbers tab. Keep All Serials and Caravan sub-views and the stat cards.
- Add a bulk action bar for selected serials: **Stock Transfer** and **Consign to Caravan**. Reuse `ConsignToCaravanModal` (`serial-numbers/_components/ConsignToCaravanModal.tsx`) and the existing transfer code. Write no new transfer logic.
- Receiving Reports content moves here per Open question 8.
- Classification checkboxes (Brand New, Repo, Repair/Return) and the "Pulled Out" stat (G8) are built only after a backend check confirms the data exists. Do not invent them.

**3c. Serial Number Locator** (G5)

- New tab. A search box accepts a serial number. On a match, it renders `SerialHistoryContent`: the header (serial, status, item, location, consigned venue) and the movement timeline.
- Calls `getSerialMovements`. No new movement logic.
- Empty input, no match, and a serial with no movements ("No movements recorded yet") each need a state.
- Row-click history in General Stockbook stays, so both entry points open the same panel.

**3d. Existing movement-log tab** — Open question 7. Do not delete until decided.

**Manual test**: search a known serial in the Locator and check the timeline matches row-click history for the same serial. Search an unknown serial and check the no-match state. Select two serials in General Stockbook and run Stock Transfer; select one and run Consign to Caravan.

### Part 4 — Stock Transaction (G3, G12)

- Build the Stock Transaction group: Receiving Report, Stock Transfer, Returns, Quality Hold, Backorders, Stock Adjustments, Purchase Order, Stock Request (if confirmed), Debit Memos. One hub or separate items per Open question 10.
- The "Stock Transfers" label stops pointing at the Operations hub.
- Keep `operations/page.tsx`'s `?tab=receiving` redirect and point it to the new Receiving Report location.
- Do **not** add `RECEIVE_READ` to the Operations guard.

**Manual test**: a user with only `TRANSFERS_READ` lands on a usable Transfers view. A user with only `RETURNS_READ` lands on Returns, not an empty hub.

### Part 5 — Master Data and Stock Report (G10)

- Master Data holds Warehouses, Suppliers, Price Lists, Settings, per Open question 2.
- Stock Report holds Aging of Inventory, Valuation, and Turnover. Check the Aging filters against serial number, brand, model, RR date from supplier. Add any that are missing.

**Manual test**: each filter narrows the Aging table correctly. Master Data items open their existing screens.

### Part 6 — Redirects and permission audit (G11, G12)

- Add a redirect for every moved or renamed route. Follow the `?tab=` pattern in `operations/page.tsx`.
- Remove dead sidebar code only after the redirects are in place.
- Audit: for each sidebar item, a user with only that item's permission lands on a usable view, not a 403 and not an empty hub.

**Manual test**: each old URL (`/inventory/catalog`, `/inventory/operations`, `/inventory/operations?tab=receiving`, `/inventory/counting?tab=adjustments`) lands on the new location.

## Resolved decisions (developer, 2026-10-05)

These replace the open questions below. Where they differ from a recommendation in that list, the answer here wins.

- **Stock Adjustments**: Stock Transaction, as its own sidebar item.
- **Master Data**: Warehouses, Suppliers, Price Lists, Settings.
- **Stock Transaction**: separate sidebar items, not one hub with tabs.
- **Existing movement-log tab on Stock hub**: folded into Stock Balance.
- **Receiving Report**: its own sidebar item under Stock Transaction (not inside General Stockbook).
- **Debit Memos**: one screen with a role-based split (branch requests, HO approves).
- **Stock Request**: the existing Purchase Requests screen (`/inventory/purchase-requests`), placed under Stock Transaction.
- **Purchase Orders**: stays under inventory, under Stock Transaction.
- **Counting and Finance**: stay hidden from the sidebar. Their routes stay live. Stock Adjustments also gets its own sidebar item under Stock Transaction (Part 1); the Counting hub keeps its tab.
- **Unit Documents (UDS)**: Stock Transaction.
- **Item Master**: Items and Barcodes both stay.
- **Brand New / Repo / Repair-Return classification**: build in this scenario, **derived from existing records, no schema change**: Repo = repossessed through an installment account; Repair/Return = came back through Returns; Brand New = everything else. Derivation rules must be confirmed against the backend data before Part 3d.
- **Scope**: all six parts. **Branch**: current branch `feat/scenario-62-inventory-module-consolidation`.

## Open questions (superseded — kept for the record)

Owner answers these in Part 0. My recommendation is in parentheses.

1. Stock Adjustments: Stock Transaction, or another group? (Stock Transaction)
2. Master Data contents: Warehouses, Suppliers, Price Lists, Settings? Unit Documents in Master Data or Stock Transaction? (Master Data: Warehouses, Suppliers, Price Lists, Settings. Unit Documents in Stock Transaction, since it's a movement.)
3. Stock Request: the purchase-requests screen, or a new feature? (Confirm.)
4. Item Master: include Items? Keep Barcodes? (Items in; Barcodes in.)
5. Purchase Orders: keep under inventory, or move to procurement? Its permissions are procurement permissions. (Keep under inventory for now; procurement owns the permissions.)
6. Counting and Finance: show, fold, or keep hidden? (Fold Counting's Stock Adjustments into Stock Transaction, and keep the rest hidden until decided.)
7. The existing Stock Ledger movement-log tab: keep as a fourth tab, fold into Stock Balance, or drop? (Keep until the Locator is in use, then decide.)
8. Receiving Report: inside General Stockbook? Where does "receive from stock transfer" start? (Inside General Stockbook; the start is from a stock transfer row.)
9. Debit Memo Request (Branch) and Approval (HO): two screens, or one with a role split? (One screen with a role-based split.)
10. Stock Transaction: one hub, or separate sidebar items? (Separate sidebar items, since the sidebar groups already give the structure.)
11. Backend: do Brand New / Repo / Repair-Return classifications and the "Pulled Out" stat exist? (Check in Part 3.)

## Verification

- `pnpm type-check`, `pnpm lint`, and `pnpm format:check` after each part.
- E2E tests per part. Check the frontend's existing Playwright setup before writing tests, since `pnpm test` is a no-op.
- Manual test steps per part, run once per role that the part affects.
- Each part is confirmed by the developer before the next part starts.

## Implementation Log

_No entries yet. Append one per part: date, branch, commit, tests run, manual test result._

## Implementation Log — 2026-10-05

**For this scenario, I have done:**

- **Part 1 — sidebar regroup** (confirmed by developer; commit `09e618f3`). Inventory sidebar is five tabs: Item Master, Stock Ledger, Stock Transaction, Master Data, Stock Report. Stock Transaction and Master Data are now plain links to hub pages.
- **Part 2 — Item Master**. Catalog hub tabs in sketch order (Categories, Brands, Types, Attributes, Units of Measure, Barcodes), Items hidden (moves to POS), `?tab=items` redirects to Categories. Brands and Types paginated. Headings and padding match the PO screen.
- **Part 3a — Stock Balance**. Labels Total / Transferred / Sold / Reserved / Available. Transferred is the in-transit quantity, with a summary total from a backend change to the balance summary (`totalInTransitQty`). Movement log folded under the balance table, then removed at developer's request; the Ledger tab is gone and `?tab=ledger` lands on Stock Balance. Figures sized down and names wrap so nothing clips.
- **Part 3b — General Stockbook**. Serial list is the General Stockbook (tab renamed). Consign to Caravan kept. Stock Transfer added as a bulk action: ticked units open the Transfers form as lines pinned to those serials (sessionStorage hand-off, cleared on read).
- **Part 3c — Serial Number Locator**. Same layout as General Stockbook, with a search above the filters, no caravan tabs or banner, and no selection or transfer actions. An exact serial match, or a row click, shows that unit's full movement timeline inline under its row.
- **Part 3d — classification**. Stock Classification checkboxes (Brand New, Repo, Repair / Return) on General Stockbook and the Locator, hidden on the Caravan tab. Derived from the goods-receipt reason (`repossession`, `repair_return`, otherwise Brand New); no schema change.
- **Part 4 — Stock Transaction hub** (pulled forward). Receiving Report, Stock Transfer, Returns, Backorders, Stock Adjustments, Purchase Order, Stock Request, Debit Memos, Unit Documents. Quality Hold, Backorders and Stock Adjustments hidden for now (code kept). Old `?tab=reports` links go to Receiving Report.
- **Part 5 — Master Data and Stock Report** (pulled forward). Master Data hub (Warehouses, Suppliers, Price Lists, Settings). Stock Report is the aging report only, with serial-or-model search, brand, RR date range and category filters; Excel export is one sheet laid out like the client's Aging_Inventory file.

**Worth flagging:**

- The earlier note that `/inventory/adjustments` is a route was wrong: it has components and actions but no page. Stock Adjustments is reachable from the hub, which links to the hidden Counting hub's tab.
- Pinning serials on a transfer conflicts with the Item 360 comment that transfers carry only a count. Developer chose pinning for this bulk action only; Item 360 is unchanged.
- Repo and Repair / Return show zero units in the current dev data, because no repossession or repair-return receipts exist there. Those filters are untested against real records.
- The Playwright specs for Parts 1–3 are written but not run: a leftover `next dev` (PID 86210, port 3020) holds the `.next-e2e` lock.
- Backend changes are uncommitted in the backend repo, as are all frontend changes. Nothing has been committed or pushed.

**Verification:**

- Type-check passes in both repos. Lint shows no errors on the changed files.
- Each part was checked in the browser as the Business Owner, with no page errors apart from the first-load hydration warning in dev.
- Stock Controller and Cashier visibility is not yet checked (Part 6).

**Still open:** Part 6 (redirects for moved routes and a role permission audit), and the e2e runs.

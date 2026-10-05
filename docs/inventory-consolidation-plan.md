# Inventory Module Consolidation — Plan

Written for: an engineer or AI agent implementing this with no other context. It states the current state with file references, the target sidebar, and ordered phases. Read the whole doc before editing. Several phases depend on each other, and some pages have guard logic that must be kept, not cleaned up.

Decisions marked **OPEN** are not settled. Do not implement them until the owner answers.

---

## Why

The Inventory sidebar is a flat list of 11 items. Most screens already exist as tabbed hubs, so the goal is to regroup the sidebar into five groups that match how the warehouse works, and to fix the gaps the regrouping exposes. This is mostly regrouping and renaming, not new features.

Target sidebar groups (from the owner's sketch):

1. **Item Master**
2. **Stock Ledger**
3. **Stock Transaction**
4. **Master Data**
5. **Stock Report**

---

## Current state (verified against code)

### Sidebar — Inventory segment

`src/components/layout/SideBar.tsx:116-215`, object `navItemsBySegment.inventory.main`:

| Label           | href                         | requiredPermission                                                                      |
| --------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| Stock           | `/inventory/stock`           | `STOCKS_READ`                                                                           |
| Catalog         | `/inventory/catalog`         | `ITEMS_READ`                                                                            |
| Price Lists     | `/inventory/price-lists`     | `PRICE_LISTS_READ`                                                                      |
| Purchase Orders | `/inventory/purchase-orders` | `PO_READ` or `PR_READ` (procurement perms)                                              |
| Stock Transfers | `/inventory/operations`      | any of 9 perms (transfers, receive, returns, quality hold, backorders, stock adjust ×4) |
| Debit Memos     | `/inventory/debit-memos`     | `SUPPLIER_RETURNS_READ`                                                                 |
| Suppliers       | `/inventory/suppliers`       | `SUPPLIERS_READ` (procurement perm)                                                     |
| Counting        | _commented out_ (line 175)   | `STOCK_COUNT_READ`                                                                      |
| Finance         | _commented out_ (line 184)   | `COSTING_READ`                                                                          |
| Warehouses      | `/inventory/warehouses`      | `WAREHOUSES_READ`                                                                       |
| Unit Documents  | `/inventory/uds`             | `UDS_READ`                                                                              |
| Reports         | `/inventory/reports`         | `REPORTS_VALUATION`                                                                     |
| Settings        | `/inventory/settings`        | none                                                                                    |

The sidebar label "Stock Transfers" points at `/inventory/operations`, which is a hub, not the transfers screen.

### Hubs and their tabs

| Hub        | File                                                       | Tabs                                                                                                                                                                             |
| ---------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stock      | `inventory/stock/_components/StockHub.tsx:23-26`           | `balance` (Balance), `serials` (Serial Numbers), `ledger` (Stock Ledger), `reports` (Receiving Reports). Hidden but routable: `reservations`, `negative` (`StockHub.tsx:19-21`). |
| Operations | `inventory/operations/_components/OperationsHub.tsx:24-27` | `transfers`, `returns`, `quality`, `backorders`. `?tab=receiving` redirects to `/inventory/stock?tab=reports` (`operations/page.tsx`).                                           |
| Catalog    | `inventory/catalog/_components/CatalogHub.tsx:17-23`       | `items`, `categories`, `brands`, `types`, `attributes`, `units`, `barcodes`                                                                                                      |
| Counting   | `inventory/counting/_components/CountingHub.tsx:22`        | includes `adjustments` (Stock Adjustments, renders `adjustments/_components/AdjustmentList`), plus mobile count, batches, serials. **Hidden from the sidebar.**                  |

### Known bug this plan fixes

**Stock Adjustments are unreachable from the sidebar.** The only entry is the Counting hub, and Counting is commented out of the sidebar. No link anywhere points to `/inventory/adjustments` (the route exists, `inventory/adjustments/`). Phase 1 fixes this.

### Serial views

- **Serial Numbers tab** (`inventory/serial-numbers/_components/SerialNumberList.tsx`): the serial list. Has All Serials and Caravan sub-views. Row click opens the unit's history. Consign to Caravan is here (`ConsignToCaravanModal.tsx`, `useConsignToCaravan.ts`).
- **Serial history panel** (`src/components/inventory/serial-history/SerialHistoryContent.tsx`, `SerialLink.tsx`, `useSerialHistory.ts`): a side panel. Header shows serial number, status, item (sku, name), current location, consigned venue. Body is a timeline of movements, each with type, occurredAt, label, description, referenceCode, customerName, invoiceNumber. Empty state: "No movements recorded yet."
- Data: `getSerialMovements(serialId)` (`serial-numbers/_actions/get-serial-movements.ts`) calls `GET /inventory/serial-numbers/:id/movements`. Schema: `src/schema/inventory/serial-numbers/index.ts:282-310`.

Note: today the history is a side panel reached only by clicking a row. There is no search-by-serial entry point.

### Page guards

- `stock/page.tsx`: `canAny(STOCKS_READ, RECEIVE_READ)`. `RECEIVE_READ` was added when Receiving moved into Stock. Do not remove it.
- `operations/page.tsx`: `canAny(TRANSFERS_READ, RETURNS_READ, QUALITY_HOLD_READ, BACKORDERS_READ)`. `RECEIVE_READ` was deliberately removed. Do not add it back.
- `catalog/page.tsx`: `can(ITEMS_READ)`.
- `reports/page.tsx`, `serial-numbers/page.tsx`, `debit-memos/page.tsx`: each has a `can`/`canAny` guard. Keep each one.

---

## Target state

### Sidebar — Inventory segment (proposed)

| Group                 | Children                                                                                                                                                                                                                                         | Source                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **Item Master**       | Items, Categories, Brands, Types, Attributes, Units of Measure, _Barcodes_ (**OPEN**)                                                                                                                                                            | Catalog hub, renamed                                                    |
| **Stock Ledger**      | Stock Balance, General Stockbook, Serial Number Locator                                                                                                                                                                                          | Stock hub tabs (see Phase 3)                                            |
| **Stock Transaction** | Receiving Report (**OPEN**: is this inside General Stockbook?), Stock Transfer, Returns, Quality Hold, Backorders, Stock Adjustments, Purchase Order, Stock Request (**OPEN**), Debit Memo Request – Branch, Debit Memo Approval – HO (**OPEN**) | Operations hub + Purchase Orders + Debit Memos + Counting's adjustments |
| **Master Data**       | Warehouses, Suppliers, Price Lists, Settings (**OPEN**: which of these, and whether Unit Documents goes here or in Stock Transaction)                                                                                                            | Existing routes                                                         |
| **Stock Report**      | Aging of Inventory, Valuation, Turnover                                                                                                                                                                                                          | Reports hub (`inventory/reports`)                                       |

Rules for the sidebar:

- Keep each item's existing `requiredPermission` value, and union them when items merge.
- Show a group only when at least one child is visible to the user.
- Do not remove a permission check to make a group appear.

### Hidden routes (**OPEN**)

Counting, Finance, Reservations, Negative Stock, Revaluation, Landed Cost, Projection, Procurement Quotas, Purchase Requests, Costing. The owner must decide for each: show, fold into a group, or keep hidden. Do not delete any route.

---

## Phases

Each phase leaves the app working. Run `pnpm type-check`, `pnpm lint`, and a manual walkthrough per affected role after each phase.

### Phase 0 — Decisions (blocking)

Owner answers the **OPEN** items above. Record each answer in this doc before Phase 2.

### Phase 1 — Sidebar regroup, no route moves

- Replace the flat list in `SideBar.tsx:116-215` with the five groups. Keep each item's existing `requiredPermission`.
- Restore a sidebar entry for Stock Adjustments (fixes the bug above).
- No pages move in this phase. Low risk.

### Phase 2 — Item Master

- Rename the Catalog hub to Item Master in the sidebar and page title. Keep the `/inventory/catalog` URL until Phase 6 adds the redirect.
- Reorder tabs to match the owner's sketch. Apply Phase 0 decisions for Items and Barcodes.

### Phase 3 — Stock Ledger (Stock hub)

Three tabs on the Stock hub: **Stock Balance**, **General Stockbook**, **Serial Number Locator**.

**3a. Stock Balance** (`balance` tab, `StockBalanceList`)

- Stat cards and filters should match the owner's mockup. Confirm each column against the mockup before calling this done: Total, Transferred, Sold, Reserved, Available, Status. The code currently labels the first one "On hand".
- Do **not** add a category-creation button here. Categories belong in Item Master.

**3b. General Stockbook** (`serials` tab, `SerialNumberList`)

- This is the serial list. Keep its All Serials and Caravan sub-views and its stat cards.
- Add a bulk action bar for selected serials: **Stock Transfer** and **Consign to Caravan**. Reuse `ConsignToCaravanModal` and the existing transfer code. Do not write new transfer logic.
- Retire the separate Receiving Reports tab from the sidebar. Its content moves here (**OPEN**: confirm this, and confirm where "receive from stock transfer" starts).
- Mockup checkboxes for Brand New / Repo / Repair-Return and the "Pulled Out" stat did not match any code in the stock or serial-numbers folders. Check the backend before building them. Do not invent them.

**3c. Serial Number Locator** (new tab, replaces the `ledger` tab's role for serials)

- Shows a search box for a serial number. On a match, it renders the existing serial history panel: header (serial, status, item, location, consigned venue) and the movement timeline.
- Reuse `SerialHistoryContent` and `getSerialMovements`. Do not write new movement logic.
- Empty search and no-match states need copy. Use the existing "No movements recorded yet" text for a serial with no movements.
- Keep the row-click history in General Stockbook, so both entry points reach the same panel.
- The owner's mockup table is **not** the design. The Locator is a per-serial timeline.

**3d. Existing `ledger` tab (movement log)** (**OPEN**)

- Today the Stock hub has a "Stock Ledger" tab (`StockLedgerTab`). It is a whole-stock movement log. The per-serial timeline in 3c covers serial movements only.
- Decide: keep it as a fourth tab, fold it into Stock Balance, or drop it. Do not delete it until decided.

### Phase 4 — Stock Transaction

- Merge the Operations hub (transfers, returns, quality hold, backorders) with the Stock Adjustments tab from Counting into one hub, or into separate sidebar items under Stock Transaction (**OPEN**: one hub or separate items).
- Keep `operations/page.tsx`'s `?tab=receiving` redirect. Point it at the new location.
- Purchase Order and Debit Memos move under this group in the sidebar. Their routes do not change in this phase.
- Keep the Operations guard rules above. Do not add `RECEIVE_READ` back.

### Phase 5 — Master Data and Stock Report

- Group Warehouses, Suppliers, Price Lists, Settings under Master Data (per Phase 0).
- Stock Report: the Reports hub holds Aging, Valuation, and Turnover. Check the Aging filters against the owner's list: serial number, brand, model, RR date from supplier. Add any that are missing.

### Phase 6 — Cleanup and redirects

- Add a redirect for every route that moves or is renamed (for example `/inventory/catalog` to the Item Master URL, if the URL changes). Follow the existing `?tab=` redirect pattern in `operations/page.tsx`.
- Remove dead sidebar code only after the redirects are in place.
- Permission audit: for each sidebar item, confirm a user with only that item's permission lands on a usable tab, not a 403 or an empty hub. The Operations hub had this problem before (see the `RECEIVE_READ` comment in `operations/page.tsx`).

---

## Risks and rules

- **Permissions**: when tabs merge, a user must see a tab only if they hold its permission. A hub must not open with no usable tab.
- **Bookmarks**: every moved route needs a redirect (Phase 6).
- **Naming**: "Stock Ledger" means the Stockbook group in the owner's sketch, but the current code uses the same name for the movement-log tab. Rename in the UI when Phase 3 lands. Do not rename the code symbols in the same change.
- **No test suite** is configured (`pnpm test` is a no-op). Verify with `pnpm type-check`, `pnpm lint`, and manual checks by role. The `docs/scenario-*` files show how the team writes manual test scripts.
- **Backend checks**: the mockup's Brand New / Repo / Repair-Return classification and the "Pulled Out" stat were not found in frontend code. Confirm against the backend before implementing.

---

## Open decisions (summary)

1. Stock Adjustments: Stock Transaction, or another group?
2. Master Data contents: Warehouses, Suppliers, Price Lists, Settings? Unit Documents here or in Stock Transaction?
3. Stock Request: is it the purchase-requests screen, or new?
4. Item Master: include Items? Keep Barcodes?
5. Purchase Orders: keep under inventory, or move back to procurement?
6. Counting and Finance: show, fold, or keep hidden?
7. Stock Ledger naming, and the fate of the movement-log tab (3d).
8. Receiving Report: inside General Stockbook? Where does "receive from stock transfer" start?
9. Debit Memo Request (Branch) and Approval (HO): two screens, or one with a role split?
10. Stock Transaction: one hub, or separate sidebar items?

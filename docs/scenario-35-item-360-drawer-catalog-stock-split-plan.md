# Scenario 35 — Item 360 Drawer: Split Catalog vs Stock Tabs by Entry Point — Gap Analysis & Closing Plan

Source: developer review of the Item 360 drawer (`Item360Drawer.tsx`), triggered by opening an item from Catalog → Items and finding Movements/Serials/History tabs present — operational stock data with no place in what's meant to be a user-friendly read of the product and its details, not its stock. UX plan worked out and confirmed with the developer 2026-08-19, including an interactive artifact mockup of both resulting drawer states.

## What's already fine — verified, not re-scoped here

- A single shared `Item360Drawer` (`frontend/src/components/inventory/item-360/Item360Drawer.tsx`) is mounted once, globally, via `ShellProviders.tsx`, driven by a small Zustand panel stack (`stores/ui-shell.store.ts`) — no per-page duplicate modal to reconcile.
- All 6 tabs' data already comes from independent, already-live endpoints (`GET /inventory/items/:id`, `.../ledger`, `.../change-history`, `.../substitutes`, `GET /inventory/stock/balances`, `GET /inventory/serial-numbers`), fanned out by one `useItem360(itemId, activeTab)` hook, each query gated by `enabled: activeTab === '<tab>'`. No backend work needed for the split itself.
- `Item` is the single underlying entity for both "Catalog" and "Stock" — the distinction is UI-only, not a data-model split. `StockBalance`/`StockLedger`/`SerialNumber` are the branch-scoped operational tables hanging off the same `Item` row.

## The problem being fixed

1. Catalog's only entry point into the drawer (`ItemMasterTable.tsx` row click, via `pushPanel`) opens it always showing all 6 tabs, including Movements/Serials/History — operational, per-branch stock data that has no place in what Catalog is meant to be.
2. Stock's own Balance list (`StockBalanceList.tsx`) doesn't use this drawer at all. Row click toggles a bespoke inline `<tr>` expando (`toggleExpanded`) showing a bare chip-list of serial numbers via its own inline `SerialsPanel` — considerably thinner than the drawer Catalog already has, despite Stock being the more natural home for it.
3. History is a hybrid — it merges the field-edit audit log (`ItemChangeLog`, a product-definition concern) with stock provenance entries (receipts/transfers, the same ledger data Movements reads) into one timeline. It currently only surfaces via Catalog's entry point, the wrong side of the split.
4. The drawer header's "Receive Stock"/"Transfer" buttons are plain links to `/inventory/operations?tab=receiving` and `/inventory/transfers` that don't carry the item forward — the destination page loads unfiltered instead of landing on this item.
5. Two more entry points (`inventory/page.tsx`'s Projected Stockouts widget, `GoodsReceivingList.tsx`'s "view item details" icon) also open the drawer with no tab scoping — both are operational contexts and should land on the Stock-flavored set too.

## Closing the gap

### 1. Scope the drawer's tabs by where it was opened from

Add `context: 'catalog' | 'stock'` to the `Panel` type (`ui-shell.store.ts`). `Item360Drawer.tsx`'s `TABS` array and default `activeTab` get filtered by `panel.context` instead of always showing all 6 tabs starting on Overview. One component, one source of truth — no duplicate drawer to maintain.

### 2. Catalog tab set: Overview + Substitutes

`ItemMasterTable.tsx`'s `pushPanel` call passes `context: 'catalog'`. `OverviewTab.tsx` drops the SKU field and the Tracking chip row from its body — both already visible in the header. Substitutes is unchanged (item-to-item relationship, correctly a product-definition concept).

### 3. Stock tab set: Stock + Serials + Movements + History

`StockTab`/`SerialsTab`/`MovementsTab`/`HistoryTab` all move under `context: 'stock'`, default tab `stock`. History is carried over unsplit — it keeps merging the change-log and provenance halves into one timeline, just relocated. (Its provenance half re-reads the same `/items/:id/ledger` endpoint Movements already calls — flagged, not changed, here.)

### 4. Wire Stock → Balance row click into the real drawer

`StockBalanceList.tsx`'s row click currently calls `toggleExpanded()` to show the inline `SerialsPanel`. Replace with `pushPanel({ type: 'item360', itemId, itemName, context: 'stock' })`. Remove the now-dead inline `SerialsPanel` component and its expand state once this lands.

### 5. Scope the two remaining entry points to Stock

`inventory/page.tsx`'s stockout-alert item click and `GoodsReceivingList.tsx`'s "view item details" icon both pass `context: 'stock'` — both are operational contexts (a stockout, a receiving line), not catalog browsing.

### 6. Carry the item forward from the header actions

"Receive Stock" → `/inventory/operations?tab=receiving&itemId=<id>`; "Transfer" → `/inventory/transfers?itemId=<id>`. Requires each destination page to read and apply that query param as an initial filter — the one piece of this scenario that touches code outside the drawer itself.

## Decisions already settled with the developer (2026-08-19)

1. **History**: moves wholesale to Stock, both halves kept together (not split into a separate Catalog "Change Log" tab) — §3 above.
2. **Stock → Balance row click**: replaced with the real drawer (Stock-flavored), not left as the existing inline expando — §4 above.
3. **Header action buttons**: fixed to carry `itemId` forward in the same pass, not deferred to a separate ticket — §6 above.
4. **Catalog Overview fields**: SKU and Tracking dropped from the tab body (redundant with the header, which already shows the item name + SKU) — §2 above.

## Explicitly out of scope

- **Splitting History into two tabs** (a Catalog-side change-log-only view separate from Stock's provenance) — flagged during planning as a possible future cleanup since Movements and History's provenance half already read the same endpoint, but not decided; keeping History unsplit for this pass.
- **Substitutes cross-navigation**: jumping between items via Substitutes' own `pushPanel`/`replacePanel` calls stays `context: 'catalog'` — browsing to a substitute is still a catalog action, not a stock one.

## Verification (once implemented)

1. Open an item from Catalog → Items: drawer shows exactly Overview + Substitutes, defaults to Overview, no SKU field or Tracking chips in the body (header still shows SKU).
2. Open an item from Stock → Balance: drawer shows exactly Stock + Serials + Movements + History, defaults to Stock; confirm the old inline serial-chip expando no longer appears anywhere in `StockBalanceList`.
3. Confirm History still shows both field-edit and receipt/transfer entries merged in one timeline, now only reachable from Stock.
4. Click "Receive Stock"/"Transfer" from a drawer opened either way; confirm the destination page lands pre-filtered to that item.
5. Open from the Inventory dashboard's Projected Stockouts widget and from Goods Receiving's "view item details" icon; confirm both land on the Stock-flavored tab set.
6. Update `e2e/inventory-item-360-serials-tab.spec.ts` — it currently opens the drawer from `/inventory/items` and clicks "Serials," which will no longer exist there; re-point it to open from `/inventory/stock`'s Balance list instead. Add new coverage for the Catalog-side tab set (2 tabs, no SKU/Tracking) and for the header buttons' itemId hand-off.

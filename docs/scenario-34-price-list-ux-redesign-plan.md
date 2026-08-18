# Scenario 34 — Price Lists UX Redesign (Categories Drawer + Dedicated Item-Management Page) — Gap Analysis & Closing Plan

Source: developer review of the live Price Lists / Price Use Types admin screens (2026-08-18), right after the appliance rate-card import (`prisma/data/appliance-pricelist-2026-08-17.csv`, see Scenario 30/import work) connected 376 items to their per-Price-Use pricing. Follow-up to Scenario 15 (`scenario-15-price-list-management-plan.md`), which built the underlying data model, approval workflow, and first-cut admin UI this scenario is redesigning.

## What's already fine — verified, not re-scoped here

- Data model and approval workflow (`PriceUseType` → `PriceList` → `PriceListItem` → `PriceListItemTerm`, `pending_approval → active | rejected`, floor-price gate at approval, `supersedesId` versioning, branch scoping) — all built in Scenario 15, all correct, none of it changes here.
- `POST /inventory/price-lists/:id/items` already accepts a batch array (`UpsertPriceListItemsDto.items[]`) — the backend has supported bulk add since Scenario 15; the frontend has just never called it with more than one item.
- `GET /inventory/items` (paginated, searchable catalog search) and the `SearchCombobox`/`ItemSearchCombobox` pattern already exist and are already reused across multiple modules — no new search primitive needed.
- The generic `Drawer` component (`frontend/src/components/ui/drawer/Drawer.tsx`) already exists and fits the categories panel described below.

## The problem being fixed

1. **"Price Use Types" and "Price Lists" read as duplicate screens.** Price Use Types lists 8 bare category names (WIP, SKYRO, SSC, ...); Price Lists lists 7 rows each literally named `"{TYPE} — {description}"` — one per type, because in practice every category today has exactly one company-wide list wrapping it 1:1. Nothing in the UI signals that a Price List is a richer pricing _container_ (with its own items, status, approval state) rather than just the category repeated.
2. **Item management is a cramped, non-scaling modal.** `PriceListItemsModal.tsx` loads a price list's _entire_ item array in one unpaginated request and renders it in a `max-w-2xl` modal. This is no longer a hypothetical scale problem: after today's import, the WIP list alone has 1,270 connected items. Adding items is one-at-a-time via a single-select combobox, despite the backend already accepting a batch.
3. **Two fields already captured by the real rate-card data have no UI at all** — `cmAmount`/`creditAmount` ("CM"/"CREDIT" columns) exist on `PriceListItem` and were populated for many rows by the CSV import, but are only reachable via the API today.

## Closing the gap

### 1. Fold "Price Use Types" into a drawer on the Price Lists page

Remove the standalone route (`frontend/src/app/(app)/(dashboard)/inventory/price-use-types/page.tsx` + `_components/PriceUseTypesPageView.tsx`). Replace the `Link href="/inventory/price-use-types"` in `PriceListsPageView.tsx:262-268` with a button opening a new `ManageCategoriesDrawer`, built on the existing `Drawer` primitive. Reuse as-is inside it: `usePriceUseTypes.ts` (list/create/update/delete), `PriceUseTypeModal.tsx` (add/edit form), and the existing in-use delete guard. Almost entirely a presentational move — no data-layer changes. `PriceListModal.tsx`'s existing inline "Add new Price Use Type" nested-modal flow is untouched.

Cost to carry: the price-use-types e2e spec (page-navigation-based, includes a permission-redirect case) needs updating to drive the drawer instead of a route.

### 2. Make the Price Lists table visibly a pricing container, not a label

Add an item count per row (e.g. "374 items priced"). Backend: `_count: { items: true }` in `PriceListsService.findAll`'s query, surfaced as `itemCount`. Frontend: add `itemCount` to the `PriceList` schema, render next to the status badge in `PriceListsPageView.tsx`.

### 3. Replace the "Manage Items" modal with a dedicated page

New route: `frontend/src/app/(app)/(dashboard)/inventory/price-lists/[id]/page.tsx`. The checklist icon in `PriceListActions` (`PriceListsPageView.tsx:140-147`) becomes a `Link` to this route instead of opening `PriceListItemsModal`, which is removed along with the `managingItemsList` state.

**Layout:**

- Header: "← Back to Price Lists" breadcrumb, list name, Price-Use-Type badge, status badge, effective range, branch scope. Surface Approve/Reject here too (same existing modals/endpoints, just relocated) so an approver can review actual priced items before acting, not just a name in a table row.
- **Items table** — paginated, searchable by name/SKU. Columns: Item, Price, Floor Price, Down Payment, Min Qty, CM, Credit, Remove. Row checkboxes enable a "Remove N items" bulk action.
- **Add Items panel** — catalog search (existing `GET /inventory/items` + combobox pattern, extended to multi-select) → review step to set price (required) and floor price/DP/min qty/CM/credit (optional) per item or apply-to-all-with-override → one "Add N items" call.

**Business rules that must carry over unchanged** from `PriceListItemsModal.tsx`: read-only lock on non-editable statuses (`EDITABLE_STATUSES`), the active-list-reverts-to-pending-approval warning banner on add/remove, remove-item confirmation.

### 4. Backend additions required

1. `GET /inventory/price-lists/:id/items?search=&page=&limit=` — new paginated/searchable endpoint (reuses `findOne`'s `item`/`variant` include shape, adds `skip`/`take`/search + total count). Required because `findOne` today returns the full unpaginated array — fine at a handful of items, broken at 1,270.
2. `itemCount` on `findAll`'s response (§2).
3. `DELETE /inventory/price-lists/:id/items` with body `{ itemIds: string[] }` — new bulk-remove endpoint mirroring the existing batch-upsert route's shape, backing the page's multi-select removal. Existing single-item `DELETE .../items/:itemId` stays for the per-row remove button.
4. No change needed for bulk add — already supported (see "What's already fine").
5. `cmAmount`/`creditAmount` need no backend DTO change (already present) — only `frontend/src/schema/inventory/price-lists/index.ts` (`UpsertPriceListItemFormSchema`, `PriceListItemSchema`) needs the two fields added so the new form/table can send and display them.

**Status**: done — see Implementation Log (2026-08-19) below.

## Decisions already settled with the developer (2026-08-18)

1. **Price Use Types page**: fold into a drawer on the Price Lists page (not kept as a separate route) — §1 above.
2. **CM/Credit fields**: add manual-entry UI for `cmAmount`/`creditAmount` now, since this redesign already rebuilds the exact form that needs them — §4.5 above.

## Explicitly out of scope

- **Per-term installment figures** (`PriceListItemTerm`): zero backend CRUD endpoint exists (import-script-only today). Building admin UI needs a new DTO + controller endpoints first — a separate, larger task.
- **Unguarded GET endpoints** on both controllers (`findAll`/`findOne`/`resolve` carry no `@RequirePermissions`, pre-existing gap found during this scenario's research) — real, but unrelated to this UX work; track separately rather than folding in here.

## Verification (once implemented)

- Open a price list with a large item count (WIP, 1,270 items) and confirm the new page paginates/searches instead of loading everything at once.
- Multi-select add 3-4 items in one batch; confirm one network call with an array body, not N calls.
- Edit items on an `active` list; confirm the existing revert-to-pending-approval banner/toast still fires.
- Open the categories drawer, add/edit/delete a category; confirm the in-use delete guard still blocks correctly.
- Update and run the affected e2e specs (`inventory-price-list-*.spec.ts`, price-use-types spec) against the new UI structure.

## Implementation Log — 2026-08-19

**For this scenario, I have done:**

- **§1 (Fold Price Use Types into a drawer)**: `ManageCategoriesDrawer.tsx` built on the existing `Drawer` primitive, reusing `usePriceUseTypes.ts`/`PriceUseTypeModal.tsx`/the in-use delete guard as-is. Standalone route + its nav-grid card removed. `inventory-price-use-types.spec.ts` rewritten to drive the drawer instead of navigation.
- **§2 (Item count per row)**: `PriceListsService.findAll` maps Prisma's `_count.items` into a flat `itemCount`; `PriceListSchema` gained the field; both the mobile-card and desktop-table rows in `PriceListsPageView.tsx` show "N items priced" under the status badge. New backend Jest coverage (2 tests) + new frontend spec `inventory-price-list-item-count.spec.ts`.
- **§3/§4 (Dedicated item-management page)**: new `GET /inventory/price-lists/:id/items` (paginated/searchable) and `DELETE /inventory/price-lists/:id/items` (bulk remove, body `{itemIds}`) backend endpoints; new `/inventory/price-lists/[id]` page (header with breadcrumb/badges/branch scope/Approve/Reject, paginated+searchable items table with checkbox bulk-remove, multi-select "Add Items" panel with per-item pricing + apply-to-all). `cmAmount`/`creditAmount` added to the frontend schema and shown/editable for the first time. Old `PriceListItemsModal.tsx` and its "Manage Items" button removed; the checklist icon is now a `Link` to the new page. Read-only lock, active-reverts-to-pending banner/toast, and remove confirmation all carried over. New backend Jest coverage (6 tests) + new frontend spec `inventory-price-list-item-management.spec.ts` (4 tests); 2 pre-existing specs that drove the old modal (`inventory-price-list-installment-terms.spec.ts`, `inventory-price-list-versioning.spec.ts`) updated to use the new page.

**Worth flagging:**

- Two real bugs found and fixed along the way, outside this scenario's original scope but blocking it:
  1. **`apiClient` (`src/libs/api/client.ts`) silently dropped the request body on every `DELETE` call** — it only attached bodies for POST/PUT/PATCH. Blocked the new bulk-remove endpoint entirely (400 from a missing `itemIds`) until fixed by adding DELETE to that list. Purely additive — no existing DELETE caller could have relied on a body that was always discarded.
  2. **The shared `Drawer` component (new this scenario, §1) stayed fully accessible/interactive even while visually closed** — it only translates off-screen for the slide animation, so its buttons remained in the accessibility tree and tab order indefinitely. This had already started leaking into unrelated code: `inventory-price-list-branch-scoping.spec.ts` (pre-existing, untouched by this scenario) started failing because its page-wide "Edit" button query matched 30+ hidden category rows from the closed drawer. `inert` alone did not reliably exclude it (observed to still match via Playwright's `getByRole` in Chromium despite being set) — fixed by delaying `visibility:hidden` until the close transition actually finishes (visible immediately on open, hidden 300ms after closing).
- Explicitly out-of-scope items from the plan doc remain open, unchanged: per-term installment figures (`PriceListItemTerm`) have no CRUD endpoint; the pre-existing unguarded GET endpoints on both controllers are untouched.
- The new item-management page's GET endpoint intentionally has no `@RequirePermissions`, matching its sibling `findAll`/`findOne` (both already unguarded, per the item above) — adding a guard only to the new endpoint would have been inconsistent without fixing the underlying gap.
- Cleaned up ~100 leftover "E2E..."-prefixed price lists/price-use-types in the isolated e2e test database, left over from this session's own repeated debugging runs (they were cluttering row-count-sensitive tests in unrelated specs). The real dev database was not touched by this cleanup.

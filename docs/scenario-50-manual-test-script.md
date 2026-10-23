# Scenario 50 — Inventory UAT: Manual Test Script

Companion to [scenario-50-inventory-uat-batch-plan.md](./scenario-50-inventory-uat-batch-plan.md).
One pass through every item on the client's inventory punch list, in the order that minimises
setup.

Tracks the **client's revised list (2026-09-14)**, all of which is now implemented. Markers used
throughout:

- ✅ — built and expected to pass.
- ⚠️ — built but **not verified**, or verified more shallowly than the rest. Give these the most
  attention; they are where a real defect is most likely to be hiding.
- **NOT BUILT** — deliberately out of scope. Don't hunt for UI that isn't there, and don't log it
  as a bug.

## Status of the 2026-09-14 revision — all three gaps now closed

Implemented 2026-09-14. Backend `8b2f246`, frontend `feddd9c`, both on
`feat/scenario-50-inventory-uat-batch`.

| Item                         | Revised list said                                                | Outcome                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| In Stock / In Transit filter | "Add In Stock / In Transit status filter"                        | ✅ **Built, and widened** — the filter offers all five states, not two (§3)                                      |
| Transfer Details full view   | "Convert … to **full-page view**"                                | ✅ **Closed as already done** — the full-bleed panel is what was meant; no routed URL was built (§5e)            |
| Caravan branch-to-branch     | "**branch-to-branch** consignment within the same caravan event" | ✅ **Verified, no code needed** — it already worked (§7)                                                         |
| Price List VAT               | "ensure **all** prices are VAT-inclusive"                        | ✅ **Backfilled and enforced** — the column is now NOT NULL DEFAULT 'inclusive'; Exclusive stays selectable (§9) |

Also removed since the last revision: the **Manual RR** tab (see §8). It was a second, competing
"create a receipt" path and is no longer reachable from the UI.

### Read this before you start — the seed cannot exercise most of the new filter

The dev DB holds **21 items, all on hand, none reserved, and no reorder points configured
anywhere**. Four of the five stock states therefore return zero rows by construction, and the
automated tests covering them prove the plumbing, not the arithmetic. §0.5 seeds those states so
the manual pass actually means something. **Do it first, or §3 will look like it does nothing.**

## 0. Setup (do this once)

1. Backend on `localhost:3001`, frontend `pnpm dev` on `localhost:3000`.
2. Login: dev bypass — email below, password = `DEV_API_KEY` from `backend/.env`
   (`dev-prominent-enterprise-2026`). Cashier PIN where prompted: `1234`.
3. Accounts you'll switch between (pattern `technova.b{N}.{role}@test.com`):

   | Purpose                                 | Account                                   |
   | --------------------------------------- | ----------------------------------------- |
   | Everything-goes / owner bypass          | Business Owner account                    |
   | Source branch (Negros)                  | `technova.b1.stock@test.com` (Bago)       |
   | Destination branch (Negros)             | `technova.b2.stock@test.com` (Binalbagan) |
   | Branch manager (has `transfers:direct`) | `technova.b1.manager@test.com`            |
   | Panay branch (region filter check)      | `technova.b20.stock@test.com` (Ajuy)      |

   Real warehouses: **Negros Warehouse** (WH-NEGROS, b19/NWHSE) and **Panay Warehouse**
   (WH-PANAY, b41/PWHSE). Regions: b1–b18 negros, b20–b40 panay.

4. If any page 500s with a CSS error, `rm -rf .next .next-e2e` and restart — known stale-cache
   symptom, not a live bug.

---

## 0.5 Seed the stock states (needed for §3)

None of this exists in the seed. Five minutes here makes §3 a real test instead of a smoke test.

1. **In Transit** — as `technova.b1.stock@test.com`, `/inventory/transfers` → New Transfer,
   Bago → Binalbagan, any in-stock item, qty 2. Progress it to **dispatched** and stop.
   Dispatched-not-received is exactly what in-transit means here.
2. **Fully Reserved** — reserve every unit of one item. SKU `NIG-ITEM-0216` has qty 1, so it is
   the cheapest one to fully reserve.
3. **Out of Stock** — sell or transfer out an item's entire quantity.
4. **Low Stock** — set a **reorder point above the available qty** on any item. Nothing in the
   database has a reorder point today, which is why Low Stock currently never appears at all.

Leave the in-transit transfer open until §3 and §5d are both done.

## 1. Printed PO — delivery location, warehouse and address

1. `/inventory/purchase-orders` → open any PO with a warehouse set (or create one and set the
   delivery warehouse), leaving **Delivery Instructions blank**.
2. Click **Print**.
3. ✅ The printed PO shows a delivery destination block: the location name (warehouse or branch,
   per the standard label rule) **and** the address on its own line.
4. ✅ It appears even though Delivery Instructions is empty. _(This was the whole bug — previously
   the printout said nothing about where to deliver.)_
5. Note: `Warehouse.address` is null for every seeded warehouse, so the address comes from the
   **branch** record. An empty address line here is a data gap, not a code gap.

---

## 2. Printed RR — PO number

1. `/inventory/goods-receiving` → **Receiving Reports** tab → open a receipt that came from a PO.
2. Click **Print**.
3. ✅ The PO number appears in the reference/`Dated` area (previously hardcoded `—`).
4. Open the same RR on-screen via `/accounting/receiving-reports` → the sheet view.
5. ✅ Both views show the **same** PO number and the same column set (Brand/Model order,
   Subgroup vs Type). These two are separately implemented and have drifted before — compare
   them side by side.

---

## 3. Stock Balance — the five-part overhaul

Go to `/inventory/stock` → Stock Balance.

1. **One row per item.** Find an item that has stock in two different locations.
   ✅ It shows as **one row with the summed quantity**, not one row per location.
   (Note: the original note blamed serials; the real duplication was per-location.)
2. **No Location column.** ✅ There is no Location column in the table.
3. **Search coverage.** Placeholder reads _"Search brand, model, or category…"_.
   - ✅ Searching a brand narrows correctly.
   - ✅ Searching a model number narrows correctly.
   - ✅ Searching a category narrows correctly.
   - ✅ Searching a **serial number** returns nothing (serial search was intentionally removed).
4. **Operations/Region filter.** ✅ There's an **All Operations** picker with **Negros** and
   **Panay**. Pick Negros → only Negros-region stock. Pick Panay → only Panay.
5. **The 2-Panay-warehouses bug.** Open the **All Branches** picker.
   ✅ There is **exactly one** "Panay Warehouse" entry and one "Negros Warehouse" entry — not two.
   (Root cause was shadow per-branch warehouses leaking into the picker.)
6. **Filter leak into the drawer.** Set the branch filter to **Panay Warehouse**, then click a row
   to open the Item 360 drawer.
   ✅ The drawer's **Stock** tab, **Serials** tab and Available Branches section show **only Panay**
   rows — not every location. This was the reported bug.
7. **Totals honesty.** With a filter applied, ✅ the "Total items" chip and pagination match the
   filtered set (roll-up is server-side, so these should not lie).

### ✅ Stock state filter — built, and wider than asked

The client asked for In Stock / In Transit. The filter ships with **five** states, because the
other three were already rendered as badges on every row with no way to filter by them.

8. ✅ There's an **All Stock** picker after All Categories.
9. Open it. ✅ Five options: **In Stock · Low Stock · Fully Reserved · Out of Stock · In Transit**.
10. Pick each in turn. ✅ Every row returned carries the badge you filtered for — the filter and
    the badge must never disagree.
11. ✅ **In Transit** returns the item from your §0.5 transfer. Receive that transfer and the item
    drops out of this filter.
12. ✅ **Low Stock** returns the item you gave a reorder point in §0.5. If you skipped §0.5 this is
    empty — see the note below, it is not a bug.
13. ✅ The **Clear N filters** count includes this filter, and clearing resets it to "All Stock".
14. ✅ It combines with the others — Operations = Negros **and** In Transit applies both.
15. ✅ The "Total items" chip and pagination match the filtered set.

**Two bugs were fixed to make this work; both are worth re-checking directly.**

- **The filter used to run before the roll-up**, while the badge is derived after it. Confirm the
  fix: find an item with **0 on hand in one branch and stock in another**, filter to **Out of
  Stock**, and ✅ it must **not** appear. Before the fix it matched on its empty branch row and
  then rendered as one rolled-up row showing the other branch's quantity with an "In Stock" badge.
- **Low Stock was unreachable.** The roll-up hardcoded `reorderPoint: null` on every grouped row,
  so the badge could never be Low Stock in the default view. Reorder points now sum across the
  locations that hold the item — so ✅ an item with a reorder point of 5 in each of two branches
  goes low below 10 available, not below 5.

**Deliberately no In Transit column.** Rows roll up per item across locations, so a single
quantity would flatten "3 in transit to Bago, 2 to Ajuy" into an unattributed 5. The filter
answers "which items have units moving"; the transfer itself answers "where to".

## 4. Stock Ledger — search and provenance

`/inventory/goods-receiving` → **Stock Ledger** tab.

1. ✅ There's a search box: _"Search unit, model, RR, ST, SI, or DR no.…"_ (there was none at all before).
2. Test each dimension, one at a time:
   - ✅ **Serial number** → returns that unit's entries only.
   - ✅ **RR number** → returns that receipt's entries.
   - ✅ **Supplier invoice number** → matches.
   - ✅ **DR number** → matches.
   - ✅ **Item model** → returns only that item's entries, not every item.
   - ✅ **Stock transfer (ST) number** → returns **both legs** (`transfer_in` and `transfer_out`).
3. ✅ A deliberately nonsense search returns **nothing**, not everything. (Search must apply
   server-side across the whole ledger, not just filter the loaded page — test with a value you
   know is on page 3.)
4. **Columns.** ✅ Final column set is **Type · Item · Location · Source · Qty · Date**.
   ✅ Unit Cost, Value, Customer, Accounting and Notes are **gone**.
5. **Provenance.** ✅ The **Source** column shows RR / PO / supplier / DR as applicable, and the
   RR link navigates through to `/inventory/stock/reports/[id]` with the real matching report.
   _(One Source column, deliberately, rather than four separate columns.)_

---

## 5. Stock Transfer / Stock Request

### 5a. Direct transfer (no destination approval)

1. Log in as **`technova.b1.manager@test.com`** (Branch Manager — has `inventory:transfers:direct`).
2. `/inventory/transfers` → **New Transfer**. Fill source/destination/items.
3. ✅ There's a checkbox **"Send directly — no destination approval required"**.
4. Tick it. ✅ The helper text changes to explain it takes effect without the approval routing.
5. Submit. ✅ Status is `requested` — **not** `pending_manager_approval`.
6. Now repeat **unticked** as a Stock Controller (`technova.b1.stock@test.com`).
   ✅ Status is `pending_manager_approval` — the old flow still exists and still gates. Both paths
   must remain available; this was an addition, not a replacement.
7. Permission negative test: as Stock Controller, if you can force the direct flag,
   ✅ the API returns **403** — not a silent downgrade to the normal flow.

### 5b. Serial multi-select at dispatch

1. Create a transfer for a serial-tracked item with **qty 3**.
2. Progress it to dispatch and open the dispatch step.
3. ✅ Opening the serial picker lets you tick **all three serials in one dropdown session** —
   you should not have to open a separate single-select per unit.
4. ⚠️ The **supervisor cross-branch override** path is still single-pick by design (it's a live
   cross-branch search with no pre-loaded list). Confirm it still works, but don't expect
   multi-select there.

### 5c. Expected arrival not required

1. At dispatch, leave **Expected Arrival completely blank**.
2. ✅ Dispatch submits successfully. (Previously required; and an empty string used to reach the
   backend's date validator and 400 — verify a blank field, not just a removed asterisk.)
3. ✅ Same on the create form — blank arrival submits.
4. ✅ Setting an arrival date **before** the transfer date is still rejected.

### 5d. Receiver gets the RR

1. Receive the transfer as the destination branch user.
2. ✅ On success you see the **created goods receipt number**, as a link.
3. ✅ Clicking it opens `/inventory/goods-receiving/[id]` with the real matching receipt, and the
   print action works from there.
4. ✅ This happens for **every** transfer, not just direct ones — check a normal-flow transfer too.

### 5e. ✅ Full-page view — closed as already done

**Decision taken 2026-09-14:** "full-page view" meant the visual treatment, not a routed URL. No
code was written for this item; it is closed on the full-bleed panel that already shipped.

1. Open a **Purchase Order** detail. ✅ Full-bleed shell — header bar, scrolling body, pinned
   footer — not a centred dialog over a dimmed backdrop.
2. Open a **Stock Transfer** detail. ✅ Same shell.
3. ✅ All four contexts are full-bleed: creating, editing, dispatching, receiving.

**What was consciously not built**, so nobody re-raises it as a bug: there is no `[id]` route for
PO or Transfer. The URL does not change when you open a detail, you cannot link someone to a
specific transfer, browser Back leaves the screen rather than closing the detail, and refreshing
with a detail open loses it. If the client wants any of those, it is new work —
`TransferDetailModal.tsx` is 2130+ lines and extracting it is a day or two, not an afternoon.

## 6. Serial Number Tracking

`/inventory/serial-numbers`.

1. ✅ The **Unit Cost** column is **gone** from the Serial Number Tracking list.
2. ✅ It is **still present** on the Item 360 drawer's Serials tab — that was a deliberate decision,
   not a miss.
3. ✅ There's an **ST #** column beside **RR #**, showing the real transfer number
   (e.g. `TRF-20260910-0019`) for units that arrived via transfer.

---

## 7. Caravan

Serial Number Tracking → **Caravan** tab (needs `CARAVAN_MANAGE`).

1. **Source from warehouse and from branch.** On **All Serials**, use the location filter.
   ✅ The list includes both the 2 real warehouses **and** branches, so you can tick-select units
   sourced from either and consign them.
2. **RR and ST numbers.** ✅ Both columns show real values on caravan units.
3. **✅ Consignment scope — verified live 2026-09-14, no code needed.** The revised wording
   ("branch-to-branch consignment within the same caravan event") was already satisfied. All of
   this was driven through the real API against the dev DB and the data restored afterwards:
   - **Branch-to-branch**: a Bago-owned unit consigned to a **Binalbagan**-hosted event succeeds,
     and ✅ `currentWarehouseId` is **unchanged** — ownership stays with Bago, Binalbagan only
     gains the right to sell. Re-confirm this in the UI; it is the client's actual ask.
   - **Same-branch host**: consigning a Bago-owned unit to a **Bago**-hosted event also succeeds
     (this is the guard Gap 6 removed), location again unchanged. ✅ The unit shows on that
     branch's own Caravan tab.
   - **Same event, multiple sources** — ⚠️ **could not be verified.** The whole dev DB has exactly
     **one** in-stock serial, so two branches feeding one event is untested. This is the part of
     the revised wording most worth your attention. The event is keyed on host/venue + event name
     - dates, so an exact match merges into one event and **a typo'd event name silently splits it
       into two**. Consign from two branches with the identical name and dates, confirm one event,
       then deliberately misspell the name on a third and confirm how obvious the split is.
   - **Operational consequence worth knowing**: once a host branch holds a consigned unit, the
     **sending branch cannot recall it** — close-consignment is scoped to the host branch or a
     branchless owner. Verified by hitting the 403 accidentally.

4. **Sold items can't be consigned.** Pick a serial with status `sold` and try to consign it.
   ✅ Rejected, both in the UI and server-side.
5. **Double-consign.** Try consigning an already-consigned unit. ✅ Still blocked (separate,
   pre-existing guard).
6. **Home Branch column.** For a unit owned by a **standalone warehouse** (not a branch),
   ✅ Home Branch shows the warehouse name — not blank.
7. **Host picker hygiene.** Open the host-branch picker and the "Move to…" picker.
   ✅ Neither lists **NWHSE** or **PWHSE** (the warehouse-type pseudo-branches).

---

## 8. Create an RR without a stock transfer

Two paths exist — test whichever the client meant (**this is still an open question**):

- **A. Standalone goods receipt** — `/inventory/goods-receiving` → Receive Stock. Supply only
  warehouse, application type, lines and a DR number. ✅ Submits with **no PO and no transfer**.
  Supplier is required only when no line carries a PO line. `purchaseOrderNumber` is free text.
- **B. Manual Receiving Report** — **removed from the UI.** It was a fifth tab on
  `/inventory/counting`, which was its only entry point (no `page.tsx` of its own). Pulled because
  it reads as a second, competing "create a receipt" path. Components, actions, hooks and the
  backend all still exist; nothing in the app reaches them.

The two were never interchangeable, which is why B was dropped rather than kept as an alternative:

|               | Receive Stock                                                                                                                  | Manual RR (removed)                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Scope         | N item lines, bulk serials textarea                                                                                            | exactly one serialised unit                      |
| Justification | PO / DR / SI reference numbers                                                                                                 | a `reasonCode` (shared with stock counts)        |
| Approval      | posts immediately                                                                                                              | maker-checker: `pending` → someone else approves |
| Also carries  | `receivedAt`, `applicationType`, `modeOfTransfer`, `nndpCost`, `withholding`, per-line `isFreebie`/`batchNumber`/`qualityHold` | —                                                |

Overlap is only `itemId`, `warehouseId`, `supplierId`, `unitCost`, `notes`.

⚠️ Confirm with the client that Receive Stock alone covers what they meant by "create an RR without
a stock transfer." If they actually wanted the one-unit, reason-coded, second-signature shape, the
Manual RR tab goes back in two lines.

---

## 9. Price List — VAT inclusive ✅ enforced

`/inventory/price-lists`. **Changed 2026-09-14**: this is now a guarantee, not a default. Migration
`20260914100000_price_list_pricing_mode_backfill` filled every undeclared list and made the column
**NOT NULL DEFAULT 'inclusive'**. Exclusive stays selectable per the developer's decision — what
was removed is the _undeclared_ state, not the mode.

1. ✅ Every list shows a **"VAT Inclusive" / "VAT Exclusive"** chip on both the list and card views.
2. ✅ **No list shows an undeclared or blank VAT treatment.** Before this change all 7 seeded lists
   stored `NULL` and only _displayed_ as Inclusive through a frontend fallback — the exact
   ambiguity the client's wording targeted. All 7 now genuinely store `inclusive`.
3. Create a new price list without touching the VAT control. ✅ It saves as **inclusive**.
4. Edit a list to **Exclusive**. ✅ Saves, chip flips. Edit it back. ✅ Saves.
5. ✅ An invalid value is rejected with a 400 (API-level; the UI only offers the two).

Verified live against the dev DB on 2026-09-14: 7/7 lists `NULL` → 7/7 `inclusive`; create-omitting
returns `inclusive`; exclusive settable; `bogus` → 400.

⚠️ **The backend spec for this was committed unrun.** `test/price-list-vat-inclusive.e2e-spec.ts`
(5 tests, including "no price list lacks a declared VAT treatment") has never been executed —
`npm run test:e2e` resets the test database first and that consent wasn't given. Everything above
was proven by direct API calls instead. Run the spec when you're happy to reset the test DB.

**NOT BUILT — do not test:** a numeric net/VAT/gross **breakdown** on the price-list screens, and
POS reading VAT treatment **from the price list**. POS still resolves its mode from Branch Pricing
via `line.pricingMode ?? tenantPricingMode`. Both deliberately deferred (POS derives the rate from
a configurable `TaxRate`, and no tax-rate fetch exists near these screens).

## 10. Repair journey for the customer

`/inventory/uds` (Unit Document Sheet) — this module _is_ the repair journey.

1. Branch raises a damaged-stock return with **`flag_for_repair`**.
   ✅ The intake form has an **Intake Receiving Report Number** field (newly added — the backend
   accepted it all along but no form ever sent it). It's **free text by design**, matching how
   `purchaseOrderNumber` works elsewhere — no document is generated at intake.
2. Drive the chain: `issued → in_transit → received` → assess **repairable** → set repair provider
   → **dispatch-to-provider** (DR number persists) → **receive-from-provider** (a second RR number
   persists — the return trip's own document) → **release-to-customer** (final DR persists) →
   `completed`.
3. ✅ All four documents from the client's diagram (`RR → DR → RR → DR`) are present on the finished
   record.
4. ✅ A linked stock transfer to the main branch is auto-paired.
5. ⚠️ **No printed Delivery Receipt exists anywhere in the system.** "DR" is a typed reference
   number throughout. If the client expects a printable DR document, that is net-new work.

---

## 11. Supplier return journey → debit memo

`/inventory/debit-memos`.

1. ✅ The list loads. Statuses are DRAFT / APPROVED / FINAL / VOID.
2. Create a real debit memo against a supplier with an existing AP bill.
   ✅ It links `supplierId` and `apBillId`, carries a `deliveryReceiptNumber`, posts a journal
   entry, and moves stock out as `supplier_return`.
   ✅ The linked AP bill's balance drops.
3. ⚠️ **This is the least-verified journey.** The dev DB has zero debit memos and creating one
   needs a real AP bill fixture — it was confirmed reachable and well-formed, but never driven
   through a live create. Give this one the most attention.

---

## 12. Regression sweep

Nothing here changed on purpose — confirm nothing broke.

- Normal PO → receive → RR → AP bill flow.
- Stock transfer full lifecycle on the **existing** (non-direct) path, including HQ approval.
- Item 360 drawer opened from somewhere **other** than Stock Balance (the location scoping is
  passed through `pushPanel`, so check it still shows everything where it should).
- POS checkout tax on a VAT-inclusive line (touched by `c6d0163`, adjacent to this work).
- `pnpm type-check && pnpm lint && pnpm build`.

---

## Open questions to settle with the client while testing

Three of the five previous questions were answered on 2026-09-14 and are recorded above:
full-page meant the panel (§5e), price lists are inclusive-by-guarantee (§9), and caravan
branch-to-branch already worked (§7). What's left:

1. **"RR creation without a Stock Transfer"** (§8) — Receive Stock covers the _supplier delivery
   without a PO_ shape. If the client meant the one-unit, reason-coded, second-signature shape,
   that was Manual RR, and it has just been removed from the UI. Settle before closing the item.
2. **Do the repair journey's DR legs need a printed document?** (§10) No Delivery Receipt entity
   or printout exists anywhere; "DR" is a typed reference number throughout.
3. **Caravan: what counts as one event?** (§7.3) The multi-source case is implemented but
   unverified, and a mistyped event name splits an event silently. Worth confirming the client
   expects name+dates to be the identity.

## Known gaps — expected failures, already triaged

Don't raise these as new bugs.

| §   | Item                                | Where it stands                                                                     |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| 3   | Four of five stock states           | Return zero rows against the seed — do §0.5 first, or they look broken              |
| 5e  | PO / Transfer as routed URLs        | Deliberately not built; panel only, decision taken 2026-09-14                       |
| 7   | Caravan multi-source event grouping | Implemented, **unverified** — only one in-stock serial exists in the dev DB         |
| 9   | Price list e2e spec                 | Committed **unrun** — needs a test-DB reset                                         |
| 9   | VAT breakdown + POS wiring          | Deliberately deferred, needs `TaxRate` plumbing                                     |
| 10  | Printed Delivery Receipt            | No DR entity anywhere — net-new if wanted                                           |
| 11  | Debit memo live create              | Never exercised; dev DB has zero, needs an AP bill fixture                          |
| —   | `inventory-stock-balance-rollup`    | 4 pre-existing e2e failures: stale `table tbody tr` locators after the grid rewrite |

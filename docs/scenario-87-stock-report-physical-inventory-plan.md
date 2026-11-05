# Scenario 87 — Stock Report: Physical Inventory and Aging export

Source: the client's "Stock Report Feature Update" Google Doc
(https://docs.google.com/document/d/1E8gqgpJERVFnFWDxDjMyfVZFHosuDYdYy-_s3B3R91k), and its linked sample sheet
"Inventory_Aging_Report"
(https://docs.google.com/spreadsheets/d/1rVIszOJu7GbWnyy6fYBWWsnYeTsKUotZ5Kq4x9xjk8g).

Branch `feat/scenario-87-stock-report-physical-inventory` in both repos, branched off `development` on 2026-11-05
(BE 78530e50, FE db14789c).

## Decisions (Karms, 2026-11-05)

1. **Classification** (Brand New / Repair/Return / Repo) is **stored** as `SerialNumber.receivedAs` (revised on
   re-check, 2026-11-05). It was first derived from `repossessedFromInstallmentAccountId`, but that was null on every
   dev unit and is only set when a repossession is received with an installment account. Receive Stock now sets
   `receivedAs` from the receipt's reason (`repair_return` → Repair/Return, `repossession` → Repo, otherwise Brand
   New), and transfers never touch it. The migration `20261105150000_serial_received_as` backfills it from today's
   receipt reasons and repossession links. A unit already moved by a transfer before the migration has lost its
   receipt's reason, and the imported stock carries no reason, so both read Brand New.
2. **Aging filters** (revised by Karms, 2026-11-05): As of / Location / **Type** = item type (first named Group, renamed Type the same day) (`ItemType`: Appliance,
   Small Item…) / **Category** = the item category tree, roots and subgroups listed as "Root › Subgroup" (a root
   matches every subgroup under it, which fixes the old exact-match bug) / **Classification** (from `receivedAs` as in
   1). The export uses the same names: Subgroup = the item's own category, Type = item type, Category = its root
   category. This differs from the client's aging sample, which calls the item type "Category". Picking a Type narrows the
   Category list to categories holding items of that type, plus the root above each
   (`GET /inventory/categories?typeId=`), and clears a Category already picked. Export to Excel sits at
   the top right of the report header (Karms, 2026-11-05).
3. **Process button** on the Aging screen: filters are staged and the report reloads only when Process is clicked. The
   export uses the last processed filters.
4. **Remarks** = a preset tag (Found on main shelf / Defective / Yellowish / Lacking parts) **plus** free-text detail
   (location / ref. no.).
5. **Submit is allowed** with an unchecked line that has no remark. That line is an unaccounted reconciling item, and
   the printout flags it.
6. **Non-serial lines** keep counted-qty entry, plus Remarks. Serial lines get the In Store? checkbox.
7. `/inventory/counting?tab=counts` **redirects** to Stock Report → Physical Inventory. Stock Adjustments, Mobile
   Count and Batches stay there. The **Create Adjustment** tab stays inside the session.
8. **Printout:** As Of = the date the count **started** (the snapshot). Sign-off uses the sample's fixed slots
   (Prepared by, Approved by, 4 Witness).
9. **Scope:** all 4 parts, one at a time, each manually confirmed before the next.

## What the client asked for

1. **Stock Count → Physical Inventory.** Move the Stock Count sub-feature under the Stock Report feature and rename it
   Physical Inventory. They want a new count-sheet form, a printout once the count is submitted, and a signature sheet
   for the branch's employees.
2. **Aging of Inventory.** The on-screen report is fine. The **Export to Excel** should carry more data than the
   screen, as in their sample sheet.

### Their sample count form ("Count Session")

- Header: "Count Session", warehouse · date, **Cancel**, close. One tab: **Count Sheet**.
- Helper text: "Expected quantities come from the system's stock balance at the moment this count started — they
  can't be edited. Enter what you actually counted; anything found that isn't already listed can be an (optional)
  reason for discrepancy."
- Columns: **Serial Number** (pill) · **Brand** · **Model** (item name in small text under it) · **In Store?**
  (checkbox) · **Remarks** (dropdown with icon and tone): ✓ Found on main shelf (neutral), ✕ Defective (red),
  ⚠ Yellowish (amber), ⚠ Lacking parts (purple).
- Footer: **+ Add Found Item** (left), **Submit Count** (right, purple).

### Their sample printout (after a successful submit)

**Page 1: Monthly Physical Inventory**

- "NIG MARKETING CORPORATION" top right. Title "MONTHLY PHYSICAL INVENTORY". **AS OF:** date, **BRANCH:** name.
- **Note:**
  - Serial numbers **checked "In Store?"** in the ERP Count Sheet were found in both the system and the actual count.
  - Serial numbers **left unchecked** were in the system's stock balance when the count started but were not found in
    the actual count. These are **RECONCILING ITEMS**.
  - Every reconciling item must be accounted for individually by serial number, with its exact location and a
    supporting reference document number entered in Remarks. A blank, vague or unsupported remark does not count as
    reconciled.
  - A reconciling item that is not located and supported when this report is submitted is treated as unaccounted for
    and remains a variance in this report.
  - Items found in the actual count that were not already listed are recorded through Add Found Item.
- Certification: "We hereby certify that the above Physical Inventory was done accurately and in our presence. We
  further certify that the report submitted is true and correct to the best of our knowledge. We further understand
  that any false information given with regard to the Physical Inventory may result in Serious Disciplinary Action or
  possible grounds for Termination."
- Sign-off: **PREPARED BY:** Stock Custodian · **APPROVED BY:** BSM/OIC · **WITNESS:** 4 × "Signature over printed
  name".
- Footer: "NIG Marketing Corporation – Monthly Physical Inventory", "Page 1".

**Page 2: Stock Count Sheet**

- Same header, title "STOCK COUNT SHEET", AS OF, BRANCH, and an instruction line ("Tick In Store? for each serial
  number actually found. For unticked items, enter the exact location and reference document number in Remarks.").
- Table: **No. · Serial Number · Brand · Model** (item name under it) **· In Store? (☐/☑) · Remarks (location / ref.
  no.)**, then a few blank numbered rows for hand entry.
- "Items found but not listed (record through Add Found Item): serial no. / brand / model / location" with ruled
  lines.

### Their sample Aging export

- **Two bucket tables** side by side: **Age buckets (by Inbound Age)** and **Age buckets (by In-store Age)**. Each has
  rows 0-6 months / 7-14 months / 15 months and up / Total, with **Units** and **Peso value** columns.
- **Filters** block: As of date, Location, Category, Classification.
- Detail columns (15): **Serial · Model · Brand · Subgroup · Group · Category · Branch/Warehouse · Classification · RR
  Date From Supplier · Inbound Age · RR Date from Whse/Branch · RR Number · Origin · Store Age · Cost**.

## Current state (verified 2026-11-05)

### Physical Inventory

- **Nav:** the sidebar's Inventory section has **Stock Report** → `/inventory/reports` only
  (`src/components/layout/SideBar.tsx:264`). Stock Counts live at `/inventory/counting` (`CountingHub`, tabs Stock
  Counts / Stock Adjustments / Mobile Count / Batches), which is hidden from the nav. Stock Adjustments is reached
  from Stock Transaction.
- **Stock Report page** (`inventory/reports/page.tsx`, `ReportsDashboard`) renders the Aging report only, gated on
  `REPORTS_VALUATION` or `REPORTS_TURNOVER` at the page and `REPORTS_TURNOVER` for the aging section. There are no
  tabs.
- **Count Session** (`stock-counts/_components/CountSessionView.tsx`): tabs Count Sheet / Create Adjustment. Every line
  (serial lines too) is item label + serial chip · system qty · a **typed Counted qty** · Variance · remove. Serial
  lines expect "1" for each unit found, and a blank is treated as missing on submit. Found items/serials are picked
  from native `<select>`s. There are no Brand/Model columns, no In Store? checkbox and no Remarks.
- **Backend `StockCountLine`** (`prisma/schema.prisma:7166`): `systemQty`, `countedQty`, `countedAt`,
  `serialNumberId`, `locationId`, `batchId`. It has **no remarks/notes column**.
- **Print:** there is no print view for a count.

### Aging

- **Screen** (`inventory/reports/_components/AgingReport.tsx`) already matches the client's screenshot: 4 cards, the
  As of / Location / Category / Classification filters, 7 columns, Total Cost. The only visible difference is that
  the mockup has a **Process** button, whereas ours reloads on every filter change.
- **Export** (`backend/src/inventory/services/reports.workbook.ts:409`, `buildInventoryAgingWorkbookSpec`) draws a
  copy of the screen: one set of cards (by Inbound Age), a filters row, and the same 7 columns.
- **Data** (`AgingEntry`, `reports.service.ts:58`) already carries `typeName` (Classification), `rrNumber`, `origin`,
  `receivedAt` (RR date from supplier), `locationSince` (RR date at current location), `inboundMonths` and
  `storeMonths`. It is **missing Subgroup, Group and Category** per unit. The summary buckets by inbound age only,
  with no store-age buckets.

## Closing the gaps

### Part 1 — Aging export matches the client's sheet (BE only)

- Add `categoryName`, `groupName` and `subgroupName` to `AgingEntry` (join through the item's category and
  group/subgroup; the two classifications stay separate, see Category vs Group/Subgroup).
- Add a store-age summary (`summaryByStoreAge`, bucketed on `storeMonths`) beside the existing inbound-age summary.
  Return it from the export only, unless the screen wants it too.
- Rewrite `buildInventoryAgingWorkbookSpec`: two bucket tables (Units + Peso value), the filters block, and the
  15-column detail table in the client's order, with Cost totalled.
- **Tests:** a unit spec for the workbook spec (column order, both bucket tables add up to Total); e2e on
  `/inventory/reports/aging/export` with units aged differently by inbound vs store age.

### Part 2 — Physical Inventory: rename and move under Stock Report

- Stock Report gets tabs: **Aging of Inventory** | **Physical Inventory**. Each tab is gated by its own permission
  (`REPORTS_TURNOVER` for aging, `STOCK_COUNT_READ` for Physical Inventory). The page gate becomes `canAny` of both.
- Physical Inventory renders the existing `StockCountList` / `CountSessionView` relabelled: "Stock Count" → "Physical
  Inventory" in titles, buttons, toasts and the create modal.
- The Stock Report nav item's `requiredPermission` widens to include `STOCK_COUNT_READ`.
- `/inventory/counting` keeps working for Stock Adjustments, Mobile Count and Batches. Its Stock Counts tab either
  redirects to the new place or is dropped (decision 3).

### Part 3 — Count Sheet: In Store? checkbox and Remarks

- **BE:** a migration adding `remarks String?` to `StockCountLine`. Accept `remarks` on the line update/submit DTOs
  and the add-found-line DTO, and return it plus brand / model / item name on `get-count-lines`.
- **FE** (serial lines): a table with Serial Number · Brand · Model (+ name) · **In Store?** checkbox · **Remarks**.
  Checked writes `countedQty = 1`, unchecked writes `0`. Remarks is a `SearchableSelect` or free text (decision 1).
  Found serials/items use `SearchableSelect` instead of the native `<select>`s.
- Non-serial lines keep the counted-qty input (decision 2).
- Submit rule (decision 4): whether every **unchecked** line must have a remark before Submit Count is allowed.
- **Tests:** e2e: start a count, check some lines, leave one unchecked with a remark, add a found serial, submit; the
  remarks persist and the unchecked line produces the variance.

### Part 4 — Printout

- A print view for a **completed** count (button on the completed Count Session and the list row). Page 1 is Monthly
  Physical Inventory (note, certification, sign-off). Page 2 onwards is the Stock Count Sheet with the actual lines,
  their In Store? state and remarks, a few blank rows, and the "Items found but not listed" lines.
- Reuse the existing print pattern (the CRM aging report's `PrintButton` / print CSS) rather than a PDF library.
- Company name, branch and As Of come from the count (warehouse, `completedAt` or the start date; see decision 5).

## Re-verification (2026-11-05)

- **Category / Group / Subgroup** (corrects Part 1 above): there are no `ItemGroup`/`ItemSubgroup` tables any more
  (they were folded into `ItemCategory` in backend #97). Group = root `ItemCategory`, Subgroup = its child, and items
  point at the Subgroup (`primaryCategoryId`). The client's **Category** is `ItemType`.
- **Existing bug:** the aging Category filter was `primaryCategoryId = :id`, so a root Group returned almost nothing.
  Fixed in Part 1 (decision 2).

- **Category dropdown data:** three item types are duplicate spellings with no stock: Appliances (3 items),
  FurnitureNon3E (2), SplitType (1). They show in the Category filter and always return nothing. This needs master-data
  cleanup (move the items onto Appliance / Furniture Non3E / Split Type), not code.

## Open decisions (answered above under Decisions)

1. **Remarks: fixed list or free text?** The mockup is a dropdown (Found on main shelf / Defective / Yellowish /
   Lacking parts), but the note requires "exact location and a supporting reference document number" for unchecked
   items, which only free text can hold. Possible answer: preset tags plus a free-text detail field.
2. **Non-serial items:** keep quantity entry in Physical Inventory, or is this count serial-only?
3. **`/inventory/counting`'s Stock Counts tab:** remove it, or redirect it to Stock Report → Physical Inventory?
4. **Can a count be submitted with unchecked lines and no remark?** The note says such an item "remains a variance",
   which suggests yes (allowed, shown as unaccounted), but it needs confirming.
5. **As Of date:** the date the count started (the snapshot) or the date it was submitted?
6. **Signature sheet:** the doc says "all employees of the branch to sign", but the sample has fixed slots (1 Prepared
   by, 1 Approved by, 4 Witness). Keep it fixed, or list the branch's employees by name?
7. **Create Adjustment tab:** does it stay inside the Physical Inventory session?
8. **Process button** on the Aging screen: add it (filters apply only on Process), or keep reload-on-change?

## Related ClickUp Tickets

_None yet._

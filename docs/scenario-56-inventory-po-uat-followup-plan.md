# Scenario 56 — Inventory & PO UAT Follow-up (In Transit, Stock Balance, Ledger, Reports) — Gap Analysis

**Source**: client UAT checklist relayed by the developer, 2026-09-21 (Inventory, PO, PO/RR workflow, Stock Balance, Serial Number, Ledger and Reports sections). Each line was checked against the code in both repos by 4 parallel read-only passes on `development` @ `86d5338b`. Key findings were spot-checked by hand.

This doc covers only the lines that are **missing or partly done**. Standalone RR follow-ups (repair/repossession reason, optional supplier) are **out of scope** because [Scenario 55](./scenario-55-standalone-rr-repair-repossession-plan.md) already covers them.

## Related ClickUp Tickets

Not checked yet. Run a `clickup_search` before implementing.

## Related docs

- [scenario-50-inventory-uat-batch-plan.md](./scenario-50-inventory-uat-batch-plan.md): the previous inventory UAT batch. It built the Stock Balance search/filters, the Ledger column cut and "Deliver to" on the PO print. Its note that the In Transit filter was removed is out of date; the filter is back (`StockBalanceList.tsx:54-60`).
- [scenario-53-manual-rr-accounting-plan.md](./scenario-53-manual-rr-accounting-plan.md), [scenario-55-standalone-rr-repair-repossession-plan.md](./scenario-55-standalone-rr-repair-repossession-plan.md): the standalone RR work.
- [scenario-46-ap-payment-disbursement-plan.md](./scenario-46-ap-payment-disbursement-plan.md): the DR-first / SI-later swap, which is already done.

Paths: `INV` = `frontend/src/app/(app)/(dashboard)/inventory`, `BE` = `backend/src`.

---

## What's already done ✅ (no work needed)

| Line                                                                   | Evidence                                                                                                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supplier address editable                                              | `INV/suppliers/_components/SupplierFormModal.tsx:476-493` → `PATCH /suppliers/:id`. It is a single free-text field.                                     |
| Destination location printed on PO                                     | `frontend/src/libs/print/printInventoryDocument.ts:661-691, 822-830`; `PurchaseOrderSheet.tsx:119-126`                                                  |
| Supplier invoice # after DR (DR first, SI later)                       | `receive-po/receiveSchema.ts:94-101`, `DeliveryDetailsPanel.tsx:117-149`; the SI is added later through `update-receiving-report.ts` (RR detail → Edit) |
| Standalone RR without a PO (base)                                      | `ReceiveStockModal.tsx` from Stock → Receiving Reports; Accounting Manual RR (Scenario 53)                                                              |
| Stock Balance: Location column removed                                 | `StockBalanceList.tsx:372-388`                                                                                                                          |
| Stock Balance: multi-select location filter                            | `StockBalanceList.tsx:317-328` (`SearchableSelect multiple`)                                                                                            |
| Stock Balance: search brand/model/category + Operations + All Branches | `StockBalanceList.tsx:276-328`; `BE/inventory/services/stock.service.ts:4168-4185`                                                                      |
| Serial Number: unit cost column removed                                | `INV/serial-numbers/_components/SerialNumberList.tsx:501-522`                                                                                           |
| Serial Number: repair-type states shown                                | `SerialStatusPill`: In Repair / Defective / Held / Pulled Out                                                                                           |
| Ledger: search bar + invoice/DR/RR detail                              | `goods-receiving/_components/StockLedgerTab.tsx:243-272, 62-147`                                                                                        |
| Ledger: unit cost / value / accounting columns removed                 | Current columns are Type · Item · Location · Source · Qty · Date. Customer and Notes were removed too.                                                  |
| Reports: search bar                                                    | `ReceivingReportsTab.tsx:514-540`                                                                                                                       |

---

## What's not done / gaps ❌⚠️

### A. In Transit (the biggest gap; needs backend first)

1. **Serials have no in-transit state.** `SerialNumberStatus` = `in_stock, held, sold, returned, defective, scrapped, in_repair, pulled_out, lost_in_transit` (`backend/prisma/schema.prisma:4643-4653`). Dispatching a transfer doesn't touch the serial row (`BE/inventory/services/transfers.service.ts:1235-1320`). A dispatched unit stays `in_stock` at the source warehouse.
2. **In-transit units can be transferred again.** ❌ The dispatch check only tests `in_stock` + source warehouse (`transfers.service.ts:518-527`). The open-transfer check exists only on the POS request path (`transfers.controller.ts:198-211`, `utils/open-transfer-status.util.ts`). Every frontend picker filters on `status:'in_stock'` only: `TransferDetailModal.tsx:202-211`, `CreateTransferModal.tsx:219-228`, `item-360/tabs/StockTab.tsx:222-224, 363`. The backend already returns `openTransfer` on serials (`serial-numbers.service.ts:425-450`), but only POS checkout reads it.
3. **"In transit" is missing from the Serial Number status dropdown.** ❌ The dropdown comes from `SerialStatusSchema` (`frontend/src/schema/inventory/serial-numbers/index.ts:4-27`).
4. **The Serials page's "In Transit" metric is mislabelled.** It counts `pulled_out` (`SerialNumberList.tsx:258-262`, `useSerialNumbers.ts:198-204`), and `pulled_out` is only set by UDS repossession (`uds.service.ts:393`).
5. **In Transit is never shown as a status.** ⚠️ The Stock Balance Status column only shows In Stock / Low / Fully Reserved / Out (`StockBalanceList.tsx:84-89`). In Transit is a filter option only (`:54-60`); the backend works it out through `resolveInTransitMap` (`stock.service.ts:4426-4453`). The Item 360 header uses the same 4 states (`Item360Drawer.tsx:58-69`). The per-location badges use a third vocabulary, Out / Critical / Low / Healthy (`StockTab.tsx:16-30`). Item Master shows no stock status at all.

### B. Stock Balance tab

6. **Columns don't match the spec.** ⚠️ Current: Item | **Category** | On Hand | Sold | Reserved | Available | **Status**. Spec: item | on hand | sold | reserve | available. The spec also asks for a Status column (see the open decision).
7. **The drawer ignores the table's Operations/Category/Stock-state filters.** ⚠️ Only `locations` is passed in (`StockBalanceList.tsx:171-182` → `item-360/useItem360.ts:25-80`). The serial endpoint has no `region` param. Picking "Panay" still shows every location in the drawer. Its serial list also includes sold units (`StockTab.tsx:214-216`).
8. **Serial search is per location only.** ⚠️ It only exists inside an expanded location row (`StockTab.tsx:309-325`). There is no Serials tab (`Item360Drawer.tsx:21-28` says this was on purpose).
9. **No transfer history on the Balance tab.** ⚠️ It's only in the drawer's Movements tab and the per-serial timeline.
10. **No age per serial.** ❌ `formatAge()` (`frontend/src/libs/format/date.ts:55-66`) has no callers. RR age can come from the RR `receivedAt`. **Branch age has no data**: `SerialNumber` has no "arrived at current location" timestamp.

### C. Ledger tab

11. **Can't add entries from the Ledger tab.** ❌ The header only has Refresh (`StockLedgerTab.tsx:210-230`). `POST /inventory/adjustments` exists (`adjustments.controller.ts:50,112`) but is only called from stock counts (`inventory/stock-counts/_actions/create-adjustment.ts`).
12. ~~**Serial / RR / invoice / DR / SI are combined, not separate columns.**~~ ✅ **Accepted as is** (developer, 2026-09-21). The combined "Source" column plus the SN line under Item stays.
13. **Transfer-in rows aren't linked to their RR.** ⚠️ The transfer receipt creates a GoodsReceipt with `stockTransferId` (`transfers.service.ts:1809-1834`). The `transfer_in` ledger rows are still written without `goodsReceiptLineId` (`:1530-1542, 1717-1729`). The ledger shows the ST number but never the RR code, and searching by that RR code misses the row.

### D. Reports tab (Receiving Reports)

14. **Lines column is still there.** ❌ Header `ReceivingReportsTab.tsx:663-665`, cell `:714-716`, skeleton `:600`, mobile card `:785-794`, CSV `:411, 426`, grid track `:61-63`.
15. ~~**No separate Supplier column.**~~ ✅ **Accepted as is** (developer, 2026-09-21). The supplier stays inside "Source / Ref."
16. **Partial invoicing shows a false variance.** ⚠️ Each RR auto-creates a draft AP bill priced on received quantity (`stock.service.ts:1512-1545`, `ap-bills.service.ts:308-399`). The 3-way match compares that bill to the **full PO total** (`ap-bills.service.ts:454-515`), so a correct partial bill shows "Variance" in `accounting/ap-bills/_components/BillForm.tsx:403-410`. RR detail "Ordered" shows the full PO line qty, not the outstanding qty (`ReceivingReportDetail.tsx:239-279`). The list shows no delivery-complete or billed status per row.
17. **Can't search Reports by SI or DR number.** ⚠️ The Ledger can (`stock.service.ts` ~5232-5265).

### E. PO

18. **PO → Inventory → PO shows a stale status or the wrong page.** ⚠️ No fix was found, and there's no confirmed repro yet. Likely causes: (a) `['purchase-order', id]` is never invalidated after approve/send/close/cancel (`usePurchaseOrders.ts:72-195` only clears `['purchase-orders']`), and the stale entry is kept for 5 min (`provider/query-provider.tsx:28-29`); (b) the status pill filter lives in local state, not the URL (`usePurchaseOrders.ts:27`); (c) the Inventory links to POs don't carry `?po=<id>` (`inventory/page.tsx:1094,1112-1117`, `StockLedgerTab.tsx:119-121`).
19. **PO description isn't marked internal-only.** ❌ The line `description` is printed (`printInventoryDocument.ts:724, 837`) and shown on `PurchaseOrderSheet.tsx:137,159`. The only input for it is labelled "Description (pricing breakdown)" (`ConvertPrToPoModal.tsx:477-495`). The create/edit PO form has no description field (`PurchaseOrderFormFields.tsx:146-205`). PO-level `notes` is not printed and has no label.

### F. Inventory general / workflow

20. **Add Item form is too long and hard to find.** ⚠️ Saving works (`INV/items/_actions/create-item.ts`). The form has Basic Info, Pricing + costing method, 6 tracking flags, dimensions/weight/warranty/tags, initial stock, images and accounting overrides (`CreateItemModal.tsx:342-921`). It is only reachable from Catalog; the Stock page has no Add Item button. Side issue: `initial*` fields leak into the `POST /inventory/items` body and are only dropped because the backend strips unknown fields.
21. **Location filter is single-select outside Stock Balance.** ⚠️ Serial Numbers (`SerialNumberList.tsx:355-363`); Ledger (`StockLedgerTab.tsx:274-283`, and `useStockLedger.ts:56-66` collapses the Balance tab's multi-selection to one `warehouseId`); Transfers (`TransferList.tsx:524-540`).
22. **Brand/model/category + Operations search only exists on Stock Balance.** ⚠️ Item Master searches name/serial only (`ItemMasterList.tsx:181`). Serials and Ledger have no Operations filter.
23. **It isn't clear who requests stock from whom.** ⚠️ From/To labels are clear (`CreateTransferModal.tsx:894-1037`, `TransferDetailModal.tsx:1125-1163`), but "Requested by" is a person, not a branch. The list has no incoming/outgoing split (`TransferList.tsx:675-722`).

---

## Open decisions (ask the developer before building)

| #   | Question                                                                                                                                               | Recommendation                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | How should "in transit" work for serials: a real `in_transit` status set on dispatch and cleared on receive/cancel, or worked out from `openTransfer`? | **Real status.** It's filterable, shows up everywhere without extra joins, and makes the dispatch check simple. Receive sets `in_stock` at the destination; cancel/reject after dispatch returns it to `in_stock` at the source. Keep `lost_in_transit` as the loss state it is now. |
| D2  | Stock Balance: the spec lists 5 columns but also asks for a Status column. Keep Status? Drop Category?                                                 | Drop **Category**, keep **Status** (now including In Transit), rename "Reserved" → "Reserve" only if the client wants it literally.                                                                                                                                                  |
| D3  | What does "add entries" on the Ledger mean: a stock adjustment (+/- with a reason) or a freeform ledger row?                                           | **Stock adjustment**, using `POST /inventory/adjustments`. A freeform ledger row would bypass the GL posting.                                                                                                                                                                        |
| D4  | Ledger: separate Serial / RR / Invoice / DR / SI columns (the client's wording), or keep the combined Source column (Scenario 50's choice)?            | **Resolved 2026-09-21: keep as is.**                                                                                                                                                                                                                                                 |
| D5  | Reports: a separate Supplier column?                                                                                                                   | **Resolved 2026-09-21: keep as is.**                                                                                                                                                                                                                                                 |
| D6  | Transfer history on the Balance tab: a new sub-tab, an expandable row, or opening the drawer on the Movements tab?                                     | Open the drawer on **Movements** filtered to transfers, plus a "Transfers" link on each row. That's the lowest cost with no new endpoint.                                                                                                                                            |
| D7  | Serial search in the drawer: add a Serials tab back, or one search box above all locations in the Stock tab?                                           | One search box across all locations in the Stock tab. It keeps the no-Serials-tab decision.                                                                                                                                                                                          |
| D8  | Serial age: how do we get "branch age" for existing serials?                                                                                           | Add `SerialNumber.locationSince DateTime?`, set it on receive/transfer-in, and backfill from each serial's latest inbound `StockLedger` row.                                                                                                                                         |
| D9  | Add Item: which fields go?                                                                                                                             | Candidates: dimensions/weight, costing method (default from settings), the 6 tracking flags (keep only Serial), Item Type, accounting overrides (move to edit only). Confirm with the client.                                                                                        |
| D10 | PO description: hide it from print only, or also add a description input to the create PO form?                                                        | Label it **"Internal notes — not printed"**, drop it from print and the supplier-facing sheet, and add the same field to the create/edit form.                                                                                                                                       |
| D11 | PO navigation bug: exact repro steps?                                                                                                                  | Get the click path from the reporter. Build the three likely fixes regardless; they're cheap and correct.                                                                                                                                                                            |
| D12 | Partial invoicing: compare the 3-way match against the received qty, or against the PO qty outstanding at bill time?                                   | **Received qty on the linked RR.** It matches the one-RR-one-bill rule.                                                                                                                                                                                                              |
| D13 | Should the brand/model/category/Operations search be on every inventory list, or only Stock Balance?                                                   | Serial Numbers and Ledger. Skip Item Master (a catalog list, not stock).                                                                                                                                                                                                             |

---

## Parts to build (proposed order; backend first within each part)

Each part gets its own e2e coverage and manual test steps, and stops for developer confirmation before the next one starts (per `implement-scenario`).

1. **Quick frontend cleanups** (no backend). Gaps 4, 6, 14, 19, and the leaking `initial*` fields in 20.
   - Remove Lines from Reports: table, mobile card, CSV and grid.
   - Stock Balance columns per D2.
   - PO description labelled internal and dropped from print and `PurchaseOrderSheet` per D10.
   - Fix the mislabelled "In Transit" metric: rename it to Pulled Out for now; Part 2 swaps it for the real count.
   - Strip the `initial*` fields from the create-item body.
2. **In Transit, backend.** Gaps 1, 2.
   - `in_transit` enum value and migration.
   - Set on dispatch; clear on receive and on cancel/reject after dispatch.
   - Dispatch and create-transfer reject serials that are `in_transit` or on an open transfer, using the same check as the POS path.
   - Stock Balance `inTransitQty` works as before.
3. **In Transit, frontend.** Gaps 3, 5, and the transfer-picker part of 2.
   - Add to `SerialStatusSchema`, the dropdown and the pill.
   - All transfer pickers exclude in-transit and open-transfer serials.
   - Stock Balance status and drawer badges show In Transit.
   - Merge the three status vocabularies into one helper.
   - Item Master status badge.
4. **Stock Balance drawer and filters.** Gaps 7, 8, 9.
   - Pass region/category/status into the drawer.
   - Serial endpoint gains a `region` param and defaults to hiding sold units.
   - One serial search box across locations (D7).
   - "Transfers" entry point on each row (D6).
5. **Serial age.** Gap 10, per D8.
   - Backend `locationSince`, set on receive/transfer-in, plus backfill.
   - Frontend shows "RR age" (from the RR `receivedAt`) and "Branch age" per serial chip and in the Serial Numbers table using `formatAge()`.
6. **Ledger.** Gaps 11, 12, 13.
   - Backend: write `goodsReceiptLineId` on `transfer_in` rows plus a backfill, so the RR code shows and is searchable.
   - Frontend: "New adjustment" modal wired to `POST /inventory/adjustments` (D3).
   - Keep the combined Source column as is (D4).
7. **Reports & partial invoicing.** Gaps 16, 17.
   - Backend: 3-way match against the RR's received qty (D12); search by SI and DR.
   - Frontend: "Ordered / Previously received / This delivery" on RR detail; Delivery (Complete / Partial) and Billed status on each row.
8. **PO navigation fix.** Gap 18.
   - Invalidate `['purchase-order']` on every PO mutation.
   - Status filter in the URL (`?status=`).
   - Inventory → PO links carry `?tab=orders&po=<id>`.
9. **Filters across lists.** Gaps 21, 22.
   - Multi-select location on Serial Numbers, Ledger and Transfers. Ledger and Serials need backend `warehouseIds` CSV support; drop the `useStockLedger` collapse.
   - Operations filter and brand/model/category search on Serials and Ledger (D13).
10. **Transfer clarity.** Gap 23.
    - "Requesting branch" and "Supplying branch" labels in detail and list.
    - Incoming / Outgoing pills in the Transfers list, relative to the viewer's branch.
11. **Add Item.** Gap 20.
    - Slim the form per D9.
    - Add an Add Item button on the Stock page (same `CreateItemModal`).

Parts 1, 8 and 10 are frontend-only and independent, so they can start before the decisions on Parts 2–7 are made.

---

## Implementation Log

_Empty. Filled in by `implement-scenario` as parts land._

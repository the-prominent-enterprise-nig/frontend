# Scenario 71 — Inventory Client Feedback Batch (RR Printable, PO, Debit Memo, Stock Transfer / Dispatch) — Gap Analysis & Closing Plan

**Source**: two client meeting notes, cross-referenced. **Meeting notes 1** is the scope-defining document — this plan covers only its `INVENTORY` section. **Meeting notes 2** is a later, broader pass whose own `6. Inventory` section overlaps notes 1; it is used here to confirm, sharpen or contradict notes 1's wording, and its inventory-only extras are logged at the end rather than built.

Like Scenario 64, this is not one feature. It is 25 separate client notes across four inventory surfaces at wildly different sizes — nine are pure frontend edits, three are already built, one is a data-entry task with no code change at all, and one needs a migration plus a rethink of how supplier debit memos apply to AP.

Verified against the working tree on **2026-10-10** (frontend `a4bb92ce`, backend `2217f68`, both on `feat/daily-collection-sales-monitoring-sheet`).

---

## Verdict table

| #   | Client note (notes 1)                                           | Verdict                 | Why                                                                        |
| --- | --------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------- |
| 1   | RR printable needs the PO date — currently blank                | ✅ **Today**            | `poDate` is only ever written by the standalone form; PO's own date unread |
| 2   | Spell the meta labels out — RR No. / RR Date / PO No. / PO Date | ✅ **Today**            | Four strings, in two files that must move together                         |
| 3   | Put the supplier address on the RR                              | ✅ **Today**            | `supplier.address` is already in the envelope and never rendered           |
| 4   | Put the branch below the supplier address, on the left          | ✅ **Today**            | Branch sits in the right-hand enterprise column today                      |
| 5   | Rename "Dated" to "P.O. Date"                                   | ✅ **Today**            | Same string set as 2 — but see the Transfer-No. caveat                     |
| 6   | RR receipt: "date is RR date"                                   | ✅ **Today**            | Duplicate of 2 — the label, not the value, is wrong                        |
| 7   | Transfer the branch name above the table                        | 🚧 **Conflicts with 4** | Notes 1 says two different places; notes 2 says "to the left". See below   |
| 8   | PO — add decimal for numerals (prices)                          | ➖ **Already built**    | Every PO price input and display already carries centavos                  |
| 9   | PO — make location optional                                     | ✅ **Today**            | Column and DTO are already optional; only the zod schema forces it         |
| 10  | PO — add a Date field                                           | ✅ **Today**            | `orderDate` exists with a `now()` default; nothing lets a buyer set it     |
| 11  | PO — if tax exempt, retain the original price                   | ➖ **Already built**    | Both VAT models already leave an exempt line's cost untouched              |
| 12  | PO — CR for downpayment (optional for cash)                     | ➡️ **Not inventory**    | Collection receipts are POS/AR — see _Out of scope_                        |
| 13  | PO — invoice number as primary key on recent transactions       | ➡️ **Not inventory**    | POS Recent Transactions — see _Out of scope_                               |
| 14  | Debit memo — do not reference a supplier invoice                | ❌ **Migration**        | `SupplierDebitMemo.apBillId` is `NOT NULL` and drives the posting          |
| 15  | Debit memo — accounts decides which invoice it applies to       | ❌ **Depends on 14**    | Same column; this is the workflow half of the same change                  |
| 16  | Debit memo — trigger on delivery receipt creation               | 🚧 **Needs decision**   | No "delivery receipt" document exists on the outbound/return side          |
| 17  | Dispatch — inbound age beside the serial number                 | ✅ **Today**            | Both ages already ship in the picker's own response, unused                |
| 18  | Dispatch — don't re-pick a serial we already chose              | ➖ **Partly built**     | Already skipped for pinned lines; the real gap is a misleading picker      |
| 19  | Dispatch — make the serial number visible                       | ✅ **Today**            | Pre-dispatch the serial column is suppressed by design                     |
| 20  | Dispatch — serial number black and bigger                       | ✅ **Today**            | Pills are 12px purple on a purple chip                                     |
| 21  | Dispatch — make the modal full                                  | ✅ **Today**            | Drawer is capped at `min(860px, 94vw)`                                     |
| 22  | Do not link the driver name to a vehicle                        | ✅ **Today**            | One pick writes both fields today                                          |
| 23  | Receiving — do not auto-populate the check mark                 | ✅ **Today**            | Deliberately pre-ticked; reverses a documented decision                    |
| 24  | Put the stock transfer date and the RR date on the document     | ✅ **Today**            | Receipt dates are already in the envelope, never printed                   |
| 25  | Panay warehouse has no address on the stock transfer receipt    | 📋 **Data only**        | **No code change.** The field exists and is editable; the row is blank     |

**Shippable without a migration: 1, 2, 3, 4, 5, 6, 9, 10, 17, 18, 19, 20, 21, 22, 23, 24** — sixteen items. Two of those (7 and 23) need a one-line answer first; both are in _Decisions needed_.

**Needs a migration: 14, 15** (one column, one posting path).
**Data entry, no build: 25.**
**Not inventory: 12, 13.**

---

## Cross-referencing the two meeting notes

Notes 2 touches the same ground in three different ways. Worth separating, because two of the three change what should be built.

### Notes 2 confirms and sharpens notes 1

- **The RR meta labels.** Notes 1 says _"we need a PO date in RR… RR date, PO date, RR no."_ and, further down, _"dated rename to P.O date"_. Notes 2 states it as a rule and gives the full list: _"Spell out 'Date' in full on all documents, for example: RR No. / RR Date / Reference / PO No. / PO Date"_. That resolves the ambiguity in notes 1 — the current `Ref` slot becomes **Reference**, which notes 1 never mentions. **Build notes 2's list.**
- **Inbound age at dispatch.** Both notes say the same thing (notes 1: _"add the inbound age beside the serial number"_; notes 2: _"In Stock Transfer, show inbound age beside the serial number"_). No conflict.
- **Driver and vehicle.** Both notes say not to link them (notes 2 gives it its own heading, _"7. Drivers and Vehicles"_). No conflict.

### Notes 2 contradicts notes 1 — item 7

Notes 1 says the branch goes in **two different places** in the same section: _"Put branch below supplier address / on the left"_ (RR printable) and _"transfer the branch name above table"_ (RR receipt). Notes 2 settles it one way: _"On the RR printout, move the branch name to the left and add the supplier address."_

Two of the three statements agree on **left, under the supplier**. Reading _"above table"_ as loose phrasing for "out of the right-hand column and into the header area above the line items" makes all three consistent. **Recommendation: build item 4 (left column, under the supplier address) and treat item 7 as the same note.** Flagged in _Decisions needed_ because it is an assumption, not a fact.

### Notes 2 adds inventory items notes 1 does not have

Logged, not built — the user scoped this plan to notes 1. All three are real and all three are verified below in _Notes 2 extras_:

- Low-stock definition per model (**needs a migration** — the model it would hang off was deleted).
- Selecting a supplier shows only that supplier's line items (**no migration** — the link table and API exist and are empty).
- The PO should generate Withholding Tax and Input Tax journal entries (**no migration**, but it is a design question, not a wiring job).

---

## What's already done ➖

Three of the twenty-five are already built, and in each case the code says so explicitly.

- **PO prices already take centavos** (item 8). `MoneyInput` in [PurchaseOrderFormFields.tsx:724-765](<../src/app/(app)/(dashboard)/inventory/purchase-orders/_components/PurchaseOrderFormFields.tsx#L724-L765>) holds the raw keystrokes in a `draft` while focused specifically so a typed `.` survives — its own comment records the bug that forced it: _"committing '12.' as the number 12 and echoing that back swallows the decimal point the moment it is typed, so centavos could never be entered at all."_ Every display agrees: `peso()` at [:51](<../src/app/(app)/(dashboard)/inventory/purchase-orders/_components/PurchaseOrderFormFields.tsx#L51>), [procurementTokens.tsx:44](<../src/app/(app)/(dashboard)/inventory/purchase-orders/_components/procurementTokens.tsx#L44>) and [PurchaseOrderSheet.tsx:51](<../src/app/(app)/(dashboard)/inventory/purchase-orders/_components/PurchaseOrderSheet.tsx#L51>) all pin two fraction digits, and every price input on the receive screen is `step="0.01"` ([LinePricingDrawer.tsx:112](<../src/app/(app)/(dashboard)/inventory/purchase-orders/_components/receive-po/LinePricingDrawer.tsx#L112>), `:166`, `:217`, `:258`). The only `step="1"` is quantity ([ReceiveLineRow.tsx:330-332](<../src/app/(app)/(dashboard)/inventory/purchase-orders/_components/receive-po/ReceiveLineRow.tsx#L330-L332>)), which is right for whole appliances. **Ask the client which screen they were looking at before touching anything** — there is nothing to fix on the ones checked.
- **A tax-exempt line already keeps its typed price** (item 11). `backend/src/inventory/services/stock.service.ts` runs two VAT models and neither alters an exempt cost. Header-driven: `netShare` is `1` unless the treatment is `inclusive` (`:1368-1374`), so `exempt` and `exclusive` both pass the cost straight through. Per-line: only a `VAT`-coded line is divided down (`:1388-1392`), _"every other code (Non-VAT/Exempt/none) leaves the typed cost as-is."_ A non-VAT-registered supplier forces `exempt` regardless of what the caller asked for (`:1344-1347`). Note that the **PO** itself computes no tax at all — `taxAmount` is `@default(0)` ([schema.prisma:6748](../../backend/prisma/schema.prisma#L6748)) — which is why this reads as already-done on the receiving side and as not-yet-designed on the PO side (notes 2's Input Tax item).
- **A serial pinned at request time is not re-picked at dispatch** (item 18, half of it). `openDispatchForm()` filters pinned lines out of the assignment list — [TransferDetailModal.tsx:919-926](<../src/app/(app)/(dashboard)/inventory/transfers/_components/TransferDetailModal.tsx#L919-L926>), whose comment states it: _"A line arriving with a serialNumberId already set… is only re-verified by the backend, never re-assigned — asking for it again here would be a pick that assignDispatchSerials then ignores."_ The backend agrees (`assignDispatchSerials`, `backend/src/inventory/services/transfers.service.ts:514-520`). **See gap 18 for what actually goes wrong.**

---

## What's not done / gaps ❌

### RR printable — items 1-7

Everything in this group has to be changed in **two files at once**. [printInventoryDocument.ts](../src/libs/print/printInventoryDocument.ts)'s `buildReceivingReportHtml()` builds the paper; [ReceivingReportSheet.tsx](<../src/app/(app)/(dashboard)/accounting/receiving-reports/_components/ReceivingReportSheet.tsx>) deliberately re-implements the same markup as React for the on-screen sheet. `receiving-report.ts`'s own doc comment warns about exactly this: _"three surfaces need to agree on it: the reports list, the printed RR, and the on-screen sheet… Those last two have drifted from each other before."_

1. **The PO date is blank on every receive-against-PO receipt.** ❌
   The printed slot reads `sourceRef.dated` ([printInventoryDocument.ts:208-209](../src/libs/print/printInventoryDocument.ts#L208-L209)), which resolves to `report.poDate` for a supplier receipt ([receiving-report.ts:82](../src/libs/format/receiving-report.ts#L82)). `GoodsReceipt.poDate` exists ([schema.prisma:6846](../../backend/prisma/schema.prisma#L6846)) but is written in **exactly one place** — `stock.service.ts:1509`, the standalone Receive Stock form, where the clerk types it. A receipt created through **Receive Against PO** never sets it, so the real PO's date is never carried over and the slot prints `—`. That is the client's "currently blank".
   The PO's own date is right there and unasked for: `getReceivingReport()` selects `purchaseOrderLine.purchaseOrder` with **`code` and `status` only** (`stock.service.ts:6326-6331`).
   **Fix**: add `orderDate: true` to that select, then fall back to it in `receivingReportSourceRef()` — `report.poDate ?? <linked PO's orderDate>`. **Backend: one field in one select. No migration.** The typed `poDate` must stay authoritative where it exists: a clerk who typed the supplier's PO date off the paper is restating the document, and a linked PO's `orderDate` currently defaults to row-creation time (see gap 10), which is not the same thing.

2. **The meta labels are abbreviated.** ❌
   Current, in both files: `No.` / `Date` / `Ref` / `P.O. No.` / `Dated` — [printInventoryDocument.ts:200-209](../src/libs/print/printInventoryDocument.ts#L200-L209) and [ReceivingReportSheet.tsx:172-199](<../src/app/(app)/(dashboard)/accounting/receiving-reports/_components/ReceivingReportSheet.tsx#L172-L199>).
   **Fix**, per notes 2's list: `RR No.` / `RR Date` / `Reference` / `PO No.` / `PO Date`.
   **Caveat on items 2 and 5 together**: the fourth slot is **not always a PO**. `receivingReportSourceRef()` swaps the whole slot to `Transfer No.` for stock arriving from another branch, and the comment explains why: _"stock arriving from another branch has no purchase order at all. Those receipts printed an empty 'P.O. No.' while the number that actually identifies the delivery… appeared nowhere on the paper."_ So "rename Dated to PO Date" cannot be a flat string swap — the `dated` label has to follow its sibling (`PO Date` beside `PO No.`, `Transfer Date` beside `Transfer No.`). Cleanest shape: have `receivingReportSourceRef()` return a `datedLabel` alongside `label`, so the swap stays in the one formatter both surfaces already share. The return path for a customer return (`Invoice No.` / `Dated`, [ReceivingReportSheet.tsx:178-186](<../src/app/(app)/(dashboard)/accounting/receiving-reports/_components/ReceivingReportSheet.tsx#L178-L186>)) needs the same treatment → `Invoice Date`.

3. **The supplier address is never printed, though it is already fetched.** ❌
   The party block renders the source name, an optional caravan subtitle and the driver/helper line — and stops ([printInventoryDocument.ts:194-197](../src/libs/print/printInventoryDocument.ts#L194-L197); the on-screen twin at [ReceivingReportSheet.tsx:150-158](<../src/app/(app)/(dashboard)/accounting/receiving-reports/_components/ReceivingReportSheet.tsx#L150-L158>)). Meanwhile `getReceivingReport()` has selected `supplier.address` all along (`stock.service.ts:6294`).
   **Fix**: render it under the source name. **Frontend only, both files.** It needs a guard, not an unconditional line: a transfer-sourced receipt has no supplier, and a repair/repossession receipt names a **customer** (`returnedBy`) whose address is not selected. Print the address only when `supplier?.address` is set, so the other three receipt kinds don't grow an empty row.

4. **The branch is in the right-hand enterprise column, not on the left.** ❌
   `Branch: <name>` is the third line of the enterprise block in both files ([printInventoryDocument.ts:214](../src/libs/print/printInventoryDocument.ts#L214), [ReceivingReportSheet.tsx:206-208](<../src/app/(app)/(dashboard)/accounting/receiving-reports/_components/ReceivingReportSheet.tsx#L206-L208>)). The client wants it on the left, under the supplier address.
   **Fix**: move the line from the third `div` to the first, below the new address line from gap 3. Both files. Pure markup — the value (`warehouse.branch.name ?? warehouse.name`) is already resolved server-side (`stock.service.ts:6447-6452`). See _Decisions needed_ for item 7.

### Purchase Orders — items 9, 10

9. **Location is required on the PO form, though nothing below it requires one.** ❌
   [schema/inventory/purchase-orders/index.ts:36](../src/schema/inventory/purchase-orders/index.ts#L36) — `warehouseId: z.string().min(1, 'Location is required')`, repeated for the PR→PO conversion at `:85`. Everything underneath is already optional: `PurchaseOrder.warehouseId` is `String?` ([schema.prisma:6741](../../backend/prisma/schema.prisma#L6741)) and `CreatePoDto.warehouseId` is `@IsOptional()` ([purchase-order.dto.ts:184](../../backend/src/inventory/dto/purchase-order.dto.ts#L184)). So the client's drop-ship case — _"sometimes they send supplier to customer directly"_ — is refused by the frontend alone.
   **Fix**: `.optional()` on both schemas, drop the required marker on the field. **Frontend only.**
   **Watch the printout.** `buildPurchaseOrderHtml()` resolves the "Deliver to" block from the warehouse and its branch ([printInventoryDocument.ts:690-696](../src/libs/print/printInventoryDocument.ts#L690-L696)) and already renders nothing at all when every part is empty (`:827-836`), so a location-less PO degrades cleanly today. But a drop-ship PO with no destination is a PO whose supplier is told nothing about where the goods go — worth asking whether the free-text `deliveryInstructions` should become **required when there is no location**, which is a frontend rule and no more work than the change itself.

10. **Nobody can set the PO's date.** ❌
    `PurchaseOrder.orderDate` is `DateTime @default(now())` ([schema.prisma:6743](../../backend/prisma/schema.prisma#L6743)) and the create path never passes one. It is absent from `CreatePoFormSchema` (the form carries only `expectedDeliveryDate`, [schema/inventory/purchase-orders/index.ts:33-42](../src/schema/inventory/purchase-orders/index.ts#L33-L42)) and absent from `CreatePoDto` ([purchase-order.dto.ts:170-195](../../backend/src/inventory/dto/purchase-order.dto.ts#L170-L195)). So a PO raised today for paperwork dated last Friday is stamped today — and that same wrong date is what the printout calls **"Issue date"** ([printInventoryDocument.ts:813-814](../src/libs/print/printInventoryDocument.ts#L813-L814)), and what gap 1 would carry onto every RR.
    **Fix**: an `orderDate` on the form schema (defaulting to today), on `CreatePoDto`/`UpdatePoDto`, and written in `create()`/`update()`. **No migration** — the column exists, nullable only by virtue of its default. Rename the printed label to **PO Date** while in there, for consistency with gap 2.
    Order of work matters: **10 before 1.** Backfilling a receiving report from a PO whose `orderDate` is really a row-creation timestamp prints a confidently wrong date, which is worse than the blank the client complained about.

### Stock Transfer dispatch — items 17-22, 24

17. **Neither age reaches the dispatch picker, though both are already in its response.** ❌
    `SerialNumber.firstReceivedAt` ("RR age") and `locationSince` ("branch age") both exist and are both maintained ([schema.prisma](../../backend/prisma/schema.prisma), Scenario 56). The picker's own query — `getSerialNumbers({ warehouseId, itemId, status: 'in_stock', freeForTransfer: true })` at [TransferDetailModal.tsx:215-227](<../src/app/(app)/(dashboard)/inventory/transfers/_components/TransferDetailModal.tsx#L215-L227>) — hits a `findMany` with no root `select` (`serial-numbers.service.ts:580-590`), so **both fields already come back**, and `SerialNumberSummary` already parses them ([schema/inventory/serial-numbers/index.ts:184-186](../src/schema/inventory/serial-numbers/index.ts#L184-L186)). The options are then flattened to `{ value: s.id, label: s.serialNumber }` and the ages dropped on the floor ([TransferDetailModal.tsx:342](<../src/app/(app)/(dashboard)/inventory/transfers/_components/TransferDetailModal.tsx#L342>)).
    **Fix**: surface them. **Frontend only, no backend change.** There is already a shared component for this exact pair — [SerialAges.tsx](../src/components/inventory/SerialAges.tsx), with an `inline` mode that renders `RR 5 Mo(s) · Branch 2 Mo(s)` for tight spots — and per CLAUDE.md it should be reused rather than re-formatted. One snag: `SearchableSelectOption` is `{ value, label, group? }` only ([SearchableSelect.tsx:12-18](../src/components/ui/SearchableSelect.tsx#L12-L18)), with no slot for a second line. Two routes, and this is a decision: append the age to `label` (zero component risk, but it is then part of the text the picker type-filters against), or add an optional `description` to `SearchableSelect` (correct, and the shared control is used in many places). **Recommend the `description` prop** — it is the smaller behavioural change of the two, since widening what the filter matches is a silent change to every other picker in the app.
    `SerialSearchCombobox` already has the right shape for this (`secondary` carries warehouse + status, [SerialSearchCombobox.tsx:57-61](<../src/app/(app)/(dashboard)/inventory/transfers/_components/SerialSearchCombobox.tsx#L57-L61>)) — but it is **not** the control the dispatch form uses for the normal path; `SearchableSelect` is, because Scenario 50 wanted multi-select. Don't fix the wrong file.
    **Which age is "inbound age"?** See _Decisions needed_.

18. **The create form's picker advertises serial search and does not do it.** ❌ — _this is the real content of item 18_
    The client's _"we already selected serial to send, no need to select again when dispatching"_ does not match the pinned-line path, which already works (see _What's already done_). It matches this: [CreateTransferModal.tsx:937](<../src/app/(app)/(dashboard)/inventory/transfers/_components/CreateTransferModal.tsx#L937>) renders `placeholder="Add item — search name, SKU, or serial…"`, but `ItemSearchCombobox` searches the **item catalog** — `getItems({ search })` ([ItemSearchCombobox.tsx:38-55](<../src/app/(app)/(dashboard)/inventory/purchase-requests/_components/ItemSearchCombobox.tsx#L38-L55>)) — and the `onSelect` handler appends `{ itemId, quantity: 1, itemLabel, itemSku }` with no serial ([CreateTransferModal.tsx:925-931](<../src/app/(app)/(dashboard)/inventory/transfers/_components/CreateTransferModal.tsx#L925-L931>)). So a requester who believes they picked a unit picked a **model**, and is then asked for the unit at dispatch. The copy caused the complaint.
    **This collides with a deliberate design decision**, which is why it needs an answer and not a patch. `validateSerialLineQuantities`' comment is explicit: _"The specific physical unit is deliberately NOT chosen here anymore — the requester can't know what's actually on the shelf at the other branch/warehouse. It's picked by whoever dispatches it (the source, physically holding the stock)."_ The one sanctioned way to pin a unit up front is starting from the Serial Numbers list ([SerialNumberList.tsx:232-235](<../src/app/(app)/(dashboard)/inventory/serial-numbers/_components/SerialNumberList.tsx#L232-L235>) → `saveStockTransferDraft`), which the backend then only re-verifies.
    **Two readings**, in _Decisions needed_. The cheap one (fix the placeholder, point requesters at the Serial Numbers route) is a one-string change and needs no decision from engineering — but it may not be what the client meant.

19. **The serial column is hidden until dispatch, on purpose.** ❌
    [TransferDetailModal.tsx:864](<../src/app/(app)/(dashboard)/inventory/transfers/_components/TransferDetailModal.tsx#L864>) — `hasSerialLine` is true only when some line already carries a `serialNumber`, and `:882-899` additionally **merges** several quantity-1 serial lines of the same item back into one summary row pre-dispatch, with the reasoning given inline: _"before dispatch, none of those lines has a serial yet, so showing them as 4 identical 'qty 1' rows is pure noise."_ Once dispatched, each line shows individually with its own serial.
    So "make the serial number visible" is probably not about the post-dispatch detail view, where it already is. **Confirm which screen** — the candidates are the Stock Transfers **list** ([TransferList.tsx](<../src/app/(app)/(dashboard)/inventory/transfers/_components/TransferList.tsx>)), the printed transfer sheet (where `hasSerialLine` gates the whole column the same way, [printInventoryDocument.ts:505-507](../src/libs/print/printInventoryDocument.ts#L505-L507)), and the pre-dispatch detail rows. Grouped with 20/21 as one "dispatch legibility" part either way.

20. **The assigned-serial pills are 12px purple-on-purple.** ❌
    [TransferDetailModal.tsx:385](<../src/app/(app)/(dashboard)/inventory/transfers/_components/TransferDetailModal.tsx#L385>) — `rounded-full bg-prominent-purple-100 … text-xs font-medium text-prominent-purple-700`. The serial is the one value a dispatcher reads off the screen and checks against a physical sticker, and it is currently the lowest-contrast text in the form.
    **Fix**: near-black (`text-[#17171c]`, the file's own body colour), a step or two up in size, and `font-mono` — every other serial in the app is monospaced (`td.mono` on both printed documents, `SerialSearchCombobox`'s own list). Pure Tailwind, frontend only.

21. **The detail drawer is capped at 860px.** ❌
    [TransferDetailModal.tsx:1103](<../src/app/(app)/(dashboard)/inventory/transfers/_components/TransferDetailModal.tsx#L1103>) — `max-w-[min(860px,94vw)]`. It is a right-hand drawer by design, and the comment says why: _"the list stays visible behind it, which matters because reviewing a transfer is usually one step in working down the queue rather than a destination of its own."_ "Make the modal full" works against that on purpose, so it is worth asking whether they want **full-screen** or merely **wider** (raising the cap is a one-token change; going full-screen makes the surrounding drawer shell pointless and is really a redesign). Either way, frontend only. Grouped with 19/20.

22. **One pick fills both the driver and the plate.** ❌
    [TransferDetailModal.tsx:1085-1091](<../src/app/(app)/(dashboard)/inventory/transfers/_components/TransferDetailModal.tsx#L1085-L1091>) — `pickDispatchVehicle()` sets `driverName` **and** `vehiclePlate` from one roster entry, and both fields are wired to the same handler (`:1644-1648` and `:1681-1685`), so picking from either field overwrites the other. The comment states the intent: _"Picking a roster entry from either field fills both."_ The client's _"do not link driver name to vehicle"_ is precisely a request to undo that.
    The underlying data makes the case for them: `Vehicle.driverName` is the client's own sheet and the schema says it is unreliable — _"Client's sheet mixes an actual driver's name and, for a few unassigned service vehicles, the vehicle model (e.g. 'INNOVA', 'D-MAX') in the same column"_ ([schema.prisma](../../backend/prisma/schema.prisma), `model Vehicle`). Autofilling `driverName` from that column can write "D-MAX" into the driver field of a dispatch.
    **Fix**: split the handler. A pick in the **Vehicle Plate** field writes the plate only; the **Driver Name** field stops being a vehicle picker and becomes a plain text input (both fields are free text per transfer already — see `VehicleAutocompleteInput`'s own comment, _"the client's fleet roster doesn't cover every ad hoc carrier, so typing something not on the roster must still just work"_). **Frontend only, no backend or schema change** — `StockTransfer` already stores the two independently.

23. **The transfer document prints the dispatch date and not the receipt date.** ❌
    `buildStockTransferHtml()` prints one `Date` = `transfer.transferDate` ([printInventoryDocument.ts:582-583](../src/libs/print/printInventoryDocument.ts#L582-L583)). The receipt date is already in the envelope and unread: `findOne()` selects `goodsReceipts: { id, code, receivedAt, … }` (`transfers.service.ts:1198-1206`), which `getTransferDocument()` passes straight through (`:2264`).
    **Fix**: relabel to **Transfer Date** per notes 2's spell-it-out rule, and add **RR No.** / **RR Date** from the first (or, on a reopened partially-received transfer, each) goods receipt. **Frontend only.** Note the plural is real — the same file's comment: _"A reopened partially_received transfer issues its own separate GRN per receive call, so there can be more than one."_ Decide whether the sheet shows the first, the latest, or all; a two-receipt transfer printing one unlabelled date is the failure mode to avoid.

### Supplier Debit Memo — items 14-16 (migration)

14 & 15. **A debit memo cannot exist without naming the invoice it hits.** ❌
`SupplierDebitMemo.apBillId` is **`String`, not `String?`**, with a required relation to `APBill` ([schema.prisma](../../backend/prisma/schema.prisma), `model SupplierDebitMemo`). The column's own doc comment records that this was already litigated once and settled the other way: _"The SI this debit is \_applied against_ — the bill whose balance drops. **Deliberately free choice among the supplier's open bills**: per the client, a deduction need not sit on the invoice the damaged unit arrived on. Where it did arrive is recorded per line, unenforced, as `sourceApBillId`."_
So the system already separates \_where the unit came from_ (per line, informational) from _which bill the money comes off_ (header, required). The client is now asking to go one step further: **don't ask at creation at all** — _"do not ref to a supplier invoice… do not determine which invoice will apply — allow accounts to do that."_
That is a genuine change of model, not a field edit: - `apBillId` must become nullable → **migration**. - Everything that assumes a bill must be re-read: the `@@index([apBillId])`, the memo's journal entry (the posting currently debits a specific AP bill), and whatever applies `amount` to `APBill.amountPaid`/balance. - A memo with no bill is a new state — an **unapplied credit against the supplier**. Something has to list those for accounting to apply later, and notes 2 asks for exactly that surface from the other side: _"Add a dropdown of the supplier's Debit Memos, so they can be deducted from the payment."_ **These two notes are one feature seen from both ends** — notes 1 removes the link at creation, notes 2 adds it back at payment time. Build them together or neither; shipping notes 1 alone leaves memos that reduce nothing. - Existing rows all have a bill. Nullable column plus app-level optionality is the only non-destructive route (same shape as Scenario 64's gap 7).

16. **"Trigger upon creation of delivery receipt" has no referent on this side.** 🚧
    `SupplierDebitMemo.deliveryReceiptNumber` exists but is free text typed by whoever hands the return shipment over — _"The supplier's own delivery receipt for the returned goods… Free text, same as `GoodsReceipt.deliveryReceiptNumber` on the inbound side."_ There is no outbound **Delivery Receipt document** in the system to hang a trigger off, and `GoodsReceipt.deliveryReceiptNumber` is the **inbound** supplier DR, which would be the wrong event (that is a delivery arriving, not goods going back).
    Two readings, neither obvious: (a) the memo should be auto-drafted when a return shipment's DR is recorded, which means building that document first; (b) "delivery receipt" is the client's word for the **customer**-facing DR already in POS (`PosTransaction.deliveryReceiptNumber`), which would make this a warranty/defect-return trigger and a different feature entirely. **Blocked pending one sentence from the client.** Do not guess — (b) would post entries against the wrong party.

### Data only — item 25

25. **Panay Warehouse's address row is empty.** 📋 **No code change.**
    `Warehouse.address` exists (`String? @db.VarChar(500)`), is selected for the transfer document on both legs (`transfers.service.ts:1142-1153`, with the comment _"For the printed transfer document's From/To parties — the real standalone warehouses (PANAY/NEGROS) have no branch to borrow an address from"_), and `partyAddress()` correctly falls back to it for a branchless warehouse ([printInventoryDocument.ts:482-485](../src/libs/print/printInventoryDocument.ts#L482-L485)). It is also fully editable in the UI — [EditWarehouseModal.tsx:141](<../src/app/(app)/(dashboard)/inventory/warehouses/_components/EditWarehouseModal.tsx#L141>), schema at [schema/inventory/warehouses/index.ts:25](../src/schema/inventory/warehouses/index.ts#L25).
    The address is simply **never set**. The seed creates one warehouse per branch with no address at all (`seed.ts:6226-6234`) and then promotes two of them to standalone by setting `branchId: null`, `region`, `code` and `name` — and nothing else (`seed.ts:6258-6275`). So Panay and Negros print blank.
    **Fix**: type the two addresses into Inventory → Warehouses → Edit, in production. Optionally seed them too, so a fresh dev database reproduces the fixed state rather than the bug. **No frontend or backend code change, and it should not be built as one.**
    One latent bug worth fixing while in the file, since it is the same symptom one layer over: `partyAddress()` returns `[branch.addressLine1, branch.city].filter(Boolean).join(', ')` whenever a branch exists and **never falls back to the warehouse's own address**, so a branch-owned warehouse whose branch has no street address prints blank even if the warehouse itself has one. One `||`.

---

## Decisions needed

Four. None blocks the other items.

1. **Item 7 — where does the branch go?** Notes 1 says both "below supplier address / on the left" and "above table"; notes 2 says "to the left". **Recommendation: left column, under the supplier address (item 4), and treat 7 as the same note.** If the client actually wants a separate full-width `Branch: X` line between the three-column header and the line-item table, that is a different (and also small) change — but doing both would print the branch twice.

2. **Item 17 — which age is "inbound age"?** Two exist. `locationSince` ("branch age") is when the unit arrived **at the warehouse it is now being dispatched from**; `firstReceivedAt` ("RR age") is when it first entered the company. For a dispatcher deciding which unit to send, branch age is the one that matters (ship the one that has sat longest here). **Recommendation: show both, via `SerialAges` with `inline`** — the shared component already renders the pair, both values are already in the response, and the Serial Numbers list already shows both side by side ([SerialNumberList.tsx:672-679](<../src/app/(app)/(dashboard)/inventory/serial-numbers/_components/SerialNumberList.tsx#L672-L679>)), so matching it costs nothing and needs no answer to ship.

3. **Item 18 — should the requester be able to pin a unit from the Create Transfer form?** The system deliberately says no (the requester cannot see the far branch's shelf), and offers the Serial Numbers → "send these units" route instead.
   - **(a) Copy fix only, recommended as the first move**: change the placeholder to `Add item — search name or SKU…` and let the Serial Numbers route stay the way to pin units. **One string.** It removes the thing that caused the complaint without reversing a decision.
   - **(b) Real serial picking in the create form**: a serial-tracked line gains an optional serial picker scoped to the source warehouse, pinning `serialNumberId` the way `pinnedLines` already does. The plumbing exists end to end (`pinnedLines` → `CreateTransferModal:448-453` → backend re-verify), so this is smaller than it sounds — **but** it reverses the documented rationale and reintroduces the stale-pick problem at every branch. Note this also makes a transfer uneditable (`hasPinnedSerial` kills the edit button, `:851-860`), which requesters will notice.
     **Recommendation: ship (a) now; put (b) to the client as "do you want to choose the exact unit when raising the request, knowing you can't see the other branch's shelf?"**

4. **Item 23 — unticking the receive checkboxes reverses a documented decision.** Today every outstanding line opens pre-filled with its full remaining quantity, and for a serial line that renders as a ticked **Received** box ([TransferDetailModal.tsx:991-1002](<../src/app/(app)/(dashboard)/inventory/transfers/_components/TransferDetailModal.tsx#L991-L1002>), checkbox at `:1788-1799`). The comment is the counter-argument: _"the common case is everything arrived; the user reduces the number or unchecks a serial only for the exceptional shortfall."_ The client's case is the stronger one for an inventory count — a pre-ticked box means a receiver can confirm a delivery they never looked at, and the whole point of receiving serial by serial is that someone physically saw each unit.
   - **(a) Recommended — unticked serials, untouched quantities.** Serial lines start at `0` (unticked); non-serial quantity lines keep defaulting to the remaining amount, where there is nothing to "confirm" per unit and zeroing them just adds typing. Add a **Mark all received** control so a genuinely complete 20-unit delivery is still one click, and keep the submit guard that already refuses a receive with nothing received.
   - **(b)** Untick everything, quantities included. More consistent, materially more typing on every ordinary delivery.
     **Needs the client's answer, not ours** — but (a) ships safely either way and is reversible.

---

## Suggested part breakdown

Sequenced so nothing has to be built twice. Each part is independently shippable and testable.

- **Part 1 — PO Date and optional Location** (items 9, 10). Backend DTO + service, frontend schema + two form fields. **First, because gap 1 depends on `orderDate` being real.**
- **Part 2 — RR printable and on-screen sheet** (items 1-6, and 7 once answered). The `orderDate` fallback in `receivingReportSourceRef()` plus the `datedLabel` it needs, the backend select widening, then the label/layout changes in both files **together**.
- **Part 3 — Stock Transfer document** (items 24, 25's `partyAddress` fallback). Transfer Date relabel, RR No. / RR Date, and the one-`||` address fix. Item 25 proper is a data task, done outside the branch.
- **Part 4 — Dispatch legibility** (items 17, 19, 20, 21). The `SearchableSelect` `description` prop, `SerialAges` inline in the picker, pill contrast, drawer width, and whichever surface item 19 turns out to mean.
- **Part 5 — Driver / vehicle decoupling** (item 22). Small and independent; could ride along with Part 4.
- **Part 6 — Receive checkbox default** (item 23) and the item 18 copy fix. Both one-liners gated on a client answer.
- **Not in this plan** — items 14/15/16 (debit memo). One migration, a posting-path rewrite, and a new "unapplied credit" surface that only makes sense built alongside notes 2's voucher-side dropdown. **Raise as its own scenario**, with item 16 blocked until the client says what "delivery receipt" means here.

---

## Notes 2 extras — inventory only, verified, not scoped here

Logged so the next person does not re-derive them.

- **Low-stock definition per model.** ❌ **Migration.** There is no per-item reorder point left in the system. `ReorderRule` was deleted in a 2026-08-17 dead-nav sweep and `getStockBalances` now hardcodes `reorderPoint: null` with the comment _"Reorder-rule-based enrichment removed… reorderPoint/belowReorderPoint stay in the response shape… but always resolve empty now"_ (`stock.service.ts:4939-4956`). Since `stockStatusOf()` needs a non-null reorder point to ever return `'low'` (`:5209-5215`), **nothing in the app can currently be low stock.** The only surviving threshold is `CategoryDefault.defaultReorderPoint` ([schema.prisma:5335](../../backend/prisma/schema.prisma#L5335)), which is per **category** and is read nowhere in `src`. "Per model" means a column on `Item` (or a reinstated per-item rule), a migration, and reviving the `belowReorderPoint` filter that is still wired through the response.
- **Selecting a supplier shows only that supplier's line items.** ✅ **No migration.** `ItemSupplier` already exists — _"Approved supplier(s) per item — supports per-supplier pricing and lead time (PRO-09)"_ ([schema.prisma:6481-6499](../../backend/prisma/schema.prisma#L6481-L6499)) — with full CRUD, bulk create and a suggestion endpoint (`supplier.controller.ts:195-257`). Two things are missing: the PO form's `ItemSearchCombobox` has no supplier filter (it searches the whole catalog, [ItemSearchCombobox.tsx:38-55](<../src/app/(app)/(dashboard)/inventory/purchase-requests/_components/ItemSearchCombobox.tsx#L38-L55>)), and **the table is empty** — `seed.ts:3200` only ever deletes from it. So this is a filter plus a data-population story, and the filter has to degrade gracefully (a supplier with no approved items must not get an empty picker).
- **The PO should generate Withholding Tax and Input Tax journal entries.** The PO computes no tax at all today (`taxAmount Decimal @default(0)`, [schema.prisma:6748](../../backend/prisma/schema.prisma#L6748)); both taxes are resolved at **receiving**, from the supplier's `defaultInputVat`/`defaultWithholding` (`stock.service.ts:1328-1377`). Posting them at PO time is a real accounting question — a PO is a commitment, not a transaction, and posting Input VAT before the goods and the invoice arrive would double-count against the receiving entry that already posts it. **Needs an accounting decision before any code.**
- **Compute COGS per serial number.** Accounting-side, out of this module's scope. Noted because the inventory half already exists: serial-level cost provenance via `StockCostLayer` and `SerialNumber.goodsReceiptLineId`.

---

## Out of scope — in notes 1's inventory block but not inventory

Both sit under notes 1's second `PO` heading, which mixes in two POS/AR items. Recorded so they are not lost and not built here.

- **Item 12 — "CR for downpayment (optional for cash)."** Collection receipts are POS/AR. The down-payment CR already exists as its own receipt line with its own CR number (`daily-collection.service.ts`, per Scenario 64's item 14 finding). The new content is the **"optional for cash"** half — whether a cash sale should skip issuing one. **POS scenario.**
- **Item 13 — "make invoice number as primary key on recent transactions."** The POS dashboard's Recent Transactions widget keys on `tx.transactionNumber` ([pos/page.tsx:381](<../src/app/(app)/(dashboard)/pos/page.tsx#L381>)), not the invoice number. **POS scenario.**

---

## Implementation Log — 2026-10-14

Branch `feat/inventory-client-feedback-71` in both repos. Built and manually confirmed one part at a time with the developer. Several decisions changed mid-part on the developer's direction; what is recorded here is the final state.

**For this scenario, I have done:**

- **Part 1 — PO Date and optional Location (items 9, 10).** Location is optional on the request/PO form and the PR→PO Convert modal (a blank picker is saved as `null`, never `''`). The PO date is settable: a **PO Date** field on the Stock Request form (defaults to today) carried onto the PO the request auto-converts into on submit — **needs migration `20261014090000_purchase_request_order_date`** (nullable `purchase_requests.orderDate`) — plus Edit Purchase Order and Convert (`orderDate` on `CreatePurchaseRequestDto`, `CreatePoDto`/`UpdatePoDto`, `ConvertPrToPoDto`; an edit that omits it keeps the existing date). A PO can be saved with neither Location nor Delivery instructions, but **Send is refused** (`po_destination_required`, enforced in `PurchaseOrderService.send()` and up front on the list's Send button). A non-blocking "Where should this be delivered?" warning shows on the form once it has been touched, and straight away on an existing record (developer reworded it and added saved-record variants). Receiving a PO with no location shows its delivery instructions as the Destination and is **blocked** pending the drop-ship decision below. The PO sheet's meta column is right-aligned against the divider.
- **Part 2 — RR printable and on-screen sheet (items 1–7).** Already built and committed before this run reached it (frontend `487963c1`, `42a39f29`; backend `ac16aa7`, all titled "Scenario 69"); verified against the item list. PO Date falls back to the linked PO's `orderDate`; labels `RR No.` / `RR Date` / `Reference` / `PO No.` / `PO Date`, following the slot (`Transfer No.`/`Transfer Date`, `Invoice No.`/`Invoice Date`); supplier address when set; **branch on its own full-width line above the table** (item 7's answer, which supersedes item 4's "under the supplier").
- **Part 3 — Stock Transfer document (item 24, item 25's `partyAddress` fallback).** Also already in `42a39f29`; verified. Transfer Date label, every RR No./RR Date listed, warehouse address fallback.
- **Part 4 — Dispatch legibility (items 17, 19, 20, 21).** The dispatch serial picker shows the **Inbound age** (RR age, `firstReceivedAt` — the Serial Numbers list's "Inbound Age" column) beside each serial, via a new display-only `description` slot on the shared `SearchableSelect` (never type-filtered). Serials visible pre-dispatch in the detail rows ("Assigned at dispatch", pre-dispatch statuses only), on the Transfer list (first two + "+N more") and on the printed sheet. Assigned-serial pills near-black, mono, 13.5px. Drawer cap raised to `min(1200px, 96vw)`, still a drawer.
- **Part 5 — Driver / vehicle decoupled (item 22).** Driver Name lists the roster's distinct driver names and fills the driver only; Vehicle Plate lists plates and fills the plate only. Both still accept free text.
- **Part 6 — Receive defaults and Create Transfer copy (items 23, 18).** Serial units start unticked with a **Mark all received** control; quantity lines still default to the remaining amount; a receipt with nothing ticked/entered is refused. Create Transfer's item search reads "Add item — search name or SKU…".
- **Added during testing (not in the gap list): a partial receive no longer marks unticked serials lost.** `TransfersService.receive()` leaves them `in_transit` (was `lost_in_transit`); the detail view shows **Not received yet**. A unit swap at receipt still flags the originally dispatched serial lost. Per the developer, there is no "mark as lost" action.

**Worth flagging:**

- **Drop-ship is not built — two open questions.** A PO with no location can be sent (with delivery instructions) but **cannot be received**. Unblocking it needs (1) the client's accountant to say what a no-stock receipt debits instead of Inventory (a clearing account vs COGS), and (2) the client to say how the customer sale is recorded (POS sale skipping stock vs an AR invoice). Any legacy PO with no location is caught by the same block.
- **Developer kept "Issue date"** on the PO sheet/printout and "Order Date" in the PO detail view (the "PO Date" rename there was reverted on their side); RR documents do say "PO Date".
- **DR No. on transfer receipts was removed** at the developer's request (it had been added, uncommitted, in both repos as an RR Reference source). A transfer RR's Reference prints "—".
- **Driver list quality:** the driver dropdown reads `Vehicle.driverName`, which per the schema holds a vehicle model ("INNOVA", "D-MAX") on a few rows — a data clean-up, not code.
- **Existing `lost_in_transit` serials** from earlier partial receives keep that status until a reopened receive lands them; a one-off reset was offered, not done.
- **Deferred, unchanged:** items 14/15/16 (supplier debit memo — migration + posting rewrite + a voucher-side "apply debit memo" surface; 16 blocked on what "delivery receipt" means) → raise as its own scenario. Items 12, 13 are POS. Items 8, 11 were already built. Item 25 proper is data entry: type Panay/Negros addresses in Inventory → Warehouses.
- **Doc drift found in Phase 1:** this file was originally `scenario-69-…` headed "Scenario 69", clashing with Tax Setup's Scenario 69 — renamed to 71 by the developer on 2026-10-14; the Part 2/3 commits (`487963c1`, `42a39f29`, backend `ac16aa7`) keep their "Scenario 69" titles. Item 23's plan assumed "the submit guard that already refuses a receive with nothing received" — no such guard existed; one was added.
- **Test notes:** new specs `backend/test/inventory-client-feedback-71.e2e-spec.ts` (9) and `frontend/e2e/inventory-client-feedback-71.spec.ts` (12) pass; `stock-transfer-partial-receipt` updated to the `in_transit` rule. Specs were run directly against the existing test DB — `npm run test:e2e`'s pre-hook (`prisma migrate reset`) was never run. Pre-existing failures, not caused here: `inventory-receive-against-po` (expects Receive on an _approved_ PO; only sent POs show it), `stock-transfer-accept-reject` and `stock-transfer-serial-request` (their fixture item has 0 stock in the test DB).

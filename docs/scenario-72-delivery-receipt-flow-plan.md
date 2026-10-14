# Scenario 72 — Delivery Receipt Flow (Outbound DR, Purpose-Driven Debit Memo, Proceed to POS) — Gap Analysis & Closing Plan

**Source**: client mockups shared 2026-10-14 — four images: the _New delivery receipt_ form (two screens) with the client's purpose list written beside it, a printable _Delivery receipt_ ("Delivery Receipt with Debit Memo Form Suggestion"), and a printable/editable _Debit memo_. Transcribed in full under _Client spec, verbatim_ below.

This is a **net-new document**, not a change to an existing one. Nothing in either repo is an outbound Delivery Receipt today — every "DR No." in the app is a typed reference number, and the only system-generated DR number (`DRC-YYYYMMDD-NNNN`, UDS release to customer) is never printed. It also **resolves Scenario 71 item 16** ("trigger debit memo upon creation of delivery receipt"), which was blocked because there was no DR document to hang the trigger off — this mockup is that document. Scenario 71 items 14/15 (supplier debit memo without an invoice) become a dependency of one purpose here, _Return units to supplier_.

Verified against the working tree on **2026-10-14** (frontend and backend both on `feat/inventory-client-feedback-71`, backend at `345d305`).

---

## Client spec, verbatim

### Purpose dropdown (handwritten beside the form)

> Dropdown for purpose:
> **With Debit memo.**
>
> 1. Office used — Add what department will use
> 2. raffle price — Christmas Party — Summer Outing
> 3. give aways
> 4. donation
> 5. Redeemed unit
> 6. Return units to supplier
> 7. Actual Sales — Auto populate from CRM (only in this case)
>
> **Without debit memo**
>
> 8. For repair to service Center
> 9. Repaired unit to customer
> 10. Unrepaired unit to customer
> 11. Sales Invoice to follow
>
> **The DR will save as draft until ready for invoice.**
> **Add "Proceed to POS" button**

**Follow-up note from the client (2026-10-14):**

> Note: Remove Actual Sales because it will be encoded in POS.

So purpose 7 is dropped. **Ten purposes remain**: six with a debit memo (1-6) and four without (8-11). The numbering below keeps the client's original numbers.

### New delivery receipt form

- Header: _"New delivery receipt — For stock that leaves the warehouse without a sale. Saving as a draft does not touch stock."_
- **Purpose** card — _"Decides how stock and accounts are affected when this DR is approved."_ — `Purpose of delivery *` select. A purple info box under it explains the effect of the chosen purpose; for Office use: _"When approved, the system moves the stock out of the issuing branch and posts the cost to **Office supplies / equipment expense**. No sales invoice is created. A debit memo is generated with the journal entry."_
- **Issue details** — _"Where the stock leaves from and who receives it."_
  - Debit memo no. (read-only, `DMINV0926-001`)
  - DR no. (read-only, `DR000001`) · Issue date \* (defaults today)
  - Issuing branch \* · Department \*
  - Delivered to (name of person or organization)
  - Customer ID
  - Address (street, barangay, city)
  - Contact no. (`09xx xxx xxxx`)
- **Reference and approval** — _"Same fields for every purpose. Link the document this delivery relates to."_ — Reference no. (placeholder _Request memo no._) · Reference date · Reason / details \* (_Why is this stock leaving?_)
- **Items** — _"Serial no. is required for serialized units such as TVs and aircons."_ — rows of Model · Brand · Serial no. · Unit cost · ×; **Add item**; Remarks (_Anything the approver or warehouse should know…_)
- **Attachments** _optional_ — _"Request letter, approval memo, waybill or photos of the units. PDF or images, up to 10 MB each. Files upload when you save the draft."_ — **Attach files**; _None attached._
- Footer: **Save draft** · **Print preview** · **Submit for approval**

### Printable Delivery Receipt

- Title _Delivery receipt_, NIG Marketing logo top-right with `32 Mabini St., Iloilo City` and `TIN 004-248-859`, blue rule under the header.
- Debit memo no. · DR no. / Date · Issued from / Department · Delivered to · Customer ID · Address · Contact.
- **Purpose** box: every purpose as a checkbox, the chosen one ticked — _Office use, Raffle prize, Giveaways, Donation, To service center, Repaired unit to customer, Unrepaired unit to customer, Redeemed unit, Sales invoice to follow, Return units to supplier, Actual sales_. **Actual sales is dropped from the printed checkbox row** with the purpose itself.
- Table: Model · Brand · Serial no. · Unit cost.
- Remarks: _"Received the above merchandise in good order and condition."_
- Four signatures: **Prepared by · Approved by · Delivered by · Received by** (Name / signature / date).
- Grey footer: _"System note: Approval posts stock out of the issuing branch and charges Office supplies / equipment expense. Not valid as a sales invoice."_

### Printable / editable Debit Memo

- Title _Debit memo_, logo top-right, blue rule.
- Debit memo no. `DMINV0926-001` · Date · Purpose (select) · Branch (`Iloilo – Main`) · Department (select) · Reference (_e.g. DR000001_) · Reference date · Reason / details.
- Table: **Account · Description · Debit amount · Credit amount**, each row removable (red ×).
- Totals box: Total debit · Total credit.
- Three signatures: **Prepared by · Noted by · Approved by**.

---

## Folded in from Scenario 71 — supplier debit memo (items 14, 15, 16)

Added to this scenario on 2026-10-14 at the developer's request. Client note, verbatim (Scenario 71 meeting notes 1, `INVENTORY` section):

> Debit memo
>
> - do not ref to a supplier invoice
> - do not determine which invoice will apply - allow accounts to do that
> - this will be trigger upon creation of delivery receipt

Scenario 71 parked all three: 14/15 need a migration and a posting rewrite, and 16 had no Delivery Receipt document to hang a trigger off. This scenario builds that document, so all three now close here, in **Part 8**:

| S71 item | Client note                                  | How it closes here                                                                                                                                                                                                                                                                                                                                                                               |
| -------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 14       | Do not ref to a supplier invoice             | `SupplierDebitMemo.apBillId` becomes nullable (migration; existing rows keep their bill). The memo form no longer asks for an invoice when the memo is created.                                                                                                                                                                                                                                  |
| 15       | Accounts decides which invoice it applies to | An unapplied memo posts Dr **Due from Suppliers – Debit Memos and Rebates** `1-01-162` / Cr inventory (new mapping key). Accounting applies it later from the AP voucher with a "supplier debit memos" dropdown: Dr AP / Cr `1-01-162`, which stamps `apBillId` and raises the bill's `amountPaid`. Built together; shipping 14 alone would leave memos that reduce nothing (S71's own warning). |
| 16       | Triggered by the delivery receipt            | A DR with purpose **Return units to supplier** drafts the `SupplierDebitMemo` (no invoice) when the **Branch Manager approves the DR**, linked back to it. This is S71 reading (a).                                                                                                                                                                                                              |

**Trigger point, flagged:** the note says "upon creation", and the build drafts the memo on **approval**. That's consistent with decision D7, where the DMINV memo is also drafted on approval. A DR can be saved as a draft, edited, deleted or rejected, and a memo drafted at creation would have to be cleaned up each time. **Confirm with the client** that "creation" meant "once the DR is official".

Unchanged: memos already applied to a bill, and the standalone **New debit memo** on the Inventory tab, which still raises a supplier return without a DR (now without an invoice). Whether to retire that button once returns start from a DR is a client question. Not in this plan: the Scenario 46 GL defects (credit at negotiated amount instead of cost, input VAT not reversed, branch-null JE), unless Part 8 touches those lines anyway.

### One Debit Memos list for both kinds — developer decision, 2026-10-14

The client calls both documents "debit memo", and the DR shows the memo number for every memo purpose. So the **Inventory → Debit Memos** tab lists **both** supplier returns (`SDM-…`) and internal memos (`DMINV0926-…`), with a **Type** filter and column, each row linking to its DR. The two stay separate models: a supplier and an AP bill mean nothing on an internal memo. Inventory staff only view DMINV rows; editing and posting them is the Accountant's job, in **Accounting → Debit Memos**. Built in **Part 4**. Refined the same day (developer): no Supplier/Internal switch — **one merged list** (Type filter + chip, shared search and status pills) and **one New debit memo** button that asks Supplier return or Internal (DMINV); the latter only for those who may create one.

---

## Verdict table

| #   | Requirement                                                       | Verdict                          | Why                                                                                          |
| --- | ----------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | A Delivery Receipt document (model, number, list, detail)         | ❌ **New**                       | No outbound DR model/route exists in either repo                                             |
| 2   | DR number series `DR000001`                                       | ❌ **New**                       | `DocumentSequence` + `nextControlNumber` exist; no `DR` series                               |
| 3   | Purpose dropdown, 10 values, two families (Actual sales removed)  | ❌ **New**                       | No enum; no "office use / giveaway / donation / raffle" anywhere                             |
| 4   | Purpose-specific info box ("when approved, the system…")          | ❌ **New**                       | Pure frontend copy, driven by the same purpose → posting map as #10                          |
| 5   | Department — "add what department will use" (office use)          | 🟡 **Model exists**              | `Department` exists; only `BusinessExpenseLine` references it; no standalone picker          |
| 6   | Raffle prize sub-choice (Christmas Party / Summer Outing)         | ❌ **New**                       | One extra field; see _Decisions_ D4                                                          |
| 7   | Draft → Submit for approval → Approved; draft doesn't touch stock | ❌ **New**                       | Pattern exists (stock adjustments, supplier DM); DR needs its own status enum                |
| 8   | Items: Model / Brand / Serial no. / Unit cost; serial required    | 🟡 **Pieces exist**              | Item + serial pickers exist; unit cost should be system cost, not typed (D6)                 |
| 9   | Stock out of the issuing branch on approval                       | 🟡 **Pattern exists**            | `postAdjustment` / supplier DM `moveStock()`; needs a new `StockTransactionType`             |
| 10  | Debit memo + JE generated on approval (purposes 1-7)              | ❌ **New**                       | No inventory-issuance memo; no mapping keys for office/promo/donation; `DMINV` series absent |
| 11  | Debit memo printable/editable form (Account / Debit / Credit)     | ❌ **New**                       | No DM print builder exists anywhere                                                          |
| 12  | DR printable (purpose checkboxes, 4 signatures)                   | ❌ **New**                       | `printInventoryDocument.ts` has 15+ builders, none for a DR                                  |
| 13  | Attachments, staged until save                                    | ✅ **Reuse**                     | `AttachmentsPanel` + generic `FileAttachment` do exactly this                                |
| 14  | ~~Actual sales — auto-populate from CRM~~                         | ➖ **Removed**                   | Client: "it will be encoded in POS". A real sale stays a POS transaction                     |
| 15  | Return units to supplier → debit memo                             | 🚧 **Depends on S71 14/15**      | `SupplierDebitMemo.apBillId` is NOT NULL — a DR can't name the invoice (D3)                  |
| 16  | For repair to service center / repaired / unrepaired to customer  | 🟡 **UDS covers the stock side** | UDS already dispatches and releases; DR would be the printed paper for those legs (D5)       |
| 17  | Sales invoice to follow — "draft until ready for invoice"         | ❌ **New**                       | Stock leaves before the sale exists; needs a reserved-not-sold state (D2)                    |
| 18  | **Proceed to POS** button                                         | 🟡 **Mechanism exists**          | `checkout-handoff.ts` is the one sanctioned route; needs a `deliveryReceiptId` field         |
| 19  | Approval queue visibility                                         | ❌ **New**                       | `PendingApprovalsWidget` + `needsAttentionData` are hand-merged lists                        |
| 20  | Permissions                                                       | ❌ **New**                       | No `inventory:delivery-receipts:*`                                                           |

---

## What's already done ➖

- **Number sequences.** `backend/src/accounting/shared/control-number.util.ts` — `nextControlNumber(tx, prefix)` is an atomic upsert on `DocumentSequence`, never reissues a skipped number, and `CONTROL_SERIES` already holds the `…0926-` family. `DMHO0926-` is taken by the **customer** (AR) debit memo (`debit-memos.service.ts:251`), so the client's `DMINV0926-` is a deliberately different series — one new entry. `DR` needs one more (no period; the mockup shows `DR000001`, six digits, which `nextControlNumber` would render as `DR001` — see D7).
- **Approval-then-post pattern.** Stock adjustments (`adjustments.service.ts`: only `approve()` at :394 moves stock and posts GL) and supplier debit memos (`supplier-debit-memos.service.ts:932`: stock + JE + bill in one `$transaction`) are the two templates. The DR should copy the supplier DM's _one transaction_ shape, not the adjustment's _JE after commit_ shape.
- **Posting.** `JournalPostingService.post()` (`posting/posting.service.ts:529`), `resolveInventoryAccounts()` (:289, item → category → `INVENTORY_ASSET`), `requireMapping()` (:436). `CostingService` consumes cost layers and gives the real unit cost (`costing.service.ts:182/262`).
- **Chart of accounts already has every target account** (`prisma/data/chart-of-accounts.csv`): `6-03-083` Office Stationery and Supplies, `1-03-040` Office Equipment, Furniture and Fixtures, `6-01-060` Employee Benefits and Wellness, `6-02-010` Advertising and Promotion, `6-02-020` Marketing and Sales Support, `6-05-160` Donations and Charitable Contributions, `1-01-162` Due from Suppliers – Debit Memos and Rebates. Only the **mapping keys** are missing.
- **Attachments.** `src/components/common/AttachmentsPanel.tsx` stages files and uploads them after save via `FileAttachments.attach(fileId, entityType, entityId)` — the mockup's _"Files upload when you save the draft"_ is literally how it already behaves.
- **Pickers.** `CustomerPicker` (`src/components/crm/CustomerPicker.tsx`), `ItemSearchCombobox`, `SerialSearchCombobox`, `BranchSearchCombobox` (two divergent copies — pick one, don't add a third), `DepartmentsApi` (`src/libs/data/OrgStructureData.ts:40`).
- **POS handoff.** `src/libs/pos/checkout-handoff.ts` is the single record for carrying a sale into checkout; `CreditApplicationDetail.tsx:350-376` ("Continue to sale", disabled when no POS session is open) is the exact precedent for "Proceed to POS", and `creditApplicationId` is the precedent for "checkout builds the cart from the document".
- **Repair legs.** UDS already moves the stock and records a DR number for both legs: `dispatchToProvider` (`uds.service.ts:919`, typed `dispatchDeliveryReceiptNumber`) and `releaseToCustomer` (:1102, generated `DRC-…`). Nothing prints either.
- **Print shell.** Every branded builder in `src/libs/print/printInventoryDocument.ts` uses the same `.top` / `.info` / table / `.signatures` structure and `/nig-logo.png`; Scenario 57's Acknowledgement Receipt is the precedent for copying the client's own paper form.

---

## What's not done / gaps ❌

### The document — items 1-3, 7, 20

1. **No `DeliveryReceipt` model.** New `DeliveryReceipt` + `DeliveryReceiptLine`:
   - Header: `drNumber` (unique per tenant), `purpose` (enum), `purposeDetail` (raffle occasion, D4), `status`, `issueDate`, `branchId` + `warehouseId` (issuing), `departmentId?`, `customerId?`, `supplierId?`, `deliveredTo`, `address`, `contactNo`, `referenceNo`, `referenceDate`, `reason`, `remarks`, `debitMemoNumber?`, `journalEntryId?`, `udsId?` (D5), `posTransactionId?` (D2), submitted/approved/rejected/voided by + at, `rejectReason`, `voidReason`.
   - Line: `itemId`, `serialNumberId?`, `quantity` (1 for serial lines), `unitCost` (stamped at approval from costing, D6), `description`.
   - `enum DeliveryReceiptStatus`: `draft`, `pending_approval`, `approved`, `rejected`, `voided`, plus `invoiced` for _Sales invoice to follow_ (gap 8).
   - `enum DeliveryReceiptPurpose`: `office_use`, `raffle_prize`, `giveaway`, `donation`, `redeemed_unit`, `return_to_supplier`, `to_service_center`, `repaired_to_customer`, `unrepaired_to_customer`, `sales_invoice_to_follow`.
   - **Migration.** One, additive.
2. **New stock transaction type.** `StockTransactionType` (schema:5562) has no issuance value. Add `issue_out` (or one per family). **Do not reuse `sale`** — `getSoldQtyByItemWarehouse` sums `sale` rows, and the `exchange_out` comment (Scenario 18) records exactly this trap. Only _Sales invoice to follow_ should ever become a `sale`, and only through POS.
3. **Serial status after issue.** `SerialNumberStatus` has no _issued / given away_ value. Office-use, raffle, giveaway, donation and redeemed units leave the company's books — `sold` is wrong for the reports that count sales, `scrapped` is wrong for the audit trail. Add `issued` (one enum value; serial keeps a `deliveryReceiptId` back-link via the ledger row).
4. **Permissions.** `inventory:delivery-receipts:read | create | update | submit | approve | void`, seeded onto Stock Controller (create/submit) and Branch Manager / HQ (approve). Watch the Scenario 47 trap: check whether any role's `modulePermIdsExcept('inventory', …)` would auto-grant `approve`.

### Purpose → stock and accounting — items 4, 9, 10, 15-17

The purpose is the whole feature: it decides the stock move, the serial status, the JE and whether a memo exists. **Proposed map** (every account is already in the COA; mapping keys are new):

| Purpose                      | Stock on approve             | Serial →              | JE (Dr / Cr)                                                              | Memo        |
| ---------------------------- | ---------------------------- | --------------------- | ------------------------------------------------------------------------- | ----------- |
| Office use (+ department)    | out of issuing warehouse     | `issued`              | `OFFICE_SUPPLIES_EXPENSE` 6-03-083 (D1) / inventory, dept-tagged          | DMINV       |
| Raffle prize                 | out                          | `issued`              | `EMPLOYEE_EVENTS_EXPENSE` 6-01-060 / inventory                            | DMINV       |
| Giveaways                    | out                          | `issued`              | `PROMOTION_EXPENSE` 6-02-010 / inventory                                  | DMINV       |
| Donation                     | out                          | `issued`              | `DONATION_EXPENSE` 6-05-160 / inventory                                   | DMINV       |
| Redeemed unit                | out                          | `issued`              | `MARKETING_SUPPORT_EXPENSE` 6-02-020 / inventory (D8)                     | DMINV       |
| Return units to supplier     | out (`supplier_return`)      | `returned`            | Dr Due from Suppliers 1-01-162 / inventory — via `SupplierDebitMemo` (D3) | supplier DM |
| For repair to service center | via UDS `dispatchToProvider` | `in_repair` (already) | none                                                                      | none        |
| Repaired unit to customer    | via UDS `releaseToCustomer`  | `sold` (already)      | none                                                                      | none        |
| Unrepaired unit to customer  | via UDS (customer-custody)   | unchanged             | none                                                                      | none        |
| Sales invoice to follow      | reserved, not out (gap 8)    | `held`                | none until POS posts the sale                                             | none        |

Credit side everywhere is `resolveInventoryAccounts()` at **cost**, never selling price — Scenario 46 already shipped one memo that credits inventory at the negotiated amount rather than cost; don't repeat it. Every JE carries `branchId` (Scenario 47 found expense JEs posting branch-null and vanishing from branch P&Ls).

5. **No inventory-issuance debit memo.** The client's "debit memo" here is an **internal** accounting voucher, not the supplier DM (Scenario 46) and not the customer DM (`DMHO`). Its mockup is a journal voucher: Account / Description / Debit / Credit rows with totals. Two ways to build it (D9): (a) the DM _is_ the JE — `debitMemoNumber` on the DR plus a print of the posted JE lines, no new model; (b) a new `InventoryDebitMemo` model accounting can edit before it posts. **Recommend (a).**
6. **Return to supplier needs a memo with no invoice.** `SupplierDebitMemo.apBillId` is `String` NOT NULL (schema:1848) and the create DTO requires it. A warehouse clerk issuing a DR does not know which supplier invoice the credit lands on — which is exactly Scenario 71 items 14/15 ("do not ref to a supplier invoice… allow accounts to do that"). **This purpose cannot ship until 14/15 does**, and 14/15 needs its voucher-side "apply debit memo" dropdown or the memo reduces nothing.
7. **Repair purposes duplicate UDS.** UDS already moves the serial, sets `consignedToSupplierId`, and records the DR number for both legs. A DR that also moves stock would move it twice. The DR for these three purposes should **link to a UDS and drive its existing step**, becoming the printed paper the UDS has never had (D5).
8. **"Sales invoice to follow" has no safe state today.** Stock physically leaves before a POS sale exists. Decrementing it now and again at checkout double-counts; not decrementing it lets someone sell the same serial. Proposal: approve sets the serial `held` (and a reservation for non-serial lines), **no stock out and no JE**; **Proceed to POS** hands the lines to checkout; the POS sale does the real decrement + COGS + revenue; the DR flips to `invoiced` with `posTransactionId`. This is what _"the DR will save as draft until ready for invoice"_ reads as.

### Form — items 4-6, 8, 13, 14

9. **New route** `inventory/delivery-receipts/` (list + full-page form + detail), plus a **Delivery Receipts** tab in `StockTransactionHub.tsx:39-108`. Form is `react-hook-form` + `zodResolver` + `Controller`, schema in `src/schema/inventory/delivery-receipts/`, server actions in the route's `_actions/`.
10. **Purpose-driven fields.** One `PURPOSE_CONFIG` map (label, family, info-box copy, which fields are required/shown, which counterparty picker) feeds both the form and the printable's checkbox row, so the two can't drift:
    - Office use → Department required.
    - Raffle prize → occasion select (Christmas Party / Summer Outing / Other).
    - Sales invoice to follow → `CustomerPicker` (required, since checkout needs the customer); picking one fills Delivered to, Customer ID (`customerCode`), Address, Contact no. The client's "auto populate from CRM" was tied to Actual sales, so this reuse is our call; see D2.
    - Repaired / unrepaired unit to customer → customer comes from the linked UDS (D5), not a picker.
    - Every other purpose → Delivered to, Customer ID, Address and Contact no. are typed.
    - Return to supplier → `SupplierSearchCombobox` fills Delivered to / Address.
    - Repair purposes → UDS picker (D5).
11. **Items.** Item picker → Model and Brand are read from the item, not typed. Serial-tracked items require a serial picked from the issuing warehouse's `in_stock` units (`SerialSearchCombobox`); non-serial items need a **Quantity** column the mockup omits. Unit cost is read-only (D6).
12. **Read-only numbers on a new form.** The mockup shows `DMINV0926-001` and `DR000001` before saving. `nextControlNumber` never reissues, so allocating on page open burns a number every time someone cancels. Show _"Assigned on save"_ / _"Assigned on approval"_ instead (D7).
13. **Footer.** Save draft · Print preview (prints the unsaved form with a DRAFT watermark) · Submit for approval. On an approved sale-family DR: **Proceed to POS** (disabled with a tooltip when no POS session is open — copy `CreditApplicationDetail.tsx:524`).

### Printables — items 11, 12

14. `buildDeliveryReceiptHtml` / `printDeliveryReceipt` and `buildDebitMemoHtml` / `printDebitMemo` in `printInventoryDocument.ts`, copying the client's layouts above. Backend `GET /inventory/delivery-receipts/:id/document` returns the usual `PrintDocumentEnvelope`. The system-note footer is per purpose, from the same `PURPOSE_CONFIG`. The DM print renders the posted JE lines (Account / Description / Debit / Credit) with totals and Prepared / Noted / Approved.

### Visibility — item 19

15. Add pending DRs to `PendingApprovalsWidget.tsx:36-60` and `needsAttentionData.ts:47-60` (both hand-merged; Scenario 21 found no generic approval model).

---

## Decisions needed

Nine, one already answered (D2). D3 and D5 change what gets built; the rest have a safe default.

1. **D1 — Office use: expense or fixed asset?** The info box says _"Office supplies / equipment expense"_. A TV or aircon moved into an office is an asset by most policies (`1-03-040` Office Equipment, Furniture and Fixtures), not stationery (`6-03-083`). **Recommend**: map `office_use` to one configurable mapping key, default `1-03-040`, and confirm with accounting. Cheap to change later; wrong postings are not.
2. **D2 — ~~What do "Actual sales" and "Sales invoice to follow" each mean?~~ Answered 2026-10-14:** the client removed _Actual sales_ ("it will be encoded in POS"). That also removes the double-posting risk: a real sale is only ever a POS transaction, and the only sale-family DR left is _Sales invoice to follow_, which holds the unit and posts nothing (gap 8). **One small follow-up**: "auto populate from CRM" was described as _only_ for Actual sales. **Recommend** keeping the CRM customer picker for _Sales invoice to follow_ anyway, because **Proceed to POS** needs a real customer for the sale. Confirm with the client in passing; don't block on it.
3. **D3 — Return units to supplier: wait for Scenario 71 items 14/15, or ship without it?** (a) **Recommended**: build Parts 1-5 without this purpose, then do Scenario 71 14/15 (nullable `apBillId` + voucher-side apply dropdown) as the next part, and wire the DR to auto-draft a `SupplierDebitMemo` on approval — which closes S71 item 16 under its reading (a). (b) Ship it now posting Dr `1-01-162` / Cr inventory with a DMINV memo and no supplier-memo link — fast, but two documents then record the same return and AP never sees it.
4. **D4 — Raffle occasion: fixed list or free text?** The client listed Christmas Party and Summer Outing. **Recommend** those two plus _Other (specify)_, stored as `purposeDetail`.
5. **D5 — Repair purposes: DR drives UDS, or DR replaces those UDS steps?** **Recommend** _drives_: picking _For repair to service center_ requires choosing an open UDS; approving the DR runs the UDS step and writes the DR number into `dispatchDeliveryReceiptNumber` / `releaseDeliveryReceiptNumber`. The DR series then replaces the UDS-only `DRC-…` number for the release leg, so the company has one DR series.
6. **D6 — Unit cost typed or system?** The mockup shows an input. A typed cost on a stock-out lets anyone set the expense. **Recommend** read-only, stamped at approval from `CostingService`; the print shows it.
7. **D7 — Number format and timing.** Mockup shows `DR000001` (six digits, no period) and `DMINV0926-001`. **Recommend** `DR` + six-digit pad (one-line pad option on `nextControlNumber`), DR number assigned on first save, DMINV assigned on approval (a rejected DR never consumes a memo number).
8. **D8 — "Redeemed unit" — redeemed for what?** Loyalty points, a raffle ticket, a promo voucher? It decides the account (marketing support vs. a loyalty liability). **Recommend** `6-02-020` Marketing and Sales Support until the client says otherwise.
9. **D9 — Is the debit memo editable by accounting before it posts?** The mockup's DM has removable rows and a Purpose select, which suggests a standalone editable voucher. **Recommend** no: the memo is generated from the DR and is the printed face of its JE; corrections go through void + re-issue. An editable memo means a second approval for the same event.

Also confirm: is **Department** required for every purpose (the mockup stars it) or only Office use (the client's note)? **Recommend** only Office use.

### Answered — 2026-10-14 (developer, `/implement-scenario 72`)

| Decision                | Answer                                                                                                                                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                   | **All 7 parts of the original plan**, so Scenario 71 items 14/15 are built here. Regrouped into 8 parts (below)                                                                                                                                                                                                 |
| Branch                  | New `feat/scenario-72-delivery-receipt` off `development`, both repos                                                                                                                                                                                                                                           |
| Roles                   | Stock Controller creates and submits; **Branch Manager** approves, rejects, voids DRs; **Accountant** (branch or Head Office) edits and approves debit memos; Business Owner everything                                                                                                                         |
| Create scope            | Branch staff issue only from their own branch's warehouses (404 otherwise); branchless users from any                                                                                                                                                                                                           |
| D1 Office use           | **Asset**: Dr `1-03-040` Office Equipment, Furniture and Fixtures, behind its own mapping key                                                                                                                                                                                                                   |
| D2                      | Answered by the client (Actual sales removed)                                                                                                                                                                                                                                                                   |
| D3 Return to supplier   | DR approval drafts a **`SupplierDebitMemo` with no invoice** (`apBillId` nullable). Its approval: stock out, Dr `1-01-162` / Cr Inventory. Applied to a bill later from the AP voucher (Dr AP / Cr `1-01-162`)                                                                                                  |
| D4 Raffle               | Christmas Party, Summer Outing, Other (specify)                                                                                                                                                                                                                                                                 |
| D5 Repair               | **The DR replaces the UDS dispatch-to-provider and release-to-customer steps**; those UDS buttons go, and the DR series replaces `DRC-`                                                                                                                                                                         |
| D6 Unit cost            | System cost, read-only; estimate on the draft, stamped at posting                                                                                                                                                                                                                                               |
| D7 Numbers              | DR number on first save; DMINV number when the memo is drafted (DR approval)                                                                                                                                                                                                                                    |
| D8 Redeemed unit        | `6-02-020` Marketing and Sales Support, own mapping key                                                                                                                                                                                                                                                         |
| **D9 Debit memo**       | **Editable draft memo** (reverses the recommendation). New `InventoryDebitMemo` model. DR approval drafts it with proposed lines; the Accountant edits and approves; **stock moves and the JE posts together on memo approval**. Accounting can also raise a **standalone** memo with no DR (JE only, no stock) |
| Department              | Required only for Office use                                                                                                                                                                                                                                                                                    |
| Sales invoice to follow | CRM customer picker, required                                                                                                                                                                                                                                                                                   |

Consequence of D9 for the purpose map above: for the six memo purposes, **Branch Manager approval moves nothing** — it hands the DR to accounting. Stock and GL move on memo approval. The four no-memo purposes move stock on Branch Manager approval as planned.

---

## Suggested part breakdown

Superseded on 2026-10-14 by the answered decisions. Eight parts, in order, each confirmed before the next:

- **Part 1 — Foundations** (backend). Migration: `DeliveryReceipt`/lines, `InventoryDebitMemo`/lines, enums, `issue_out`, serial `issued`. `DR` and `DMINV0926-` series. Permissions. Mapping keys. Draft CRUD, branch-scoped.
- **Part 2 — DR draft form, list, hub tab**. `PURPOSE_CONFIG`, conditional fields, CRM picker, item/serial lines with read-only cost, attachments, Save draft / Submit for approval.
- **Part 3 — DR approve / reject** (Branch Manager). Memo purposes: hand off to accounting and draft the DMINV memo. Approval-queue entries.
- **Part 4 — DMINV memo**. Accountant edit + post (stock + JE in one transaction), void (reverses both), standalone memo; the editor in Accounting → Debit Memos, and the combined supplier/internal list with a Type filter in Inventory → Debit Memos.
- **Part 5 — Printables**. DR and debit memo.
- **Part 6 — Sales invoice to follow + Proceed to POS**.
- **Part 7 — Repair purposes replace the UDS dispatch / release steps**.
- **Part 8 — Return to supplier + Scenario 71 items 14/15/16**. Nullable `apBillId` (migration), invoice dropped from memo creation, an unapplied memo posts to `1-01-162`, a voucher-side "apply debit memo" dropdown, and DR approval drafting the supplier memo. See _Folded in from Scenario 71_.

---

## Out of scope

- **POS "Delivery Receipt" payment mode** (`pos/checkout/page.tsx:5556-5586`) — a cash-behaving stub whose DR number is never captured (Scenario 66 D10). Same name, unrelated feature; the standing constraint is that it stays as built. Worth one line to the client so nobody expects the two to connect.
- **Supplier debit memo GL defects** from Scenario 46 (inventory credited at negotiated amount, input VAT not reversed, JE branch-null) — pre-existing; fix inside Part 7 only if it touches those lines anyway.

---

## Progress — Part 8 (Return to supplier + S71 items 14/15/16), 2026-10-14

**Backend**

- Migration `20261014200000_supplier_debit_memo_unapplied`: `supplier_debit_memos.apBillId` nullable (FK now `SET NULL`), new `deliveryReceiptId` (unique), new `ap_disbursement_deductions.supplierDebitMemoId` (unique). Existing memos keep their bill.
- New mapping key `DUE_FROM_SUPPLIERS` → `1-01-162` (seeded by `seedPH`; existing DBs need the mapping set once in Settings → Account Mapping, or a re-seed).
- Supplier debit memo: created with `supplierId`, no invoice. Approval posts **Dr Due from Suppliers / Cr Inventory** and touches no bill. Memos raised before Part 8 (bill named, no voucher link) still settle their bill directly (`settlesBill`).
- AP voucher: a deduction with `supplierDebitMemoId` applies the memo — account forced to Due from Suppliers, amount to the memo's; the memo takes the voucher's (first) bill. Edit, settle and cancel of the voucher keep or release the link. An applied memo can't be edited or voided until the voucher lets go of it.
- DR: `return_to_supplier` is submittable. **Creating the DR drafts the supplier memo** (S71 item 16, read literally on 2026-10-14 — supersedes "on approval"): supplier, branch, units from the DR, priced at estimated cost. While the DR is a draft, every DR edit refreshes the memo (a unit accounting repriced keeps its price; charges stay); deleting the DR deletes it, rejecting voids it. The memo can't be approved or voided until the Branch Manager approves the DR. Approving the memo issues the units through the DR (held → issued) and marks the DR posted; voiding the memo voids the DR; voiding the DR voids the memo. The memo's goods stay the DR's — only prices and charges change.

**Frontend**

- Inventory → Debit Memos form: no invoice picker; supplier + branch only; a picked item defaults to its cost on file. A DR-drafted memo locks units, supplier and branch.
- List / detail / Accounting hub: "Applied to" shows the bill once a voucher applies the memo, else "Not yet applied".
- AP voucher (Record Payment): "Apply a supplier debit memo" picker under Deductions, offering the payee's posted, unapplied memos as read-only deduction rows.
- DR form: Return to supplier no longer "draft only"; DR detail and list show the supplier memo number.

**Not done / open**

- The GL defects from Scenario 46 (inventory credited at the memo price, not cost) are unchanged — out of scope as before.
- A voucher covering several bills stamps the memo with its first bill; the deduction itself is apportioned across all of them as before.

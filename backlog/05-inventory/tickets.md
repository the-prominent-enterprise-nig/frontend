---
list: '05 - Inventory (INV)'
list_id: '901615166755'
last_synced: '2026-06-10'
---

# Inventory Tickets

## Summary

| ID     | Title                                                                                                                              | Status | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- |
| INV-63 | AA Warehouse Manager, ISBAT transfer stock between warehouses with in-transit tracking                                             | for QA | high     |
| INV-64 | AA Warehouse Manager, ISBAT record stock adjustments with reason codes                                                             | for QA | high     |
| INV-65 | AA Inventory Manager, ISBAT schedule and execute stock counts and reconcile variances                                              | for QA | high     |
| INV-66 | AA Inventory Manager, ISBAT configure reorder rules with reorder point and safety stock                                            | for QA | high     |
| INV-67 | AA Inventory Manager, ISBAT view an inventory valuation report by warehouse                                                        | for QA | high     |
| INV-68 | AA Warehouse Manager, ISBAT view the stock movement ledger per item                                                                | TO DO  | high     |
| INV-69 | AA Warehouse Manager, ISBAT receive goods against a purchase order with batch capture                                              | TO DO  | urgent   |
| INV-70 | AA Inventory Manager, ISBAT manage supplier records with contacts and item mappings                                                | TO DO  | high     |
| INV-71 | AA Inventory Manager, ISBAT paginate, sort, and search the items table                                                             | TO DO  | high     |
| INV-72 | AA Stock Controller, ISBAT record the supplier and PO date on a Receiving Report so the source of goods is traceable               | TO DO  | high     |
| INV-73 | AA Accountant, ISBAT flag 1% supplier withholding tax on a Receiving Report and see it summarized                                  | TO DO  | urgent   |
| INV-74 | AA Stock Controller, ISBAT see accurate delivered-vs-outstanding quantities on a PO across multiple partial receipts               | TO DO  | high     |
| INV-75 | AA Accountant, ISBAT see a Receiving Report automatically post to the General Ledger                                               | TO DO  | urgent   |
| INV-76 | AA Branch Manager, ISBAT see Brand, Model, Available, Reserved, and Remaining balance per warehouse before raising a stock request | TO DO  | high     |
| INV-77 | AA Branch Manager, ISBAT have an approved stock request automatically create the matching inter-branch stock transfer              | TO DO  | high     |
| INV-78 | AA Branch Manager, ISBAT be automatically notified the moment a tracked item drops below its reorder threshold                     | TO DO  | high     |
| INV-79 | AA Business Owner, ISBAT see reorder alerts ranked by each branch's actual most-bought items                                       | TO DO  | normal   |
| INV-80 | AA Stock Controller, ISBAT receive a multi-part item under one serial with a configurable number of component SKUs                 | TO DO  | high     |
| INV-81 | AA Stock Controller, ISBAT receive and track a bundled unit as one SKU with multiple serialized components sold together           | TO DO  | high     |
| INV-82 | AA Business Owner, ISBAT turn head-office approval for inter-branch transfers on or off as an admin setting                        | TO DO  | high     |
| INV-83 | AA Branch Manager, ISBAT accept or reject an incoming stock transfer request before it moves                                       | TO DO  | high     |
| INV-84 | AA Stock Controller, ISBAT see the serial number carried through a stock transfer and shown on the resulting Receiving Report      | TO DO  | high     |
| INV-85 | AA Branch Manager, ISBAT be notified when my stock transfer or request is rejected                                                 | TO DO  | normal   |

---

## Tickets

### [INV-63] — AA Warehouse Manager, ISBAT transfer stock between warehouses with in-transit tracking

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aarwg

---

**Scenario:**
A warehouse manager moves stock from one warehouse to another. The transfer is tracked through statuses (draft → in transit → received) so quantities are never double-counted; receiving posts the inbound ledger entry.

**Given:**

- Two warehouses exist with the item stocked at the source
- The user has `inventory:transfers:create` permission

**When:**

- The user creates a transfer, dispatches it, and the destination receives it

**Then:**
The system should:

- Validate available quantity at the source before dispatch
- Decrement source stock on dispatch and hold quantity as in-transit
- Increment destination stock only on receipt confirmation
- Write paired StockLedger entries (transfer-out / transfer-in)

### Fields

- **Source / Destination warehouse:** required, must differ
- **Lines:** item, variant, quantity > 0
- **Notes:** optional

### Buttons

- **Create Transfer** / **Dispatch** / **Receive**
  - Receive disabled until status is in transit

---

#### Empty States

- "No transfers yet" with create call-to-action

---

#### Post-Action Behavior

- Stock balances update at both warehouses; transfer shows status timeline

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-INV-63

**Title:** FE: Transfer list + create/dispatch/receive flows
**Parent:** INV-63
**Contract:** `contracts/inventory/transfers.contract.md`

**Scope:**

- [ ] Types match `/inventory/transfers` response shapes
- [ ] Status timeline UI with guarded actions
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-INV-63-transfers

**Title:** BE: /inventory/transfers — create/dispatch/receive
**Parent:** INV-63
**Contract:** `contracts/inventory/transfers.contract.md`

**Scope:**

- [ ] `POST /inventory/transfers` + dispatch/receive actions — returns `{ data, meta }`
- [ ] Validation: source ≠ destination, qty ≤ available
- [ ] Error responses: `INSUFFICIENT_STOCK`, `TRANSFER_NOT_FOUND`, `INVALID_STATUS`
- [ ] Auth: bearer token + `inventory:transfers:*`

**Acceptance Criteria:**

- Ledger entries MUST be written atomically with balance updates

---

### [INV-64] — AA Warehouse Manager, ISBAT record stock adjustments with reason codes

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aarx3

---

**Scenario:**
When physical stock differs from system stock (damage, expiry, theft, found), the warehouse manager records an adjustment with a reason code so the variance is explained and auditable.

**Given:**

- The item is stocked at the warehouse
- The user has `inventory:adjustments:create` permission

**When:**

- The user submits an adjustment with quantity delta and reason

**Then:**
The system should:

- Apply the delta to the stock balance and write a StockLedger entry
- Require a reason code: damaged | miscounted | expired | theft | write-off | found
- Record who adjusted and when; adjustments are immutable once posted

### Fields

- **Item / Warehouse:** required
- **Quantity delta:** non-zero, negative allowed
- **Reason code:** required enum
- **Notes:** optional, required for theft/write-off

### Buttons

- **Post Adjustment**
  - Confirmation dialog summarizing the delta before posting

---

#### Empty States

- "No adjustments recorded" in the adjustments list

---

#### Post-Action Behavior

- Balance refreshes; adjustment appears in list with reason badge

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-INV-64

**Title:** FE: Adjustment form + list with reason badges
**Parent:** INV-64
**Contract:** `contracts/inventory/adjustments.contract.md`

**Scope:**

- [ ] Types match `/inventory/adjustments` response shapes
- [ ] Confirmation dialog with delta summary
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-INV-64-adjustments

**Title:** BE: POST /inventory/adjustments — reason-coded adjustments
**Parent:** INV-64
**Contract:** `contracts/inventory/adjustments.contract.md`

**Scope:**

- [ ] `POST/GET /inventory/adjustments` — returns `{ data, meta }`
- [ ] Validation: reason enum, non-zero delta, negative stock policy respected
- [ ] Error responses: `NEGATIVE_STOCK_BLOCKED`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `inventory:adjustments:*`

**Acceptance Criteria:**

- Posted adjustments MUST be immutable

---

### [INV-65] — AA Inventory Manager, ISBAT schedule and execute stock counts and reconcile variances

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aarxk

---

**Scenario:**
An inventory manager schedules a physical count (full, cycle, or spot), staff enter counted quantities, and the system computes variances which the manager reconciles into adjustments.

**Given:**

- Items are stocked at the warehouse
- The user has `inventory:counts:manage` permission

**When:**

- The user schedules a count, enters counted quantities, and confirms reconciliation

**Then:**
The system should:

- Snapshot expected quantities when the count starts
- Compute variance per line (counted − expected)
- Generate reason-coded adjustments on reconciliation approval
- Track count status: scheduled → in progress → completed

### Fields

- **Count type:** full | cycle | spot
- **Warehouse / scope:** required
- **Counted qty per line:** numeric ≥ 0

### Buttons

- **Schedule Count** / **Start** / **Reconcile**
  - Reconcile shows variance summary and requires confirmation

---

#### Empty States

- "No counts scheduled" with schedule call-to-action

---

#### Post-Action Behavior

- Variances post as adjustments; count locks as completed

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-INV-65

**Title:** FE: Count scheduling, entry sheet, variance reconciliation
**Parent:** INV-65
**Contract:** `contracts/inventory/stock-counts.contract.md`

**Scope:**

- [ ] Types match `/inventory/counts` response shapes
- [ ] Variance table with highlight on non-zero rows
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-INV-65-counts

**Title:** BE: /inventory/counts — schedule/execute/reconcile
**Parent:** INV-65
**Contract:** `contracts/inventory/stock-counts.contract.md`

**Scope:**

- [ ] `POST /inventory/counts` + start/reconcile actions — returns `{ data, meta }`
- [ ] Snapshot expected qty at start; variance computed server-side
- [ ] Error responses: `COUNT_NOT_FOUND`, `INVALID_STATUS`
- [ ] Auth: bearer token + `inventory:counts:manage`

**Acceptance Criteria:**

- Reconciliation MUST create adjustments transactionally

---

### [INV-66] — AA Inventory Manager, ISBAT configure reorder rules with reorder point and safety stock

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aary9

---

**Scenario:**
An inventory manager sets per-item reorder rules (reorder point, reorder quantity, safety stock, min/max, preferred supplier) so low stock surfaces automatically and can trigger a purchase request.

**Given:**

- Items and at least one supplier exist
- The user has `inventory:reorder:manage` permission

**When:**

- The user saves a reorder rule for an item/warehouse

**Then:**
The system should:

- Persist the rule and evaluate it against available stock
- List items at/below reorder point in the reorder monitor
- Optionally auto-create a draft purchase request when breached (per rule flag)

### Fields

- **Reorder point / quantity:** required, ≥ 0
- **Safety stock / min / max:** optional, max ≥ min
- **Preferred supplier:** optional picker
- **Auto-PR:** boolean

### Buttons

- **Save Rule**
  - Validates min/max consistency before submit

---

#### Empty States

- Reorder monitor: "No items below reorder point 🎉"

---

#### Post-Action Behavior

- Monitor refreshes; breached items show severity badges

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-INV-66

**Title:** FE: Reorder rule form + reorder monitor list
**Parent:** INV-66
**Contract:** `contracts/inventory/reorder.contract.md`

**Scope:**

- [ ] Types match `/inventory/reorder` response shapes
- [ ] Monitor with severity badges and filters
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-INV-66-reorder

**Title:** BE: /inventory/reorder — rules CRUD + breach evaluation
**Parent:** INV-66
**Contract:** `contracts/inventory/reorder.contract.md`

**Scope:**

- [ ] `POST/GET/PATCH /inventory/reorder` + monitor query — returns `{ data, meta }`
- [ ] Validation: numeric bounds, max ≥ min
- [ ] Error responses: `RULE_NOT_FOUND`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `inventory:reorder:manage`

**Acceptance Criteria:**

- Breach evaluation MUST use available (not on-hand) quantity

---

### [INV-67] — AA Inventory Manager, ISBAT view an inventory valuation report by warehouse

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aaryv

---

**Scenario:**
An inventory manager views total inventory value (quantity × cost, per the tenant costing method) by warehouse and category to support month-end review.

**Given:**

- Stock balances and cost layers exist
- The user has `inventory:reports:read` permission

**When:**

- The user opens Inventory → Reports → Valuation and applies filters

**Then:**
The system should:

- Show value per item with qty, unit cost (FIFO/LIFO/weighted avg per config), and extended value
- Support warehouse and category filters and an as-of date
- Show grand total and subtotals per warehouse

### Filters

- **Warehouse / Category:** multi-select
- **As-of date:** defaults to today

### Buttons

- **Apply Filters** / **Reset**

---

#### Empty States

- "No stock to value for the selected filters"

---

#### Post-Action Behavior

- Table re-queries without full page reload

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-INV-67

**Title:** FE: Valuation report table with filters and totals
**Parent:** INV-67
**Contract:** `contracts/inventory/valuation-report.contract.md`

**Scope:**

- [ ] Types match `/inventory/reports/valuation` response shape
- [ ] Subtotal/grand-total rows
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-INV-67-valuation

**Title:** BE: GET /inventory/reports/valuation — qty × cost by warehouse
**Parent:** INV-67
**Contract:** `contracts/inventory/valuation-report.contract.md`

**Scope:**

- [ ] `GET /inventory/reports/valuation?warehouseId&categoryId&asOf` — returns `{ data, meta }`
- [ ] Costing method respected from tenant config
- [ ] Error responses: `VALIDATION_ERROR`
- [ ] Auth: bearer token + `inventory:reports:read`

**Acceptance Criteria:**

- Totals MUST be computed server-side

---

### [INV-68] — AA Warehouse Manager, ISBAT view the stock movement ledger per item

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aarzf

---

**Scenario:**
A warehouse manager audits how an item's balance changed over time — every receipt, sale, transfer, adjustment, and return — in one chronological ledger view with running balance.

**Given:**

- The item has stock movement history (StockLedger entries exist in the backend)
- The user has `inventory:stock:read` permission

**When:**

- The user opens an item's Movements tab (or Stock Hub → item → ledger)

**Then:**
The system should:

- List ledger entries newest-first with type, quantity delta, warehouse, reference document, actor, and timestamp
- Show a running balance column
- Filter by movement type, warehouse, and date range

### Filters

- **Type:** receipt | sale | transfer | adjustment | return | write-off
- **Warehouse / Date range**

### Buttons

- **Export CSV** (optional, stretch)

---

#### Empty States

- "No movements recorded for this item"

---

#### Post-Action Behavior

- N/A (read-only view)

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-INV-68

**Title:** FE: Item movement ledger view with running balance
**Parent:** INV-68
**Contract:** `contracts/inventory/stock-ledger.contract.md`

**Scope:**

- [ ] Types match `/inventory/stock/:itemId/ledger` response shape
- [ ] Paginated table with type/warehouse/date filters
- [ ] Handle all error codes from the contract
- [ ] Loading/empty states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-INV-68-ledger

**Title:** BE: GET /inventory/stock/:itemId/ledger — paginated movement query
**Parent:** INV-68
**Contract:** `contracts/inventory/stock-ledger.contract.md`

**Scope:**

- [ ] `GET /inventory/stock/:itemId/ledger?type&warehouseId&from&to&page&pageSize` — returns `{ data, meta }` with running balance
- [ ] Validation: date range, pagination bounds
- [ ] Error responses: `ITEM_NOT_FOUND`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `inventory:stock:read`

**Acceptance Criteria:**

- Running balance MUST be consistent with StockLedger order

---

### [INV-69] — AA Warehouse Manager, ISBAT receive goods against a purchase order with batch capture

**Status:** TO DO
**Priority:** urgent
**ClickUp:** https://app.clickup.com/t/86d3aat0b

---

**Scenario:**
Inbound deliveries from suppliers are received against an expected purchase order; received quantities, batch/expiry, and quality-hold flags are captured, and stock plus the inventory GL are updated. Charter scope: "Stock receiving". Schema models (`GoodsReceipt`, `PurchaseOrder`) exist in the backend but have no controllers/services yet.

**Given:**

- A purchase order exists with expected lines
- The user has `inventory:receiving:create` permission

**When:**

- The user records a goods receipt with received quantities per line

**Then:**
The system should:

- Validate received qty per line (over-receipt warning/threshold)
- Increment stock and write StockLedger receipt entries
- Capture batch number, expiry, and serials where the item requires them
- Support quality hold per line (held stock not available for sale)
- Update PO received quantities and status (partial / fully received)

### Fields

- **PO reference:** required picker (open POs)
- **Received qty per line:** ≥ 0
- **Batch / Expiry / Serials:** per item tracking config
- **Quality hold:** boolean per line

### Buttons

- **Post Receipt**
  - Confirmation with receipt summary; disabled until at least one line has qty > 0

---

#### Empty States

- "No open purchase orders to receive against"

---

#### Post-Action Behavior

- Stock balances update; PO status reflects received progress; receipt is printable

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-INV-69

**Title:** FE: Goods receiving flow (PO picker → line entry → post)
**Parent:** INV-69
**Contract:** `contracts/inventory/goods-receipt.contract.md`

**Scope:**

- [ ] Types match `/inventory/goods-receipts` response shapes
- [ ] Line entry grid with batch/expiry/serial inputs per tracking config
- [ ] Handle all error codes from the contract
- [ ] Loading/empty states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly
- Error handling MUST cover all contract error codes

---

### SUBTASK (Backend) — BE-INV-69-goods-receipts

**Title:** BE: POST /inventory/goods-receipts — receive against PO
**Parent:** INV-69
**Contract:** `contracts/inventory/goods-receipt.contract.md`

**Scope:**

- [ ] Implement controllers/services for existing `GoodsReceipt`/`PurchaseOrder` schema models
- [ ] `POST /inventory/goods-receipts` — validates PO lines, writes stock + ledger atomically, returns `{ data, meta }`
- [ ] `GET /inventory/goods-receipts` + `GET /purchase-orders?status=open` list endpoints
- [ ] Error responses: `PO_NOT_FOUND`, `OVER_RECEIPT`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `inventory:receiving:*`

**Acceptance Criteria:**

- Stock, ledger, and PO status updates MUST be transactional
- Quality-held quantities MUST be excluded from available stock

---

### [INV-70] — AA Inventory Manager, ISBAT manage supplier records with contacts and item mappings

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aat19

---

**Scenario:**
An inventory manager maintains supplier reference records — contacts, status, and which items each supplier provides (with lead time and price) — supporting receiving and reorder flows. Charter scope: "Supplier reference management". `Supplier`/`ItemSupplier` schema models exist; dedicated UI and (if missing) endpoints are needed.

**Given:**

- The user has `inventory:suppliers:manage` permission

**When:**

- The user creates or edits a supplier and maps items to it

**Then:**
The system should:

- Save supplier with name, contacts, status (active/inactive)
- Map items to the supplier with lead time days and supplier price
- Show suppliers in a searchable list; supplier picker available on reorder rules and receiving

### Fields

- **Supplier name:** required, unique
- **Contact person / phone / email:** optional
- **Status:** active | inactive
- **Item mappings:** item + lead time + price rows

### Buttons

- **Save Supplier** / **Add Item Mapping**

---

#### Empty States

- "No suppliers yet" with create call-to-action

---

#### Post-Action Behavior

- Supplier available in pickers across receiving and reorder screens

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-INV-70

**Title:** FE: Supplier list + form with item mapping rows
**Parent:** INV-70
**Contract:** `contracts/inventory/suppliers.contract.md`

**Scope:**

- [ ] Types match `/inventory/suppliers` response shapes
- [ ] Item-mapping editor (add/remove rows)
- [ ] Handle all error codes from the contract
- [ ] Loading/empty states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-INV-70-suppliers

**Title:** BE: CRUD /inventory/suppliers — supplier reference + item mappings
**Parent:** INV-70
**Contract:** `contracts/inventory/suppliers.contract.md`

**Scope:**

- [ ] `POST/GET/PATCH /inventory/suppliers` (+ item-mapping sub-resource) — returns `{ data, meta }`
- [ ] Validation: unique name, mapping item exists
- [ ] Error responses: `SUPPLIER_NOT_FOUND`, `DUPLICATE_SUPPLIER`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `inventory:suppliers:manage`

**Acceptance Criteria:**

- Response JSON MUST match contract response shape exactly

---

### [INV-71] — AA Inventory Manager, ISBAT paginate, sort, and search the items table

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aat1z

---

**Scenario:**
The item master currently loads all rows at once with no sortable columns. With NIG's catalogue size this degrades quickly. The items table should paginate server-side, sort by column headers, and keep the existing search/filters.

**Given:**

- More items exist than one page size (e.g. > 25)
- The user has `inventory:items:read` permission

**When:**

- The user opens Inventory → Items, changes pages, or clicks a column header

**Then:**
The system should:

- Fetch pages server-side (`page`, `pageSize`, default 25)
- Sort by name, SKU, category, price, updated date (asc/desc toggle on header click)
- Preserve search + filters + sort in the URL (shareable state)
- Show total count and page controls

### Table

- **Columns:** SKU, name, category, price, stock, status, updated
- **Page sizes:** 25 / 50 / 100

### Buttons

- **Page controls:** first/prev/next/last; disabled at bounds

---

#### Empty States

- Existing "no items" state preserved; "no results" state when filters exclude everything

---

#### Post-Action Behavior

- Page changes do not reset filters; sort indicator visible on the active column

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-INV-71

**Title:** FE: Server-side pagination + sorting on item master table
**Parent:** INV-71
**Contract:** `contracts/inventory/items-list.contract.md`

**Scope:**

- [ ] URL-synced page/sort state (nuqs)
- [ ] Sortable column headers with indicators
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Pagination state MUST survive refresh via URL

---

### SUBTASK (Backend) — BE-INV-71-items-pagination

**Title:** BE: GET /inventory/items — add page/pageSize/sort params
**Parent:** INV-71
**Contract:** `contracts/inventory/items-list.contract.md`

**Scope:**

- [ ] `GET /inventory/items?page&pageSize&sortBy&sortDir&search` — returns `{ data, meta: { total, page, pageSize } }`
- [ ] Validation: pageSize ≤ 100, sortBy whitelist
- [ ] Error responses: `VALIDATION_ERROR`
- [ ] Auth: bearer token + `inventory:items:read`

**Acceptance Criteria:**

- `meta.total` MUST reflect the filtered count

---

### [INV-72] — AA Stock Controller, ISBAT record the supplier and PO date on a Receiving Report so the source of goods is traceable

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3p2v9n

---

**Scenario:**
When encoding a Receiving Report, the stock controller already enters the supplier and the linked PO's date in the UI, but neither value reaches the backend today — the fields are silently dropped before the RR is saved, so the report has no record of who supplied the goods or when the PO was raised.

**Given:**

- A Receiving Report is being encoded, with or without a linked PO
- The RR form's Supplier and PO Date fields are visible and fillable

**When:**

- The stock controller fills in Supplier and PO Date (when a PO exists) and saves the RR

**Then:**
The system should:

- Persist the selected supplier against the Receiving Report record
- Persist the PO date alongside the existing PO number
- Show both values on the RR detail view and on the printed/exported RR document
- Make Supplier a required field when no PO is linked, so origin is always known

### Fields

- **Supplier:** searchable select from the supplier master list; required when no PO is linked
- **PO Date:** date picker, auto-filled from the linked PO when one is selected, editable

### Buttons

- **Save Receiving Report**
  - Disabled until Supplier is set (linked POs auto-fill it; standalone RRs require manual entry)

---

#### Empty States

- If no suppliers exist yet, the Supplier field shows "No suppliers found — add one in Inventory > Suppliers" with a shortcut link

---

#### Post-Action Behavior

- Saved RR immediately reflects Supplier and PO Date on its detail view and appears correctly in the Receiving Report list/export

---

### [INV-73] — AA Accountant, ISBAT flag 1% supplier withholding tax on a Receiving Report and see it summarized

**Status:** TO DO
**Priority:** urgent
**ClickUp:** https://app.clickup.com/t/86d3p2vbz

---

**Scenario:**
Some suppliers are subject to 1% withholding tax on goods received. Today there's no way to flag or track this on a Receiving Report — withholding only exists in an unrelated AP-bill settlement screen, so tax-withheld amounts for receiving are neither captured nor reportable.

**Given:**

- A Receiving Report is being encoded for a supplier subject to withholding

**When:**

- The stock controller flags "Subject to 1% withholding" on the RR via a dropdown

**Then:**
The system should:

- Calculate 1% of the applicable cost as tax withheld
- Store the withheld amount against the RR
- Roll withheld amounts up into a withholding-tax summary report, filterable by supplier and date range

### Fields

- **Withholding:** dropdown (None / 1% Withholding), defaults to the supplier's configured default if one exists
- **Withheld Amount:** read-only, computed field shown once withholding is flagged

### Buttons

- **Save Receiving Report**
  - Recalculates Withheld Amount live as cost fields change

---

#### Empty States

- Withholding summary report shows "No withheld amounts for this period" when nothing is flagged

---

#### Post-Action Behavior

- Saved RR shows the withheld amount on its detail view; the withholding summary report updates immediately

---

### [INV-74] — AA Stock Controller, ISBAT see accurate delivered-vs-outstanding quantities on a PO across multiple partial receipts

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3p2vdy

---

**Scenario:**
A PO is often delivered in more than one batch. Today, each Receiving Report shows discrepancy for that single receipt only — the PO's cumulative received quantity is never updated, so after a second or third partial delivery the "still outstanding" figure is wrong.

**Given:**

- A PO with quantity ordered greater than what's been received in a single RR
- At least one RR has already been posted against this PO

**When:**

- A stock controller posts another Receiving Report against the same PO line

**Then:**
The system should:

- Increment the PO line's received quantity by the newly-received quantity on save
- Show outstanding quantity as ordered minus cumulative received, not just this receipt's gap
- Mark the PO line as fully received once cumulative received meets or exceeds ordered quantity

### Fields

- **PO line table:** adds a "Received to date" column alongside Ordered and Outstanding

### Buttons

- (none new — this is a correctness fix surfaced on the existing PO detail view)

---

#### Empty States

- n/a

---

#### Post-Action Behavior

- PO detail view and the Branches Stock Request / receiving dashboards immediately reflect the corrected outstanding quantity after each partial receipt

---

### [INV-75] — AA Accountant, ISBAT see a Receiving Report automatically post to the General Ledger

**Status:** TO DO
**Priority:** urgent
**ClickUp:** https://app.clickup.com/t/86d3p2vey

---

**Scenario:**
Saving a Receiving Report updates the stock ledger and inventory balances correctly, but never touches the General Ledger — inventory value on hand and the books fall out of sync until someone manually journals it.

**Given:**

- A Receiving Report is saved with cost information on its lines

**When:**

- The RR is posted (saved as final, not draft)

**Then:**
The system should:

- Auto-generate the corresponding journal entry (debit Inventory, credit AP or GRNI as applicable) using the RR's line costs
- Link the journal entry back to the RR for traceability
- Reject posting if a required GL account mapping is missing, with a clear error naming the missing mapping

### Fields

- **RR detail view:** adds a "Journal Entry" reference link once posted

### Buttons

- **Post Receiving Report**
  - Now also triggers the GL posting; shows a brief posting-in-progress state

---

#### Empty States

- n/a

---

#### Post-Action Behavior

- Posted RR shows a linked journal entry; the General Ledger and inventory valuation reports reflect the receipt immediately

---

### [INV-76] — AA Branch Manager, ISBAT see Brand, Model, Available, Reserved, and Remaining balance per warehouse before raising a stock request

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3p2vgj

---

**Scenario:**
The stock request screen only lets a branch manager pick an item and type a quantity — there's no visibility into what's actually available at the source warehouse, so requests are raised blind and often over-ask or under-ask.

**Given:**

- A branch manager has opened the stock request screen and selected a source warehouse

**When:**

- They search or browse for an item to request

**Then:**
The system should:

- Show Brand, Model, Warehouse Available Stock, Reserved, and Remaining Balance for each matching item at the selected warehouse
- Update these figures live as the warehouse selection changes
- Warn (not block) if the requested quantity exceeds the remaining balance

### Availability table

- **Columns:** Brand, Model, Available, Reserved, Remaining Balance
- Row highlight when requested qty exceeds remaining balance

### Buttons

- **Raise Request**
  - Shows a confirm step if quantity exceeds remaining balance

---

#### Empty States

- "No stock found at this warehouse for your search" when nothing matches

---

#### Post-Action Behavior

- After raising the request, the availability table refreshes to reflect the newly-reserved quantity

---

### [INV-77] — AA Branch Manager, ISBAT have an approved stock request automatically create the matching inter-branch stock transfer

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3p2vjc

---

**Scenario:**
Today, approving a stock request only creates an internal reservation — no actual stock transfer is ever generated, so the requested stock never physically moves without someone manually starting a separate transfer.

**Given:**

- A branch stock request has been approved and reserved at the source warehouse

**When:**

- The approval is finalized

**Then:**
The system should:

- Automatically create a matching Stock Transfer (source = requested warehouse, destination = requesting branch, quantity = approved quantity)
- Link the Stock Transfer back to the originating stock request for traceability
- Carry the request's item/quantity details onto the transfer without re-entry

### Fields

- **Stock Request detail view:** adds a "Linked Transfer" reference once created

### Buttons

- **Approve**
  - Now also triggers transfer creation; no separate manual step needed

---

#### Empty States

- n/a

---

#### Post-Action Behavior

- The requesting branch immediately sees the new transfer in their incoming-transfers list

---

### [INV-78] — AA Branch Manager, ISBAT be automatically notified the moment a tracked item drops below its reorder threshold

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3p2vmg

---

**Scenario:**
Reorder alerts only show up when someone opens the alerts screen and asks — nothing pushes a notification when a threshold is actually breached, so branches can run low without anyone noticing until they check.

**Given:**

- An item has a configured reorder threshold for a branch/warehouse

**When:**

- Stock for that item falls below the threshold after a sale, transfer, or adjustment

**Then:**
The system should:

- Trigger an in-app (and, where configured, email) notification to the branch immediately
- Include item, current stock, and threshold in the notification
- Avoid duplicate notifications for the same breach until stock is replenished above threshold again

### Notification

- In-app notification bell shows a new low-stock alert with item name, current qty, threshold

### Buttons

- **Notification click**
  - Opens the reorder alerts screen filtered to that item

---

#### Empty States

- n/a

---

#### Post-Action Behavior

- Once the branch reorders and stock rises above threshold, the alert clears and a new breach can re-trigger a notification

---

### [INV-79] — AA Business Owner, ISBAT see reorder alerts ranked by each branch's actual most-bought items

**Status:** TO DO
**Priority:** normal
**ClickUp:** https://app.clickup.com/t/86d3p2vnc

---

**Scenario:**
The reorder-alerts list is currently sorted by a generic turnover-velocity metric — it doesn't reflect which items actually sell the most at a given branch, so high-priority alerts can get buried under low-volume items with a high velocity score.

**Given:**

- Multiple items across a branch have breached their reorder thresholds

**When:**

- The business owner opens the reorder alerts screen for a branch

**Then:**
The system should:

- Rank alerts by that branch's actual sales volume (most-bought first), not turnover velocity
- Let the owner re-sort by other columns (velocity, days-of-stock-remaining) if needed

### Alerts table

- Default sort: Most Bought (descending); sortable column headers for Velocity and Days Remaining

### Buttons

- (existing) — no new buttons, sort behavior change only

---

#### Empty States

- n/a

---

#### Post-Action Behavior

- n/a

---

### [INV-80] — AA Stock Controller, ISBAT receive a multi-part item under one serial with a configurable number of component SKUs

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3p2vub

---

**Scenario:**
Some items — not just furniture — are sold as one serialized piece made of several component SKUs. Today the data model only supports one serial per one item; there's no way to say "this one serial is made of these N SKUs."

**Given:**

- An item is configured as multi-part with an admin-defined, non-fixed number of component SKUs

**When:**

- A stock controller receives that item

**Then:**
The system should:

- Let the stock controller assign one serial number to the piece and select/receive its N component SKUs against that serial
- Store the parts-to-serial relationship so it can be looked up later (for reporting, repair, warranty)
- Allow the component count to differ per item — not hardcoded to any fixed number

### Receiving line

- "Multi-part" toggle on an item's line; when on, shows a repeatable "Add component SKU" row

### Buttons

- **Add Component SKU**
  - Adds another parts row
- **Remove**
  - Removes one parts row

---

#### Empty States

- "No components added yet" until at least one is added

---

#### Post-Action Behavior

- The received serial's detail view lists all its component SKUs

---

### [INV-81] — AA Stock Controller, ISBAT receive and track a bundled unit as one SKU with multiple serialized components sold together

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3p2vw6

---

**Scenario:**
A split-type aircon (and similar products) is one SKU but ships as two serialized components — indoor and outdoor units — that must always move and sell together. The existing bundle model only handles the opposite case (one bundle made of several different SKUs), so this pattern has nowhere to live.

**Given:**

- An item is configured as a bundled unit — one SKU, a defined number of serialized components

**When:**

- A stock controller receives that item

**Then:**
The system should:

- Let the stock controller capture a serial number for each component (e.g. indoor + outdoor) under the same SKU
- Keep all components of a bundled unit linked so they can't be split apart or sold separately by mistake
- Show all component serials together wherever that SKU's stock is displayed

### Receiving line

- "Bundled unit" toggle on an item's line; when on, shows one serial-entry field per configured component (e.g. Indoor Serial, Outdoor Serial)

### Buttons

- (uses the standard Save Receiving Report action)

---

#### Empty States

- n/a

---

#### Post-Action Behavior

- The bundled unit appears as a single stock entry with all component serials attached

---

### [INV-82] — AA Business Owner, ISBAT turn head-office approval for inter-branch transfers on or off as an admin setting

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3p2vxj

---

**Scenario:**
Whether an inter-branch stock transfer needs head-office sign-off before the source branch can act on it should be a policy switch, not a hardcoded behavior — today there's no such setting at all; every transfer skips straight to the source branch.

**Given:**

- The business owner is in Admin Settings

**When:**

- They toggle "Require head-office approval for inter-branch transfers" on or off

**Then:**
The system should:

- Apply the new setting to all transfers raised from that point on, with no recode or deployment needed
- When ON: route new transfer requests to head office for approval before the source branch sees them
- When OFF: route new transfer requests directly to the source branch, as today

### Admin Settings

- "Require head-office approval for inter-branch transfers" — on/off toggle, under Inventory settings

### Buttons

- **Save Settings**
  - Applies immediately

---

#### Empty States

- n/a

---

#### Post-Action Behavior

- Toggling the setting doesn't affect transfers already in flight, only new ones raised afterward

---

### [INV-83] — AA Branch Manager, ISBAT accept or reject an incoming stock transfer request before it moves

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3p2vyv

---

**Scenario:**
Right now a stock transfer goes straight from draft to in-transit with no chance for the source branch to review it — a branch manager should be able to accept or reject a transfer request before any stock actually leaves.

**Given:**

- A stock transfer request has been raised against this branch's warehouse (directly, or after head-office approval per INV-82)

**When:**

- The branch manager reviews the request

**Then:**
The system should:

- Let them Accept (moves the transfer to in-transit / dispatch-ready) or Reject (with a required reason)
- Prevent dispatch until Accept has happened

### Transfer request detail

- Shows requested item, quantity, requesting branch
- Reason field, required when rejecting

### Buttons

- **Accept**
  - Moves the transfer forward to dispatch
- **Reject**
  - Requires a reason, closes the request, nothing moves

---

#### Empty States

- n/a

---

#### Post-Action Behavior

- Rejected requests close immediately and stock stays where it is; accepted ones proceed to normal dispatch

---

### [INV-84] — AA Stock Controller, ISBAT see the serial number carried through a stock transfer and shown on the resulting Receiving Report

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3p2vzz

---

**Scenario:**
Serialized stock transfers currently only move a quantity — the specific serial being transferred is never recorded, and receiving a transfer doesn't touch the serial record or generate a proper Receiving Report, so there's no serial-level paper trail for inter-branch movement.

**Given:**

- A stock transfer is raised for a serialized item

**When:**

- The transfer is created, dispatched, and received

**Then:**
The system should:

- Require a specific serial number to be selected on the transfer line for serialized items
- Update that serial's location/branch on receipt
- Generate a Receiving Report for the transfer showing the serial number

### Transfer line

- Serial picker (required for serial-tracked items) alongside item and quantity

### Buttons

- **Dispatch / Receive**
  - Unchanged flow, now serial-aware

---

#### Empty States

- n/a

---

#### Post-Action Behavior

- Received transfer's serial shows the new branch as its location everywhere it's looked up (POS, stock request, item detail)

---

### [INV-85] — AA Branch Manager, ISBAT be notified when my stock transfer or request is rejected

**Status:** TO DO
**Priority:** normal
**ClickUp:** https://app.clickup.com/t/86d3p2w0r

---

**Scenario:**
When a stock request or transfer is rejected, the status changes but nobody is told — the requesting branch has to notice on their own by checking back.

**Given:**

- A branch has an open stock request or incoming transfer request

**When:**

- That request is rejected (at head-office approval or by the source branch)

**Then:**
The system should:

- Send the requesting branch manager an in-app (and, where configured, email) notification with the rejection reason
- Link the notification to the closed request for context

### Notification

- In-app notification shows "Request rejected: [reason]" with a link to the request

### Buttons

- n/a

---

#### Empty States

- n/a

---

#### Post-Action Behavior

- n/a

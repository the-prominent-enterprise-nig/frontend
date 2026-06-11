---
list: '05 - Inventory (INV)'
list_id: '901615166755'
last_synced: '2026-06-10'
---

# Inventory Tickets

## Summary

| ID     | Title                                                                                   | Status | Priority |
| ------ | --------------------------------------------------------------------------------------- | ------ | -------- |
| INV-63 | AA Warehouse Manager, ISBAT transfer stock between warehouses with in-transit tracking  | for QA | high     |
| INV-64 | AA Warehouse Manager, ISBAT record stock adjustments with reason codes                  | for QA | high     |
| INV-65 | AA Inventory Manager, ISBAT schedule and execute stock counts and reconcile variances   | for QA | high     |
| INV-66 | AA Inventory Manager, ISBAT configure reorder rules with reorder point and safety stock | for QA | high     |
| INV-67 | AA Inventory Manager, ISBAT view an inventory valuation report by warehouse             | for QA | high     |
| INV-68 | AA Warehouse Manager, ISBAT view the stock movement ledger per item                     | TO DO  | high     |
| INV-69 | AA Warehouse Manager, ISBAT receive goods against a purchase order with batch capture   | TO DO  | urgent   |
| INV-70 | AA Inventory Manager, ISBAT manage supplier records with contacts and item mappings     | TO DO  | high     |
| INV-71 | AA Inventory Manager, ISBAT paginate, sort, and search the items table                  | TO DO  | high     |

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

---
list: '05 - Inventory (INV)'
list_id: '901615166755'
last_synced: '2026-06-10'
---

# Inventory Tickets

## Summary

| ID    | Title                                                                                 | Status | Priority |
| ----- | ------------------------------------------------------------------------------------- | ------ | -------- |
| INV-1 | AA Warehouse Manager, ISBAT view the stock movement ledger per item                   | TO DO  | high     |
| INV-2 | AA Warehouse Manager, ISBAT receive goods against a purchase order with batch capture | TO DO  | urgent   |
| INV-3 | AA Inventory Manager, ISBAT manage supplier records with contacts and item mappings   | TO DO  | high     |
| INV-4 | AA Inventory Manager, ISBAT paginate, sort, and search the items table                | TO DO  | high     |

---

## Tickets

### [INV-1] — AA Warehouse Manager, ISBAT view the stock movement ledger per item

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

### SUBTASK (Frontend) — FE-INV-1

**Title:** FE: Item movement ledger view with running balance
**Parent:** INV-1
**Contract:** `contracts/inventory/stock-ledger.contract.md`

**Scope:**

- [ ] Types match `/inventory/stock/:itemId/ledger` response shape
- [ ] Paginated table with type/warehouse/date filters
- [ ] Handle all error codes from the contract
- [ ] Loading/empty states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-INV-1-ledger

**Title:** BE: GET /inventory/stock/:itemId/ledger — paginated movement query
**Parent:** INV-1
**Contract:** `contracts/inventory/stock-ledger.contract.md`

**Scope:**

- [ ] `GET /inventory/stock/:itemId/ledger?type&warehouseId&from&to&page&pageSize` — returns `{ data, meta }` with running balance
- [ ] Validation: date range, pagination bounds
- [ ] Error responses: `ITEM_NOT_FOUND`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `inventory:stock:read`

**Acceptance Criteria:**

- Running balance MUST be consistent with StockLedger order

---

### [INV-2] — AA Warehouse Manager, ISBAT receive goods against a purchase order with batch capture

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

### SUBTASK (Frontend) — FE-INV-2

**Title:** FE: Goods receiving flow (PO picker → line entry → post)
**Parent:** INV-2
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

### SUBTASK (Backend) — BE-INV-2-goods-receipts

**Title:** BE: POST /inventory/goods-receipts — receive against PO
**Parent:** INV-2
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

### [INV-3] — AA Inventory Manager, ISBAT manage supplier records with contacts and item mappings

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

### SUBTASK (Frontend) — FE-INV-3

**Title:** FE: Supplier list + form with item mapping rows
**Parent:** INV-3
**Contract:** `contracts/inventory/suppliers.contract.md`

**Scope:**

- [ ] Types match `/inventory/suppliers` response shapes
- [ ] Item-mapping editor (add/remove rows)
- [ ] Handle all error codes from the contract
- [ ] Loading/empty states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-INV-3-suppliers

**Title:** BE: CRUD /inventory/suppliers — supplier reference + item mappings
**Parent:** INV-3
**Contract:** `contracts/inventory/suppliers.contract.md`

**Scope:**

- [ ] `POST/GET/PATCH /inventory/suppliers` (+ item-mapping sub-resource) — returns `{ data, meta }`
- [ ] Validation: unique name, mapping item exists
- [ ] Error responses: `SUPPLIER_NOT_FOUND`, `DUPLICATE_SUPPLIER`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `inventory:suppliers:manage`

**Acceptance Criteria:**

- Response JSON MUST match contract response shape exactly

---

### [INV-4] — AA Inventory Manager, ISBAT paginate, sort, and search the items table

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

### SUBTASK (Frontend) — FE-INV-4

**Title:** FE: Server-side pagination + sorting on item master table
**Parent:** INV-4
**Contract:** `contracts/inventory/items-list.contract.md`

**Scope:**

- [ ] URL-synced page/sort state (nuqs)
- [ ] Sortable column headers with indicators
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Pagination state MUST survive refresh via URL

---

### SUBTASK (Backend) — BE-INV-4-items-pagination

**Title:** BE: GET /inventory/items — add page/pageSize/sort params
**Parent:** INV-4
**Contract:** `contracts/inventory/items-list.contract.md`

**Scope:**

- [ ] `GET /inventory/items?page&pageSize&sortBy&sortDir&search` — returns `{ data, meta: { total, page, pageSize } }`
- [ ] Validation: pageSize ≤ 100, sortBy whitelist
- [ ] Error responses: `VALIDATION_ERROR`
- [ ] Auth: bearer token + `inventory:items:read`

**Acceptance Criteria:**

- `meta.total` MUST reflect the filtered count

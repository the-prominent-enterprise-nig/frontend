---
list: '06 - Point of Sale (POS)'
list_id: '901615166757'
last_synced: '2026-06-10'
---

# Point of Sale Tickets

## Summary

| ID     | Title                                                                         | Status | Priority |
| ------ | ----------------------------------------------------------------------------- | ------ | -------- |
| POS-55 | AA Cashier, ISBAT complete a sale using only the keyboard and barcode scanner | TO DO  | high     |
| POS-56 | AA Manager, ISBAT paginate, sort, and filter the POS transactions table       | TO DO  | normal   |

---

## Tickets

### [POS-55] — AA Cashier, ISBAT complete a sale using only the keyboard and barcode scanner

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aatdn

---

**Scenario:**
Checkout is the highest-frequency screen in the system. Cashiers should never need the mouse for a standard sale: scan (or type) a barcode, adjust quantity, choose payment, and confirm — all via keyboard. The search field already accepts barcode input; this ticket adds the shortcut layer and quantity entry.

**Given:**

- An open POS session on a terminal
- The checkout page is loaded with the search field focused

**When:**

- The cashier scans items and uses keyboard shortcuts through payment

**Then:**
The system should:

- Keep the scan/search field auto-focused after each add (focus returns after any action)
- Support shortcuts: `F2` focus search, `+`/`-` adjust qty of last-added line, `F4` quantity entry for selected line, `F8` open payment, `F9` cash exact, `Esc` cancel dialog, `Enter` confirm
- Show a discoverable shortcut legend (`?` opens cheat-sheet overlay)
- Navigate cart lines with arrow keys; `Delete` removes the selected line (with confirm)
- Complete payment and start the next sale without any mouse interaction

### Sections

- **Shortcut legend overlay:** grouped by stage (cart, payment)

### Buttons

- All existing buttons remain; shortcuts are additive, shown as hints on buttons

---

#### Empty States

- Empty cart: shortcuts inactive except search focus

---

#### Post-Action Behavior

- After completed sale, focus returns to scan field for the next customer

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-POS-55

**Title:** FE: Keyboard shortcut layer + focus management on checkout
**Parent:** POS-55
**Contract:** `contracts/pos/keyboard-checkout.contract.md`

**Scope:**

- [ ] Global key handler scoped to checkout page (disabled while dialogs capture input)
- [ ] Focus-return logic after add/qty/payment actions
- [ ] Shortcut legend overlay (`?`)
- [ ] Cart line selection model (arrow keys, Delete)

**Acceptance Criteria:**

- A standard cash sale MUST be completable with zero mouse interaction
- Shortcuts MUST NOT fire while typing in text inputs other than the scan field

---

### SUBTASK (Backend) — BE-POS-55-none

**Title:** BE: N/A — frontend-only ticket
**Parent:** POS-55
**Contract:** `contracts/pos/keyboard-checkout.contract.md`

**Scope:**

- [ ] No backend work; existing transaction endpoints unchanged

**Acceptance Criteria:**

- N/A

---

### [POS-56] — AA Manager, ISBAT paginate, sort, and filter the POS transactions table

**Status:** TO DO
**Priority:** normal
**ClickUp:** https://app.clickup.com/t/86d3aated

---

**Scenario:**
The POS transactions list loads all rows at once with filters but no pagination or column sorting. With daily branch volume this will degrade fast. The table should paginate server-side and sort by date, amount, type, and status, keeping existing filters.

**Given:**

- More transactions exist than one page size
- The user has `pos:transactions:read` permission

**When:**

- The user opens POS → Transactions, changes pages, or clicks a column header

**Then:**
The system should:

- Fetch pages server-side (`page`, `pageSize`, default 25)
- Sort asc/desc by date, transaction number, amount, type, status
- Preserve filters + sort + page in the URL (shareable)
- Show total count and page controls

### Table

- **Columns:** txn #, date/time, type, cashier, terminal, amount, status

### Buttons

- **Page controls:** first/prev/next/last; disabled at bounds

---

#### Empty States

- Existing empty/"no results" states preserved

---

#### Post-Action Behavior

- Page changes do not reset filters; active sort indicated on header

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-POS-56

**Title:** FE: Server-side pagination + sorting on transactions table
**Parent:** POS-56
**Contract:** `contracts/pos/transactions-list.contract.md`

**Scope:**

- [ ] URL-synced page/sort state (nuqs)
- [ ] Sortable headers with indicators
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Pagination state MUST survive refresh via URL

---

### SUBTASK (Backend) — BE-POS-56-txn-pagination

**Title:** BE: GET /pos/transactions — add page/pageSize/sort params
**Parent:** POS-56
**Contract:** `contracts/pos/transactions-list.contract.md`

**Scope:**

- [ ] `GET /pos/transactions?page&pageSize&sortBy&sortDir&type&status&from&to` — returns `{ data, meta: { total, page, pageSize } }`
- [ ] Validation: pageSize ≤ 100, sortBy whitelist
- [ ] Error responses: `VALIDATION_ERROR`
- [ ] Auth: bearer token + `pos:transactions:read`

**Acceptance Criteria:**

- `meta.total` MUST reflect the filtered count

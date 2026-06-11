---
list: '08 - Accounting (ACC)'
list_id: '901615166760'
last_synced: '2026-06-10'
---

# Accounting Tickets

## Summary

| ID     | Title                                                                | Status | Priority |
| ------ | -------------------------------------------------------------------- | ------ | -------- |
| ACC-23 | AA Accountant, ISBAT work a collections worklist of overdue invoices | TO DO  | high     |
| ACC-24 | AA Accountant, ISBAT paginate and sort the AR invoices table         | TO DO  | normal   |

---

## Tickets

### [ACC-23] — AA Accountant, ISBAT work a collections worklist of overdue invoices

**Status:** TO DO
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aat91

---

**Scenario:**
Charter scope: "Collections monitoring". The accountant needs a single worklist of overdue AR invoices ordered by age and amount, where each row supports a follow-up action (log contact, set promise-to-pay date) so collection activity is tracked rather than ad hoc.

**Given:**

- AR invoices exist past their due date
- The user has `accounting:ar:read` and `accounting:collections:manage` permissions

**When:**

- The user opens Accounting → Collections

**Then:**
The system should:

- List overdue invoices with customer, balance, days overdue, and aging bucket
- Allow logging a collection note (contact made, outcome) per invoice
- Allow setting a promise-to-pay date that surfaces on the worklist when breached
- Filter by aging bucket, customer, and branch

### Filters

- **Aging bucket:** 1–30 | 31–60 | 61–90 | 90+
- **Customer / Branch / Promise status**

### Buttons

- **Log Contact**
  - Opens note dialog with outcome select
- **Set Promise Date**
  - Date must be in the future

---

#### Empty States

- "No overdue invoices 🎉" when fully collected

---

#### Post-Action Behavior

- Row updates with last-contact and promise badge without page reload

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-ACC-23

**Title:** FE: Collections worklist with contact log + promise-to-pay
**Parent:** ACC-23
**Contract:** `contracts/accounting/collections.contract.md`

**Scope:**

- [ ] Types match `/accounting/collections` response shapes
- [ ] Worklist table with aging filters and action dialogs
- [ ] Handle all error codes from the contract
- [ ] Loading/empty states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-ACC-23-collections

**Title:** BE: GET /accounting/collections + follow-up actions
**Parent:** ACC-23
**Contract:** `contracts/accounting/collections.contract.md`

**Scope:**

- [ ] `GET /accounting/collections?bucket&customerId&branchId` — overdue invoices with aging, returns `{ data, meta }`
- [ ] `POST /accounting/collections/:invoiceId/contact` and `/promise` actions
- [ ] Error responses: `INVOICE_NOT_FOUND`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `accounting:collections:manage`

**Acceptance Criteria:**

- Aging buckets MUST match the AR aging report buckets exactly

---

### [ACC-24] — AA Accountant, ISBAT paginate and sort the AR invoices table

**Status:** TO DO
**Priority:** normal
**ClickUp:** https://app.clickup.com/t/86d3aat9k

---

**Scenario:**
The AR invoices list loads all rows without pagination or sortable headers. The table should paginate server-side and sort by invoice number, customer, due date, balance, and status.

**Given:**

- More invoices exist than one page size
- The user has `accounting:ar:read` permission

**When:**

- The user opens Accounting → AR Invoices, changes pages, or clicks a column header

**Then:**
The system should:

- Fetch pages server-side (`page`, `pageSize`, default 25)
- Sort asc/desc by invoice number, customer, issue date, due date, balance, status
- Preserve filters + sort + page in the URL
- Show total count and page controls

### Table

- **Columns:** invoice #, customer, issue date, due date, amount, balance, status

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

### SUBTASK (Frontend) — FE-ACC-24

**Title:** FE: Server-side pagination + sorting on AR invoices table
**Parent:** ACC-24
**Contract:** `contracts/accounting/ar-invoices-list.contract.md`

**Scope:**

- [ ] URL-synced page/sort state (nuqs)
- [ ] Sortable headers with indicators
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Pagination state MUST survive refresh via URL

---

### SUBTASK (Backend) — BE-ACC-24-ar-pagination

**Title:** BE: GET /ar-invoices — add page/pageSize/sort params
**Parent:** ACC-24
**Contract:** `contracts/accounting/ar-invoices-list.contract.md`

**Scope:**

- [ ] `GET /ar-invoices?page&pageSize&sortBy&sortDir&status&search` — returns `{ data, meta: { total, page, pageSize } }`
- [ ] Validation: pageSize ≤ 100, sortBy whitelist
- [ ] Error responses: `VALIDATION_ERROR`
- [ ] Auth: bearer token + `accounting:ar:read`

**Acceptance Criteria:**

- `meta.total` MUST reflect the filtered count

---
list: '08 - Accounting (ACC)'
list_id: '901615166760'
last_synced: '2026-06-10'
---

# Accounting Tickets

## Summary

| ID    | Title                                                                                                 | Status | Priority |
| ----- | ----------------------------------------------------------------------------------------------------- | ------ | -------- |
| ACC-1 | AA Accountant, ISBAT work a collections worklist of overdue invoices                                  | TO DO  | high     |
| ACC-2 | AA Accountant, ISBAT paginate and sort the AR invoices table                                          | TO DO  | normal   |
| ACC-3 | AA Accounting Personnel, ISBAT record one deposit itemised across the banks that took the day's money | TO DO  | high     |

---

## Tickets

### [ACC-1] — AA Accountant, ISBAT work a collections worklist of overdue invoices

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

### SUBTASK (Frontend) — FE-ACC-1

**Title:** FE: Collections worklist with contact log + promise-to-pay
**Parent:** ACC-1
**Contract:** `contracts/accounting/collections.contract.md`

**Scope:**

- [ ] Types match `/accounting/collections` response shapes
- [ ] Worklist table with aging filters and action dialogs
- [ ] Handle all error codes from the contract
- [ ] Loading/empty states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-ACC-1-collections

**Title:** BE: GET /accounting/collections + follow-up actions
**Parent:** ACC-1
**Contract:** `contracts/accounting/collections.contract.md`

**Scope:**

- [ ] `GET /accounting/collections?bucket&customerId&branchId` — overdue invoices with aging, returns `{ data, meta }`
- [ ] `POST /accounting/collections/:invoiceId/contact` and `/promise` actions
- [ ] Error responses: `INVOICE_NOT_FOUND`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `accounting:collections:manage`

**Acceptance Criteria:**

- Aging buckets MUST match the AR aging report buckets exactly

---

### [ACC-2] — AA Accountant, ISBAT paginate and sort the AR invoices table

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

### SUBTASK (Frontend) — FE-ACC-2

**Title:** FE: Server-side pagination + sorting on AR invoices table
**Parent:** ACC-2
**Contract:** `contracts/accounting/ar-invoices-list.contract.md`

**Scope:**

- [ ] URL-synced page/sort state (nuqs)
- [ ] Sortable headers with indicators
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Pagination state MUST survive refresh via URL

---

### SUBTASK (Backend) — BE-ACC-2-ar-pagination

**Title:** BE: GET /ar-invoices — add page/pageSize/sort params
**Parent:** ACC-2
**Contract:** `contracts/accounting/ar-invoices-list.contract.md`

**Scope:**

- [ ] `GET /ar-invoices?page&pageSize&sortBy&sortDir&status&search` — returns `{ data, meta: { total, page, pageSize } }`
- [ ] Validation: pageSize ≤ 100, sortBy whitelist
- [ ] Error responses: `VALIDATION_ERROR`
- [ ] Auth: bearer token + `accounting:ar:read`

**Acceptance Criteria:**

- `meta.total` MUST reflect the filtered count

---

### [ACC-3] — AA Accounting Personnel, ISBAT record one deposit itemised across the banks that took the day's money

**Status:** TO DO
**Priority:** high
**ClickUp:** pending — not yet pushed

---

**Scenario:**
The client annotated their own closing sheet with what happens next: TOTAL BRANCH COLLECTION 87,365.00 goes to Undeposited Funds, and accounting clears it with **one entry**, itemised per bank, once each slip is verified — "So, after this Undeposited Funds must be Zero." Their note is explicit about the screen too: "Upon clicking the RECORD DEPOSITS, the field for the amount should be blank. In order the Acctg Personnel itemized the specific banks and its amount."

Today a deposit holds one bank account and an amount the system works out itself from the sessions being banked, so the client's single record cannot be made: it takes one deposit plus four separate clearing settlements, the amount field is pre-filled, and the bond check never gets banked at all.

**Given:**

- A branch's sessions are closed and counted, and the day's collections are sitting in Cash on Hand — Branch Collections and in the card / e-wallet clearing accounts
- Accounting holds the deposit slips: cash to Security Bank, the check to BDO Quezon, Maya QR and the Maya terminal to Metrobank, GCash Soundpay to UnionBank, ECPay to BPI Araneta

**When:**

- Accounting opens Record deposit for that branch's closing and enters one line per bank

**Then:**
The system should:

- Open with the amount **blank**, and let accounting add a line per bank with its own amount
- Post one balanced journal entry: a debit per bank line, against Cash on Hand — Branch Collections and each clearing account the lines say they clear
- Leave every one of those holding accounts at zero for the day once the deposit is cleared
- Refuse to clear while the lines do not add up to what is outstanding, and say by how much

### Fields

- **Bank Account:** per line; the existing searchable picker
- **Amount:** per line; **blank on open** — never pre-filled from the sessions
- **Clears:** per line — which holding account this line empties (branch collection, card clearing, e-wallet clearing)
- **Deposit Date / Reference / Proof of deposit:** unchanged, one per deposit

### Buttons

- **Add line** — appends an empty bank/amount row
- **Save as draft** — unchanged; posts nothing
- **Clear deposit** — accounting only; disabled until a slip is attached and the lines reconcile

---

#### Empty States

- A branch with nothing outstanding cannot open Record deposit, as today.

---

#### Post-Action Behavior

- Undeposited Funds shows the branch at zero for that day, and the deposit appears under Deposited with its lines.

---

#### Figma Reference

- [PLACEHOLDER: add Figma node] — the client's annotated screenshot of the current modal is the starting point.

---

### SUBTASK (Frontend) — FE-ACC-3

**Title:** FE: Record deposit, itemised per bank, amount blank on open
**Parent:** ACC-3
**Contract:** `contracts/accounting/pos-deposits.contract.md`

**Scope:**

- [ ] Replace the single bank/amount pair with a line editor (bank, amount, what it clears)
- [ ] Amount starts blank; nothing is pre-filled from the sessions
- [ ] Show the outstanding figure and what the lines currently add up to, with the difference
- [ ] Block Clear until the lines reconcile and a slip is attached

**Acceptance Criteria:**

- The amount field MUST be empty on open — this is the client's explicit request
- The running difference MUST update as lines are typed

---

### SUBTASK (Backend) — BE-ACC-3-deposit-lines

**Title:** BE: POST /pos-deposits — deposit lines, and one entry that clears every holding account
**Parent:** ACC-3
**Contract:** `contracts/accounting/pos-deposits.contract.md`

**Scope:**

- [ ] Migration: `PosDepositLine` (deposit, bank account, amount, cleared account), `PosDeposit.amount` becomes the lines' sum
- [ ] `create` accepts lines instead of one `bankAccountId`; reject a total that does not match what the sessions and clearing accounts hold
- [ ] `postClearedDeposit` posts one entry: a debit per line's bank GL, credits per cleared account
- [ ] Keep `ClearingSettlement` for a processor that settles outside a branch deposit
- [ ] Auth: unchanged (`accounting:cash-in-transit:manage` to draft, `:verify` to clear)

**Acceptance Criteria:**

- Gap tests G8, G9, G11 and G12 MUST pass with their `.failing` removed
- A deposit whose lines do not reconcile MUST be refused with the difference in the message
- Depends on POS-4: until a New Receipt reaches branch collection, the client's 56,000.00 line has nothing to clear

---
list: '06 - Point of Sale (POS)'
list_id: '901615166757'
last_synced: '2026-06-10'
---

# Point of Sale Tickets

## Summary

| ID    | Title                                                                                | Status | Priority |
| ----- | ------------------------------------------------------------------------------------ | ------ | -------- |
| POS-1 | AA Cashier, ISBAT complete a sale using only the keyboard and barcode scanner        | TO DO  | high     |
| POS-2 | AA Manager, ISBAT paginate, sort, and filter the POS transactions table              | TO DO  | normal   |
| POS-3 | AA Developer, ISBAT remove the unreachable legacy PosVoidRequest model and dead code | TO DO  | low      |

---

## Tickets

### [POS-1] — AA Cashier, ISBAT complete a sale using only the keyboard and barcode scanner

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

### SUBTASK (Frontend) — FE-POS-1

**Title:** FE: Keyboard shortcut layer + focus management on checkout
**Parent:** POS-1
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

### SUBTASK (Backend) — BE-POS-1-none

**Title:** BE: N/A — frontend-only ticket
**Parent:** POS-1
**Contract:** `contracts/pos/keyboard-checkout.contract.md`

**Scope:**

- [ ] No backend work; existing transaction endpoints unchanged

**Acceptance Criteria:**

- N/A

---

### [POS-2] — AA Manager, ISBAT paginate, sort, and filter the POS transactions table

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

### SUBTASK (Frontend) — FE-POS-2

**Title:** FE: Server-side pagination + sorting on transactions table
**Parent:** POS-2
**Contract:** `contracts/pos/transactions-list.contract.md`

**Scope:**

- [ ] URL-synced page/sort state (nuqs)
- [ ] Sortable headers with indicators
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Pagination state MUST survive refresh via URL

---

### SUBTASK (Backend) — BE-POS-2-txn-pagination

**Title:** BE: GET /pos/transactions — add page/pageSize/sort params
**Parent:** POS-2
**Contract:** `contracts/pos/transactions-list.contract.md`

**Scope:**

- [ ] `GET /pos/transactions?page&pageSize&sortBy&sortDir&type&status&from&to` — returns `{ data, meta: { total, page, pageSize } }`
- [ ] Validation: pageSize ≤ 100, sortBy whitelist
- [ ] Error responses: `VALIDATION_ERROR`
- [ ] Auth: bearer token + `pos:transactions:read`

**Acceptance Criteria:**

- `meta.total` MUST reflect the filtered count

---

### [POS-3] — AA Developer, ISBAT remove the unreachable legacy PosVoidRequest model and dead code

**Status:** TO DO
**Priority:** low
**ClickUp:** [pending — not yet pushed]

---

**Scenario:**
The Void Requests page was migrated to read/write against the unified `ReturnRefundRequest` model (`type: 'void'`) instead of the legacy `PosVoidRequest` table, as part of the Returns & Refunds Unification effort. That migration deliberately left the old model and its now-unreachable service methods in place rather than deleting them inline, since table removal is a bigger, separate schema change. Confirmed via direct query that `PosVoidRequest` has zero rows — nothing depends on it going forward. This ticket is the follow-up cleanup: remove the dead code and drop the table cleanly.

**Given:**

- `TransactionsController` no longer routes any endpoint to `TransactionsService.submitVoidRequest()` / `approveVoidRequest()` / `rejectVoidRequest()` — those methods are unreachable from any HTTP route
- The `PosVoidRequest` Prisma model currently has 0 rows in every known environment
- No other code outside `transactions.service.ts` and its own regression test references `PosVoidRequest`

**When:**

- A developer picks up this cleanup ticket

**Then:**
The system should:

- Have the `PosVoidRequest` model fully removed from `schema.prisma`, via a proper Prisma migration (not a manual DB edit)
- Have `TransactionsService.submitVoidRequest()`, `approveVoidRequest()`, and `rejectVoidRequest()` deleted from `transactions.service.ts`
- Have the corresponding regression tests removed from `transactions.service.spec.ts`
- Have any now-unused DTOs/types tied only to the old void-request flow (e.g. `RequestVoidDto`, `ReviewVoidRequestDto`, `PosVoidRequestStatus`/`PosVoidRequestType` enums if not referenced elsewhere) cleaned up
- Continue to pass the full test suite with no reference to `posVoidRequest` remaining anywhere in `src/`

### Verification

- **Row count check:** re-run a `prisma.posVoidRequest.count()` against the target environment immediately before migrating, to confirm it's still 0 and nothing was created in between
- **Reference sweep:** `grep -rn "posVoidRequest\|PosVoidRequest" src/` should return nothing after cleanup

### Buttons

- N/A — backend/schema cleanup ticket, no UI surface

---

#### Empty States

- N/A

---

#### Post-Action Behavior

- Migration applied; `PosVoidRequest` table dropped; dead code removed; full test suite green

---

#### Figma Reference

- N/A — no UI change

---

### SUBTASK (Backend) — BE-POS-3

**Title:** BE: Drop `PosVoidRequest` model + remove dead void-request methods
**Parent:** POS-3
**Contract:** N/A — internal cleanup, no API contract change (routes were already migrated off this model)

**Scope:**

- [ ] Re-verify `PosVoidRequest` row count is 0 in the target environment before migrating
- [ ] Write and apply a Prisma migration dropping the `PosVoidRequest` model/table
- [ ] Remove `TransactionsService.submitVoidRequest()`, `approveVoidRequest()`, `rejectVoidRequest()`
- [ ] Remove the corresponding tests in `transactions.service.spec.ts`
- [ ] Remove now-dead DTOs/enums tied only to the old flow, if unused elsewhere
- [ ] Full grep sweep for `posVoidRequest`/`PosVoidRequest` across `src/` returns nothing

**Acceptance Criteria:**

- No reference to `PosVoidRequest` remains anywhere in `src/` after cleanup
- Migration is a proper Prisma migration file, not a manual schema edit
- Full backend test suite passes after removal

---

### SUBTASK (Frontend) — FE-POS-3

**Title:** FE: N/A — no frontend change
**Parent:** POS-3

**Scope:**

- [ ] N/A — the frontend already reads/writes exclusively through the unified `ReturnRefundRequest` endpoints; this ticket is backend/schema-only

---
list: '06 - Point of Sale (POS)'
list_id: '901615166757'
last_synced: '2026-06-10'
---

# Point of Sale Tickets

## Summary

| ID    | Title                                                                                                         | Status | Priority |
| ----- | ------------------------------------------------------------------------------------------------------------- | ------ | -------- |
| POS-1 | AA Cashier, ISBAT complete a sale using only the keyboard and barcode scanner                                 | TO DO  | high     |
| POS-2 | AA Manager, ISBAT paginate, sort, and filter the POS transactions table                                       | TO DO  | normal   |
| POS-3 | AA Developer, ISBAT remove the unreachable legacy PosVoidRequest model and dead code                          | TO DO  | low      |
| POS-4 | AA Branch Manager, ISBAT read a Daily Collection Report that totals the day the way my own closing sheet does | TO DO  | high     |
| POS-5 | AA Accountant, ISBAT tell the day apart by payment provider and by product category in the ledger             | TO DO  | normal   |

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

---

### [POS-4] — AA Branch Manager, ISBAT read a Daily Collection Report that totals the day the way my own closing sheet does

**Status:** TO DO
**Priority:** high
**ClickUp:** pending — not yet pushed

---

**Scenario:**
The client's own closing sheet ("Cashier's sample 1Day Transactions") totals one branch's day at TOTAL BRANCH COLLECTION 87,365.00. Replaying that exact day through the system (see `docs/scenario-70-cashier-day-accounting-baseline-plan.md`) produces 107,365.00 on the Daily Collection Report: the 76,000.00 the financing partners owe is counted as money collected, and the 56,000.00 bond check taken on a New Receipt is invisible to the report entirely. Two smaller slips ride along — a collection rebate posts to Sales Returns and Allowances instead of Sales Discounts, a branch New Receipt banks itself at the counter, and a due settled with its rebate reads MI-PARTIAL. This ticket closes all five so the branch's screen and the branch's paper agree.

**Given:**

- A branch has filed its day: counter sales, a delivery charge, an advance instalment, down payments by card and e-wallet, and a performance-bond refund received by check on a New Receipt
- Some of the day's sales are financed by a third party (Tonik / Skyro / Salmon), who has not paid yet
- The session has been closed and its drawer counted

**When:**

- The branch manager opens Daily Collection for that branch and day

**Then:**
The system should:

- Total the day at the sum of what was actually collected — cash, check, card and e-wallet — and nothing else
- List the New Receipt's check among the day's collections, in the non-cash block, like any other check
- Leave the financing partners' outstanding balance out of the collection total
- Show a due settled by cash plus its rate-card rebate as MI, not MI-PARTIAL
- Post a branch New Receipt to Cash on Hand — Branch Collections, not Cash in Bank
- Post a collection rebate to `4-01-100 Sales Discounts`, not `4-01-090 Sales Returns and Allowances`

### Figures this must produce

- **Cash ledger:** 17,425.00 — COD 15,000.00, DC 500.00, MI 1,925.00
- **Non-cash:** check 56,000.00, card 7,500.00, e-wallet 6,440.00
- **Grand total collected:** 87,365.00 (today: 107,365.00)

### Buttons

- No new controls. The report's existing Print, Export and date stepper are unchanged.

---

#### Empty States

- Unchanged: a branch with no trading still reads "No trading recorded".

---

#### Post-Action Behavior

- The printed form and the Excel export take the same figures from the same builder, so neither can disagree with the screen.

---

#### Figma Reference

- [PLACEHOLDER: add Figma node] — no new layout; the figures change, not the sheet.

---

### SUBTASK (Frontend) — FE-POS-4

**Title:** FE: Daily Collection Report totals the day without the financiers' balance
**Parent:** POS-4
**Contract:** `contracts/pos/daily-collection.contract.md`

**Scope:**

- [ ] No layout work expected — confirm the recap maps a `check` tender from a New Receipt onto the CHECK line
- [ ] Confirm the grand total and the printed form both follow the corrected backend figures
- [ ] Update `frontend/e2e/cashier-day-baseline.spec.ts` from 107,365.00 to 87,365.00 in the same PR

**Acceptance Criteria:**

- The screen, the printed form and the Excel export MUST show the same grand total

---

### SUBTASK (Backend) — BE-POS-4-daily-collection

**Title:** BE: GET /pos/reports/daily-collection — include New Receipts, exclude TPF balances
**Parent:** POS-4
**Contract:** `contracts/pos/daily-collection.contract.md`

**Scope:**

- [ ] Add `AcknowledgementReceipt` as a third source beside POS tenders and collection receipts, matched on `branchId` + business day, keyed by its own tender (a check keys as `check`)
- [ ] Drop the `tpf` tender from `nonCashCollection` / `grandTotalCollection` — pending the client's answer on whether it moves to its own block
- [ ] Count a collection's rebate toward the due before classifying MI vs MI-PARTIAL
- [ ] `acknowledgement-receipts.service.ts`: resolve the debit through `POS_CASH`, not `DEFAULT_CASH`
- [ ] Repoint the `SALES_DISCOUNT` mapping at `4-01-100`, with a backfill script in the shape of `scripts/backfill-misc-collections-account-mapping.ts`
- [ ] Auth: unchanged (`pos:daily-collection:read`)

**Acceptance Criteria:**

- Gap tests G3, G4, G5, G6 and G7 in `backend/test/cashier-day-baseline.e2e-spec.ts` MUST pass with their `.failing` removed
- `REPORT_TOTALS_AS_POSTED` MUST be updated to the sheet's figures in the same commit
- No existing Daily Collection spec may regress

---

### [POS-5] — AA Accountant, ISBAT tell the day apart by payment provider and by product category in the ledger

**Status:** TO DO
**Priority:** normal
**ClickUp:** pending — not yet pushed

---

**Scenario:**
The client's closing sheet settles per provider — CARD-Maya 7,500.00, GCASH 2,000.00, MAYA 1,500.00, ECPAY 2,940.00 — and splits revenue per category — Sales-Appliance, Sales-Furniture, Sales-Airconditioning. The system can do neither on a third-party-financed sale: its down payment carries no payment-method option, so Card-Maya, GCash Soundpay and Maya QR all key as the bare method and cannot be checked against a provider's own report. And every sale credits one `SALES_REVENUE` account, although `Item.revenueAccountId` exists and the item master already carries it.

**Given:**

- A sale is financed by a third party, and the customer pays the down payment at the register by card or QR through a named provider
- Items carry a revenue account of their own (Appliances, Furniture, Airconditioning Units)

**When:**

- The cashier rings the sale up and picks the provider, as they already do on an ordinary tender

**Then:**
The system should:

- Record the provider on the down payment, so the closing session names CARD-Maya, GCASH and MAYA apart
- Credit each line's own revenue account, falling back to the `SALES_REVENUE` mapping when an item has none
- Keep the centavo remainder deterministic when apportioning the net across lines

### Fields

- **Provider (TPF down payment):** the same `PosPaymentMethodOption` picker an ordinary card/QR tender already shows; required when the down-payment method has options configured

---

#### Post-Action Behavior

- The session's tender snapshot keys the down payment as `card::Maya`, `qr::Soundpay` or `qr::Maya`, and the closing screen lists them separately.

---

#### Figma Reference

- [PLACEHOLDER: add Figma node] — reuse the existing tender provider picker.

---

### SUBTASK (Frontend) — FE-POS-5

**Title:** FE: pick the provider for a TPF down payment at checkout
**Parent:** POS-5
**Contract:** `contracts/pos/checkout.contract.md`

**Scope:**

- [ ] Show the provider picker for a TPF down payment, reusing the component an ordinary card/QR tender uses
- [ ] Send `tpfDownPaymentMethodOptionId` with the sale
- [ ] Handle the validation error when a method with options is sent without one

**Acceptance Criteria:**

- The picker MUST offer exactly the options configured for that method, nothing hard-coded

---

### SUBTASK (Backend) — BE-POS-5-tpf-dp-provider

**Title:** BE: POST /pos/transactions — carry the provider on a TPF down payment, and revenue per item account
**Parent:** POS-5
**Contract:** `contracts/pos/checkout.contract.md`

**Scope:**

- [ ] Add `tpfDownPaymentMethodOptionId` to `CreateTransactionDto`, validated against the chosen method's options
- [ ] Set it on the auto-created down-payment `PosPayment` so `buildTenderKey` keys it by provider
- [ ] `buildSaleJELines` and `createAndPostInstallmentPlan`: resolve revenue per line via `posting.resolveAccount(item.revenueAccountId, SALES_REVENUE)`, the way COGS already resolves
- [ ] Expose `TpfProvider.glAccountId` through the settings API so per-partner receivables stop being a database-only setting
- [ ] Auth: unchanged

**Acceptance Criteria:**

- Gap tests G1 and G2 MUST pass with their `.failing` removed
- A cart whose items have no revenue account MUST post exactly as it does today

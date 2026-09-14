# Scenario 50 — Journal Entries That Match the Money and the Stock — Gap Analysis & Implementation Record

**Source**: client comments relayed by the developer on 2026-09-13. Nine lines came out of the meeting; the developer narrowed them to two over the course of the session, and the narrowing is recorded below because the dropped lines will otherwise come back.

The two that survived share one idea, which is what makes this one scenario rather than two:

> **A journal entry should say what actually happened.** If ₱9,000 crossed the counter, the entry is ₱9,000. If an appliance left the warehouse, the entry says the inventory went down.

Today it does neither reliably. A collection with withholding posts an entry totalling more than the money collected, split across an extra row. An installment sale empties a shelf and never touches the Inventory account.

## Related ClickUp Tickets

None found. Create via the `clickup-create-ticket` skill.

## The client's nine lines, and what happened to each

| #   | Line                                                         | Outcome                                                                           |
| --- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 1   | If RR is edited, it will be reflected in the PO and AP       | Already built — see below                                                         |
| 2   | PO — for quantity only                                       | Already built                                                                     |
| 3   | RR — what was received; if edited should reflect on the AP   | Already built                                                                     |
| 4   | Withholding tax — do not record in JE                        | **Done — Parts 3–4.** Part 5 (supplier side) investigated and recommended against |
| 5   | Included downpayment in original entries upon installment    | Dropped (developer, 2026-09-13)                                                   |
| 6   | JE should show that the inventory has been subtracted        | **Done — Parts 1–2**                                                              |
| 7   | Employee appliance loan redundant, can be done thru POS      | Dropped                                                                           |
| 8   | Repurpose employee appliance loan to cash loan, no approvals | Dropped                                                                           |
| 9   | Cash loan in expenses removal                                | Dropped                                                                           |

### On 1–3, and one hole in them

The developer's framing settled these: **the PO is the source of truth**, the RR is the editable document, and AP follows the RR. Read that way they are already implemented, and the reading resolves what looked like the hardest item on the list — `quantityReceived` and `unitCost` being uneditable on a receiving report is **correct by design**, not a missing feature. The PO says how much; a receipt does not get to contradict it.

An AP invoice whose receipt has since been corrected carries an amber notice (`ReceiptChangesNotice.tsx`) offering _restate this invoice_ or _raise a new invoice_.

**The hole, recorded but not scoped**: that restate moves VAT, withholding and total only. It never recomputes `subtotal`, which was snapshotted from quantity × unit cost when the draft was scaffolded. So editing a line's **SRP or discount chain** on an RR raises the notice, and accepting it changes nothing — `receiptChanges()`'s own change list comes back empty, which its comment describes as "the common case". Either the notice should not fire for a price-only edit, or the restate should carry the price through. Not part of this scenario; noted so it is not rediscovered.

### On 5, 7, 8, 9

Dropped by the developer on 2026-09-13 without a reason given, so no reason is invented here. Two are worth keeping on paper because the analysis stands and the client may raise them again:

- **(7/8)** The Employee Appliance Loans screen posts **Dr Employee Appliance Loan / Cr Cash** — as though the company handed the employee money. It handed them an appliance. That flow never removes the unit from inventory, never recognises revenue or output VAT, never defers the financing markup, and takes the item as free text so it reconciles against nothing. Selling an appliance to an employee on terms is a sale and belongs in POS. The blocker if it ever moves: the employee repays through **payroll**, not Collections, and that link is already unreliable — a payroll deduction does not settle the per-due schedule lines or advance `dueDate` (diagnosed 2026-09-08, still unfixed).
- **(9)** Pulling `EMPLOYEE_CASH_LOAN` and `CASH_LOAN_OTHERS` out of Expenses would also pull those balances out of the Special Accounts register, which is the only per-person "who owes us what" view that exists. And `Cash Loan – Others` is by definition not an employee, so it has no home on a screen keyed to an `Employee` record.

## Finding 1 — withholding splits the entry (client line 4)

### Money in

A customer owing ₱9,100 pays ₱9,000 and hands over a 2307 for the ₱100. `buildPaymentJournalLines()` (`ar-invoices.service.ts:1126`) posts:

| Account             | Dr      | Cr    |
| ------------------- | ------- | ----- |
| Cash                | 9,000   |       |
| CWT Receivable      | **100** |       |
| Accounts Receivable |         | 9,100 |

The entry totals ₱9,100 against a ₱9,000 collection, and the tax sits beside the cash as a peer row. That extra row is what the client is pointing at.

Two further facts that shape the fix:

- `amountPaid` and due settlement both run off `totalApplied = amount + wht + rebate`, so withholding currently settles the receivable as though it were cash.
- **Marking the 2307 received posts nothing.** `markCertificateReceived()` sets a status and, beyond a ₱1 tolerance, flags a variance for review. There is no GL event when the certificate actually arrives.

### Money out

The supplier **payment** entry is already clean — Dr AP / Cr Cash, one amount, no tax row. The split is on the **receiving** entry, which credits AP net and credits WHT Payable for the withheld slice (`stock.service.ts`, and `ap-bills.service.ts:1334` for non-receipt bills). No money moves at receiving, so by the rule above it should not be carrying a tax row at all.

## Finding 2 — the entry never showed the stock leaving (client line 6)

Stock is deducted for every sale. The GL was not told, on most paths:

| Sale path            | Stock leaves | Inventory credited in GL                        |
| -------------------- | ------------ | ----------------------------------------------- |
| Cash                 | yes          | yes — **only if** the line resolved a unit cost |
| In-house installment | yes          | **no**                                          |
| Charge               | yes          | **no**                                          |
| TPF installment      | yes          | yes — already correct                           |

So an installment sale recognised revenue in full, emptied the shelf, and left the Inventory account untouched — revenue standing against no cost.

Two details found while fixing it, both of which shrank the job:

- **Charge sales cannot be created.** `validateAndPrepare()` rejects them outright: _"Charge is no longer available — use Installment or Pay Now."_ `createAndPostChargeInvoice()` is dead code for new sales.
- **TPF was never broken.** TPF lines post through their own branch inside `create()` and already pass their unit costs through.

The second half is separate and unfixed: a line whose cost never resolved — a FIFO/LIFO item with no cost layers, or a missing GL mapping — **posts the sale and skips the inventory side silently**. The only surfacing is `GET /pos/transactions/reports/missing-cogs`, reachable through one opt-in dashboard widget (`cogs-gaps`, `CogsGapsWidget.tsx`) that someone has to have added to their own dashboard. Nothing warns the cashier, and nothing marks the entry itself as incomplete.

## Decisions taken

1. **The journal entry mirrors the money that moved.** One amount, equal to what was entered at the till; no row that splits it. (Developer, 2026-09-13, relaying the client: _"if in the POS said it was 9k then JE is 9K nothing else"_.)
2. **After a withheld collection the invoice reads _still owing_ the withheld slice.** (Developer, 2026-09-13: _"owing"_.) This is the decision that makes (1) possible without breaking double entry — the ₱100 has no counterpart at collection time, so it stays outstanding until the certificate that supports it arrives. AR aging will carry it.
3. **The 2307 becomes the GL event.** Dr CWT Receivable / Cr AR, posted when the certificate is marked received — the moment the asset is actually documented.
4. **Rebate is left alone** (recommendation, not yet confirmed). It has the same shape as withholding — a second row that is not cash — but a discount granted is a final reduction of the receivable, not a timing gap waiting on a document.

## What's already done ✅

**Part 1 — the installment plan's entry shows the goods leaving.** `createAndPostInstallmentPlan()` now appends a Dr COGS / Cr Inventory pair built from the term-group's own item, quantity and resolved unit cost. `buildCogsJeLines()` was made public and `tx`-aware, since the plan's entry is built inside the sale's own `$transaction` and resolving item accounts on the base client would read a database that has not seen the sale. The same was done to `createAndPostChargeInvoice()` for consistency, though charge is unreachable.

The pair is self-balancing, so the AR/revenue/VAT/markup side is untouched.

Two tests on the installment path: that the pair lands on the plan's entry and the entry stays balanced, and that the group's item/quantity/unit cost reach the builder on the transaction client. Both confirmed to fail with the change reverted. Full POS suite 440 passed / 14 suites; typecheck clean.

A doc comment on `createAndPostInstallmentPlan()` claimed COGS "also posts in full at sale time (see `PosInventoryService.deductStockForTransactionTx`)". That path moves physical stock and writes cost layers, never a journal entry. The comment was corrected rather than deleted, so the claim is not made again.

**Part 3 — the collection entry mirrors the cash.** `buildPaymentJournalLines()` no longer takes a withholding leg at all: the receivable is relieved by cash and rebate, and a ₱9,000 collection posts a ₱9,000 entry. `totalApplied` in `applySingleInvoicePayment()` drops withholding too, so `amountPaid`, the dues walk and overpayment detection all run off what was actually collected. The withheld amount is still written to the `ARPayment` row — it is what the pending-2307 list chases.

Rebate was left alone, as recommended.

**Part 4 — the 2307 posts and settles.** `markCertificateReceived()` now opens a transaction, posts Dr WHT Receivable / Cr AR, and pushes the settlement down onto the dues. **A certificate can never settle more than was withheld** — if it states more, the excess is flagged, not claimed, because credit cannot be taken for tax the customer never held back; if it states less, only that much settles and the shortfall stays open. Either way a mismatch beyond ₱1 still flags for review.

The dues walk, the `dueDate` repoint and the `InstallmentAccount` close were extracted out of `applySingleInvoicePayment()` into `applyToDuesAndInvoice()` and are now shared by both, so a peso lands on the dues the same way whichever door it came through.

**`ARPayment.withholdingJournalEntryId`** (migration `20260913120000_withholding_posts_on_certificate`) holds the certificate's entry, kept apart from `journalEntryId` — the cash entry can be shared across a whole bulk batch, so reversing one must not drag the other with it. `cancelPayment()` reverses the certificate's entry when one exists and claws back what it settled; the withheld slice on its own is never clawed back, because it never relieved anything.

**Part 2 — the uncosted-sale gap is now visible, and the sale is not blocked.**

Investigating the direction question answered it, and turned up a bigger problem than the one being asked about: **the report meant to surface this gap could not see most of it.**

There are two ways a line gets no COGS posting, and only one was being counted:

- `unitCost` **null** — `computeCogs()` threw, or was never reached because the branch resolved no warehouse. This was caught.
- `unitCost` **zero** — `computeCogs()` succeeded and returned nothing to post. For a weighted-average item — the default, and effectively the whole catalogue — `computeAvgCost()` never throws: with no costed inflow in that warehouse it returns 0. The line is written with `unitCost` 0, **not null**, so it slipped the report's `unitCost: null` filter while `buildCogsJeLines()` skipped it for failing `> 0`. The dashboard widget reported "every completed sale has a COGS posting" on sales that had none.

The second is the common case: only receiving writes a costed `StockLedger` row, so any item whose stock arrived by import, opening balance or an uncosted adjustment has nothing to average, and every sale of it posts revenue against no cost — invisibly.

`getMissingCogsReport()` now catches both, labels which it is, and — the part that makes it actionable — **reports the offending items, worst first**. A posted sale cannot be repaired after the fact; the item can, and one uncosted item is usually behind many sales. The dashboard widget lists items rather than sale numbers for the same reason.

**Blocking the sale at the till was ruled out**, not deferred. The dominant cause is an item with no costed stock, and a cashier cannot resolve that at the register — the only thing blocking achieves is halting trade over a data problem belonging to inventory and accounting. Making it visible to the people who can fix it is the correct shape.

**Frontend**: the Withholding Tax (CWT) screen said nothing about posting. It now says the withheld amount stays open on the invoice until its certificate is recorded, and the record-certificate modal states what the entry will be and what a too-large or too-small certificate does.

Seven tests in a new `ar-invoices-withholding.spec.ts` — the service had none. Three drive the real collection path, four the certificate. The two that matter for Part 3 were confirmed to fail with the old behaviour restored. Backend unit suite 661 passed / 38 suites; both repos typecheck clean.

## What's not done / gaps ❌⚠️

### Part 5 — the supplier side ❌ _recommend dropping, and here is why_

Scoped originally because the client's line was "what money we paid **or** what we received". On investigation it should not be built as written.

**The rule is about money events, and the supplier side already satisfies it.** The AP _payment_ entry is Dr AP / Cr Cash for the amount actually paid — one figure, no tax row, already compliant. The split sits on the _receiving_ entry, which is an accrual: no money moves at receiving, so the money-mirror rule does not govern it. The earlier scoping note reasoned the other way — "receiving isn't a money event, so by the rule it shouldn't carry a tax row" — and that inverts it: a rule about what money entries must show says nothing about what an accrual may contain.

**Building it as scoped would be actively worse.** Crediting AP gross and dropping the WHT Payable row deletes the liability to the BIR with nothing to re-recognise it: there is **no remittance flow anywhere in the system** (the Withholding Summary tab under Goods Receiving is a report, nothing more). The ₱100 would leave the payable via a payment that never covers it and never reappear as a liability. Part 3 was only safe because Part 4 gave the balance somewhere to go; the supplier side has no equivalent, and building one — an "issue 2307 to supplier" or remittance action that does not exist today — is a materially larger piece of work than mirroring Part 3.

**Today's supplier treatment is internally consistent.** Receiving credits AP net and WHT Payable for the withheld slice, `apOutstanding()` subtracts it, and the invoice settles at ₱9,900 because ₱9,900 is genuinely all the supplier is owed. The books balance and the BIR liability is on them.

If the client does want the supplier side changed, the work is the remittance mechanism first — not the receiving entry.

## Open questions

1. **Should an uncosted item fall back to a last-known cost so the entry can post at all?** The item's last purchase price is usually on hand (`ItemSupplier.unitPrice`, or the last PO line). Using it would let the entry show the inventory reduction with a defensible figure instead of nothing — but it is an estimate, and posting an estimate as cost is an accounting-policy call, not an engineering one. Left alone; the gap is reported instead.
2. **Does AR aging need to separate "awaiting 2307" from real arrears?** Every withheld slice now sits in aging until its certificate lands, and to a Collections reader it looks identical to a customer who simply has not paid. Not addressed; raised because it is the first thing they will notice.

## Still to do before this is real

- **The migration has not been applied to any database.** It was hand-written to match the repo's convention and never run, to avoid touching a live dev database mid-session. `ar_payments.withholdingJournalEntryId` does not exist yet outside the schema file.
- **Nothing here has been manually tested.** Unit tests only.

## Accepted tradeoffs

- **A withheld collection leaves a receivable open.** The customer has paid everything they owe in cash terms, and their invoice will still read as owing until a piece of paper arrives. That is the honest position — the deduction is only supportable once the certificate is in hand — but Collections staff will see balances that look unpaid and are not. Whether the aging report needs to separate "awaiting 2307" from genuine arrears is a real question, not addressed here.
- **Charge-path COGS is untestable.** The charge branch is guarded out of every new sale, so its Part 1 change cannot be exercised through `create()`. It was made anyway for consistency, and is marked here so nobody reads its absence from the tests as an oversight.

## Risks

- **Part 3 touches the settlement path every collection runs through.** `applySingleInvoicePayment()` spreads across dues, closes linked `InstallmentAccount`s, and repoints `ARInvoice.dueDate` at the next open due. Changing what counts as applied reaches all of it.
- **Installment dues held by a withholding customer will run short.** Dues used to settle off cash + withholding + rebate; they now settle off cash + rebate, so a withheld collection leaves its due open and the schedule does not advance until the certificate lands. Retail consumers are not withholding agents, so this should only ever reach corporate customers — but it has not been exercised against one.
- **`cancelPayment()` still does not unwind the dues.** It restates `amountPaid` and the invoice status but never reopens `InstallmentScheduleLine.paidAmount`/`settledAt`. Pre-existing, not introduced here, and left alone — but the certificate reversal inherits the same limitation.
- **Part 5 changes what AP reports as outstanding.** Vouchers, the disbursement register, cash forecast and AP aging all read `apOutstanding()`.
- **Neither Part 3 nor Part 5 is retroactive.** Entries already posted keep their split rows, so the ledger will read one way before the change and another after. No backfill is planned — this is a dev environment and rows saved under the old rule are deleted rather than migrated.

## Verification

- Parts 1–4: `npx jest src` — 664 passed, 38 suites. Both repos typecheck clean. Negative checks performed on the four load-bearing tests (two for Part 1, two for Part 3); each fails with its change reverted.
- Part 5: not built — see above for why it should not be.
- No manual testing yet, and the migration is unapplied.

## Implementation Log — 2026-09-14

**For this scenario, I have done:**

- **Part A (items 1 + 2 of the gap list) — verified end to end.** New `backend/test/scenario-50-inventory-in-je.e2e-spec.ts` drives a real in-house installment sale through `POST /pos/transactions` (real credit application, financing term, session, costed stock) and asserts the plan's entry carries Dr COGS / Cr Inventory at the item's true weighted-average cost and still balances; a second test proves the missing-COGS report now sees a **zero-cost** line and names the item behind it. 3/3 passing.
- **Part B (items 3 + 4) — verified end to end.** Three tests added to `backend/test/withholding-reconciliation.e2e-spec.ts`: the collection entry has two lines and totals the cash (no WHT row, invoice left `PARTIAL` with the withheld slice owing); the certificate posts Dr WHT Receivable / Cr AR and flips the invoice to `PAID`; a certificate stating more than was withheld still settles only what was withheld and flags the variance. 13/13 passing. That spec's header — which asserted in prose that `markCertificateReceived()` "never posts any GL entry" — was corrected.
- **Frontend e2e** for the CWT screen's new copy (`frontend/e2e/withholding-tax-posting-copy.spec.ts`), read-only so nothing lands in the dev database.
- **Net-new, agreed mid-run: journal entry lines now say which item they are for.** `Transaction.itemId` added (migration `20260914100000_je_line_item`), COGS/Inventory now post **one pair per item** instead of one summed pair per account, and the revenue credit is itemised on every path (cash, TPF, charge, installment). `allocateExactly()` apportions the revenue credit to the items rather than summing it from them — the credit is `subtotal - discountTotal` (caller-supplied) while each line's net is computed server-side and, in VAT-inclusive pricing, divided by 1.12 and rounded per line, so summing would have thrown real carts out of balance by a centavo.

**Worth flagging:**

- **Two migrations were unapplied when this run started**, and a third (`20260914130000_receiving_report_driver_helper`, untracked, not mine) appeared mid-session and broke AP Invoices the moment the Prisma client was regenerated — `column goods_receipts.driverName does not exist`. All applied now. Worth `npx prisma migrate status` before assuming the DB matches the schema on this branch.
- **`JournalEntriesService.serialize()` hand-picks the fields that reach the frontend.** Adding a relation to the query reaches nobody until it is also named there. This cost real time: the Item column stayed empty while quantity and unit price beside it arrived fine, because those two were already in the list. Any future field added to a JE line needs both edits.
- **Item 5 (supplier side) was investigated and is recommended against** — see its section above. The rule is about money events and the AP payment entry already satisfies it; changing the receiving accrual would delete the BIR liability with no remittance flow to re-recognise it.
- **The cost-fallback question is settled as report-only** (developer, 2026-09-14): an uncosted item's sale posts no inventory reduction and is surfaced by name in the report rather than posting an estimated cost. Blocking the sale at the till was ruled out — a cashier cannot resolve a missing cost layer at the register.
- **Two defects surfaced that belong to Scenario 47, not here** — the Collections list's 12× outstanding, and three now-false tests in `collections-payment-rebate.e2e-spec.ts`. Both logged against Scenario 47.
- **17 of 46 GL mappings point into the relocated `7-` block** — `DEFAULT_CASH`, `AR_RECEIVABLE`, `AP_PAYABLE`, `INVENTORY_ASSET`, `POS_CASH` among them. Every receivable, payable, cash and inventory movement is posting to accounts Scenario 49 set aside as _not the client's_, while their own `1-01-020 Account Receivable` and `1-01-030 Inventory on hand` sit at zero. Not touched — re-pointing decides where the whole system posts and needs the client's own confirmation per mapping. **This is the largest open item found this run.**
- **Smaller, unfixed:** the installment down payment entry is tagged `journalType: 'SalesJournal'` (`transactions.service.ts`) though it is a pure cash collection with no revenue, so it pollutes the Sales Journal and is missing from Cash Receipts. And a sale's two entries — "Installment Plan" and "Installment Down Payment" — render an identical page heading (the source document number), which makes them indistinguishable in the UI.
- **No manual testing was completed this run.** Every claim above rests on e2e and unit tests.

## Completion pass — 2026-09-14

Three things closed out after the main parts.

**The down payment entry is a cash receipt, not a sale.** `journalType` was hardcoded `SalesJournal` on an entry that is Dr cash / Cr AR with no revenue in it — the sale was already recognised in full by the plan's own entry. Now `CashReceiptJournal`, matching what `ArInvoicesService` uses for an ordinary collection. The _combined_ entry (one tender funding a cash leg and a down payment at once) is conditional: `SalesJournal` only when a cash leg is actually present, otherwise two down payments and no cash would still have been filed as a sale. Covered by `SC50-A4`, which tenders a real down payment and asserts both the journal type and that no revenue line is in it.

**A journal entry's heading now says what it is.** One sale raises two entries — "Installment Plan …" and "Installment Down Payment …" — and both carry the same source document number, which the detail page used as its `<h1>`. They were indistinguishable on screen; in testing this sent the reader to the wrong entry five times running. The heading is now the description, with the reference kept beside the date and in the details grid.

### Still open: the 17 displaced GL mappings

Not code. Each one needs the client to say which of _their_ accounts it belongs to, so this is a proposal to take to them rather than a change to make. Candidates below are drawn from their own chart; **none of this has been applied.**

| Mapping                            | Posts today (displaced)                      | Candidate in the client's chart                                          |
| ---------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| `DEFAULT_CASH`                     | 7-1-01-020 Cash in Bank – Bank Master        | `1-01-010` Cash & cash equivalents                                       |
| `POS_CASH`                         | 7-1-01-010 Cash on Hand – Branch Collections | `1-01-015` Undeposited Collections – Branch                              |
| `AR_RECEIVABLE`                    | 7-1-02-010 AR – Installment Principal        | `1-01-020` Account Receivable                                            |
| `AP_PAYABLE`                       | 7-2-01-010 AP – Trade Suppliers              | `2-01-010` Accounts Payable – Supplier                                   |
| `INVENTORY_ASSET`                  | 7-1-04-010 Inventory – Appliances            | `1-01-030` Inventory on hand                                             |
| `EXPENSE_SUPPLIER_INVENTORY`       | 7-1-04-000 Inventory                         | `1-01-030` Inventory on hand                                             |
| `CUSTOMER_ADVANCES`                | 7-2-02-010 Customer Deposits / Advances      | `2-01-060` Unearned Rental Deposit _(weak — likely needs a new account)_ |
| `SPECIAL_ACCOUNT_EMP_CASH_ADVANCE` | 7-1-03-021 Employee Cash Advance             | `1-01-052` Advances to Officer's and Employees                           |
| `SPECIAL_ACCOUNT_EMP_CASH_LOAN`    | 7-1-03-022 Employee Cash Loan                | `1-02-040` AR – Employees / Officers                                     |
| `EMPLOYEE_APPLIANCE_LOAN`          | 7-1-03-040 Employee Appliance Loan           | `1-02-040` AR – Employees / Officers                                     |
| `POS_BANK_TRANSFER`                | 7-1-01-048 Online Bank Transfer Clearing     | `1-01-110` Credit Card / E-Wallet Receivable Clearing _(weak)_           |
| `UNIDENTIFIED_BANK_CREDITS`        | 7-2-02-020 Unidentified Bank Credits         | none found — **ask**                                                     |
| `UNAPPLIED_CUSTOMER_COLLECTIONS`   | 7-2-02-030 Unapplied Customer Collections    | none found — **ask**                                                     |
| `POS_GIFT_CARD`                    | 7-2-01-050 Gift Card Liability               | none found — **ask**                                                     |
| `POS_LOYALTY_POINTS`               | 7-2-01-070 Loyalty Points Liability          | none found — **ask**                                                     |
| `POS_STORE_CREDIT`                 | 7-2-01-060 Store Credit Liability            | none found — **ask**                                                     |
| `REPAIR_PROVIDER_PAYABLE`          | 7-2-01-030 Repair Provider Payable           | none found — **ask**                                                     |

Six of the seventeen have no counterpart in what the client supplied, which is consistent with Scenario 49's finding that only their balance sheet was ever provided. Those need either a new account in their chart or an explicit instruction to keep ours.

**Why this matters more than it looks:** the first six lines above are cash, receivables, payables and inventory. Every sale, collection, payment and stock movement in the system posts through them, so their trial balance is currently built on accounts their own chart says are not theirs — and the client's `1-01-020` and `1-01-030` read zero.

## Manual test steps — 2026-09-14

Log in at `http://localhost:3000` with **dev bypass**: the email below, and the `DEV_API_KEY` value from `backend/.env` as the password. Backend is on `:3001`.

Ordered cheapest-first — steps 1 and 2 need no new data.

### 1. Collections no longer multiplies the balance by the number of dues

1. Log in as `technova.owner@test.com`.
2. Go to **POS → Collections**.
3. Find a customer on a multi-due installment plan (e.g. Chloe Belle Estilo, a 12-month plan).
4. Confirm the outstanding figure equals **the sum of their unpaid dues** — for that plan, **₱19,620.00**. Before this it read ₱235,440.00, the whole contract counted once per due.
5. Click into the customer and confirm the per-payment rows still show ₱1,635.00 each — the detail view was always right; only the list was wrong.

### 2. A journal entry's heading says what it is

1. Go to **Accounting → Journal Entries**.
2. Open any installment sale's entries. A single sale raises **two**.
3. Confirm the page heading now reads **"Installment Plan POS-…"** on one and **"Installment Down Payment POS-…"** on the other — not the same document number on both.
4. Confirm the document number still appears beside the date and under **Source document**.

### 3. A new sale posts inventory, and every item-bearing line says what it is for

1. Make sure an approved, unconsumed credit application exists for a customer + item (**CRM → Credit Applications**).
2. **POS → Checkout**: select that customer, add the item, set the line to **Installment**, pick a term, enter a down payment, complete the sale. Note the transaction number.
3. **Accounting → Journal Entries** → open **"Installment Plan &lt;transaction number&gt;"**.
4. Confirm **six** lines, not four — Accounts Receivable, Sales, Output VAT, Unearned Interest, **COGS**, **Inventory**. The last two are the point: before this, the stock left the branch and the ledger never moved.
5. Confirm **Item / Qty / Unit Price** are filled on the **Sales, COGS and Inventory** lines, and blank on AR, VAT and Unearned Interest — those are not for an item.
6. Confirm **Balanced: Yes** and that total debit equals total credit.
7. **Two-item check**: repeat with a cart of two different items on the same term. Confirm Sales, COGS and Inventory each post **one line per item**, each naming its own item and quantity — not one summed line.

### 4. The down payment is a cash receipt, not a sale

1. Tender the down payment for the sale from step 3 at the register.
2. Open **"Installment Down Payment &lt;transaction number&gt;"**.
3. Confirm **Type** reads **CashReceiptJournal**, not SalesJournal.
4. Confirm two lines — cash in, receivable down — with **no revenue line**, and Item/Qty/Unit Price blank on both. There is no quantity of a cash receipt.

### 5. Uncosted items are visible, and named

1. Go to your **Dashboard**, open the customise/edit view, and add the **"COGS Posting Gaps"** widget (it is not on any default layout).
2. If any sales have no cost, confirm the widget lists a heading **"Items with no cost"** with **item names** and a count of affected sales each — not transaction numbers.
3. The all-clear state ("Every completed sale has a COGS posting") is now trustworthy: it previously said that even when zero-cost sales existed.

### 6. Withholding posts on the certificate, not the collection

⚠️ **There is no withholding field on the Collections screen** — `withholdingAmount` is in the form state, hardcoded to `'0'`, with no input rendered. On the AR side withholding can only be recorded through the API today. That is a pre-existing gap, and it means step 6a needs Swagger.

**6a — the collection posts only the cash**

1. Log in as `technova.b1.accounting@test.com`, open DevTools → Network, and copy the `Authorization: Bearer …` header from any request.
2. Open Swagger at `http://localhost:3001/api`, click **Authorize**, paste the token.
3. Find an open AR invoice id (**Accounting → AR Invoices**), then `POST /ar-invoices/{id}/payments` with, for a ₱1,000 invoice:
   `{ "amount": 980, "withholdingAmount": 20, "withholdingCertificateStatus": "pending", "paymentDate": "2026-09-14T00:00:00.000Z", "reference": "CR-TEST-1" }`
4. Open that invoice: confirm **amount paid ₱980, status PARTIAL** — the ₱20 is deliberately still owed.
5. Open its journal entry: confirm **two lines only** (cash ₱980 debit, AR ₱980 credit) and **no Withholding Tax Receivable line**.

**6b — the 2307 posts it and closes the balance**

6. Go to **Accounting → Withholding Tax (CWT)**. Confirm the header says a withheld amount _"stays open on the customer's invoice until its certificate is recorded here — that is what posts it."_
7. Find the payment in **Pending** and click to record the certificate. Confirm the modal states it will **debit Withholding Tax Receivable and credit Accounts Receivable**, and what a too-large or too-small certificate does.
8. Enter certificate amount **20**, submit. Reopen the invoice: **₱1,000 paid, PAID**.
9. In the General Ledger find the new entry referencing your certificate number: **Dr Withholding Tax Receivable ₱20 / Cr Accounts Receivable ₱20**.
10. On a fresh invoice, repeat with certificate amount **500** against ₱20 withheld. Confirm it settles only **₱20** and the payment shows a **flagged variance** — we cannot claim credit for tax the customer never held back.

### Known and expected during this run

- **Old entries stay as they were.** Anything posted before this work has no COGS/Inventory pair and no item. Nothing is backfilled; only new postings carry it.
- **The AR line still reads `7-1-02-010`** — a displaced account. That is the 17-mapping issue, deliberately untouched.

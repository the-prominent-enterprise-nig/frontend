# Scenario 23 — POS Transaction ↔ Invoice Lookup Consistency — Gap Analysis & Closing Plan

Source: developer-defined, 2026-08-08 — not sourced from either client PDF (unlike Scenarios 01-21). Requested directly as a **counter-check scenario**, same class as Scenario 22: operationalizing a POS team meeting comment from last week into a concrete gap analysis. The comment: _"Transaction ID (under each customer) can host different invoices (different payment methods). When looking it up internally, the Invoice number is needed not the transaction number."_

Folded in 2026-08-08 from a separate batch of Collections meeting comments, since they turned out to describe the same screen this scenario already covers: _"[Customer ledger] Include the invoice number, product name and brand"_ and _"In the customer ledger – the amount of the rebate should be reflected."_ (A third related comment, confirming the rebate is a fixed 7.5% of the monthly installment, is tracked separately — see Closing Gap 2's note.)

## Related ClickUp Tickets

None found (`clickup_search`, keywords "invoice number transaction" and "POS invoice lookup"). Net-new scope — same as Scenarios 21/22.

## Related docs

- `scenario-01-pos-installment-sale-plan.md` — the original POS installment-sale flow this scenario's invoice generation builds on.
- `scenario-11-collections-ar-aging-plan.md` — the AR-invoices module this scenario's search gap lives in.

## The scenario we're building toward

1. A single POS Transaction can legitimately produce more than one AR Invoice, depending on how the sale is split across payment/financing modes (cash, on-account charge, installment).
2. Wherever staff look something up internally — the AR Invoices screen, the POS Transactions screen, a customer's record — the addressable, searchable key is the **Invoice Number**, not the Transaction Number, since Transaction Number doesn't map 1:1 to a document.
3. Every screen that shows a transaction also surfaces the invoice number(s) it produced, and every invoice is traceable back to its originating transaction.
4. Under a customer's record, each installment line shows enough to actually be useful for a Collections/ledger lookup — not just the amount and status, but the **invoice number, the product name and brand being paid off, and the rebate amount** for that line.
5. Invoice separation follows **mode of payment only, and nothing finer** — standard retail installment-financing practice: one shopping trip financed on installment is one contract, one down payment, one monthly amortization, one due date, regardless of how many different items are in the basket. So within one transaction: cash needs no invoice, all charge-mode lines combine into one invoice (already correct — see below), and **all installment-mode lines combine into one installment contract/schedule** — not a separate contract per item.

**Result**: staff never have to guess which of a transaction's several invoices they're looking at, or dig through unrelated screens to translate a transaction number into the invoice number they actually need for a lookup, payment reconciliation, or customer conversation.

## What's already done ✅

1. **The underlying data model already supports one transaction → many invoices**, split by mode — this is not a gap:
   - **Charge (on-account) lines** correctly aggregate into **one** invoice regardless of how many charge lines exist, `CHG-{transactionNumber}`, linked via the legacy unique `PosTransaction.arInvoiceId` FK (`transactions.service.ts`'s `createAndPostChargeInvoice`, `src/pos/transactions.service.ts:2313-2416`). This already matches the "mode of payment only" rule (item 4 above).
   - **Installment lines** — each installment-mode line gets its own `InstallmentSchedule`, and that schedule creates **one invoice per due date** (`INST-{transactionNumber}-{lineTag}-{n}`), linked via `InstallmentScheduleLine.arInvoiceId`, deliberately _not_ through `PosTransaction.arInvoiceId` (that FK is `@unique` and stays reserved for the charge case) — `createAndPostInstallmentPlan`, `src/pos/transactions.service.ts:2439-2544`. A 6-month term produces 6 separate invoices off one transaction — correct in principle, **but currently fragmented per line rather than combined across the whole installment mode** (see gap 5).
   - **Cash/card/e-wallet lines** never generate an invoice at all — settled immediately, nothing receivable, just a `PosPayment` row (`prisma/schema.prisma` `PosPayment` model).
   - So a mixed-mode cart (part cash, part charge, part installment) really can produce a cash payment record + 1 charge invoice + N installment invoices, all under one Transaction ID — exactly the premise in the meeting comment.
2. **Customer360's Installment Plans section already fetches per-line invoice data**, including `invoiceNumber`, `status`, `totalAmount`, `amountPaid`, and `dueDate` — `getInstallmentSchedules()`, `backend/src/pos/pos-customers.service.ts:84-131` (select block at L107-124). The data is available; it's the rendering that's incomplete (see gaps below).
3. **AR Invoice search exists and works correctly for its one supported key** — `invoiceNumber` exact/partial match and free-text `description` contains, `backend/src/accounting/ar-invoices/ar-invoices.service.ts:72-83`.

## What's not done / gaps ❌⚠️

1. **AR Invoice search has no real relation to the originating POS transaction.** `ARInvoice` has no `transactionNumber` column; the transaction number only appears embedded as text inside `description` (e.g. `"POS Charge Sale: TXN-123"`, `"Installment 1/2: TXN-123"`). Searching by transaction number "works" only by accident, via the existing `description`-contains match (`ar-invoices.service.ts:80-83`) — and even then it returns _every_ invoice tied to that transaction (all N installment rows plus the charge row, if both exist) rather than resolving to the specific one being looked up.
2. **The POS Transactions screen only searches/filters by Transaction Number**, not Invoice Number — `filters.transactionNumber` is the only lookup field (`frontend/.../pos/transactions/_components/TransactionsList.tsx:82,213`). Staff starting from an invoice number (e.g. off a receipt, a bank memo, or a customer's question) have no way to search for the transaction that produced it.
3. **Customer360's Installment Plans section — the literal "under each customer" view the meeting comment describes — never renders each line's own `invoiceNumber`, product, brand, or rebate amount**, despite fetching invoice data. The UI groups by `transactionNumber` as the section header and shows only amount/due-date/status per due-date line (`frontend/.../crm/customers/[id]/_components/Customer360.tsx:265-294`, esp. L269 for the transaction-number header and L277-293 for the line row that omits `line.arInvoice.invoiceNumber`). This is the most literal match to the meeting complaint: the screen shows you the transaction number and hides the invoice number you'd actually need. Product/brand/rebate are missing at the _query_ level too, not just rendering — `getInstallmentSchedules()` (`backend/src/pos/pos-customers.service.ts:84-131`) never joins into the schedule's `posTransactionLine → Item → brand` (for product name/brand) or `installmentAccount` (for `ppd`, the rebate amount) at all, even though both are one relation-hop away from data it already fetches.
4. **The POS transaction detail payload has zero visibility into invoices at all**, including the charge invoice that already lives on a field it owns. `findOne()` — which backs the transaction detail/receipt/void screen — includes `lines`, `payments`, `session`, `promoCode`, `sellingAgent`, but not `arInvoice` or any installment schedule/invoice relation (`backend/src/pos/transactions.service.ts:1226-1276`). So even a single-mode charge transaction, whose invoice number sits directly on `PosTransaction.arInvoiceId`, never surfaces it on the one screen dedicated to that transaction.
5. **Installment financing never combines lines that share a term — every line gets its own schedule, even duplicates.** `createAndPostInstallmentPlan()` runs once _per installment-mode `PosTransactionLine`_, not once per group of same-term lines (`transactions.service.ts:2418-2429`'s own docblock: _"Creates an installment financing plan for ONE POS SALE LINE... a transaction can now have many installment schedules, one per installment-mode line, each on its own term"_). Enforced at the schema level, not just in application code: `InstallmentSchedule.posTransactionLineId` is `@unique` (`prisma/schema.prisma:2022`), and `InstallmentAccount.installmentScheduleId` is also `@unique` (`prisma/schema.prisma:2158`) — so even `InstallmentAccount`, whose own fields (`listedCashPrice`, `downPayment`, `amountFinanced`, `monthlyInstallment`, `totalPrice` — all singular) read as "one aggregate contract," is wired 1:1 down to a single schedule, which is 1:1 down to a single line. Per-item term selection is confirmed as an intentional feature (Open Question 4, resolved) — different items _can_ legitimately go on different terms in one cart — but items sharing the _same_ term still shouldn't fragment into separate contracts. Buy 2 items on the same 12-month term in one visit today and the customer ends up with 2 separate schedules, 2 separate `InstallmentAccount` rows, and 2 sets of due-date invoices with independent due dates — not the one contract/one monthly payment they'd normally sign for financing two items on the same term together.

## Closing the gaps

Ordered by how directly each addresses the meeting comment.

### 1. Surface invoice(s) on the POS transaction detail screen

**Fix**: extend `findOne()` (`transactions.service.ts:1226`) to include the linked `arInvoice` (charge case) and, where present, the transaction's installment schedules with their per-due-date `arInvoice` rows — mirroring the include shape `getInstallmentSchedules()` already uses. Render the resulting invoice number(s) on the transaction detail/receipt screen.

### 2. Render invoice number, product, brand, and rebate in Customer360's Installment Plans section

**Fix**: two parts, since this gap is both a query gap and a display gap:

- **Query**: extend `getInstallmentSchedules()` (`pos-customers.service.ts:84-131`) to also include each schedule's `posTransactionLine.item` (for `name` + `brand.name`) and `installmentAccount.ppd` (the rebate amount) alongside what it already fetches.
- **Display**: in `Customer360.tsx`'s per-line row (~L277-293), add `line.arInvoice.invoiceNumber`, the product name + brand, and the rebate amount next to the existing amount/status.

Rebate figure itself is settled (developer-confirmed 2026-08-08): a fixed 7.5% of the monthly installment, the same regardless of whether that due is paid in cash or card — already computed correctly as `InstallmentAccount.ppd` (`installment-account.service.ts:254`), just not surfaced here yet.

### 3. Add invoice-number search to the POS Transactions screen

**Fix**: extend `TransactionsList.tsx`'s filter state and the backing list query to accept an invoice number and resolve it back to the owning transaction (via `PosTransaction.arInvoiceId` for charge, via `InstallmentSchedule → InstallmentScheduleLine.arInvoiceId` for installment).

### 4. Give AR Invoice search a real transaction-number lookup path

**Fix**: replace the incidental `description`-contains match with a structured lookup — either add an indexed `transactionNumber`-equivalent to `ARInvoice`/a join, or have `ar-invoices.service.ts`'s search accept a transaction number and resolve it through `PosTransaction`/`InstallmentScheduleLine` the same way item 3 does, returning the full set of that transaction's invoices explicitly (not as an accidental text match).

### 5. Combine same-term installment lines into one schedule, grouped by term

**Fix** (resolved per Open Question 4 — per-line term selection stays, it's a real feature): restructure installment-plan creation so it groups a transaction's installment-mode lines **by financing term** and creates **one `InstallmentSchedule`/`InstallmentAccount` per distinct term used** (one down payment, one amount financed, one monthly installment, one set of due-date invoices per group) — instead of today's one-schedule-per-line regardless of whether terms match. A cart with 2 items on 12 months + 1 item on 6 months should end up with exactly 2 schedules (one per term), not 3. This means moving the schedule-creation call in `transactions.service.ts` from "per line" to "per group of lines sharing a term," and relaxing the `@unique` constraints on `InstallmentSchedule.posTransactionLineId` and `InstallmentAccount.installmentScheduleId` (schema change) since a schedule now needs to relate to potentially several lines. Highest-value item to land first since it changes what data every other item in this doc needs to display.

## Open questions requiring developer/business confirmation

1. **Should AR Invoice search accept a transaction number as an alternate lookup key** (resolving to possibly multiple invoices, shown as a set), or should the tooling instead always push staff toward Invoice Number for a specific document and treat Transaction Number purely as a grouping/reference label, never a primary search key? This determines whether gap 4's fix is "add a second real search key" or "remove the accidental one and lean harder into invoice-number-only search."
2. **Does the POS transaction detail screen need live payment/collection status per installment invoice**, or just the invoice numbers themselves as reference/links out to the AR ledger? Affects how much of `getInstallmentSchedules()`'s existing shape to reuse in gap 1 versus building a lighter read.
3. **Any UI conventions to follow for showing "N invoices" under one transaction** (e.g. a badge/count, individual rows, a modal) — worth confirming before implementation so Customer360, the transaction detail screen, and the POS Transactions screen present this consistently rather than three different ways.
4. ~~Does the POS checkout still need per-line financing-term selection?~~ **RESOLVED 2026-08-08 (developer confirmed): yes** — different items in the same cart can legitimately be financed on different terms (e.g. "TV on 12 months, phone on 6 months"); this is an intentional feature, not an accident of the per-line design. Per-line term selection stays as-is. This means gap 5's fix is "group lines by shared term, one schedule per distinct term used," not "always merge the whole transaction into one schedule" — see the updated Closing Gap 5 above.

## Verification — the counter-check test matrix

Concrete pass/fail steps, to run after each closing-gap item above lands. Current (2026-08-08) expected result noted for each, based on already-confirmed code.

### Customer360 — "under each customer"

- Open a customer with a mixed-mode transaction (charge + installment lines) in Customer360's Installment Plans section → each due-date line shows its own distinct invoice number, not just the shared transaction number in the section header. **Currently: FAIL — invoice numbers are fetched but never rendered.**
- Same screen, same line → also shows the product name, brand, and rebate amount (7.5% of that line's monthly installment) for the item being financed. **Currently: FAIL — none of the three are fetched by `getInstallmentSchedules()` or rendered.**

### POS transaction detail

- Open a completed charge-type transaction's detail/receipt screen → the linked AR invoice number is visible. **Currently: FAIL — `findOne()` doesn't include `arInvoice` at all.**
- Open a completed installment-type transaction's detail screen → all N due-date invoice numbers are visible. **Currently: FAIL — same cause.**

### POS Transactions screen

- Search the POS Transactions screen by a known invoice number → resolves to the owning transaction. **Currently: FAIL — the search field only accepts a transaction number.**

### AR Invoices screen

- Search AR Invoices by a known transaction number → surfaces all of that transaction's invoices (1 for charge-only, N for installment) as a deliberate result set. **Currently: FAIL (in intent, not literally in text-match behavior) — a `description`-contains search on the transaction number happens to return the right rows today only because the transaction number is embedded in free text, not because it's a real lookup key; this breaks if `description` text ever changes format.**
- Search AR Invoices by a specific invoice number (e.g. one due-date's `INST-...-3`) → resolves to exactly that one invoice, not the whole family. **Currently: PASS — this is the one lookup path that already works correctly.**

### Installment consolidation

- Buy 2+ different items on installment, **same term**, in one transaction → results in **one** `InstallmentSchedule`/`InstallmentAccount` for that group, one down payment split across those items, one monthly installment amount, one set of due-date invoices (not independent sets with independent due dates). **Currently: FAIL — creates one schedule and one account per line, even when terms match.**
- Buy items on installment across **2 different terms** (e.g. 2 items on 12 months + 1 item on 6 months) in one transaction → results in exactly **2** schedules (one per distinct term), not 3. **Currently: coincidentally matches today's per-line behavior when every line's term differs, but only by accident — re-verify once gap 5 lands that same-term lines still correctly group while different-term lines still correctly stay separate.**
- Buy 1 item cash + 1 item on installment in the same transaction → one `PosPayment` row for the cash portion, one installment schedule for the financed portion — matching gap 5's fix, not a 3rd unrelated split. **Currently: FAIL for the installment side, same root cause.**

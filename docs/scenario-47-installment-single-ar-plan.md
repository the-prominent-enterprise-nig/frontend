# Scenario 47 — Installment AR: One Receivable Per Sale, Not One Per Due Date — Gap Analysis & Closing Plan

Source: developer-raised 2026-09-07 while reviewing the AR Invoices register — a 6-month installment sale currently produces six `ARInvoice` rows, which does not match the flow described in `module-scenarios.md`. Scoped live this session against current code; every claim below re-verified at the cited file/line. Planning only — nothing implemented yet.

## Related ClickUp Tickets

No ticket covers this directly — it is developer-raised, not a client request. Two adjacent Sprint 4 tickets stay with their own scenarios and are **not** in this doc's scope: [86d3fwwn9](https://app.clickup.com/t/86d3fwwn9) (issue a Collection Receipt on collection — Scenario 44) and [86d3fwwnb](https://app.clickup.com/t/86d3fwwnb) (Daily Collections Summary / remittance — Scenario 11). This doc changes what the _receivable_ looks like; both of those concern the _receipt_ side, which is already modelled correctly.

## The scenario we're building toward

The client's own description, twice over:

- **Scenario 1, step 8** (`module-scenarios.md:16`) — a charge sale "opens the customer's **AR ledger** and **installment schedule**". One ledger, one schedule.
- **Scenario 11, steps 1-3** (`module-scenarios.md:174-175`) — the collector bills from "each customer's **MI due this month**", issues an **OR (stub)** on collection, and "the payment posts to the customer's AR ledger and the **outstanding balance draws down**".

So: **one receivable**, a **schedule of dues**, and **receipts that draw the balance down**. A payment is never a new AR. `INST-…-4` is an invoice number no customer was ever handed.

## What's already done ✅ (verified this session, file/line cited)

1. **The GL is already correct and needs no change.** `transactions.service.ts:3707` posts one aggregate JE at sale — Dr AR `preview.totalPayable`, Cr Sales (financed portion), Cr Output VAT, Cr Unearned Interest Income for the markup. AR is debited **once** for the full receivable, not six times. The subledger is what drifted, not the ledger.
2. **The dues are already modelled properly.** `InstallmentScheduleLine` (schema) carries `lineNumber`, `dueDate`, `amount` per due, plus the ACC-04 interest-release fields. The schedule exists as a first-class entity — the per-due `ARInvoice` rows are redundant on top of it.
3. **The receipt side is already right.** `CollectionReceipt` is the OR document (own number, own `journalEntryId`), with `ARPayment` rows as its applications underneath. Its schema comment already states the intended rule: _"one payment action, one JE, not one JE per due"_ — matching Scenario 11 step 2 exactly.
4. **Oldest-first collection order is already enforced.** `earlierUnpaidLine` inside `recordPaymentCore` (`ar-invoices.service.ts:1498`) already rejects paying a later due before an earlier one. The rule survives this refactor; only the thing it iterates over changes.
5. **The financing term is already exposed on the AR register.** `ar-invoices.service.ts` `findAll()` now returns `termMonths` per row, surfaced as the AR list's "Terms" column (2026-09-07, this session).

## What's not done / gaps ❌⚠️

1. **Six invoices per six-month sale.** `transactions.service.ts:3663-3690` loops `preview.lines` calling `aRInvoice.create` once per due date — `INST-<txn>-<tag>-1..6`, each carrying only its own slice, all sharing the sale date as `invoiceDate`. `transactions.service.spec.ts:2435` locks the behaviour in (`toHaveBeenCalledTimes(12)` for a 12-month plan).
2. **They are `SENT`, not `DRAFT`, and share one JE.** `transactions.service.ts:3776` flips all N to `SENT` and stamps the same `journalEntryId` on every one. Consequence: the app's own delete path refuses them outright — _"Only DRAFT invoices can be deleted. Void a sent invoice instead."_ (`ar-invoices.service.ts:2133`) — and voiding all six would attempt six reversals of one shared JE.
3. **`InstallmentScheduleLine.arInvoiceId` is required and `@unique`.** That is what makes `ARInvoice.installmentScheduleLine` a 1-1 (`InstallmentScheduleLine?`). It structurally blocks many lines pointing at one invoice, and removing it regenerates the relation as `installmentScheduleLines[]` — a **compile-breaking change**, not a quiet migration.
4. **No per-due settlement state exists anywhere off the invoice.** Today "is due 3 paid?" is answered by that due's own `ARInvoice.status`. Collapse to one invoice and the question becomes unanswerable until the schedule line carries its own state.
5. **`collections-calendar.service.ts:143` filters dues by `arInvoice.status`.** With one shared invoice, status stops varying per due, so the collector's calendar returns wrong rows the moment the collapse lands. This is why the schema change and the consumer changes cannot be split into independently-working slices.
6. **The payment overflow machinery exists _because_ dues are separate invoices.** `applyPaymentWithOverflow` cascades a due's excess onto the _next due's invoice_; `recordBulkPayment` (`ar-invoices.service.ts:1599`) layers "Pay Selected" on top of that cascade. All of it has to become allocation across schedule lines. This is the bulk of the work, and it is in the money path.
7. **`ARPayment` has `onDelete: Cascade` on `arInvoiceId`.** Deleting an invoice silently destroys its payment records — a live hazard for the backfill, not a design flaw to fix here.
8. **AR Aging buckets by invoice `dueDate`.** With one invoice spanning six dues, aging must bucket by unpaid **line** dueDate instead, or every account ages by its first due forever.

## Decisions (developer, 2026-09-07)

1. **One AR per sale, not zero.** The receivable must survive the collapse — "just make sure the first AR is 1 only, not separated into 6".
2. **Follow the common/commercial flow** as described in `module-scenarios.md`, over the current implementation.
3. **The shared JE is left standing.** It already debits the full receivable once and is correct; this is a subledger correction only, same posture as the Scenario 46 AP withholding fix. No reversal, no repost.
4. **Backfill is dev database only.** No production or client-imported data in scope.
5. **Implemented on `fix/ap-withholding-not-paid`** — developer's explicit call. Risk raised and accepted: this stacks a compile-breaking AR-payment refactor on top of four uncommitted AP migrations and in-flight AP payment work in the same tree.

## Closing the gaps

- **A. Schema.** Drop `@unique` on `InstallmentScheduleLine.arInvoiceId` (many lines → one invoice, add a plain index). Add `paidAmount Decimal @default(0)` and `settledAt DateTime?` to the line — this is what replaces per-due `ARInvoice.status`. Add `installmentScheduleLineId String?` to `ARPayment` so a receipt still records which due it settled. Hand-written migration, matching the repo's existing convention.
- **B. Checkout.** `transactions.service.ts` creates **one** `ARInvoice` per schedule — `totalAmount = preview.totalPayable` (matching what the JE already debited), `invoiceNumber = INST-<txn>-<tag>`, all schedule lines pointing at it. Update the spec at `:2435`.
- **C. Payment allocation.** `applyPaymentWithOverflow` / `earlierUnpaidLine` move from cascading across invoices to allocating oldest-first across `InstallmentScheduleLine`, writing `paidAmount`/`settledAt` and stamping `ARPayment.installmentScheduleLineId`. `CollectionReceipt` and the one-JE-per-payment-action structure are unchanged.
- **D. Consumers.** `installment-account.service.ts` (37 `arInvoice` refs — the N-invoice aggregations at `:727` and `:788` collapse to a single-invoice sum; `:1033`'s `installmentScheduleLine: null` charge-invoice test becomes `installmentScheduleLines: { none: {} }`), `collections-calendar.service.ts` (8), `pos-customers.service.ts` (7), and AR Aging's bucketing.
- **E. Frontend.** AR Invoices list (one row per sale now — the "Terms" column added this session still applies), customer ledger, Collections "Pay Selected", Customer360's schedule modal.
- **F. Dev-DB backfill, last.** Per schedule: keep one invoice, repoint its lines, sum `amountPaid`, delete the surplus. Guarded so any row carrying an `ARPayment` is excluded rather than assumed unpaid (see gap 7). Shared JE left standing per Decision 3.

## Open questions

1. **Does NIG issue a Sales Invoice for the downpayment?** Today the DP is cash at the till with no AR at all — only `totalAmount - downPayment` is financed into the schedule. Neither `module-scenarios.md` nor any scenario plan says. Not blocking A-F: the DP is not a receivable either way today. Needs the client.
2. **What is the single invoice's `dueDate`?** `ARInvoice.dueDate` is required and drives the `OVERDUE` badge. For one invoice spanning six dues, the honest answer is "the earliest unpaid line's dueDate", which means it becomes derived rather than stored — or the field stops being meaningful for installment invoices and aging reads the lines exclusively (see gap 8). Decide before B.

## Fallout found later — 2026-09-14

Two defects traced to this scenario's model change, both surfaced while working on [Scenario 50](./scenario-50-journal-entries-match-money-and-stock-plan.md). Same root cause in each: code written when **a due owned its own invoice**, never revisited once a plan became **one receivable with many dues**.

**1. POS Collections reported 12× what the customer owed — FIXED.**

`PosCustomersService.listCollectionsCustomers()` walked the schedule lines and, for each, added `arInvoice.totalAmount - arInvoice.amountPaid`. Every due of a plan cites the _same_ invoice, so a 12-month plan added the whole contract twelve times: a customer owing **₱19,620.00** was listed at **₱235,440.00**. The loop even carried the old assumption in a comment — _"each InstallmentScheduleLine is 1:1 with its own ARInvoice sharing that same due date"_.

Two further faults in the same loop, invisible until the first one was fixed:

- `dueAmount` did the same thing. Hidden only because nothing had matured yet; the first matured due would have told a collector to ask for the entire contract instead of one month.
- Nothing was settlement-aware. `outstandingCount` counted settled dues, and `nextDueDate` was the earliest due paid or not, so the row would have kept advertising a date already collected.

Now: the receivable counts **once per invoice**, a matured due asks for **its own** `amount - paidAmount`, settled dues are excluded, and `nextDueDate` is the earliest still-open due. Three regression tests in `pos-customers.service.spec.ts`, one pinned to the real ₱19,620 / ₱235,440 figures.

**2. `collections-payment-rebate.e2e-spec.ts` has 3 failing tests — NOT fixed.**

Commit `93cca3e3` (this scenario) deleted the in-order collection guard — the `"payment N on this schedule is still unpaid"` error no longer exists anywhere in `src`. The spec asserting it was never updated, so three tests still expect a `400` that cannot happen:

- _rejects collecting a later due while an earlier one on the same schedule is unpaid_
- _allows collecting the next due once every earlier one is settled_
- _rolls excess on a single-due payment forward onto the next unpaid due_ (expects 500, gets 600)

Left alone deliberately: deciding whether in-order collection should still be enforced is a product question, not a test-maintenance one. Either the guard comes back or those three tests go.

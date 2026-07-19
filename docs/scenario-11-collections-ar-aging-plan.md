# Scenario 11 — Collections & AR Aging — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "Collections & AR aging — the collector's day."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3aat91](https://app.clickup.com/t/86d3aat91) — "AA Accountant, ISBAT work a collections worklist of overdue invoices" — _Sprint 4, to do_ — closest match to step 1's collector aging view, though worded as a general worklist, not the branch → collector → category grouping this doc's Closing Gap 1 asks for
- [86d3fwwn9](https://app.clickup.com/t/86d3fwwn9) — "AA Cashier, ISBAT issue a Collection Receipt when collecting payment on a credit invoice, so every collection from a customer is formally documented" — _Sprint 4, to do_ — direct match to step 2's "OR (stub)" (Closing Gap 4)
- [86d3fwwnb](https://app.clickup.com/t/86d3fwwnb) — "AA Cashier, ISBAT prepare a Daily Collections Summary and remit it together with collection receipts end of day, so branch collections are consolidated" — _Sprint 4, to do_ — direct match to step 2's remittance step
- [86d3fwwne](https://app.clickup.com/t/86d3fwwne) — "AA Branch Manager, ISBAT review the Daily Collections Report to verify cash accountability and address variances" — _Sprint 4, to do_
- [86d3aeb1w](https://app.clickup.com/t/86d3aeb1w) — "AA Accountant, ISBAT view AR and AP aging reports and generate customer and supplier statements" — _Sprint 4, done_ — the existing single-clock aging report confirmed in this doc's "What's already done"
- [86d39pegm](https://app.clickup.com/t/86d39pegm) — "AA Accountant, ISBAT generate an AR aging report grouped by customer and due date" — _Sprint 4, done_
- [86d39pef1](https://app.clickup.com/t/86d39pef1) — "AA Accountant, ISBAT record a customer payment against one or more invoices" — _Sprint 4, done_
- [86d39pefp](https://app.clickup.com/t/86d39pefp) — "AA Accountant, ISBAT view a customer's open invoice balance and payment history" — _Sprint 4, for qa_

**Not found in Sprint 3-5 — this is the largest ticket gap found across all 14 scenarios:** no ticket for the three-clock aging model, none for A/B/C classification, none for Pink/Green/Red flags, and none for the early-payoff pro-rated quote (Closing Gaps 2, 3, and 5). These are also the scenario's biggest code gaps — worth raising as new tickets before this scenario can move, since right now there's nothing tracking the most distinctive part of the ask.

## The scenario we're building toward

A collector works their accounts and a customer pays an installment:

1. See what to bill — aging view by branch → collector → category: MI due, arrears, penalty.
2. Collect — OR (stub) issued, later remitted to the cashier who enters a collection report.
3. Post to AR — payment posts, balance draws down.
4. Age & score — three clocks (months past due / since invoice / since last payment) into current/30/60/90; A/B/C classification; Pink/Green/Red flags.
5. Early payoff — pro-rated early-closure quote.

## What's already done ✅

**Only generic, non-collections-specific building blocks exist.**

1. **Post to AR — CONFIRMED-WORKING as generic accounting, not as the collector-driven flow described.** `ARInvoicesService.recordPayment` (`backend/src/accounting/ar-invoices/ar-invoices.service.ts:170-235`) increments `amountPaid`, recomputes status (`:19-25`), and posts a journal entry (debit cash, credit AR — `:209-216`) via `JournalPostingService`. Standard double-entry AR payment posting — satisfies "posts to ledger, balance draws down" as a mechanism, but it's a direct accountant-entered payment (`method`/`reference`/`bankAccountId`), not a two-step collector-issues-stub-then-cashier-enters-report workflow.
2. **A conventional single-clock aging report exists.** `reports.service.ts:246-296` (`aging('ar', asOf)`) computes `daysOverdue` from `dueDate` and buckets into `Current / 1-30 / 31-60 / 61-90 / 90+`, rendered by `frontend/.../accounting/reports/_components/ReportsHub.tsx:484-515` (`AgingView`). Flat, invoice-level — no branch grouping, no collector concept, no category grouping.

## What's not done / gaps ❌⚠️

Nearly the entire scenario. This is not a set of small gaps — it's a distinct, unbuilt workflow layered on top of the existing generic AR module.

1. **No collector-oriented aging view.** No branch → collector → category grouping, no separate MI/arrears/penalty fields — confirmed by an exhaustive grep for "collector" across both repos returning zero hits.
2. **No collector/OR/remittance workflow.** No "collector," "collection report," "remit," or "OR stub" concept exists anywhere. The only "Official Receipt" hit in the codebase is an unrelated static label in a POS email template (`receipt-notification.service.ts:104`).
3. **No three-clock aging model — the system has exactly one clock.** Only due-date-based `daysOverdue` is tracked; there's no "months past due," "months since invoice," or "months since last payment" as independent clocks. Confirmed by exhaustive grep for `monthsPastDue`, `monthsSince*` — zero hits.
4. **No A/B/C classification or Pink/Green/Red flags anywhere** — confirmed by grep (the only "pink" hits in the repo are unrelated Tailwind `bg-pink-*` classes in inventory UI).
5. **No early-payoff / pro-rated closure quote.** The only proration logic that exists, `prorateByDownPayment` (`transactions.service.ts:2061-2100`), splits subtotal/VAT between down-payment and financed slices **at the time of an installment sale** — it computes nothing about early termination of an existing AR balance.

## Closing the gaps

This is effectively a new module (Collections) sitting on top of the existing AR Invoices data. Sequenced by dependency, not just risk, since several pieces build on each other.

### 1. Add a `Collector` concept and branch/collector/category grouping to the aging view

**Problem**: no way to say "these accounts belong to this collector" or group aging by anything but a flat invoice list.
**Fix**: add a `collectorId` (nullable FK to `User`) on `Customer` or `ARInvoice` (whichever level assignment happens at — likely `Customer`, since a collector typically owns an account, not a single invoice). Extend `reports.service.ts`'s aging query with an optional `groupBy: branch | collector | category` parameter, and add MI/arrears/penalty as either computed fields (if derivable from `InstallmentScheduleLine`) or new stored fields if penalty needs its own accrual logic (check whether a penalty/late-fee concept exists on `InstallmentScheduleLine` first — if not, that's its own sub-gap).

### 2. Build the three-clock aging model

**Problem**: only one clock (days-since-due-date) exists; the scenario wants three independent ones.
**Fix**: extend the aging computation to also track `monthsSinceInvoice` (from `ARInvoice.invoiceDate`) and `monthsSinceLastPayment` (from the most recent `recordPayment` call, which needs its own timestamp captured per invoice if not already — check `ARInvoice`/`ARPayment` history for this). Keep the existing days-past-due bucket (it's still useful and matches scenario 14's AR aging report) while adding the two new clocks as additional fields on the same aging row, not a replacement.

### 3. A/B/C classification + Pink/Green/Red flags

**Problem**: no classification/flag fields exist.
**Fix**: depends on #2 — define the actual scoring rule (e.g. some combination of the three clocks and/or payment-history consistency) with the business before implementing, since "A/B/C" and "Pink/Green/Red" are almost certainly meant to represent two different things (account quality tier vs. urgency-to-chase) that need their own explicit rules, not an assumed 1:1 mapping.

### 4. OR/remittance/collection-report workflow

**Problem**: no collector-side receipt-then-remit flow exists; `recordPayment` is a direct, single-step accountant action.
**Fix**: add a lightweight `CollectionReceipt` (the "OR stub" — collector-entered: customer, amount, date, collector) in `pending` status, which the cashier later confirms via a "collection report" entry that calls the existing `recordPayment` under the hood once cash is physically remitted. This keeps the actual AR-posting logic (already correct) untouched and just adds the two-step human workflow in front of it.

### 5. Early payoff quote

**Problem**: no pro-rated early-closure calculation exists.
**Fix**: new calculation, likely living alongside `prorateByDownPayment` in `transactions.service.ts` or a new `installment-payoff.service.ts` — given an `InstallmentSchedule`, compute the pro-rated payoff amount (remaining principal, typically minus/plus some portion of unearned/earned financing income depending on the business's payoff policy — confirm the exact formula with the business, since "pro-rated" can mean several different things for interest-bearing installment plans).

## Dead code / unused-feature flags

None — the existing AR Invoices/payment/aging code is all actively used for its own (correct, if generic) purpose and should be extended, not replaced.

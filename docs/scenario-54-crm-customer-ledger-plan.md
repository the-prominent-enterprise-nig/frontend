# Scenario 54 — CRM Customer Ledger (Sales Invoice Ref, Bill rows, per-transaction ledger)

Source: client punch-list for the CRM Customer Ledger, 2026-09-19. Six items, verbatim:

1. Place COMPLETE Sales Invoice #
2. Each transaction should have a ledger
3. The modal should have an option to lead to the customer ledger (both cash and installment)
4. Current issue: financial values do not match
5. REF in the customer ledger should be based on the invoice number from NIG
6. Add "Bill" then payment

Branch: `feat/scenario-54-crm-customer-ledger` in **both** repos, both based on `origin/development`. (Numbered 54, not 53 — `feat/scenario-53-manual-rr-accounting` already claims 53.)

## What "the invoice number from NIG" is

`PosTransaction.salesInvoiceNumber` — free text, typed once per sale by the cashier off the physical invoice booklet, and **required on every non-refund sale** since `TransactionsService.validateAndPrepare` began rejecting a blank one. It is the document the customer and the collector both hold.

What the ledger printed instead, before this pass:

| Row                                                     | Ref it printed                      | What that is                                   |
| ------------------------------------------------------- | ----------------------------------- | ---------------------------------------------- |
| Sale / Required DP / Down payment                       | `POS-1770000000-AB12`               | internal POS transaction number                |
| EC PAY with no OR#                                      | `INST-POS-1770000000-AB12-9f3c1d20` | synthetic per-plan AR invoice number           |
| Cash Sale                                               | `TN-TXN-2026-000004`                | internal POS transaction number                |
| "Sales Invoice No." field on the contract ledger screen | `POS-…`                             | mislabelled — it was never a Sales Invoice No. |

None of those can be looked up by anyone holding the paperwork. Items 1 and 5 are the same fix seen from two angles.

## Closing the gaps

### 1 + 5. Sales Invoice No. as the ledger's Ref

**Fix**: one shared `saleReferenceOf(posTransaction, fallback)` helper, preferring `salesInvoiceNumber`, falling back to `transactionNumber` and then to the account/invoice number. Applied to all four event builders (installment schedule, charge invoice, cash sale, TPF sale), to the transaction picker's options, and to `getLedger()`'s `saleReference` (the field the contract ledger screen labels "Sales Invoice No.").

A collection keeps its own OR/CR number where it has one — that is what the Ref column means on a payment row in the client's own paper ledger — but now falls back to the Sales Invoice No. instead of the synthetic `INST-…` number.

The plan modal's header also shows the complete Sales Invoice No.; `GET /pos/customers/:id/installment-schedules` now exposes it.

**Status**: done.

### 2. Each transaction should have a ledger

**Problem**: `CustomerLedgerView` had its scope hardcoded to `'installments'`. A cash customer's ledger was not merely sparse — it did not exist. The picker beside it only ever listed financed contracts.

**Fix**: scope back to `'all'`, and the plan picker becomes a **transaction picker** listing all four shapes a sale can take — in-house installment (`acct:<installmentAccountId>`), TPF (`tpf:<posTransactionId>`), cash (`cash:<posTransactionId>`), charge (`charge:<arInvoiceId>`) — newest first, each labelled by its Sales Invoice No. and what was bought. Selecting one narrows the rows to that purchase alone while the picker keeps offering all of them.

`?planId=` is renamed `?transactionId=` and still accepted under the old name, so links made before the rename keep working.

**Status**: done.

### 3. A way into the ledger from the modal, cash and installment alike

**Problem**: the POS receipt modal (`TransactionDetail`) had no route to the customer ledger at all. The installment plan modal had one link, but despite reading "View customer ledger →" it went to the contract's own per-account ledger, and it disappeared entirely on a plan with no linked `InstallmentAccount`.

**Fix**: the receipt modal gets a "View customer ledger →" link whenever the sale has a customer, narrowed by `txn:<posTransactionId>` — the only key a receipt can produce, since that screen knows the sale but not which of the four shapes it became downstream. The server resolves it (`resolveLedgerFilterForSale`). The plan modal now offers both: "View customer ledger →" (narrowed to the plan) and "Contract ledger →".

**Status**: done.

### 4. Financial values do not match

Confirmed with the developer, 2026-09-19: **the Installment Plan modal versus the customer ledger it links to.** The modal reported the plan _without_ its down payment while the ledger counted it, so one plan read as two different sets of numbers depending on the screen:

|               | Plan modal (before) | Customer ledger        |
| ------------- | ------------------- | ---------------------- |
| Total price   | 25,680.00           | Total Billed 30,680.00 |
| Payments made | 2,140.00            | Total Paid 7,140.00    |
| Remaining     | 23,540.00           | Outstanding 23,540.00  |

The 5,000.00 gap is the down payment. Remaining already agreed — the down payment cancels on both sides of that subtraction — which is exactly why the discrepancy survived: the bottom line looked right.

**Fix**: the modal now speaks in contract terms, the same basis as the ledger and as the plan's single `ARInvoice` (`contractAmount` = down payment + total payable): Total price (contract), Down payment received, Installment payments made, Total payments received, Remaining balance.

~~**Also fixed, same class of defect**: the ledger credited a collection's cash and its PPD rebate but silently dropped its **creditable withholding tax**, while `ARInvoicesService` counts all three into the invoice's `amountPaid`. On any sale with WHT the ledger's Outstanding sat permanently above what the invoice said was owed. A "Withholding tax" credit row now posts alongside the rebate row.\*\*~~

**Retracted — this premise was wrong.** `ARInvoicesService.recordArPaymentCore()` computes `totalApplied = amount + rebate` explicitly excluding withholding, with its own comment: _"Withholding is deliberately absent: the customer has handed over cash and a promise of a certificate, and only the cash settles anything today."_ The withheld amount only ever relieves the invoice later, as its own separate journal entry, once `markCertificateReceived()` confirms the 2307 certificate — never at collection time. Crediting it in the ledger immediately, as this pass did, made Outstanding read **lower** than the real invoice, the opposite of the bug being chased. Reverted in the reconciliation below; a customer ledger row for a _confirmed_ withholding certificate is a real gap but a separate, unscoped piece of work.

**Status**: done (down payment vs. plan-modal totals only; the withholding-credit portion above is reverted).

### 6. Add "Bill" then payment

**Problem**: a due simply became demandable on its date, visible only as the Due column moving. There was no row for the billing itself, so the ledger had none of the paper card's Bill → payment rhythm.

**Fix**: one `1st Bill` / `2nd Bill` / … memo row per due date, carrying the due's `Inst.` number, placed so the collection that answers it follows directly beneath.

**Design decision (confirmed with the developer, 2026-09-19)**: the Bill row is a **memo** — no debit, no credit. The whole contract is already debited once on the Sale row, because that is when the receivable is booked (`createAndPostInstallmentPlan` opens AR at the full contract). Debiting each bill again would count the sale twice and put Outstanding at double the contract. What the row carries is the Due column: `buildLedgerRows` matures that due on its date, so the Bill row is exactly where the month's amount becomes demandable.

```
Date   Ref           Inst  Description    Debit      Credit    Due       Outstanding
01/05  SI-2026-…123   —    Sale          25,680.00     —        0.00      25,680.00
01/05  SI-2026-…123   —    Required DP    5,000.00     —     5,000.00     30,680.00
01/05  CR-0001        —    Down payment      —      5,000.00    0.00      25,680.00
02/05  SI-2026-…123   1    1st Bill          —          —     2,140.00    25,680.00
02/06  CR-0099        1    EC PAY            —      2,140.00    0.00      23,540.00
03/05  SI-2026-…123   2    2nd Bill          —          —     2,140.00    23,540.00
```

The rejected alternative — Bill carries the debit, Sale becomes an information-only header — reads closer to a hand-kept paper ledger but stops agreeing with the AR invoice, which books the whole contract on day one.

**Status**: superseded — see "Reconciled with `development`" below. This design (a `1st Bill`/`2nd Bill` memo row, unconditionally, for every due regardless of whether it's actually arrived) shipped without the client seeing it, and turned out to be wrong on two counts once compared against the client-validated design `development` had already landed one day later: it would show every future due's Bill row from day one (a 24-month plan reading as 24 Bill rows immediately after the Sale row), and it never accounted for a late-payment penalty at all.

## Verification

- **Unit**: new `src/crm/installment-account/customer-ledger-rows.spec.ts`, 19 cases — Ref preference and every fallback, Bill row ordinals/memo-ness/`Inst.`/Due, Bill-then-payment ordering, withholding and rebate credits, debits totalling the contract exactly once, Outstanding landing on zero when fully settled. Full backend unit suite: **671 passed**.
- **Live API** (`localhost:3001`, dev DB): a cash sale fixture confirmed end-to-end — it appears in the picker as `cash:<id>` reffed `SI-2026-000124`, its rows carry that Sales Invoice No. with the OR# kept on the payment row, and `?transactionId=txn:<posTransactionId>` resolves to the same two rows. A charge invoice confirmed the same way. Fixture removed afterwards.
- **Builds**: `pnpm build` clean in both repos; `tsc --noEmit` and ESLint clean on every changed file.

- **e2e**: run. The isolated test database did not exist on this machine, so it was set up first — see "Setting up the e2e database" below.
  - `customer-ledger-unified.e2e-spec.ts` — **7/7 pass**, including five new cases: the Bill memo row, the picker's contents, narrowing by picker key, narrowing by `txn:<posTransactionId>`, and a key matching nothing coming back empty rather than silently unnarrowed. The cash fixture now carries a `salesInvoiceNumber`, and its Ref assertions check the sale is reffed by it while the tender keeps its own OR number.
  - `installment-account-customer-ledger.e2e-spec.ts` — **23/23 pass on a freshly seeded DB**. One assertion needed updating: the same-day-ordering test enumerated the exact row list, which now also carries the `1st Bill` memo row (after all three, on its own due date, leaving Outstanding where the payment left it). The ordering claim the test is named for is unchanged. (After the aborted full sweep below polluted the DB it drops to 22/23 — see "Pre-existing flake" — which reproduces identically on the pre-change code.)

### Setting up the e2e database

`npm run test:e2e` needs `.env.test` and an isolated database whose name ends in `-test` (enforced by `jest-e2e-db-guard.setup.ts`, added after e2e specs polluted the dev DB on 2026-09-02). Neither existed here. What was done:

1. `CREATE DATABASE "prominent-enterprise-test"` — same host and credentials, isolated name.
2. `.env.test` — a copy of `.env` with `DATABASE_URL` repointed at that database and `NODE_ENV=test`. Already covered by `.gitignore`.
3. `DOTENV_CONFIG_PATH=.env.test npx prisma migrate deploy`, then `npm run db:test:seed`.

Step 3 deliberately uses `migrate deploy`, **not** the `db:test:reset` that `pretest:e2e` runs. The database was brand new and empty, so there was nothing for a reset to drop; `deploy` reaches the same state without a destructive step. `prisma.config.ts` does `import 'dotenv/config'`, which honours `DOTENV_CONFIG_PATH`, so the CLI resolves the test database — this was confirmed with `prisma migrate status` before anything was run against it.

Once set up, target specs directly rather than through `npm run test:e2e` (whose `pretest` hook re-runs the reset every time):

```
DOTENV_CONFIG_PATH=.env.test npx jest --config ./test/jest-e2e.json --runInBand \
  --testPathPatterns customer-ledger-unified
```

### Full-suite sweep — aborted, and what it showed

A full `--runInBand` sweep of all 195 e2e specs was attempted. It **died of `JavaScript heap out of memory` after 36 suites** (exit 134) — one Node process accumulating 36 Nest apps, a harness limit rather than a code failure. Of those 36, 36 failed… but the causes are almost entirely missing seed fixtures: 107 `supplier.findFirstOrThrow`, 44 `item.findFirstOrThrow`, 24 `serialNumber.findFirstOrThrow`. The seed's own "stripping fictional demo data" step clears suppliers, serials and demo items, so a large family of specs has nothing to find.

Nothing in that sweep's output mentions Bill rows, `salesInvoiceNumber`, `transactionId`, `saleReference` or withholding. The two suites closest to this work (`collections-bulk-payment`, `collections-payment-rebate`, which exercise `ARInvoicesService.recordPayment`'s overpayment cascade) were checked properly rather than assumed: **6 failed / 15 passed both with the change stashed and with it applied** — byte-identical results, so pre-existing.

To run the sweep at all, it needs batching or `--workerIdleMemoryLimit`; one process cannot hold all 195.

### Pre-existing flake: `findFirst` with no `orderBy`

`installment-account-customer-ledger.e2e-spec.ts` picks its fixture item with `prisma.item.findFirstOrThrow({ where: { tenantId, isBundle: false } })` — **no `orderBy`**, so Postgres returns whatever row is physically first, which moves as rows are updated. Its hand-entered-payment test then pays ₱100 and claims half a PPD rebate, while `recordPayment` caps rebate at `ppd × whole months covered`. Whether ₱100 covers a whole month depends entirely on the price of whichever item got picked:

- a ₱100–₱300 fixture item → 1 whole month → rebate allowed → passes
- the ₱25,000 `E2E Aircool — Aircon Unit` → ₱9,167/month → 0 whole months → cap 0 → `rebate_exceeds_ppd` → fails

That aircon is itself an orphan: the aborted sweep left **47 `E2E …` fixture items** behind, because the OOM killed the run before any `afterAll` could clean up. One of them now sorts first. Confirmed pre-existing by running the suite on the pre-change code against the same DB — same single failure, same message. Re-seeding the test DB clears it. The durable fix is an `orderBy` (or a fixture item the spec creates itself); not touched here.

### Pre-existing e2e blocker, unrelated to this scenario

`pos-installment-financing.e2e-spec.ts` and `pos-tpf-installment.e2e-spec.ts` cannot run on a freshly seeded database. Both `beforeAll` hooks do:

```ts
prisma.item.findFirstOrThrow({ where: { …, stockBalances: { some: { availableQty: { gt: 20 } } } } })
```

The seed's highest `availableQty` is **10**, so that query matches nothing and every test in both suites fails in setup — 44 failures, all the identical `Invalid prisma.item.findFirstOrThrow()`, not one assertion among them. They pass on the dev DB only because real receiving activity there has since pushed 8 items above 20. Either the seed needs stock above that threshold or the specs need to create their own; not touched here.

## Worth flagging (found, not fixed)

`InstallmentAccount.currentBalance` drifts for POS-originated accounts. `ARInvoicesService.recordPayment()` never decrements it — it only zeroes it when the last due settles and the account closes — so a plan being paid through Collections/AR shows its **opening** balance on any screen reading that field (Scenario 32 mapped it to the contract screen's "Total Amount Due"), while this ledger's Outstanding falls correctly with each payment. That is a payment-posting change rather than a ledger one, so it is deliberately out of this pass; it is a real second source of "values do not match" if the client reports one again.

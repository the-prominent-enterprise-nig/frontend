# Scenario 67 — X-Deal (Barter) Transaction — Gap Analysis & Closing Plan

**Source**: developer request, 2026-10-01. Goal statement:

> X-Deal Transaction — process the barter as an installment/charge sale at the POS register and cleanly clear the balance via a Credit Memo (Journal Entry) in the backend.
>
> `[1. POS Front-End]` Create Regular Installment Sale (Tagged "X-DEAL") → `[2. Inventory/Ledger]` Deduct Stock & Create Accounts Receivable (A/R) → `[3. Back-End Accounting]` Apply Credit Memo to Offset Balance (Account = ₱0.00)

## Related ClickUp Tickets

None found. Net-new scope — create via the `clickup-create-ticket` skill once this doc is confirmed.

## The scenario we're building toward

NIG trades an appliance for goods or services from a counterparty (a barter, "X-Deal") instead of cash.

1. **POS.** The cashier rings up the appliance through the normal checkout as an in-house **Installment** sale and ticks **"X-DEAL"**. Checkout asks for an X-Deal reference (the barter agreement / counterpart document no.). The sale is visibly tagged X-DEAL on the success screen, the transactions list and the transaction detail.
2. **Inventory / ledger.** Nothing new: stock is deducted, the installment plan, A/R invoice and installment account are created, and the sale JE posts (Dr A/R, Cr Sales + Output VAT, Cr Unearned Interest for any markup, Dr COGS / Cr Inventory) exactly as for any installment sale.
3. **Accounting.** Accounting issues an **X-Deal Credit Memo** against that sale for its full outstanding balance. The memo posts the offsetting JE, settles every due on the schedule, and closes the installment account at **₱0.00** — so it drops out of aging, collections, the collector's list, and interest release.

## What's already done ✅

1. **The whole installment sale path** — stock deduction, schedule, `INST-` A/R invoice, installment account, sale JE (`backend/src/pos/transactions.service.ts` `createAndPostInstallmentPlan` ~3998, JE ~4160-4235, `createLinkedInstallmentAccount` ~4271). Step 2 of the goal needs no new code.
2. **Credit memos exist and reduce A/R.** `POST /credit-memos` (`backend/src/accounting/credit-memos/credit-memos.service.ts` ~204-316) applies against one open A/R invoice (SENT / PARTIAL / OVERDUE), capped at its outstanding, posts Dr Sales Revenue (or Sales Returns & Allowances) / Cr A/R, and marks the invoice PAID when fully credited. UI: `accounting/credit-memos` + shared `accounting/_shared/CreditMemoDialog.tsx`; the A/R invoice detail already lists "Credits & adjustments".
3. **A proven precedent for "flagged sale that waives the credit-application and down-payment gates"**: Scenario 60's Employee Appliance Loan — `isEmployeeApplianceLoan` + `hrApplianceLoanApplicationNumber` on `PosTransaction`, DTO `pos.dto.ts` ~698-711, credit-app skip in `transactions.service.ts` ~330-336, DP-floor skips ~497-507 / ~547-556, checkout checkbox + reference input at `pos/checkout/page.tsx` ~3986-4017. X-Deal's POS half should mirror this shape exactly.
4. **Installment accounts can already reach `closed`** — through the AR-payment path when every due has `settledAt` (`ar-invoices.service.ts` ~1386-1412), or `earlyPayoff` / `recordPayment` (`installment-account.service.ts` ~2598, ~2644).

## What's not done / gaps ❌⚠️

1. **No way to tag a sale X-DEAL.** No flag, tag or remarks column on `PosTransaction`, `PosTransactionLine`, `InstallmentAccount` or `ARInvoice`. (`notes` exists on the create DTO but is never persisted.) No grep hit for barter / x-deal / trade-in anywhere in either repo.
2. **"Charge" is retired** for new sales (`transactions.service.ts` ~213-220 rejects it), so X-Deal must ride the Installment path — which today **requires an approved credit application** and a **≥10% down payment** per line. A barter has neither.
3. **A credit memo does not close an installment sale.** ⚠️ This is the main gap. Issuing a memo only bumps `ARInvoice.amountPaid`. It never touches the `InstallmentAccount` (stays `active`, `currentBalance` unchanged), never sets `InstallmentScheduleLine.settledAt`, and never touches the unearned interest. Consequences for a memo'd X-Deal today:
   - still listed in IA aging (`installment-account.service.ts` ~1221), the IA list, the collector's accounts (`collector.service.ts` ~160) and the customer ledger;
   - the interest-release batch (`installment-interest-release.service.ts` ~38, selects every due line with `interestReleasedAt: null`, no status filter) keeps moving its markup from Unearned Interest into Financing Income — income that will never be collected.
4. **The memo's JE is wrong for a barter.**
   - It debits **Sales Revenue** (or Sales Returns), which un-books the sale. A barter is still a sale; the debit should be what NIG _received_ (inventory, supplies, advertising, etc.).
   - It credits A/R for the full outstanding, which _includes_ the financing markup, while the matching Unearned Interest credit from the sale JE is left standing. Unearned Interest needs its own debit.
5. **The credit memo form is item-line based** (`itemId` required per line) with types `sales_return | billing_adjustment | goodwill`. There is no amount-only "offset the balance" memo, and the picker targets an A/R invoice, not an X-Deal sale.

## Decisions taken

Confirmed with the developer, 2026-10-01:

| Question                                 | Decision                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What account does the X-Deal memo debit? | A dedicated **X-Deal Clearing** account (new COA row + mapping `X_DEAL_CLEARING`). Accounting reclassifies to the real asset/expense later with a normal manual JE. Sales Revenue is not touched.                                                                                                                                                                                                                     |
| How is the financing markup handled?     | **The sale stays a normal installment sale**, markup included. The X-Deal memo reverses the unreleased markup by debiting Unearned Interest Income. No zero-markup term.                                                                                                                                                                                                                                              |
| Partial X-Deals?                         | **No — full balance only.** The memo always clears 100% of the outstanding and closes the account at ₱0.00.                                                                                                                                                                                                                                                                                                           |
| Which GL account is X-Deal Clearing?     | **`1-02-060 Due from X-Deal Partners (Barter)`**, an asset under Accounts Receivable, mapped to `X_DEAL_CLEARING`. Sits beside `1-02-050 Due from Financing Partners (TPF)` — same shape: the sale is booked and a partner, not the customer, owes NIG. Confirmed 2026-10-01 after checking the seeded COA (`coa-seed.service.ts`).                                                                                   |
| Who can issue the X-Deal memo?           | **A new permission, `accounting:x-deal-memos:issue`.** Business Owner (explicit grant) and Accountant (via `accounting:*:*`); **not** Branch Manager. A separate resource on purpose — a new action under `credit-memos` would reach Branch Manager through its `accounting:credit-memos:*` wildcard. Mirrors how account-closing actions already get their own permission (`crm:installment-accounts:early_payoff`). |

## Closing the gaps — proposed parts

Each part gets its own tests and manual test steps, and stops for confirmation before the next begins (house convention). Parts 1–2 are the POS half; 3–4 are the accounting half.

### Part 1 — Backend: tag the sale

- `PosTransaction`: `isXDeal Boolean @default(false)` + `xDealReference String?`. Mirror both onto `InstallmentAccount` (so aging / collections / the ledger can show and filter it without joining back to the sale).
- DTO: both fields, with `xDealReference` required when `isXDeal` (mirroring `hrApplianceLoanApplicationNumber`).
- `isXDeal` requires an in-house installment line and a customer; it is rejected on cash-only, TPF or refund submissions.
- Waive the credit-application requirement and the 10% DP floor when `isXDeal` (same branches as Employee Appliance Loan).
- One migration — reported, not applied.

### Part 2 — Frontend: checkout + visibility

- Checkout: an **X-DEAL** checkbox in the customer panel (beside the Employee Appliance Loan one; the two are mutually exclusive), plus a required **X-Deal Reference** field. When checked: force Payment Mode to Installment / in-house, lock DP at ₱0, hide the credit-application selector.
- X-DEAL badge on the success screen, `TransactionsList`, `TransactionDetail`, and the installment ledger header (`InstallmentLedgerView`).

### Part 3 — Backend: X-Deal credit memo

- New `CreditMemoType.x_deal`. Amount-only (no item lines), always for the **full** outstanding of the sale's `INST-` invoice, and only allowed when the linked sale has `isXDeal`.
- JE (atomic with the memo):
  - Dr **`1-02-060 Due from X-Deal Partners (Barter)`** (new COA row, mapping `X_DEAL_CLEARING`) — the sale's principal still outstanding
  - Dr **Unearned Interest Income** — the markup not yet released
  - Cr **A/R** — the full outstanding
- In the same DB transaction: set `settledAt` + `interestReleasedAt` on every unsettled schedule line, set the IA's `currentBalance` to 0 and status to `closed`, and mark the invoice PAID.
- Voiding an X-Deal memo reverses all of the above (reopens the IA and lines).
- Permission: new `accounting:x-deal-memos:issue` (issue and void), seeded for Business Owner and Accountant, plus a backfill script for existing DBs. Existing DBs also need the `1-02-060` row: re-running the COA seed adds it but also resets every other seeded mapping, so the backfill script adds just this one account + mapping instead.

### Part 4 — Frontend: issue the memo

- Credit Memos: an **"X-Deal offset"** action that picks from open X-Deal sales (customer, txn no., reference, outstanding) and shows a preview of the JE before confirming. No item lines.
- Installment ledger / Customer 360 show "Settled — X-Deal credit memo CM-xxxx" instead of a plain "Closed".

### Part 5 — Tests

Tests ship **with** each part (Part 1's tests land in Part 1's PR, etc.); Part 5 is the full list so nothing is only happy-path. Each case has an ID so the PR description and manual script can refer to it.

#### Proposed rules the edge cases pin down

Several edge cases need a rule that hasn't been decided yet. Each test below assumes the default here — confirm or overrule before Part 1 starts.

| #   | Situation                                                                        | Proposed default                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | X-Deal cart with a cash line, or a TPF line                                      | **Reject.** Every line must be in-house installment. A barter is the whole sale.                                                                                  |
| R2  | X-Deal with a down payment > ₱0                                                  | **Reject.** "Full balance only" means nothing is collected in cash.                                                                                               |
| R3  | X-Deal cart whose lines fall on two different financing terms                    | **Reject.** Two terms create two `INST-` invoices and two accounts; one memo targets one invoice. One term per X-Deal sale.                                       |
| R4  | X-Deal + Employee Appliance Loan on the same sale                                | **Reject.** Mutually exclusive.                                                                                                                                   |
| R5  | `creditApplicationId` sent with an X-Deal                                        | **Reject**, so an application is never consumed by a barter.                                                                                                      |
| R6  | `xDealReference` sent without `isXDeal`                                          | **Reject** (no stray data on a normal sale).                                                                                                                      |
| R7  | X-Deal while the POS is offline                                                  | **Block** in the UI. The offline queue already drops sale-level flags (see the price-override gap), so an offline X-Deal would post as a normal installment sale. |
| R8  | Ordinary credit memo types (`billing_adjustment` etc.) against an X-Deal invoice | **Reject.** An X-Deal is only offset through `x_deal`, so the account always closes.                                                                              |
| R9  | Return/refund of an X-Deal sale after the memo                                   | **Reject**: void the memo first. Before the memo, a return behaves like any installment return.                                                                   |
| R10 | Client-supplied memo amount or item lines on `x_deal`                            | **Reject.** The server computes the amount from the invoice.                                                                                                      |

#### Test fixtures

The seed leaves **no financeable item in stock** (max qty 10, and stocked items are on no price list), so these specs must not rely on it. Every spec builds its own fixtures in `beforeAll`, the same way `pos-employee-appliance-loan-checkout.e2e-spec.ts` does:

- its own customer, named with a spec-specific prefix;
- stock topped up directly on a priced, financeable item, plus a free serial in the same warehouse;
- an `X_DEAL_CLEARING` mapping, created if missing;

and deletes them in `afterAll`, fanning out from the customer IDs (invoices, receipts, IAs, memos, JEs first — they FK-restrict the customer).

#### Backend unit — `src/accounting/credit-memos/x-deal-offset.util.spec.ts`

The JE split is a pure function `computeXDealOffset(outstanding, scheduleLines)` → `{ clearing, unearnedInterest }`, tested on its own:

| ID     | Case                                                | Expected                                                            |
| ------ | --------------------------------------------------- | ------------------------------------------------------------------- |
| XD-U01 | No interest released yet                            | `unearnedInterest` = full markup; `clearing` = outstanding − markup |
| XD-U02 | Some lines already released                         | `unearnedInterest` = only the unreleased lines' markup              |
| XD-U03 | Every line already released                         | `unearnedInterest` = 0; `clearing` = outstanding                    |
| XD-U04 | Zero-markup term                                    | `unearnedInterest` = 0                                              |
| XD-U05 | Centavo rounding (e.g. LCP ₱9,999.99, 7-month term) | `clearing + unearnedInterest` = outstanding exactly, to the centavo |
| XD-U06 | A collection already paid part of the balance       | split is computed on the _remaining_ outstanding, never negative    |

#### Backend e2e — the sale — `test/pos-x-deal-checkout.e2e-spec.ts`

| ID      | Case                                                                                     | Expected                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| XD-S01  | Happy path: in-house installment, ₱0 DP, no credit app, reference set                    | 201. Sale + IA carry `isXDeal` and the reference; stock and serial deducted; normal sale JE (A/R, Sales, VAT, Unearned, COGS/Inventory) balances |
| XD-S02  | `isXDeal` with no reference / blank / whitespace-only reference                          | 400, nothing written, stock unchanged                                                                                                            |
| XD-S03  | `isXDeal` with no customer                                                               | 400                                                                                                                                              |
| XD-S04  | `isXDeal` on a cash-only cart                                                            | 400 (R1)                                                                                                                                         |
| XD-S05  | `isXDeal` with a TPF line                                                                | 400 (R1)                                                                                                                                         |
| XD-S06  | `isXDeal` with one installment + one cash line                                           | 400 (R1)                                                                                                                                         |
| XD-S07  | `isXDeal` with DP > 0                                                                    | 400 (R2)                                                                                                                                         |
| XD-S08  | `isXDeal` across two financing terms                                                     | 400 (R3)                                                                                                                                         |
| XD-S08b | Two X-Deal lines on the same term                                                        | Accepted; one installment account                                                                                                                |
| XD-S09  | `isXDeal` + `isEmployeeApplianceLoan`                                                    | 400 (R4)                                                                                                                                         |
| XD-S10  | `isXDeal` + a `creditApplicationId`                                                      | 400 (R5); the application stays unconsumed                                                                                                       |
| XD-S11  | `xDealReference` without `isXDeal`                                                       | 400 (R6)                                                                                                                                         |
| XD-S12  | Regression: a normal installment sale still requires a credit application and the 10% DP | 400 on each, as today                                                                                                                            |
| XD-S13  | Cashier without override: the sale goes to the release-approval queue                    | Held. Once approved, the posted sale and IA **still** carry `isXDeal` and the reference (the flags survive the hold)                             |
| XD-S14  | Rejected release approval                                                                | No sale, no IA, stock released                                                                                                                   |
| XD-S15  | Serial-tracked item                                                                      | Serial is marked sold, linked to the X-Deal line                                                                                                 |
| XD-S16  | Item with stock but no free serial                                                       | 400 as for any sale; nothing written                                                                                                             |
| XD-S17  | A refund submission carrying `isXDeal`                                                   | 400 — the flag only belongs on the original sale                                                                                                 |

#### Backend e2e — the memo — `test/credit-memos-x-deal.e2e-spec.ts`

| ID      | Case                                                                                                                | Expected                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XD-M01  | Happy path on a fresh X-Deal                                                                                        | 3-line JE balances (Dr Clearing, Dr Unearned, Cr A/R = outstanding). Invoice PAID. IA `closed`, `currentBalance` 0.00. Every schedule line has `settledAt` and `interestReleasedAt`           |
| XD-M02  | After interest release ran for some months                                                                          | Unearned debit = unreleased part only; Unearned Interest nets to exactly 0 for this sale                                                                                                      |
| XD-M03  | After a collection was taken on the X-Deal by mistake                                                               | Memo clears only the remaining balance; IA still ends at 0.00                                                                                                                                 |
| XD-M04  | Rounding fixture (odd centavos)                                                                                     | JE balances to the centavo; IA balance exactly 0.00, not 0.01                                                                                                                                 |
| XD-M05  | `x_deal` on a normal (non-X-Deal) installment invoice                                                               | 400                                                                                                                                                                                           |
| XD-M06  | `billing_adjustment` / `goodwill` / `sales_return` on an X-Deal invoice                                             | 400 (R8)                                                                                                                                                                                      |
| XD-M07  | Client sends `amount` or item `lines` with `x_deal`                                                                 | 400 (R10)                                                                                                                                                                                     |
| XD-M08  | Second `x_deal` memo on the same invoice                                                                            | 400; nothing written                                                                                                                                                                          |
| XD-M09  | Two memo requests sent at the same time                                                                             | Exactly one succeeds; one JE, one memo                                                                                                                                                        |
| XD-M10  | Memo on a voided invoice, or on a sale still waiting for release approval                                           | 400 / 404; nothing written                                                                                                                                                                    |
| XD-M11  | `X_DEAL_CLEARING` mapping missing                                                                                   | 400 with a clear message; no memo, no JE, invoice and IA unchanged (atomic)                                                                                                                   |
| XD-M12  | Memo date in a closed fiscal period                                                                                 | Rejected, same as any JE in a closed period                                                                                                                                                   |
| XD-M13  | Branch Manager (holds `accounting:credit-memos:*` but not `accounting:x-deal-memos:issue`), and a user with neither | 403 on issue and on void; an Accountant succeeds                                                                                                                                              |
| XD-M14  | User from another branch                                                                                            | 403/404 per the branch-scoping rules                                                                                                                                                          |
| XD-M15  | Void the memo                                                                                                       | Reversing JE. IA back to `active` with its pre-memo balance. `settledAt` cleared. `interestReleasedAt` cleared **only** on lines this memo set — lines released before the memo stay released |
| XD-M16  | Void twice                                                                                                          | 400                                                                                                                                                                                           |
| XD-M17  | Re-issue after void                                                                                                 | Works; amounts match the first memo                                                                                                                                                           |
| XD-M18  | Return/refund after the memo                                                                                        | 400 (R9) until the memo is voided                                                                                                                                                             |
| XD-M18b | Return of an X-Deal sale before any memo (moved from Part 1 — Part 1 never touches the return path)                 | Works like any installment return                                                                                                                                                             |
| XD-M19  | Audit log                                                                                                           | Issue and void each write an entry                                                                                                                                                            |

#### Backend e2e — the memo'd account disappears — same spec

After XD-M01, the account must be **absent** from every queue that would chase it:

| ID     | Query                                              | Expected                                                           |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------ |
| XD-Q01 | IA aging report                                    | not listed                                                         |
| XD-Q02 | Collector's assigned accounts                      | not listed as active                                               |
| XD-Q03 | A/R aging                                          | not listed                                                         |
| XD-Q04 | Collections calendar                               | no dues                                                            |
| XD-Q05 | Overdue-invoice notification query                 | not selected                                                       |
| XD-Q06 | Interest-release eligible list (`computeEligible`) | no lines for this schedule; running the batch posts nothing for it |
| XD-Q07 | Unearned-interest reconciliation report            | reconciles with no difference for this sale                        |
| XD-Q08 | Customer ledger                                    | shows the sale, the memo and a 0.00 balance                        |

And the inverse after XD-M15 (void): the account is back in the IA aging, A/R aging and interest-release queues — which is what shows the absence checks above aren't passing vacuously.

**As built (Part 3):** Q01, Q03, Q06 and Q08 are asserted against their real endpoints. Q02, Q04 and Q05 select on the account status and invoice status, so they are asserted through those two fields (account `closed`, invoice `PAID`) rather than three more endpoints. Q07 (unearned-interest reconciliation) is covered by XD-M02's assertion that Unearned nets to exactly the unreleased markup. Two cases were added while building: **XD-M12b** (memo dated before the sale → 400) and **XD-M18b** (a void request raised _before_ the memo is accepted as normal, then refused at approval once the memo exists). XD-M18b replaces the full installment-return e2e: the return path's own suites cover returns, and the guard sits on both the refund and void routes.

#### Frontend e2e — checkout — `e2e/pos-checkout-x-deal.spec.ts`

| ID     | Case                                                                  | Expected                                                                                                                                                      |
| ------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XD-F01 | No customer selected                                                  | X-DEAL checkbox not shown                                                                                                                                     |
| XD-F02 | Tick X-DEAL                                                           | Payment Mode → Installment / in-house, DP locked at ₱0, credit-application selector and "Raise one" hidden, reference field shown                             |
| XD-F03 | Confirm with no reference / whitespace                                | Blocked with a message; no request sent                                                                                                                       |
| XD-F04 | Untick                                                                | Credit-application selector and the 10% DP floor come back; no stale ₱0 DP left behind                                                                        |
| XD-F05 | Tick Employee Appliance Loan while X-DEAL is ticked (and the reverse) | Only one can be on                                                                                                                                            |
| XD-F06 | Change the customer                                                   | X-DEAL and the reference reset                                                                                                                                |
| XD-F07 | Try to switch the cart to Cash or Delivery Receipt, or a line to TPF  | Those buttons are disabled while X-Deal is ticked. (A second financing term is caught at Confirm with a message; the backend rejection is covered by XD-S08.) |
| XD-F08 | Park the sale, then resume it                                         | X-DEAL and the reference are restored, and Confirm succeeds (the same class as the park/resume price-override bug)                                            |
| XD-F09 | Offline                                                               | X-DEAL disabled, with a message (R7)                                                                                                                          |
| XD-F10 | Double-click Confirm                                                  | One sale                                                                                                                                                      |
| XD-F11 | After a successful sale                                               | X-DEAL badge on the success screen, transactions list and detail; a normal sale shows no badge                                                                |

#### Frontend e2e — accounting — `e2e/credit-memo-x-deal.spec.ts`

| ID     | Case                                                                | Expected                                                                                      |
| ------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| XD-F12 | Open "X-Deal offset"                                                | Picker lists only open X-Deal sales — not normal installments, not already-offset ones        |
| XD-F13 | Pick one                                                            | JE preview shows the same three amounts the backend posts                                     |
| XD-F14 | Confirm                                                             | Memo created; installment ledger shows "Settled — X-Deal credit memo CM-xxxx" and 0.00        |
| XD-F15 | Double-click Confirm                                                | One memo                                                                                      |
| XD-F16 | Void from the list                                                  | Ledger back to active with the old balance                                                    |
| XD-F17 | Ordinary Credit Memo dialog                                         | No `x_deal` type, and an X-Deal invoice is refused with a message pointing to "X-Deal offset" |
| XD-F18 | Branch Manager, or any user without `accounting:x-deal-memos:issue` | No "X-Deal offset" action, even though Branch Manager still sees ordinary credit memos        |

#### Regression — must still pass

`credit-memos.e2e-spec.ts`, `pos-employee-appliance-loan-checkout.e2e-spec.ts`, `installment-interest-release.e2e-spec.ts`, `ar-invoice-void.e2e-spec.ts`, and the frontend `credit-memo-*`, `pos-checkout-installment-*` specs. Note: `installment-interest-release` and five other financing suites are already blocked on a clean seed (no financeable stock); they need the same `beforeAll` stock fix before they can count as a regression gate.

#### Manual test script

`docs/scenario-67-manual-test-script.md`, written in Part 4: one end-to-end walk (stock an item → ring up an X-Deal → manager approves → release interest for one month → issue the memo → check the ledger, aging and GL → void → check again), plus a short "try to break it" list mirroring R1–R10.

## Not in this scenario

- Recording what NIG received (the counterparty's goods/services) as stock, an expense or an AP bill. The memo debits one clearing account; booking it onward is a normal manual JE.
- Partial barters (part barter, part cash) — decided out, see Decisions.
- Changes to the retired Charge invoice type, TPF, or credit memos for ordinary sales.

## Open questions

1. **Manager approval.** Installment sales wait for release-form approval unless the cashier has an override. Keep that for X-Deal, or require it always?

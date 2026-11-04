# Scenario 83 — Oct 29 UAT P1 Medium fixes

Source: the "NIG Marketing UAT Checklist" (consolidated UAT notes, Oct 29 2026), its **P1 Medium** items that are
not Karms' (WH-01, WH-06, WH-07) or Renz's (SNL-02, BE #248).

Branch `feat/scenario-83-p1-ledger-collection-fixes` in both repos, branched off `development` on 2026-11-04
(BE 4409ee0, FE 56b5c6b2).

## Decisions (Kian, 2026-11-04)

1. **AC-01 is out.** It needs new split permissions, a migration and client answers, and it conflicts with Renz's
   BE #246, which gives the Cashier the CRM edit/delete rights AC-01 removes.
2. **CL-07 reaches the ledger only:** the Customer Ledger's Due column, Total Amount Due and the print. Aging, the
   collector lists and the account list stay at 0 or above. This reverses Chloe's 2026-09-08 zero floor on the
   ledger's Due column, so it is flagged for her.
3. **PR-01:** Unit Price pre-fills from the chosen supplier's price for the item, then the item's cost price, else
   stays blank. The form is shared with Purchase Orders, so POs get it too.
4. **Close Session's expected cash** gets the same penalty fix as DC-01 (Karms' Oct 2 code; it became short when the
   counter started collecting penalties on Oct 15).
5. **Base is `development`, not Scenario 80.** Two parts touch code Scenario 80 also changed: Part 1 (the
   Collections screen, where S80's DC-02 blocks a future override date) and Part 3 (S80's CL-03 Total Amount Due).
   Whichever merges second reconciles them.

## Parts

### Part 1 — penalty and override date on collections (DC-01, CL-04)

| ID            | Cause                                                                                                               | Change                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| DC-01         | The penalty sits on each ARPayment; the receipt's `amount` is the due's part only. The report printed `penalty: 0`. | PENALTY shows the penalty; AMOUNT/DEBIT is the cash received (due + penalty), so totals and balance include it. |
| DC-01         | Close Session summed receipt amounts only.                                                                          | Expected cash (and the undeposited amount) adds the penalty on the session's live cash collections.             |
| DC-01 / CL-04 | The payment panel seeded its Payment date from the override once, on mount.                                         | The panel remounts when the override changes, so the Payment date and its rebate/penalty defaults follow.       |

### Part 2 — partial payment not deducted (CL-06)

**Cause:** the CRM's own "Record payment" endpoint (`POST /crm/installment-accounts/:id/payments`). On a
loaded/imported account it lowered `currentBalance` but never `totalDue` / `miDue` / `uncollected`, so the ledger's
Due, Tot. Amt. Due and the aging stayed at the full installment. Scenario 79 took its modal off the screen on
2026-10-28 (on main the same day, a day before the client's notes), so **Record payment** already went to POS
Collections (POS plans) or AR New Receipt (imported accounts). Both post an ARPayment, which deducts correctly.

**Change (Kian, 2026-11-04: "if it was removed then retire it"):** the endpoint is retired: route, service method,
DTO, and the frontend's unused API wrapper. `InstallmentPaymentRecord` stays: accounts paid through it before then
keep that history, and the totals and ledger go on reading it. The `crm:installment-accounts:record_payment`
permission stays too: it still gates the **Record payment** button.

**Tests:** unit cases for an on-time partial on a POS plan (`customer-ledger-rows.spec.ts`); e2e
`test/scenario-83-part-2-partial-payment.e2e-spec.ts` (₱1,000 due, ₱400 paid → ₱600 on the account, the ledger,
its header and the Collections list, for a POS plan and an imported account; the retired route 404s). The
e2e suites that tested the old endpoint's own behaviour dropped those tests; `installment-account-customer-ledger`
now seeds its historic `InstallmentPaymentRecord` rows directly.

**Flagged, not fixed (Kian: "Retire, flag gap"):** the retired endpoint was the only payment path that added on-time
**points** (+1 per on-time month) and auto-completed the account's open collector **reminder**. POS Collections and
AR New Receipt do neither, so both have been dormant since Scenario 79 (early payoff still closes reminders). How
points should work with AR payments needs its own decision.

### Part 3 — advance payment shows as negative (CL-07)

The ledger's Due column, Total Amount Due and imported accounts stop flooring at zero.

### Part 4 — Purchase Request cost (PR-01)

Adding an item leaves Unit Price at 0, though the item's cost is already loaded.

## Found along the way, not fixed (pre-existing)

- **A cancelled collection still counts.** `cancelPayment` writes `ARPayment.cancelledAt` only; the receipt's own
  `cancelledAt` is never set (except for a delivery fee receipt), so the Daily Collection Report and Close Session,
  which filter on the receipt, still count it. Part 1's penalty sums skip cancelled payments, so they don't add to it.
- **`collections-bulk-payment` e2e:** 3 of 7 fail on untouched development (cascade, non-contiguous selection,
  duplicate invoice).
- **`pos-collections-due-figure` e2e:** fails on untouched development. Its fixture puts the partial payment on the
  invoice's `amountPaid` only, while Due is worked out from each due line's own paid amount.
- **`daily-sales-monitoring` e2e:** S61P2-01 and S61P2-02 fail on untouched development.
- **`installment-account-customer-ledger` e2e:** 2 fail on untouched development (same-day date-picker ordering;
  a collected penalty shown once). A third that failed there now passes, with Part 2's direct seeding.
- **`installment-account-auto-close` e2e:** the 2 POS-originated cases fail on untouched development.
- **Staging data:** accounts paid through the old CRM endpoint before 2026-10-28 may still show a stale Total Due.
  The dev DB has none (0 `installment_payment_records`); staging can't be checked from here.

# Scenario 84 — Oct 29 UAT P1 Medium fixes

Source: the "NIG Marketing UAT Checklist" (consolidated UAT notes, Oct 29 2026), its **P1 Medium** items that are
not Karms' (WH-01, WH-06, WH-07) or Renz's (SNL-02, BE #248).

Branch `feat/scenario-84-p1-ledger-collection-fixes` in both repos, branched off `development` on 2026-11-04
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
`test/scenario-84-part-2-partial-payment.e2e-spec.ts` (₱1,000 due, ₱400 paid → ₱600 on the account, the ledger,
its header and the Collections list, for a POS plan and an imported account; the retired route 404s). The
e2e suites that tested the old endpoint's own behaviour dropped those tests; `installment-account-customer-ledger`
now seeds its historic `InstallmentPaymentRecord` rows directly.

**Follow-up (found while writing Part 3's manual test):** the CRM Installment Accounts list showed an imported
account's stored sheet figures alone, so a partial payment at AR New Receipt never came off its **MI Due** or
**Outstanding Balance** there (the account screen, its ledger and aging all lay it over). The list now applies the
same `overlayCollections()` to the page's imported accounts, with one query for their collections.

**Flagged, not fixed (Kian: "Retire, flag gap"):** the retired endpoint was the only payment path that added on-time
**points** (+1 per on-time month) and auto-completed the account's open collector **reminder**. POS Collections and
AR New Receipt do neither, so both have been dormant since Scenario 79 (early payoff still closes reminders). How
points should work with AR payments needs its own decision.

### Part 3 — advance payment shows as negative (CL-07)

**Cause:** two things kept Due at zero. `buildLedgerRows` floored it (Chloe, 2026-09-08), and it also left a due
settled early out of "not yet due", so the payment and the due cancelled out and an advance never reached the
negative side. Removing the floor alone would have shown a 2 ms artefact (−4,000 on the client's Oct 11 sale) rather
than the real ₱620 advance.

**Change:** a due counts as demandable once its date arrives or a Bill row bills it, and stays that way. Settling it
early no longer hides it, and Due is no longer floored. So Due is "billed − paid", and an advance reads below zero by
exactly the amount paid ahead. On the Oct 11 sale: −350 / −620 / 3,030 / 30 / −240, ending on the ₱240 that spilled
into due 3.

- **Imported accounts:** the sheet's negative Total Due (an advance) is no longer floored. The sheet's figures apply
  from the first unpaid due, or, for an account ahead of its sheet, from its last OR, which created the advance.
- **Unknown history keeps the floor** (`LedgerEvent.floorDue`): every row of a hand-entered account (no due
  dates at all), and an imported account's rows before the sheet's figures apply. There, every earlier payment would
  read as paid ahead.
- **The ledger page's Tot. Amt. Due** (`withLedgerAdvance`) shows the ledger's advance when it ends on one; otherwise
  the account's own figure is unchanged.
- **Ledger only (Kian):** `live-balances.util`, the account screen, the Installment Accounts list, AR aging and the
  Collections / collector due figures still never go below zero. The customer (unified) ledger uses the same rows, so
  it shows advances too.
- **Frontend:** no code change. Both ledger views and the print already show a negative Due as "-₱620.00", red in the
  table. `e2e/scenario-84-part-3-advance-negative.spec.ts` pins that.
- **Reverses Chloe's 2026-09-08 design** (18c4efc, "you are owed a negative amount is not a thing a collector can
  act on"), because the client asked. Flag for her review.
- **Merging with Scenario 80:** S80's CL-03 `ledgerDueAsOf` shares this calculator and floors too. When S80 lands,
  it should follow this rule.

**Tests:** `customer-ledger-rows.spec.ts` (the Oct 11 sale and a due paid ahead now pin the advance;
`withLedgerAdvance`), `installment-account.service.spec.ts` (imported: a negative sheet Total Due, a collection beyond
Total Due, an account ahead of its sheet; hand-entered rows stay floored); e2e
`test/scenario-84-part-3-advance-negative.e2e-spec.ts`. In `installment-account-customer-ledger`, the two tests
that pinned "never negative" now pin the advance.

### Part 4 — Purchase Request cost (PR-01)

**Cause:** the cost was never filled in, rather than wrong. `addFromCatalog` (shared PR / PO form,
`PurchaseOrderFormFields.tsx`) appended every new line at Unit price 0, though the item search already loads the
item's `costPrice` and the form already loads the chosen supplier's linked items with their `unitPrice`.

**Change (Kian, 2026-11-04):** a new line's Unit price starts at the chosen supplier's price for the item
(`ItemSupplier.unitPrice`), else the item's `costPrice`, else 0 as before. A supplier-listed search result carries no
item meta, so its cost is read with `getItem`. SRP stays blank, keeping Karms' 2026-09-14 rule ("the price on THIS
supplier's quote, which the item's own last cost is not a safe stand-in for"). The fallback to cost price is the
nearest this comes to his concern; flag for him. Typing SRP still re-derives Unit price; typing Unit price still
overrides it.

- Frontend only. The PO edit form gets it too (same component).
- Not covered: auto-raised PRs (`purchase-request.service.ts`, low-stock) still store no price; they never pass
  through this form.
- **Dev data:** the local dev DB has no suppliers, so the supplier-price case needs one created (manual test 4A).
  The test DB has 37 suppliers, 3 priced links.

**Tests:** `e2e/scenario-84-part-4-pr-cost-prefill.spec.ts` (cost price with no supplier; blank with no cost;
supplier price over cost; read-only, fixtures looked up through the API). No backend change, so no backend e2e.

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
- **`customer-ledger-unified` e2e:** 2 fail on untouched development (a Due of 50 where 0 is expected).
- **Staging data:** accounts paid through the old CRM endpoint before 2026-10-28 may still show a stale Total Due.
  The dev DB has none (0 `installment_payment_records`); staging can't be checked from here.

## Implementation Log — 2026-11-04

**For this scenario, I have done:**

- Part 1 — DC-01 / CL-04: the Collection Report's PENALTY column and AMOUNT/DEBIT include the late penalty; Close
  Session's expected cash and undeposited amount count it; the Collections Payment date follows the date override
  (BE c5094cc, FE d14e3da8).
- Part 2 — CL-06: the CRM "Record payment" endpoint is retired (BE fcbec8e, FE 34281808); follow-up, the Installment
  Accounts list lays an imported account's collections over its stored figures (BE dcb4aad).
- Part 3 — CL-07: the ledger's Due goes negative for an advance; unknown history keeps its floor; the plan ledger's
  Tot. Amt. Due follows (BE 22e8d32, FE aebc80a5).
- Part 4 — PR-01: a new PR/PO line's Unit price starts at the supplier's price, else the item's cost price
  (FE ef7b3432).

**Verified:** backend unit regression 154 suites / 2,488 tests; the new backend e2e suites (part 1: 8/8, part 2: 8/8,
part 3: 7/7), each shown to fail with its fix reverted; the neighbouring e2e suites listed per part above, one suite at
a time, with every remaining failure confirmed identical on untouched development. Backend and frontend lint and
`tsc --noEmit` on every changed file.

**Not verified yet:**

- **None of the four manual tests** (`NIG/Scenario-84-Manual-Test.md`) has been run. Kian moved on from each part
  without running them, 2026-11-04.
- ~~None of the Playwright specs has been run~~ — run 2026-11-04 on an isolated pair (frontend :3010, backend :3011,
  test DB; the shared :3000/:3001 left alone): part 1 3/3, part 3 2/2, part 4 3/3. Parts 1 and 4 shown to fail
  with their fix reverted (part 3 has no screen change to revert). Part 1/3 need a live customer with an open POS plan;
  the test DB had none, so a throwaway one was seeded for the run and deleted after. Three spec fixes came out of the
  run: the accounts list caps `limit` at 20, the list flattens the schedule (a POS plan is the row with item names),
  the narrowed customer ledger renders the plan ledger, and a SearchCombobox is a button until opened.
- **Playwright regression, all failing before S84's code is reached** (S84 changes four frontend source files:
  `CollectionsScreen.tsx`, `PurchaseOrderFormFields.tsx`, `libs/api/crm.ts`, `schema/crm/installment-account.ts`):
  `pos-collections-multiple-payments` 5/6 (POS checkout never reaches "Installment Plan Created"),
  `pos-collections-rebate`, `installment-account-customer-ledger`, `customer360-installment-plan-detail`,
  `purchase-order-edit-workflow` (no fixture item on the test DB), `pos-collections-same-day-guard` (the Bago
  terminal already has an open session), `scenario-56-ledger` ("New adjustment" gone),
  `purchase-request-submit-navigates-to-orders` (supplier picker driven as an input; it is a button until opened),
  `purchase-order-discount` / `-freebie` / `-pdf` ("New Purchase Order" gone; creating drafts a PR).
  `closing-session-denominations` passes 2/2.
- `next build` was not run.

**Worth flagging:**

- Committed in both repos, **not pushed, no PR** (Kian: "commit but dont push or pr anything").
- Reversals for review: Chloe's 2026-09-08 zero floor on the ledger's Due (Part 3); Karms' Close Session expected
  cash (Part 1) and his PR/PO line pricing (Part 4, SRP rule kept).
- On-time points and reminder auto-close on payment have no writer since the CRM endpoint was retired (dormant since
  Scenario 79); needs its own decision.
- Merging with Scenario 80: its DC-02 (no future override date) meets Part 1's Collections change, and its CL-03
  `ledgerDueAsOf` must follow Part 3's rule. Part 1's manual test uses a future override date, which DC-02 will block.
- AC-01 is out of this scenario (needs client answers; conflicts with Renz's BE #246).

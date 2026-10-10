# Cashier day baseline — the client's sample 1-day transactions

Written for: the developers and the accountant who will argue about these
figures later.

The client handed over a spreadsheet titled **"Cashier's sample 1Day
Transactions"** (`VARIOUS SCENARIOS — Cashier POV`): seven transactions rung up
at one branch on one business day, each with the journal entry their own
accountant expects, then a `SAMPLE FOR CLOSING SESSION` block that totals the
day at **TOTAL BRANCH COLLECTION 87,365.00**.

That day is now the system's accounting baseline. It is replayed through the
real endpoints on every e2e run, and every figure the sheet states is asserted
against what the system actually posts.

- The sheet, verbatim: [`docs/reference/cashier-sample-1day-transactions.csv`](reference/cashier-sample-1day-transactions.csv)
- The sheet, as code: `backend/test/fixtures/cashier-day-baseline.ts`
- The day, rung up: `backend/test/fixtures/cashier-day-baseline.runner.ts`
- The ledger, asserted: `backend/test/cashier-day-baseline.e2e-spec.ts`
- The two sheets, and the banked day, on screen: `frontend/e2e/cashier-day-baseline.spec.ts`
- The same day, seeded for a browser: `backend/scripts/seed-cashier-day-baseline.ts`

## The day

| #   | Scenario                                                                             | Module       | Tender                     |
| --- | ------------------------------------------------------------------------------------ | ------------ | -------------------------- |
| 1   | TV @15,000                                                                           | POS          | cash 15,000                |
| 2   | Refrigerator @22,000 + furniture @35,000 under TPF-Tonik, DP 7,500, delivery fee 500 | POS          | Card-Maya 7,500 · cash 500 |
| 3   | Aircon @19,600 on a 12-month LCP: total price 27,960, DP 2,940, MI 2,085, rebate 160 | POS          | ECPay 2,940                |
| 4   | Next month's MI paid in advance, with the rebate                                     | Collections  | cash 1,925                 |
| 5   | Furniture @17,500 under TPF-Skyro, DP 2,000                                          | POS          | GCash Soundpay 2,000       |
| 6   | Government refunds last year's performance bond                                      | New Receipts | check 56,000               |
| 7   | TV @12,500 under TPF-Salmon, DP 1,500                                                | POS          | Maya QR 1,500              |

Prices are VAT-inclusive at 12%, which is what makes the sheet's own splits
land: a 15,000 tag is 13,392.86 of revenue and 1,607.14 of output VAT.

**Closing session:** cash 17,425 · check 56,000 · GCash 2,000 · Card-Maya 7,500
· ECPay 2,940 · Maya 1,500 = **87,365.00**. The cash line is the only one that
reconciles a drawer: 15,000 (scenario 1) + 500 (the delivery fee) + 1,925 (the
advance MI).

## Corrections applied to the sheet

The sheet is a hand-written sample and carries copy/paste slips. Where the
paper is wrong about its own economics, the baseline asserts the correct
account and records the slip rather than enshrining it. Each is tagged in the
fixture as C1…C6.

|     | What the sheet says                                     | What the baseline books                 | Why                                                                                                    |
| --- | ------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| C1  | Scenario 7 debits `AR - Third-Party Financing - Skyro`  | Salmon's receivable                     | the narrative says Salmon financed it                                                                  |
| C2  | Scenario 7 credits `Sales- Furniture`                   | Sales - Appliances                      | it is a television                                                                                     |
| C3  | Scenario 2's second cost pair is Appliance on both legs | Cost of Sales / Inventory - Furniture   | it is the furniture line's cost                                                                        |
| C4  | Scenario 3 credits `Sales- Appliance`                   | Sales - Airconditioning Units           | the client's own chart has the aircon account, and the monitoring sheet counts aircon under Split type |
| C5  | Scenario 2's `Delivery Income` has no amount            | 500.00                                  | the sheet's own CASH line of 17,425 is 15,000 + 500 + 1,925                                            |
| C6  | Cost of sales only on scenarios 2 and 3                 | a COGS/Inventory pair on all five sales | the system posts cost for every line that carries one                                                  |

One rounding difference is not a correction and not a bug: the sheet splits the
22,000 refrigerator as 19,642.85 + 2,357.15 and the system as 19,642.86 +
2,357.14. Both add to 22,000, and the baseline allows a centavo per line.

## The morning after: banking the day

The CSV export dropped the sheet's blue annotations; they carry a second act
(client screenshot, 2026-10-10):

1. TOTAL BRANCH COLLECTION 87,365.00 is "the amount to be transferred to
   Undeposited Funds" when the session closes.
2. Accounting clears it with **one itemised entry** — the actual cash deposit
   and the temporary clearing accounts, to specific banks, once verified:

   ```
   Dr Cash – Security Bank    17,425   (the cash)
   Dr Cash – BDO Quezon       56,000   (the bond check)
   Dr Cash – Metrobank         1,500   (Maya QR)
   Dr Cash – Metrobank         7,500   (the Maya card terminal)
   Dr Cash – Unionbank         2,000   (GCash Soundpay)
   Dr Cash – BPI Araneta       2,940   (ECPay billers)
      Cr Cash – Branch Collection      73,425
      Cr GCash Clearing                 2,000
      Cr Maya Clearing                  1,500
      Cr Credit Card/POS Clearing       7,500
      Cr ECPay Clearing                 2,940
   ```

   "So, after this Undeposited Funds must be Zero."

3. "Note To Warp: Upon clicking the RECORD DEPOSITS, the field for the amount
   should be blank. In order the Acctg Personnel itemized the specific banks
   and its amount."

The baseline banks the day the way the system can today, and asserts it (D1–D3):
a **POS deposit** of the drawer's 17,425.00 into Security Bank, which credits
back the same Cash on Hand – Branch Collections the sale and the two receipts
debited; then a **ClearingSettlement** per clearing type per bank — card 7,500
to Metrobank, e-wallet 1,500 to Metrobank, 2,000 to Unionbank and 2,940 to BPI
Araneta. Afterwards branch collection, card clearing and e-wallet clearing all
net to zero for the day, which is the client's "Undeposited Funds must be
Zero" — as far as it goes. Only **31,365.00** of the day's 87,365.00 reaches a
bank: the 56,000.00 check never does, and the 76,000.00 of TPF balances is not
a collection to begin with.

## Where the system and the sheet still disagree

Each of these is a `test.failing` in the backend baseline, named after what the
sheet asks for. It passes today _by failing_, and becomes a real failure the
day the gap is closed — so closing one forces the baseline to be revisited
instead of quietly rotting.

|     | Gap                                                                                                                                     | What it costs the client                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Revenue posts to one `SALES_REVENUE` account, never per category — `Item.revenueAccountId` exists and the POS sale JE ignores it        | the sheet's `Sales- Appliance` / `Sales- Furniture` split does not exist in the GL; it lives only in the monitoring report                                                                                           |
| G2  | A TPF down payment carries no payment-method option, so Card-Maya, GCash Soundpay and Maya QR all key as the bare method                | three of the six closing-session lines cannot be settled against the provider's own report. `TpfProvider.glAccountId` has the same shape of problem: it exists, but no API sets it (the baseline writes it directly) |
| G3  | The Daily Collection Report reads POS tenders and collection receipts only — an Acknowledgement Receipt (New Receipts) feeds nothing    | the 56,000 bond check is missing from the branch's own collection total                                                                                                                                              |
| G4  | `SALES_DISCOUNT` is mapped to `4-01-090 Sales Returns and Allowances`, though the chart has `4-01-100 Sales Discounts`                  | a collection rebate is reported as a sales return                                                                                                                                                                    |
| G5  | A branch New Receipt debits `1-01-020 Cash in Bank - Bank Master`                                                                       | money taken at the counter is booked as if it were already banked                                                                                                                                                    |
| G6  | A due settled by cash + its rate-card rebate reads `MI-PARTIAL`, because the classification looks at cash against the scheduled amount  | the client's DESC column would say MI                                                                                                                                                                                |
| G7  | The financed balance of a TPF sale is counted as collected                                                                              | the report tops the day at 107,365.00 against the sheet's 87,365.00 — the 76,000 the financiers owe is in, the 56,000 check is out                                                                                   |
| G8  | A deposit takes one `bankAccountId` and works its own amount out from the sessions — there is no itemisation                            | the client's single 87,365.00 record across five banks cannot be made; it is one deposit plus four settlements, with nothing tying them to the closing                                                               |
| G9  | That deposit clears only the drawer's holding account; the processors' clearing accounts are cleared by a separate `ClearingSettlement` | "Undeposited Funds must be Zero" takes five operations, and nothing checks that they add up to the closing                                                                                                           |
| G10 | `ClearingSettlementType` is `card`/`ewallet`/`bank_transfer`/`tpf`, so GCash, Maya QR and ECPay share one E-Wallet Receivable Clearing  | the sheet's GCash 2,000 / Maya 1,500 / ECPay 2,940 cannot be told apart in the GL, only by which bank they settled into                                                                                              |
| G11 | The bond check never reaches a deposit — the New Receipt banked it at the counter (G5) and no report sees it (G3)                       | the 56,000.00 is missing from the banking, so the day banks 31,365.00 against the sheet's 87,365.00                                                                                                                  |
| G12 | Record deposit opens with the amount filled in from the sessions (₱54,375.00 in the client's screenshot)                                | the client asked for it **blank**, so accounting itemises banks and amounts. UI work, not yet covered by a test — it depends on G8                                                                                   |

Two further things the baseline configures rather than reports as gaps, because
they are chart-of-accounts setup and not code: the shipped chart has no
`1-03-070 Bidders/ Performance Bond Deposit` and no per-partner TPF
receivables (`1-02-051/052/053`), both of which the client's own chart carries.

## Running it

The ledger half, against the isolated test database:

```bash
cd backend
npm run test:e2e -- --testPathPatterns cashier-day-baseline
```

The screen half needs the day in the database the frontend is reading. The e2e
stack is its own pair (frontend `:3010`, backend `:3011`, both on the `-test`
database), and a cold `start:e2e` resets that database — so seed after the
stack is up, then run the spec:

```bash
cd backend
DOTENV_CONFIG_PATH=.env.test npx ts-node -r dotenv/config \
  -r tsconfig-paths/register scripts/seed-cashier-day-baseline.ts

cd ../frontend
npx playwright test cashier-day-baseline
```

The seed rings up the day **and** banks it, so Undeposited Funds has something
to show beside the two sheets. Both halves work the same branch, so the backend run clears the seeded day on
its way out: run the ledger half first, then seed, then the screen half.
Without the seed the frontend tests skip, with the command in the skip
message — a missing fixture is not a regression. The same script, run with the
dev `.env` instead, puts the day in front of a human: open
`/pos/daily-collection`, pick **E2E Cashier Day Baseline Branch**, and the two
sheets are the client's own day.

Everything either half creates is named `E2E-BASE`, and both clear the previous
baseline day off that branch before ringing up a new one — run them as often as
you like and there is still one day there.

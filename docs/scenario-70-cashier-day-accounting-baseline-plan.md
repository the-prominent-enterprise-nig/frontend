# Scenario 70 — Cashier Day Accounting Baseline (Closing, Collection Report, Deposit) — Gap Analysis & Closing Plan

**Source**: the client's spreadsheet _"Cashier's sample 1Day Transactions"_ (`VARIOUS SCENARIOS — Cashier POV`), committed verbatim at `docs/reference/cashier-sample-1day-transactions.csv`, plus the annotated screenshot of its closing block (client, 2026-10-10) whose blue callouts the CSV export dropped. Seven transactions at one branch on one business day, each with the journal entry their accountant expects, closing at **TOTAL BRANCH COLLECTION 87,365.00**, and a second act in the annotations: that figure goes to Undeposited Funds and clears as one deposit itemised across five banks.

Unlike Scenario 69, this is not a list of client notes. It is one worked example, and the gaps are whatever the system does differently when you actually ring it up. They were found by doing exactly that, not by reading code: the day now runs on every e2e pass.

Verified against the working tree on **2026-10-10** (frontend `ab000a9d`, backend `9b9186a`, both on `feat/daily-collection-sales-monitoring-sheet`).

---

## What already exists

The baseline itself is built and green, and it is the acceptance test for everything below.

| Where                                                  | What                                                                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `backend/test/fixtures/cashier-day-baseline.ts`        | the sheet as code — amounts, expected accounts, closing tenders, the deposit entry, and the six corrections applied to the paper |
| `backend/test/fixtures/cashier-day-baseline.runner.ts` | rings the day up and banks it, through the real endpoints                                                                        |
| `backend/test/cashier-day-baseline.e2e-spec.ts`        | 27 tests: the seven ledgers, the close, both reports, the deposit, and twelve gaps                                               |
| `backend/scripts/seed-cashier-day-baseline.ts`         | the same day, seeded into a browsable database                                                                                   |
| `frontend/e2e/cashier-day-baseline.spec.ts`            | 4 tests: the two sheets and Undeposited Funds, read off the screen                                                               |
| `frontend/docs/cashier-day-baseline.md`                | the narrative: the day, the corrections, the gaps, the commands                                                                  |

**Every gap below is already a `test.failing` named after what the sheet asks for.** It passes today _by failing_. Closing the gap turns it into a real failure, and the fix is finished when you delete the `.failing` and it passes on its own. No gap in this plan needs a new test written first.

---

## Verdict table

| #   | Gap (what the sheet asks for)                                | Verdict                    | Size | Why                                                                                                                        |
| --- | ------------------------------------------------------------ | -------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| G4  | A rebate goes to Sales Discounts `4-01-100`                  | ✅ **Done** `1bf8110`      | XS   | Backfill repoints the mapping; the rebate spec no longer forces it onto 4-01-090                                           |
| G5  | A branch New Receipt lands in COH — Branch Collections       | ✅ **Done** `2c84ce1`      | S    | A branch receipt resolves `POS_CASH`; corrections reuse the original entry’s own cash account                              |
| G6  | A due settled with its rebate reads MI, not MI-PARTIAL       | ✅ **Done** `e86defe`      | S    | The rebate counts toward the due before MI / MI-PARTIAL is decided                                                         |
| G7  | A TPF balance is not a collection — the day totals 87,365.00 | 🚧 **Needs decision**      | S    | The financed balance is counted as collected; see _Decisions needed_                                                       |
| G3  | New Receipts are part of TOTAL BRANCH COLLECTION             | 🚧 **Built, blocked**      | M    | Written and green, but it builds on uncommitted `daily-collection.service.ts` work — lands when that does                  |
| G2  | A TPF down payment carries its provider                      | ✅ **Done** `4239353` `+1` | S    | `tpfDownPaymentMethodOptionId` carries the provider; per-partner accounts now have an API                                  |
| G1  | Revenue splits per category                                  | ✅ **Done** `6217f8e`      | M    | Revenue resolves per line via `Item.revenueAccountId` on all three posting paths                                           |
| G10 | GCash, Maya and ECPay each clear their own account           | 🚧 **Needs decision**      | M    | `ClearingSettlementType` is 4 coarse types; the three share one E-Wallet clearing account                                  |
| G8  | One deposit record, itemised across the banks that took it   | ✅ **Done** `287d204`      | L    | `PosDepositLine` — a bank, an amount and the account it clears; one entry posted from the slips                            |
| G9  | That deposit clears the processors' holding accounts too     | ✅ **Done** `287d204`      | M    | That same entry empties the branch’s cash and every processor’s clearing account together                                  |
| G11 | The 56,000.00 bond check is banked with the rest of the day  | ✅ **Done** `a45354d`      | —    | A receipt carries the deposit that banked it and is selected onto one in its own right                                     |
| G12 | Record deposit opens with the amount blank                   | ✅ **Done** `d47415f0`     | M    | A row per slip — bank, amount, what it clears — the amount blank on open, with a running tally against what is outstanding |

**Done (2026-10-10):** G1, G2, G4, G5, G6, as five atomic commits, each verified on its own in a throwaway worktree — typecheck clean and the baseline 27/27 at every one. Two neighbouring suites were repaired on the way (`acknowledgement-receipts` sent no `receiptType`; `unapplied-collections` could not run twice).

**Built but not committed:** G3. It is green in the working tree and depends on in-flight `daily-collection.service.ts` work (`inBranch`, `sourceCounter`, `collectorLabelOf`), so it cannot stand as its own commit until that lands.

**Still open:** G7 and G10, one client decision each. Everything else is closed: the day rings up, reports, banks and reads back as the client's own sheet draws it. With G11 closed the baseline's day banks in full — one deposit, five banks, 87,365.00, every holding account emptied — which is the client's own entry to the centavo bar the clearing-account split G10 asks for.

**Needs a migration: G8** (deposit lines), with **G9** and **G12** hanging off it and **G11** falling out for free.
**Needs a chart-of-accounts decision: G10.**

---

## Phase 1 — Make the day tie out ✅ _(G3 pending its dependency, G7 pending the client)_

The five that move the number the client reads first. Each is config or a few lines of service code; together they take the Daily Collection Report from **107,365.00** to the sheet's **87,365.00**.

1. **G4 — the rebate account.** Point the `SALES_DISCOUNT` mapping at `4-01-100 Sales Discounts`. A mapping row plus a backfill script in the shape of `scripts/backfill-misc-collections-account-mapping.ts`. Existing rebate postings stay where they are unless the client wants them reclassified — ask.
2. **G5 — where a New Receipt lands.** `acknowledgement-receipts.service.ts` resolves its debit through `DEFAULT_CASH`; it should resolve `POS_CASH` (COH — Branch Collections) for a branch receipt, which is what the sheet's 73,425.00 credit assumes.
3. **G3 — New Receipts in the report.** `daily-collection.service.ts` gains a third source beside POS tenders and collection receipts. Match on `branchId` + business day, keep the existing cash/non-cash split (a check keys as `check`), and leave the ledger cash-only as it is.
4. **G7 — stop counting the financiers' balances.** Exclude the `tpf` tender from `nonCashCollection` / `grandTotalCollection`. Pending the decision below, this may be a move rather than a deletion.
5. **G6 — MI vs MI-PARTIAL.** Add the collection's rebate to the cash amount before comparing it to `dueTotal`.

**Done when**: `G3`, `G4`, `G5`, `G6`, `G7` stop failing and `REPORT_TOTALS_AS_POSTED` holds the sheet's own figures. As of 2026-10-10 four of the five are closed and the report reads **163,365.00** in the working tree: the 56,000.00 bond check is in, and what remains between that and 87,365.00 is exactly G7's 76,000.00.

## Phase 2 — Provider and category fidelity ✅ _done_

6. **G2 — the TPF down payment's provider.** Add `tpfDownPaymentMethodOptionId` to `CreateTransactionDto`, carry it onto the auto-created `PosPayment`, and surface the picker at checkout the way a normal tender has one. Also worth doing here: `TpfProvider.glAccountId` exists but no API sets it, so per-partner receivables can only be configured in the database.
7. **G1 — revenue per category.** `buildSaleJELines` and `createAndPostInstallmentPlan` both resolve `MAPPING_KEYS.SALES_REVENUE` once for the whole cart. Resolve per line through `item.revenueAccountId` first, the way COGS already does via `posting.resolveAccount(item.cogsAccountId, …)`. Watch the allocation: `allocateExactly` apportions the net to the lines, so the centavo remainder must still land somewhere deterministic.

## Phase 3 — The deposit ✅ _done_

8. **G8 + G9 — done (`287d204`).** `PosDepositLine` carries a bank, an amount and the account it clears; clearing posts one entry from the slips, a debit per bank and a credit per holding account. The rule enforced is the one figure the system knows: the slips clearing the branch's own cash must come to what the sessions left. The baseline banks its day as one record of 31,365.00 across four banks.

9. **G11 — done (`a45354d`).** A New Receipt carries the deposit that banked it and is selected onto one in its own right, counting toward what the cash slips must come to. The baseline's deposit is now the client's own entry: Dr Security 17,425 / BDO 56,000 / Metrobank 9,000 / UnionBank 2,000 / BPI 2,940 against Cr Branch Collection 73,425 / Card Clearing 7,500 / E-Wallet Clearing 6,440.

10. **G12 — done (`d47415f0`).** A row per slip (bank, amount, what it clears), the amount blank on open as the client asked, the branch's unbanked New Receipts listed to be banked alongside the sessions, and a running tally — "Cash slips ₱73,425.00 of ₱73,425.00 · Balanced" — with Record deposit disabled until they meet. Seeding gained `BASELINE_SKIP_BANKING=1`, which leaves the day closed but unbanked so the screen has something in front of it.

**Not covered by a test:** the modal itself. Its committed e2e would need an unbanked day, and the baseline's own screen test needs a banked one — the two cannot both hold for one branch-day. It was driven by hand against a `BASELINE_SKIP_BANKING=1` seed (blank amount, the tally moving to 73,425.00 as the New Receipt is ticked, the button enabling when the slips balance); the rules behind it are covered server-side.

Do not start Phase 3 before Phase 1: until a New Receipt reaches branch collection, the 56,000.00 line of the client's deposit has nothing to clear.

---

## Decisions needed

1. **G7 — remove the TPF balances, or move them?** The sheet leaves the financiers' 76,000.00 out of TOTAL BRANCH COLLECTION entirely. The branch may still want to see what the financiers owe on the day they sold it. _Remove, or show as its own "due from financing partners" block below the collection total?_
2. **G10 — four clearing accounts or one?** The sheet names GCash Clearing, Maya Clearing, Credit Card/POS Clearing and ECPay Clearing. The shipped chart has `1-01-111 Credit Card Receivable Clearing` and `1-01-112 E-Wallet Receivable Clearing`, so GCash, Maya QR and ECPay are indistinguishable in the GL. _Add the three accounts and key them off the payment-method option, or keep one e-wallet clearing and rely on which bank settled it?_ The second is free; the first is a migration plus chart work.
3. **G4 — reclassify history?** Existing rebates sit in Sales Returns and Allowances. _Leave them, or move them with the mapping?_
4. **G12 — confirm the screen.** The annotation asks for a blank amount so accounting itemises banks. Worth confirming with them that the branch still drafts the deposit and accounting still clears it — the blank field changes who enters what.

---

## Chart-of-accounts setup, not code

Two things the baseline configures for itself because the shipped chart does not carry them. They are real client data, not test scaffolding, and should be seeded properly before any of this reaches them:

- `1-03-070 Bidders/ Performance Bond Deposit` — in the client's own chart (`prisma/data/client-chart-of-accounts.tsv`), absent from `coa-seed.service.ts`.
- Per-partner TPF receivables under `1-02-050` — Tonik, Skyro and Salmon, which the sheet names separately on every TPF sale.

---

## Out of scope

- The Daily Sales Monitoring sheet itself: already built and already asserted (Scenario 61), and the baseline confirms its three cuts tie to total sales.
- Anything about the day's **inventory** movement. The baseline asserts the COGS/Inventory pairs post per category, which they already do.

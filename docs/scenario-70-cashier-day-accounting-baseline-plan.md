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

| #   | Gap (what the sheet asks for)                                | Verdict               | Size | Why                                                                                           |
| --- | ------------------------------------------------------------ | --------------------- | ---- | --------------------------------------------------------------------------------------------- |
| G4  | A rebate goes to Sales Discounts `4-01-100`                  | ✅ **Today**          | XS   | `SALES_DISCOUNT` is mapped to `4-01-090 Sales Returns and Allowances`; one mapping row        |
| G5  | A branch New Receipt lands in COH — Branch Collections       | ✅ **Today**          | S    | It debits `1-01-020 Cash in Bank - Bank Master` — money at the counter booked as banked       |
| G6  | A due settled with its rebate reads MI, not MI-PARTIAL       | ✅ **Today**          | S    | `daily-collection.service.ts` compares cash against the scheduled amount, ignoring the PPD    |
| G7  | A TPF balance is not a collection — the day totals 87,365.00 | 🚧 **Needs decision** | S    | The financed balance is counted as collected; see _Decisions needed_                          |
| G3  | New Receipts are part of TOTAL BRANCH COLLECTION             | ✅ **Today**          | M    | The report unions POS tenders and collection receipts; `AcknowledgementReceipt` feeds nothing |
| G2  | A TPF down payment carries its provider                      | ✅ **Today**          | S    | No `tpfDownPaymentMethodOptionId` on the DTO, so Card-Maya / Soundpay / Maya QR key bare      |
| G1  | Revenue splits per category                                  | ✅ **Today**          | M    | `Item.revenueAccountId` exists and both sale JEs ignore it for the `SALES_REVENUE` mapping    |
| G10 | GCash, Maya and ECPay each clear their own account           | 🚧 **Needs decision** | M    | `ClearingSettlementType` is 4 coarse types; the three share one E-Wallet clearing account     |
| G8  | One deposit record, itemised across the banks that took it   | ❌ **Migration**      | L    | `PosDeposit` holds one `bankAccountId` and one derived amount                                 |
| G9  | That deposit clears the processors' holding accounts too     | ❌ **Depends on G8**  | M    | Clearing accounts are emptied by a separate `ClearingSettlement` per type per bank            |
| G11 | The 56,000.00 bond check is banked with the rest of the day  | ➖ **Falls out**      | —    | Nothing of its own: G5 puts it in branch collection, G3 reports it, G8 banks it               |
| G12 | Record deposit opens with the amount blank                   | ❌ **Depends on G8**  | M    | UI. The field is filled from the sessions being banked (₱54,375.00 in the client's shot)      |

**Shippable without a migration: G4, G5, G6, G7, G3, G2, G1** — seven items, and the first five of them are what make the report total the client's own 87,365.00.

**Needs a migration: G8** (deposit lines), with **G9** and **G12** hanging off it and **G11** falling out for free.
**Needs a chart-of-accounts decision: G10.**

---

## Phase 1 — Make the day tie out

The five that move the number the client reads first. Each is config or a few lines of service code; together they take the Daily Collection Report from **107,365.00** to the sheet's **87,365.00**.

1. **G4 — the rebate account.** Point the `SALES_DISCOUNT` mapping at `4-01-100 Sales Discounts`. A mapping row plus a backfill script in the shape of `scripts/backfill-misc-collections-account-mapping.ts`. Existing rebate postings stay where they are unless the client wants them reclassified — ask.
2. **G5 — where a New Receipt lands.** `acknowledgement-receipts.service.ts` resolves its debit through `DEFAULT_CASH`; it should resolve `POS_CASH` (COH — Branch Collections) for a branch receipt, which is what the sheet's 73,425.00 credit assumes.
3. **G3 — New Receipts in the report.** `daily-collection.service.ts` gains a third source beside POS tenders and collection receipts. Match on `branchId` + business day, keep the existing cash/non-cash split (a check keys as `check`), and leave the ledger cash-only as it is.
4. **G7 — stop counting the financiers' balances.** Exclude the `tpf` tender from `nonCashCollection` / `grandTotalCollection`. Pending the decision below, this may be a move rather than a deletion.
5. **G6 — MI vs MI-PARTIAL.** Add the collection's rebate to the cash amount before comparing it to `dueTotal`.

**Done when**: `G3`, `G4`, `G5`, `G6`, `G7` stop failing, and the report assertion that currently expects 107,365.00 is updated to 87,365.00 in the same commit. Both figures live in `REPORT_TOTALS_AS_POSTED`.

## Phase 2 — Provider and category fidelity

6. **G2 — the TPF down payment's provider.** Add `tpfDownPaymentMethodOptionId` to `CreateTransactionDto`, carry it onto the auto-created `PosPayment`, and surface the picker at checkout the way a normal tender has one. Also worth doing here: `TpfProvider.glAccountId` exists but no API sets it, so per-partner receivables can only be configured in the database.
7. **G1 — revenue per category.** `buildSaleJELines` and `createAndPostInstallmentPlan` both resolve `MAPPING_KEYS.SALES_REVENUE` once for the whole cart. Resolve per line through `item.revenueAccountId` first, the way COGS already does via `posting.resolveAccount(item.cogsAccountId, …)`. Watch the allocation: `allocateExactly` apportions the net to the lines, so the centavo remainder must still land somewhere deterministic.

## Phase 3 — The deposit

8. **G8 + G9 + G12 + G11.** A `PosDepositLine` (bank account, amount, which holding account it clears), the service posting one balanced entry from those lines, and the Record deposit modal rebuilt around them with the amount blank. The sheet's own entry is the acceptance case: six debit lines into five banks against branch collection plus the four clearing accounts, leaving every holding account at zero.

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

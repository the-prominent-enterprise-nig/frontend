# Scenario 32 — Customer Ledger (Installment Contract Detail) — Gap Analysis & Closing Plan

Source: client-provided photo of their real paper "Customer Ledger" card (2026-08-18) — a per-contract installment tracking sheet used at NIG branches. Compared field-by-field against the current CRM Installment Account model/UI. Two ambiguous abbreviations and one field-naming ambiguity were resolved with the client during this same review (see below) — the numbers on the sample card itself don't matter, only the template/fields do.

## What's already fine — verified, not re-scoped here

Most of the paper card's financial-terms fields already exist verbatim on `InstallmentAccount` and are already shown on the existing per-contract screen, `InstallmentAccountDetail.tsx` (CRM → Installment Accounts): Down payment, Amount Financed, Interest Differential ("Inst. Diff."), Monthly Installment, Term, Total Price, Branch, Collector, DP Balance. That screen is the right screen to extend — not a blank slate.

**"Total Amount Due" resolved**: maps to the already-existing, already-live `InstallmentAccount.currentBalance` — the one field the system actively keeps accurate on every payment (`recordPayment()` subtracts from it directly). It must NOT be confused with the similarly-named `totalDue` field, which sits in a separate `notYetDue`/`totalDue`/`miDue`/`uncollected`/`arrears` cluster that's staff-typed at creation/import/edit time and is never recalculated afterward — it can silently go stale. No UI change needed for this finding; it's a naming-clarity note so whoever builds the gaps below doesn't wire a new "Total Due" display to the wrong field.

**TMI and IC identified**: confirmed with the client — **TMI = Total Monthly Income** (the borrower's income, captured for credit assessment) and **IC = Insurance Charge** (an optional per-contract fee, sometimes zero).

## Closing the gaps

### 1. Unit / Model / Serial not connected to the contract

**Problem**: item name, model number, and serial number are all tracked in the system (`Item`, `SerialNumber`) and even shown for POS-originated accounts — but only on a different page (Customer360's installment-schedule modal), never on the contract's own record or its ledger screen. Hand-entered/imported accounts have no unit data captured at all.

**Doc drift correction (2026-08-19 re-verification)**: this line originally implied Customer360's modal already showed model number — it doesn't. That modal shows item name and serial number only; `Item.modelNumber` exists in the schema but was never wired into that data path. Fixed as part of closing this gap (see Implementation Log).

**Fix**: needs a design decision — add a direct reference on `InstallmentAccount` itself, or resolve it via the linked schedule the way Customer360 already does (POS-originated accounts only), plus a decision on whether hand-entered accounts get a manual equivalent.

**Status**: done — see Implementation Log (2026-08-19).

### 2. WIP (financing scheme) not carried onto the contract

**Problem**: the price-use-type/scheme code (WIP, CR-BR, SSC, TONIK, SKYRO, etc.) is captured at the moment of POS checkout but never propagated onto the resulting `InstallmentAccount` — the contract's own record can't say which scheme it was sold under.

**Fix**: carry the `priceUseTypeId` (or its resolved name) onto `InstallmentAccount` at creation time; needs the same POS-originated-vs-hand-entered decision as item 1.

**Status**: done — see Implementation Log (2026-08-19).

### 3. Manager/salesperson not attached to the contract

**Problem**: tracked elsewhere as "Selling Agent" on the POS transaction, not on the installment account itself.

**Fix**: TBD — likely the same propagate-at-creation pattern as items 1 and 2.

**Status**: done — see Implementation Log (2026-08-19).

### 4. No running totals for Total Payments, Total Rebates, or Total Billing

**Problem**: `recordPayment()` only keeps a snapshot of the most recent payment (`lastOrNumber`/`lastOrDate`/`lastOrAmount`) and reduces `currentBalance` directly — there's no persisted payment or rebate history for hand-entered accounts, and no stored aggregate anywhere. For POS-originated accounts, the underlying `ARPayment` rows (including `rebateAmount`) do exist and are technically summable, but nothing aggregates them today.

**Fix**: needs its own design pass — likely a real payment-history record for hand-entered accounts, plus a summed rollup view for POS-originated ones so both paths can show the same three numbers.

**Status**: done — see Implementation Log (2026-08-19).

### 5. Per-installment billing history lives on the wrong screen

**Problem**: the "2nd Bill / 3rd Bill"-style due-date billing history already exists (`InstallmentScheduleLine`, one row per due date), but only renders inside Customer360's schedule modal — a different page from the contract's own ledger screen. Confirmed with the developer: it should live on the contract's own screen instead, matching how the paper ledger keeps everything about one contract in one place. It also doesn't exist at all for hand-entered/imported accounts with no linked schedule.

**Fix**: surface the same billing-history table directly on `InstallmentAccountDetail.tsx`, reusing the data/logic Customer360's modal already has for POS-originated accounts. Hand-entered accounts need a separate decision (item 1/2/3's same POS-vs-manual question).

**Status**: done — see Implementation Log (2026-08-19).

### 6. TMI and IC have no field anywhere yet

**Problem**: now identified (see above), but neither is actually stored anywhere in the system.

**Fix**: needs a design decision on where each belongs. IC (Insurance Charge) is plausibly a straightforward addition to `InstallmentAccount`'s financing-terms fields. TMI (income) is less obviously a ledger field at all — it's a credit-assessment input, so it may belong on the existing Credit Application/Promissory Note record (Scenario 17) instead of the installment contract itself.

**Status**: done — see Implementation Log (2026-08-19). One follow-up gap remains: no UI yet to actually type TMI into a credit application (see log).

## Open Questions

1. ~~Where TMI (income) most naturally belongs — the installment account, or the Credit Application/Promissory Note record (Scenario 17)? Blocks item 6.~~ **Resolved 2026-08-19**: both — `CreditApplication.totalMonthlyIncome` is the source of truth, `InstallmentAccount.totalMonthlyIncome` is a read-only copy taken at checkout time.
2. ~~Whether hand-entered/imported `InstallmentAccount`s get manual equivalents for unit/model/serial (item 1), scheme (item 2), salesperson (item 3), and billing history (item 5) — or whether those stay POS-only by design, same open question repeated across items 1, 2, 3, and 5.~~ **Resolved 2026-08-19**: POS-only for this pass — hand-entered/imported accounts show blank/"—" for all four. Item 6 (IC) is the exception — it's a plain financing-terms value editable for either origin, not tied to POS checkout.

## Verification (once implemented)

All 6 items implemented and manually verified with the developer, 2026-08-19 — see Implementation Log below for what was built and e2e coverage per item.

## Implementation Log — 2026-08-19

**For this scenario, I have done:**

- Item 1 (Unit/Model/Serial): `InstallmentAccountService.findOne()` resolves the linked `InstallmentSchedule`'s `posTransactionLines` into a new `unitItems[]` field (item name, model number, brand, serial numbers), mirroring Customer360's existing pattern. New "Unit" section on `InstallmentAccountDetail.tsx`. POS-only — hand-entered/imported accounts show "Not available for hand-entered/imported accounts." Also fixed the model-number gap this same data path had (see doc drift correction above item 1).
- Item 2 (WIP/scheme): new `InstallmentAccount.priceUseTypeId` field, carried from `PosTransaction.priceUseTypeId` at creation time via `createLinkedInstallmentAccount()`. New "Scheme" row in the Financing card. POS-only.
- Item 3 (Salesperson): new `InstallmentAccount.sellingAgentId` field, carried from `PosTransaction.sellingAgentId` at creation time, same pattern as item 2. New "Salesperson" row in Customer & assignment. POS-only.
- Item 4 (Running totals): new `InstallmentPaymentRecord` model — one row per `recordPayment()` call, for either origin (this is the sole payment history for hand-entered accounts; for POS-originated accounts it's additive alongside their existing `ARPayment` trail, since the same "Record payment" button is available on both). `totalPayments`/`totalRebates` = `sum(InstallmentPaymentRecord) + sum(ARPayment, POS-originated only)`. `totalBilling` is a plain restatement of `totalPrice` (developer-confirmed — POS-originated accounts create all due-date invoices upfront, so summing them always equals `totalPrice`; hand-entered accounts have no per-due-date breakdown at all, so the same field serves the same role). New "Running totals" section.
- Item 5 (Billing history): `findOne()` now includes the linked schedule's due-date lines (`InstallmentScheduleLine.arInvoice`), same query shape as Customer360's modal, exposed as `billingHistory[]`. New "Billing history" section — one row per due date, links to that invoice's detail page. POS-only. Developer-requested follow-up same day: each row also shows `paidOn` (the most recent non-cancelled payment date on that invoice), not just a status badge.
- Item 6 (TMI/IC): new `InstallmentAccount.insuranceCharge` (plain financing-terms value, editable for either origin via the New/Edit forms) and `InstallmentAccount.totalMonthlyIncome` (read-only copy, POS-only). New `CreditApplication.totalMonthlyIncome` as TMI's source of truth, copied onto the resulting `InstallmentAccount` at checkout time.

**Worth flagging:**

- No UI yet to actually type TMI into a credit application. The backend field (`CreditApplication.totalMonthlyIncome`) and DTO support exist and are tested end-to-end (`pos-installment-financing.e2e-spec.ts`), but `CreateCreditApplicationModal.tsx`/`CreditApplicationDetail.tsx` were the developer's own active, uncommitted work throughout this implementation pass, so they were deliberately left untouched to avoid conflicting edits. Until that form gains an input, TMI can only be set via `PATCH /credit/applications/:id`.
- Migration `20260818143424_scenario_33_repoint_apbill_expense_to_supplier` also contains the `installment_payment_records` table's creation (item 4) — it landed there because the `InstallmentPaymentRecord` model was already sitting in the shared `schema.prisma` when the developer ran their own Scenario 33 migration. Functionally correct on both DBs; just a naming quirk in migration history, left as-is rather than risk editing an already-applied migration.
- This implementation pass ran on `fix/scenario-31-accounting-linking-balance` alongside the developer's own concurrent, uncommitted Scenario 31 and Scenario 33 work (schema edits, other migrations) — by the developer's explicit choice (asked and confirmed at the start of this run). The two scenarios' diffs are commingled in the working tree; separating them into distinct commits/PRs, if wanted, is a manual step for later.
- Items 1, 2, 3, and 5 are POS-only by design (confirmed with the developer) — hand-entered/imported accounts show blank/"—" for unit, scheme, salesperson, and billing history. Item 6's IC is the exception (plain financing field, works for both origins); item 4's running totals also work for both origins since payments happen to every account regardless of how it was created.

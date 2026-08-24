# Scenario 38 — Accounting Posting Gaps (Missing Items) — Gap Analysis & Closing Plan

Source: full audit of the client's own posting-entries spec, `backend/prisma/data/NIG ERP- GL MAPPING & POSTING ENTRIES.xlsx - POSTING ENTRIES.csv` (48 rows spanning purchasing, POS sales, installment financing, withholding tax/2307, customer retention, third-party financing, cashier/bank clearing, returns, and adjustments), cross-checked row by row against the live codebase, 2026-08-23. Of 48 rows: 10 already match, 18 are partial (tracked separately, not in this doc), and **20 are fully missing** — this doc scopes only those 20.

## Sources

- `backend/prisma/data/NIG ERP- GL MAPPING & POSTING ENTRIES.xlsx - POSTING ENTRIES.csv` — client's own end-to-end posting spec (rows 9C/9D, 11C, 11F/11H/11I/11J, 11K-11O, 12B/12C, 13C/13D/13E, 14C, 15A/15B).
- `backend/src/pos/pos-posting.service.ts` — POS payment-method → GL account resolution, sale/refund JE builder.
- `backend/src/accounting/posting/posting.service.ts` — `MAPPING_KEYS`, JE posting engine.
- `backend/src/accounting/account-mapping/account-mapping.service.ts` — `STANDARD_MAPPINGS`, admin-configurable GL account assignment.
- `backend/src/accounting/coa-seed/coa-seed.service.ts` — default chart-of-accounts seeding, including unmapped placeholder accounts.
- `backend/src/accounting/ar-invoices/ar-invoices.service.ts` — AR collection recording, existing CWT posting (`recordPaymentCore`).
- `backend/src/accounting/bank-accounts/bank-accounts.service.ts` — bank deposit/reconciliation.
- `backend/src/pos/sessions.service.ts` — cashier session close, cash-count sweep.
- `backend/src/pos/tpf-providers.service.ts` — third-party financing partner config.
- `backend/src/accounting/tax/tax.service.ts` — tax module (confirmed to have no CWT/income-tax-closing logic today).
- `backend/prisma/schema.prisma` — `Customer`, `ARPayment`, `TpfProvider` models; confirmed absence of any retention-related model.

## What's already fine — not re-scoped here

- Core POS clearing-account **architecture** is sound: cash/card/e-wallet/bank-transfer are already distinct mapping keys rather than one generic "Cash" bucket (`pos-posting.service.ts`, `PAYMENT_METHOD_MAPPING`). The 18 partial items (wrong account names, missing metadata fields, disconnected postings) are tracked separately from this doc — this doc is scoped to the 20 rows with **zero** implementation.
- The base CWT posting mechanism at collection time (Dr Cash + Dr Creditable Withholding Tax / Cr AR at gross) genuinely exists and works (`ar-invoices.service.ts:608-645`) — this doc only covers what's missing _around_ it (Gaps 5 and 8 below).
- TPF (Tonik/Salmon/Skyro) sales are captured with provider, reference number, and approved amount (`transactions.service.ts:471-492`) — this doc only covers the missing settlement/clearing half of that lifecycle (Gap 1) and the missing return handling (Gap 6).

## Decisions needed before implementation

These aren't code questions — they're business-scope questions this plan can't resolve on its own. Flagging them up front so implementation doesn't start on a gap that turns out to be unwanted or lower priority than assumed.

1. **Customer Retention (Gap 9) — is this feature actually needed?** Retention receivables (withholding a % of an invoice until a milestone/warranty period passes) is a construction/project-billing concept. Nothing in the current customer/sales data suggests NIG's appliance retail business uses retention terms with any customer. Recommend confirming with the client whether any real contract actually requires this before building 5 new GL flows for a feature that may never be used. If confirmed unneeded, this gap can be dropped entirely and the total scope shrinks from 9 gaps to 8.
2. **TPF settlement model (Gaps 1 & 6) — how big a change is acceptable?** Today a Tonik/Salmon/Skyro sale posts as if it were an immediate bank-type payment, not a receivable. Properly closing Gaps 1/6 means TPF sales should instead post to a partner-specific receivable at sale time, cleared later when the partner actually pays out — this is a more structural change to how TPF sales post (affects an existing, already-partially-matching item, not just new code), and changes partner reconciliation reporting. Needs explicit sign-off before starting, since it touches a working (if imperfect) flow.
3. **CWT tax-closing (Gap 8 / spec row 11J) — in-app feature or stays manual?** Applying accumulated Creditable Withholding Tax against quarterly/annual Income Tax Payable is normally a step the accountant/CPA does directly in their own tax-filing tooling, not inside an operational ERP. Recommend confirming whether this genuinely needs to be built here, or whether it's intentionally left outside the app — building it is a real chunk of work for something that may only ever run 4 times a year and could stay a manual JE indefinitely.
4. **Build order**: the gaps below are numbered in priority/build order, not spec-row order — Gap 1 (settlement/clearing mechanism) is the highest-value single item regardless of how the other decisions land, since it's the root cause behind 5 of the 20 missing rows at once and directly fixes real, ongoing bank-reconciliation inaccuracy. The three decision-gated items above (Retention, TPF settlement model, CWT tax-closing) are pushed to the end of the list — Gaps 7-9 — since none of them should start before their open question is resolved.

## Closing the gaps

### 1. Nothing ever clears the POS payment-clearing accounts, and there's no "unidentified bank credit" suspense

**Problem**: this is the single largest and most consequential gap, touching five spec rows at once. Card, e-wallet, bank-transfer, and TPF sales all correctly post their _sale-time_ debit into a dedicated clearing account (spec rows 13C/13D territory) — but **nothing ever credits/clears any of them**. A card sale posts to "Credit Card Receivable Clearing" and stays there forever; nothing represents the moment the acquirer actually pays out to the bank. Same for online bank transfers, and same for TPF partner settlements (row 12B) — TPF today posts as an immediate bank-type debit specifically because there's no settlement step to defer to (see Decision 2). Separately, when an unexplained credit shows up on a bank statement with no matching sale at all, there's no "Unidentified Bank Credits" suspense account to park it in (rows 13E/12C) — the existing bank reconciliation screen only tracks statement-vs-system balance, it doesn't post anything.

**Fix**: build one general settlement/clearing mechanism rather than three one-off fixes: a "record settlement" action per clearing account (card batch, e-wallet batch, bank-transfer batch, TPF partner) that debits Cash in Bank and credits the specific clearing account for a matched amount, plus a generic "Unidentified Bank Credits" account + a "post unmatched deposit, reclassify later once identified" flow for anything that doesn't match a known clearing balance. This is the natural home for closing the two already-partial cashier-close rows (13A/13B) too, though those are out of this doc's scope.

**Status**: not started — start here

### 2. E-wallet payments silently fall back to a cash/bank account

**Problem**: the `POS_EWALLET` mapping key and a dedicated "E-Wallet Receivable Clearing" account both exist in the chart of accounts, but the account is shipped **unmapped** by default (`coa-seed.service.ts:33-35,102-109`). Until an admin manually maps it, `getPaymentMethodAccountId()` (`pos-posting.service.ts:196-218`) silently falls through to the generic cash/bank account — exactly the "different payment modes collapsing into one account" problem the client's spec explicitly calls out as wrong. This is a real, live risk today, not just a documentation gap — any tenant that hasn't manually configured this mapping is already misposting every GCash/Maya/e-wallet sale.

**Fix**: seed a real default mapping for `POS_EWALLET` (same pattern as `POS_CARD`/`POS_BANK_TRANSFER`, which are correctly pre-mapped), so e-wallet sales post to their own clearing account out of the box, with the admin mapping screen still available to override it per tenant.

**Status**: not started

### 3. Cash shortage/overage at cashier close is computed but never posted

**Problem**: the session-close code already computes the variance between expected and actual cash (`sessions.service.ts:219-227`) but the code comment confirms it's "never itself posted to the GL (no 'Cash Over/Short' account)." A "Cash Over" account exists in the seeded chart of accounts (`coa-seed.service.ts:441-446`) but has no mapping key and is never referenced anywhere — so today, a cashier can close a session ₱500 short or over and nothing is recorded in the GL at all; it's silently discarded.

**Fix**: add `CASH_SHORTAGE_EXPENSE`/`CASH_OVER_INCOME` mapping keys, wire the existing computed variance into an actual posting at session close (Dr Cash Shortage Expense or Cr Cash Over Income, per the spec), gated behind the approval step the spec calls for.

**Status**: not started

### 4. No "Unapplied Customer Collections" suspense account

**Problem**: the spec has a specific scenario — a collector receives a payment from a known customer, but which invoice/contract it applies to isn't decided yet — that should park the cash in a suspense liability account rather than block the transaction. Today, `recordPaymentCore` (`ar-invoices.service.ts`) always requires an existing `ARInvoice` id up front; there is no mapping key, account, or code path for "collected, not yet applied." A collector in this situation currently has no correct way to record the cash at all.

**Fix**: add an `UNAPPLIED_CUSTOMER_COLLECTIONS` mapping key + account, and a new "record unapplied collection" action (Dr Cash / Cr Unapplied Collections) plus a later "apply to invoice" action (Dr Unapplied Collections / Cr AR) that reclasses it once the right invoice is known — same shape as the existing `CustomerAdvance` record/apply pattern already used for pre-sale deposits (`customer-advances.service.ts`), which this can largely mirror.

**Status**: not started

### 5. CWT/2307 lifecycle has no reconciliation, no customer tagging, and no variance workflow

**Problem**: three related pieces of the withholding-tax lifecycle are entirely absent:

- **No certificate reconciliation** (spec row 11F): once a `pending` withholding certificate's BIR Form 2307 actually arrives, nothing updates `ARPayment.withholdingCertificateStatus` from `pending` to `received` — no endpoint does this today.
- **No customer WTax tagging** (spec row 11H): the `Customer` model has no field marking a customer as subject to withholding (only `taxId`/`isTaxExempt`/`taxExemptionRef` exist, `schema.prisma:4799-4801`) — so there's no way to flag "this customer should be withholding but didn't," which the spec treats as a follow-up exception.
- **No variance workflow** (spec row 11I): if a received 2307 certificate's amount doesn't match what was expected, the spec requires routing to an approval/review step rather than silently adjusting — no such workflow exists anywhere.

**Fix**: add a `withholdingTaxTag` (or similar) flag + default rate/ATC to the Customer model; add a "mark certificate received" action on an `ARPayment` with pending status; add a lightweight variance-flag + reviewer-approval step when a certificate amount is recorded against a payment that doesn't match the expected withheld amount.

**Status**: not started

### 6. TPF sale returns have no partner-aware logic

**Problem**: spec row 14C requires a TPF-financed sale return to behave differently depending on whether the partner has already settled that sale or not (reduce partner AR if unsettled; use a payable-to-partner if already paid and money must be clawed back). Today a TPF return just falls through the same generic cash-refund path as any other sale, because TPF isn't tracked as a partner-specific receivable in the first place (see Gap 1 / Decision 2).

**Fix**: depends on Gap 1 landing first (a real partner-specific AR to check the settlement status of). Once that exists, branch the existing return flow: reduce the open partner AR if unsettled, or post a "Due to [Partner]" payable if that sale was already settled to NIG.

**Status**: not started — blocked on Gap 1

### 7. No "verified vs. unverified" bank-transfer distinction at POS

**Problem**: the spec draws a hard line between a bank-transfer sale where the credit is already confirmed at the register (posts directly to Cash in Bank) and one where it isn't (posts to a clearing account pending later verification). The current system has only one path — every bank-transfer sale always posts to the clearing account (`pos-posting.service.ts:49-64`), with no `verified`/`pending` concept anywhere in the schema. In practice this means the system is always conservative (never wrong), but never lets a cashier record an already-confirmed transfer as immediately-cleared cash either.

**Fix**: needs the Decisions section resolved first — specifically, confirm this distinction is actually wanted operationally (does a cashier ever have same-second bank confirmation at the register in practice?) before adding a toggle/flag to the bank-transfer payment flow. If confirmed, add a "verified at register" flag that routes to Cash in Bank directly instead of the clearing account.

**Status**: not started — pending confirmation this is operationally real, not just theoretical per the spec

### 8. CWT is never applied against Income Tax Payable at tax closing

**Problem**: spec row 11J describes a periodic (quarterly/annual) step where accumulated Creditable Withholding Tax is applied as a credit against Income Tax Payable. `src/accounting/tax/tax.service.ts` has no logic for this at all — the CWT asset balance just accumulates with no in-app way to consume it.

**Fix**: pending the Decisions section — if confirmed needed, add a tax-closing action (Dr Income Tax Payable / Cr Creditable Withholding Tax, + Cr Cash for any remainder due) scoped to a fiscal period, likely living alongside the existing Fiscal Periods module.

**Status**: not started — pending confirmation this belongs in-app at all

### 9. Customer Retention is entirely unbuilt (5 spec rows)

**Problem**: spec rows 11K-11O describe a full contractual-retention-receivable lifecycle — split an invoice into collectible-now vs. retained-until-milestone portions, collect the retained portion later, offset it against a claim, or write it off as doubtful. None of this exists: no `Retention Receivable` account, no retention % / amount / release-milestone fields on any invoice or contract model, no retention-specific report.

**Fix**: pending the Decisions section. If confirmed needed: add retention fields to the AR invoice model (retention %, retention amount, release milestone/date), a `RETENTION_RECEIVABLE` mapping key, and four new actions (invoice-with-retention, retention release, retention offset, retention write-off) mirroring the standard AR-invoice/credit-memo patterns already in the codebase.

**Status**: not started — pending confirmation this feature is actually used by any real NIG customer contract

## Verification (once implemented)

Expect a mix of: new backend e2e coverage per gap (JE balance assertions for each new posting path, a real e-wallet sale posting to its own account out of the box, an unapplied collection correctly reclassifying once matched), and manual click-through passes wherever a new UI surface is added (Unapplied Collections queue, CWT certificate/variance review, clearing-account settlement screen, cashier close variance approval). Gap 1 in particular should get a dedicated reconciliation check — the sum of all open clearing-account balances plus Unidentified Bank Credits should always tie back to (bank statement balance − confirmed deposits), similar in spirit to the existing `reconcileArSubledger` check.

## Implementation Log — 2026-08-24

**For this scenario, I have done:**

- **Part 1 (Gap 1)** — new `ClearingSettlement` model + `bank-accounts.service.ts`'s `recordClearingSettlement()`: a "Settle Clearing Account" action per clearing account (card/e-wallet/bank-transfer batch, TPF partner) that debits Cash in Bank and credits the matched clearing balance, plus an `UNIDENTIFIED_BANK_CREDITS` suspense account and a reclassify flow for statement credits with no matching sale. TPF sales were re-pointed from an immediate bank-type debit to a real partner-specific receivable (`TpfProvider.glAccountId` override, falling back to a shared TPF receivable mapping) as part of the same change, since the settlement mechanism needed something real to clear against. Frontend: Accounting → Bank Reconciliation gained "Settle Clearing Account"/"Unidentified Credit" record+reclassify actions. Backend `90bad29`, frontend `449bfb0`. Covered by `test/bank-clearing-settlements.e2e-spec.ts`.
- **Part 2 (Gap 2)** — `POS_EWALLET` moved off `coa-seed.service.ts`'s unmapped-placeholder list and given a real default account (same pattern as `POS_CARD`/`POS_BANK_TRANSFER`), so e-wallet sales post to their own clearing account out of the box instead of silently falling back to generic cash. Covered by `test/coa-seed.e2e-spec.ts`.
- **Part 3 (Gap 3)** — new `CASH_SHORTAGE_EXPENSE`/`CASH_OVER_INCOME` mapping keys; `sessions.service.ts`'s session-close now requires manager PIN approval (same UX as the existing discount/price-override gate) whenever declared cash doesn't match expected, and posts a real Dr Cash Shortage Expense / Cr Cash Over Income entry instead of discarding the variance. Frontend: POS session close shows a manager-approval panel (search + PIN, mirroring the handover flow) when the count doesn't match. Covered by `sessions.service.spec.ts` + e2e.
- **Part 4 (Gap 4)** — new `UNAPPLIED_CUSTOMER_COLLECTIONS` mapping key/account and a new `unapplied-collections` module (controller/service/DTO) mirroring `CustomerAdvance`'s record/apply-later shape — a collector can record a payment from a known customer before the target invoice is decided (Dr Cash / Cr Unapplied Collections), then apply it to a real invoice once known (Dr Unapplied Collections / Cr AR), or refund it. Frontend: new Accounting → Unapplied Collections page. Covered by `test/unapplied-collections.e2e-spec.ts`.
- **Part 5 (Gap 5)** — `Customer` gained `isWithholdingAgent`/`defaultWithholdingRate`/`defaultWithholdingAtc` (Accounting → Customers only — a tax-agent designation, not a CRM concept, so CRM's own customer form was deliberately left untouched); `ARPayment.withholdingCertificateStatus` gained a "mark certificate received" action plus a variance-flag + reviewer-approval step when a received 2307's amount doesn't match the expected withheld amount. Migration `20260824022649_scenario38_wht_reconciliation_and_customer_tagging`. 10/10 e2e in `test/withholding-reconciliation.e2e-spec.ts`.
- **Part 6 (Gap 6)** — new `TpfSettlementApplication` model links a `ClearingSettlement` batch to the specific `PosTransaction`s it covers, applied FIFO-oldest-unsettled-first (`bank-accounts.service.ts`'s `applyTpfSettlementFifo()`); `TpfProvider` gained `payableAccountId` for the claw-back-payable override. A TPF return now checks whether the original sale was already settled and either reduces the open partner receivable (unsettled) or posts a payable-to-partner claw-back (settled), via `pos-posting.service.ts`'s new `postTpfAwareFullReversal()`. Migration `20260824032943_scenario38_tpf_settlement_applications`. 4/4 e2e in `test/pos-tpf-sale-returns.e2e-spec.ts`.
- **Part 7 (Gap 7)** — confirmed operationally real and wanted. `PosPayment.bankTransferVerifiedAtRegister` boolean — when set, a bank-transfer sale posts straight to Cash in Bank instead of the usual Online Bank Transfer Clearing Account. Frontend: a checkbox on POS checkout's bank-transfer sub-mode, shown only when that mode is active. Migration `20260824053700_scenario38_bank_transfer_verified_at_register`. 3/3 e2e in `test/pos-bank-transfer-verified.e2e-spec.ts`.

**Gaps 8 (CWT tax-closing) and 9 (Customer Retention) were not built** — per the Decisions section, neither had a confirmed business need, and that was never resolved during this run, so both stayed out of scope entirely.

**Worth flagging:**

- Part 6 surfaced a real, pre-existing bug not caused by this scenario: TPF sales were posting **zero GL entries** at sale time. `postSaleJEFromPayments()` was only ever reachable from `addPayment()`, whose combined-tender threshold gate structurally excluded TPF amounts. Fixed by adding a dedicated TPF sale-time posting path in `transactions.service.ts`'s `create()`.
- Part 5's live-testing follow-up: the Accounting → Customers form's Address field was a plain textarea and Phone had no area code, unlike CRM's own customer form. Fixed by wiring in the same `PhilippineAddressPicker`/`react-phone-number-input` components CRM already used, plus a `barangayCode` field added to the Accounting customer DTO/model to support the picker.
- Found and fixed live during developer testing, outside the original 9 gaps: **POS-sourced Journal Entries never carried a `branchId`** (screenshot showed "Tenant-wide" on an Antique-branch sale) — `JournalPostingService.post()` already supported branch tagging, but `pos-posting.service.ts`/`transactions.service.ts` never passed it through on any of ~9 call sites. Highest-leverage fix was `JournalPostingService.reverse()` now forwarding the original JE's own `branchId`, which auto-fixes every downstream reversal path (POS void, TPF full-reversal) without touching those call sites individually. Covered by `test/pos-je-branch-tagging.e2e-spec.ts`.
- Also found and fixed live: POS checkout's confirm button silently disabled itself with no indication of what was missing. Reworked so the button stays clickable in every state except truly non-actionable ones (`submitting || cart.length === 0 || !sessionId`) — every other missing-requirement case now sets a specific error via the existing red-banner `setError` mechanism instead. This surfaced a second bug: the financing-term/credit-application/down-payment validation checks in `handleConfirm()` were wrongly scanning **all** installment lines including TPF ones (which have no financing term or credit application by design) — narrowed to `inhouseInstallmentCartLines` only.
- A suspected stale-session-selection race in the POS branch switcher (React Query's `keepPreviousData` on `useSessions()` could leave a wrong-branch session silently selected after a branch switch) — the auto-select effect now also invalidates the selection when the selected session's own branch no longer matches the switcher's branch, not just when the session id itself disappears from the list. Not independently confirmed fixed by the developer yet.
- Deferred, not decided: the POS checkout payment-method dropdown (Cash/Card/Gift Card/Store Credit/Loyalty Points/Bank Transfer/QR) was flagged live as showing methods the developer didn't expect. Confirmed via direct DB query this reflects genuinely-configured tenant-wide payment settings, not a bug. Scoping question (should the extra methods be removed from checkout entirely, or stay reachable another way) is still open — developer explicitly deferred it rather than deciding on the spot.

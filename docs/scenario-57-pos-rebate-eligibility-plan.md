# Scenario 57 — "Eligible for Rebate" Option at POS Checkout Payment — Gap Analysis & Closing Plan

Source: client request, 2026-09-21 — "POS → Payment: Add option for 'eligible for rebate'." One line, no further spec; the interpretation below is this doc's own reading and is **not yet confirmed** — see Open Questions.

## Related ClickUp Tickets

Not checked this pass — run a `clickup_search` for "rebate" / "eligible" before implementation.

## Related docs

- `scenario-26-collections-rebate-plan.md` — made the rebate (PPD) actually applicable at collection time, capped server-side. This scenario gates that same mechanism; it doesn't build a new one.
- `scenario-54-collections-simulated-late-payment-plan.md` — made the rebate checkbox-driven per due and forfeited on late payment. Eligibility becomes a third condition next to "paid in full" and "paid on time".
- `scenario-15-price-list-management-plan.md` — where `InstallmentAccount.ppd` comes from (7.5%-of-MI formula, or a curated `PriceListItemTerm.ppd`).
- `scenario-32-customer-ledger-installment-contract-plan.md` — established the "captured at POS checkout, copied onto the contract" pattern (`priceUseTypeId`, `sellingAgentId`) this scenario follows.

## The scenario we're building toward

A cashier rings up an **in-house installment** sale:

1. In the checkout's Payment Mode area (Installment selected), there's an **"Eligible for rebate"** option.
2. The cashier decides whether this contract earns a Prompt Payment Discount (e.g. a promo or discounted-price sale might be excluded).
3. That decision is stored on the installment contract created at checkout.
4. At collection time (POS Collections, CRM Record payment), an ineligible contract shows no rebate: no pre-checked Rebate box and no suggested amount. The backend rejects any rebate on it, regardless of what the client sends.
5. The ledger, Customer 360 and the AR invoice show "Not eligible" instead of a PPD figure a collector might try to honor by hand.

**Result**: today every POS installment contract earns PPD automatically. After this, earning PPD is a decision made once, at the sale, and enforced everywhere the rebate can be applied.

## What's already done ✅

1. **The rebate mechanism is complete** (Scenarios 26 + 54): PPD is computed and stored per contract (`InstallmentAccount.ppd`), applied at collection per whole due settled, forfeited on late payment, capped server-side in both payment paths, and posted as its own GL line (`Dr SALES_DISCOUNT`).
2. **The checkout → contract carry-over pattern exists**: `createLinkedInstallmentAccount()` (`backend/src/pos/transactions.service.ts:4214`) already copies checkout-time fields (`priceUseTypeId`, `sellingAgentId`, `totalMonthlyIncome`, `ppdOverride`) onto the new `InstallmentAccount`.
3. **Both server-side rebate caps are in one place each**, which makes a single extra guard enough:
   - `ArInvoicesService.recordPayment()` — `ar-invoices.service.ts` (~line 1535, the `if (rebate > 0)` block)
   - `InstallmentAccountService.recordPayment()` — `installment-account.service.ts` (~line 2364, `rebateCap`)

## What's not done / gaps ❌⚠️

1. **No eligibility concept exists anywhere.** Nothing in the schema, DTOs or UI can mark a contract as not earning PPD. Every POS installment contract gets a non-zero `ppd`, and every on-time full due pre-checks the Rebate box at collection.
2. **The checkout Payment Mode area has no place for it.** With Installment selected, it shows the per-group term/down-payment rows, TPF fields and the Down Payment method toggle (`pos/checkout/page.tsx` ~4143–4520). There's no rebate-related control, and PPD isn't shown at checkout at all.
3. **Collections suggests a rebate unconditionally.** `dueSuggestions()` in `CollectionsScreen.tsx` (~line 230) only checks for a linked account and whether the due is late. CRM's `RecordPaymentModal` gets `suggestedRebate={Number(account.ppd)}` straight from `InstallmentAccountDetail.tsx:836`.
4. **Read-only PPD displays would mislead on an ineligible contract.** Ledger (`InstallmentAccountDetail.tsx:537`), Customer 360's Installment Plan modal, and the AR invoice detail/print "Rebate on this due date" (`ar-invoices.service.ts:731`) would all keep showing a peso figure.

## Closing the gaps

Ordered by dependency. Each part is independently testable.

### Part 1 — Schema + backend enforcement

- `InstallmentAccount.rebateEligible Boolean @default(true)` + migration. Existing rows backfill to `true`, so current behavior doesn't change.
- `PosTransaction.rebateEligible Boolean?`, following the `sellingAgentId` precedent: the sale records what the cashier chose, and the contract copies it. Null for non-installment sales.
- `CreateTransactionDto.rebateEligible?: boolean`, persisted on the transaction and copied in `createLinkedInstallmentAccount()`. Omitted → `true` (backwards-compatible for any caller that doesn't send it).
- **Keep `ppd` computed and stored as-is.** Don't zero it out. The eligibility flag gates it, so the figure survives if the flag is later flipped (Open Question 3) and reporting can still show "PPD forgone".
- Guards in both payment paths: `rebate > 0 && !account.rebateEligible` → `400 rebate_not_eligible`, checked before the existing cap logic.
- Expose `rebateEligible` wherever `ppd` is already selected: `pos-customers.service.ts:173` (Collections), `InstallmentAccountService.findOne`, and the AR invoice installment detail.

### Part 2 — Checkout UI

- An "Eligible for rebate" toggle in the Payment Mode block, shown only when `paymentMode === 'installment'` and the sale is **in-house** (not TPF / card installment, which never create an `InstallmentAccount`). It sits beside the Down Payment method toggle and uses the same segmented Yes/No style for consistency.
- Default follows Open Question 1, and the choice resets when the cart is cleared or Payment Mode changes.
- Sent as `rebateEligible` in the create-transaction payload. It is shown on the transaction detail (`TransactionDetail.tsx`) so a supervisor can see what was chosen.

### Part 3 — Collections + read-only displays

- `dueSuggestions()`: an ineligible account → `suggestedRebate: null` (same as "no linked account"). The Rebate checkbox is hidden or disabled with a "Not eligible for rebate" hint, and the amount default doesn't net any rebate off.
- `RecordPaymentModal`: `suggestedRebate = rebateEligible ? ppd : 0`, and the Rebate field is disabled with the same hint.
- Ledger, Customer 360 and the AR invoice detail/print show "Not eligible" in place of the PPD figure.
- Map `rebate_not_eligible` to a readable message in `CollectionsScreen.tsx`'s error map (~line 203).

### Part 4 (conditional on Open Question 3) — Change eligibility after the sale

- A permission-gated toggle on the installment account detail, with a required reason, audit-logged. This part is skipped if the answer is "fixed at checkout".

## Open questions requiring developer/business confirmation

1. **Default state.** Should the toggle start **on** (matches today's behavior; the cashier opts a sale _out_) or **off** (the cashier must consciously grant it)? _Recommended: on._ Existing behavior stays the default and nothing breaks for cashiers who ignore the new control.
2. **Granularity.** One choice per **transaction** or per **installment group/item**? A cart can produce several contracts when items have different terms. _Recommended: per transaction._ It matches "Payment Mode is one choice for the whole cart", and a mixed cart can be split, same as mixed payment modes.
3. **Editable after the sale?** Fixed at checkout, or changeable later on the contract (and by whom)? _Recommended: fixed for now._ Part 4 only gets built if the client asks for it.
4. **Who decides?** Any cashier, or should an ineligible→eligible choice (or the reverse) need supervisor approval like price overrides? _Recommended: any cashier, no approval._ This is consistent with Scenario 26's "no approval gate on rebates".
5. **Is it really a checkout decision?** The client may instead mean something driven by the **price list / price use type** (e.g. promo price → never eligible) or by the **credit application**. If so, the flag belongs on `PriceUseType` / `CreditApplication` and checkout would only display it. This is worth one confirming question to the client before Part 1.
6. **Hand-entered CRM accounts.** Should the CRM "New installment account" form get the same flag? _Recommended: yes, same field, default on._ It's cheap once the column exists.

## Testing plan

- **Backend e2e** (`test/pos-rebate-eligibility.e2e-spec.ts`): the checkout flag persists on the transaction and the contract; omitted → `true`; rebate on an ineligible contract → `400 rebate_not_eligible` in **both** payment paths; rebate on an eligible contract is unchanged (regression check against `collections-payment-rebate.e2e-spec.ts`).
- **Frontend Playwright** (`e2e/pos-rebate-eligibility.spec.ts`): the toggle is visible only for in-house installment; turning it off at checkout → Collections shows no rebate for that account's dues; turning it on → unchanged rebate pre-check.
- **Regression**: `pos-collections-rebate.spec.ts`, `crm-collectors-installment-accounts.spec.ts`, the checkout installment specs.

## Implementation Log — 2026-09-21

Branch `feat/scenario-57-rebate-eligibility` in both repos, uncommitted. Open questions resolved with the developer before any code: (1) default **on**; (2) **per transaction**; (3) **editable after the sale** by anyone holding `crm:installment-accounts:update` (so Part 4 was built, with no separate reason field — the existing PATCH audit log records the change); (4) **no approval**; (5) **cashier decides at checkout** — not driven by price list or credit application; (6) CRM New/Edit forms get the flag, **default on**.

**For this scenario, I have done:**

- **Part 1 — schema + backend enforcement.** Migration `20260921120000_scenario_57_rebate_eligible`: `PosTransaction.rebateEligible Boolean?` (null for sales with no in-house installment line) and `InstallmentAccount.rebateEligible Boolean @default(true)` (existing contracts keep earning PPD). `CreateTransactionDto.rebateEligible` persisted on the sale, carried through the release-form hold (the cart snapshot is the whole DTO, replayed on approve) and copied onto every contract in `createLinkedInstallmentAccount()`; omitted → `true`. `ppd` is still computed — the flag gates it, never zeroes it. Guard `rebate > 0 && !rebateEligible → 400 rebate_not_eligible` in `applySingleInvoicePayment()` (covers single, bulk and Pay Selected — all AR payments route through it) and in `InstallmentAccountService.recordPayment()`. Flag exposed on the schedules read Collections/Customer 360 share and on the AR invoice installment detail. `CreateInstallmentAccountDto` accepts it too.
- **Part 2 — checkout toggle.** "Eligible for rebate" Yes/No in checkout's Payment Mode block, beside the Down Payment toggle; shown only for in-house installment lines; defaults Yes; resets to Yes once no in-house installment line is left; sent only for in-house installment sales. Transaction detail shows "Eligible for Rebate: Yes/No" when set.
- **Part 3 — Collections + read-only displays.** `dueSuggestions()` takes eligibility: an ineligible contract suggests 0 and flags `rebateNotEligible`, so the Apply-rebate box never pre-checks; single-due view says "Not eligible for rebate on this plan.", Pay Selected's Rebate column says "not eligible". CRM `RecordPaymentModal` locks Rebate at 0 when ineligible (amount default no longer nets a rebate off). "Not eligible" replaces the peso figure on the contract detail's PPD row, Customer 360's Installment Plan "Rebate" row and the AR invoice's "Rebate on this due date". `rebate_not_eligible` mapped to readable text in both payment UIs.
- **Part 4 — change after the sale.** `update()` persists `rebateEligible`; the PATCH's existing before/after audit snapshot now includes it. Checkbox on the CRM Edit form (loaded from the account) and New form (checked by default).
- **Tests.** Backend: 8 new e2e — 6 in `collections-payment-rebate.e2e-spec.ts` (rejection on both payment paths, zero-rebate payment still settles, flag on the schedules read, PATCH revoke → rejected → audit old/new → restore → accepted, PATCH omitting the field leaves it alone) and 2 in `pos-installment-financing.e2e-spec.ts` (checkout `false` persists on transaction + contract with `ppd` still computed; omitted → `true`). Playwright: `pos-checkout-rebate-eligibility.spec.ts` (toggle visibility/default/reset) and `pos-collections-rebate-eligibility.spec.ts` (CRM detail + Record payment lock; Edit form revoke; New form default). All pass. Each part manually confirmed by the developer before the next.

**Worth flagging:**

- **Not committed.** Both repos, per the no-commit-without-go-ahead convention.
- **No automated UI test drives a full checkout submit or the Collections "not eligible" rendering.** The isolated test DB can't produce a POS installment sale through the UI: there is no WIP-priced stock at any branch, every priced item is serial-tracked with no serial stock, and credit applications now require a priced item. Adding a fixture would mean editing a live price list, which reverts it to pending approval for every other spec. Covered instead by backend e2e (transaction → approval replay → contract; both guards) plus developer manual testing.
- **Pre-existing test breakage found, not fixed (fails identically on clean `development`):**
  - Backend `collections-payment-rebate.e2e-spec.ts`: 3 FIFO due-order tests built on the legacy one-invoice-per-due fixture.
  - Backend `pos-installment-financing.e2e-spec.ts`: IF-03, IF-13, IF-16, IF-17, IF-18, IF-20.
  - Frontend `crm-collectors-installment-accounts.spec.ts` (NAMIDRe reminder auto-close) and `installment-account-customer-ledger.spec.ts` (POS-originated unit/scheme).
  - Frontend `pos-checkout-installment-*.spec.ts`, `pos-checkout-promissory-note.spec.ts`, `pos-collections-rebate.spec.ts`: search for a "Universal Remote Control" seed item that no longer exists, and expect a "Select session" dropdown that only renders with 2+ open sessions.
- **Local environment drift, handled without resets.** Dev and test DBs both carried three Scenario 56 migrations not on this branch and lacked `development`'s additive `20260918055401_credit_application_financing`. That migration and this scenario's were applied with `prisma db execute` + `migrate resolve --applied`; no reset, no data loss. `npm run test:e2e` and Playwright's `start:e2e` both run `prisma migrate reset --force` on the test DB, which Prisma blocks without explicit consent — specs were run with the same jest command minus the reset hook, and the e2e backend started manually on 3011 against the already-seeded test DB. Backend also needed `pnpm install --frozen-lockfile` for `jszip`.
- **Reporting not touched.** `ppd` is kept on ineligible contracts, so a "PPD forgone" report is possible later; nothing surfaces it today, and the Daily Collection PPD column reflects rebates actually applied, unchanged.

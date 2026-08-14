# Scenario 26 — Collections Rebate (Prompt Payment Discount) — Gap Analysis & Closing Plan

Source: developer-defined, 2026-08-10 — not sourced from either client PDF. Discovered live while answering a question about how the existing rebate figure could even be seen in the app, which surfaced that it was display-only — the developer then requested making it actually applicable at the moment of payment collection, not just shown for reference.

## Related ClickUp Tickets

Not checked this pass — recommend a quick `clickup_search` before further work, same as Scenarios 23-25.

## Related docs

- `scenario-15-price-list-management-plan.md` — where `InstallmentAccount.ppd` originates (7.5%-of-MI formula, or a curated `PriceListItemTerm.ppd` from NIG's real rate card).
- `scenario-23-transaction-invoice-lookup-plan.md` — Closing Gap 2 first surfaced `ppd` read-only in Customer360's Installment Plan modal.
- `scenario-25-ar-invoice-detail-view-plan.md` — extended that same read-only surfacing to the AR Invoice detail/print page ("Rebate on this due date").
- `scenario-11-collections-ar-aging-plan.md` — the Collector/InstallmentAccount collections module this scenario's two payment-collection screens belong to.

## The scenario we're building toward

A collector or cashier collects an installment due:

1. The system suggests the account's rebate (PPD), pre-filled and capped at its already-agreed value.
2. The collector can lower it (e.g. apply a smaller or no rebate) but never raise it above the cap.
3. The amount actually collected in cash, plus the rebate, together settle what's owed — accepting both defaults nets out exactly, never over-collecting.
4. The rebate posts to the general ledger as its own line, distinct from cash, so it's auditable — not just silently forgiven debt.

**Result**: PPD stops being a number that only ever gets displayed, and becomes something a collector can actually grant at the point of collection, with the same GL discipline as every other payment component (cash, withholding tax).

## What's already done ✅

1. **The rebate value itself is already correctly computed and stored** — `InstallmentAccount.ppd` (`schema.prisma`), either the 7.5%-of-MI formula or a curated NIG rate-card value (Scenario 15). Nothing about the number itself needed fixing.
2. **It's already displayed read-only in two places** — Customer360's Installment Plan modal and the AR Invoice detail/print page (Scenarios 23 & 25). Both keep working unchanged; this scenario doesn't touch either.
3. **The GL posting pattern to extend already exists** — `ArInvoicesService.recordPayment()` already posts a multi-line JE (Dr Cash, optionally Dr WHT Receivable, Cr AR) for withholding tax; a rebate line is structurally the same shape, not a new mechanism.

## What's not done / gaps ❌⚠️

1. **Neither payment-collection screen has any rebate input at all.** POS Collections' "Collect Payment" modal (`CollectPaymentModal` in `CollectionsScreen.tsx`) and CRM's "Record payment" modal (`RecordPaymentModal.tsx`) both only accepted amount/date/method/reference (plus branch/collector for POS) — no way to apply the rebate a collector can already see elsewhere in the app.
2. **No GL account for it.** `Sales Discount` (`4-01-090`) existed in the COA seed but had no `mappingKey` — nothing in code could post to it.
3. **The two payment paths turned out to be fully independent, not bridged.** `ArInvoicesService.recordPayment()` (GL-backed, POS Collections) and `InstallmentAccountService.recordPayment()` (CRM, always a direct no-GL `currentBalance` mutation) don't call into each other at all — confirmed by direct code read after an initial assumption (from research done before implementation started) that they were linked turned out to be wrong.
4. **`cancelPayment()`'s overpayment rollback only accounted for `amount + withholdingAmount`** — extending payments with a third component (rebate) without extending this too would leave `amountPaid` wrong after cancelling an overpaid, rebate-inclusive payment.

## Closing the gaps

Ordered by dependency.

### 1. GL wiring

**Fix**: add `SALES_DISCOUNT` to `MAPPING_KEYS` (`posting.service.ts`) and set it as the `mappingKey` on the existing `4-01-090 Sales Discount` seed row (`coa-seed.service.ts`) — same pattern `SALES_RETURNS_ALLOWANCES` already uses on the row above it.

### 2. `ArInvoicesService.recordPayment()` — the GL-backed path

**Fix**: add `rebateAmount?: number` to `RecordArPaymentDto`. Resolve the linked `InstallmentAccount.ppd` via the AR invoice → `InstallmentScheduleLine` → `InstallmentSchedule` → `InstallmentAccount` chain (same relation `findOne_installmentDetail()` already uses for the read-only display). Validate server-side: rebate on an invoice with no linked account → 400; rebate exceeding `ppd` → 400. `totalApplied = amount + wht + rebate`; add a third JE line (`Dr SALES_DISCOUNT`) only when `rebate > 0`, mirroring the WHT line exactly. Store `rebateAmount` on the `ARPayment` row (new column, migration).

### 3. `ArInvoicesService.cancelPayment()`

**Fix**: extend the overpayment rollback's `totalApplied` to include `payment.rebateAmount`, not just `amount + withholdingAmount`.

### 4. `InstallmentAccountService.recordPayment()` — the CRM, no-GL path

**Fix**: add the same optional `rebateAmount` to `RecordPaymentDto`, validate against `existing.ppd`, and reduce `currentBalance` by `dto.amount + rebate` instead of just `dto.amount` — no GL trace, consistent with this path's existing (pre-existing, unrelated) no-GL gap.

### 5. Frontend — both modals

**Fix**: add a "Rebate" field to `CollectPaymentModal` (POS Collections) and `RecordPaymentModal` (CRM), pre-filled to the suggested `ppd` and blocked client-side from exceeding it. Net the "Amount received"/"Amount" default against the suggested rebate so accepting both defaults settles the due exactly rather than over-collecting.

## Open questions requiring developer/business confirmation

All resolved with the developer before implementation started:

1. **Cap** — capped at the account's `ppd`, suggested as the default, collector can lower but not exceed it (server-enforced).
2. **Approval gate** — none. Self-serve, same trust level as collecting the payment amount itself, since `ppd` is already a system-computed, pre-agreed number.
3. **GL treatment** — a third line in the same payment JE (Dr Sales Discount / Cr AR), mirroring how withholding tax already works inline, not a separate memo document.
4. **Scope** — both entry points: POS Collections and CRM "Record payment" (the latter including hand-entered/no-GL accounts).
5. **Timing** — no on-time enforcement. Despite `ppd` standing for "Prompt Payment Discount," the developer deliberately chose to let a collector apply it regardless of whether the payment is actually on time, trusting their judgment rather than auto-blocking on a late payment date.

## Implementation Log — 2026-08-10

**For this scenario, I have done:**

- **Closing Gaps 1-4 (backend)** — `ARPayment.rebateAmount` column + migration; `SALES_DISCOUNT` GL mapping wired to the existing `4-01-090` account; `ArInvoicesService.recordPayment()` posts the third JE line and validates the cap server-side; `cancelPayment()`'s rollback fixed; `InstallmentAccountService.recordPayment()` validates and applies the rebate to `currentBalance` with no GL, matching its existing convention.
- **Closing Gap 5 (frontend)** — "Rebate" field added to both `CollectPaymentModal` and `RecordPaymentModal`, pre-filled and capped, with the "Amount" field's default netted against it.
- **A research correction found mid-implementation**: earlier investigation (done to answer the developer's original "how do I see rebate" question) had concluded `InstallmentAccountService.recordPayment()` delegated into `ArInvoicesService.recordPayment()` for POS-linked accounts, keeping both ledgers in sync. Direct code reading during implementation showed this was never true on this branch — the two payment paths are fully independent, with no bridging method at all. The plan was adjusted accordingly: no delegation to build on, so the CRM path's rebate logic is self-contained rather than routed through the AR-invoice path.
- **Three real bugs found and fixed via live testing, not just code review**:
  1. The "Amount received"/"Amount" field's default (full outstanding balance) and the new "Rebate" field's default (suggested `ppd`) weren't coordinated — accepting both defaults as-is would have over-collected (POS) or over-credited the balance (CRM) by double-counting the rebate. Fixed by netting the amount default against the suggested rebate in both modals.
  2. That netting produced floating-point noise (e.g. `50.949999999999996`) — fixed by rounding to 2 decimals.
  3. The real one: `InstallmentAccount.ppd` comes over the wire as a **string**, not a number (Prisma `Decimal` JSON serialization — the same known gotcha Scenario 15 already flagged for `downPayment`). `suggestedRebate + 0.01` was silently string-concatenating instead of adding, so the cap-exceeded check always evaluated to `NaN` and never actually blocked anything. Fixed with explicit `Number()` coercion at the point of use in `CollectionsScreen.tsx` (the CRM side already coerced correctly).
- **One pre-existing e2e test required updating**: `crm-collectors-installment-accounts.spec.ts`'s "records an on-time payment" test asserted an exact post-payment balance without touching the new Rebate field — since that field now defaults to a nonzero suggested value instead of empty, the test was silently submitting an unintended rebate. Fixed by explicitly zeroing the Rebate field in that test, preserving its original intent (on-time-payment scoring, unrelated to rebates).
- **Mid-session incident, unrelated to the feature design**: the backend's uncommitted changes were discarded partway through implementation (most likely a VS Code "Discard Changes" scoped to the backend workspace, confirmed via reflog + the fact the frontend workspace was untouched). Rebuilt from the same plan; the local dev database still had the migration applied and recorded, so only the local migration file needed recreating — no data loss, no destructive reset used.
- **Verification**: 6 new backend e2e tests (`test/collections-payment-rebate.e2e-spec.ts`) covering both payment paths, the cap, the no-linked-account rejection, and the cancel-rollback fix — all passing, no regressions across 120 AR/installment/price-list/collectors backend tests. 2 new frontend Playwright tests (`e2e/pos-collections-rebate.spec.ts`) covering the full pre-fill → cap-block → successful-post round trip — passing, no regressions across the CRM installment-accounts, AR invoice detail, and Customer360 suites (a handful of unrelated flaky failures reproduced identically in isolation against `main`, confirming they predate this work).

**Worth flagging:**

- Nothing has been committed — implementation, tests, and this doc are all still local, pending the developer's explicit go-ahead per this project's standing "no commit without a go signal" convention.
- The working tree also contains substantial unrelated, uncommitted work on Stock Transfers/UDS/Warehouses that this scenario's implementation never touched — flagged to the developer directly so it isn't lost or conflated with this change when committing.

## TO DO — Edge cases (manual verification pending)

Automated tests cover the core paths (within-cap rebate, cap exceeded, no-linked-account rejection, cancel rollback). The following are believed correct by design/code read, but haven't been manually clicked through yet:

- [ ] **Rebate left at 0** — clearing/zeroing the field should behave exactly like before this feature existed: no third JE line, no `SALES_DISCOUNT` posting, no behavior change at all versus the pre-rebate code path.
- [ ] **Overpayment interaction** — on POS Collections, if `amount + rebate` together exceed what's owed, it should still go through (not rejected) and get flagged as an overpayment exactly like today's amount-only overpayment flow, just now rebate-aware in the total.
- [ ] **Rebate on a non-installment (charge-mode) invoice** — should be rejected (`rebate_requires_installment_account`). Not reachable through the normal UI (POS Collections only ever shows installment customers), so this would only surface via direct API testing.

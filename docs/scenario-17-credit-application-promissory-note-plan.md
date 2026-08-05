# Scenario 17 — Credit Application, Investigation & Promissory Note — Gap Analysis & Closing Plan

Source: `NIG_ERP_Core_Operational_Scenarios_Draft_2_20260727.pdf`, row "5. Processing an installment sale from application to release." New scenario, mapped from this row (developer-confirmed as standalone rather than folded into Scenario 01).

**Relationship to Scenario 01**: Scenario 01 (POS Installment Sale, verified fully closed) covers checkout mechanics — term picker, MI calculation, multi-tender payment, manager approval gate, serial deduction, journal posting. This scenario covers what should happen _upstream_ of checkout: a formal credit application, investigation, and a signed-document release gate. Read Scenario 01's plan doc first — this one builds on top of it, not instead of it.

**Naming decision (confirmed with developer, 2026-07-31)**: the PDF's "Collector" performing Credit Investigation is a **distinct new role** from the app's existing `Collector` role (Scenario 11's post-sale collections/remittance role). Refer to this new role as **Credit Investigator** throughout — never reuse "Collector" for it, to avoid confusion with the existing collections persona.

**Also depends on**: Scenario 02's 2026-07-31 update (co-maker entity) — a Promissory Note under this scenario needs to reference a co-maker, which doesn't exist as an entity yet. Sequence accordingly.

## Related ClickUp Tickets

None found. Net-new scope.

## The scenario we're building toward

A customer requests NIG in-house financing:

1. Cashier opens one application and uploads documents (applicant/co-maker documents, income/expenses).
2. Credit Investigator performs CI and affordability/adjudication.
3. BM/Credit Approver reviews; exceptions escalate.
4. Cashier records approval/DP and generates the schedule and Promissory Note (PN).
5. Stock Custodian scans the serial and releases only after signed PN and delivery acceptance.
6. ERP posts the sale, AR contract, schedule, aging and reminder tasks.

**Result**: a complete approved contract links the customer, co-maker, documents and serial; incomplete releases are blocked.

## What's already done ✅

1. **The downstream half already works.** Once a sale posts, schedule generation, AR contract creation (`InstallmentAccount`), aging, and reminder-task hooks already fire correctly (Scenario 01 / Scenario 11).
2. **Serial-gated release + a manager-approval gate already exist.** `PosReleaseFormRequest` computes a `requestType` label including `'Application Form'` for credit sales (`backend/src/pos/release-form-requests.service.ts:256-270`); release is blocked without it.
3. **"Incomplete releases are blocked" already holds** for the existing gate — serial deduction only happens on a completed, approved sale.

## What's not done / gaps ❌⚠️

1. **No standalone `CreditApplication` entity.** `PosReleaseFormRequest` is a 1:1 status record tied to a `cartSnapshot`/`PosTransaction` created _during_ checkout — not something a customer can apply through before a sale/cart even exists.
2. **No document-upload model for applicant/co-maker income-expense documents.** Grepped both repos — only unrelated `SupplierDocument`, `UnitDocumentSheet`, `DocumentNumberingScheme` models exist.
3. **No Credit Investigation step or role.** No affordability/adjudication fields or records exist anywhere. Checked seeded roles (`prisma/seed.ts:2018-2162`): Business Owner, Branch Manager, Accountant, Stock Controller, Cashier, Sales Rep/Manager, CSR, Marketing Manager, Inventory, POS Operator, Queue Manager — no Credit Investigator, no Credit Approver.
4. **No Promissory Note entity.** No `PromissoryNote` model, no "promissory" hit anywhere, no `signature`/`signed` field on any POS/installment model, and no signature-gated release beyond the existing manager-approval gate.
5. **Depends on the not-yet-built co-maker entity** (Scenario 02's 2026-07-31 update) — a PN needs to reference one.

## Closing the gaps

Ordered by risk/value.

### 1. Confirm scope before building anything

**Problem**: this is a materially larger process than today's checkout-time approval — a full pre-sale underwriting flow with new actors and documents.
**Fix**: confirm with the business whether every installment sale needs this full formal-application flow, or only above a peso threshold / for new-to-credit customers. This changes scope significantly and is a product decision, not an engineering one.

### 2. Add `CreditApplication` entity

**Problem**: no way to represent a credit application as its own pre-sale record.
**Fix**: applicant + co-maker references, uploaded documents, status — linked forward to the `PosTransaction` once approved and a sale is actually rung up.

### 3. Add Credit Investigator role + CI/adjudication record

**Problem**: no one and nothing performs or records a formal affordability check today.
**Fix**: new `Credit Investigator` permission (per the naming decision above — never reuse `Collector`), plus a CI/adjudication record (affordability outcome, notes) attached to the application.

### 4. Add Promissory Note generation + signature gate

**Problem**: no signed document exists to gate release on.
**Fix**: mirror the existing RFD printable-HTML pattern from Scenario 01 (`ReleaseApprovalsList.tsx`'s `handlePrint()`) rather than introducing a new PDF library. Add a signed flag that gates release _alongside_ the existing manager-approval gate, not as a replacement for it.

### 5. Sequencing

**Problem**: this scenario's application and PN both need a co-maker reference.
**Fix**: do not start Closing Gaps 2-4 until Scenario 02's co-maker entity exists.

## Dead code / unused-feature flags

None found.

## Implementation Log — 2026-08-05

**For this scenario, I have done:**

- Closing gap #1 (scope confirmation): every installment sale requires the full formal credit-application flow — no peso threshold, no new-customer-only carve-out (developer-confirmed).
- Closing gap #2 (`CreditApplication` entity), split into three parts:
  - Part 1: `CreditApplication` model/migration/CRUD/permissions, `PosTransaction.creditApplicationId`-style forward link scaffolding.
  - Part 2: `CreditApplicationDocument` model + upload UI (applicant/co-maker ID, income/expense proof).
  - Part 3: Cashier intake UI (`/credit/applications`) — applicant + co-maker selection, document upload, submit gate.
- Closing gap #3 (Credit Investigator role + CI/adjudication record), split into two parts:
  - Part 4: `Credit Investigator` role + `CreditInvestigation` model (affordability outcome, notes) — distinct from the existing `Collector` role per the 2026-07-31 naming decision.
  - Part 5: BM/Credit Approver review UI — the existing Branch Manager role with a new `credit:application:approve` permission, not a new role (developer-confirmed).
- Bridging step (not its own gap item, but required to connect gap #2 to the scenario's actual sale): Part 6 — POS checkout now requires an approved, unconsumed `CreditApplication` for every installment sale; `CreditApplication.posTransactionId` is set once consumed.
- Closing gap #4 (Promissory Note generation + signature gate): Part 7 — `PromissoryNote` model generated when an installment sale is submitted for release (mirrors the RFD printable-HTML pattern, no new PDF library); `signedAt`/`signedById` gate release in `ReleaseFormRequestsService.approve()` alongside the existing manager-approval gate. Signing is Cashier-level (developer-confirmed 2026-08-05, over Branch-Manager-only), cascading to Branch Manager/Business Owner.
- Closing gap #5 (sequencing): confirmed Scenario 02's co-maker entity existed before starting gap #2/#4 work.

**Worth flagging:**

- `CreditApplication` has no `financingTermId`/requested-term field — the Promissory Note's term/schedule is captured from the checkout DTO at RFD-submit time, not from the application itself. If a future scenario needs the applicant to request specific terms up front, that'd be a new field on `CreditApplication`.
- The Promissory Note signature gate only applies within the hold+approve (RFD) flow — an actor who already holds `pos:transaction:override` self-approves and bypasses it, same carve-out the existing manager-approval gate already has. Consistent, not a new loophole.
- `docs/seed-data-reference.md` was out of date on role/account counts (16 accounts documented vs 22 actually seeded) — corrected this run alongside the Credit Investigator additions.
- Discovered and fixed unrelated pre-existing gaps during manual testing: zero `FinancingTerm` rows existed anywhere in the seed (any installment sale would have hit this, not just this scenario's); a three-layer sidebar-visibility bug hid the Credit module from non-owner roles (backend `PERMISSION_MODULE_TO_NAV` map, tenant `enabledModules`, two super-admin module-toggle checklists).
- Flagged but did not fix (out of scope): `pos-checkout-multi-serial-cart.spec.ts` and `pos-release-form-request.e2e-spec.ts` have pre-existing failures unrelated to this scenario (a stale-session serial-picker issue and a July 28 commit requiring a customer on every sale, respectively).

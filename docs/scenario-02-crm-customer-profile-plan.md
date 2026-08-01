# Scenario 02 — CRM (Customer Profile) — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "CRM — documenting a customer before the sale."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3abzf7](https://app.clickup.com/t/86d3abzf7) — "AA Cashier, ISBAT create a walk-in customer profile" — _Sprint 3, for qa_
- [86d3aat2z](https://app.clickup.com/t/86d3aat2z) — "AA Sales Rep, ISBAT create and manage customer profiles" — _Sprint 3, done_
- [86d3d19qn](https://app.clickup.com/t/86d3d19qn) — "AA Cashier, ISBAT be warned of a potential duplicate when adding a new customer" — _Sprint 3, to do_
- [86d3aat8g](https://app.clickup.com/t/86d3aat8g) — "AA Sales Rep, ISBAT view a customer 360 view with interactions, reminders, and leads" — _Sprint 3, done_
- [86d3aat7v](https://app.clickup.com/t/86d3aat7v) — "AA Sales Manager, ISBAT create rule-based customer segments" — _Sprint 3, in progress_ — relates to Gap "marketing retargeting is list-building only, not campaigns"
- [86d3an2je](https://app.clickup.com/t/86d3an2je) — "AA Sales Manager, ISBAT export a customer segment to CSV" — _Sprint 3, to do_
- [86d3592k2](https://app.clickup.com/t/86d3592k2) — "AA Cashier, ISBAT send a digital receipt to the customer via email or SMS" — _Sprint 3, in review_ — closest ticket to the "Smart SMS" gap, but scoped to receipts specifically, not general customer SMS updates
- [86d3phfya](https://app.clickup.com/t/86d3phfya) — "AA Business Owner, ISBAT have POS and Accounting read the same customer record CRM already keeps, so a customer is never re-entered and their credit terms actually apply" — _Sprint 4, for qa_
- [86d3phg78](https://app.clickup.com/t/86d3phg78) / [86d3phg6t](https://app.clickup.com/t/86d3phg6t) — "ISBAT set payment terms per customer, enforced at POS" (Business Owner / Branch Manager) — _Sprint 4, for qa_ — relates to the credit-terms/limit gap
- [86d39pefx](https://app.clickup.com/t/86d39pefx) — "AA Accountant, ISBAT set payment terms per customer (Net 30, Net 60, COD, custom)" — _Sprint 4, for qa_

**Not found in Sprint 3-5:** No ticket for the 3-value `customerType` split (Individual / B2B Private / B2B Government), no ticket for a family/group ID field, no ticket for auto-enrolling loyalty at customer creation specifically.

## The scenario we're building toward

A new customer is entered before they decide to buy:

1. Capture the profile: name, email, barangay (city/province), customer type (Individual / B2B Private / B2B Government), family/group ID, status — no purchase required.
2. Loyalty points enrolled; Smart SMS available for updates.
3. If they buy, POS pulls this profile; if not, it stays for marketing retargeting.
4. On a sale, Cash → Digital RFD, Credit → Application Form + RFD, carrying profile data.
5. Installment terms up to 12 months; no hard credit limit (credit is per-unit/terms-based).

## What's already done ✅

1. Name/email capture (`backend/src/crm/customer/customer.dto.ts:40-77`).
2. Barangay/city/province capture via `PhilippineAddressPicker.tsx` (`frontend/src/components/common/PhilippineAddressPicker.tsx:1-174`).
3. "No purchase required" is a real, deliberate product decision, not an accident — the create form's own copy says so (`NewCustomerForm.tsx:117`: "Create a customer profile — no sale required").
4. `status` field exists in schema/DTO (`customer.dto.ts:118-124`) and is editable post-creation (`EditCustomerForm.tsx:283-286`).
5. **No hard credit limit — CONFIRMED, matches the scenario.** `Customer.creditLimit` exists (`schema.prisma:3252`, `customer.dto.ts:103-108`) but `computeCreditWarnings()` is explicitly advisory-only: "A charge sale is never blocked here... the manager reviewing it sees these warnings to decide whether to approve" (`transactions.service.ts:73-78`), never enforced as a hard cap (`:1664-1682`). Installment term months are admin-configurable with no 12-month ceiling in code (`financing-terms.service.ts:24-38`, `pos.dto.ts:1561-1564` — just `@IsPositive()`/`@IsInt()`).
6. A real `CustomerSegment` feature exists for building non-purchasing-customer lists by type/source/status (`backend/src/crm/customer-segment/customer-segment.service.ts`).

## What's not done / gaps ❌⚠️

1. **`customerType` is 2-value, not the specified 3-value enum.** Schema enum is only `individual | business` (`schema.prisma:3185-3188`); frontend hardcodes the same 2 options (`NewCustomerForm.tsx:143-146`). The scenario wants Individual / B2B Private / B2B Government — B2B isn't split into Private vs. Government anywhere.
2. **No family/group ID field exists anywhere** — confirmed by grep across schema, DTOs, and every customer form.
3. **Address is flattened free text, not structured.** `PhilippineAddressPicker` output is written into a single `shippingAddress` string, not separate barangay/city/province columns — fine for display, but not filterable/reportable by barangay or city.
4. **`status` is not exposed on the create form**, only on edit (`NewCustomerForm.tsx` has no status field) — every customer is created with whatever the default is, and status must be set in a second step.
5. **Loyalty is not auto-enrolled at customer creation.** `customer.service.ts:52-59` never touches `LoyaltyAccount` — enrollment is a fully separate, manual POS endpoint (`backend/src/pos/loyalty.service.ts:22-36`).
6. **"Smart SMS" doesn't exist.** Not a CRM concept anywhere. The only SMS-adjacent code is a stubbed POS receipt channel: `receipt-notification.service.ts:202-205` logs "No SMS provider configured yet... Integrate Twilio/Semaphore/Vonage here," and checkout literally labels the phone field "Phone number (SMS not yet active)" (`checkout/page.tsx:3473`).
7. **Marketing retargeting is list-building only, not campaigns.** `CustomerSegment` filters customers but spend-based rules are stubbed to zero (`customer-segment.service.ts:46-51`), and there's no send/campaign mechanism tied to a segment (no SMS/email dispatch) — nothing to actually "retarget" with once the list exists.
8. **RFD/Application Form is a status label, not a document** — same gap as scenario 01; `computeRequestType()` (`release-form-requests.service.ts:256-270`) carries `customerId` but produces no printable artifact.

## Closing the gaps

Ordered by risk/value — data-model gaps that block reporting/compliance first, cosmetic gaps last.

### 1. Split `customerType` into the 3 specified values

**Problem**: `individual | business` can't distinguish B2B Private from B2B Government, which the scenario treats as materially different (likely different tax/withholding/terms handling downstream).
**Fix**: add a Prisma migration extending the enum to `individual | b2b_private | b2b_government` (or introduce a separate `businessCategory` field if `business` needs to stay for backward compatibility with existing records), update `customer.dto.ts` validation and both `NewCustomerForm.tsx`/`EditCustomerForm.tsx` dropdowns. Backfill existing `business` records to a sensible default (likely `b2b_private`) in the migration.

### 2. Add a family/group ID field

**Problem**: no way to link related customer records (e.g. household members, franchise-linked accounts) — the scenario names this explicitly as a captured field.
**Fix**: add `familyGroupId: String?` to `Customer` (simple tag field, not a foreign key to a separate table unless a real "household" entity is wanted later), expose it as an optional input on `NewCustomerForm.tsx`, and add a filter/column on the customer list if grouping/search by it is expected.

### 3. Expose `status` on the create form

**Problem**: status exists and is edit-only, forcing a two-step workflow (create, then immediately edit) for something that should be settable at creation.
**Fix**: add the existing status field/dropdown (already built for `EditCustomerForm.tsx`) to `NewCustomerForm.tsx`, defaulting to whatever the current implicit default is.

### 4. Auto-enroll loyalty at customer creation (or decide not to)

**Problem**: the scenario says "loyalty points are enrolled" as part of profile capture; today it's a manual, separate POS action.
**Fix**: either call the existing `LoyaltyAccount` creation logic (`pos/loyalty.service.ts`) from `customer.service.ts`'s create path so every new customer gets an account automatically (rate-limited/no-op safe if a program isn't configured for the tenant), or confirm the product intent is "loyalty is opt-in at POS" and update the scenario doc / drop this line item — don't leave the mismatch unresolved.

### 5. Smart SMS — scope as a real integration project

**Problem**: currently a placeholder label with no backend.
**Fix**: this is a genuine new integration (Twilio/Semaphore/Vonage per the existing TODO comment), not a small fix — needs its own scoping pass (provider selection, cost, opt-in/consent handling for Philippine SMS regulations) before implementation. Flag as a separate initiative rather than folding into this closing plan.

### 6. Retargeting — connect segments to an actual send mechanism

**Problem**: `CustomerSegment` builds lists but nothing sends anything to them.
**Fix**: depends on Smart SMS (#5) or an email provider being in place first — sequence this after SMS/email integration exists, then add a "send to segment" action.

## Dead code / unused-feature flags

- **`Customer.billingAddress`** (schema + DTO) — defined but the create form only ever populates `shippingAddress`, never `billingAddress`. Either wire up a real billing-address use case (e.g. distinct from shipping for invoicing) or remove the field.
- **`CustomerSourceChannelEnum`/`sourceChannel` filter** — supports values like `crm_lead`/`online` that nothing in the codebase ever produces except the hardcoded `'sales'` constant set on manual CRM add. Largely inert filter plumbing on the customer list — remove the filter UI or wire up real source-channel tracking (e.g. from a future web lead-capture form) if that's still planned.

## Implementation Log — 2026-07-27

**For this scenario, I have done:**

- **#2 (family/group ID)** — note: by the time this ran, `Customer.groupId` (`String?`) already existed in the schema from a separate, unrelated session (added for AR-invoice grouping) and was already wired into Accounting's customer DTO/service/UI — so the actual remaining gap was narrower than this doc's original wording ("no family/group ID field exists anywhere"). Closed the CRM-specific gap: added `groupId` to `crm/customer/customer.dto.ts`'s `CreateCustomerDto`/`CustomerDetailDto` (previously stripped by the global `ValidationPipe`'s `whitelist: true` since it wasn't declared there) and added a "Group ID" field to both `NewCustomerForm.tsx` and `EditCustomerForm.tsx`.
- **#3 (status on create form)** — added the same status dropdown already used in `EditCustomerForm.tsx` to `NewCustomerForm.tsx`, defaulting to `active`.
- **#4 (loyalty auto-enroll)** — developer decided **auto-enroll at creation** (not "confirm opt-in and update the doc"). Since `Customer` is a single unified model created from three separate places (CRM `customer.service.ts`, Accounting `customers.service.ts`, POS walk-in `pos-customers.service.ts`), implemented a shared `enrollInLoyalty()` helper (`crm/customer/enroll-loyalty.util.ts`) and called it from all three creation paths, each now wrapped in a `$transaction` so the zero-balance `LoyaltyAccount` commits atomically with the customer row. This intentionally goes beyond a CRM-only fix — a customer's loyalty status would otherwise depend on which screen created the record, which would have been a new inconsistency rather than a real fix.

**Worth flagging:**

- Also fixed, while in the area but **not a listed gap in this doc** — the "Request graduation" button on the Installment Account detail page (`crm/installment-accounts/[id]/_components/InstallmentAccountDetail.tsx`) was missing a `status === 'active'` guard that Record Payment/Settle Early already had, so it showed even on closed/settled accounts. One-line fix, developer confirmed doing it in the same pass.
- Items #1 (customerType/bank details) were already closed before this run — see the July 17 "Staging CRM & POS" update, superseding this doc's original 3-way `customerType` split ask.
- Items #5 (Smart SMS) and #6 (retargeting send mechanism) remain correctly deferred — out of scope this run, need their own scoping pass per this doc's existing notes.
- Dead-code items (`billingAddress`, `sourceChannel` filter) — still undecided, not touched this run.
- No ClickUp ticket in this doc's "Related ClickUp Tickets" section maps to items #2/#3/#4 or the graduation-button fix, so nothing was moved in ClickUp for this run.
- Backend: `npx tsc --noEmit`, `npx nest build`, and the affected jest suite (`pos-customers.service.spec.ts`, extended with a new loyalty-enrollment assertion) all pass. Frontend: `npx tsc --noEmit` and `eslint --fix` on touched files both pass (one pre-existing, unrelated `react-hooks/exhaustive-deps` warning in `InstallmentAccountDetail.tsx` was already there before this change).
- Not yet done: e2e test coverage for these three items (no `test/*.e2e-spec.ts` / `e2e/*.spec.ts` added this run — only unit-level backend coverage for the loyalty change). Manual click-through verification also still pending the developer's own pass.

## Implementation Log — 2026-07-28

**For this scenario, I have done:**

- Manually verified the 2026-07-27 entry's #2/#3/#4 items and the graduation-button fix end-to-end in the real app (logged in as Business Owner): created a customer with a Group ID and `Inactive` status, confirmed both persisted on reload/edit; confirmed the customer was auto-enrolled in loyalty with a zero balance visible on `pos/loyalty` without any manual "Create Loyalty Account" step; confirmed the graduation button correctly stays hidden on an `early_closed` seeded account.
- Added backend e2e coverage for #2 and #4 (missing from the 2026-07-27 run): `test/crm-customer-groupid-loyalty.e2e-spec.ts` — 7 tests covering groupId create/update/list-filter on the CRM endpoint, and loyalty auto-enrollment across all three creation paths (CRM/Accounting/POS walk-in), plus a check that the manual "create loyalty account" endpoint now correctly 409s for an already-enrolled customer.
- **Found and closed a real gap the developer spotted by reading the code directly**: `crm/customer/customer.dto.ts`'s `CustomerFilterDto` never got a `groupId` param, so the CRM customer list (`customer.service.ts`'s `findAll()`) couldn't filter by it — only Accounting's `ListCustomersQueryDto`/`customers.service.ts` could. Added `groupId` to `CustomerFilterDto`, wired it into `findAll()`'s `where` clause, and added `groupId` to `listSelect`/`CustomerListItemDto` so it's actually visible on list rows (previously only on the detail response). No frontend UI filter added — Accounting doesn't have one either (it only displays the value), so this is an API-parity fix, not new UI scope.

**Worth flagging:**

- No corresponding UI filter control exists for `groupId` on either CRM's or Accounting's customer list page — the filter is API-only for now (usable via `GET /crm/customers?groupId=...`). Flag if a "view household" UI affordance ends up wanted later.
- Still not done: e2e coverage for #3 (status-on-create) and the graduation-button fix specifically — this run's new spec covers #2 and #4 only. The rest was manually verified but not automated.

## Implementation Log — 2026-08-01

**For this scenario, I have done** (all 6 parts from the 2026-07-31 update-doc's "co-maker and duplicate profile" item, confirmed and implemented one at a time):

- **Part 1 — Lead-conversion loyalty bug**: `LeadService.convert()` was the only one of four customer-creation paths that never called `enrollInLoyalty()`. Fixed to match CRM/Accounting/POS walk-in.
- **Part 2 — `billingAddress` mirror on create**: CRM's customer-create form only ever populated `shippingAddress`; now mirrors into `billingAddress` too (matching Accounting/POS), closing the "Dead code" flag on `Customer.billingAddress` noted below.
- **Part 3 — Co-maker (guarantor) capture**: new `CoMaker` model (`prisma/migrations/20260731120000_add_co_maker`), full CRUD through `CreateCustomerDto`/`UpdateCustomerDto` (delete-then-recreate on update, matching `CustomerBankAccount`'s existing pattern), field-array UI on the customer form, read-only display on `Customer360`.
- **Part 4 — Duplicate-customer detection at creation**: `CustomerService.detectDuplicate()` mirrors `LeadService.detectDuplicate()`'s exact-match-on-email-or-phone logic but never throws — non-blocking, dismissible amber warning banner on the create form. Developer confirmed: soft warning, not a hard block (per the PDF's "flags... duplicates" language). This directly closes ClickUp `86d3d19qn`.
- **Part 5 — ID/consent document capture**: `idType`/`idNumber`/`idDocumentFileId`/`consentGiven`/`consentGivenAt` added to `Customer` (`prisma/migrations/20260801090000_add_customer_id_consent`), reusing the central `File` store via the same direct-upload server-action pattern as UDS's RFS form. ID Type is a dropdown of common Philippine government IDs (no fixed NIG-accepted-ID list was specified in any scenario doc, so this is a reasonable default set, frontend-only to widen later). Displayed read-only on `Customer360` with a download link.
- **Part 6 — BM/AR Reviewer duplicate-resolution merge**: closes the plan doc's own "Status: not yet implemented" item #3. Developer confirmed: build now (not deferred), full merge (not a lightweight link-only merge) — reassigns every related record (AR invoices, credit memos, customer advances, installment accounts, service drafts/invoices, SKU reservations, interactions, reminders, bank accounts, co-makers, converted leads, POS transactions, price-list overrides, loyalty balances combined not overwritten) from the duplicate onto a reviewer-chosen survivor in one transaction, applies reviewer field-level overrides, then soft-deletes the duplicate with a `mergedIntoId` pointer. New `crm:customers:merge` permission, Branch Manager + Business Owner only (role hierarchy: Cashier and other Employee-level CRM roles deliberately excluded, confirmed with developer) — seeded directly against the running dev DB rather than a full `prisma db seed` re-run, since `seed.ts`'s `main()` unconditionally wipes all tenant data via `cleanDatabase()`. A "Review Duplicates" queue page (BM/BO-gated) lists flagged pairs for compare-and-merge or dismiss (dismissals persisted via new `CustomerDuplicateDismissal` model so a dismissed pair doesn't keep resurfacing). Old (merged) profile URLs resolve to the survivor's data with an explicit "merged into this record" notice rather than 404ing or silently swapping data.
- **Unify Create/Edit customer forms**: found and fixed while manually testing Part 6 — `EditCustomerForm.tsx` was a separate, hand-rolled component that had silently drifted from `NewCustomerForm.tsx` (still showed Payment Terms/Status/Bank Details after those were removed from Create, plus a stale plain-text Phone field instead of the +63-default `PhoneInput`, and a `max-w-2xl` width cap Create no longer had). Merged both into one `CustomerForm.tsx` (mode-branched on an optional `id` prop) so this class of drift can't recur.

**Worth flagging:**

- **Dead code item `Customer.billingAddress`** (noted above the "Closing the gaps" section) — now closed by Part 2; no longer dead.
- **Dead code item `CustomerSourceChannelEnum`/`sourceChannel` filter** — still undecided, not touched this run.
- Items #5 (Smart SMS) and #6 (retargeting send mechanism) from the original gap list remain correctly deferred — need their own scoping pass.
- The 3-value `customerType` split (`Individual/Business/Employee`) and bank-details capture from the 2026-07-17 update were already closed before this run (see that update's own "Status: Implemented" notes) — not touched again here.
- Backend: `npx tsc --noEmit`, `npx nest build`, and all affected `test/*.e2e-spec.ts` suites pass (26 tests across `crm-customer-groupid-loyalty`, `crm-customer-comaker`, `crm-customer-duplicate-check`, `crm-customer-id-consent`, `crm-customer-merge`). Frontend: `npx tsc --noEmit` and `eslint` on touched files pass (two pre-existing, unrelated `react-hooks/set-state-in-effect` warnings on effects that already existed before this run, not new). All 8 relevant `e2e/*.spec.ts` Playwright specs pass, confirmed stable across 4 consecutive combined-suite runs.
- Two dev-mode Playwright hydration-race flakes were found and fixed while stabilizing e2e coverage across this run's parts (both pre-existing race classes already documented in `e2e/utils.ts`'s `fillAllStable` comment, exposed more easily by the unified form being heavier than either predecessor): `crm-customer-duplicate-warning.spec.ts`'s initial field fill, and `crm-customer-id-consent.spec.ts`'s file-upload attempt — both now wrapped in the same retry pattern already used elsewhere in this file's own suite.
- Manually verified end-to-end by the developer (logged in as Business Owner and Branch Manager): unified form layout/fields, ID Type dropdown + upload + consent, duplicate warning banner, duplicate queue + compare/merge + field overrides, merged-record redirect notice, and the Cashier role-boundary 403.

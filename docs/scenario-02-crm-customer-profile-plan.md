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

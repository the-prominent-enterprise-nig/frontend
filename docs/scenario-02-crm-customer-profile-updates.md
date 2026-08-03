# Scenario 02 — CRM (Customer Profile) — Pending Updates

Companion to [scenario-02-crm-customer-profile-plan.md](./scenario-02-crm-customer-profile-plan.md). Holds newer client feedback not yet merged into that doc's gap analysis. Append-only, dated sections — never overwrite a prior entry. Once an item here is implemented, `implement-scenario`'s Phase 4 marks it consumed here and folds it into the plan doc's own record.

---

## Update — 2026-07-17 (Staging CRM & POS client meeting)

Source: client meeting notes, July 17, 2026, "Staging (CRM & POS)."

1. **`customerType` should be `Individual / Business / Employee` — SUPERSEDES the plan doc's Gap #1, does not add to it.**
   The plan doc's existing Gap #1 ("Split `customerType` into the 3 specified values") targets `Individual / B2B Private / B2B Government`, sourced from the original module-scenarios PDF. The client's newer ask is a different 3-value split: add `Employee` for NIG-employee buyers, alongside `Individual` and `Business`. **Do not implement the B2B Private/Government split as currently written in the plan doc** — the two asks are mutually exclusive, not additive. Confirm with the client which split is now correct before touching the enum or migration.

   **Status: Implemented 2026-07-21.** Client confirmed no HR-system integration — just the labeled category plus a manually-entered ID, no employee-roster lookup. Added `employee` to `CustomerType` (migration `20260721150429_add_customer_employee_type_and_bank_accounts`), an optional `Customer.employeeNumber` field, threaded through both Customer DTOs (`src/crm/customer/customer.dto.ts`, `src/accounting/customers/dto/customers.dto.ts` — enum-driven, no literal changes needed there) and the hand-rolled literal union in `src/crm/customer-segment/customer-segment.service.ts`. Frontend: type selector + conditional Employee ID field in `NewCustomerForm.tsx`/`EditCustomerForm.tsx`, display on `Customer360.tsx`, badge color + list label in CRM `CustomersList.tsx`, and the option added to accounting's simplified customer dialog too. E2E coverage: `test/crm-customer-employee-bank-accounts.e2e-spec.ts`.

2. **Add bank details / bank transfer info to the customer profile.** New field, no existing gap covers it. `bank` already exists as a POS _payment tender_ type (`PAYMENT_METHOD_MAPPING` in `pos-posting.service.ts`) — this is different: capturing a customer's own bank details on their CRM profile. Likely relevant for Employee-type buyers paid via payroll/bank transfer, or for refund/collection routing — confirm the exact use case with the client before scoping the field(s) (bank name, account number, account name, and whether it needs masking/verification given it's financial PII).

   **Status: Implemented 2026-07-21.** Added a `CustomerBankAccount` model mirroring the existing `SupplierBankAccount` shape/pattern exactly (bank name, account number, optional account name, `isPrimary` flag; full-replace-on-update via the same delete-then-recreate transaction `SupplierService` already uses) — same migration as item #1 above. Embedded as a `bankAccounts[]` array on create/update (`src/crm/customer/customer.dto.ts`, `.service.ts`), not a separate sub-resource, matching Supplier's actual pattern rather than the `SupplierDocument` sub-resource pattern. Frontend: repeatable bank-account field-array in `NewCustomerForm.tsx`/`EditCustomerForm.tsx`, read-only "Bank Details" section added to `Customer360.tsx`. Use case wasn't re-confirmed with the client before building (out of session scope) — worth revisiting if masking/verification turns out to matter given it's financial PII.

---

## Update — 2026-07-31 (NIG_ERP_Core_Operational_Scenarios_Draft_2_20260727.pdf, row 3)

Source: client-provided "Core Operational Scenarios" process map, Draft 2, 27 July 2026, row "3. Creating or updating a customer and co-maker profile." Additive to the plan doc's existing gap list, not superseding anything — this row describes real sub-capabilities the plan doc doesn't currently track. Re-verified against current `development` code before logging here (not just taken from the PDF at face value).

1. ~~**No co-maker (guarantor) entity at all.** The PDF requires capturing a "co-maker relationship and documents" alongside the primary customer for a financed sale. Nothing in the schema models a co-maker/guarantor/co-signer relationship — the only adjacent model, `GovernmentID`, belongs to `Employee` (HR/payroll), not `Customer`. This is also a direct dependency for the new Scenario 17 (Credit Application, Investigation & Promissory Note) — its Promissory Note needs to reference a co-maker, so this should land before or alongside that scenario.~~ Merged into plan doc on 2026-08-01 (Part 3).

2. ~~**No duplicate-customer detection at creation.** `crm/lead/lead.service.ts` already has `detectDuplicate()` (exact match on email/phone) for Leads — `crm/customer/customer.service.ts`'s `create()` has no equivalent check at all. There's already an open ClickUp ticket for this specific gap: `86d3d19qn` "AA Cashier, ISBAT be warned of a potential duplicate when adding a new customer" (status: to do) — this PDF row reinforces that ticket rather than introducing a new ask.~~ Merged into plan doc on 2026-08-01 (Part 4).

3. ~~**No duplicate-resolution/merge workflow.** The PDF's "BM/AR Reviewer resolves duplicates and confirms verified data" step has no equivalent anywhere — no merge logic for two Customer records exists in either repo.~~ Merged into plan doc on 2026-08-01 (Part 6).

4. ~~**No ID/consent document capture on the customer profile.** `customer.dto.ts` has no idType/idNumber/consent/attachment fields; `GovernmentID` (the only ID-document model) is HR/Employee-scoped, not usable here.~~ Merged into plan doc on 2026-08-01 (Part 5).

5. **Already covered, no gap:** the PDF's "each installment sale receives a separate Account/Contract ID" is already true — `InstallmentAccount` is a distinct model with its own unique `accountNumber`, one-to-many from `Customer`.

**Status: implemented 2026-08-01.** Scope/sequencing questions resolved with the developer: (a) co-maker capture is optional profile-level capture, not gated to a financed-sale threshold; (b) duplicate detection is a soft, dismissible warning (not a hard block, matching the PDF's "flags... duplicates" language); (c) the merge-resolution UI was built now, as a full merge (reassigns every related record, not a lightweight link-only merge) — see plan doc's 2026-08-01 Implementation Log for detail.

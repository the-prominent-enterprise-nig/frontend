# Scenario 33 — Merge Supplier & Vendor Into One Table — Gap Analysis & Closing Plan

Source: real client "Supplier Master" import template (2026-08-18, `NIG-TPE-Data-Collection-Templates - Supplier Master.csv`, 37 real suppliers), checked field-by-field against `Supplier`. Only the fields/template matter here, not the sample data.

**Revision, same day**: the first draft of this doc treated `Supplier` and `Vendor` as two tables that should stay separate but get linked. Corrected per developer instruction: **from the client's perspective a supplier and a vendor are the same thing** — one real company, one record. This doc now plans an actual merge into a single table, not a link.

## What's already fine — verified, not re-scoped here

15 of the template's 18 columns already exist on `Supplier` with matching names/semantics (code, name, legalName, taxId, contactPerson, email, phone, address, paymentTerms, discountTerms, creditLimit, currency, onboardingStatus, status, notes), including matching enum values. Bank accounts and documents are already real linked child tables (`SupplierBankAccount`, `SupplierDocument`), matching the template's own described structure — nothing to build there. **`Supplier` is the right table to keep as the survivor of the merge** — it already has the richer structure (real bank-account/document sub-tables, an onboarding workflow) and matches the real import template's shape exactly.

## The problem being fixed

Today `Supplier` and `Vendor` are two separate tables. `Vendor` is used for every AP Bill's payee (`APBill.vendorId`, required) and for Business Expenses; `Supplier` is used by Purchase Orders/Purchase Requests/Goods Receipts. A real company that both sells NIG inventory and gets paid via AP — which is the normal case, not an edge case — currently has to be entered **twice**, as two unrelated rows, with no connection between them: two tax IDs, two contact records, two addresses, all independently editable and free to drift apart. Importing this CSV into `Supplier` alone would leave all 37 companies unusable for AP Bills until someone manually re-typed each one into Vendors too.

## Closing the gap

### 1. Merge `Vendor` into `Supplier`

**Problem**: as above — one real-world entity, two disconnected database rows.

**Fix, in dependency order**:

1. **Schema — add Vendor's exclusive fields onto `Supplier`**: `type` (Vendor's own type enum — CONTRACTOR/SUPPLIER/OFFICER/CONSULTANT/EMPLOYEE/CONSTRUCTION/FOUNDER/OTHER — default `SUPPLIER`, so a `Supplier` row can represent any AP payee, not just inventory suppliers), `businessType`, `alphanumericTaxCode` (ATC), `taxRate`, `defaultPayableAccountId`/`defaultExpenseAccountId` (the GL account overrides Vendor already has for AP Bills). `Vendor.bankAccount` (a single flat string) doesn't need a new field — it folds into `Supplier`'s existing, better `SupplierBankAccount[]` table. `Vendor.visibility` folds into `Supplier`'s existing `status` enum (inactive/blacklisted already cover "don't show this one").
2. **Data migration — reconcile, don't just copy**: for every existing `Vendor` row, check whether a `Supplier` row already exists for the same real company (by name/tax ID) and merge onto it if so; only create a brand-new `Supplier` row for a `Vendor` with no match. This needs a real human-reviewed reconciliation pass, not a blind 1:1 copy — two independently-typed records for the same company will not always agree on spelling, formatting, or which tax ID is current.
3. **Repoint every foreign key currently pointing at `Vendor`** — `APBill.vendorId` (required), `BusinessExpense.vendorId` (optional), and `Account`'s two reverse relations (`vendorPayableDefaults`/`vendorExpenseDefaults`) — to point at `Supplier` instead. `APBill` currently has both a required `vendorId` and a separate optional/additive `supplierId` (added in Scenario 10 specifically because the two tables were separate) — collapse these into one required `supplierId` column now that there's only one table to reference.
4. **Retire the `Vendor` model and its backend module** (`src/accounting/vendors/*`) once nothing references it anymore.
5. **Frontend — consolidate the two separate screens** (Accounting → Vendors, Inventory → Suppliers) into one. Recommended: keep **Inventory → Suppliers** as the single canonical screen (richer existing form, matches the real import template), and either drop the Accounting → Vendors nav item entirely or repoint it to the same underlying Suppliers screen so AP-focused staff can still find it from where they'd expect to look.

**Status**: implemented — see Implementation Log below.

## Open Questions

1. **Frontend**: one single shared screen (recommended) vs. keep two nav entries pointed at the same underlying table with different default filters?
2. **Data reconciliation**: matching existing `Vendor` rows to existing `Supplier` rows for the same real company needs a human review pass (name/tax-ID fuzzy matching can suggest candidates, but shouldn't auto-merge blindly) — who does that pass, and when, relative to the schema migration?
3. Should the old `src/accounting/vendors/*` backend endpoints be removed outright once retired, or kept as thin redirects to the Supplier endpoints for a transition period, in case anything external still calls those URLs?

## Verification (once implemented)

To be defined once the open questions above are settled — none of this has been built yet.

## Implementation Log — 2026-08-19

**For this scenario, I have done:**

- **Part 1 (Schema)**: added `type` (VendorType enum, default SUPPLIER), `businessType`, `alphanumericTaxCode`, `taxRate`, `defaultPayableAccountId`, `defaultExpenseAccountId` onto `Supplier`, additively — migration `20260818140749_scenario_33_supplier_vendor_merge_fields`.
- **Part 2 (Data migration)**: built the candidate-match/apply-merge reconciliation tooling as planned (`prisma/vendor-supplier-match.util.ts` + `vendor-supplier-merge.util.ts`, exercised against synthetic fixtures since this environment had 0 real Vendor rows to reconcile). Separately, the real 37-supplier NIG Supplier Master CSV was imported directly into `Supplier` (`scripts/import-nig-supplier-master.ts`) — this was the real trigger for the whole scenario in practice, not the original Vendor-reconciliation scenario the doc anticipated.
- **Part 3 (Repoint FKs)**: `APBill`'s separate `vendorId` (required) + `supplierId` (optional) collapsed into one required `supplierId` — migration `20260818143424_scenario_33_repoint_apbill_expense_to_supplier`. `BusinessExpense.vendorId` repointed to `supplierId` (still optional). GL account routing (Trade vs. Non-Trade AP) now reads `Supplier.defaultPayableAccountId`/`defaultExpenseAccountId` — Part 1's fields' actual payoff. Also fixed two related bugs found along the way: `reports.service.ts`'s `supplierStatement` (was querying Vendor despite its name) and `cash-forecast.service.ts`'s AP projection (same bug). Frontend: AP Bills form collapsed to one required Supplier field; Expenses form gained a Supplier dropdown in place of its old Vendor one.
- **Part 4 (Retire Vendor)**: `Vendor` model dropped entirely (migration `20260818151929_scenario_33_retire_vendor`, table confirmed empty first), `src/accounting/vendors/*` module deleted, and — since it can never run again once the model's gone — Part 2's reconciliation tooling was removed too. Accounting → Vendors frontend screen and nav item removed (pulled forward from the original Part 5 plan, since leaving them pointed at a deleted backend would have been a real intermediate breakage). Orphaned `accounting:vendor:*` RBAC permission definitions cleaned from both the backend seed and frontend guards.
- **Part 5 (Frontend consolidation)**: wired Part 1's merged fields into `CreateSupplierDto`/`UpdateSupplierDto` (previously present in the schema but not the API) and into the Suppliers screen's own create/edit form — Type, Business Type, Tax Code, Tax Rate, and two GL-account-default pickers. Found and fixed a real pre-existing bug in the same form: a blank Credit Limit produced `NaN` under react-hook-form's `valueAsNumber`, which the zod schema didn't treat as absent, so creating any supplier with no credit limit would have silently failed validation.

**Worth flagging:**

- **Open Question 1 (frontend)** resolved: single shared screen (Inventory → Suppliers), Accounting → Vendors nav item removed entirely.
- **Open Question 2 (data reconciliation)** resolved differently than anticipated: the doc assumed real Vendor rows existing that needed reconciling against Supplier. In practice this dev environment never had real Vendor data — the actual real-world trigger was importing the 37-supplier CSV directly into the already-merged `Supplier` schema. The candidate-match/apply-merge tooling was still built (Part 2) to handle the reconciliation case, then removed in Part 4 once Vendor was retired without ever needing it for real data.
- **Open Question 3 (old endpoints)** resolved: removed outright, no redirect period.
- The reconciliation tooling's lifecycle (built in Part 2, deleted in Part 4) is worth remembering if a similar merge scenario comes up again: once a source model is fully retired, any "reconcile into the surviving model" tooling built for it becomes structurally impossible to keep working — it either needs to run once against real data _before_ the source model is dropped, or gets deleted alongside it, not preserved as standing infrastructure.
- The **new Playwright spec for Part 5** (`e2e/supplier-vendor-merge-supplier-form-fields.spec.ts`) has not been confirmed passing in a clean run — every attempt collided with a different concurrent Claude Code session actively running its own Playwright loop against the same shared isolated e2e stack, which kept wiping shared `test-results` state mid-run. Backend API coverage for the same fields is fully verified (14/14 e2e tests). Worth re-running this spec in isolation before treating it as proven.
- Touched two files outside this scenario's own scope, minimally, only because Scenario 33's changes would otherwise have broken their compilation: `prisma/seed.ts` (removed a fictional Vendor-seeding block and the now-orphaned `accounting:vendor:*` RBAC permission catalog entries) and `scripts/cleanup-demo-business-data.ts` (removed one now-impossible `tx.vendor.deleteMany({})` line from that in-progress script).

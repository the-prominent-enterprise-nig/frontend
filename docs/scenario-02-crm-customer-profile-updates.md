# Scenario 02 — CRM (Customer Profile) — Pending Updates

Companion to [scenario-02-crm-customer-profile-plan.md](./scenario-02-crm-customer-profile-plan.md). Holds newer client feedback not yet merged into that doc's gap analysis. Append-only, dated sections — never overwrite a prior entry. Once an item here is implemented, `implement-scenario`'s Phase 4 marks it consumed here and folds it into the plan doc's own record.

---

## Update — 2026-07-17 (Staging CRM & POS client meeting)

Source: client meeting notes, July 17, 2026, "Staging (CRM & POS)."

1. **`customerType` should be `Individual / Business / Employee` — SUPERSEDES the plan doc's Gap #1, does not add to it.**
   The plan doc's existing Gap #1 ("Split `customerType` into the 3 specified values") targets `Individual / B2B Private / B2B Government`, sourced from the original module-scenarios PDF. The client's newer ask is a different 3-value split: add `Employee` for NIG-employee buyers, alongside `Individual` and `Business`. **Do not implement the B2B Private/Government split as currently written in the plan doc** — the two asks are mutually exclusive, not additive. Confirm with the client which split is now correct before touching the enum or migration.
2. **Add bank details / bank transfer info to the customer profile.** New field, no existing gap covers it. `bank` already exists as a POS _payment tender_ type (`PAYMENT_METHOD_MAPPING` in `pos-posting.service.ts`) — this is different: capturing a customer's own bank details on their CRM profile. Likely relevant for Employee-type buyers paid via payroll/bank transfer, or for refund/collection routing — confirm the exact use case with the client before scoping the field(s) (bank name, account number, account name, and whether it needs masking/verification given it's financial PII).

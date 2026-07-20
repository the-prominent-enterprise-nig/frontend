# Scenario 12 — End-of-Day Cash & Cash-in-Transit Monitor — Pending Updates

Companion to [scenario-12-eod-cit-monitor-plan.md](./scenario-12-eod-cit-monitor-plan.md). Holds newer client feedback not yet merged into that doc's gap analysis. Append-only, dated sections — never overwrite a prior entry. Once an item here is implemented, `implement-scenario`'s Phase 4 marks it consumed here and folds it into the plan doc's own record.

---

## Update — 2026-07-17 (Staging CRM & POS client meeting)

Source: client meeting notes, July 17, 2026, "Staging (CRM & POS)."

1. **EOD cash summary exported to Excel, for a turnover/collection reconciliation report.** The plan doc's existing gaps are all about the cross-branch CIT monitor (step 4) — nothing about export format. New gap: add an Excel export of the end-of-day cash-transaction summary.
2. **OR# + complete transaction detail by end-of-day/closing sales.** Client noted this belongs in the accounting module ("Warp mentioned that it is in the accounting module"). Distinct from scenario 11's collector-specific "OR stub" (installment collections) — sounds like POS invoice/OR detail needed for accounting reconciliation at EOD. **Primary home is likely [scenario-14-accounting-month-end-plan.md](./scenario-14-accounting-month-end-plan.md)'s reports gap list, not this doc** — cross-linked here since it surfaced in the same EOD conversation. Confirm with the developer where it actually gets implemented before starting.

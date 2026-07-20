# Scenario 05 — Receiving — Pending Updates

Companion to [scenario-05-receiving-plan.md](./scenario-05-receiving-plan.md). Holds newer client feedback not yet merged into that doc's gap analysis. Append-only, dated sections — never overwrite a prior entry. Once an item here is implemented, `implement-scenario`'s Phase 4 marks it consumed here and folds it into the plan doc's own record.

---

## Update — 2026-07-17 (Staging CRM & POS client meeting)

Source: client meeting notes, July 17, 2026, "Staging (CRM & POS)."

1. **Printable/downloadable Receiving Report.** The plan doc's current gaps cover RR fields, GL posting, and serial entry, but nothing about a print/PDF artifact. New gap: add a print/PDF-export action for a posted `GoodsReceipt` — reuse whatever PDF approach gets adopted for the RFD-document gap already flagged in scenarios 01/02, don't introduce a second PDF-generation method in the codebase.
2. **Item price hidden from Branch Manager and Employee-level roles (e.g. Stock Controller) — visible only to Business Owner/Admin.** QTY and "Received #" stay visible to everyone. No existing scenario doc owns general inventory-list browsing (this doc only covers the receiving flow specifically) — homed here provisionally. Flag to the developer during Phase 2 that this may need to apply beyond the RR itself, to inventory list/detail views too.
3. **Serial number should only appear on the Receiving Report, nowhere else.** Related to #2 — a visibility rule, not a data-model gap. Confirm during Phase 2 which other views currently surface serials (e.g. PO screens, stock lists) and need to stop.
4. **Add a "freebies" section to the RR.** Promotional/free items included in a delivery need their own line-item section (zero-cost, still received into stock). Not covered in the plan doc — pairs with the PO-side freebies ask in [scenario-10-purchasing-ap-updates.md](./scenario-10-purchasing-ap-updates.md); confirm whether freebies are captured at PO time, RR time, or both.

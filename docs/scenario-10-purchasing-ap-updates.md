# Scenario 10 — Purchasing & Accounts Payable — Pending Updates

Companion to [scenario-10-purchasing-ap-plan.md](./scenario-10-purchasing-ap-plan.md). Holds newer client feedback not yet merged into that doc's gap analysis. Append-only, dated sections — never overwrite a prior entry. Once an item here is implemented, `implement-scenario`'s Phase 4 marks it consumed here and folds it into the plan doc's own record.

---

## Update — 2026-07-17 (Staging CRM & POS client meeting)

Source: client meeting notes, July 17, 2026, "Staging (CRM & POS)."

1. **Configuration: add payment methods and accounts (AP/supplier side).** Distinct from the POS-side tender-config system unified in `cb6074b` (`PosPaymentMethodConfig`) — this is about configuring how suppliers get paid (method) and which GL account each maps to, on the AP side. New gap, not currently tracked in the plan doc.
2. **Supplier payment via check, done after receiving the delivery — largely matches the plan doc's existing Gap #3 (no cheque printing).** Confirm this fully closes it, or whether "payment is done after receiving the delivery" implies a new gate that doesn't currently exist — check whether a bill can currently be paid before an RR is posted against its PO, and whether that should be blocked.
3. ~~**Supplier special discounting: SRP, discounted cost, actual cost fields; a "last price" bypass.**~~ **Implemented — marked consumed 2026-08-14** (found already done, folding back in retroactively). `purchase-order.service.ts:217-253`'s `computeDiscountFields()` — inline comment "Scenario 10 Part 6."
4. ~~**Supplier discount as a percentage OR an exact amount.**~~ **Implemented — marked consumed 2026-08-14**, same `computeDiscountFields()` (Part 6) as #3 — both entry modes supported.
5. ~~**PO output: downloadable PDF instead of "send to supplier."**~~ **Implemented — marked consumed 2026-08-14**. `purchase-order.service.ts:183-215`'s `getDocument()` — inline comment "Scenario 10 Part 7 — print-ready PO document envelope."
6. ~~**Add a "freebies" section to the PO.**~~ **Implemented — marked consumed 2026-08-14**. `purchase-order.service.ts:261`'s freebie-line handling — inline comment "Scenario 10 Part 8 — a freebie line (supplier-given free unit)."

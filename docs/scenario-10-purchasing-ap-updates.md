# Scenario 10 — Purchasing & Accounts Payable — Pending Updates

Companion to [scenario-10-purchasing-ap-plan.md](./scenario-10-purchasing-ap-plan.md). Holds newer client feedback not yet merged into that doc's gap analysis. Append-only, dated sections — never overwrite a prior entry. Once an item here is implemented, `implement-scenario`'s Phase 4 marks it consumed here and folds it into the plan doc's own record.

---

## Update — 2026-07-17 (Staging CRM & POS client meeting)

Source: client meeting notes, July 17, 2026, "Staging (CRM & POS)."

1. **Configuration: add payment methods and accounts (AP/supplier side).** Distinct from the POS-side tender-config system unified in `cb6074b` (`PosPaymentMethodConfig`) — this is about configuring how suppliers get paid (method) and which GL account each maps to, on the AP side. New gap, not currently tracked in the plan doc.
2. **Supplier payment via check, done after receiving the delivery — largely matches the plan doc's existing Gap #3 (no cheque printing).** Confirm this fully closes it, or whether "payment is done after receiving the delivery" implies a new gate that doesn't currently exist — check whether a bill can currently be paid before an RR is posted against its PO, and whether that should be blocked.
3. **Supplier special discounting: SRP, discounted cost, actual cost fields; a "last price" bypass.** No such fields exist on `Supplier`/`PurchaseOrder` today. New gap — add supplier-provided SRP, discounted cost, and actual cost as PO/supplier-catalog fields, plus a way to bypass/override the last-used price per line.
4. **Supplier discount as a percentage OR an exact amount.** Pairs with #3 — the discount field needs to support both entry modes, not just one.
5. **PO output: downloadable PDF instead of "send to supplier."** Client wants control over where the PO goes, rather than the system sending it directly. **Verify in code first** whether a "send to supplier" feature currently exists (not mentioned anywhere in the plan doc) before writing this as a gap — if it exists, this is a UI change (email/send action → PDF download action); if it doesn't, this is new PO output functionality.
6. **Add a "freebies" section to the PO.** Pairs with the RR-side freebies ask in [scenario-05-receiving-updates.md](./scenario-05-receiving-updates.md) — confirm whether freebies are captured at PO time, RR time, or both.

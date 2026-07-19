# Scenario 13 — Credit & Debit Memos — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "Credit & debit memos — a return or adjustment."

## Related ClickUp Tickets (Sprint 3-5)

- [86d39pef8](https://app.clickup.com/t/86d39pef8) — "AA Accountant, ISBAT issue a credit memo and apply it to an open invoice" — _Sprint 4, for qa_ — furthest-along of the three near-duplicate credit memo tickets
- [86d3phga7](https://app.clickup.com/t/86d3phga7) / [86d3phg8z](https://app.clickup.com/t/86d3phg8z) — "ISBAT issue a credit memo and apply it to an open invoice" (Business Owner / Branch Manager) — _Sprint 4, to do_ — near-duplicates of 86d39pef8 above; worth checking whether these three are meant to be the same underlying work tracked per-role, or genuinely separate
- [86d3phgb9](https://app.clickup.com/t/86d3phgb9) / [86d3phgau](https://app.clickup.com/t/86d3phgau) — "ISBAT issue a Debit Memo for unit replacements" (Business Owner / Branch Manager) — _Sprint 4, to do_
- [86d3d19u8](https://app.clickup.com/t/86d3d19u8) — "AA Accountant, ISBAT issue a Debit Memo for unit replacements and apply it to the relevant invoice, so replacements are formally documented" — _Sprint 4, to do_ — same theme as the two above, Accountant-role version
- [86d3aby4w](https://app.clickup.com/t/86d3aby4w) — "AA Cashier, ISBAT process a return, refund, or exchange" — _Sprint 3, for qa_ — the POS-side return/refund mechanism this doc's Gap 4 confirms is entirely disconnected from the formal `CreditMemo` model; useful to know both sides are separately ticketed too, matching the code-level disconnect
- [86d3d19v1](https://app.clickup.com/t/86d3d19v1) — "AA Accountant, ISBAT mark a refund request as rejected with a documented reason" — _Sprint 4, to do_
- [86d3d19un](https://app.clickup.com/t/86d3d19un) — "AA Accountant, ISBAT disburse an approved refund to the customer via cash or Palawan from the main office" — _Sprint 4, to do_
- [86d3d19uc](https://app.clickup.com/t/86d3d19uc) — "AA Accountant, ISBAT route a refund request through a multi-level approval ladder before any refund is released" — _Sprint 4, to do_

**Not found in Sprint 3-5:** No ticket for the Credit Memo type field / line items / serials / Gross-Deductions breakdown specifically (Closing Gap 1 — the tickets above ask for "issue a credit memo," not this level of structure), and — same gap as Scenario 10 — **none for supplier-side debit memos**. Note the existing Debit Memo tickets are all "for unit replacements" (customer-facing), not the supplier-return case this doc and Scenario 10 both flag as missing everywhere.

## The scenario we're building toward

A customer returns an item, or a bill needs adjusting:

1. Credit Memo — type (Customer Credit), reason (Sales Return), line items + serials, Gross Credit − Deductions = Total Credit.
2. Auto-post — memo type drives the JE and updates the customer's subsidiary ledger; a replacement/extra charge uses a Debit Memo.
3. Stock & supplier — returned unit restocked or flagged for repair; supplier returns update AP + Inventory.

## What's already done ✅

1. **A real `CreditMemo` model, service, and UI exist** — just much thinner than the scenario describes. Model at `backend/prisma/schema.prisma:815-836`; service `backend/src/accounting/credit-memos/credit-memos.service.ts:82-173` (`issue()`); DTO `credit-memos.dto.ts:11-41`; UI embedded as a dialog inside AR Invoices (`accounting/ar-invoices/_components/ARInvoicesList.tsx:203-305`).
2. **Auto-posting to GL and AR does work mechanically.** `issue()` posts a two-line JE and increases `ARInvoice.amountPaid` (`credit-memos.service.ts:117-156`) — the plumbing to post _something_ correctly to the ledger and paydown the invoice exists, it's just not type-driven (see gaps).
3. **Customer-side restock/repair flagging is real and correctly implemented — but lives in POS, not accounting.** `backend/src/pos/pos-inventory.service.ts:184-231` (`restockFromTransaction`) and `backend/src/inventory/services/stock.service.ts:559-656` (`processReturn`) correctly restock sellable units or flag serials `in_repair` and auto-create a UDS (`stock.service.ts:637-652`).

## What's not done / gaps ❌⚠️

1. **`CreditMemo` has no type field, no line items, no serial attachment, no Gross/Deductions/Total breakdown.** It's `memoNumber`, `customerId`, `arInvoiceId`, `memoDate`, a single flat `amount`, a free-text `reason?`, and `status` — that's the entire model. No "type: Customer Credit" concept, nothing to attach specific returned serials to, no computed breakdown.
2. **The journal entry is hardcoded, not driven by memo type.** `issue()` always builds the same `Dr Sales Revenue / Cr AR Receivable` JE regardless of reason — there's no type field to branch on in the first place, so "memo type drives which JE gets created" isn't implementable as written today.
3. **Debit Memo doesn't exist at all.** Grep for `DebitMemo`/`debit-memo` across both repos returns zero hits, frontend or backend — no equivalent mechanism exists for a replacement shipment or an extra customer charge.
4. **Credit Memo and POS's Return/Refund are two entirely separate, unconnected mechanisms — this is the deepest structural gap.** `backend/src/pos/return-refund-requests.service.ts` operates entirely on `ReturnRefundRequest`, creates/reverses its own POS journal entries via `PosPostingService`, and restocks via `PosInventoryService` — confirmed via grep that this service never touches `prisma.creditMemo`. Conversely, `CreditMemosService.issue()` requires an `arInvoiceId` and has no linkage back to any POS transaction, session, or serial number. **A formal accountant-facing Credit Memo against an AR invoice, with type/reason/line-items/serials, does not exist — only the thin AR-only version does, and a POS return never creates or references one.**
5. **Supplier-directed returns are entirely missing** — no `PurchaseReturn`/`ReturnToSupplier`/`VendorCredit`/`DebitNote` concept anywhere. This is the same gap flagged independently in scenario 10 (Purchasing & AP) — the two scenarios converge on the identical missing feature from opposite ends (customer credit vs. supplier debit).

## Closing the gaps

Ordered by architectural dependency — later items build on the type/line-item model from #1.

### 1. Give `CreditMemo` a real type field and line items

**Problem**: no way to represent "this credit is for a sales return of these specific serials" vs. any other kind of credit.
**Fix**: add `type: CustomerCreditMemoType` (start with at least `sales_return`, `billing_adjustment`, `goodwill`), a `reason` enum instead of free text (or keep free text alongside a required reason-category enum), and a child `CreditMemoLine` table (`itemId`, `quantity`, `unitPrice`, `serialNumberId?`, `deductionAmount?`) so `Gross Credit − Deductions = Total Credit` becomes a real computed value from real lines instead of one flat number typed in by an accountant.

### 2. Make JE posting type-driven

**Problem**: `issue()` always posts the same two-line JE.
**Fix**: once #1 exists, branch the JE construction on `type` — e.g. a `sales_return` credit debits Sales Returns & Allowances (a new or existing contra-revenue account) rather than debiting Sales Revenue directly, while a `billing_adjustment` might route differently. Confirm the exact GL treatment per type with Accounting before implementing — this is a chart-of-accounts decision, not just a code change.

### 3. Connect POS returns to formal Credit Memos

**Problem**: the two systems don't know about each other at all, so a POS-processed return never produces the accountant-facing artifact the scenario describes.
**Fix**: when a `ReturnRefundRequest` is approved and involves a charge/AR sale (not a cash sale, which nets out immediately at POS), auto-create a linked `CreditMemo` (post-#1, with line items sourced directly from the return's line items/serials) rather than requiring an accountant to manually re-enter the same return as a separate memo. Add a `sourceReturnRequestId` field on `CreditMemo` for traceability. For cash sales, confirm whether a Credit Memo is even needed (POS's own JE reversal may already fully close the loop) — don't build unnecessary duplication.

### 4. Build Debit Memo as `CreditMemo`'s mirror

**Problem**: no debit-memo mechanism exists for replacements/extra charges.
**Fix**: once #1-2 land, add `DebitMemo` following the identical shape (type/reason/lines/JE), with JE polarity reversed (`Dr AR Receivable / Cr Sales Revenue` or similar depending on the specific case) — don't design it from scratch independently of Credit Memo, keep the two symmetric.

### 5. Supplier-side Debit Memo (shared scope with scenario 10)

**Problem**: no supplier-return mechanism exists on either side of the codebase.
**Fix**: this is the same gap as scenario 10's Closing Gap 5 — implement once, referenced from both scenarios, as a `SupplierDebitMemo` reducing AP and Inventory. Don't duplicate the design effort across the two scenario docs; treat scenario 10 as the owning doc for this specific piece and cross-reference it here.

## Dead code / unused-feature flags

None — the existing thin `CreditMemo` is real and used (via the AR Invoices dialog); it needs to be extended per Closing Gaps 1-2, not replaced.

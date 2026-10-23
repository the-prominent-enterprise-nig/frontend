# Scenario 18 — Customer Returns, Exchanges & Disposition — Gap Analysis & Closing Plan

Source: `NIG_ERP_Core_Operational_Scenarios_Draft_2_20260727.pdf`, row "7. Processing a customer return, exchange or refund." New scenario, mapped from this row — no equivalent existed in the original `module-scenarios.md` source, and it doesn't fit any of Scenarios 01-14.

**Relationship to Scenario 13**: Scenario 13 (Credit & Debit Memos) covers the accounting-side memo artifact — thin, customer-side only, not connected to POS returns. This scenario covers the operational return/exchange flow itself (case, inspection, disposition). They should end up wired together — see Closing Gap 5.

## Related ClickUp Tickets

None found directly, though this overlaps in spirit with Scenario 13's ticket coverage — check there for any unassigned relevant items when implementing.

## The scenario we're building toward

A customer requests a remedy for a previously sold unit:

1. Cashier opens a case without deleting the original sale.
2. The system validates the sale, serial and policy.
3. Stock Custodian inspects and moves the unit to Quarantine.
4. BM/HO Approver authorizes the remedy and disposition.
5. The system creates the credit/reversal and updates inventory, VAT, COGS, cash or AR.

**Result**: the original sale and corrective transaction are both preserved; the unit receives an explicit disposition.

## What's already done ✅

1. **The case-without-deleting requirement is already met.** `ReturnRefundRequest` (`backend/prisma/schema.prisma:2112`) holds `originalTransactionId`/`transactionId`, never deletes the source `PosTransaction`; void only flips its status to `voided`. Service: `src/pos/return-refund-requests.service.ts`.
2. **Real credit/reversal accounting exists for void/refund.** `finalizeVoidApproval` reverses the JE and restocks (`return-refund-requests.service.ts:632-695`); `postRefundJE` (`src/pos/pos-posting.service.ts:330+`) builds cash, VAT, and COGS reversal lines.
3. **A disposition decision already exists at approval time**, just binary — `lineDecisions[].repairDecision: 'restock' | 'flag_for_repair'` (`src/pos/dto/pos.dto.ts:1539-1575`), wired into the UDS (repair-transfer, Scenario 07) flow for the repair path.

## What's not done / gaps ❌⚠️

1. **No Quarantine hold state.** A return branches immediately to `sellable` or `damaged` via `ReturnCondition` (`src/inventory/dto/stock.dto.ts:27`) — no pending-inspection intermediate status. (`BatchStatus.quarantine` exists but is for lot/batch recalls, unrelated to POS returns.)
2. **No tiered custodian-then-approver flow.** Approve/reject is a single permission tier (`pos:transaction:override`, `return-refund-requests.controller.ts:110-150`) — no separate "Stock Custodian inspects" step exists as its own record, and no Stock Custodian persona exists anywhere in the codebase.
3. **Disposition is binary.** No scrap/write-off option at return time — Scenario 07's UDS write-off exists but isn't wired as a return-time choice, only reachable via the separate repair-transfer flow.
4. **Exchange is vestigial, not a working flow.** `PosTransactionType.exchange` exists in the enum (`schema.prisma:1530`) and the frontend type/filter, but checkout only ever submits `transactionType: 'sale'` — nothing ever creates an exchange transaction in practice.
5. **Refund JE always posts against `MAPPING_KEYS.DEFAULT_CASH`.** No evident AR-side reversal path for a return against a credit/installment sale specifically — worth confirming this is a real gap versus an intentional simplification for cash sales only.
6. **`CreditMemo` (Scenario 13) remains completely disconnected.** `ReturnRefundRequestsService` never references `prisma.creditMemo` — a POS return doesn't generate the customer-facing credit document Scenario 13 owns.

## Closing the gaps

Ordered by risk/value.

### 1. Confirm process weight with the business

**Problem**: a Quarantine-inspection step and a distinct Stock Custodian persona are real process/headcount questions, not just engineering ones.
**Fix**: confirm with the business how much of this formality is actually wanted before building a multi-actor workflow on spec.

### 2. Add Quarantine + inspection step

**Problem**: returned units currently skip straight to a final stock status with no inspection record.
**Fix**: add a Quarantine status to the return flow's stock handling, with inspection as its own recorded step before the approver's disposition decision.

### 3. Add scrap/write-off as a third disposition option

**Problem**: a return can only restock or flag-for-repair today, never scrap.
**Fix**: extend `repairDecision` to a third option, wired to the existing UDS write-off path from Scenario 07 rather than building a new one.

### 4. Decide Exchange's fate

**Problem**: `exchange` is a half-built enum value that misleads anyone reading the schema into thinking it works.
**Fix**: either build it out as a real second-transaction flow (issue replacement unit + reverse original) or remove the vestigial value if it's not actually wanted — don't leave it half-there.

### 5. Connect to CreditMemo

**Problem**: a POS return doesn't produce the accounting-side credit document Scenario 13 already defines.
**Fix**: wire `ReturnRefundRequestsService` to create a `CreditMemo` on approval, closing the disconnect flagged in Scenario 13's own audit.

## Dead code / unused-feature flags

- **`PosTransactionType.exchange`** — see Closing Gap 4 (build out vs remove), not touched by this doc.

## Implementation Log

### 2026-09-15 — The counter return rebuilt as a document: Gaps 1, 3, 4, 6 closed, Gap 5 closed on the new path only, Gap 2 deliberately not built

**For this scenario, I have done:**

- **The return became a document.** A counter return had no header of its own — the whole trail hung off the `StockLedger` row, so one customer handing back three items produced three unrelated rows, three RR numbers and three credit memos for a single visit. New `customer_returns` + `customer_return_lines` tables (migration `20260915100000_customer_return_documents`) give one visit one RR number, one consolidated credit memo and as many lines as were handed back. `POST /inventory/stock/customer-returns` posts it.
- **Gap 1 (Quarantine)** — closed as a **disposition**, not as a workflow. `ReturnDisposition` is now `restock | quarantine | scrap | repair | exchange`; a quarantine line lands in `onHand` but not `available`, so the unit is physically back and commercially held. There is no separate inspection _record_ and no second actor — see the flag below.
- **Gap 3 (scrap)** — closed. A scrap line is written off on arrival: no stock movement and no cost reversal, but the customer is still credited.
- **Gap 4 (exchange)** — closed by building it out, not by deleting it. An exchange quarantines what came back, issues the replacement, and credits nothing. `exchange_out` is its own `StockTransactionType` rather than a `sale`, because Stock Balance sums `sale` rows as its sold quantity and booking the replacement as a sale would report units sold twice that were only ever sold once — the same reasoning that made `supplier_return` its own value. Enforced as an even swap against the price the unit sold at.
- **Gap 6 (CreditMemo disconnect)** — closed on this path. A return naming an AR invoice raises one consolidated credit memo against it, sized from `unitPrice` (what the customer was charged) and not from cost — crediting cost would leave the invoice stuck `PARTIAL` forever.
- **Gap 5 (AR-side reversal)** — closed **on the new document path only**. A return against an AR invoice now reaches AR through the credit memo above; a cash return, or one against an already-settled invoice, posts correctly with `creditMemoId: null` and explains itself in `accountingNote`. The POS void/refund path's own `DEFAULT_CASH` JE is untouched.
- **The `condition` × `repairDecision` matrix is gone from the return screen.** That pair had six combinations of which three meant anything, could express "damaged + flag_for_repair" and "sellable + flag_for_repair" identically, had no way to say "we swapped it" or "we scrapped it" at all, and its undefined `repairDecision` rendered as though "restock" were chosen while sending nothing. One question, one consequence each, replaces it.
- **Free-text reasons became a fixed list.** "d", "defective" and "DEFECTIVE UNIT!!" are the same fact spelled three ways and nobody could ever count them. Six codes now; the label is what gets written to the document, since the detail panel and the customer's copy are read by people, not by a report.
- **The frontend is a screen, not a modal.** The 769-line `CreateReturnModal.tsx` and its `PurchasePicker.tsx` are deleted, replaced by a three-section screen (`_components/create-return/`, 13 files, largest 387 lines) — who brought it back, what they bought, what happens to it — where sales are picked from the customer's own purchase history rather than an invoice picker that overwrote the customer field and then froze it read-only.
- **The quantity cap is keyed on the sold line**, not the ledger row: `sourceLedgerId` is null for every weighted-average item, so a cap keyed on it would silently not apply to most of the catalogue. Earlier returns against the same sold line count against it.
- **A repair line raises a UDS carrying the document's RR number**, moves no stock, and requires a serial at quantity 1 — a UDS line is one named unit and has no quantity column at all.

**Verified:**

- Backend: **41/41 passing** across `inventory-customer-returns-document.e2e-spec.ts` and `inventory-customer-returns-characterization.e2e-spec.ts` — multi-line posting, the quantity cap and its rejection messages, scrap, repair-and-UDS, the full exchange even-swap set, cross-tenant invoice refusal, and that a rejected return leaves nothing behind.
- Frontend: **8/8 passing** in `e2e/inventory-customer-returns.spec.ts` against the isolated e2e stack, including a real end-to-end post. Needs `e2e/fixtures/customer-return.sql` loaded first — the seed creates no customer with a completed sale, and the screen is built around picking from purchase history, so without one the happy path cannot be exercised at all.
- `pnpm type-check` and `pnpm lint` clean in both repos (frontend lint: 0 errors, 351 pre-existing warnings).

**Worth flagging:**

- **Gap 2 (tiered custodian-then-approver) was not built, on purpose.** Closing Gap 1 of this plan asked to confirm process weight with the business before building a multi-actor workflow on spec, and that confirmation has not happened. Quarantine exists as a state a clerk can put a unit into; nobody is _required_ to inspect it, no inspection record exists, and no Stock Custodian persona was introduced. If the business does want the formality, the hold state it would hang off is now real — but this should not be read as "quarantine is done".
- **History was deliberately not backfilled, and the list unions two shapes.** Old rows cannot be grouped into documents — the RR number was generated per ledger row, so three rows from one visit share no key — and they carry no `unitPrice`, no `createdById` and no real disposition. Minting `RTN-` numbers for paper that was never issued would be worse than recording nothing. `getCustomerReturns` therefore returns documents alongside legacy headerless rows, and a document's own ledger rows are suppressed so it appears exactly once.
- **New headerless rows keep arriving.** The POS void/refund path still calls the single-item `processReturn`. The union ends only when POS moves onto this document too — that is a real, unscheduled follow-up, not a transitional state that expires on its own.
- **The e2e fixture is consumed by its own test.** Each run of the posting spec returns units off the fixture's sale and they do not come back; the spec failing with "only 0 of N left to return" is the server's cap working, and the fix is to re-run the fixture. The sale quantity is deliberately 200 to make that rare.

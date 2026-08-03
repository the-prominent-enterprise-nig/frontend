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

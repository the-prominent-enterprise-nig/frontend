# Scenario 29 — UAT Consolidation (Aug 12, 2026): Closing Gaps Across Procurement, Serials, POS, Accounting, CRM & Inventory — Gap Analysis & Closing Plan

Source: `uat-consolidation-2026-08-12_2.md` (UAT feedback notes prepared by Keb, Aug 12 2026, "Draft for review") — a 55-item consolidated list of CRs/bugs/open questions across Purchase Order, Receiving, Serial Numbers, POS, Accounting, CRM, and Inventory. Verified against live code (both repos, `development`-tracking state) on 2026-08-17 via 6 parallel Explore passes before any of this doc was written — the source doc itself was mostly _already resolved_, not a fresh backlog. Full verification detail (all 55 items, evidence, file:line citations) lives in this session's own audit; this doc only carries forward the items confirmed as real, unclosed gaps, plus enough "already done" context that nobody re-derives it from scratch.

## Scope note — Procurement is charter-flagged, included anyway

Sections 1–5 of the source doc (Purchase Order, Purchase Request, Receiving Report, Serial Numbers at receiving) are Procurement functionality. Per [[project_charter_nig]], Procurement is explicitly **out of scope** for NIG's engagement — it's a real TPE module NIG didn't subscribe to. It is nonetheless already built and under active development in this codebase (see Scenario 10, Scenario 27). Per standing instruction ([[feedback_dont_move_module_tickets]] — flag, don't move, module-adjacent work), these items are included in full below. This is worth a scope conversation with the client/PM before or alongside implementation — not a reason to skip building them if the client is already treating them as live requirements.

## What's already done — verified, not re-scoped here

Roughly half the source doc's 39 code-checkable items are already correctly implemented and need no further work: supplier data, warehouse selection, payment-terms removal, calculator/freebie field positions, line-item ordering, delivery-date field, supplier TIN, signature blocks, PR/PO shared field structure, per-unit discount calculation (DISC-04), the PDF description bug (not reproducible), the core PO→RR conversion flow with manual serial entry and hard validation (RR-01/02/03), the serial-uniqueness guard rail across POs (SN-02), the 10% down-payment floor (POS-01), and the real per-line price-override RBAC permission (POS-03, price half only). None of these need re-verification before starting the work below — re-check only if something here looks stale by the time this doc is picked up.

**Two bugs surfaced during verification that are not in the source doc at all** — folded into Closing Gap 1 below since they're cheap, unambiguous fixes: the discount-override path on POS is transaction-wide and isn't server-verified (unlike price-override), and transaction detail has a `serialNumber` field the frontend already expects that the backend never populates.

## Decisions made (planning conversation, 2026-08-17)

- Build order below reflects developer agreement on which items are real gaps vs. already fine, given during the planning conversation this doc is written from.
- **ACC-01**: fix the per-installment _timing_ of revenue recognition now (the client's language — "per installment, not lumped per transaction" — is unambiguous enough to act on); hold exact account codes/labels/structure as provisional/placeholder until the real ledger sample arrives, per the original decision (D-08 in the source doc). Don't treat this pass's output as final, signed-off ledger formatting.
- **PO-14 before PO-16**: carry the discount breakdown through PR→PO conversion _before_ building edit-after-approval, since an editable approved PO is far less useful if the person editing it can't see which discounts produced the current unit price.
- **RR-04 may not need separate work**: it's likely fully subsumed once RR-05 (manual RR) exists — confirm this with the developer before starting RR-04 in isolation.
- **DISC-03 deferred**, not because it's low value but because OQ-06 (what should drive "automatic") is unanswered, and what exists today (live recompute as the user types) may not even be the feature being described. Don't build a confirmation step around the wrong mechanism.
- **INV-01 deferred** — P3, cosmetic-only, ~25+ label sites across the Inventory module. Real risk of breaking text-matching e2e specs for low business value, same pattern as the earlier warehouse→branch relabel work ([[project_warehouse_tier_correction]]). Batch into a slow week rather than this pass.
- **ACC-02 has nothing to build yet** — blocked entirely on accounting attaching their existing document templates.

## Closing the gaps

### 1. Two live bugs — discount-override server verification, serial-number resolution

**Problem**: (a) The discount-override path in `transactions.service.ts` (`:513-533`) trusts the client-sent `managerOverride`/`managerUserId` flags without verifying server-side that the claimed manager actually holds an override permission — unlike price-override, which correctly checks `cashierPin.userHasPriceOverridePermission` (`:575-582`). Per the code's own comment at `:566-568`, this was already known as a gap relative to price-override, just never closed. (b) `findOne()` (`transactions.service.ts:1708-1711`) never resolves a line's `serialNumberId` into the `serialNumber` string — `PosTransactionLine.serialNumber` is declared in `schema/pos/index.ts:179` and rendered in `TransactionsList.tsx:860-863`, but is always `undefined` at runtime because the backend just spreads the raw line.

**Fix**: (a) add the same server-side permission check price-override already has, gating discount-override the same way. (b) resolve each line's serial in `findOne()` before returning — same shape as whatever other serial-resolution code in this module already does it correctly.

**Status**: not started.

### 2. Wire transaction history into CRM Customer360 (CRM-01)

**Problem**: `GET /pos/transactions/customer/:customerId` (`getCustomerHistory()`, `transactions.service.ts:2307`; controller `transactions.controller.ts:211`, tagged "POS-09") already exists and is proven — POS checkout's own cashier-facing panel calls it today, capped at 5 rows. `Customer360.tsx` (CRM) has no equivalent section; "Installment Plans" only covers financed purchases, not cash/full-payment sales.

**Fix**: add a "Transaction History" section to `Customer360.tsx` against the existing endpoint — unlike checkout's capped inline panel, this can support real pagination since it's a dedicated record view. No backend change expected.

**Status**: not started.

### 3. PO/PR quick wins — confirm-before-commit, delivery place on create form (PO-15, PO-11)

**Problem**: PO-15 — PR Submit, PO Approve, PO Send, and PO Close all commit instantly with no confirmation, while Cancel, PR Reject/Approve, and Convert-to-PO already confirm via modal in the same modules. PO-11 — `shippingAddress` exists on the model/DTO and already renders during PR→PO conversion (`ConvertPrToPoModal.tsx:229-247`), but is absent from the initial PR/PO creation form, which only offers free-text "Delivery Instructions."

**Fix**: PO-15 — extend the confirm-modal pattern already used for Cancel/Reject to the 4 uncovered actions. PO-11 — surface the same shipping-address field already built for the conversion form on the initial creation form (`PurchaseOrderFormFields.tsx` and the PR equivalent).

**Status**: not started.

### 4. PO edit-and-approve workflow — finish draft PO edit, carry discount breakdown, allow edit-after-approval (PO-06, PO-14, PO-16, PO-08)

**Problem**: one connected workflow gap, described as four separate UAT items. PO-06 — draft PR edit fully works (header + lines); draft PO edit is header-only server-side (`purchase-order.service.ts:414-446`) with zero frontend wiring — no Edit button, no `update-purchase-order.ts` action exists at all. PO-14 — PR→PO conversion carries quantity/unitPrice/description/notes over editable, but silently drops the discount breakdown (SRP, individual discount rows, freebie flag) — only the already-computed unit price survives. PO-16 — the instant status leaves `draft` (including merely `submitted`, still pending approval), edit is blocked outright everywhere (`only_draft_can_be_edited` / `only_draft_po_can_be_edited`); there is no "edit voids the approval, routes back for re-approval, logs the change" path. PO-08 — draft PO rows show Approve/Cancel/Download only; submitted PR rows show Approve/Reject/Cancel only; no Edit button sits next to Approve anywhere.

**Fix, in dependency order** (per the decision above, PO-14 before PO-16):

1. **PO-06**: extend `purchase-order.service.ts`'s `update()` to accept line-item edits, mirroring the PR update already at `purchase-request.service.ts:219-274`; build the missing frontend (Edit entry point, `update-purchase-order.ts` action), reusing `CreatePoModal`'s edit-mode pattern already proven for PRs.
2. **PO-14**: carry the discount rows/SRP/freebie flag into the PO line at conversion time, not just the final computed unit price, so the breakdown survives for later editing and audit.
3. **PO-16**: replace the hard `only_draft_*_can_be_edited` block with a status-aware rule — draft/submitted stays freely editable; approved-or-beyond requires an edit path that flips status back to pending, voids the prior approval record, and logs the change (who, when, what changed) — reuse whatever activity-log mechanism this module already has for other status transitions.
4. **PO-08**: once 1–3 land, add the Edit button next to Approve on both PR and PO review rows — now a real destination, not a dead link.

**Status**: not started.

### 5. Per-item credit approval (POS-02)

**Problem**: financing terms and down payment are already genuinely per-line (`PosTransactionLine.financingTermId`, per-line `downPayment`), but the credit decision governing whether a customer can finance at all is still one status on the whole `CreditApplication` bundle (`schema.prisma:4821-4856`) — `CreditApplicationItem` (`:4882-4896`) has no status of its own, and `TransactionDto.creditApplicationId` (`pos.dto.ts:571`) is a single transaction-level field requiring the installment lines to exactly match one application's full item set (`transactions.service.ts:319-353`).

**Fix**: give `CreditApplicationItem` its own approval status; update `credit-application.service.ts`'s `approve()`/`decline()` to operate per item instead of flipping one bundle-level status; update `TransactionDto`/checkout assembly so a cart can reference different (or partially-approved) applications across lines instead of requiring exact 1:1 match to a single application. **Largest single item in this scenario** — touches the CreditApplication data model, the approval workflow, and POS checkout's line assembly. Worth its own design pass before implementation, not a quick patch.

**Status**: not started.

### 6. Supervisor override on transfer serial mismatches (SN-01)

**Problem**: `assignDispatchSerials()` (`transfers.service.ts:379-472`) already correctly blocks a wrong/mismatched serial for every caller — tenant/item mismatch, wrong status, wrong physical location, double-assignment all rejected. But there is no override path at all for a supervisor to correct a serial, `dispatch()` is gated by one flat permission (`inventory:transfers:dispatch`) with no elevated variant, and no audit log exists for a serial correction (there being no override to log).

**Fix**: add a supervisor-level override path to `assignDispatchSerials()` — a new permission (e.g. `inventory:transfers:serial-override`) or manager-PIN-style verification (mirroring `cashierPin.userHasPriceOverridePermission`'s pattern on the POS side) that lets a qualifying user substitute a corrected serial past normal validation. Every override must log who performed it, when, the old serial, the new serial, and a required reason — reuse whatever activity-log mechanism POS price-override already uses (`PosTransactionLine.priceOverrideBy`) as the pattern to mirror.

**Status**: not started.

### 7. Non-PO serial origination — found items in stock counts, manual RR (RR-04, RR-05)

**Problem**: RR-04 — two existing paths can originate a brand-new serial (`receiveInitialUnit()` for a just-created item's first unit; the standalone `POST /inventory/serial-numbers` register endpoint), but the stock-count "found item" path (`adjustments.service.ts:539-554`) can only _reactivate_ an already-registered `SerialNumber` — no way to originate one for a unit that was never in the system. RR-05 — no manual-RR-without-a-PO feature exists matching the described requirements: restricted to items found after 6+ years, owner-gated by default with an owner-controlled grant/revoke settings page, a required reason code, and a captured approver identity distinct from the submitter. The closest analog (`receiveInitialUnit`) has none of these — gated only by generic `inventory:items:create`, unrestricted by item age, no reason code, no distinct approver field.

**Fix**: build RR-05 as the real feature — new manual-RR flow, gated by a new permission (e.g. `inventory:manual-rr:create`) defaulted to the owner role only, an owner-facing settings page to grant/revoke it to other roles, a required reason-code field, and an approver-identity field distinct from the submitter. Once that exists, confirm with the developer whether RR-04's stock-count gap is naturally closed by routing an unregistered found item through this same new path — per the decision above, it may not need separate work at all.

**Status**: not started.

### 8. Inventory aging report rebuild (INV-02)

**Problem**: `GET /inventory/reports/aging` (`reports.service.ts:379-468`) diverges from spec — confirmed committed scope per Decision D-04 in the source doc — on every dimension: groups by `StockBalance` (item + warehouse aggregate) instead of per serialized unit; ages from `StockBalance.lastMovementAt` instead of the RR/goods-receipt date; buckets are 0-30/31-60/61-90/90+ instead of the requested 0-30/31-60/61-90/91-180/180+; no slow-moving (91-180) or should-be-out (180+) flags. Zero frontend UI consumes it today.

**Fix**: rebuild the query to group per `SerialNumber`, aging each unit from its own `goodsReceiptLineId`'s receipt date (`SerialNumber.goodsReceiptLineId` already exists in schema — the join path is there, just unused by this report), with the correct 5-bucket boundaries and both named flags. Report only, no hard sale block, confirmed by D-04. Build the frontend report page (consider siting it alongside the existing Turnover report for a consistent module home).

**Status**: not started.

### 9. Stock usage reconciliation report (INV-03)

**Problem**: every stock deduction already records a source-document reference (`StockLedger.referenceType`/`referenceId`, populated on every deduction path — sales, transfers, adjustments/disposals, goods receipts, service drafts, supplier debit memos). The data model is already correct; no report surfaces either exception case the UAT item describes: movements with a null reference, and transactions with no matching movement.

**Fix**: add a reconciliation endpoint alongside the existing `valuation`/`turnover`/`aging` trio in `reports.controller.ts` — query `StockLedger` for null-reference rows, and cross-check POS transactions / transfer dispatches / disposals against `StockLedger` for the inverse case. `GET /pos/transactions/reports/missing-cogs` is the closest existing analog for the query shape (same "flag things missing expected linkage" pattern, applied to GL posting rather than stock quantity) — worth reviewing before building this one. Frontend: a new report page, view/filter only.

**Status**: not started.

### 10. Per-installment revenue recognition timing (ACC-01)

**Problem**: collections already post correctly — each individual installment due gets its own journal entry at payment time (`ar-invoices.service.ts`'s `recordPaymentCore`, including under bulk "Pay Selected"). But sale-time revenue recognition posts one aggregate journal entry for the whole plan up front (`transactions.service.ts:2892-3121`'s `createAndPostInstallmentPlan`), explicitly documented in its own comment as "v1 simplification, not deferred/amortized" — very likely the exact "lumped per transaction" behavior flagged.

**Fix**: change sale-time posting to defer/spread revenue recognition across the plan's individual due dates, matching the granularity collections already uses correctly. Per the decision above, don't wait on the exact ledger sample to fix the _timing_ — the client's language is plain enough to act on now. Keep account codes, line labels, and any other format specifics provisional/placeholder pending the real sample (D-08); this pass is not the final, signed-off ledger format.

**Status**: not started.

## Deferred / not in this pass

- **ACC-02** (documents follow accounting's formats) — nothing to build; blocked entirely on accounting attaching their existing templates.
- **DISC-03** (automatic discount + confirmation step) — blocked on OQ-06 below; the current live-recompute-as-you-type behavior may not even be the feature being described. Don't build a confirmation step around the wrong mechanism.
- **INV-01** ("Stock" → "Branch stock book") — P3 cosmetic rename across ~25+ label sites; deferred per the decision above, real e2e-breakage risk for low business value.
- **DISC-02** (reorder discount type field) — trivial whenever someone confirms which direction is actually wanted; not scheduled.
- **BUG-01 through BUG-05** — still need repro steps, expected behavior, and actual behavior before any of them are actionable.

## Open Questions — blocking, need an owner + date

1. **OQ-06** — "Make it automatic with confirmation": automatic based on what source — a supplier price list, a default discount type, or the last PO's discount? Blocks DISC-03.
2. **ACC-01 ledger sample** — accounting's real installment-ledger format. Blocks final sign-off on Closing Gap 10's account codes/labels (not the timing fix itself, which doesn't wait on this).
3. **ACC-02 document templates** — accounting's existing PO/RR/receipt/ledger formats. Blocks ACC-02 entirely; nothing to build until these are attached.

Per the source doc's own note: these three need a named owner and a date, or they won't arrive.

## Implementation Log

_(empty — no implementation has started; this is the planning pass only, per explicit "no code changes" instruction)_

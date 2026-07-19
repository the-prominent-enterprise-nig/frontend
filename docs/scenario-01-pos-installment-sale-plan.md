# Scenario 01 — POS (Walk-in Installment Sale) — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "POS — a customer walks in and buys."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3d19gh](https://app.clickup.com/t/86d3d19gh) — "AA Cashier, ISBAT assign a specific serial number to each serialized unit added to a sale" — _Sprint 3, for qa_
- [86d3d19h0](https://app.clickup.com/t/86d3d19h0) — "AA Cashier, ISBAT have the system block sale completion if a required serial number is missing or not in stock" — _Sprint 3, for qa_
- [86d3d19hb](https://app.clickup.com/t/86d3d19hb) — "AA Cashier, ISBAT tag a selling agent on a sale at checkout" — _Sprint 3, in review_
- [86d3d19g5](https://app.clickup.com/t/86d3d19g5) — "AA Business Owner, ISBAT maintain a list of sales agents for selection at the point of sale" — _Sprint 3, for qa_
- [86d3d19hq](https://app.clickup.com/t/86d3d19hq) — "AA Accountant, ISBAT have VAT and applied promotions itemized separately on the printed receipt" — _Sprint 3, to do_
- [86d3d19hz](https://app.clickup.com/t/86d3d19hz) — "AA Business Owner, ISBAT configure tender types per branch and map each to its GL account" — _Sprint 3, to do_
- [86d3d19jb](https://app.clickup.com/t/86d3d19jb) — "AA Warehouse Staff, ISBAT generate and print a digital Release Form Document (RFD) for a unit release" — _Sprint 3, to do_ — **directly covers Gap 1 below** (RFD is currently a status label, not a printable document)
- [86d3d19ew](https://app.clickup.com/t/86d3d19ew) — "AA Cashier, ISBAT choose between issuing a Cash invoice or a Charge invoice at checkout" — _Sprint 3, in review_
- [86d3d19e3](https://app.clickup.com/t/86d3d19e3) — "AA Cashier, ISBAT see invoice totals automatically updated net of any applied discount" — _Sprint 3, to do_
- [86d3d19dj](https://app.clickup.com/t/86d3d19dj) — "AA Cashier, ISBAT have invoice numbers auto-generated in a gap-free sequence" — _Sprint 3, to do_
- [86d3ab4rw](https://app.clickup.com/t/86d3ab4rw) — "AA Cashier, ISBAT complete a sale with multi-payment" — _Sprint 3, for qa_
- [86d3abxyn](https://app.clickup.com/t/86d3abxyn) — "AA Cashier, ISBAT split a payment across multiple tender types" — _Sprint 3, for qa_
- [86d3fwwmg](https://app.clickup.com/t/86d3fwwmg) / [86d3fwwmk](https://app.clickup.com/t/86d3fwwmk) / [86d3fwwmq](https://app.clickup.com/t/86d3fwwmq) — Credit Application Form → Finance Officer approval → block Charge invoice until approved (3-ticket chain) — _Sprint 3, to do / to do / in progress_
- [86d3qbveq](https://app.clickup.com/t/86d3qbveq) — "AA Cashier, ISBAT have any credit or charge sale routed for manager approval regardless of whether it contains a serialized item" — _Sprint 3, for qa_
- [86d3d19rc](https://app.clickup.com/t/86d3d19rc) — "AA Cashier, ISBAT run an end-of-day cash close that moves collected payments from Undeposited Funds to Cash in Transit and generates a CIT slip" — _Sprint 4, to do_ (also relevant to Scenario 12)
- [86d3d19rz](https://app.clickup.com/t/86d3d19rz) — "AA Accountant, ISBAT have POS sales automatically post journal entries for revenue, tax, COGS, and payment to the GL" — _Sprint 4, to do_ — **directly covers Gap 2 below** (COGS posting is weighted-average-only and silently non-blocking); also relevant to Scenario 14

**Not found in Sprint 3-5:** No ticket for the Agent Commission ledger UI (the backend fires correctly per this doc's "What's already done," but nothing tracks building its frontend view).

## The scenario we're building toward

A walk-in customer buys a phone on installment at a branch:

1. Find or create the customer via CRM (barangay, customer type; no purchase required to exist).
2. Start the sale, pull the customer from CRM, tag the selling agent.
3. Add the item by serial — blocked without a matching serial; split aircon needs indoor+outdoor; furniture set uses one serial across part-SKUs.
4. Price, discount, 12% VAT (inclusive) shown.
5. Cash or Credit — installment shows term options + MI (amount financed × factor), down payment kept separate.
6. Take payment — cash/GCash/card/bank, splittable across tenders, each mapped to a GL account.
7. Release document — cash sale → digital RFD; credit sale → Application Form + RFD; manager approval where required.
8. Post automatically — inventory by serial, journal (sale/VAT/COGS/payment), AR + installment schedule for a charge sale.
9. Credit the agent (commission) and count toward branch quota.
10. End of day — Undeposited → Cash in Transit, drawer ends at ₱0.00.

## What's already done ✅

1. **Find or create customer** — `checkout/page.tsx:576` calls `searchCustomers()`; standalone creation at `crm/customers/new/_components/NewCustomerForm.tsx` using `PhilippineAddressPicker.tsx` for barangay. `Customer.customerType` at `backend/prisma/schema.prisma:3242`. Customers exist independent of any sale.
2. **Selling agent tagging** — `sellingAgentId` is optional (`backend/src/pos/dto/pos.dto.ts:549`), searchable-by-name combobox at `frontend/.../pos/checkout/page.tsx:1987-1991`, resolved server-side at `backend/src/pos/transactions.service.ts:210-222`.
3. **Serial-scoped line items** — confirmed still working: secondary-serial requirement (split aircon) at `transactions.service.ts:2180-2227`; furniture-set bundle and branch-scoped serial blocking previously verified and unchanged.
4. **Price/discount/VAT** — real and configurable, not hardcoded. `TaxRate` model (`schema.prisma:686-699`) seeded `rate: 12`, name `'VAT 12%'` (`prisma/seed.ts:2753-2754`); `PosConfig.defaultPricingMode` (`schema.prisma:2064`, default `"exclusive"`) with per-line override; VAT-inclusive extraction at `transactions.service.ts:436-439`; toggle in `pos/config/_components/PosConfigClient.tsx`.
5. **Cash/Credit term picker** — down payment and MI tracked as separate state (`checkout/page.tsx:299,685-693,1081-1082`), MI shown via `installmentPreview.monthlyInstallment`.
6. **Multi-tender split payment** — a real feature, not single-tender-only. `PosPayment` is one-to-many on `PosTransaction` (`schema.prisma:1894-1910`); `addPaymentRow()` (`checkout/page.tsx:875`) loops `addPayment()` per tender row (`:1218-1222`). Each method maps to its own GL account via `PAYMENT_METHOD_MAPPING` (`backend/src/pos/pos-posting.service.ts:49-63`) — e.g. cash → Undeposited Funds, card → POS_CARD, GCash/Maya → POS_EWALLET, bank transfer → POS_BANK_TRANSFER.
7. **Manager approval gate** — release-form approval workflow exists and works (verified in an earlier session): Cashier submissions land in "Pending Approval," Branch Manager/Business Owner approve via `/pos/release-approvals`; a manager ringing up their own sale bypasses the extra approval step.
8. **Serial deduction + journal posting (sale/VAT/AR/installment schedule)** — confirmed at `transactions.service.ts:1689-2149`.
9. **Agent commission fires correctly; Sales Quota confirmed fully removed** — see gaps below for the commission UI gap. Grep for "quota" (case-insensitive) across `backend/src/pos`, `backend/src/crm`, and the frontend pos/crm route folders returns zero `SalesQuota`/`salesQuota` hits — only the unrelated `ProcurementQuota` (procurement module) and `Quotation` (sales quote) at `schema.prisma:4341,3466`. The prior revert was clean.
10. **EOD CIT sweep** — `sessions.service.ts:177-191` sums only `cash` + `custom` payment methods to sweep to Cash-in-Transit; non-cash tenders post directly to their own clearing GL accounts at sale time (`pos-posting.service.ts:54-61`) so they're correctly excluded from the sweep. "Drawer ends at ₱0.00" holds for the physical cash drawer.

## What's not done / gaps ❌⚠️

1. **RFD / Application Form has no printable document artifact.** `PosReleaseFormRequest` (`schema.prisma:1707`) computes a `requestType: 'RFD' | 'Application Form' | 'RFD + Application Form'` label (`backend/src/pos/release-form-requests.service.ts:256-270`) and drives the approvals UI (`pos/release-approvals/_components/ReleaseApprovalsList.tsx`) — but no PDF/print/export code exists anywhere in the POS frontend (no `@react-pdf`, no `window.print`, no PDF lib). It's a status-tracked approval record with a type label, not a document a branch can hand to a customer or file.
2. **COGS posting is weighted-average-only and silently non-blocking.** `pos-posting.service.ts:76-87` and `transactions.service.ts:593-598` both explicitly flag FIFO/LIFO as a known, deferred follow-up. Worse: COGS posting skips silently on a mapping failure (`pos-posting.service.ts:160-161`) rather than failing the sale — a missing COGS/Inventory account mapping produces an unbalanced-looking P&L with no error surfaced to anyone.
3. **Agent Commission ledger has no UI.** Backend fires correctly and records every commission (`transactions.service.ts:1708-1739`), but there is no frontend consumer anywhere — only a raw JSON endpoint (`GET /crm/agents/:id/commissions`). Not broken, just orphaned.

## Closing the gaps

Ordered by risk/value.

### 1. Make COGS posting failures visible, not silent

**Problem**: `pos-posting.service.ts:160-161` swallows a COGS/Inventory mapping failure instead of surfacing it, so a sale can complete while COGS never posts, with nothing flagging the gap.
**Fix**: at minimum, log at `error` level and surface a non-blocking banner/notification to the Business Owner/Accountant (e.g. a dashboard "N sales missing COGS postings" tile, or an alert in the existing account-mapping unconfigured-warning pattern already used on `/pos/gl-mapping` and `/accounting/account-mapping`). Decide separately whether FIFO/LIFO support is in scope — this fix is about visibility, not costing method.

### 2. Decide RFD/Application Form's document requirement

**Problem**: the scenario explicitly says "digital RFD" / "Application Form + RFD" as things generated and handed off, but only a status label exists today.
**Fix**: either (a) confirm with the business that a status-tracked approval record satisfies "digital RFD" as-is (many teams do mean "a tracked digital record," not literally a printable PDF) and close this as no-gap, or (b) if a real printable/downloadable document is required, add a PDF-generation step (e.g. `@react-pdf/renderer` or server-side HTML-to-PDF) triggered on approval, populated from `PosReleaseFormRequest` + the linked `PosTransaction`/`Customer` data already available.

### 3. Build the Agent Commission UI, or explicitly shelve it

**Problem**: a fully-working backend feature (rate config on `Agent`, ledger on every completed sale) has zero UI, so Sales Agents/Business Owners can't see what they've earned without hitting a raw JSON endpoint.
**Fix**: add a simple commission ledger view — e.g. under CRM → Sales Agents → [agent] detail, a table sourced from the existing `GET /crm/agents/:id/commissions` endpoint (no new backend work needed). If commission isn't actually a near-term priority, note that explicitly rather than leaving it silently orphaned.

## Dead code / unused-feature flags

- **Agent Commission ledger endpoint** — live, correct, zero consumers. See Closing Gap 3 above; this is "build or explicitly deprioritize," not delete (the data being recorded is real revenue-share liability, deleting the recording logic would lose it).

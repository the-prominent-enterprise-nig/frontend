# Client Feedback (2026-07-21) — Gap Analysis & Plan

Source: raw feedback notes across CRM, Inventory, and POS, not yet tied to ClickUp tickets.

**Note found after this doc was first written:** this exact feedback (word-for-word, per item) was already logged on 2026-07-17 ("Staging CRM & POS client meeting") across four existing per-scenario companion docs — [scenario-02-crm-customer-profile-updates.md](./scenario-02-crm-customer-profile-updates.md), [scenario-05-receiving-updates.md](./scenario-05-receiving-updates.md), [scenario-10-purchasing-ap-updates.md](./scenario-10-purchasing-ap-updates.md), and [scenario-12-eod-cit-monitor-updates.md](./scenario-12-eod-cit-monitor-updates.md). Those are this project's established tracking mechanism for "newer client feedback not yet merged into a scenario's gap analysis" — this doc duplicates that work as a single-page overview. **Implementation status is now tracked in those per-scenario docs** (each has a dated "Status:" note under the relevant item); treat this doc as a snapshot/index, not the source of truth going forward.

This doc maps each ask to current codebase state, proposes an approach, and sizes it. No ClickUp tickets created, pending go-signal per item (see [[feedback_clickup_go_signal]]).

Sizes: **S** < 1 day · **M** 1–3 days · **L** 3–7 days, touches shared infra · **XL / blocked** needs a product decision or another scenario resolved first.

---

## CRM

### 1. Add "Employee" buyer type (Individual, Business, Employee)

- **Current state**: `CustomerType` enum (`prisma/schema.prisma:3356`) only has `individual` / `business`. `Customer.customerType` defaults to `individual`.
- **Proposed**: add `employee` to `CustomerType` (migration), thread through CRM create/edit DTOs and the frontend type selector. Likely also want an optional `employeeId`/`employeeNumber` free-text field on `Customer` for identification.
- **Size**: S–M
- **⚠️ Flag**: HR is explicitly out of scope for this NIG engagement ([[project_charter_nig]]). Please confirm this is just a labeled category + a manually-entered ID field — **not** a lookup against a real employee roster/HR system. Also confirm whether "Employee" buyers get any special pricing/discount (adds scope) or this is purely for segmentation/reporting.
- **Status: Implemented 2026-07-21** — confirmed no HR lookup, existing roles/pattern only. See [scenario-02-crm-customer-profile-updates.md](./scenario-02-crm-customer-profile-updates.md).

### 2. CRM bank details / bank transfer

- **Current state**: `BankAccount`, `BusinessBankAccount`, `SupplierBankAccount` models already exist (`schema.prisma:225, 965, 1185`) with an identical shape; POS's `PaymentMethod` enum already includes `BANK_TRANSFER` (`schema.prisma:325-329`). `Customer` has **no** bank-account relation today.
- **Proposed**: add a `CustomerBankAccount` model mirroring `SupplierBankAccount`, relate it to `Customer`, surface a "Bank Details" section on the CRM customer profile.
- **Size**: S–M — well-precedented pattern (third time building the same shape), low risk.
- **Open question**: is this for recording the customer's bank details for refunds/verification, or documenting that they pay via bank transfer for collections? Answer determines if this is a UI-only add or also touches AR/collections/refund flows.
- **Status: Implemented 2026-07-21** (use case not re-confirmed — see [scenario-02-crm-customer-profile-updates.md](./scenario-02-crm-customer-profile-updates.md) for the caveat).

---

## Inventory

### 1. Hide unit price from Branch Manager & employees (keep QTY / Received#)

- **Current state**: no `@Roles`/role-guard usage anywhere in `src/inventory/controllers/*.ts` today — inventory endpoints aren't role- or field-restricted at all. `costPrice`/`sellingPrice` (`items.dto.ts:67,75`) come back in the same payload as qty/received-quantity fields, with nothing server-side to strip them per role.
- **Proposed**: this can't be a frontend-only hide — a client that hides the column but still returns the field in the API response is trivially bypassed by calling the API directly, the same class of gap already tracked in [[project_rbac_privilege_escalation_bugs]]. Needs real role-based field filtering server-side (an interceptor or per-endpoint field-omit-by-role) on items/stock list & detail endpoints, plus hiding the columns client-side too.
- **Size**: **L — bigger than it looks.** There's no existing role-based _field-visibility_ infrastructure to hook into; this would be the first of its kind. It overlaps directly with the standing RBAC redesign effort ([[rbac-redesign-plan]]) — recommend building it on top of that guard/permission model rather than a one-off masking patch that'll conflict with it later.
- **Open question**: does "employees" mean the POS Cashier role specifically, or every non-manager, non-owner inventory-facing role?

### 2. QTY and Received# okay to keep

No action — confirmation only, included above.

### 3. Printable Receiving Report (RR)

- **Current state**: receiving already works functionally (`GoodsReceipt`/`GoodsReceiptLine`, `stock.service.ts::receiveStock`, covered in [[scenario-05-receiving-plan]]) — but there is no printable/PDF output for it anywhere. `pdfkit` is already a project dependency (`package.json`), so this reuses existing infra rather than adding a new one.
- **Proposed**: add a PDF-export endpoint for a completed `GoodsReceipt` (header + lines; **no pricing** — see visibility item above and freebies/serials items below for what the RR should/shouldn't show).
- **Size**: S–M, and cheapest if built alongside items 7 (PO PDF) and 5 (cheque print) below so all three share one PDF-rendering approach.

### 4. Configuration: payment methods and accounts (for suppliers)

- **Current state**: `Supplier` only has `paymentTerms`/`discountTerms` as free-text strings — no configurable payment-method list or GL account mapping. On the AP side, `ap-bills.service.ts::recordPayment` takes free-text `method`/`reference` fields, no structured config either. **Root blocker**: [[scenario-10-purchasing-ap-plan]] already found that `APBill` references a separate `Vendor` model, not `Supplier` — Procurement and AP currently use two disconnected notions of "who we owe money to," and that doc flags this as an unresolved product decision (merge `Vendor` into `Supplier`, or keep both with an explicit link).
- **Proposed**: **flagging as blocked, not just large.** Building supplier payment-method/account config now would either attach it to the wrong entity (`Vendor`, which AP actually uses) or duplicate it across both — resolve the Vendor/Supplier decision first.
- **Size**: **XL / blocked** on the Vendor↔Supplier decision.

### 5. Supplier payment via checks, after delivery received

- **Current state**: this is already a known, scoped gap — [[scenario-10-purchasing-ap-plan]] flags "no cheque printing" (`ap-bills.service.ts:168` has free-text fields only, no `chequeNumber`), and separately flags the RR↔Invoice 3-way-match link as entirely missing (needed to gate "pay only after delivery received").
- **Proposed**: not new work — pick up scenario-10's existing plan (add `chequeNumber` + a print template reusing the same PDF approach as item 3, then gate payment recording on the RR↔Invoice link once that exists).
- **Size**: M, but shares the Vendor/Supplier + RR↔Invoice prerequisites as item 4 above — sequence after that decision.

### 6. Special discounting — last price / bypass; add SRP, discounted cost, actual cost

- **Current state**: no `SRP`, `discountedCost`, `actualCost`, or discount-type fields exist anywhere in the inventory/PO schema or services today — entirely new.
- **Proposed**: add SRP / discounted cost / actual cost fields plus a discount-type (percentage vs. fixed amount, "supplier provides the %/amount") to `PurchaseOrderLine` or a supplier-item price list.
- **Size**: M
- **⚠️ Open question — need the client's definition before scoping further**: what should "bypass" bypass? An approval step on special-discount POs? A price-list lookup? Can't size this precisely without that answer.

### 7. PO: downloadable PDF instead of "send to supplier"

- **Current state**: no automatic "send to supplier" (email) code path found in `purchase-order.service.ts` today. Worth a quick confirm with the client/frontend on whether "send to supplier" currently exists as a frontend-only affordance, since the backend shows nothing to replace.
- **Proposed**: add a PO PDF-export endpoint (same shared pdfkit approach as items 3 and 5) so the client downloads and routes the PO themselves.
- **Size**: S once the shared PDF approach exists from item 3.

### 8. Add a freebies section (PO / receiving lines)

- **Current state**: no freebie concept exists on `PurchaseOrderLine` or `GoodsReceiptLine` today.
- **Proposed**: add an `isFreebie` / free-quantity flag on PO and receipt lines — zero-cost, still tracked into stock.
- **Size**: S–M

### 9. Only the Receiving Report should show serial numbers

- **Current state**: [[scenario-05-receiving-plan]] already notes serials are displayed read-only in more than one place today, e.g. `PoReceiptsPanel.tsx:227-230` — not just on a receiving report view.
- **Proposed**: audit every current display location for serial numbers and restrict to the RR view only.
- **Size**: S, but start with a quick audit — there may be more display locations than the one already flagged.
- **Status: Partially implemented 2026-07-21** — added to the RR only, everything else deliberately left untouched (functionally load-bearing pickers). See [scenario-05-receiving-updates.md](./scenario-05-receiving-updates.md) for the full scope narrative.

---

## POS

### 1. End-of-day summary of cash transactions → Excel export (collection report / turnover / reconciliation)

- **Current state**: session close and Cash-in-Transit reporting already exist (`sessions.service.ts`, `cash-drawer.service.ts`), and [[scenario-12-eod-cit-monitor-plan]] already covers end-of-day CIT balance monitoring in depth — but that doc's scope is CIT balances, not a full per-transaction cash Excel export. **No Excel-generation library exists in the project today** (`package.json` has `pdfkit` only — no `xlsx`/`exceljs`).
- **Proposed**: add an Excel-export endpoint for end-of-day cash transactions per session/branch.
- **Size**: M
- **⚠️ Flag**: needs a new dependency (e.g. `exceljs`) — flagging for approval before adding. Also confirm scope against scenario-12 first so this doesn't duplicate that doc's monitor work — same "closing the branch" moment, different report shape.

### 2. OR# + complete transaction details for EOD/closing sales

- **Current state**: POS transactions already have a `transactionNumber` field (`schema.prisma:1666`, `pos.dto.ts`) — need to confirm with the client whether "OR#" maps to this existing field or is meant to be a separate official-receipt sequence.
- **Proposed**: most likely a report/detail-view addition on existing transaction data (not new data capture) — a per-transaction detail export grouped by session/day.
- **Size**: S–M
- **⚠️ Open question**: the note says "Warp mentioned it's in the accounting module" — confirm with Warp/accounting which existing doc this is meant to extend ([[scenario-11-collections-ar-aging-plan]]? [[scenario-12-eod-cit-monitor-plan]]? something untracked?) before building, to avoid a duplicate report.

---

## Recommended sequencing / decisions needed before implementation

1. **Vendor ↔ Supplier unification** ([[scenario-10-purchasing-ap-plan]], gap 1) blocks both Inventory items 4 and 5 (payment methods/accounts config, supplier check payments). This is the single biggest unblock — resolve it first.
2. **Price-visibility-by-role** (Inventory item 1) should be scoped as part of [[rbac-redesign-plan]], not as a standalone patch — there's no field-visibility infrastructure to bolt onto yet.
3. **New dependency approval** — Excel export (POS item 1) needs a library decision (`exceljs` suggested) since none exists in the repo today.
4. **Three open definition questions** need client answers before sizing can firm up: "bypass" (Inventory item 6), whether "Employee" buyer type needs any pricing implication (CRM item 1), and what "OR#" maps to / which report Warp meant (POS item 2).
5. Everything else (CRM bank details, printable RR, PO PDF, freebies, serial-number scoping) is independently buildable in parallel and low-risk — good candidates to start first while the above decisions are made.

Once approach + open questions are confirmed per item, next step is creating ClickUp tickets (pending explicit go-signal) and running each through `/implement-scenario` or a dedicated plan doc if the item grows past a quick fix.

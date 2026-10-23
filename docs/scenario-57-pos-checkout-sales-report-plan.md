# Scenario 57 — POS Checkout Follow-ups & Sales Report Correctness — Gap Analysis & Closing Plan

**Source**: the client's POS checklist relayed 2026-09-21, "In POS Checkout, we should have" section, plus four sales-report lines added the same day:

> - Agent field re-added
> - Comment text under down payment removed
> - "New Sale" button removed
> - Sales report matching the provided Excel format, with UI updates and "margin per sale" removed

> Sales Report:
>
> - They should not see the details involving cash of other branches
> - Remove the Gross / net sales to LCP
> - Fix the totals. Currently using the new w/vat value. Use the actual price.
> - When totalling for sales report, only generate the income for the day (upon collection)

Two clusters that happen to share a screen boundary: three small checkout-surface asks, and five sales-report asks of which **three are correctness, not cosmetics**. The report items are the substance of this scenario; the checkout items are quick once their ambiguities are resolved.

**Numbered 57, not 56**: two scenarios already hold 56 on `development` (`scenario-56-excel-pivot-reports-plan.md` and `scenario-56-inventory-po-uat-followup-plan.md`).

**Overlaps Scenario 56 — _Reports as Excel Files With In-Depth Pivot Tables_.** That scenario owns the workbook side of reporting (itself a follow-up to Scenario 47's Excel exports). Anything about what the .xlsx contains — including "matching the provided Excel format" in this checklist's own wording, and the Margin columns this scenario deliberately left in `sales-report.workbook.ts` — belongs there, not here. This scenario stops at the screen.

Not in scope, from the same checklist but belonging elsewhere: the agent-vs-in-office indicator on credit applications (schema work, its own scenario), "eligible for rebate" (no eligibility rule defined yet), branch-restricted sales/cash visibility for CRM, and the collection receipt fields still pending from Ms. Sam.

## What's already done ✅

Verified against `development` on 2026-09-21, not taken on trust:

- **The sales report already branch-scopes its data fetch.** `SalesReportService.resolveBranchIds()` (`backend/src/pos/reports/sales-report.service.ts:118`) returns `[actorBranchId]` when the actor is branch-tied, and `fetchLines()` takes `actorBranchId` through. The plumbing exists — what needs checking is whether the controller passes it on every route and whether "details involving cash" means something the current scoping misses.
- **The backend still accepts a selling agent.** `sellingAgentId` remains on the POS transaction DTO (`backend/src/pos/dto/pos.dto.ts:681`), `PosTransaction.sellingAgentId` still feeds commission and the Salesperson row on an installment ledger, and `getSellingAgents()` is still exported from `pos-actions.ts:1776`. Only the checkout UI went.
- **Sales reports are already withheld from Cashier.** The routes are gated on `pos:reports:read`, which `modulePermIdsExcept('pos', …, 'reports:read', …)` deliberately excludes from the Cashier role — a Branch-Manager-tier view by existing design.

## What's not done / gaps ❌⚠️

1. **Agent field is gone from checkout, and cannot simply be restored.** ❌
   Removed in commit `1b82138` ("POS checkout UX cleanup") — `git show 1b82138 -- 'src/app/(app)/(dashboard)/pos/checkout/page.tsx'` shows the full removed block: the picker state, the `getSellingAgents()` load, and `sellingAgentId` on submit.
   **The blocker**: `getSellingAgents()` calls `GET /crm/agents`, which requires `crm:agents:read`. Checked live — **only Business Owner holds it**, and no POS-scoped agents route exists. Restoring the picker as-is renders an empty list for every cashier, i.e. for the only role that rings up sales.

2. **"Margin" is still on the sales report.** ⚠️
   `SalesReportsView.tsx:123` (stat tile) and `:142` (per-row column). The checklist says "margin per sale", which reads as the column.

3. **"New Sale" — no such button exists in checkout.** ⚠️
   `checkout/page.tsx:3214` is a **label**, the top-bar page title beside the cart icon. `:6368` and `:6438` are **"Start New Sale"** buttons that reset the cart after a completed or cancelled sale. The only true "New Sale" _buttons_ are outside checkout: the POS landing quick-link (`pos/page.tsx:159`) and the dashboard quick action (`QuickActionsWidget.tsx:10`), both plain links to `/pos/checkout`. The ask cannot be actioned without knowing which.

4. **"Comment text under down payment" could not be located.** ⚠️
   No helper/comment text was found under the down-payment field in checkout. Either it has already gone, or it is on a screen other than the one searched.

5. **"Gross / net sales to LCP" — term unknown.** ⚠️
   "LCP" appears nowhere in the report code or schema. The report's current stat tiles are Net Sales, Gross, Discounts, Margin, Refunds, Units; its columns are Units, Gross, Discount, Net Sales, Margin, Refunds. Which of these the client means, and what LCP expands to, is not inferable.

6. **Totals are built from `unitPrice`/`lineTotal`, whose VAT treatment depends on config.** ❌
   `toDetailRow()` computes `gross = unitPrice × quantity`, `net = lineTotal`, `totalCost = unitCost × quantity`. All seven price lists in this tenant are `pricingMode: inclusive`, and checkout applies `DEFAULT_VAT_RATE` (12%) via `effectiveUnitPrice`. So whether the figure shown is VAT-inclusive depends on which value was persisted — which is exactly what "currently using the new w/vat value, use the actual price" is complaining about. **Needs the client to define "actual price"** before any arithmetic changes.

7. **The report recognises revenue at sale, not at collection.** ❌
   `fetchLines()` draws from transaction lines by transaction date. "Only generate the income for the day (upon collection)" describes **cash-basis recognition** — an installment sale would contribute its down payment on day one and each due as it is collected, not its full value at sale. That is a materially different report, not a filter change, and it interacts with the Daily Collection Report built in Scenario 53.

## Conventions this scenario must follow

- **Role access hierarchy** — Business Owner holds everything; an Employee-level capability is automatically available upward. Any new POS-scoped agents permission must include Business Owner.
- **Branch data scoping** — list, detail _and_ action endpoints, mirroring `transfers.service.ts`; 404 (not 403) for out-of-branch lookups; Business Owner (`actorBranchId === null`) unrestricted.
- Reuse `SearchableSelect` for the agent picker rather than restoring the hand-rolled combobox from `1b82138` — the type-ahead component is the current idiom and already handles reopen/Enter behaviour.

## Closing the gaps — proposed parts

### Part 1 — POS-scoped agents route + agent field back in checkout

Backend: `GET /pos/agents` delegating to the same `AgentService`, behind a POS permission, mirroring how `posCustomersApi`/`pos-customers.controller.ts` gives POS its own door onto `CustomerService`. Frontend: point `getSellingAgents()` at it and restore the picker with `SearchableSelect`, passing `sellingAgentId` on submit.

### Part 2 — Margin off the sales report

Remove the per-row Margin column; keep the Margin totals tile (confirmed 2026-09-21).

### Part 3 — Sales report totals on the correct price basis

Blocked on Open question 3 below.

### Part 4 — Cash-basis (collection-date) revenue recognition

Blocked on Open question 4 below. Likely the largest part; may warrant its own scenario.

### Part 5 — Remaining checkout cosmetics

The "New Sale" removal and the down-payment comment text, once Open questions 1 and 2 are answered.

## Open questions

1. **Which "New Sale"?** The checkout top-bar label, the two "Start New Sale" reset buttons, the POS landing tile, or the dashboard quick action.
2. **Where is the "comment text under down payment"?** Not found on the checkout down-payment field.
3. **What is "the actual price"?** VAT-exclusive line value, the price-list price as configured, or something else — and does the same basis apply to Gross, Net and the totals tiles alike?
4. **What does "income for the day (upon collection)" cover?** Cash sales on their sale date plus installment amounts on each collection date? Does a down payment count on the sale date? Should refunds net against the collection day or the original sale day?
5. **What does "LCP" stand for**, and which existing tile or column is "Gross / net sales to LCP"?
6. **Agent route approach** — POS-scoped `/pos/agents` (recommended, consistent with the customers precedent) versus granting Cashier `crm:agents:read` (faster, but widens CRM access and cuts against the 2026-09-19 "one dataset, two doors" decision).

## Related ClickUp Tickets

None identified yet — to be matched before Phase 7.

## Implementation Log — 2026-09-21

**For this scenario, I have done:**

- **Part 1 (gap 1) — Selling Agent restored to checkout.** New `GET /pos/agents` (`backend/src/pos/pos-agents.controller.ts`) delegating to the same `AgentService` CRM uses, wired into `PosModule`. Gated on **`pos:transactions:read`, not a new permission**, mirroring `/pos/catalog/price-use-types`, which exposes inventory-administered reference data to POS exactly this way. That choice was deliberate: a new `pos:agents:*` permission would have needed an explicit Business Owner backfill, since Business Owner's "gets everything" grant is evaluated once at seed time and is not a live wildcard. `status` is forced to `active` server-side rather than accepted from the caller, so a resigned agent cannot be attached to a new sale. Frontend: `getSellingAgents()` repointed at the POS route, picker restored with `SearchableSelect` rather than the hand-rolled combobox `1b82138` removed, `sellingAgentId` back on the sale payload as `undefined` (not `''`) when unset.
- **Part 2 (gap 2) — "margin per sale" removed.** Per-row Margin column dropped from `SalesReportsView.tsx`; the Margin **totals tile stays**, per the developer's decision — the ask was specifically per-sale. Both `colSpan` values dropped from `+6` to `+5` so the loading and empty-state rows still span the table.
- **Part 2b — Branch and Brand filters converted to `SearchableSelect`** (developer request during Part 2). Both were native `<select>`s, unusable at this data's size: **41 branches, 127 brands**, scrolled blind with no way to type. Now type-ahead, clearable (so "All branches"/"All brands" is reachable from a chosen value) and portalled (the filter bar would otherwise clip the popup).

**Worth flagging:**

- **Backend e2e 7/7, frontend e2e 4/4 — and both suites turned out to be runnable on Windows**, contrary to the standing assumption. Backend: point `DATABASE_URL` at the dedicated `the-prominent-enterprise-test` DB and invoke jest directly, skipping `pretest:e2e`'s destructive reset. Frontend: `E2E_BASE_URL=http://localhost:3000 E2E_FRONTEND_PORT=3000 E2E_BACKEND_PORT=3001 npx playwright test` — the `npm --prefix ../backend` path bug in `playwright.config.ts` only bites when Playwright has to _start_ the isolated stack, and `reuseExistingServer: true` skips that when the ports already answer. The path bug itself is still unfixed.
- **The Excel export still carries Margin** — summary sheet (`Cost`, `Margin`) and detail sheet (`Unit Cost`, `Total Cost`, `Margin`) in `sales-report.workbook.ts`. So "margin per sale" is removed from the screen but still downloadable. Left deliberately, and it should be picked up under **Scenario 56 (_Reports as Excel Files With In-Depth Pivot Tables_)**, which owns the workbook side — not reopened here.
- **The dev DB's `agents` table was empty**, so the restored picker showed nothing on first test. Four agents (3 active, 1 inactive) were hand-inserted to unblock verification. The seed _does_ create agents (`seed.ts:5953`) — this is the third piece of `seed.ts` confirmed missing from this database, alongside customers and retail stock, and the agent block sits immediately before `seedInventory`, so the seed likely failed around there. Not fixed here.
- **Gaps 3-7 remain open, all blocked on client answers**, not on engineering: what "the actual price" means (gap 6), what "income for the day (upon collection)" covers (gap 7), what "LCP" stands for (gap 5), which "New Sale" is meant (gap 3 — there is no button by that name in checkout at all), and where the down-payment comment text lives (gap 4). See Open questions.

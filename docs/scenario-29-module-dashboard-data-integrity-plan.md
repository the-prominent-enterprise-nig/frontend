# Scenario 29 — Module Dashboard Data Integrity — Gap Analysis & Closing Plan

Source: not from either client PDF (`NIG-TPE-Module-Scenarios.pdf` or the Draft 2 map) — new scenario, added the same way Scenarios 22-25 were: as a real gap that surfaced live during development rather than from a specific audit row. It falls out of the dashboard data-wiring initiative (`feat/dashboard-data-wiring`, frontend PR #132 / backend PR #124) — once the main dashboard's widgets were being wired to real data widget-by-widget, the natural next question was whether the three module-level "Intelligence" dashboards (Accounting, Inventory, CRM) that already existed independently of that effort could actually be trusted the same way.

**Scope note (developer-confirmed, 2026-08-12)**: covers Accounting, Inventory, and CRM module dashboards only. Explicitly excludes the main `/dashboard` (already in an open PR, out of scope for this pass) and the POS dashboard — a "Sales Breakdown" widget was prototyped for POS in the same session, verified working end-to-end, then deliberately reverted: POS's overview page is operational/cashier-facing (stat cards, quick links, recent transactions, matching its "Start a New Sale" framing), not an analytics dashboard like the other three, and there was no existing need pulling for it.

**Structure note**: organized per-module (Accounting → Inventory → CRM) rather than by finding-category, so each module's section is a self-contained, independently-workable unit — matching how this developer likes multi-part work scoped (bounded, separately approvable, one module at a time rather than batched).

**Verified against**: `development` branch, frontend HEAD `87b6f7c`, backend HEAD `0ceb2b8` (2026-08-12).

**Testing**: this doc is gap-analysis-and-closing-plan only — no code has been touched yet, so there are no tests to report. Per this repo's usual `implement-scenario` convention, once someone works through a module's Closing the Gaps section below, each part gets its own Jest e2e (backend) + Playwright (frontend) tests plus manual-testing instructions, logged in an Implementation Log section added to this doc at that time — the same pattern every other closed scenario in [scenario-checklist.md](./scenario-checklist.md) followed.

**Existing coverage, checked rather than assumed**: none of the 27 findings below would have been caught by anything that currently runs. The frontend has no unit test suite at all (`pnpm test` is a no-op per its CLAUDE.md), and no Playwright spec navigates to `/accounting`, `/inventory`, or `/crm`'s dashboard route. On the backend, there are no unit specs for the aging/stockout/reminder logic involved; the one incidental hit — `test/customer-unification.e2e-spec.ts`'s "CU-04," which calls `GET /reports/aging/ar` — tests an unrelated concern (a customer name resolving correctly post-merge) and only asserts `.expect(200)`, not the response shape, so it passes regardless of the frontend's `extractAging()` bug. These bugs weren't just unfixed — nothing currently running could have caught any of them.

## Related ClickUp Tickets

None found. Net-new scope, surfaced live rather than sourced from an existing ticket.

## The scenario we're building toward

A manager (or the developer wiring these dashboards) opens the Accounting, Inventory, or CRM "Intelligence" dashboard and trusts that what it shows reflects real, current business data:

1. Every KPI, chart, and alert panel is either genuinely computed from live data, or visibly absent — never silently wrong.
2. A risk panel (aging, stockout, overdue reminders) that shows "nothing to worry about" actually means the check ran and found nothing — not that the check never ran at all.
3. A number with a cap or approximation (pagination, a fixed lookback window) says so, or is fixed to reflect the true total.
4. Contract drift between the two independently-evolving repos (frontend expecting one JSON shape, backend sending another) gets caught before it reaches a dashboard, not discovered by a manual audit.
5. Data refreshes on its own, not just once when the page loads.

**Result**: the three module dashboards are as trustworthy — and as alive — as the main dashboard is becoming, widget by widget.

## Cross-cutting findings (identical across all three modules — read once, applies everywhere below)

Three independent line-by-line audits (one per module) traced every widget on each dashboard from its frontend fetcher/action through the actual backend controller → service → Prisma query, cross-checked against real dev-DB row counts.

1. **No auto-refresh anywhere.** Accounting, Inventory, and CRM all fetch their data exactly once, on mount, via a `useEffect(() => { load() }, [...])` + manual "Refresh" button pattern (`accounting/page.tsx:368,543,580`; `inventory/page.tsx:334,514,557`; `crm/page.tsx:341,516,551`) — confirmed no `refetchInterval`, `refetchOnWindowFocus`, or `setInterval` anywhere in any of the three files. A manager who leaves one of these dashboards open in a background tab sees numbers that are stale the instant anything changes underneath, with no indication they're stale. POS's overview page (out of scope for this doc, but the reference implementation) already uses TanStack Query with `refetchInterval: 30_000` + `refetchOnWindowFocus: true` on its stat-card queries — the same pattern was prototyped for POS's (reverted) Sales Breakdown widget earlier in this initiative and confirmed working end-to-end.
2. **No runtime response validation on any frontend server action, in any of the three modules.** Every dashboard action casts backend JSON straight to a TypeScript type with no `zod.safeParse` (or equivalent). This happens to be the specific root cause of three of Inventory's broken widgets (below) — the two repos drifted apart and nothing caught it — but the missing-validation pattern itself is systemic across the whole frontend, not unique to Inventory.
3. **No commented-out JSX blocks or TODO/FIXME/"not implemented" markers exist in any of the three dashboard files** — every widget is wired to a real network call; the gaps below are entirely about what that call actually returns, never about missing wiring.

---

## Accounting — Financial Intelligence

`accounting/page.tsx`

### What's already done ✅

- P&L KPIs (Total Revenue, Total Expenses, Net Profit/Loss, Gross Margin) — real `Transaction`/`Account` aggregation (`reports.service.ts:111-151`).
- Total Assets, Total Liabilities — real balance-sheet aggregation (`reports.service.ts:153-206`).
- AR Outstanding / Overdue Invoices, Open Invoices, Recent AR list, Overdue Receivables panel — real, tenant-scoped `ARInvoicesService.findAll` (`ar-invoices.service.ts:70-132`).
- AP Outstanding / Overdue Bills, Open Bills, Recent AP list, Overdue Payables grid — real `APBillsService.findAll` (`ap-bills.service.ts:301-331`).
- P&L Breakdown donut.

### What's not done / gaps ❌⚠️

**Actively misleading:**

1. **AR/AP Aging bar charts always render empty**, regardless of real overdue data. `GET /reports/aging/:type` (`reports.service.ts:285-327`) returns a flat array of rows each carrying its own `bucket` field; the frontend's `extractAging()` (`accounting/page.tsx:107-135`) only knows how to read `raw.buckets` or bucket-named object keys — neither exists on a plain array, so it always returns `[]`. Both cards permanently show "No AR/AP aging data available" even with real overdue invoices/bills seeded.

**Empty tables (code correct, nothing seeded):** 2. Cash on Hand / Bank Account Balances, Fixed Assets, Budget Alerts, Active Period — each hits a real, correctly-written query against a table (`businessBankAccount`, `fixedAsset`, `budget`, `fiscalPeriod`) that `seed.ts` never populates. The Bank Account Balances card doesn't even show an empty state — it silently unmounts (`accounting/page.tsx:860`).

**Architectural:** 3. **No tenant column at all** on `Account`, `JournalEntry`, `Transaction`, `Vendor`, `BusinessBankAccount`, `FixedAsset`, `FiscalPeriod`, or `Budget`, and `ReportsService` never filters by tenant. Every KPI built on these currently looks correct only because the dev seed has exactly one enterprise ("TechNova") — the day a second enterprise onboards, these would silently start blending both companies' numbers together.

### Closing the gaps

1. **Fix `extractAging()`** to read the real per-row `bucket` field from `/reports/aging/:type` instead of expecting `raw.buckets`. Until fixed, consider commenting out the AR/AP Aging cards (with a note pointing at this doc) rather than leaving them live and wrong — this repo's existing convention for parking non-functional widgets.
2. **Empty tables are a data question, not a code fix** — flag for whoever owns dev seeding; no code change needed unless the underlying feature (bank accounts, fixed assets, budgets, fiscal periods) itself is deprioritized.
3. **Confirm whether the tenant-scoping gap needs addressing now** — a platform-level schema gap, not a dashboard bug, currently invisible because only one enterprise is seeded. Flag for a dedicated conversation before a second enterprise ever onboards; not something to fix as part of a dashboard-widget pass.
4. **Add auto-refresh** — see cross-cutting finding #1. Land after item 1 above; auto-refreshing a chart that's wrong just means it stays wrong on a timer instead of staying wrong once.

### Dead code

- `s.bankBreakdown` (`accounting/page.tsx:477-485`) — computed and stored into state but never rendered; the actual grid uses `s.bankAccountsList` instead.
- `totalExpenses` fallback (`accounting/page.tsx:410-411`) — guesses at a backend field (`pnl?.totalExpenses`) that doesn't exist in the response shape.

### Missing widgets (plumbing already exists, just not surfaced)

- **Cash Flow Forecast** — backend `/cash-forecast` and frontend page already built, not linked from the dashboard at all. Given the other cards already show current-state cash/AR/AP, this is the single most natural addition.
- FX Revaluation (`/accounting/fx-revaluation`) — similarly built, similarly invisible.
- Module Navigation grid links only 12 of the module's 25 real pages (`credit-memos`, `debit-memos`, `vendors`, `expenses`, `general-ledger`, `tax-rates`, etc. are missing).

---

## Inventory — Inventory Intelligence

`inventory/page.tsx`

Dev-DB snapshot at audit time: 147 items, 1121 stock_balances, 45 warehouses, 3 reorder_rules, 1 stock_transfer, 0 reservations, 0 backorders, 0 batches.

### What's already done ✅

- Total Inventory Value — real FIFO/LIFO/AVCO costing (`costing.service.ts:107-146,474`).
- Total SKUs, Active Warehouses, Slow Moving / Dead Stock classification, Active Backorders, Returns Recorded — all genuinely wired, correctly queried, correctly paginated where it matters.

### What's not done / gaps ❌⚠️

**Actively misleading, highest priority:**

1. **Projected Stockouts is completely broken — always reads zero risk.** `GET /inventory/stock/stockout-alerts` returns `{alertWindowDays, alerts: [...]}`; the frontend action only accepts a bare array or `{data: [...]}`, gets neither, and fails silently to `{success:false}` on every call. Field names inside `alerts[]` don't match what the frontend reads either — the two sides were never integration-tested together. This is the single most consequential bug in the whole audit: a real stockout-risk feature that has never once worked.
2. **Low Stock Items panel reads a field (`currentQty`) the backend response doesn't have.** Effect: "Out of Stock" count is always 0, every alert row renders as `warning` severity (never the red `critical` state even at zero stock), quantity shown is blank/`NaN%`. Only 3 of 147 dev-DB items have a reorder rule at all, so even fixed, this can flag at most ~2% of the catalog today.
3. **Negative Stock Violations has the identical class of field-name mismatch** (`v.itemSku`/`v.quantity` vs. backend's `sku`/`onHandQty`) — currently moot (0 real violations) but would render blank the moment one occurs.

**Quietly wrong — undercounting or mislabeled:** 4. **Category/warehouse valuation charts built from only the first 50 of 147 items** (the valuation report's default page size), while the total badge next to them reflects the full 147 — the chart's proportions don't sum to the number displayed beside them. 5. **Total On Hand / Available Qty KPIs undercount by ~16% today** (58,937 vs. true 70,350) — summed client-side over a 500-row page of `stock_balances` with no backend total-quantity aggregate available as an alternative. 6. **"Inventory Aging Analysis" chart is mislabeled** — shows projected days-of-remaining-supply, not days-since-last-movement, and lumps zero-sales items (including freshly received stock) into the same "90+ days stale" bucket as genuinely dead stock. A correct, real `lastMovementAt`-based report already exists at `/inventory/reports/aging`; nothing in the frontend calls it. 7. **Transfer Activity status pills cover only 4 of 9 real transfer statuses** — the one real seeded transfer (status `requested`) shows as "0/0/0/0" in the pill strip while the list below correctly shows it.

**Empty tables (code correct, nothing seeded):** 8. Reserved Stock KPI and the Availability bar's "Reserved" segment are permanently 0 (`stockReservation` has 0 rows, `reservedQty` is 0 on every balance row); Expiring Soon can't show anything while `batches` has 0 rows.

### Closing the gaps

1. **Fix the stockout-alerts response adapter** to read `{alerts: [...]}` and align field names end-to-end — this single fix closes the most consequential gap in the whole audit. Until fixed, consider commenting out the Projected Stockouts panel (with a note pointing at this doc) rather than leaving it live and wrong.
2. **Align Low Stock and Negative Stock Violations field names** to what the backend actually returns (`currentAvailableQty`/`currentOnHandQty`/`shortfall`, `sku`/`onHandQty`). Lower urgency than item 1 — Negative Stock Violations is currently moot (0 real rows) and Low Stock's blast radius is small (3 of 147 items have reorder rules at all) — but both should close before either table has real rows to show.
3. **Fix the pagination-vs-total mismatches** in the category/warehouse charts and On Hand/Available KPIs — either raise/remove the fetch caps or add a real backend total-quantity aggregate (doesn't currently exist).
4. **Relabel or replace the Aging Analysis chart** — either fix the label to match what's actually computed, or swap in the already-correct `/inventory/reports/aging` endpoint.
5. **Cover the remaining 5 transfer statuses** in the status-pill strip, or fall back to a generic "Other" bucket instead of silently omitting them.
6. **Empty tables are a data question, not a code fix** — flag for whoever owns dev seeding.
7. **Add auto-refresh** — see cross-cutting finding #1. Land after items 1-3 above.
8. **Add a systemic validation layer** — see cross-cutting finding #2; items 1 and 2 above are two of its three known symptoms. Worth its own follow-up conversation about adding `zod.safeParse` (or equivalent) at the API-client boundary generally, rather than only patching these call sites. Confirm scope/approach with the developer before starting — this is bigger than a dashboard-widget fix.

### Dead code

- `getProjection` is fetched on every page load and its result is never read anywhere in the component.

### Missing widgets (plumbing already exists, just not surfaced)

- Purchasing (open PR/PO) tile — no presence at all despite directly feeding the (broken) stockout projection.
- Stock Adjustment/Count pending-investigation tile — a real approve/reject/investigate workflow with zero dashboard visibility, unlike Accounting's "Overdue Bills"/"Budget Alerts" parallel.
- `ReportsDashboard.tsx` (the separate `/inventory/reports` page) is genuinely distinct, not a duplicate — but has no Aging tab, so the correct aging endpoint stays orphaned there too.

---

## CRM — CRM Intelligence

`crm/page.tsx`

**Confirmed**: only one real server-side aggregate exists — `GET /crm/leads/pipeline` (`lead.service.ts:244-290`). Every other number is computed client-side from full CRUD list fetches (`leadsApi`/`customersApi`/`remindersApi`/`interactionsApi`/`segmentsApi`, each capped at 100–200 rows), not from a purpose-built summary route.

### What's already done ✅

- Open Pipeline Value, Total Leads/Total Customers/Interactions top-line counts, Segments count, Pipeline by Stage bars — all real server-side counts/aggregates.
- Recent Leads / Recent Interactions lists — client-computed but not buggy; both source lists are already server-sorted by date, so re-sorting the capped window and taking the top 8 still reproduces the true most-recent records.

### What's not done / gaps ❌⚠️

**Actively misleading, highest priority:**

1. **Overdue Reminders is guaranteed to read 0 forever, regardless of how many reminders are actually overdue.** The dashboard's filter (`r.isOverdue || r.status === 'overdue'`) relies on two things that never happen on the endpoint it actually calls: `isOverdue` is only computed by a different endpoint (`/crm/reminders/mine`) the dashboard never uses, and `status` can never be set to `'overdue'` anywhere in the backend (no DTO field exists to write it). Pre-existing bug shared with the standalone reminders page, but it directly poisons this KPI, the "Overdue Reminders" alert panel, and indirectly "Pending Reminders" (which silently folds in reminders that are actually overdue but still stored as `pending`).
2. **The "Upcoming Reminders" panel actively relocates overdue work into the wrong bucket** — since nothing is ever flagged overdue, a truly-overdue reminder sorts to the top of "Upcoming" instead of appearing in "Overdue." Accounting's own overdue-invoice logic (`accounting/page.tsx:437-442`) does this correctly via a real date comparison — the fix pattern already exists in this codebase.

**Quietly wrong — undercounting under a fetch cap:** 3. **Win Rate and the Lead Status donut are undercounted/skewed by the 200-lead fetch cap** — any won/lost lead older than the 200 most-recently-created leads is invisible to both. Won Leads / Lost Leads (secondary strip) and Customer Sources bars (200/200-customer cap) have the same class of bug. 4. **Customer Segments panel numbers can over-count**: the segment rule evaluator (`ruleToWhere`, `customer-segment.service.ts:52-63`) silently ignores `totalSpendGte`/`lastPurchaseWithinDays` criteria entirely (a nearby comment wrongly claims these are "stubbed to zero matches" — they're just not applied), so any segment defined by spend or recency includes more members than it should.

**Internal inconsistencies (not wrong, but self-contradictory on the same page):** 5. Total Leads' own "N active" sub-label, Total Customers' "active" sub-label, and Interactions-by-Type tiles are all capped/client-computed sitting right next to correctly-computed server totals with no such cap — two numbers on the same card, one trustworthy and one not, with no visual distinction.

### Closing the gaps

1. **Give reminders a real overdue write-path** (or point the dashboard at `/crm/reminders/mine`) so "Upcoming" can correctly exclude what's actually overdue. Until fixed, consider commenting out the Overdue Reminders KPI/panel (with a note pointing at this doc) rather than leaving it live and wrong.
2. **Fix the pagination-vs-total mismatches** for Win Rate, Lead Status donut, Won/Lost counts, Customer Sources — either raise/remove the fetch caps or move these to real server-side aggregates.
3. **Fix `ruleToWhere()`** to actually apply (or explicitly document as unsupported) `totalSpendGte`/`lastPurchaseWithinDays` segment criteria.
4. **Add auto-refresh** — see cross-cutting finding #1. Land after items 1-2 above.

### Dead code

- `pipelineStagesApi.list()` is fetched on every page load and never read anywhere in the component.
- `totalSegmentMembers` is computed and stored into state but never rendered.

### Missing widgets (plumbing already exists, just not surfaced)

- No "leads or won-value by assigned rep" rollup, despite a complete Agent/AgentCommission data model and `Lead.assignedTo` already existing — the natural CRM parallel to Accounting's AR/AP aging or Inventory's stock-by-warehouse breakdown.
- Module Navigation omits Agents, Collectors, Installment Accounts, and Collection Incentives despite all four having full API surfaces already defined in `crm.ts`.

---

## Overall priority across modules

If tackling one module at a time (per this project's usual bounded-work preference): **Inventory first** — it has the single most consequential bug of the whole audit (Projected Stockouts never working) plus two more field-mismatch bugs sharing the same root cause, so one systemic fix (a validation layer) closes the most ground. **Accounting and CRM's "actively misleading" items are comparably severe** (AR/AP Aging; Overdue Reminders + the Upcoming-panel side effect) and either could reasonably go second. Every module's empty-table items are a data-seeding question, not a code gap, and can wait indefinitely without blocking anything else. Missing-widget additions (Cash Flow Forecast, Purchasing/Stock-Adjustment visibility, rep rollup) and the cross-cutting auto-refresh rollout are lowest priority everywhere — genuine improvements, not fixes for something wrong, so they should follow every module's correctness fixes rather than compete with them.

## Implementation Log — 2026-08-13

**Scope of this run: Inventory only** (per developer decision at kickoff — highest-priority module, bounded to one module at a time). Accounting and CRM's closing gaps above are **still fully open**, not touched in this run.

**For this scenario, I have done** (Inventory, all 9 closing-gap items plus one closing-gap-8 backend addendum):

1. **Closing Gap 1 — Fixed Projected Stockouts.** `get-stockout-alerts.ts` now normalizes the backend's real `{alertWindowDays, alerts}` shape (was silently failing on every call) and validates with zod. Same dead-field bug also existed on the standalone `/inventory/projection` page (`ProjectionPageView.tsx`) — fixed identically, not separate scope.
2. **Closing Gap 2 — Fixed Low Stock Items + Negative Stock Violations** field-name mismatches (`currentQty` → `currentAvailableQty`, `itemSku`/`quantity` → `sku`/`onHandQty`), plus zod validation on both actions. Found and fixed a third instance of the same class of bug live: `ReorderDashboard.tsx`'s "PR Status" column read a `hasActivePr` field the backend never sends — always showed "No PR" regardless of reality; relabeled to the real `autoCreatePr` config field ("Auto-PR"/"Manual").
3. **Closing Gap 3 — Fixed pagination-vs-total undercounts.** Initially fixed by raising the fetch limit (50→10,000 rows); developer then asked about the resulting payload cost, so this was superseded same-session by **Closing Gap 3b**: real backend aggregates — `reports.service.ts`'s `getValuationReport` now returns `summary.byCategory`/`byWarehouse` (computed pre-pagination), `stock.service.ts`'s `getBalances` now returns `summary.totalOnHandQty`/`totalAvailableQty`/`totalReservedQty` — letting the dashboard drop back to `limit: 1` on both calls with no correctness loss. New backend spec `test/inventory-valuation-balance-summary.e2e-spec.ts`.
4. **Closing Gap 4 — Aging Analysis chart** swapped from the mislabeled Turnover-report projection to the real, previously-orphaned `lastMovementAt`-based `GET /inventory/reports/aging` endpoint. New `get-aging-report.ts` action + schema.
5. **Closing Gap 5 — Transfer status pills** expanded from 4 to all 9 real `StockTransferStatus` values, and fixed a related undercount (pill counts were sourced from the "recent 8" sliced list, not the full fetched list — latent, not yet visible with today's low transfer volume). Refined post-implementation per developer feedback: pills now only render for statuses with ≥1 real transfer, to avoid a 9-mostly-zero-pill wall — still covers all 9, just doesn't show empty ones.
6. **Closing Gap 7 — Auto-refresh.** Converted the dashboard's `useState`+`useEffect`+manual-button pattern to a single `useQuery` (`refetchInterval: 30_000`, `refetchOnWindowFocus: true`) wrapping the existing combined `load()` unchanged — the "single wrapping query" option the developer chose over a full per-widget-hook decomposition (flagged as its own larger future effort, not done here). Verified via Server Action request-header counting (same technique used to verify the reverted POS Sales Breakdown widget earlier in this initiative).
7. **`getProjection` wired into a real widget** — new "Trending Toward Reorder" panel (items projected to cross their reorder point but not already flagged as a full stockout — distinct from both Low Stock Items and Projected Stockouts). Fixed the same dead-field schema bug Closing Gap 1 fixed, found here too (`ProjectionItemSchema`, plus `useProjection.ts`/`ProjectionPageView.tsx`'s standalone table, which was rendering entirely dead fields).
8. **Purchasing tile added** — open PR/PO counts + merged recent-activity list, filling Operations & Movement's previously-unused second grid column. Reused already-correct, already-working `getPurchaseRequests`/`getPurchaseOrders` (no fixes needed there).
9. **Adjustments Pending Investigation tile added** (final part) — surfaces the real Scenario 19 approve/reject/investigate workflow, previously invisible on this dashboard. Reused already-correct `getAdjustments`.
10. **Post-completion optimization pass** (developer-requested follow-up after all 9 parts): extended the Closing Gap 3b pattern to `getReservations` — turned out to need no backend change at all, since that endpoint already ignores pagination server-side and always returns everything; only the frontend was wastefully requesting/parsing up to 500 rows to sum one field. Now computes the sum from the full array before slicing and requests `limit: 1`. Also added `staleTime: 20_000` to the dashboard query to avoid a redundant refetch on quick tab-away-and-back.

**Worth flagging:**

- **Deliberately deferred** (developer-confirmed, Part 8): the Purchasing tile's open-PR/PO counts are accurate only up to 50 total PRs/POs each (all statuses, not just open ones) — same undercount class as Closing Gap 3, just not yet fixed, since today's real volume (7 PRs, 5 POs) is nowhere close. Revisit if that volume grows.
- **Not attempted this run**: Accounting and CRM's closing gaps (this doc's other two module sections) remain fully open — this was a single-module pass by design.
- Every part's test coverage was verified against **live dev-DB data**, not assumptions — several widgets (Projected Stockouts, Trending Toward Reorder, Purchasing's open-PR count) currently show real empty/zero states because the underlying dev data genuinely has none right now (0 backorders/reservations feeding stockout projections, 0 items at reorder level, 0 open PRs). Tests assert correctly on whichever state is real rather than assuming population.
- No commits made to `development` in either repo — all work sits on `feat/scenario-28-inventory-dashboard-integrity` in both repos, uncommitted until this point.

## Implementation Log — 2026-08-27 (CRM)

**Scope of this run: CRM only** (per developer decision at kickoff — same one-module-at-a-time bounding as the Inventory run). Accounting's closing gaps above are **still fully open**, not touched in this run.

**For this scenario, I have done** (CRM, all 4 closing-gap items, done one part at a time with developer confirmation between each, plus two items surfaced live during this run's own re-verification and follow-up sweep):

1. **Closing Gap 1 — Fixed Overdue Reminders.** `crm/page.tsx`'s reminder bucketing relied on `isOverdue`/`status === 'overdue'`, neither ever populated by the `/crm/reminders` endpoint the dashboard actually calls (only `/crm/reminders/mine` computes `isOverdue`, and no write path ever sets `status: 'overdue'`) — every overdue reminder silently sorted into "Upcoming" instead. Fixed via a live date comparison (`dueAt < now && status === 'pending'`), mirroring the working pattern Accounting's own dashboard already used. Also surfaced, in the same pass, that reminder cards showed no indication of _who_ the reminder was for — added a linked customer/lead/installment-account name to each card, sourced from a relation the backend was already returning but the frontend wasn't rendering. Same-part dead-code cleanup: removed an unused `pipelineStagesApi.list()` fetch and an unused `totalSegmentMembers` computed-but-never-rendered state field.
2. **Closing Gap 2 — Fixed pagination-vs-total undercounts** for Win Rate, Lead Status, Won/Lost, and Customer Sources — all previously computed client-side from a 200-row-capped `list()` fetch. New real server-side aggregates: `GET /crm/leads/status-summary` and `GET /crm/customers/source-summary`, both tenant-scoped from the authenticated user (`user.enterpriseOwnerId`) rather than the client-supplied `tenantId` query param the older `/crm/leads/pipeline` endpoint uses — the more correct of two existing conventions in this codebase, not a new one.
3. **Closing Gap 3 — Fixed `ruleToWhere()`** to actually apply `totalSpendGte`/`lastPurchaseWithinDays` instead of silently ignoring both (a stale comment had claimed they were "stubbed to zero matches" — they weren't; segments relying on them simply over-counted). Sourced from completed POS sales only (developer-confirmed): `PosTransaction` rows with `transactionType: 'sale'`, `status: 'completed'` — deliberately excludes AR Invoices, since a charge/installment POS sale already links 1:1 to its own AR Invoice via `arInvoiceId`, and counting both would double-count the same sale.
4. **Closing Gap 4 — Auto-refresh.** Added a 30s interval plus a window-focus/visibility-change refetch to the dashboard's existing `load()`, mirroring POS's own overview page (the working reference pattern this doc's cross-cutting finding #1 already pointed at) — landed last, after 1-3, per this doc's own ordering note.
5. **Follow-up, surfaced live re-testing Closing Gap 1**: the standalone `/crm/reminders` page (a different component from the dashboard) had the _identical_ `isOverdue`/`status==='overdue'` bug, independently — its "Overdue" section was unconditionally empty. Fixed the same way, plus added `GET /crm/reminders/status-summary` for its own Total Pending/Overdue/Due Today tiles (previously computed from the same 200-row cap class of bug).
6. **Follow-up, surfaced by a full CRM-module wiring audit run after Closing Gaps 1-4**: "Interactions by Type" was computed client-side from a 100-row-capped `interactions/list()` fetch, while the "X total" label beside it used the real uncapped count — the two could visibly disagree past 100 interactions. New `GET /crm/interactions/type-summary`. Also added `GET /crm/customers/status-summary` for the "Total Customers" KPI's own "N active" sub-label (this doc's own deferred item 5), and removed a `customerList` variable that had gone dead once the above two aggregates replaced everything that used to read it — the underlying `customersApi.list()` fetch dropped from `limit: 200` to `limit: 1` since only `meta.total` is read from it now.

**Worth flagging:**

- **Full CRM-module data-wiring audit performed** (developer-requested, beyond this doc's original scope): every other CRM page — Leads, Pipeline, Customers/Customer360, Segments, Collectors, Installment Accounts, Collections Calendar, Collection Incentives, Agents, Settings — was checked for hardcoded/mock data or the same capped-fetch-presented-as-total pattern. All clean except item 5 above (already fixed) and one **deferred, not fixed**: `Customer360.tsx`'s "this customer also has N CRM collections accounts on file" sentence is built from a 50-row-capped `installmentAccountsApi.list()` fetch rather than a real count — low real-world impact (customers rarely exceed 50 installment accounts), developer's call to leave for a future pass.
- **Missing widgets** (rep/agent rollup, Module Navigation additions) — explicitly **deferred**, per developer decision in this run's own scoping pass; doc's own priority note already flagged these as lowest priority.
- A related, out-of-scope-for-this-doc finding on the **main `/dashboard`** (not CRM): `TopCustomersWidget` has the same capped-fetch-as-total bug (`customersApi.list({ limit: 200 })` used to resolve names for a POS-transaction revenue rollup — past 200 customers, some sales misattribute to "Walk-in Customer") plus a separate grouping-by-name-not-id issue. Flagged to the developer, not fixed — main dashboard is explicitly out of scope for this doc.
- Every part's e2e coverage (4 new backend specs, 4 new/extended frontend specs) was run against real fixtures created and torn down per-test, not assumptions — including specific coverage that voided POS transactions and soft-deleted records never count toward the affected totals.
- Commits: `ac7678c` (backend), `cc2d61b` (frontend), both on `feat/scenario-29-crm-dashboard-integrity` in their respective repos, pushed.

## Implementation Log — 2026-08-27 (Accounting)

**Scope of this run: Accounting only.** CRM closed the same day, in a separate run on its own branch (see that run's own Implementation Log entry above) — Inventory closed 2026-08-13. All three of this doc's module sections are now closed.

**Re-verification before starting** (doc last checked 2026-08-12, a lot had landed since, including Scenario 38's bank-clearing/GL-posting work touching this exact area): all four closing-gap claims held up unchanged. Two other claims had drifted and were corrected before scoping: `businessBankAccount` is no longer an empty table (Scenario 38's seed work populated it, at ₱0 balances); "FX Revaluation" doesn't exist anywhere in either repo (dropped from missing-widgets, nothing to link) — Inventory's item-cost revaluation is a different, unrelated feature the doc's author had confused it with.

**For this scenario, I have done** (all 4 confirmed closing-gap items, frontend-only — no backend changes needed):

1. **Fixed AR/AP Aging charts.** `extractAging()` expected a pre-aggregated `{buckets: [...]}` or bucket-keyed object shape that `GET /reports/aging/:type` never actually returns (a flat array of invoice/bill rows, each with its own `outstanding` amount and `bucket` label) — always resolved to `[]` regardless of real overdue data. Rewritten to sum by the real `bucket` field. Verified against genuinely real overdue AR/AP data already in the dev DB (both e2e tests exercise live data, neither needed to skip for lack of fixtures).
2. **Auto-refresh** — same 30s interval + window-focus/visibility-change pattern as CRM's dashboard, landed after item 1 per this doc's own ordering note.
3. **Dead code cleanup** — removed the `totalExpenses` fallback guessing at a `pnl?.totalExpenses` field `profitAndLoss()` never returns (simplified to what its own sub-label already claimed: "COGS + operating expenses"); removed the unused `bankBreakdown` array (computed, never rendered — the real grid used `bankAccountsList`) and repointed the Bank Account Balances card's visibility gate to the data it actually renders instead of the dead parallel array.
4. **Linked Cash Flow Forecast** from Module Navigation — a fully built page (backend module + frontend page both exist) that was simply never linked. Verified the link actually navigates to a real, working page, not a 404.

**Worth flagging:**

- **Tenant-scoping gap investigated in depth, deliberately deferred** (developer decision) — not part of this run, and explicitly **not** part of any future "dashboard" scenario either. A full discovery pass (7 models: `Account`, `JournalEntry`, `Transaction`, `BusinessBankAccount`, `FixedAsset`, `FiscalPeriod`, `Budget`; ~76 touch points across ~15 files) found this is a real platform-wide initiative, not a dashboard fix that happens to touch these tables — the highest-volume write path (`JournalPostingService.post()`) is called by 20 services across POS, Inventory, and CRM installment accounts, none of it dashboard-specific. Two traps found worth remembering if this is picked up later: (1) `JournalEntry` and `Budget` already _look_ tenant-scoped (thread `user.enterpriseOwnerId` on reads) but only via an indirect, nullable `branch.enterpriseOwnerId` path that `create()` never uses — replace, don't extend; (2) `assertNotInLockedPeriod()` (the period-lock check run on every JE post) is unscoped in two duplicated copies plus a third near-miss in `inventory/costing.service.ts` that already accepts a `tenantId` param and just never uses it in that query — a real, present-day bug independent of the larger migration. `Account`/Chart-of-Accounts scoping was further separated out as its own open product question (per-tenant duplicated COA vs. shared-with-override) — `POST /coa-seed/ph` is a single global seed endpoint today, and `AccountMapping` has no tenant concept at all.
- Empty tables (`fixedAsset`, `budget`, `fiscalPeriod`) — left as-is per the doc's own recommendation, matching the same call made for Inventory's and CRM's empty-table items. Not a code gap.
- 4 new e2e specs (`accounting-dashboard-aging`, `accounting-dashboard-auto-refresh`, `accounting-dashboard-dead-code-cleanup`, `accounting-dashboard-cash-forecast-link`), 8 tests, all passing against real dev-DB data.
- Frontend-only change; backend repo has zero diff for this run.

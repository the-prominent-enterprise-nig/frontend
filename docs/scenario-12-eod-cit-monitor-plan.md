# Scenario 12 — End-of-Day Cash & Cash-in-Transit Monitor — Gap Analysis & Closing Plan

Source: `module-scenarios.md`, scenario "End-of-day cash & Cash in Transit — closing the branch."

## Related ClickUp Tickets (Sprint 3-5)

- [86d3d19rc](https://app.clickup.com/t/86d3d19rc) — "AA Cashier, ISBAT run an end-of-day cash close that moves collected payments from Undeposited Funds to Cash in Transit and generates a CIT slip" — _Sprint 4, to do_ — matches step 1 (also cross-listed under Scenario 01)
- [86d3d19tg](https://app.clickup.com/t/86d3d19tg) — "AA Accountant, ISBAT configure Undeposited Funds and Cash in Transit GL accounts with next-day starting cash balances, so cash flow between collection and deposit is accurately tracked" — _Sprint 4, to do_

**Not found in Sprint 3-5:** No ticket anywhere for step 4 — the company-wide CIT monitor that flags any branch not at ₱0.00. This is exactly this doc's central finding (the monitor doesn't exist in code), and it doesn't exist in the backlog either — worth raising as a new ticket rather than assuming it's implicitly covered by the per-branch tickets above.

## The scenario we're building toward

A branch closes for the day and accounting reconciles it:

1. Cashier close — Undeposited → Cash in Transit by tender, drawer ends at ₱0.00.
2. Deposit to the bank.
3. Next-day clearing — accounting confirms the bank, clears CIT to ₱0.00.
4. **Monitor** — a company-wide CIT monitor shows every branch's transit balance; any branch not at ₱0.00 is flagged and chased.

## What's already done ✅

Steps 1-3 are solid, confirmed working (verified in an earlier session and re-confirmed this pass):

1. **Cashier close sweeps cash correctly.** `PosSession.citClearedAt`/`citClearingJournalEntryId` track whether a closed session's CIT sweep has been deposited. Session close sweeps the physical cash drawer (cash + custom tenders only, by design — non-cash tenders post directly to their own clearing accounts at sale time, see scenario 01).
2. **Per-branch deposit clearing works.** `/pos/cash-in-transit` lists closed sessions awaiting deposit for the caller's own branch; selecting sessions and clicking "Deposit Selected to Bank" posts a `Dr Cash-in-Bank / Cr Cash-in-Transit` journal entry and stamps the sessions cleared.

## What's not done / gaps ❌⚠️

**Step 4 — the company-wide monitor — is entirely missing, and the current permission model doesn't even let the right role see it.**

1. **No aggregation exists anywhere.** `frontend/.../pos/cash-in-transit/_components/CashInTransitList.tsx:33-43` renders a flat table of individual closed-session rows (`branchName`, `terminalCode`, `cashier`, `amount`) — not a per-branch balance rollup. No grouping/sum-by-branch and no non-zero highlighting anywhere in the component.
2. **No `groupBy`/aggregate query exists server-side either.** `backend/src/pos/sessions.service.ts:534-556` (`getCashInTransitReport`) and `:601-619` (`getCashInTransitHistory`) only filter/scope by `branchId` — confirmed via grep that no aggregate query exists in this service beyond unrelated `posPayment`/`cashDrawerEvent` aggregates.
3. **The page is hard-scoped to one branch at a time by design, with an explicit code comment confirming it.** `pos/cash-in-transit/page.tsx:22-28`: "A branch-assigned caller (Branch Manager) is restricted to their own branch server-side too... regardless of what's submitted," deriving `restrictedBranchId = session.branchId ?? null`.
4. **The role most likely to need this view can't even open the page today.** `pos:cash-in-transit:read`/`manage` are granted only to Branch Manager (`backend/prisma/seed.ts:1932-1934`) — the Accountant role's permission set has no `pos:cash-in-transit:*` entries at all, so Accounting would hit `/403`.
5. **Business Owner's "all branches" view is an accident, not a feature.** A Business Owner holds every permission and, if their `session.branchId` happens to be null, the backend query drops the branch filter entirely (`sessions.service.ts:548-551`) — producing an unfiltered flat list spanning all branches as a side effect, with no per-branch totals or ₱0.00 flagging either way.

## Closing the gaps

### 1. Grant Accounting read access first (small, unblocks the role that most needs this)

**Problem**: the role conceptually responsible for "chasing branches not at zero" can't open the page at all.
**Fix**: add `pos:cash-in-transit:read` to the Accountant role's permission set (seed data + any role-permission admin UI). Read-only — don't grant `manage`, since clearing to bank deposit should likely stay a Branch Manager/Business Owner action.

### 2. Add a real aggregate query

**Problem**: no per-branch balance rollup exists at all, only a flat session list.
**Fix**: add a new service method, e.g. `getCashInTransitSummary()`, that groups open (undeposited) CIT sessions by `branchId` and sums their amounts — a straightforward Prisma `groupBy` on the same underlying session data `getCashInTransitReport` already queries, not a new data source.

### 3. Build the monitor view

**Problem**: no UI surfaces the aggregate.
**Fix**: add a new view (either a tab on the existing `/pos/cash-in-transit` page, gated to show only for callers without a `branchId` restriction — i.e. Business Owner/Accounting — or a separate `/accounting/cit-monitor` page) listing every branch with its outstanding CIT balance, sorted non-zero-first, with a visual flag (e.g. amber/red) on anything not at ₱0.00. Drill-down into a flagged branch should link to that branch's existing session-level `/pos/cash-in-transit` list — reuse `CashInTransitList.tsx`, don't duplicate it.

### 4. Stop relying on the null-`branchId` accident

**Problem**: today's only "all branches" view is an unintentional side effect of how the branch filter is built, not a designed capability.
**Fix**: once #2/#3 exist, make the "all branches" case for Business Owner an explicit, intentional branch of the query (e.g. `if (!user.branchId) return summaryAcrossAllBranches()`) rather than leaving it as implicit behavior nobody decided on purpose — same underlying data, just documented and deliberate instead of incidental.

## Dead code / unused-feature flags

None — the existing per-branch CIT flow is real, used, and correctly scoped; it just needs the aggregate layer added on top, not replaced.

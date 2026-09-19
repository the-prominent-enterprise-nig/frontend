# Scenario 54 — Collections: Simulated Late-Payment Rebate Forfeiture (Date Override) — Gap Analysis & Closing Plan

Source: developer-defined, 2026-09-19 — not sourced from either client PDF. Arose from wanting to visualize/demonstrate what a "a late payment forfeits its rebate" rule would look like across the Collections screen, before deciding whether to actually enforce it for real.

## Related ClickUp Tickets

Not checked this pass — recommend a `clickup_search` before further work, same as Scenario 26.

## Related docs

- `scenario-26-collections-rebate-plan.md` — **this scenario directly revisits that doc's Open Question 5**: _"Timing — no on-time enforcement. Despite `ppd` standing for 'Prompt Payment Discount,' the developer deliberately chose to let a collector apply it regardless of whether the payment is actually on time, trusting their judgment rather than auto-blocking on a late payment date."_ That was a deliberate decision, not an oversight — this scenario proposes introducing a timing gate after all, but lets it be previewed/simulated first rather than silently flipped on.
- `scenario-11-collections-ar-aging-plan.md` — the Collector/InstallmentAccount collections module this scenario's screen belongs to.
- `scenario-15-price-list-management-plan.md` — where `InstallmentAccount.ppd` itself originates.

## The scenario we're building toward

1. A collector opens POS Collections as normal — with no override set, everything behaves exactly as it does today (Scenario 26's rule stands unchanged).
2. A new **"Override current date"** control sits above the customer list, defaulting to real today. It's scoped strictly to this one screen: it lives in local component state only, is never persisted anywhere, and resets to real today the moment the collector navigates away. No other screen, report, or backend "now" is ever affected by it.
3. While an override is active, the whole screen is wrapped in an unmistakable amber banner — reusing the same full-width `bg-amber-500` pattern already used for the offline banner and the pending-manager-review banner on POS Checkout — stating the simulated date, with a one-click "Reset to today."
4. Moving the override date live re-evaluates every due's status badge (`SENT`/`PARTIAL`/`OVERDUE`) across the whole list, against the override instead of real today.
5. Opening "Pay Selected" on a customer while an override is active carries that date in as the effective payment date. Each **selected due's own Status (On-time/Late) is evaluated independently against that due's own `dueDate`** — not the batch as a whole — so a batch spanning an already-overdue due and a not-yet-due due shows one Late row and one On-time row.
6. A due whose Status is Late shows **₱0 rebate** in the reference table (its would-have-been PPD amount struck through, with a short "Late — rebate forfeited" note), and the rebate cap used to validate the typed Rebate total on submit shrinks to exclude every late due in the batch.

**Result**: a collector or manager can drag the override date around and watch, live, which dues would be overdue and which rebates would be forfeited on any given day — without touching a single real record — before this becomes (if it does) a real enforced rule.

## What's already done ✅

1. **The rebate/PPD suggestion, cap validation, and GL posting mechanism all already exist (Scenario 26)** — this scenario adds a new gate in front of that mechanism, it doesn't rebuild it. Cap logic: `backend/src/accounting/ar-invoices/ar-invoices.service.ts`, private method `applySingleInvoicePayment()` (starts line 1401) — walks `scheduleLines` oldest-first, counts `wholeDues` the payment's `totalApplied` clears, `rebateCap = ppd × wholeDues` (~line 1542), throws `rebate_exceeds_ppd` if exceeded (~line 1543). No date/timing input exists anywhere in this function today.
2. **The exact `OVERDUE` comparison this needs already exists** — `dueStatus()` in `frontend/src/libs/pos/installment-dues.ts:38-42`: `line.dueDate.slice(0, 10) < todayIso() ? 'OVERDUE' : 'SENT'`, where `todayIso()` (line 19) is `new Date().toISOString().slice(0, 10)`.
3. **Prior art for "preview without committing" exists in this codebase** — `POST /pos/financing-terms/preview` and `GET .../early-payoff-quote` both call the same pure calculation function used at real posting time, just without writing to the DB. Confirms this is a normal pattern here, not new architecture.
4. **The Collections screen's per-due reference table, selection, and bulk-allocation machinery already exist and don't need rebuilding** — `frontend/src/app/(app)/(dashboard)/pos/collections/_components/CollectionsScreen.tsx`: `toggleLineSelection()` (line 170, Shopee-style — checking a due auto-selects every earlier unpaid due), `allocateBulkPayment()` (line 213), `CollectPaymentModal` (line 592) with its reference table and `rebateCapSum` (line 631). This scenario extends these, not replaces them.

## What's not done / gaps ❌⚠️

1. **No date-override control exists anywhere in the app.**
2. **The "late forfeits rebate" rule doesn't exist in any form** — simulated or real. Rebate eligibility today has zero timing gate at all (Scenario 26 Open Question 5, a deliberate choice at the time).
3. **`dueStatus()`/`todayIso()` are shared helpers, not Collections-only** — the doc comment at the top of `installment-dues.ts` says explicitly: _"Anything rendering a single due — the collections list, Customer 360's Upcoming Payables and plan modal — goes through them."_ Naively swapping `todayIso()`'s `new Date()` for the override would leak the simulated date into Customer 360 too, directly violating "scoped strictly to the Collections screen." This needs to become an optional parameter (e.g. `dueStatus(line, asOfIso？= todayIso())`) that only Collections' own call sites ever pass a non-default value into — every other caller keeps calling it exactly as today.
4. **`CollectPaymentModal`'s rebate suggestion/cap math has no concept of a "payment date" at all** — neither the frontend's `suggestedRebate`/`rebateCapSum` (`CollectionsScreen.tsx:316`, `:631`) nor the backend's `applySingleInvoicePayment()` cap check take one. Needs adding before an on-time/late distinction can be computed anywhere.
5. **No backend enforcement exists to fix.** Even once the frontend correctly _shows_ a forfeited rebate, nothing stops the backend from accepting and posting it anyway unless `applySingleInvoicePayment()` (and whatever DTO carries the payment date into it) is actually taught the new rule — see Open Question 3 below on whether that backend change should be unconditional or gated.

## Closing the gaps

Ordered by dependency.

### 1. Shared helper — add an optional "as of" date, default unchanged

**Fix**: give `dueStatus()` (and `todayIso()`'s call sites within it) an optional `asOfIso` parameter defaulting to `todayIso()`. Every existing caller (Customer 360, the plan modal) keeps calling it with no second argument and is completely unaffected. Only the Collections screen's own call sites pass the override when one is active.

### 2. Frontend — the override control itself

**Fix**: local state in `CollectionsScreen.tsx` (e.g. `overrideDateIso: string | null`), a date-picker control above the customer list, and the amber "viewing as of / reset to today" banner (matching the existing `bg-amber-500` offline-banner pattern on POS Checkout). Resets to `null` on unmount/navigation — no persistence (`localStorage`, URL param, or otherwise).

### 3. Frontend — badges follow the override

**Fix**: every `dueStatus()` call site inside `CollectionsScreen.tsx` (customer list rows, due cards) passes `overrideDateIso ?? undefined` through, so `OVERDUE`/`SENT`/`PARTIAL` badges re-derive live as the override moves.

### 4. Frontend — `CollectPaymentModal` gains a Status column and forfeits late rebates

**Fix**: the modal receives the effective payment date (override if active, else real today). Add a **Status** column to the per-due reference table (line ~913-946) computed per-row against that due's own `dueDate`. A Late row's rebate column shows ₱0 (would-have-been amount struck through); `rebateCapSum` (line 631) excludes late dues from the sum entirely.

### 5. Backend — the rule needs to actually exist somewhere enforceable

**Fix**: add a `paymentDate` (or reuse an existing date field, if `RecordArPaymentDto`/the bulk-collection DTO already carries one) to the payment DTO, and extend `applySingleInvoicePayment()`'s rebate-cap loop (~line 1519-1541) to zero out `wholeDues`' contribution to `rebateCap` for any due whose `dueDate < paymentDate` — mirroring the exact same oldest-first walk already there, not a second calculation. **This is where Open Question 3 below matters most**: whether this backend change is unconditional (the rule becomes real starting now, override or not) or should only reject a rebate when the request explicitly signals it came through a simulated/override context.

## Open questions requiring developer/business confirmation

Resolved already, through conversation:

1. **Rule being simulated** — a due paid after its own due date forfeits that due's rebate entirely (all-or-nothing per due, not prorated).
2. **Entry point** — a screen-level date override on Collections, not a field buried inside the payment modal; the modal inherits whatever date the screen is currently showing.
3. **Scope of the override itself** — strictly local to the Collections screen; never persisted; resets on navigating away; no other screen or backend "now" is ever affected.
4. **Visual treatment** — amber banner, reusing the existing offline-banner pattern, always showing the active override date plus a one-click reset.

Still open — need an answer before implementation starts:

1. **Does the forfeiture rule become real, or stay simulate-only?** If a collector collects a payment for real _today_, with no override active, on a due that's genuinely overdue — should that now also forfeit the rebate? Or does the new rule only ever apply while an override is deliberately active (i.e., this stays a training/demo tool, and Scenario 26's "no timing enforcement" still governs every real, no-override collection)? This decides whether Closing Gap 5's backend change is unconditional or gated on some explicit "this is a simulation" signal.
2. **Backdating access** — should any cashier be able to move the override into the past/future freely, or should that (or the act of actually collecting a payment while an override is active, if Question 1 lands on "unconditional") be restricted to a manager-level role?
3. **Date range limits** — any floor/ceiling on the override (e.g. blocked from the future entirely; blocked from predating the account's last real payment)?
4. **Does this extend to the CRM "Record payment" path** (`InstallmentAccountService.recordPayment()`), which Scenario 26 also touched, or is this deliberately POS-Collections-only?

No Implementation Log yet — this is a plan-only pass, per explicit instruction. Nothing has been built.

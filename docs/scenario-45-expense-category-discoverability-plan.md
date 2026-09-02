# Scenario 45 — Expense Screen: Utilities & Salaries and Wages Have No Quick-Access Path — Gap Analysis & Closing Plan

**Source**: two whiteboard photos shared directly in a chat session on 2026-09-02 — the same "Expenses" planning sketch behind [Scenario 40](./scenario-40-special-account-expense-categories-plan.md) (the internal Accounting-module planning agenda for **Thursday, Sept 3, 2026, 9:30am** — this meeting has not happened yet). Scenario 40 already covers the whiteboard's Special Account branch in full (data model, GL split, liquidation flow) and already concluded Utilities/AP/Salaries & Wages need no _data-model_ work. **This doc is scoped separately, by explicit developer choice**, to a narrower question Scenario 40 didn't address: on the actual Expense entry screen, three of the whiteboard's four sibling branches (Utilities, AP, Salaries & Wages) get no visual priority at all, while the fourth (Special Account) got a dedicated UI. Every "closing gap" below is a proposal to validate at the meeting, not a decided spec.

**The whiteboard's shape**: a flat list — `Expenses → Utilities / AP / Salaries & Wages / Special Acct → (Emp Cash Adv, Emp Cash Loan, Cash Loan-Others, CA-Liquidation)` — draws all four of Utilities/AP/Salaries & Wages/Special Acct as equally-weighted siblings under "Expenses." The live screen doesn't nest them that way (see Gap 1).

## Related ClickUp Tickets

None found. Net-new scope — create via the `clickup-create-ticket` skill once this doc is confirmed at the meeting.

## The scenario we're building toward

An accounting staff member opens the Expense entry screen to log a Utilities bill or a Salaries & Wages run, the same way they'd log an Employee Cash Advance — quickly, without hunting.

1. For a Special Account entry (Employee Cash Advance, Employee Cash Loan, Cash Loan – Others, CA-Liquidation), the Payee field already gives it first-class treatment: pick **Other**, a dedicated list of exactly those four items appears in a visually distinct box (built in Scenario 40).
2. For Utilities or Salaries & Wages, there's no equivalent shortcut today — both are just two rows inside a single searchable dropdown holding all 160 seeded EXPENSE accounts, with no indication they're the two the business actually logs often.
3. AP (PO → supplier invoice → payment) isn't reachable from this screen at all, under any Payee choice — it's a fully separate module. Someone reading the whiteboard's flat list has no way to discover that from the Expense screen's own UI.

**Result**: whichever of the four branches someone is trying to log, the screen should make it obvious where to go — not just correct once you already know where to look.

## What's already done ✅

1. **All four of the whiteboard's branches are already reachable, functionally.** Confirmed independently and previously by Scenario 40 (its "What's already done" #2, #3): Utilities and Salaries and Wages are real seeded `EXPENSE`-type Chart-of-Accounts rows — `6-02-020` "Utilities - Electricity/Water/Internet" and `6-01-010` "Salaries and Wages" (`backend/src/accounting/coa-seed/coa-seed.service.ts:930-935`, `:759-764`) — and both already appear in the Expense screen's ordinary Category dropdown. AP is handled end-to-end by the separate `backend/src/accounting/ap-bills/` module (PO → bill entry → payment, its own GL posting).
2. **The Special Account branch has a real, dedicated UI**, built in Scenario 40: `frontend/.../accounting/expenses/_components/ExpenseForm.tsx`. The Payee field is a 3-way segmented control — **Customer / Supplier / Other** (`ExpenseForm.tsx:341-370`). Picking **Other** opens a purple-tinted box (`:410-444`) with a "Special Account type" dropdown listing exactly the four items (`SPECIAL_ACCOUNT_OPTIONS`, `:25-30`); picking `CA_LIQUIDATION` reveals a second "which type is this closing out?" dropdown (`:427-442`).
3. **The ordinary Category picker is a real, working searchable component** — `frontend/src/components/ui/CategorySelect.tsx`: a button that opens a popup with a text search (substring match over the full flat list) and an indented parent/child tree built from every `EXPENSE`-type account (`accountsToCategoryOptions`, `ExpenseForm.tsx:63`). It renders per line item, but only when Payee is Customer or Supplier (`ExpenseForm.tsx:471`).

## What's not done / gaps ❌⚠️

1. **Utilities and Salaries & Wages have no visual priority — they're 2 rows among 160.** `ExpenseForm.tsx:107-112` filters the full Chart of Accounts down to every `type === 'EXPENSE'` row (`backend/src/accounting/coa-seed/coa-seed.service.ts` currently seeds 160 such accounts) and hands the whole list to `CategorySelect` with no curation, ordering, or "common categories" shortcut. Finding either one requires knowing to type "Utilities" or "Salaries" into the search box, or scrolling an indented tree of the entire chart — a materially different experience from Special Account's dedicated 4-item dropdown, even though the whiteboard draws them as equal siblings.
2. **The Category dropdown is invisible entirely under Payee = Other.** `ExpenseForm.tsx:471` gates `CategorySelect` on `payeeType === 'CUSTOMER' || payeeType === 'SUPPLIER'` — under Other, only the Special Account dropdown or an `EmployeePicker`/free-text payee field render (`:481-498`). Someone who reads the whiteboard's flat list and reasonably starts at "Other" looking for Salaries & Wages hits a dead end; they'd have to already know to back out and pick Supplier instead.
3. **AP has no presence on this screen under any Payee choice.** Not a bug — it's a deliberate separate module (confirmed by Scenario 40) — but nothing on the Expense screen tells a first-time user that "AP" from the whiteboard means a different screen entirely (`/accounting/ap-bills`, unconfirmed exact route), rather than something reachable via Payee → Supplier here.

## Closing the gaps

Proposed, needs sign-off at the Sept 3 meeting before building — this is a UX call, not a data-model one, so the right answer depends on how often Utilities/Salaries & Wages actually get logged this way in practice.

### Option A — Quick-pick shortcuts above the search

Add a small row of one-click chips (e.g. "Utilities", "Salaries and Wages") above the existing `CategorySelect` search box, visible whenever Payee is Customer/Supplier, pre-selecting that account without typing. Cheapest change; keeps the existing Payee/Category structure exactly as-is otherwise.

### Option B — Match the whiteboard's flat shape exactly

Restructure the Payee step into four parallel top-level choices — **Utilities / AP / Salaries & Wages / Special Account** — styled like today's Customer/Supplier/Other tabs. Utilities and Salaries & Wages would each preset their category and drop straight into the existing Customer/Supplier sub-flow; Special Account keeps its current Scenario-40 flow unchanged; AP would link out to the AP Bills screen instead of trying to happen inline. Bigger change, but removes the current "which tab has what I need" guesswork entirely.

### Option C — Leave as-is, confirm it's good enough

If Utilities/Salaries & Wages are logged rarely (the conversation that led to this doc described payroll as "just tracking... this month they spent ₱1,000,000" — an infrequent, lump-sum entry), a one-time search each time may be an acceptable cost, and the only real output of this doc is writing that down for the record rather than shipping any UI change.

## Open questions for the Sept 3 meeting

- **The central question**: does the whiteboard's flat grouping of Utilities/AP/Salaries & Wages/Special Acct reflect an actual UX ask (make all four equally quick to reach), or was it just shorthand notes for "here's what counts as an expense" with no UI implication at all? This decides whether any of Options A/B are needed, or whether Option C (do nothing) is the right close.
- If UI work is wanted: Option A (quick-pick chips) or Option B (full parallel restructure)? B is a bigger change but resolves the Payee=Other dead-end (Gap 2) as a side effect; A doesn't.
- Should the Expense screen surface _some_ link to AP Bills (e.g. from an "AP" chip in Option B redirecting there), or is that unnecessary since AP is a well-known, separately-navigated screen already?
- Are there other frequently-logged categories beyond Utilities and Salaries & Wages worth the same quick-pick treatment, or are those genuinely the only two?

## Not in scope for this doc

- **Special Account's data model, GL mapping, and liquidation flow** — fully covered by [Scenario 40](./scenario-40-special-account-expense-categories-plan.md); this doc doesn't revisit any of it.
- **AP / supplier invoice & payment module itself** — already fully built via `ap-bills`; only its _discoverability from the Expense screen_ is in scope here (Gap 3).
- **Payroll as its own module** — out of scope per the NIG charter (HR is explicitly excluded); Salaries & Wages here means the existing plain expense-category entry, not a payroll system.

## Implementation Log — 2026-09-02

**For this scenario, I have done:**

- **Option B, as confirmed with the developer** (Option A/C declined; AP deliberately left off the screen entirely): the Expense form's Payee step now offers **Customer / Supplier / Utilities / Salaries & Wages / Special Account**. Utilities and Salaries & Wages are `payeeType: SUPPLIER` underneath — no API or schema change — and only pre-fill the line's category (`6-02-020` / `6-01-010`, resolved by account number from the already-loaded chart of accounts, never a hardcoded id). Closes Gap 1; Gap 2 (the Payee = Other dead end) falls out as a side effect. Gap 3 (AP) closed as "won't do" per the developer.
- **Payee is a dropdown, not a tile row** (developer feedback, same session): the five options behave the same except Special Account, so tiles over-weighted them. Now a compact `Select` matching the form's other dropdowns.
- **Categories are editable everywhere** (developer feedback, reversing the earlier "locked" decision): the read-only locked-category display is gone. Utilities/Salaries & Wages pre-select their account and the ordinary searchable picker stays fully usable; switching to plain Supplier clears the pre-fill.
- **Supplier is searchable** (developer feedback): the Supplier field was a plain scroll list of every seeded supplier. It now reuses `CategorySelect` (search + flat list), the same component the Category field uses.
- **Special Account Recipient is a plain text field for all four types** (developer feedback, reversing Scenario 40's confirmed design): the employee picker is gone, `BusinessExpenseLine.employeeId` is no longer written, and `resolveLine` requires a free-text `payee` for every type instead of an `employeeId` for the two employee ones (`expenses.service.ts`). `EmployeePicker` itself stays — Employee Appliance Loans still uses it.

**Worth flagging:**

- **CA-Liquidation now matches outstanding balances on the typed name alone.** That was the explicit tradeoff of free-text recipients, accepted by the developer after it was raised: a typo, or "Juan C." vs "Juan Cruz", finds no balance. The backend's balance lookup already preferred `payee` over `employeeId`, so no backend change was needed there — the `employeeId` arm is simply dead now. No data migration was needed either: the dev DB has zero RECORDED special-account expenses (one draft, which reopens with the old employee's name pre-filled as text), and balances only count RECORDED lines.
- **Two pre-existing bugs found and fixed along the way**, both surfaced rather than caused by this work. (1) The line-items table carried `overflow-hidden` for its rounded corners, which clipped the Category popup whenever it opened upward — latent since Scenario 40, but this scenario's layout change pushed the trigger down and made "open upward" the common case, turning it into the visible breakage the developer screenshotted. Fixed by rounding the header directly. (2) `Field`'s `<label>` wrapped the whole Payee control group; a `<label>` associates with only its first labelable descendant but folds all its content into that one accessible name, so the first button announced itself as the concatenation of every sibling's text. Moot now that Payee is a single dropdown, but it was real while the tiles existed.
- **One stale test fixed, unrelated to this scenario**: `expenses-ca-liquidation.spec.ts` still drove "Special Account type" via `getByLabel(...).selectOption(...)` after that field became a custom Select — broken since Scenario 40 Part 6, never caught because nothing re-ran it. Fixed here since it sat on a line already being touched.
- **Verification gap, not closed**: the isolated e2e database has **0 suppliers and 0 customers** (287 employees). That blocks three things — the two supplier-touching Playwright tests skip on their own `test.skip` guards, and `backend/test/expenses-special-account.e2e-spec.ts` (21 tests) fails in `beforeAll` on a supplier lookup and cannot run at all. The backend spec was updated to match the free-text recipient behaviour but **has not been executed**. The backend change is not unverified overall, though: `expenses-ca-liquidation.spec.ts` exercises the full stack through the real API — create advance → record → liquidate → outstanding balance 2,000 then 1,200 → server-side over-liquidation rejection — and passes. Seeding one supplier + one customer into the test DB would close the rest; deferred, not attempted.
- **Frontend e2e: 8 passed, 2 skipped** across `expenses-category-quick-pick`, `expenses-category-dropdown-popup` (new), `expenses-special-account-payee`, `expenses-ca-liquidation`, and `supplier-vendor-merge-expenses-supplier`. Type-check and lint clean in both repos.
- **Manual verification of the final round (Payee dropdown + open categories) was not confirmed by the developer before this entry was written** — earlier rounds were checked in the browser and drove the feedback above, but the last change was verified by e2e and screenshots only.

# Scenario 40 — Special-Account Expense Categories (Employee Cash Advances, Loans & Liquidation) — Gap Analysis & Closing Plan

Source: a whiteboard photo of the internal Accounting-module planning agenda for **Thursday, Sept 3, 2026, 9:30am** — this meeting has not happened yet. This doc pre-stages the requirements from that photo against the current code so the team walks into the meeting knowing what's already built, what's missing, and what specifically needs a decision — not sourced from either scenario PDF, and not yet confirmed with the business owner. Every "closing gap" below is a proposal to validate at the meeting, not a decided spec.

**Reading of the whiteboard (confirmed with the developer, 2026-08-31)**: the right-hand red list ("Expenses → Utilities / AP / Salaries & Wages / Special Acct → Emp Cash Adv, Emp Cash Loan, Cash Loan-Others, CA-Liquidation") means all of those should be selectable **as categories on the Expense entry screen** — i.e. when someone records a cash outflow, "Employee Cash Advance," "Employee Cash Loan," "Cash Loan – Others," and "CA-Liquidation" need to show up as valid category choices alongside ordinary expense categories, even though they behave differently on the books (see Gap 1).

**UX design finalized (developer, 2026-08-31)**: Special Account entries aren't reached through the ordinary Category dropdown at all. Instead, the Expense screen's Payee field becomes a typed choice — **Customer / Supplier / Other** — and picking **Other** opens a structured list of exactly these four items: Employee Cash Advance, Employee Cash Loan, Cash Loan – Others, CA-Liquidation. Choosing one of those sets the GL category _and_ who it's for in a single step, instead of picking a category first and then a payee. Full flow in the redesigned Gap 1.

## Related ClickUp Tickets

None found. Net-new scope — create via the `clickup-create-ticket` skill once this doc is confirmed at the meeting.

## The scenario we're building toward

An accounting staff member opens the Expense entry screen to record any cash going out — a utility bill, a salary run, or a cash advance handed to an employee:

1. For an ordinary expense (Utilities, Salaries & Wages, AP-related payments), they pick a category the way they do today — it posts straight to the P&L, Supplier as payee if there is one.
2. For anything else, they start from **Payee** instead of Category: **Customer**, **Supplier**, or **Other**. Picking **Other** opens a structured list — Employee Cash Advance, Employee Cash Loan, Cash Loan – Others, CA-Liquidation — not a P&L expense, a distinct "Special Account" bucket that represents money owed back, not money spent. Choosing Employee Cash Advance or Employee Cash Loan then requires picking a real employee (search, not typing a name); Cash Loan – Others stays free text since it can be paid to anyone, not just staff.
3. When that advance or loan is settled — the employee returns the cash, or it's offset against something owed to them — staff record a **CA-Liquidation** entry the same way (Payee → Other → CA-Liquidation, then the employee or party whose balance is being closed), so the Special Account balance reflects what's actually still outstanding per person.
4. Employees financing an appliance purchase through the company get their own loan record, tracked to payoff, distinct from a plain cash advance.
5. Moving money between the company's own accounts — funding a branch's petty cash float, topping up a Revolving Fund — is a clean transfer, not something that has to be faked as an "expense," and shows up correctly in bank reconciliation.

**Result**: every peso leaving the business is recorded in one place (Expense entry), correctly split between "spent" and "owed back to us," with a clear path to close out the "owed back" side.

## What's already done ✅

1. **The Expense entry screen and its GL posting already exist end-to-end.** `backend/src/accounting/expenses/` (`ExpensesService.create/record/void`) posts a debit to the chosen category account and a credit to cash on "Record," fully wired to the journal-posting engine. Frontend: `frontend/src/app/(app)/(dashboard)/accounting/expenses/_components/ExpensesList.tsx`.
2. **"Utilities" and "Salaries and Wages" already exist as real, seeded expense accounts** in the Chart of Accounts (`6-02-020` and `6-01-010`, `backend/src/accounting/coa-seed/coa-seed.service.ts:715,886`) and already appear in the Expense screen's category dropdown today — so items 1 (PO/AP) and 2 (Payroll) from the whiteboard's left-hand list need no new work; they're already recordable as expenses.
3. **PO → supplier invoice recording & payment (whiteboard item 1) is already a full module** — `backend/src/accounting/ap-bills/` (bill entry, payment recording, GL posting).
4. **AR / Collection (whiteboard item 6) already has substantial infrastructure** — installment accounts, collector remittance, and an AR-aging import that's actively being worked on in this same working tree right now (`prisma/ar-aging-import.util.ts`, `scripts/import-real-ar-accounts.ts`, `scripts/import-collectors.ts` — all untracked/in-progress). Treated as **out of scope for this doc**, being handled separately.
5. **A single "Advances to Employees" account already exists** in the Chart of Accounts — `1-03-020`, type `ASSET`, category `OTHER_CURRENT_ASSETS` (`coa-seed.service.ts:176-180`). This is the right _kind_ of account for a cash advance (a receivable, not an expense) — it just isn't split into the sub-categories the whiteboard wants, and isn't reachable from the Expense screen today (see Gap 1 and Gap 2).
6. **Petty Cash Funds and a Revolving Fund already exist as seeded accounts**, one per branch/region — `prisma/seed.ts:5286-5453` (`Petty Cash Fund - <branch>`, `Revolving Fund - Panay`, `Revolving Fund - Negros`), each carrying a starting float. This is the target of whiteboard item 5's "funding" transfers — the destination accounts exist; the transfer mechanism to fund them doesn't (Gap 5).
7. **Bank Reconciliation has a real, working backend module** — `backend/src/accounting/bank-accounts/` supports creating/completing reconciliations, adjusting entries, clearing settlements, and unidentified-bank-credit handling. It does not yet have an explicit "deposit" / "withdrawal" entry type or an inter-account transfer (see Gap 5).
8. **Two existing Operating Expense accounts already cover a simplified version of items 3 and 5** — `PCF/Revolving/Special Fund Replenishment` (`6-12-010`) and `LIQUIDATIONS` (`6-12-020`), both type `EXPENSE` (`coa-seed.service.ts:1352-1365`). Because they're type `EXPENSE` (unlike the Special Account accounts in Gap 1/2), **both already appear in the Expense screen's dropdown today**. That means a simplified version of "fund petty cash/the revolving fund" and "liquidate a cash advance" may already be technically possible right now — just as a flat P&L expense with no link back to the fund's actual balance or to the specific advance being liquidated. Whether NIG wants to keep this existing convention or move to the proper asset-tracking design this doc otherwise proposes (Gaps 2/3/5) is now the central open question for the meeting — see Open Questions.
9. **An older, unrelated "Liquidation" concept also exists in the schema** — `LiquidationForm` / `Expense` models (`prisma/schema.prisma:654-688`, distinct from `BusinessExpense`), seeded with demo "Reimbursement"/"BudgetRequest" data (`prisma/seed.ts:4637-4685`) and a full `accounting:liquidation` permission set (`prisma/seed.ts:1704-1708`). **No controller or service anywhere in `src/` uses it** — it's schema- and permission-only, never built into an API or a screen, and has no GL posting (`journalEntryId` doesn't exist on it). This is a different concept from the whiteboard's "CA-Liquidation" (that one settles a cash advance; this one looks like a staff expense-reimbursement workflow) — flagged as a decision, not assumed reusable (see Open Questions).

## What's not done / gaps ❌⚠️

1. **The Expense screen's category dropdown only shows `EXPENSE`-type accounts, filtering out the Special Account categories entirely.** `frontend/.../ExpensesList.tsx:34`: `accounts.filter((a) => (a.type ?? '').toUpperCase() === 'EXPENSE')`. Since "Advances to Employees" is type `ASSET`, it's invisible on this screen today — an accounting staffer physically cannot select it when recording a cash advance payout. **This is the core gap the developer confirmed the whiteboard is asking to close.**
   - **Checked and ruled out 2026-08-31**: AP Bills (`New Bill` modal) is **not** an alternative path for this, even though it looks tempting. `CreateAPBillDto.supplierId` is hard-required with no free-text fallback (unlike Expense's `payee`) — but the `Supplier` table was separately widened in Scenario 33 to hold non-vendor payee types too (`VendorType`: `EMPLOYEE`, `OFFICER`, `CONSULTANT`, `FOUNDER`, `OTHER`, alongside `SUPPLIER`), and the supplier search has no type filter, so an employee registered that way would appear in the Bill's supplier picker indistinguishably from a real vendor. Using it would still be wrong: an AP Bill posts debit-expense/credit-Accounts-Payable ("we owe them"), the opposite direction from a cash advance (debit-asset/credit-cash, "they owe us"). Flagging so this doesn't get proposed as a shortcut at the meeting.
2. **Only one generic "Advances to Employees" account exists** — no split into the four sub-types the board explicitly lists: Employee Cash Advance, Employee Cash Loan, Cash Loan – Others, CA-Liquidation. Today there's no way to tell these apart in the ledger or on a report.
3. **No liquidation workflow.** Nothing in the current system closes out / offsets a cash advance once it's repaid or accounted for — CA-Liquidation has no account, no posting logic, and no UI.
4. **Employee Appliance Loan (whiteboard item 4) has no backing model at all.** No `ApplianceLoan`/`EmployeeLoan` table, no module — confirmed via repo-wide search. This is net-new scope, not a gap in something partially built.
5. **No inter-account / fund-transfer feature.** Petty Cash Fund and Revolving Fund accounts exist, but nothing lets staff move money from a main operating bank account into them and have it post correctly to the GL and show up in reconciliation — whiteboard item 5's "Funding of Petty cash per branch" / "Funding u [of the] Revolving Fund" isn't wired to anything yet.
6. **`BankReconciliation` and `PettyCashVoucher` are schema-only, like the `LiquidationForm` model above** — both exist as Prisma models with a migration, but grep of `src/` turns up zero service/controller usage of `PettyCashVoucher` (the reconciliation model at least has `bank-accounts.service.ts` CRUD around it, but no deposit/withdrawal-specific entry point). "Update Bank recon (Deposit/withdraw)" from the whiteboard isn't a real, usable feature yet.

## Closing the gaps

Proposed, in dependency order — each needs sign-off at the Sept 3 meeting before building.

### 1. Redesign the Expense screen's Payee field so Special Account entries reach the right account and the right person

**Problem**: today the Expense screen only offers a Supplier link or a free-text Payee — neither is right for a cash advance/loan (an employee isn't a supplier, and free text can't be tracked back to a specific person for liquidation). Separately, the Category dropdown hard-filters to `type === 'EXPENSE'`, so the `ASSET`-type Special Account accounts from Gap 2 would be invisible there even if nothing else changed.

**Finalized design (developer, 2026-08-31)**: stop routing Special Account entries through the ordinary Category dropdown at all. Replace the single Supplier/free-text Payee field with a typed Payee choice:

- **Customer** → search the existing Customer list. Net-new link — `BusinessExpense` has no `customerId` today.
- **Supplier** → search the existing Supplier list, same as today.
- **Other** → not free text. Opens a structured list of exactly the four Special Account types:
  - **Employee Cash Advance** / **Employee Cash Loan** → must then search and pick a real employee. Net-new link — `BusinessExpense` has no `employeeId` today.
  - **Cash Loan – Others** → stays free text (confirmed 2026-08-31: can be paid to anyone, not restricted to staff — no fixed list to search against).
  - **CA-Liquidation** → picks whichever outstanding balance is being closed: an employee (closing an Employee Cash Advance/Loan) or the same free-text party (closing a Cash Loan – Others).

Picking one of the four Other options sets both the transaction's category (one of Gap 2's four accounts) and its payee in a single step — there's no separate Category-dropdown step for these, unlike ordinary expenses. Recording against any of the four still shouldn't hit the P&L — same double-entry mechanics `ExpensesService.record()` already has, just debiting the matching Special Account instead of an expense account.

**Data model needs**: two new optional fields on `BusinessExpense` — `employeeId` (→ `Employee`) and `customerId` (→ `Customer`) — alongside the existing `supplierId`/`payee`. This gap is tightly coupled to Gap 2 (the Other list has nothing to point at until the four accounts exist) — build and ship together.

### 2. Split "Advances to Employees" into the four Special Account categories

**Problem**: one account can't distinguish an advance from a loan from a liquidation.
**Confirmed 2026-08-31 (developer, re-reading the whiteboard)**: "Special Acct" is a parent/group, not an account itself — the four items underneath it (Employee Cash Advance, Employee Cash Loan, Cash Loan – Others, CA-Liquidation) are four separate accounts nested under that group. Not a per-transaction sub-type tag on one account.
**Fix**: add four child accounts under a "Special Account" parent, mirroring the existing sub-account pattern already used elsewhere in the COA seed (e.g. `6-01-010` → `6-01-011`/`6-01-012`): Employee Cash Advance, Employee Cash Loan, Cash Loan – Others, and a CA-Liquidation contra/clearing account. These four are exactly the four options Gap 1's Payee → Other list surfaces — staff never pick them from the ordinary Category dropdown.

### 3. Build the CA-Liquidation settlement flow

**Problem**: nothing closes out an advance once it's repaid.
**Reached via**: Payee → Other → CA-Liquidation (Gap 1) — the employee or Cash-Loan-Others party whose balance is being closed is picked there, not on a separate screen.
**New finding 2026-08-31**: an Operating Expense account named exactly `LIQUIDATIONS` (`6-12-020`) already exists and is already selectable on the Expense screen today. It's a flat P&L expense with no link to any specific employee's outstanding advance — recording against it doesn't reduce the "Advances to Employees" balance or any Special Account balance.
**Two designs to choose between at the meeting**:

- **Option A — keep it simple, matches the existing convention**: liquidation stays a plain expense entry (against `LIQUIDATIONS`, or the new CA-Liquidation account once Gap 2 splits it out). No system link back to the originating advance; someone has to manually net it against outstanding advances when reviewing the books.
- **Option B — a real settlement**, matching the "money owed back" framing the rest of this doc is built on: a liquidation entry references the specific original advance and posts an offsetting entry that actually reduces that employee's outstanding Special Account balance, so the ledger — not a manual reconciliation — shows what's still owed.

Either way, the meeting also needs to confirm the trigger (manual entry vs. payroll-deduction-driven vs. both) — see Open Questions.

### 4. Employee Appliance Loan (net-new)

**Problem**: no model exists at all.
**Proposed fix**: needs its own scoping pass once the meeting confirms whether this should reuse the existing customer `InstallmentAccount` machinery (financing terms, schedules, next-due-date — already built for customers, see [[project_installment_per_item_terms]]) pointed at an employee instead of a customer, or be a fully separate, simpler loan model. Recommend not building until that's decided — high risk of duplicating installment-account logic if scoped independently.

### 5. Inter-account transfers: fund Petty Cash and the Revolving Fund

**Problem**: no way to move money into the already-seeded Petty Cash / Revolving Fund accounts with a real GL trail.
**New finding 2026-08-31**: an Operating Expense account named `PCF/Revolving/Special Fund Replenishment` (`6-12-010`) already exists and is already selectable on the Expense screen today — so a simplified version of "funding" already works, structured as a flat expense (debit this expense account, credit cash) rather than a true transfer. That means the fund's own recorded balance never actually moves — the replenishment amount is expensed outright and the fund's `BusinessBankAccount.currentBalance` just sits at whatever it was seeded at, silently drifting from reality over time.
**Two designs to choose between at the meeting**:

- **Option A — keep it simple, matches the existing convention**: keep recording replenishments as a flat expense against this existing account. Cheapest to keep as-is, but the fund balances shown in the system go stale and can't be trusted for reconciliation.
- **Option B — a real transfer**: debit the destination fund's own balance and credit the source bank/operating account, so the fund's actual balance stays accurate and the movement shows up correctly in bank reconciliation. More correct, more work.

### 6. Decide the fate of `LiquidationForm`/`PettyCashVoucher`/`BankReconciliation`'s deposit-withdraw gap

**Problem**: three models exist in the schema with no live feature behind them (`LiquidationForm` has demo seed data and permissions but zero API; `PettyCashVoucher` has neither; `BankReconciliation` has partial CRUD but no deposit/withdrawal entry type).
**Proposed fix**: at the meeting, decide per model: build it out for real (folding into Gaps 3/5 above where it overlaps), or retire it as dead schema (the same call already made for `AccountingAuditLog` and `PayrollAuditLog` in [Scenario 39](./scenario-39-audit-log-coverage-plan.md)).

## Open questions for the Sept 3 meeting

- **New, and probably the most consequential question in this doc**: does NIG want to keep the existing flat-expense convention (`PCF/Revolving/Special Fund Replenishment`, `LIQUIDATIONS` — both already usable today, see What's Already Done #8) for fund replenishment and cash-advance liquidation, or move to the proper asset-tracking design proposed in Gaps 2/3/5? This decides whether Gaps 2, 3, and 5 are needed at all, or whether the real ask is smaller than currently scoped — possibly just Gap 1 (unlocking Special Account categories on the Expense screen) plus Gap 2 (splitting the categories), with no settlement/transfer logic behind them.
- If the proper design is chosen: does the existing `LIQUIDATIONS` (`6-12-020`) account get renamed/repointed into the new Special Account's `CA-Liquidation` account, get retired in favor of a new one, or stay as-is for a different purpose alongside it? Same question for `PCF/Revolving/Special Fund Replenishment` (`6-12-010`) once Gap 5 is decided.
- ~~Are the four Special Account categories meant to be four separate GL accounts, or one account with a sub-type tag on each transaction?~~ **Resolved 2026-08-31**: four separate accounts, nested under a "Special Acct" parent/group — see Gap 2.
- What actually triggers a CA-Liquidation entry — the employee handing back cash, a payroll deduction, or either? Does partial liquidation (paying back part of an advance) need to be supported?
- ~~Is "Cash Loan – Others" for non-employees or a catch-all?~~ **Resolved 2026-08-31**: can be paid to anyone, not restricted to employees — stays free text rather than a structured search (see Gap 1). Follow-on, still open: since it's free text, CA-Liquidation for a Cash-Loan-Others entry can only match it loosely (by typed name), unlike the exact link an Employee pick gives — acceptable, or does "anyone" eventually need its own lightweight record too?
- Does Employee Appliance Loan reuse the customer installment machinery (per Gap 4) or need its own simpler model — and does it deduct from payroll automatically, or get tracked/collected manually like a regular receivable?
- Is the orphaned `LiquidationForm` model (staff expense reimbursement — "Reimbursement"/"BudgetRequest") meant to be revived as part of this work, or is it unrelated dead schema to retire separately?
- For Bank Recon's "update bank recon (deposit/withdraw)" — is this asking for a new transaction type distinct from the existing adjusting-entry/reconciliation flow, or just a UI gap on top of what already exists?

## Not in scope for this doc

- **PO / supplier invoice & payment** (whiteboard item 1) — already fully built via `ap-bills`.
- **Payroll as an expense** (whiteboard item 2) — already recordable via the existing Expense screen against "Salaries and Wages."
- **AR / Collection** (whiteboard item 6) — substantial existing infrastructure, active in-progress work elsewhere in this tree (AR aging import, collector import). Not re-scoped here to avoid duplicating that effort.

# Scenario 40 — Special-Account Expense Categories (Employee Cash Advances, Loans & Liquidation) — Gap Analysis & Closing Plan

Source: a whiteboard photo of the internal Accounting-module planning agenda for **Thursday, Sept 3, 2026, 9:30am** — this meeting has not happened yet. This doc pre-stages the requirements from that photo against the current code so the team walks into the meeting knowing what's already built, what's missing, and what specifically needs a decision — not sourced from either scenario PDF, and not yet confirmed with the business owner. Every "closing gap" below is a proposal to validate at the meeting, not a decided spec.

**Reading of the whiteboard (confirmed with the developer, 2026-08-31)**: the right-hand red list ("Expenses → Utilities / AP / Salaries & Wages / Special Acct → Emp Cash Adv, Emp Cash Loan, Cash Loan-Others, CA-Liquidation") means all of those should be selectable **as categories on the Expense entry screen** — i.e. when someone records a cash outflow, "Employee Cash Advance," "Employee Cash Loan," "Cash Loan – Others," and "CA-Liquidation" need to show up as valid category choices alongside ordinary expense categories, even though they behave differently on the books (see Gap 1).

## Related ClickUp Tickets

None found. Net-new scope — create via the `clickup-create-ticket` skill once this doc is confirmed at the meeting.

## The scenario we're building toward

An accounting staff member opens the Expense entry screen to record any cash going out — a utility bill, a salary run, or a cash advance handed to an employee — and picks the right category from one list:

1. Ordinary expenses (Utilities, Salaries & Wages, AP-related payments) post straight to the P&L, same as today.
2. Money that goes out to an employee as a cash advance or a cash loan — or to someone else as a "Cash Loan – Other" — is **not** a P&L expense. It's still selectable from the same Expense screen (so staff have one place to record any outgoing cash), but it lands in a distinct "Special Account" bucket that represents money owed back, not money spent.
3. When that advance or loan is settled — the employee returns the cash, or it's offset against something owed to them — staff record a **CA-Liquidation** entry that closes it out, so the Special Account balance reflects what's actually still outstanding per employee.
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
8. **An older, unrelated "Liquidation" concept already exists in the schema** — `LiquidationForm` / `Expense` models (`prisma/schema.prisma:654-688`, distinct from `BusinessExpense`), seeded with demo "Reimbursement"/"BudgetRequest" data (`prisma/seed.ts:4637-4685`) and a full `accounting:liquidation` permission set (`prisma/seed.ts:1704-1708`). **No controller or service anywhere in `src/` uses it** — it's schema- and permission-only, never built into an API or a screen, and has no GL posting (`journalEntryId` doesn't exist on it). This is a different concept from the whiteboard's "CA-Liquidation" (that one settles a cash advance; this one looks like a staff expense-reimbursement workflow) — flagged as a decision, not assumed reusable (see Open Questions).

## What's not done / gaps ❌⚠️

1. **The Expense screen's category dropdown only shows `EXPENSE`-type accounts, filtering out the Special Account categories entirely.** `frontend/.../ExpensesList.tsx:34`: `accounts.filter((a) => (a.type ?? '').toUpperCase() === 'EXPENSE')`. Since "Advances to Employees" is type `ASSET`, it's invisible on this screen today — an accounting staffer physically cannot select it when recording a cash advance payout. **This is the core gap the developer confirmed the whiteboard is asking to close.**
2. **Only one generic "Advances to Employees" account exists** — no split into the four sub-types the board explicitly lists: Employee Cash Advance, Employee Cash Loan, Cash Loan – Others, CA-Liquidation. Today there's no way to tell these apart in the ledger or on a report.
3. **No liquidation workflow.** Nothing in the current system closes out / offsets a cash advance once it's repaid or accounted for — CA-Liquidation has no account, no posting logic, and no UI.
4. **Employee Appliance Loan (whiteboard item 4) has no backing model at all.** No `ApplianceLoan`/`EmployeeLoan` table, no module — confirmed via repo-wide search. This is net-new scope, not a gap in something partially built.
5. **No inter-account / fund-transfer feature.** Petty Cash Fund and Revolving Fund accounts exist, but nothing lets staff move money from a main operating bank account into them and have it post correctly to the GL and show up in reconciliation — whiteboard item 5's "Funding of Petty cash per branch" / "Funding u [of the] Revolving Fund" isn't wired to anything yet.
6. **`BankReconciliation` and `PettyCashVoucher` are schema-only, like the `LiquidationForm` model above** — both exist as Prisma models with a migration, but grep of `src/` turns up zero service/controller usage of `PettyCashVoucher` (the reconciliation model at least has `bank-accounts.service.ts` CRUD around it, but no deposit/withdrawal-specific entry point). "Update Bank recon (Deposit/withdraw)" from the whiteboard isn't a real, usable feature yet.

## Closing the gaps

Proposed, in dependency order — each needs sign-off at the Sept 3 meeting before building.

### 1. Let Special Account categories be selected on the Expense screen

**Problem**: the category dropdown hard-filters to `type === 'EXPENSE'`, so an `ASSET`-type advance/loan account can never be picked there.
**Proposed fix**: either (a) relax the filter to also include a small, explicitly-flagged set of non-expense "recordable via Expense screen" accounts, or (b) add a `postingBehavior`/`isSpecialAccount` flag on `Account` that the dropdown checks instead of raw `type`. Recording against one of these categories should **not** hit the P&L — it debits the advance/loan asset account instead of an expense account, same double-entry mechanics `ExpensesService.record()` already has, just pointed at a different account type.

### 2. Split "Advances to Employees" into the four Special Account categories

**Problem**: one account can't distinguish an advance from a loan from a liquidation.
**Confirmed 2026-08-31 (developer, re-reading the whiteboard)**: "Special Acct" is a parent/group, not an account itself — the four items underneath it (Employee Cash Advance, Employee Cash Loan, Cash Loan – Others, CA-Liquidation) are four separate accounts nested under that group. Not a per-transaction sub-type tag on one account.
**Fix**: add four child accounts under a "Special Account" parent, mirroring the existing sub-account pattern already used elsewhere in the COA seed (e.g. `6-01-010` → `6-01-011`/`6-01-012`): Employee Cash Advance, Employee Cash Loan, Cash Loan – Others, and a CA-Liquidation contra/clearing account.

### 3. Build the CA-Liquidation settlement flow

**Problem**: nothing closes out an advance once it's repaid.
**Proposed fix**: a liquidation entry that references the original advance and posts an offsetting entry, reducing the outstanding balance on that employee's Special Account. Needs the Sept 3 meeting to confirm the trigger (manual entry vs. payroll-deduction-driven vs. both) — see Open Questions.

### 4. Employee Appliance Loan (net-new)

**Problem**: no model exists at all.
**Proposed fix**: needs its own scoping pass once the meeting confirms whether this should reuse the existing customer `InstallmentAccount` machinery (financing terms, schedules, next-due-date — already built for customers, see [[project_installment_per_item_terms]]) pointed at an employee instead of a customer, or be a fully separate, simpler loan model. Recommend not building until that's decided — high risk of duplicating installment-account logic if scoped independently.

### 5. Inter-account transfers: fund Petty Cash and the Revolving Fund

**Problem**: no way to move money into the already-seeded Petty Cash / Revolving Fund accounts with a real GL trail.
**Proposed fix**: a transfer entry (from a source bank/operating account to a destination fund account) that posts a balanced journal entry and appears in both accounts' reconciliation views.

### 6. Decide the fate of `LiquidationForm`/`PettyCashVoucher`/`BankReconciliation`'s deposit-withdraw gap

**Problem**: three models exist in the schema with no live feature behind them (`LiquidationForm` has demo seed data and permissions but zero API; `PettyCashVoucher` has neither; `BankReconciliation` has partial CRUD but no deposit/withdrawal entry type).
**Proposed fix**: at the meeting, decide per model: build it out for real (folding into Gaps 3/5 above where it overlaps), or retire it as dead schema (the same call already made for `AccountingAuditLog` and `PayrollAuditLog` in [Scenario 39](./scenario-39-audit-log-coverage-plan.md)).

## Open questions for the Sept 3 meeting

- ~~Are the four Special Account categories meant to be four separate GL accounts, or one account with a sub-type tag on each transaction?~~ **Resolved 2026-08-31**: four separate accounts, nested under a "Special Acct" parent/group — see Gap 2.
- What actually triggers a CA-Liquidation entry — the employee handing back cash, a payroll deduction, or either? Does partial liquidation (paying back part of an advance) need to be supported?
- Is "Cash Loan – Others" for non-employees (e.g. a franchisee, a related party) or a catch-all for employee loan types that don't fit the other three buckets?
- Does Employee Appliance Loan reuse the customer installment machinery (per Gap 4) or need its own simpler model — and does it deduct from payroll automatically, or get tracked/collected manually like a regular receivable?
- Is the orphaned `LiquidationForm` model (staff expense reimbursement — "Reimbursement"/"BudgetRequest") meant to be revived as part of this work, or is it unrelated dead schema to retire separately?
- For Bank Recon's "update bank recon (deposit/withdraw)" — is this asking for a new transaction type distinct from the existing adjusting-entry/reconciliation flow, or just a UI gap on top of what already exists?

## Not in scope for this doc

- **PO / supplier invoice & payment** (whiteboard item 1) — already fully built via `ap-bills`.
- **Payroll as an expense** (whiteboard item 2) — already recordable via the existing Expense screen against "Salaries and Wages."
- **AR / Collection** (whiteboard item 6) — substantial existing infrastructure, active in-progress work elsewhere in this tree (AR aging import, collector import). Not re-scoped here to avoid duplicating that effort.

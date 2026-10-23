# Scenario 52 — Employee Cash Loan on the POS Side, Retiring Employee Appliance Loans — Gap Analysis & Closing Plan

**Source**: developer decision, 2026-09-17, arising from a screenshot of the Accounting sidebar (the "Employee Appliance Loans" nav item) and a live discussion of what should replace it. Not sourced from a client document — this is the developer's own call on scope and design, captured here before build.

## Related ClickUp Tickets

None found. Net-new scope — create via the `clickup-create-ticket` skill once this doc is confirmed.

## The scenario we're building toward

A cashier at a branch needs to hand cash to an employee — an advance against pay, recovered later through payroll:

1. From POS, the cashier opens a new **Employee Cash Loan** screen (not part of the checkout/cart flow — this is not a sale).
2. They search for the employee by name and enter the amount. No approval step — any cashier can issue on the spot.
3. On confirm, cash goes out, a GL entry posts, and the employee's running balance opens (or tops up) against the **same Special Account ledger** Accounting already uses for this today.
4. The employee gets a receipt.
5. The same POS screen shows that employee's current outstanding balance, read live from that one ledger — so POS and Accounting are always looking at the same number, never a second copy of it.

**Explicitly future work, not this scenario**: today, repaying the loan is a manual entry in Accounting (a payroll expense line, or a manual liquidation). The eventual goal is that processing payroll — which already runs through Accounting's Expense screen — recognizes an employee's name against their open cash-loan balance and deducts it automatically, with that deduction reflected back on this new POS view. That linkage is deliberately **not built in this scenario**; it's called out here so the ledger choice below doesn't box it out later.

**Result**: POS gets a real front door for issuing and viewing employee cash loans, without creating a second, competing ledger for the same concept Accounting already tracks.

## What's already done ✅

1. **Employee Appliance Loans is a complete, working, standalone feature** — its own Accounting nav item, list/detail/new pages (`frontend/src/app/(app)/(dashboard)/accounting/employee-appliance-loans/`), and backend module (`backend/src/accounting/employee-appliance-loans/`), built in Scenario 40 Part 4. Creation posts a GL entry immediately (no approval/draft step); repayment is a manual "Record Payment" button; nothing else in the system depends on it. Clean to remove.
2. **An "Employee Cash Loan" concept already exists — just not in POS.** Scenario 40 built a `SPECIAL_ACCOUNTS` expense category with an `EMPLOYEE_CASH_LOAN` type, reachable in Accounting via **New Expense → Payee → Other → Employee Cash Loan**. Issuing one there debits the mapped control account and credits cash, exactly the shape this scenario needs — see `backend/src/accounting/expenses/special-accounts.service.ts` and `SPECIAL_ACCOUNT_EMP_CASH_LOAN` in `account-mapping.service.ts:212-227`.
3. **The ledger's real identity is a free-text name, not an employee link.** Checked directly against `prisma/schema.prisma`'s `SpecialAccount` model (2026-09-17): the unique key is `(controlAccountId, name)`, and the model's own doc comment is explicit — _"Expense lines still carry the name as text... and are matched to this row by (control account, name) rather than by a foreign key... That makes the name the identity, which is why renaming one is not offered."_ `employeeId` exists on the model and is indexed, but is described as **"optional and purely descriptive"** — matching still happens by name (`special-accounts.service.ts:267-279`, a case-insensitive `contains` match against `BusinessExpenseLine.payee`).
4. **This directly contradicts a note in `scenario-checklist.md`'s Scenario 45 entry**, which states the employee picker and `employeeId` write were "retired" in favor of a plain-text Special Account Recipient field. Live code (2026-09-17) still shows `employeeId` fields on `CreateExpenseDto`/`CreateExpenseLineDto` (`expenses.dto.ts:54,303,452`) alongside the free-text `payee`. Whether these are dead/unused fields left over from before that retirement, or are actually still wired somewhere, is unconfirmed — flagged below rather than assumed either way, since it changes how strict the new POS issuance path needs to be about the name it writes.
5. **No FK exists between POS's `customerType: employee` tag and the real `Employee`/HR record.** `Customer.employeeNumber` (used when a POS walk-in is tagged as an employee at checkout) is free text with no relation to `Employee.id` — confirmed via `backend/prisma/schema.prisma` and `pos.dto.ts:1241-1246`. `SpecialAccount.employeeId`, by contrast, points at the real `Employee` table. These are two unconnected notions of "employee" already living in the system.
6. **No payroll-deduction automation exists for anyone today.** The only automatic settle-from-payroll mechanism (`settleInstalmentFromPayroll`, Scenario 48 Part 6) is keyed to `Customer` + `ARInvoice`/installment schedules — it has no path to a `SpecialAccount` balance or an `Employee`. Confirms the "auto-deduct from payroll" end goal is genuinely new infrastructure, not a small hookup, and rightly deferred out of this scenario.

## What's not done / gaps ❌⚠️

1. **POS has no entry point at all for an employee cash loan** — no page, no route, no server action, nothing under `pos/`. This is the core net-new work.
2. **No employee search endpoint is exposed to POS.** The real `Employee` directory is an HR/Accounting concept; POS today only searches `Customer` records. A cashier picking "the employee" needs a way to search the actual `Employee` table, not the POS customer list.
3. **The naming discrepancy in "What's already done" #3-4 is unresolved.** If POS writes a `SpecialAccount` under a name that doesn't exactly match how that same employee's name will later appear on a payroll expense line's `payee`, the balance silently splits into two accounts instead of one (the model's own unique key is `(controlAccountId, name)` — a near-miss spelling opens a second ledger, same failure mode the model's doc comment already warns about for hand-typed accounting entries).
4. **No read-only balance view exists anywhere for a Special Account keyed by employee** outside Accounting's own Special Accounts register (built in Scenario 40 Part 5) — POS needs its own view of the same data, not a duplicate store of it.

## Decisions taken

Confirmed with the developer, 2026-09-17:

| Question                                                                       | Decision                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New ledger, or reuse the existing one?                                         | **Reuse.** POS issues against the same `SpecialAccount` / `EMPLOYEE_CASH_LOAN` ledger Accounting already has — one balance, two front doors. No new Prisma model for the loan itself.                                                                                                                                                                      |
| Does POS get its own UI, or reuse Accounting's Expense form?                   | **Its own UI.** POS gets purpose-built list/detail/new screens, not the Accounting expense form embedded or linked into POS.                                                                                                                                                                                                                               |
| Approval required to issue?                                                    | **No.** Any cashier can issue on the spot.                                                                                                                                                                                                                                                                                                                 |
| Receipt on issuance?                                                           | **Yes.**                                                                                                                                                                                                                                                                                                                                                   |
| Repayment mechanism?                                                           | **Automatic payroll deduction is the intended end state**, but the actual linkage (reading the employee's name off a payroll expense line, deducting it from their `SpecialAccount` balance, reflecting that back on this POS view) is **explicitly deferred to a later scenario** — stated now only so this scenario's ledger choice doesn't preclude it. |
| Does this scenario build a manual "Record Payment" button in POS as a stopgap? | **Not decided yet — see Open Questions.** Default assumption below is no (view + issue only), pending confirmation.                                                                                                                                                                                                                                        |

## Closing the gaps — proposed parts

Each part gets its own e2e coverage and manual test steps, and stops for confirmation before the next begins (house convention — see Scenario 51).

### Part 1 — Retire Employee Appliance Loans

Remove the Accounting sidebar entry, its three pages (`list`/`[id]`/`new`), and the backend module (`employee-appliance-loans.controller.ts`/`.service.ts`/`.module.ts`, its DTOs, and its `app.module.ts` registration). Existing `EmployeeApplianceLoan`/`EmployeeApplianceLoanPayment` rows and their posted journal entries stay in the database untouched — this only removes the ability to create or view new ones from the UI. Confirm nothing else references the module before deleting (permissions, nav guards, tests).

### Part 2 — Employee search for POS

A backend endpoint POS can call to search the real `Employee` table (name search, active employees only — mirroring how `CreateEmployeeApplianceLoanDto` already validates `employeeId` against `Employee` with `deletedAt: null`). This is net-new surface area, not a reuse of any existing POS customer search.

### Part 3 — Issue a cash loan from POS

New endpoint(s) that, given an `employeeId` and an amount, resolve or create the matching `SpecialAccount` (control account = the existing `EMPLOYEE_CASH_LOAN` mapping) and post the same debit-control-account/credit-cash entry the Accounting expense path already posts — reusing `SpecialAccountsService`'s existing logic rather than re-deriving it. **Must resolve the Part identified in Gap 3 first**: decide and implement the exact name-writing convention (e.g., always derive the `SpecialAccount.name` from the same canonical `Employee` name field the future payroll-matching step will read) so a loan issued from POS and a deduction later recorded in Accounting land on the same account, not two.

### Part 4 — POS screens

List/detail/new pages under `pos/` (mirroring the existing `pos/credit-applications/` pattern for structure, not behavior): search employee → enter amount → issue → view receipt. Detail/list view shows the employee's current balance, read live from the same ledger Accounting's Special Accounts register uses — no separate stored balance.

### Not in this scenario

- **Automatic payroll deduction** — the actual linkage from a payroll expense entry to this ledger, and reflecting that deduction back on the POS view. Tracked as future work per the Decisions table above.
- **Any change to Accounting's existing Expense-screen Special Account flow** (Payee → Other → Employee Cash Loan stays exactly as Scenario 40/45 left it).
- **Approval workflows, loan amount caps, or repayment terms** — none requested.

## Open questions

- **Manual repayment stopgap in POS**: since automatic payroll deduction is deferred, should this scenario also add a manual "Record Payment" action in POS (temporary, to be superseded once auto-deduction lands), or should repayment stay exclusively in Accounting until then? Left as view+issue-only in the plan above pending an explicit answer.
- **The `employeeId`-vs-free-text-name discrepancy** (Gap 3-4): is `CreateExpenseDto.employeeId` actually dead code today, or does something still consume it? Needs a direct check before Part 3 decides how strict the name-matching convention has to be.
- **Employee identity source for the search picker**: confirmed to be the real `Employee` HR table (matching what `SpecialAccount.employeeId` points at), not the unrelated POS `Customer.customerType: employee` tag — worth double-checking this is what's meant, since the two "employee" concepts in the system don't overlap today.
- **Should a loan be issuable against an employee who has no branch/POS access at all** (e.g., an HQ or warehouse-only employee), or only against staff assigned to the issuing branch?

## Revision — the real design is an amortizing loan, not a simple advance (2026-09-17)

**This supersedes the "reuse the Special Account ledger" decision above.** Parts 1-3 were implemented against the original plan before this revision — see "What this means for what's already built" at the end of this section.

**Source**: the developer shared a spreadsheet — "Proposed screen: NEW EMPLOYEE CASH LOAN," headed **"I suggest these fields"** (a suggested design, not a confirmed client spec, but the working basis going forward) — reusing the deleted Employee Appliance Loan's field structure with interest added, plus a worked example of the intended journal entry.

### What the sheet actually asks for

Not a flat, interest-free running balance. An amortizing loan: a principal, a term, an interest rate, a computed schedule, and a **gross-receivable / deferred-interest** GL treatment:

```
Dr  Loans to Employees and Officers — Gross   56,000   (principal + interest, booked gross)
Cr  Unearned Interest Income — Employee Loans  6,000   (interest deferred, not yet earned)
Cr  Cash in Bank / Cash                       50,000   (what actually goes out)
```

This is a fundamentally different shape from Scenario 40's `SpecialAccount` ledger (which has no interest concept and no gross/deferred split at all) — so the "reuse the existing ledger" decision no longer holds.

### The field list (confirmed working basis)

Directly from the sheet, compared against the deleted `EmployeeApplianceLoan`'s own fields:

| Old Appliance Loan | New Cash Loan                 |
| ------------------ | ----------------------------- |
| Employee           | Employee (kept)               |
| Item / Appliance   | _removed_                     |
| Listed Cash Price  | Loan Principal                |
| Down Payment       | _removed_                     |
| Term (months)      | Term (months) (kept)          |
| MI Factor          | Interest Rate / Loan Factor   |
| Start Date         | Loan Date                     |
| —                  | First Deduction Date (new)    |
| —                  | Disbursement Method (new)     |
| —                  | Bank / Cash Account (new)     |
| —                  | Reference / Voucher No. (new) |

Plus a Note field (not on the sheet, kept for an audit trail — trivial addition).

**Computed Financing Terms panel** (the sheet's own right-hand panel, live as the form is filled in, server-recomputed as the source of truth on submit — same pattern the old Appliance Loan's `NewLoanForm.tsx` already used): Principal Amount, Total Interest, Total Amount Receivable, Term, Monthly Principal, Monthly Interest, Monthly Installment/Deduction, First Due Date, Final Due Date.

### UX — no modal, three real pages (developer decision, 2026-09-17)

Unlike Part 4's original "mirror `pos/credit-applications/`" plan (list + a create modal), this needs its own **New Loan page** — the two-panel entry-form/computed-terms layout doesn't fit a modal — and its own **Loan Detail page**, since a loan now has an ongoing life (schedule, balance over time), not just a flat number. Mirrors the deleted Appliance Loan's own three-page shape (list/`[id]`/new) more closely than Credit Applications' modal-based one.

1. **List page** — Employee, Principal, Term, Monthly Deduction, Next Due Date, Outstanding Balance, Status (Active/Paid Off). Row click → detail page. Still company-wide.
2. **New Loan page** — left panel is the entry form above; right panel is the live Computed Financing Terms preview. "Create Cash Loan" posts immediately, no approval step (unchanged from the original decision).
3. **Loan Detail page** — the computed terms as a permanent record, plus a read-only period schedule (due date, principal/interest split per period, recovered or not), plus "Print Voucher" (now showing full loan terms, not just an amount and a balance). No repayment action here — unchanged from the original "view + issue only, repayment stays in Accounting" decision; interest-bearing doesn't change that call.

### What's reusable, found while re-checking

- **The computation engine**: recovered from git (the module's files were deleted in Part 1, but nothing was removed from Prisma schema or git history). `backend/src/accounting/employee-appliance-loans/employee-appliance-loans.service.ts` on `development`: `amountFinanced = listedCashPrice − downPayment`, `monthlyInstallment = amountFinanced × miFactor`, `pnv (total payable) = monthlyInstallment × termMonths`, `totalPrice = pnv + downPayment`. Adaptable directly — principal takes the place of `listedCashPrice − downPayment` (no down payment here), and the deferred-interest posting is new (the old module posted principal only — its own schema comment calls that out as "simplified... no unearned-interest-income deferral").
- **Both GL accounts in the sheet's journal entry already exist in the real client chart of accounts, unused**: `1-01-060 Loans to Officers and Employees` (ASSET — confirmed live in the dev DB 2026-09-17, no mapping key wired to it yet) and `2-04-010 Unearned Interest Income` (LIABILITY — **already wired**, mapping key `UNEARNED_INTEREST_INCOME`, and **already actively posted to** by the customer-installment side of POS checkout for the same gross/deferred-interest treatment).
- **The release mechanism already exists for customers** — `backend/src/accounting/installment-interest-release/installment-interest-release.service.ts`: a manually-triggered batch, straight-lines a contract's deferred interest across its term by elapsed `InstallmentScheduleLine.dueDate`, posts `Dr Unearned Interest Income / Cr Financing Income` per period. Built specifically for customer `InstallmentAccount`/`InstallmentSchedule` records — not directly reusable for employee loans without an analogous schedule-line table, but it's the proven pattern to mirror, and the reason a real per-period schedule (not just a flat balance) is worth building even though repayment itself stays manual for now.

### Interest formula — working default, not confirmed

The sheet's own worked example (₱50,000 principal, 12 months, "3%" → ₱6,000 total interest) doesn't reconcile under a flat-rate, per-month, or annualized reading of "3%." Since the sheet is explicitly a suggestion, not a locked spec, this isn't being treated as a blocker: **working default is `Total Interest = Principal × Rate`** (flat, applied once), so a 3% entry gives ₱1,500 on ₱50,000. The Monthly Principal/Monthly Interest split in the computed panel is a straight-line divide of Principal/Term and Total Interest/Term respectively — that part of the worked example (₱4,166.67 + ₱500.00 = ₱4,666.67) is internally consistent and not in question.

### What this means for what's already built

Parts 1-3 were implemented on `feat/employee-cash-loan-pos` (both repos) before this revision landed:

- **Part 1 (retire Employee Appliance Loans) stands** — removing the old nav/pages/module was correct regardless; its computation engine is being recovered from git for reuse, not restored as a live feature.
- **Parts 2-3 (simple `SpecialAccount`-based advance — backend endpoints + POS list/modal UI) are superseded and need to be replaced**, not extended: wrong data model (no term/interest/schedule), wrong GL treatment (flat principal-only vs. gross/deferred-interest), wrong UX (modal vs. the two-panel New Loan page above). **Not yet reverted** — no code has been touched since this revision was raised; that work is pending explicit go-ahead.

### Revised parts to build (once approved)

1. Revert/replace the Part 2-3 backend: new `EmployeeCashLoan` model (standalone, not extending `InstallmentAccount` or the customer `SpecialAccount` — same "keep it standalone" call the original Appliance Loan made, for the same reasons), carrying the recovered financing computation plus the four new fields, with its own schedule-line table (mirroring `InstallmentScheduleLine`'s shape) so a real per-period due date/split exists. Issuance posts `Dr 1-01-060 (new mapping key) / Cr 2-04-010 Unearned Interest Income / Cr Cash`.
2. Revert/replace the Part 3 (well, formerly Part 4) frontend: the three pages above (list/new/detail), no modal.
3. **Open, not yet scoped**: whether an interest-release batch (mirroring `InstallmentInterestReleaseService`) is needed in this same pass, or deferred alongside automatic payroll deduction — recognizing earned interest over time is a related but separate concern from actually collecting the cash.

### Updated open questions

- The interest formula (see above) — using a flat-rate default, not confirmed.
- Whether interest recognition/release is in scope now or deferred with payroll auto-deduction.
- First Deduction Date — purely informational (like the old `nextDueDate`), or does it need to drive something later.

## Implementation Log — 2026-09-18

**For this scenario, I have done:**

- **Part 1** — Employee Appliance Loans fully retired: Accounting nav entry, its three pages, and the backend module (controller/service/DTOs, `app.module.ts` registration). Historical `EmployeeApplianceLoan`/`EmployeeApplianceLoanPayment` rows and their posted journal entries are untouched.
- **Parts 2-3, rebuilt to the revised (amortizing) design** — after Parts 2-3 were first implemented against the original "simple advance" plan and then found to not match the client's actual screen design (see the Revision section above), both were replaced, not extended:
  - Backend: standalone `EmployeeCashLoan` + `EmployeeCashLoanScheduleLine` models, the recovered-and-adapted financing formula, employee search, a live financing preview endpoint, a bank-accounts endpoint, list/detail, and issuance posting the real gross-receivable/deferred-interest entry. New `EMPLOYEE_CASH_LOAN_RECEIVABLE` mapping key, wired to the real client COA account where imported, with a generic-chart fallback account (`1-03-041`) so a fresh environment without the client's chart (e.g. the isolated test DB) works correctly too.
  - Frontend: three real pages (list/new/detail, no modal) — the New Loan page's two-panel layout matches the client's own proposed screen design directly (entry form left, live Computed Financing Terms right).
  - `backend/test/pos-employee-cash-loans.e2e-spec.ts` (10/10) and `frontend/e2e/pos-employee-cash-loans.spec.ts` (3/3), both rewritten for the amortizing design.
- **Two real bugs found during developer review, fixed same session**:
  1. The interest formula wasn't scaling with term (`principal × rate` instead of `principal × rate × termMonths`) — fixed, and now reproduces the client's own worked example exactly (₱50,000 / 12mo / 1% monthly → ₱6,000 interest, ₱56,000 receivable, ₱4,666.67/mo).
  2. The list page's client-side query cache was never invalidated after issuing a loan from the separate New Loan page (`revalidatePath` in the server action only affects Next's own RSC cache, not this client `useQuery` cache) — a cashier issuing a loan and returning to the list would see a stale "no loans" view for up to 30s. Fixed via an explicit `queryClient.invalidateQueries()` call on successful issuance.
- Both repos committed and pushed to `feat/employee-cash-loan-pos` (backend `33d4c75`, frontend `56fc33c`).

**Explicitly deferred, not part of this scenario — tracked here so they don't get lost:**

1. **Automatic payroll deduction / repayment recognition.** Nothing in this scenario reduces `currentBalance` — it will sit equal to `openingBalance` until this is built. Needs its own scoping pass (how a payroll expense line identifies which loan it's paying down, given there's no structural link between a payroll line's typed name and a specific `EmployeeCashLoan` row today).
2. **The interest-release batch** (recognizing the deferred `UNEARNED_INTEREST_INCOME` as earned `FINANCING_INCOME` over time, period by period) — the pattern to mirror is `installment-interest-release.service.ts` (built for customer `InstallmentSchedule`/`InstallmentScheduleLine`, not this scenario's employee-loan schedule table), but building an employee-loan equivalent is real, unscoped work, not a trivial extension.
3. **No manual "Record Payment" action anywhere in POS.** Repayment recording stays exclusively in Accounting for now (and per #1, doesn't actually exist there yet either for this specific loan type — Accounting has no UI wired to `EmployeeCashLoan` at all, by design, since this was built POS-first).

**Not yet done, worth flagging:** no manual click-through confirmation beyond what's described in this log — verification for both bug fixes was via the automated e2e suites plus live screenshots during the session, not a separate final manual pass.

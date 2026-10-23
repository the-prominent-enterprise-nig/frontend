# Scenario 63 — Special Accounts ↔ Payroll ↔ Employee Cash Loans — Gap Analysis & Fix Record

**Source**: developer question, 2026-09-30: "Is Special Accounts connected to payroll expenses, like the minus [deductions] and payment?" Built on `feat/scenario-63-special-accounts-loan-sync` in both repos.

## Related ClickUp Tickets

None found.

## What already worked ✅

- **Payroll deductions → Special Accounts.** A negative payroll line marked Special Account, with a name and a control account (e.g. `1-01-052`), is a credit in that person's ledger and lowers their balance.
- **Cash advances → Special Accounts.** A positive Special Account expense line is a debit.
- **Payroll deductions → Employee Cash Loan balance.** A deduction on the Employee Cash Loan account lowered the loan's `currentBalance`, oldest loan first, matched by name (`settleCashLoanFromPayroll`).

## Gaps found ❌

1. **Special Accounts read only expense lines.** An Employee Cash Loan's release and its Pay-action payments never appeared: the borrower was registered at ₱0, and payroll deductions then drove the balance negative while the loan screen showed the real figure.
2. **A payroll deduction left no trace on the loan.** No `EmployeeCashLoanPayment` row was created, so the deduction was missing from the loan's history. It also skipped the interest recognition the Pay action does (Dr Unearned Interest / Cr Financing Income), so interest income was understated on payroll-recovered loans.
3. **Two accounts for one thing.** Loans post to `EMPLOYEE_CASH_LOAN_RECEIVABLE` (client chart `1-01-060`; generic chart `1-03-041`). Payroll settlement only fired for lines on `SPECIAL_ACCOUNT_EMP_CASH_LOAN` (generic `1-03-022`, unmapped in the client setup).
   - A deduction posted to the loan's real account, `1-01-060`, never paid down the loan.
   - A deduction posted to the other account never reduced the receivable in the GL.
4. **Blocker.** With `SPECIAL_ACCOUNT_EMP_CASH_LOAN` unmapped, recording any payroll with a Special Account deduction failed with "mapping not configured", even one recovering only a cash advance.
5. **Matching by name only.** Two employees sharing a name would get each other's deductions.

## What was built

**Backend**

- **Payroll → loan** (`ExpensesService.record` / `settleCashLoanFromPayroll`):
  - A deduction counts as a loan deduction when it is posted to either `EMPLOYEE_CASH_LOAN_RECEIVABLE` or `SPECIAL_ACCOUNT_EMP_CASH_LOAN`.
  - Both accounts are resolved with `getMapping`, which never throws, closing gap 4.
  - Matching uses the line's linked employee first and falls back to the typed name (gap 5, partly).
  - Each applied amount creates an `EmployeeCashLoanPayment`: no bank, and linked through `expenseId` / `deductionAccountId` (gap 2).
  - Its journal entry holds only what the payroll entry didn't:
    - the interest reclass (shared `loanPaymentInterest()`, which the Pay action now uses too);
    - for a deduction posted to the older account, the move across (Dr that account / Cr receivable). This fixes the GL side of gap 3.
- **Special Accounts** (`SpecialAccountsService`): the register and ledger are now built from one movement list:
  - expense lines, as before
  - loan releases (debits)
  - Pay-action payments (credits)
  - the moved-across payroll deductions (credit on the receivable, debit on the older account)

  Names are grouped with the payroll matcher (`name-keys.util.ts`), so "HAHN, JENNA" and "Jenna Hahn" are one balance. Ledger rows link to the loan when there is no expense (gap 1).

- **Registration:** a new loan registers its borrower under the account it actually posts to (the receivable), not the older one.
- **Migration** `20260930120000_scenario_63_loan_payroll_payments`: `employee_cash_loan_payments.bankAccountId` becomes nullable, plus new `expenseId` and `deductionAccountId` columns.

**Frontend**

- The Special Accounts ledger links loan rows to the loan.
- An employee loan's page now shows a **Ledger** (release + payroll deductions) under its schedule. Payroll payments read "Payroll deduction (EXP-…)".

## Behaviour change to know

A loan with any payment can't have its principal, interest or term edited (existing rule). Payroll deductions now count as payments, so a payroll-recovered loan is locked the same way. Previously an edit silently reset the balance and discarded what payroll had already recovered.

## Implementation Log — 2026-09-30

- **Backend:** full suite passes (unit tests including 8 new ones in `payroll-loan-settlement.spec.ts`). Build and lint pass with no errors.
- **Frontend:** type-check passes; lint has warnings only.
- **Live test, local backend and browser.** A ₱12,000 loan to Jenna Hahn at 3% × 12 months (₱16,320 receivable), then a payroll deduction of ₱1,000 typed "HAHN, JENNA":
  - It became a loan payment linked to the payroll, with no bank, and the loan went to ₱15,320.
  - The payment's journal entry recognized ₱264.71 of interest.
  - Special Accounts shows a single "Jenna Hahn" row at ₱15,320. The ledger has the release and the deduction, each linking to its source. The loan page shows both in its new Ledger.
  - A payroll with only a cash-advance deduction recorded without error, with the cash-loan mapping unset.
  - An OTHER loan of ₱5,000 with a ₱2,000 Pay-action payment shows ₱3,000 in the register.
  - All test data was deleted afterwards, and the `UNEARNED_INTEREST_INCOME` mapping borrowed for the test was restored to unset.
- **Local environment:** `UNEARNED_INTEREST_INCOME` is unset, so loans with interest can't be created until it is mapped.

## Not done / open

- **Existing data isn't backfilled.** Payroll deductions recorded before this change have no payment rows or interest reclass. Their loans' balances were already reduced, so a backfill would only add history and interest; say if wanted.
- **Account flag.** In the generic chart the loan receivable `1-03-041` isn't flagged `isSpecialAccountControl`, so payroll can't put a name on it. The client chart's `1-01-060` is flagged.
- **Name fallback.** Two people with the same name are still ambiguous when the payroll line has no linked employee.

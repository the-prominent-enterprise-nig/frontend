# Bug fix — Payroll import sends loan deductions to the wrong account

**Branch:** `fix/payroll-import-duplicate-account-names` · **Found:** 2026-10-05, importing the client's `Salaries and Wages_Disbursement.xlsx` locally

## The bug

The client's chart of accounts has two accounts with the same name:

| Number     | Name                            | Keeps a per-name ledger (`isSpecialAccountControl`) |
| ---------- | ------------------------------- | --------------------------------------------------- |
| `1-01-060` | Loans to Officers and Employees | ✅                                                  |
| `1-03-041` | Loans to Officers and Employees | ❌                                                  |

`importSpreadsheetLines.ts` matched column A to an account through a
`Map<name, id>`, so the last account with a given name won. Every
"Loans to Officer's and Employees" row landed on `1-03-041`. Because that
account keeps no ledger, the recipient's name went into Description instead
of the Special Account field, and no loan or Special Account balance was
ever drawn down. The voucher still looked right, so nothing warned the user.

## Reproduce (before the fix)

1. Expenses → New Expense → Payee: Other, Category: Payroll.
2. Import from spreadsheet → `Salaries and Wages_Disbursement.xlsx`.
3. The 126 loan rows show Account `1-03-041`, an empty Special Account
   column, and the person's name in Description.

## The fix

- Accounts are indexed as `Map<name, Account[]>`, keeping every candidate.
- `pickAccount()` resolves a row:
  - one candidate → that one;
  - several, and column B names a person → the single candidate that keeps a
    per-name ledger;
  - otherwise → left blank, and the label is reported in a new
    `ambiguousAccounts` list rather than guessed.
- `ExpenseForm` shows: _"More than one account is named … — those lines need
  the right Account picked before saving."_

## Verification

Ran the real `importSpreadsheetLines()` against the client's sheet and the
local chart (308 accounts):

| Account                                        | Lines   | With recipient name |
| ---------------------------------------------- | ------- | ------------------- |
| `1-01-052` Advances to Officer's and Employees | 242     | 242                 |
| `1-01-060` Loans to Officers and Employees     | **126** | **126**             |
| `1-01-023` Accounts receivable – MI            | 125     | 0                   |
| Salaries, Pag-IBIG, withholding                | 164     | 0                   |

657 lines, nothing unmatched or ambiguous. Before the fix the 126 loan lines
were on `1-03-041` with no names. `pnpm type-check` and lint pass.

## Not covered

- The duplicate name itself is chart data. Renaming or deactivating
  `1-03-041` would remove the ambiguity at the source; that is the client's
  call.
- Special Account balances are matched by name. The backend now groups
  `SURNAME, FIRSTNAME` and `Firstname Surname` (Scenario 63), so the sheet's
  spelling reaches the right balance.

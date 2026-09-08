# Scenario 48 — Payroll as an Expense Entry — Gap Analysis & Implementation Record

**Source**: a client feedback list shared directly in a chat session on 2026-09-04, followed the same day by their real `Salaries and Wages_Disbursement.xlsx` and two photographs of the reference accounting tool they are copying (esmeres.accounting.link). The chart-of-accounts half of that session is split out to [Scenario 49](./scenario-49-client-chart-of-accounts-plan.md), because it is a correction rather than a feature and must not be read as part of this one.

**The client's notes, verbatim** (the payroll portion):

```
Payroll
- per branch -> department
- payee should be name / department
- add division - dropdown came from branches and departments
- should support cash advances and cash loans
- vat change to dropdown - non-taxable, input vat (12%)
- special account should have cash advance option

Bank Recon
- difference / discrepancy is clickable - when clicked show all transactions
  in that period for that bank
- they can input date range

CRM - customer
- remove status filter
- remove sources filter
- filter by branch
- filter if cash / charge
```

Then, on the same day: _"if we submit a xls or cvv file it should arrange itself like this"_ — with the reference tool's line grid photographed alongside our own New Expense screen.

## Related ClickUp Tickets

None found. Net-new scope — create via the `clickup-create-ticket` skill.

## The scenario we're building toward

An accounting clerk has a 659-row payroll disbursement spreadsheet. They open **New Expense**, import it, check what came in, and save one entry.

1. They pick **Payee → Other → Salaries & Wages** and click **Import from spreadsheet**.
2. 657 lines appear. `TOTAL NET PAY` and `GRAND TOTALS` are skipped as totals rather than transactions, so the lines net to exactly the cash paid out.
3. Each line carries its account, the person or division it is for, and its amount — positive for gross pay, negative for a deduction.
4. Deductions that recover an advance or a loan are marked **Special Account = Yes** against the person's name, so the balance follows them.
5. A deduction of someone's monthly instalment names that customer, and saving settles their instalment dues.
6. The entry's total is the net cash, and the payment row credits the bank for it.

**Result**: a payroll run is one auditable expense entry that posts correctly and settles what it should, instead of 659 rows of hand-keying.

## Decisions taken

Confirmed with the developer during the session:

1. **Division is per line, not per entry** (2026-09-07, from the reference tool photograph). One payroll run spans every department it pays — the client's own sheet has 58 in a single entry — so a header-level dimension could never describe it. `Division` is one pick from the tenant's **branches and departments listed together**, which is the literal reading of _"dropdown came from branches and departments"_.
2. **There is no Division entity.** A line stores `divisionBranchId` **or** `divisionDepartmentId`, never both. An earlier build had a `Division` table; it was removed once the reference tool showed what the word meant.
3. **NEGROS → NWHSE, PANAY → PWHSE** (2026-09-07). The sheet names departments by region; `Branch.region` already carried exactly that vocabulary.
4. **Special Account is a yes/no**, not a list of types (2026-09-07). See the gap section — the list actively fought the Account picker beside it.
5. **VAT keeps `development`'s four tax codes** (`'' | VAT | NON_VAT | EXEMPT`), not a new pair. What changed is that the _amount_ is derived from the code rather than typed.
6. **`GUIMARAS` is left unresolved.** It prefixes both `Guimaras - Buenavista` and `Guimaras - Jordan`; guessing would file a whole branch's payroll under the wrong one.

## What's already done ✅

Verified against the branch, not assumed:

1. **Split-line transactions were already fully supported** — `BusinessExpense` → `BusinessExpenseLine[]`, `JournalEntry` → `Transaction[]`, each line with a real FK to `Account` plus separate free-text `description`/`payee`. The audit requested on 2026-09-05 found all three requested patterns present; no refactor was needed.
2. **Bulk payment across several instalments already existed** — `allocateBulkPayment` (`CollectionsScreen.tsx:202`) settles selected dues in due order, capping each, landing excess on the last.
3. **`Branch.region`** (`panay | negros`) already existed for Scenario 27's warehouse pairing, and is exactly the vocabulary the payroll sheet uses.
4. **The four Special Account control accounts** already existed in the client's chart once loaded — `1-01-052`, `1-01-060`, `1-01-023` and the statutory payables. See Scenario 49.

## What's not done / gaps ❌⚠️

As found at the start of the session:

1. **No Department entity at all.** `departmentId` existed only as a dangling free-text column on `budgets` with no table behind it. Nothing seeded departments; `prisma/seed.ts` mentioned them only as permission strings.
2. **Negative line amounts were rejected** — `@Min(0.01)` on the DTO, `min="0.01"` on the input. 601 of the sheet's 657 rows are credits, so the file could not be encoded at all.
3. **VAT was a free-text amount box**, so a typed figure could disagree with the line it sat on, and the Input VAT debit posted from it had no way to tell.
4. **No spreadsheet import anywhere near expenses**, despite five master-data import utilities already existing in `prisma/`.
5. **The Account picker listed EXPENSE accounts only** (`ExpenseForm.tsx:237`, then named `expenseAccounts`). Every account a payroll run credits — the receivable, both statutory payables — was unreachable, and searching for them returned nothing however they were spelled.
6. **Bank Reconciliation's Discrepancy was a static tile.**
7. **CRM customers had no branch and no cash/charge dimension**; the list filtered by status and source instead.
8. **Payroll advance recoveries never reduced anyone's balance.** `getOutstandingBalanceForAccount`'s advances leg filtered `specialAccountType: { not: 'CA_LIQUIDATION' }`, which drops NULL rows outright — SQL inequality against NULL is unknown, not true. Harmless while only OTHER-header entries reached those accounts; wrong the moment a payroll run (SUPPLIER header, null type) recovered one. **Found by manual testing, not by the test suite.**
9. **Chart of Accounts search and type filter did nothing.** `GET /accounts` took no parameters; the screen had always sent `search`, `type` and `limit` and the service ignored all three. A search for nonsense returned all 325 accounts.

## What was built

### Part 1 — The dimensions

`Department` is new: owned by exactly one branch, soft-deleted, with CRUD at `/departments` gated on `admin:departments:*` (seeded under the existing `admin` module so `admin:*:*` holders need no role change) and full audit entries. A **Settings → Departments** page maintains them.

An expense **line** carries `divisionBranchId` / `divisionDepartmentId`, validated as one pick. The list filters by either.

`prisma/seed-departments.ts` seeds the 20 departments named in the client's own sheet, mapping `-NEGROS`/`-PANAY` onto NWHSE/PWHSE.

### Part 2 — Negative lines

A line amount may be negative; zero is rejected as a mis-key. A negative line **posts as a credit of its absolute amount**, not a negative debit — a trial balance would choke on the latter. Deductions are always non-taxable: deriving a negative Input VAT would quietly reduce the period's debit. The entry as a whole must still be money going out, since `record()` credits cash for the total.

### Part 3 — VAT derived, not typed

The form sends a treatment; the server computes the amount and ignores anything supplied. The code is stored exactly as sent so `development`'s own tax-code guard still recognises it; `normalizeExpenseTaxCode` only interprets it, and still accepts the older `INPUT_VAT`/`NON_TAXABLE` spellings.

### Part 4 — Spreadsheet import

`importSpreadsheetLines.ts` reads `.xlsx`/`.csv` in the browser and drops rows into the line table for review. Nothing uploads; nothing saves until Save. Columns are positional per the client's own mapping: A → Account, B → Division, C → positive, D → negative. A **Download template** button sits beside it, reusing the `downloadCsv` helper the inventory bulk-import modals already use.

**Against the client's real file: 657 of 657 accounts resolve, 57 of 58 org units resolve, and the lines net to ₱1,854,911.39 — exactly the TOTAL NET PAY the sheet itself states.** That figure matching is the evidence that skipping the summary rows is right.

### Part 5 — Special Accounts

A line is **Special Account = Yes/No**. Which control account it sits under comes from the Account picker; a Yes requires a name. A new **Accounting → Special Accounts** register lists `name | control account | balance | entries | last activity`, grouped by (control account, name) — the same person can be carried under an advance and a loan at once, and netting them would hide one behind the other. Only RECORDED entries count.

### Part 6 — Payroll → Collections

An expense line may name a customer. Recording the expense settles that customer's instalment dues oldest-first.

**The GL is deliberately untouched by this step.** The line's own credit to the receivable _is_ the journal entry, so this updates the subsidiary ledger only — calling `recordPayment` (which posts `Dr Cash / Cr AR`) would have credited the receivable twice for one deduction. The `ARPayment` rows point at the payroll's own JE, which is genuinely correct. Verified: one ₱2,500 deduction cleared three dues (1,137.25 + 588.46 + 774.29) against **exactly one journal entry**.

The line's customer is picked under its Name, and import pre-fills it by matching the recipient — indexed as given, surname-first flipped, and both with middle initials dropped, since the sheet writes `ADVENCULA, JUVY B.` where a customer record says `Juvy Advencula`. An ambiguous name is dropped rather than guessed.

## Accepted tradeoffs

1. **Customer matching is by name.** There is no employee↔customer link. A name held by two customers matches neither. The picker exists so a wrong match is visible rather than silent.
2. **`GUIMARAS` imports without a division** — three rows, deliberately.
3. **Loose branch matching** (`BAGO CITY` → `Bago`, `JORDAN` → `Guimaras - Jordan`) runs only after exact matching fails, and commits only when exactly one branch is a candidate.
4. **Payroll's home is `Payee → Other → Salaries & Wages`**, which came from `development`'s own `otherCategory` work rather than this branch.

## Open questions

1. **`GUIMARAS` — Buenavista or Jordan?** For the client.
2. **Should employees be linked to customers structurally**, rather than matched by name? Of 262 payroll recipients, only 3 appear in the client's AR aging file, so the two populations barely overlap — worth confirming that is expected.
3. **`Budget.departmentId`** is still a loose `String?` with no FK, now that a real `Department` exists. Needs `SELECT count(*) FROM budgets WHERE "departmentId" IS NOT NULL` against real data before adding one.

## Risks

**Payroll is a shell.** `frontend/src/app/api/payslips/[id]/download/route.ts` proxies to `GET /payslips/:id/download`, and **the backend has no payslips module** — the only matches are permission strings in `users.service.ts`. `PayrollSummaryWidget`, `LeaveRequestsWidget` and `schema/human-resource/leave` are scaffolding with no service behind them. Anyone starting payroll work should know this before estimating.

**Three client datasets sit in `prisma/data/` with working parsers and no caller** — the customer master (236,801 rows), the AR aging book (13,248 rows), and the GL mapping document (49 posting rules). The first was found only because a hand-written seed was written by mistake first. Someone should establish whether that is deliberate.

## Verification

- Backend **574/574** tests pass; `tsc` clean; lint clean in touched paths.
- Frontend `tsc` clean, `next build` succeeds, lint clean (warnings only, at parity with the branch point).
- The importer was run as **the real module**, not a reimplementation, against the client's actual file with live data pulled from the database.
- Payroll expense with negative lines posted end-to-end and the resulting JE inspected: `Dr Salaries 69,945.69 / Cr deductions 4,763.75 / Cr Cash 65,181.94`, balanced, no negative debits.
- **Not done**: the four Playwright specs (one updated, three new) have never been executed — they need both servers plus a login, and the auto-mode classifier blocks the DB reset their `webServer` triggers.

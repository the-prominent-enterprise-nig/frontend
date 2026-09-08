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

## Revision — payroll pulled back behind its own category (2026-09-08)

The build above put Import, **Division**, **Special Account** and **Name** on the
shared line grid, so every expense — a utility bill, a box of stationery — got
payroll's columns and an Import button that nothing there could feed. The
developer's call: the expense screen goes back to what
`feat/accounting-expenses-voucher` had, and payroll gets a category of its own.

**Payroll is now `Payee → Other` with `Payroll` typed into Other Category.**
Other Category stays the free-text box it has always been — the word is matched
case-insensitively rather than picked from a dropdown, which is what keeps the
field itself unchanged. `PAYROLL` joins `OTHER_CATEGORIES` server-side, so the
typed word is stored and a payroll run is afterwards identifiable as one.

Behind that category, and nowhere else:

|                            | Off payroll                                                    | On payroll                                                                           |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Line grid                  | Account · Description · Amount · Tax Code · Tax Amount · Total | + Special Account, Name, Division                                                    |
| Import / Download template | absent                                                         | present                                                                              |
| Line amount                | `min 0.01`, must be > 0                                        | negative allowed (deductions)                                                        |
| Account picker             | EXPENSE accounts                                               | every postable account                                                               |
| Sent per line              | —                                                              | `isSpecialAccount`, `payee`, `divisionBranchId`/`divisionDepartmentId`, `customerId` |

`PAYROLL` keeps its free-text `payee` in `resolveHeader` (`UTILITIES` was the
only category that did). Without that the header would drop the very word the
clerk typed to get into payroll mode, and an entry would not re-open in it.

**One deliberate departure from the branch**: Tax Amount stays **read-only and
derived** everywhere, rather than going back to a typed box. The branch's server
took `line.taxAmount` as given; today's derives it from `taxCode` and ignores
what is sent (`expenses.service.ts:441`), and that is untouched here. Restoring
the input would put a field on screen whose value is silently discarded.

Nothing is stranded: a query over `business_expense_lines` found **zero** rows
carrying a division, a special-account flag, a customer or a negative amount, so
no saved entry loses data by the columns going away.

**Left alone**: the Expenses list keeps its Division filters and its
"name / division" recipient summary, and Settings → Departments stays — payroll
entries still have to be findable. Backend validation stays permissive (UI
gating only), so nothing already saved fails on edit.

**Interim, by design.** The CSV upload is parked under a category until payroll
gets a screen of its own; see the _Risks_ note above on how little of payroll
actually exists.

## Revision 2 — Special Account becomes the name, not a yes/no (2026-09-08)

Prompted by the client's own screen alongside ours. Theirs puts a **named
balance** in the Special Account column — `CL MONTELIBANO -BLDG IMPROVEMENT
(P4,787,136.51)`, `NARCISO SANTIAGO` — with no separate Name column. Ours had a
Yes/No beside a free-text Name, and every imported line came back **No**.

### Why it was always "No"

`specialAccountFor()` matched a four-entry alias list — `employee cash advance`,
`employee cash loan`, `cash loan others`. The client's sheet writes **`Advances
to Officer's and Employees`** and **`Loans to Officers and Employees`**. The
aliases had been deleted earlier "now that the client's own chart is loaded", on
the reasoning that those names resolve to real accounts directly — but nothing
replaced the _signal_ that those accounts keep a per-person ledger. So
`specialAccountType` was `''` on every row of the client's file, and the alias
list had become unreachable code.

### The fix: it is a property of the account

New column `Account.isSpecialAccountControl`, backfilled from the client's own
"SPECIAL ACCOUNTS — RECORDING/LEDGER … per Transactions/Employee" list, which
names control accounts rather than entries. Eleven accounts flagged: their nine,
plus `Advances to Non-Employees` and `Loans to Officers and Employees` — **not on
their list**, added because every deduction line in their construction payroll
screenshot posts to the first, and their disbursement sheet carries per-person
rows on the second. Both need the client's confirmation.

A flag, not a mapping key: this is a set, not a named role, and its membership is
the client's to change without a code release.

### The fix: one control, not two

`SpecialAccountPicker` replaces the Yes/No **and** the Name column. It is an
editable combobox — suggestions come from `GET /expenses/special-accounts`
scoped to the line's own account, each with its running balance the way the
client's tool shows it, and a name not yet in the register can simply be typed.
That last part is required, not a convenience: the register is derived from
RECORDED lines, so a person's first advance can never be in it.

`isSpecialAccount` is now **derived** on submit — a name under a control account
is a special-account line — so the flag and the name can no longer disagree.
Inert, greyed and placeholdered `—` on an account that keeps no ledger.

The picker is portalled, like `CategorySelect`, because the line grid scrolls.

### Where column B goes now

Decided by the resolved account, not by whether the text looks like a person:

| Column B                          | Lands in        |
| --------------------------------- | --------------- |
| Matches a branch or department    | Division        |
| Account keeps a subsidiary ledger | Special Account |
| Anything else                     | Description     |

Customer matching moved off `payee` onto column B itself — a receivable line
names a person but keeps no per-name ledger, so its name sits in Description, and
it is exactly the line with instalments to settle.

### Environment

Both seeds had only ever run against the throwaway test database. Run here
2026-09-08: `seed-client-coa.ts` (325 → 397 accounts, 44 relocated) then
`seed-departments.ts` (20 created). Before that, **none** of the client's control
accounts existed and there were zero departments — which is the rest of why the
screen looked wrong. See [Scenario 49](./scenario-49-client-chart-of-accounts-plan.md).

### Still open

1. **Is the client's list exhaustive?** It omits `Advances to Non-Employees`,
   which their own screenshot uses throughout.
2. **`Accounts receivable - MI` is deliberately not flagged.** Its balances are
   per customer and already tracked in the instalment ledger; flagging it would
   double-represent them in the Special Accounts register.
3. **`1-03-023 Cash Loan – Others` and `1-03-024 CA-Liquidation`** — the invented
   chart's own special accounts — were not relocated by the COA seed and now sit
   interleaved among the client's fixed assets. Mappings resolve; the chart reads
   wrongly.

## Revision 3 — matching the client's live payroll entry (2026-09-08)

From four screenshots of their own system: a real payroll entry (`NIG EMPLOYEES`,
`PAYROLL AUGUST 28, 2026`), its deduction rows, ours beside it, and their printed
voucher.

### Description was about to print blank

Their entry carries **both** — `HR DEPARTMENT PANAY` in Description, `HR
DEPARTMENT` in Division — and Description is the column their printed voucher
shows. Our importer treated the two as either/or, filling Description only when
no Division matched. Seeding the departments would therefore have _emptied_ the
voucher's Description column. Column B now populates both; the exception is a
control account, where column B is the name a balance is carried against and the
memo is a sentence the user writes.

### `Advances to Executives` was missing

Their entry files executive advances against `1-01-050` with a person in Special
Account. Not on the list they sent. Flagged, pending confirmation. Its sibling
`1-01-049 Advances to Agents` deliberately left alone — nothing seen shows it
carrying per-person balances.

Their `Pag-ibig Loan Payable` row has **no** Special Account, confirming the
earlier call to leave the statutory payables unflagged.

### Divisions are region-free

Their Division column reads `HR DEPARTMENT`; the region lives in Description.
Ours were branch-owned and region-suffixed, so every department appeared twice.
`Department.branchId` is now nullable (partial unique index covers the company-
wide case, since Postgres treats NULLs as distinct), `seed-departments.ts`
reseeds their twelve names, and the twenty branch-owned ones are soft-deleted —
guarded on nothing referencing them.

**Their mapping is curated, not mechanical**, and this is the part to watch:
`MARKETING DEPARTMENT PANAY` files under `NIG MARKETEAM`; both `ACCOUNT
RECEIVABLE` and `CREDIT & COLLECTION` collapse into `AR & COLLECTIONDEPARTMENT`.
`DIVISION_ALIASES` in the importer holds what their screenshot shows and nothing
more. `SALES AND MARKETING DEPARTMENT NEGROS` is left unmapped on purpose — it
could be either `NIG MARKETEAM` or `SALES DEPARTMENT`, and guessing misfiles a
region's payroll.

Settings → Departments was branch-scoped and would have shown none of these; it
now defaults to a Company-wide view.

### One control, prefilled and clearable

Per the developer: _"just put the customer/employee as default in the picker. if
they want to change they have to remove the existing customer."_ The separate
customer field is gone. A matched customer is shown **as** the picker's value,
tinted, with an × — the row is one line tall, and replacing a match takes a
deliberate clear rather than a stray keystroke. Once cleared, the dropdown offers
both existing balances on that account and customer search.

### Voucher

Their payroll voucher carries `UB#0826-P2`, distinct from the payment reference
`UB#0826-02P`. The field was SUPPLIER-only, so payroll printed `—`. Now offered
on payroll too, server-side included.

`buildExpenseVoucherHtml` already produced their voucher's layout — payee, Date /
Reference / VOUCHER #, company block, `Account | Description | Total`, signatures
— so nothing else there changed.

### Deliberately not done

Their Special Account column appears only on rows that need it, and their Account
cell changes width row to row as a result. Ours keeps the column always present,
greyed to `—` — the developer's call, since a fixed grid keeps every row aligned
with the header.

## Accepted tradeoffs

1. **Customer matching is by name.** There is no employee↔customer link. A name held by two customers matches neither. The picker exists so a wrong match is visible rather than silent.
2. **`GUIMARAS` imports without a division** — three rows, deliberately.
3. **Loose branch matching** (`BAGO CITY` → `Bago`, `JORDAN` → `Guimaras - Jordan`) runs only after exact matching fails, and commits only when exactly one branch is a candidate.
4. ~~**Payroll's home is `Payee → Other → Salaries & Wages`**, which came from `development`'s own `otherCategory` work rather than this branch.~~ **Superseded 2026-09-08** — payroll's home is `Payee → Other → Payroll`, typed into the free-text Other Category box. See the Revision section above.

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

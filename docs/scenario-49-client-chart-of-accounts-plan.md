# Scenario 49 — The Chart of Accounts Was Never the Client's — Gap Analysis & Implementation Record

**Source**: surfaced live on 2026-09-07 while trying to import the client's payroll disbursement sheet ([Scenario 48](./scenario-48-payroll-as-an-expense-entry-plan.md)). Four of the seven account titles in that file matched nothing. Chasing why produced a much larger finding than four missing accounts, so it is written up separately: this is a correction, not a feature.

**How it surfaced.** The sheet posts to seven accounts. Three resolved, four did not:

```
Advances to Officer's and Employees   242 rows   resolved (via alias)
Loans to Officer's and Employees      126 rows   resolved (via alias)
Salaries and Wages                     58 rows   resolved
Accounts receivable-MI                125 rows   ✗   ₱119,552.00
PAG-BIG PREMIUM PAYABLE                58 rows   ✗   ₱ 67,000.00
PAG-IBIG LOAN PAYABLE                  44 rows   ✗   ₱116,417.68
Withholding Tax/Compensation            4 rows   ✗   ₱  4,255.00
```

231 of 657 rows, ₱307,224.68, with nowhere to post.

The initial read was "the client's chart is missing its payroll statutory liabilities". That was wrong, and the developer pushed back on it. When they pasted their real chart, **all four were in it** — `1-01-023`, `2-01-051`, `2-01-050`, `2-01-080`. They were missing from _ours_.

## Related ClickUp Tickets

None found. Create via the `clickup-create-ticket` skill.

## The finding

The chart the application runs on — 325 accounts in `coa-seed.service.ts` — was **designed on this project and never supplied by the client**. It disagrees with theirs on names and on numbering, and the two occupy the same number space with different meanings:

```
1-01-020   theirs: Account Receivable                  ours: Cash in Bank - Bank Master
1-01-023   theirs: Accounts receivable - MI            ours: Asia United Bank
1-01-052   theirs: Advances to Officer's and Employees ours: Suspense Account - PNB Victorias
1-01-060   theirs: Loans to Officers and Employees     ours: Suspense Account - Metrobank
1-03-021   theirs: Building Improvement                ours: Employee Cash Advance
2-01-050   theirs: Pag-ibig Loan Payable               ours: Gift Card Liability
2-01-070   theirs: VAT Payable                         ours: Loyalty Points Liability
```

Their `1-01-0xx` block is receivables and advances. Ours is bank accounts. **46 numbers collided.** Of 69 postable accounts in the balance sheet they supplied, 65 did not exist in ours by name.

The aliases written earlier that day — mapping `Advances to Officer's and Employees` onto our invented `Employee Cash Advance` — were mapping the client's account onto a _different chart's_ account that happened to serve a similar purpose. It posted, and it posted to the wrong number relative to their books.

## Decisions taken

1. **The client's chart takes precedence** (developer, 2026-09-07: _"those are seeded data … our true list is the one I sent"_). Where a number is held by one of ours, **ours moves** and theirs takes the code.
2. **Nothing is renamed or deleted, and ids are preserved.** A displaced account keeps its id, so every account mapping and every posted transaction still resolves — those reference `accountId`, never `number`.
3. **Displaced accounts go to a `7-` block**, carrying their whole original number: `1-01-023 Asia United Bank` → `7-1-01-023`. Every group is kept — an earlier attempt dropped the leading digit and mapped `1-01-000` and `2-01-000` onto the same code. `7` is the only leading digit neither chart uses.
4. **Renumbering is safe**, verified before doing it: the only number lookup in the codebase is a uniqueness check on create (`accounts.service.ts:54`). Nothing resolves an account by number at runtime.

## What's already done ✅

1. **`prisma/data/client-chart-of-accounts.tsv`** holds the 77 balance-sheet rows the client supplied.
2. **`prisma/seed-client-coa.ts`** loads them, relocating ours where a number collides and reporting every move. Idempotent; never deletes.
3. Applied to both databases. On a fully-seeded database: **28 added, 4 already present under different numbers, 44 relocated**. On a database that was never COA-seeded: **76 of 77 added, 1 collision** — which is itself the argument that the invented chart is the only thing in the way.
4. **All seven payroll accounts now resolve at the client's own numbers**, and four of the seven match directly by name with no alias at all.
5. **The Account picker was widened** to every postable account (see Scenario 48, Part 5's gap list) — restricting it to EXPENSE had made every one of these unreachable regardless.

## What's not done / gaps ❌⚠️

1. **Their revenue and expense blocks have not been supplied.** The developer provided assets, liabilities and equity. Their own GL mapping document references 66 accounts and **only 14 appear in what was sent**, so even the balance sheet is partial — it has no `Cash on Hand`, no `Cash in Bank`, no `Accounts Receivable - Customer`.
2. **13 of 41 GL mapping keys cannot be placed** without those blocks: `SALES_REVENUE`, `COGS_EXPENSE`, `DEFAULT_EXPENSE`, `SALES_DISCOUNT`, `SALES_RETURNS_ALLOWANCES`, `FINANCING_INCOME`, `INTEREST_INCOME`, `PENALTY_INCOME`, `UNEARNED_INTEREST_INCOME`, `UNAPPLIED_CUSTOMER_COLLECTIONS`, `POS_CARD`, `POS_EWALLET`, `REPAIR_EXPENSE`.
3. **`Salaries and Wages` still sits on our invented `6-01-010`.** It matches by name only; whether that is the client's number is unknown.
4. **The local database still runs half on a legacy four-digit chart.** `prominent-enterprise` has 22 accounts numbered `1000`/`2000`/`5100`, with **52 posted transactions and 20 GL mappings** pointing at them — including `AR_RECEIVABLE → 1100`, `DEFAULT_CASH → 1000`, `COGS_EXPENSE → 5050`, `INPUT_VAT → 1250`. Posting there does not use the client's chart at all.
5. **The 44 relocated `7-` accounts are clutter.** They still carry mappings and posted data so they cannot simply be deleted, but they appear in every account picker.
6. **`seedPH()` must not be run** on a database that has the client's chart. It is worse than
   reintroducing collisions: `coa-seed.service.ts:1815-1822` looks each account up **by number**,
   and on a hit takes the `if (existing)` branch, which calls `setMapping(acc.mappingKey,
existing.id)`. Since `1-03-021` now means _Building ImprovemenT_ rather than _Employee Cash
   Advance_, a re-run would silently repoint `SPECIAL_ACCOUNT_EMP_CASH_ADVANCE` at a fixed-asset
   account — creating nothing, warning about nothing, and corrupting the posting target.
   Reachable at `POST /coa-seed/ph` with `accounting:account:create`.

## Two defects in the client's own export

Worth sending back rather than silently working around:

1. **`2-01-020` is used twice** — `Accrued Expenses Payable` and `Cash advances from Apartment`. The second is skipped and reported.
2. **`01-01-040`** carries a stray leading zero where every surrounding row uses one digit. Normalised to `1-01-040`.

Their GL mapping document also spells one account **`Witholdong Tax Payable-Expanded`**, which will defeat anyone matching on that name.

## Closing the gaps

**One thing unblocks all of it: their complete chart of accounts export** — every account, with number, name, type and postable flag, in the format already supplied.

With it, in order:

1. Load the revenue/expense blocks the same way, relocating ours as needed.
2. Re-point all 41 `MAPPING_KEYS` at the client's accounts, **derived from their own `NIG ERP- GL MAPPING & POSTING ENTRIES` document** (49 posting rules across 17 process areas, already in `prisma/data/` and referenced by nothing) rather than guessed.
3. Only then retire the legacy 22 and decide what happens to the `7-` block.

Doing 3 before 2 breaks every posting path.

## Risks

**The relocation was carried out mid-session and required a repair.** The first `7-` scheme dropped the leading digit and nine accounts failed to place; the attempted undo (`replace(number,'7-','')`) mangled 17 rows into malformed numbers like `01-023`. All 17 were repaired from the seed definition and the relocation log, and a full sweep confirmed none left malformed — but this happened on the throwaway test database, and the same sequence against a real one would have been far more serious. **Take a `pg_dump` before running the seeder anywhere that matters**; `seed-client-coa.ts` itself is safe and idempotent, the danger was in the ad-hoc undo.

**Number collisions are silent to the reader.** A JE posted before this change against `1-01-023` meant `Asia United Bank`; the same number now means `Accounts receivable - MI`. The ids are stable so nothing broke, but anyone reading an old journal entry by number will be misled. Worth a note wherever historical GL output is printed.

## Verification

- The seeder was run against both databases and its full output — added, already-present, relocated, unplaceable — captured per run.
- After relocation: **0 broken account mappings, 0 orphaned transactions, 0 malformed numbers**.
- All seven payroll accounts confirmed present at the client's numbers by direct query.
- The payroll importer re-run afterwards resolved **657 of 657** accounts, up from 426.
- Backend 574/574 tests pass.

## Run record — development database, 2026-09-08

The seeder had only ever been run against the throwaway test database. The
developer's working database still held the invented chart alone, which is why a
payroll import there showed every Special Account as "No" and most org units
falling through to Description: **none** of the client's control accounts existed.

Run with a `\copy` snapshot of `accounts` (id, number, name, type) taken first.

|                                  |                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| Accounts before → after          | 325 → 397 (**72 added**)                                                               |
| Relocated to `7-`                | 44                                                                                     |
| Skipped, already present by name | 4                                                                                      |
| Unplaceable                      | 1 — `2-01-020 Cash advances from Apartment`, duplicated within the client's own export |

Post-run checks: **0 duplicate numbers, 0 orphaned transactions, 0 broken account
mappings.** Two mappings (`SUPPLIER_SUPPORT_INCOME`, `SUPPLIER_INCENTIVE_INCOME`)
have a null `accountId`, but they were never configured — not damage from this run.

All twelve control accounts on the client's Special Accounts list are present at
their own numbers: `1-01-023`, `1-01-048`, `1-01-051`, `1-01-052`, `1-01-060`,
`1-03-010`, `1-03-020`, `1-03-021`, `1-03-022`, `1-03-030`, `1-03-040`, `1-03-060`.

**Left in an odd state:** `1-03-023 Cash Loan – Others` and `1-03-024 CA-Liquidation`
were _not_ relocated — the client's chart has no row at either number, so two invented
accounts now sit interleaved among their fixed assets (LAND, BUILDING, Building
Improvement, Leasehold, Computer Software, Office Equipment). Their mapping keys still
resolve, but the chart reads wrongly. Worth folding into the Special Accounts work.

# Scenario 85 — Oct 29 UAT small items

Source: the "NIG Marketing UAT Checklist" (consolidated UAT notes, Oct 29 2026), re-audited against
`origin/development` on 2026-11-05 (BE 0d9507a, FE b560c54b). This scenario takes the small, clear items nobody
had started, plus one bug in our own Scenario 80 work.

Branch `feat/scenario-85-oct29-uat-small-items` in both repos, worktrees `backend/backend-scenario-85` and
`frontend/frontend-scenario-85`.

## Decisions (Kian, 2026-11-05)

1. **Scope:** DC-02 fix, STR-02, AR-01 and POS-01. **SC-01** (add a Service Center from the DR) is left out for now —
   Kian isn't sure it's in, since service centers are suppliers and DR clerks can't create suppliers today.
2. **AR-01:** fix all three customer searches (Receivables, POS, CRM), not only Receivables.
3. **POS-01:** keep the combined Total Sales card and add a per-branch breakdown under it when no branch is picked,
   from a new backend summary endpoint.
4. **Parts:** 3 parts, each committed and manually tested before the next.

## What's not done / gaps

### DC-02 — the future-date block uses the UTC date (our Scenario 80 bug, #253)

- BE `src/accounting/ar-invoices/ar-invoices.service.ts` `assertPaymentDateNotFuture()` compares against
  `new Date().toISOString().slice(0, 10)` — the **UTC** date. `resolvePaymentDate()` beside it uses the same UTC
  "today" to decide whether to stamp the real clock time.
- FE `pos/collections/_components/CollectionsScreen.tsx` caps the Payment date and the "Override current date" field
  at `todayIso()` from `src/libs/pos/installment-dues.ts`, also `toISOString().slice(0, 10)`.
- Effect: between 00:00 and 08:00 Manila the UTC date is still yesterday, so today's Manila date counts as "future".
  The screen won't offer it and the API refuses it ("A payment date cannot be in the future").
- `installment-dues.ts`'s `todayIso()` also drives due status (overdue etc.); changing it would move when dues turn
  overdue, which is out of scope. Only the collections screen's payment-date uses change.

### STR-02 — one serial number is still light grey

- FE `inventory/transfers/_components/TransferDetailModal.tsx` Receive panel: the serial under the item name is
  `text-xs text-zinc-400` (same line shows "Remaining: N" for non-serial items). The transfer detail table's serial
  cell was already darkened in Scenario 80.
- The struck-through "corrected from" serial (`text-zinc-300 line-through`) is faded on purpose and stays.

### AR-01 — full-name search fails

- BE `src/accounting/ar-invoices/ar-invoices.service.ts` customer search (`GET /ar-invoices/customers/search`) matches
  the whole typed string as one substring of `name` or `phone`.
- Imported customers are stored as "Lastname, Firstname Middle" (migration
  `20260827040451_fix_customer_name_parts_comma_format`), so "Juan Dela Cruz" is never a substring of
  "Dela Cruz, Juan M.". A middle name breaks it too.
- Same single-substring match in POS customer search (`src/pos/pos-customers.service.ts`) and CRM customer search
  (`src/crm/customer/customer.service.ts`).

### POS-01 — no per-branch Total Sales

- FE `pos/page.tsx` sums every non-voided sale of the period into one `totalSales` card. The rows from
  `GET /pos/transactions` carry no branch, and the list is not paginated (the whole period is loaded).
- Branch comes via session → terminal → branch.

## Parts (each part is committed and manually tested before the next)

### Part 1 — DC-02 Manila date + STR-02 serial colour

- BE: "today" for collections = the Manila date (`manilaDateKey()` from `accounting/tax-reports/tax-period.util.ts`)
  in both `assertPaymentDateNotFuture()` and `resolvePaymentDate()`. A full timestamp is judged by its Manila date.
- FE: the collections screen's Payment date cap, "Override current date" field and backdated note use the Manila
  date.
- FE: the Receive panel serial uses the same dark mono style as the detail table's serial cell.

### Part 2 — AR-01 full-name search (Receivables, POS, CRM)

- Split the typed text into words; every word must match the customer's name (or first/last name, or phone, as each
  search already allows). Word order and commas don't matter.

### Part 3 — POS-01 Total Sales per branch

- BE: a summary endpoint returning sales total and count per branch for the period, branch-scoped (a branch user
  sees only their own branch; Business Owner / Head Office see all).
- FE: under the Total Sales card, a per-branch breakdown when no branch is selected.

### Out of scope this run

- SC-01 (see Decisions 1).
- Other Oct 29 items not started (PI-01, POS-05, POS-21, POS-22, RR-01/02, CL-02, AC-01, POS-15–19) — they need a
  client answer or are larger.

## Tests

Per part: backend e2e spec, Playwright spec, regression runs of the suites that touch the changed code, hard edge
cases, and a click-by-click manual test in `NIG/Scenario-85-Manual-Test.md`.

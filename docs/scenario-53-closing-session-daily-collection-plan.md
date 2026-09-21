# Scenario 53 — Closing Session: Full Tender Breakdown, Branch-Scoped Cash Visibility & Daily Collection Report — Gap Analysis & Closing Plan

**Source**: client feedback relayed 2026-09-19, five lines on the POS closing (end-of-shift) flow:

> - Closing Session – all sales coming from banks, installments, qr code, denomination
> - All transactions should be placed in the end of day / closing report
> - POS cashier can see the undeposited funds and cash in transit of the branch only
> - POS cannot deposit, only accountant
> - Upon closing they should be able to put amount for cash, then the online payment (gcash, bank, etc.) should be displayed and cannot be edited
> - Create daily collection report upon closing

Six bullets, five distinct asks (the first and fifth are the same closing screen seen from two angles).

Followed the same day by **the client's own completed Daily Collection Report form** (NIG Marketing Corporation, Tanjay City Branch, 09/08/26) — transcribed in Appendix A. The form is the specification for Part 6 and materially changed its design: it is a running undeposited-cash ledger with a denomination block and a signature block, not the tender-breakdown summary the bullets alone suggested.

Also confirmed by the developer the same day: **POS's Cash-in-Transit screen is replaced by Undeposited Funds** (Part 5) — which is the same balance the client form's BALANCE column tracks.

## Related ClickUp Tickets

None found yet. Create via the `clickup-create-ticket` skill once this doc is confirmed.

## The scenario we're building toward

A cashier finishes their shift:

1. They open **Close Session**. Above the cash count, a **read-only panel** shows what the shift took in by non-cash tender — QR/online, bank transfer, card, TPF, gift card, store credit. They cannot edit any of it; the system knows those figures exactly.
2. They count the drawer by **denomination**, now including ₱10/₱5/₱1 coins. The total is computed, never typed. **Expected cash stays hidden** — a cashier who sees the target before counting can simply type it.
3. On submit, the variance is revealed. A non-zero variance still needs a manager PIN, exactly as today.
4. The count they entered, the notes, and a snapshot of every tender total are **persisted on the session** — today the denomination count is thrown away.
5. Their branch's **undeposited funds** are visible to them, for their branch only — POS no longer speaks in terms of Cash-in-Transit. They **cannot** post a bank deposit; only an accountant can.
6. The day's collections — POS sales across every session **and** installment collections taken at the counter — appear on a **Daily Collection Report** reproducing the branch's existing paper form: a running ledger whose balance is the undeposited cash, subtotalled by collection type, reconciled by a denomination count, printable and signable.

**Result**: the closing screen stops being a blind cash count, the money a branch is holding becomes visible to the people holding it, and the deposit stays with the person whose job it is.

## Decisions taken

Confirmed with the developer, 2026-09-19:

| Question                                                                                     | Decision                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installment collections have no link to a POS session. How do they reach the closing report? | **Branch + business day grain.** The report keys on branch and date, unioning POS transactions (all sessions that day) with AR/installment collections. No schema link between `ARPayment` and `PosSession` is added.                                     |
| How is "POS cannot deposit, only accountant" enforced?                                       | **Split the read and manage permissions.** Cashier keeps `pos:cash-in-transit:read` (own branch, already forced server-side) and loses `:manage`. Accountant gains both. One CIT screen, two capability tiers.                                            |
| What does the cash entry look like?                                                          | **Denomination grid, extended with ₱10/₱5/₱1 coins.** Total computed, not typed. The breakdown is finally persisted.                                                                                                                                      |
| Does the cashier see expected cash before submitting?                                        | **No.** Non-cash tenders are shown read-only; expected cash and variance are revealed only after submit. Showing the target beforehand would defeat the variance control entirely.                                                                        |
| What does the Daily Collection Report actually look like?                                    | **The client supplied their own existing form** (NIG Marketing Corporation, Tanjay City Branch, 09/08/26 — see Appendix A). It is a **running undeposited-cash ledger**, not a tender summary. The build reproduces that form.                            |
| Cash-in-Transit on the POS side                                                              | **Replaced by Undeposited Funds, including in the GL.** The close-time `Dr CASH_IN_TRANSIT / Cr POS_UNDEPOSITED_FUNDS` sweep is **dropped**; cash stays in Undeposited Funds until the deposit clears it directly. One balance, cleared once.             |
| `DESC` = DC                                                                                  | **Delivery Charge** — a fee collected on delivery, separate from the sale price.                                                                                                                                                                          |
| Does the report cover non-cash collections?                                                  | **Yes — all tenders in one ledger**, with a tender column. See the consequence note below.                                                                                                                                                                |
| PEN (penalty) column                                                                         | **Captured at collection time**, as a new per-payment field alongside the existing `rebateAmount`/PPD. Not derived from the account's running penalty.                                                                                                    |
| Petty cash in/out in expected cash (Part 2)                                                  | **A bug — include them.** Expected cash becomes `opening + cash/custom sales − cash_drop + petty_cash_in − petty_cash_out`. The drawer is counted physically, so every event that moves cash must be in the formula or the cashier eats a false variance. |
| Branch Manager's deposit rights (Part 4)                                                     | **Kept.** Accountant gains deposit, Cashier loses it, Branch Manager keeps it — the client's ask named POS and cashiers, and a branch manager is the natural fallback when no accountant is on site.                                                      |

### Two consequences of those decisions, stated up front

**1. An all-tenders ledger breaks the denomination reconciliation, and that is expected.** On the client's form BALANCE and the denomination TOTAL are the same number (₱20,960.00) because every collection that day was cash. Once bank/QR/card collections share the ledger, the running balance is no longer cash-on-hand. The report therefore carries **two totals**: TOTAL COLLECTION (all tenders) and a **cash subtotal** that the denomination block reconciles to. The denomination table proves the cash, not the ledger. This is a deliberate departure from the paper form and should be confirmed with the client when they first see it.

**2. Dropping the sweep is a GL change with a transition period.** Today: sale credits `POS_UNDEPOSITED_FUNDS`, close moves it to `CASH_IN_TRANSIT`, deposit credits `CASH_IN_TRANSIT`. After: sale credits `POS_UNDEPOSITED_FUNDS`, close posts no sweep, deposit credits `POS_UNDEPOSITED_FUNDS` directly. Specific care needed:

- **Sessions closed before the change already sat swept into `CASH_IN_TRANSIT`.** `clearCashInTransit()` must credit the account the session actually posted to — `CASH_IN_TRANSIT` for a legacy session (one with a non-null `journalEntryId` from the old sweep), `POS_UNDEPOSITED_FUNDS` for a new one. Both shapes will coexist indefinitely; this is not a one-off backfill.
- **`PosSession.journalEntryId` loses its meaning for new sessions.** Its schema comment defines it as the sweep JE id. It becomes null going forward, which is also the current marker for "had no cash sales" — so the undeposited-funds query can no longer use `journalEntryId: { not: null }` to mean "has money outstanding" (`getCashInTransitReport()` does exactly this today). It needs a different predicate.
- **The cash-variance JE already credits/debits `POS_UNDEPOSITED_FUNDS`** and is unaffected — it stays correct under both shapes.
- **`citClearedAt` / `citClearingJournalEntryId`** keep working as the cleared-marker; only the counterpart account changes. The claim-then-act rollback logic stays untouched.

## What's already done ✅

1. **Session close is a mature, carefully-built flow.** `SessionsService.close()` (`backend/src/pos/sessions.service.ts:169-388`) already computes expected cash, requires a manager override on a non-zero variance (re-verified server-side against `pos:transaction:override`, deliberately _before_ the atomic claim so a rejected close can't strand a half-closed session), atomically claims the close via `updateMany` to prevent duplicate journal entries on a retry, posts the Cash-in-Transit JE (Dr `CASH_IN_TRANSIT` / Cr `POS_UNDEPOSITED_FUNDS`), and posts the shortage/overage JE. None of this needs rebuilding.
2. **Branch scoping is already systemic and enforced server-side.** `resolveCitBranchScope()` (`sessions.service.ts:667-674`) names three explicit outcomes rather than falling out of a `??` chain; `getCashInTransitReport/Summary/History` all take an explicit `callerBranchId`; `clearCashInTransit()` (`backend/src/accounting/bank-accounts/bank-accounts.service.ts:674-810`) throws `ForbiddenException` on an out-of-branch session and `BadRequestException` on a mixed-branch selection, and uses claim-then-act with a compensating rollback. **Ask #3 is largely infrastructure-complete** — what's missing is the undeposited-funds half and the right people holding the right permissions.
3. **A denomination grid already exists in the UI.** `CloseSessionModal` (`frontend/src/app/(app)/(dashboard)/pos/sessions/page.tsx`, ~line 622) with `DENOMINATIONS = [1000, 500, 200, 100, 50, 20]` (line 614), computing its own total. The manager search + PIN block is already built, revealed when the backend rejects the close.
4. **A complete report + Excel export stack exists** from Scenario 47: `backend/src/pos/reports/sales-report.{controller,service,workbook}.ts`, and shared infra at `backend/src/common/export/` — `xlsx.util.ts` (`exceljs`, `NUM_FMT`, `SheetSpec`, `MAX_EXPORT_ROWS`, mandatory Summary/Detail/Parameters sheets), `send-xlsx.util.ts` (`sendReportWorkbook`), `audit-export.decorator.ts` (`@AuditReportExport`). The house rule is stated in the controller's own doc comment: every report has a JSON endpoint **and** an `/export` sibling taking the identical DTO and running the identical service call, so the file can never disagree with the screen.
5. **The frontend report pieces are shared and ready**: `src/components/common/ExportButton.tsx`, `ReportDateRange.tsx` (with `resolvePreset` for today/week/MTD/QTD/YTD/lastMonth), `TablePagination.tsx`, and `src/libs/export/downloadXlsx.ts` (fetches through the Next proxy so the httpOnly `authToken` cookie rides along).
6. **`CollectionReceipt` already carries everything a collection report needs** (`backend/prisma/schema.prisma:900`): `branchId`, `paymentDate`, `method`, `paymentMethodConfigId`/`paymentMethodOptionId` (the same POS config/option tables checkout uses, so "which bank / which gateway" matches), `collectorId`, a system-generated `number`, and its own `ARPayment[]` children. A branch+day collection report needs no schema work to reach installment collections.

## What's not done / gaps ❌⚠️

1. **The denomination count is silently discarded.** The UI builds `denominationBreakdown` and sends it; `CloseSessionDto` (`backend/src/pos/dto/pos.dto.ts:128-162`) declares and validates it; `close()` never reads it. Same for `notes`. There is no column on `PosSession` for either. The cashier's count exists only in flight.
2. **No per-tender totals are ever persisted.** `PosSession` (`schema.prisma:3221-3273`) holds `openingCash`, `declaredClosingCash`, `expectedClosingCash`, `cashVariance` and four journal-entry ids — nothing else. `paymentBreakdown` is recomputed from `session.transactions[].payments[]` on every read, so a closing report is only ever as accurate as the payment rows are _now_, not as they stood at close.
3. **The permission model is the exact inverse of asks #3 and #4.** The deposit endpoint (`POST /bank-accounts/clear-cash-in-transit`, `bank-accounts.controller.ts:373`) is gated by `pos:cash-in-transit:manage`. In `backend/prisma/seed.ts`:
   - **Cashier** gets `modulePermIdsExcept('pos', 'transaction:override', 'reports:read')` (seed:4139) — every POS permission except those two, so a cashier holds `:read` **and** `:manage` and **can post a bank deposit today**. The seed comment says this is deliberate ("Cashier owns its one module completely now"), which the client has now contradicted.
   - **Accountant** gets `permIds('accounting:*')` plus a few files permissions (seed:4018-4040) — **no `pos:*` at all**, so the accountant cannot open the CIT screen, let alone deposit.
   - There is no `pos:deposit:create`; the deposit rides on `:manage`.
4. **The reconciliation contract is broken on both sides.** `getReconciliation()` returns `expectedCash` / `declaredCash` / `variance` with `openingCash` nested under `sessionInfo`; the frontend type `SessionReconciliation` (`frontend/src/schema/pos/index.ts:79`) reads `expectedClosingCash` / `declaredClosingCash` / `cashVariance` at the top level. Nothing matches, so the modal is populated entirely by client-side fallbacks in `handleClose` — **the real backend figures are computed and then never used**.
5. **Two expected-cash formulas that can disagree.** `close()` sums `cash` + `custom` tenders; `getReconciliation()` sums only `cash`. A branch using a custom tender gets one number at close and a different one on the reconciliation screen. Separately, `petty_cash_in` / `petty_cash_out` drawer events affect neither figure — only `cash_drop` is subtracted.
6. **No end-of-day, Z-report, X-report or daily collection report exists anywhere in either repo.** The closest is `getSalesSummary()` (`sessions.service.ts:584`), which returns totals plus a `paymentBreakdown` — but **no frontend screen consumes it**, and it takes `branchId` as a plain filter with **no caller-branch forcing**, unlike every CIT method beside it. Exposing it to a cashier as-is would leak other branches' figures.
7. **Undeposited Funds is a GL account and nothing more.** `MAPPING_KEYS.POS_UNDEPOSITED_FUNDS` is debited at sale time for cash/custom tenders and swept at close. The only way to see a balance today is the generic Chart of Accounts / General Ledger screen. There is no branch-scoped view, which is half of ask #3.
8. **A real double-counting trap sits in the collections data.** `InstallmentPaymentRecord` (`schema.prisma:3870`) is, by its own schema doc comment, **additive to — not a duplicate of — the `ARPayment` trail** for POS-originated accounts, and `InstallmentAccountService.findOne()` deliberately combines both into `totalPayments`. A daily collection report that sums the obvious tables will count installment collections twice. `CollectionReceipt` is the correct single collection event (one per payment action, even when it overflows onto several invoices).
9. **No collection-type ("DESC") taxonomy exists anywhere.** The client form's DESC column carries DP / DC / MI / MI-PARTIAL / COD, and the footer subtotals by exactly those. Nothing in the schema stores this: a down payment is inferred from `PosPayment.installmentScheduleId` being set, a monthly installment from an `ARPayment` against an `InstallmentScheduleLine`, a COD from a cash-invoice `PosTransaction`. It must be **derived** in the report service, and one of the four (DC) is not yet identified — see Open Questions.
10. **The office/field collection channel is not a stored field either.** The form places the CR number in OFFICE, FIELD or OTHERS depending on who took the money. The nearest existing signal is `CollectionReceipt.collectorId` (null for a walk-in counter payment, set for a field collector — its schema comment says exactly this), which covers OFFICE vs FIELD but leaves OTHERS undefined.
11. **Penalty is not captured at collection time.** `ARPayment` carries `rebateAmount` (the PPD column) but has no penalty field; penalty lives as a running figure on `InstallmentAccount.penalty`. The form has a per-line PEN column, so a per-collection penalty amount may need to be recorded rather than derived.
12. **`frontend/e2e/cit-monitor.spec.ts` is stale.** It asserts an Accountant persona for CIT read, which `backend/test/cit-monitor.e2e-spec.ts:53-58` records as having "moved off Accountant entirely". Part 4 touches exactly this ground and must fix it rather than work around it.

## Conventions this scenario must follow

- **POS does not use `next-safe-action`**, despite the root `CLAUDE.md`. It uses plain `'use server'` functions that do their own `getSessionOrNull()` + `can()` check, `Schema.safeParse(input)`, `api.<verb>()`, and `revalidatePath`/tags on success — documented in a comment at `pos/service-jobs/_actions/service-draft-actions.ts:23`. For a read-only report, copy `pos/reports/_actions/get-sales-report.ts`.
- Zod schemas mirroring a backend service's return type go in `src/schema/pos/`, with display constants (column headers) co-located so orderings stay in step — see `src/schema/pos/reports.ts`.
- e2e uses `gotoReady(page, path)` from `e2e/utils` and role-based locators only; a spec that cannot find seeded data self-skips with a `'skipped-assertion'` annotation rather than passing silently.
- There is **no PDF generation anywhere** in either repo (`pdfkit` is declared in `backend/package.json` but imported by nothing). Printing is browser-side HTML via `src/libs/print/printInventoryDocument.ts`.
- `docs/CLAUDE.md` sets a standing UI overhaul mission — unified, enterprise-grade, consistency over creativity, reuse components, standardize tables/forms/modals. This binds the new screens in **Part 3** (closing modal) and **Part 6** (report view): reuse `src/components/common/` and the existing table/modal patterns rather than introducing new ones.

## Closing the gaps — proposed parts

Each part gets its own e2e coverage and manual test steps, and stops for developer confirmation before the next begins (house convention — see Scenario 51/52).

### Part 1 — Persist the closing record

Migration adding to `PosSession`: `denominationBreakdown Json?`, `closingNotes String?`, and `tenderBreakdown Json?` — a snapshot of each tender's total as at close. The snapshot is the point: it makes a closing report reproducible even if payment rows are later edited, the same reasoning that already has `getCashInTransitReport()` read its amount back off the posted JE rather than recomputing it. Wire `close()` to persist all three. Closes Gaps 1 and 2.

### Part 2 — Reconciliation correctness

Align the `getReconciliation()` response with the frontend `SessionReconciliation` type and delete the client-side fallbacks, so the backend's figures are actually the ones displayed. Make both expected-cash formulas agree on `cash` + `custom`. Decide and implement the petty-cash-in/out treatment. Closes Gaps 4 and 5.

Deliberately sequenced **before** the UI work: the new closing screen must not be built on top of numbers that two code paths disagree about.

### Part 3 — The closing modal

New `GET /pos/sessions/:id/tender-summary`, returning non-cash tender totals for an **open** session and **deliberately excluding expected cash and any cash total** — the endpoint must not become a back door to the figure the blind count depends on. Branch-scoped like its neighbours.

The modal gains a read-only tender panel above the cash grid (QR/online, bank transfer, card, TPF, gift card, store credit), and the grid extends to ₱10/₱5/₱1. Cash remains the only editable input. The post-submit `ReconciliationModal` continues to be where expected/declared/variance are revealed. Closes asks #1 and #5.

### Part 4 — Deposit RBAC

Add `cash-in-transit:manage` to Cashier's `modulePermIdsExcept` exclusion list; grant Accountant `pos:cash-in-transit:read` + `:manage`. Verify the CIT page's existing `canManage` gate correctly hides `DepositForm` for a cashier. Fix the stale `frontend/e2e/cit-monitor.spec.ts` and extend `backend/test/cit-monitor.e2e-spec.ts` to assert both directions (cashier 403 on deposit, accountant succeeds). Closes ask #4 and Gap 9.

### Part 5 — Replace Cash-in-Transit with Undeposited Funds on the POS side

POS stops speaking in terms of Cash-in-Transit. The branch-facing concept becomes the **undeposited-funds balance** — the money the branch is holding that has not yet reached the bank, which is exactly what the client form's BALANCE column tracks and what a cashier actually needs to see.

Scope:

- Route `pos/cash-in-transit` → `pos/undeposited-funds`; nav label, page title, component names, and the `TAGS.cashInTransit` query tag follow.
- The list becomes a branch-scoped undeposited-funds view: closed sessions holding money not yet deposited, with the running balance as the headline figure.
- Reuses the existing branch-forcing (`resolveCitBranchScope`) and the `POS_UNDEPOSITED_FUNDS` mapping — no new scoping logic.
- Accounting keeps Cash-in-Transit as its own GL concept; this part changes what **POS** presents, not the chart of accounts.

**GL change — the sweep is dropped.** `close()` stops posting `Dr CASH_IN_TRANSIT / Cr POS_UNDEPOSITED_FUNDS`. Cash remains in Undeposited Funds from sale until the deposit clears it directly. `clearCashInTransit()` (renamed to match) credits `POS_UNDEPOSITED_FUNDS` for new sessions and `CASH_IN_TRANSIT` for legacy already-swept ones — both shapes coexist permanently, per the transition note above. The "has money outstanding" predicate must stop relying on `journalEntryId: { not: null }`.

This part is sequenced after Part 4 deliberately: the permission split should land while the screen is still in its known-good state, so a regression here is attributable to one change and not two. Closes ask #3 and Gap 7.

### Part 6 — Daily Collection Report

Reproduces the client's own form (Appendix A) rather than inventing a layout. New `backend/src/pos/reports/daily-collection.{controller,service,workbook}.ts`, keyed by **branch + business date**.

**The ledger body** — one row per collection, in the client's column order:

| Column                                        | Source                                                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DATE                                          | collection date                                                                                                                                                  |
| SI#                                           | `PosTransaction.salesInvoiceNumber` (already exists), or the installment account's originating SI                                                                |
| CUSTOMER                                      | customer name                                                                                                                                                    |
| DESC                                          | **collection type** — DP (down payment) / DC (delivery charge) / MI (monthly installment) / MI-PARTIAL / COD (cash on delivery). Derived, not stored (see Gap 9) |
| TENDER                                        | cash / bank transfer / QR / card / … — **an addition to the client's form**, required because this ledger carries all tenders                                    |
| COLLECTION RECEIPTS → OFFICE / FIELD / OTHERS | `CollectionReceipt.number`, placed in the column matching the collection channel — `collectorId` null = office counter, set = field collector (see Gap 11)       |
| CASH INVOICE                                  | the cash-invoice number for a COD/cash sale                                                                                                                      |
| PPD                                           | `ARPayment.rebateAmount` — the prompt-payment discount, already capped against `InstallmentAccount.ppd`                                                          |
| PEN                                           | penalty charged on this collection — **a new per-payment field** (Gap 11), captured at collection time alongside `rebateAmount`                                  |
| AMOUNT/DEBIT                                  | the collection amount                                                                                                                                            |
| CREDIT                                        | a **deposit**, entered as its own inline row (`DEPOSIT: BDO NETWORK BANK 9/08/26`)                                                                               |
| BALANCE                                       | running undeposited cash — debits add, the deposit credit clears it to zero                                                                                      |

**The footer blocks**, all three of which the form treats as part of the report:

1. **Collection-type subtotals** — COD / DP / DC / MI, then TOTAL COLLECTION (₱20,960.00 in the sample), plus a **cash subtotal** (see consequence note 1).
2. **Denomination table** — 1000 / 500 / 200 / 100 / 50 / 20 / COINS, with count and extended amount, reconciling to the **cash subtotal** rather than TOTAL COLLECTION. **Fed by Part 1's persisted `denominationBreakdown`**, aggregated across the branch's sessions for that day. This is why Part 1 comes first.
3. **Signature block** — PREPARED BY / CHECKED BY / CERTIFIED CORRECT BY.

**Data sources**, with caller-branch forcing on both:

- **POS tenders** — `PosPayment`, reaching branch via `transaction.session.terminal.branchId` (the convention `SalesReportService` already uses, since a payment row carries no branch of its own). `PosPayment` is indexed only on `installmentScheduleId` — no index on `transactionId` or `createdAt` — so the query shape matters for a date-ranged scan.
- **AR/installment collections** — `CollectionReceipt` by `branchId` + `paymentDate`. **Not** `InstallmentPaymentRecord`, per Gap 8.

**Also in this part — penalty capture (Gap 11).** A per-payment penalty field added alongside the existing `rebateAmount`, wired into the POS Collections entry screen (`CollectionsScreen.tsx`) so the PEN column has a real source. Small, but it is a schema + UI + posting change, not just a report column; if it proves larger than it looks it splits into its own part rather than bloating this one.

JSON endpoint plus `/export` sibling carrying `@AuditReportExport('daily-collection')`. Frontend: a tab on the existing `pos/reports` screen, a **Print** action via the existing `printInventoryDocument.ts` shell (the form is clearly printed and signed), and a link through from the close-session confirmation to that day's report. Closes asks #2 and #5.

### Not in this scenario

- **Adding `sessionId` to `ARPayment`** — the branch+day grain makes it unnecessary, and it would be a schema change plus a backfill for data that no existing flow records.
- **PDF output** — none exists anywhere; print stays browser-side HTML.
- **Reworking the two parallel installment systems** (`InstallmentSchedule` at checkout vs `InstallmentAccount` in collections). This scenario reads from them; it does not merge them.
- **Reforming `getSalesSummary()`'s missing branch forcing** beyond what Part 6 needs — flagged in Gap 6, but nothing consumes it today, so it is not a live leak.

## Open questions

- **Which bank account backs a branch's deposit?** `clearCashInTransit()` takes a `bankAccountId` chosen at deposit time. The client form names "BDO NETWORK BANK" inline. Whether a branch has a default deposit bank, or the accountant picks each time, is unconfirmed — the current pick-each-time behaviour is assumed.
- **Signature block content.** PREPARED BY / CHECKED BY / CERTIFIED CORRECT BY are three distinct people on the client form. Whether these are printed blank for wet signatures (assumed) or resolved to named system users is unconfirmed.

## Appendix A — The client's Daily Collection Report form

Supplied by the client 2026-09-19 as a photo of a completed, signed form: **NIG Marketing Corporation — Daily Collection Report — Tanjay City Branch**, dated 09/08/26. Transcribed here because the build reproduces it.

**Header**: enterprise name / report title / branch name.

**Ledger** (as filled in the sample):

| DATE     | SI#  | CUSTOMER                              | DESC       | CR (OFFICE) | CASH INV | AMOUNT/DEBIT |    CREDIT |   BALANCE |
| -------- | ---- | ------------------------------------- | ---------- | ----------- | -------- | -----------: | --------: | --------: |
| 09/08/26 | 0406 | Daisy F. Feril                        | DP         |             |          |     2,960.00 |           |  2,960.00 |
|          |      |                                       | DC         | 2237        |          |       200.00 |           |  3,160.00 |
|          | 0407 | Jonah Faye Requina                    | DP         | 2238        |          |     4,720.00 |           |  7,880.00 |
|          |      |                                       | DP         |             |          |     4,370.00 |           | 12,250.00 |
|          | 0408 | Rezael Requina                        | DC         | 2239        |          |       200.00 |           | 12,450.00 |
|          | 0140 | Sysaree Facturan                      | MI-PARTIAL | 2142        |          |     1,000.00 |           | 13,450.00 |
|          |      | Luisita F. Galendes                   | COD        |             | 0418     |     7,510.00 |           | 20,960.00 |
|          |      | **DEPOSIT: BDO NETWORK BANK 9/08/26** |            |             |          |              | 20,960.00 |         — |

Unused columns in this sample but present on the form: COLLECTION RECEIPTS → FIELD and OTHERS, PPD, PEN.

**Collection-type subtotals**: COD 7,510.00 · DP 12,050.00 · DC 400.00 · MI 1,000.00 · **TOTAL COLLECTION 20,960.00**

**Denomination**: 1000 × 20 = 20,000.00 · 500 × 1 = 500.00 · 200 × 0 = 0.00 · 100 × 4 = 400.00 · 50 × 0 = 0.00 · 20 × 3 = 60.00 · COINS — · **TOTAL 20,960.00**

**Signatures**: PREPARED BY (Mary Vita T. Puasa) · CHECKED BY (Ms. Glory Mae Arimas) · CERTIFIED CORRECT BY (Nica Rose R. Ramirez)

Three things this form settles that the original five client bullets did not:

1. **It is a cash ledger with a running balance**, not a tender breakdown. Debits are collections, the credit is the bank deposit, and the balance is undeposited cash on hand. This is why POS's Cash-in-Transit screen becomes Undeposited Funds (Part 5).
2. **The denomination count is part of the report**, and it reconciles to the balance — so Part 1's persistence of `denominationBreakdown` is a prerequisite, not a nicety.
3. **The deposit is a line in the ledger**, carrying bank name and date — which the existing `clearCashInTransit()` already records (`bankAccountId`, `depositDate`, `reference`).

Every figure in the sample is cash — which is why the BALANCE and denomination TOTAL agree. The build carries all tenders in this ledger (developer decision), so those two figures separate; see consequence note 1 above.

## Implementation Log

_(filled in as parts land)_

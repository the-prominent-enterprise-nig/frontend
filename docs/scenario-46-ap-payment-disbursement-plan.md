# Scenario 46 — AP Payment as a Standalone Disbursement: One Voucher, Many Invoices — Gap Analysis & Closing Plan

**Source**: the client's own 10-item comment list on AP, given verbatim in a chat session on 2026-09-04, read against the two printed disbursement vouchers already analysed under [Scenario 40](./scenario-40-special-account-expense-categories-plan.md)/[Scenario 43](./scenario-43-ap-invoice-voucher-payment-plan.md) — a SHARP AP-settlement voucher (seven supplier invoices, four supplier credit-memo deductions, one check) and a SEASTAR freight voucher (two freight lines, one check). Planning only per explicit instruction — nothing in this doc has been implemented.

**The client's comments, verbatim:**

1. no need digital approval for voucher
2. allow edit after payment is settled / allow override (owner)
3. allow delete but needs approval
4. add checkbox to process multiple payment
5. add search functionality
6. allow create w/o SI just add flag/warning
7. allow staggered payment
8. each payment different voucher
9. add cleared (on a later date, on the same date)
10. add clear date

**The through-line.** Items 4 and 8 are not two separate asks — together they redefine what a voucher _is_. Today the voucher belongs to the **bill** (`APBill.voucherNumber`, `@unique`, one per bill, raised _before_ payment as an authorization). The client's voucher belongs to the **transaction**: its number is `<bank>#<MMYY>-<last 4 of check>` (decoded from their two samples — `BDO#0626-4430` for 06/20/2026 CK#0000574430, `CUR#0926-6354` for 09/02/2026 CK#0000606354), which cannot exist before a check is cut. Confirmed with the developer 2026-09-05: **one transaction = one voucher, however many invoices it covers.** Seven invoices on one check is one voucher; one invoice paid in three instalments is three. Invoices and vouchers are therefore many-to-many, which is the single fact that drives every schema change below.

## Related ClickUp Tickets

None found. Net-new scope — create via the `clickup-create-ticket` skill once this doc is confirmed.

## The scenario we're building toward

An accounting staff member cuts one check to one supplier covering several of that supplier's open invoices, and gets one voucher for it.

1. From the AP Invoices list they press **Record Payment** — a header action, not a per-row one.
2. They pick the payee. That supplier's unpaid invoices load with checkboxes.
3. Ticking the first invoice reveals the rest of the form, with the ticked invoices as its lines — the same skeleton as the Expense form.
4. They choose the bank and type the check number; the voucher number derives itself from the two.
5. Each line's amount defaults to that invoice's outstanding balance and can be overtyped to pay part of it.
6. They mark whether the check clears on the same date or a later one, and give the clear date if later.
7. Saving posts one journal entry — one debit to Accounts Payable per invoice, one credit to the bank — updates each invoice's `amountPaid` and status from its own line, and offers one voucher to print.

**Result**: the SHARP voucher becomes a thing this system can actually produce. Today it cannot — it would take seven separate payments and seven separate vouchers.

## What's already done ✅ (verified this session, file/line cited)

1. **Payment posts real double-entry and settles the bill.** `recordPayment()` (`backend/src/accounting/ap-bills/ap-bills.service.ts:1296`) builds `Dr <supplier's payable account> / Cr <the payment method's own GL account, falling back to DEFAULT_CASH>` (`:1374-1387`), posts it, creates the `APPayment` row, and updates `amountPaid` + status in one transaction (`:1389-1419`). An earlier reading that AP "just records" and does nothing was wrong. Live dev DB confirms one bill went the whole way: voucher raised → approved → ₱25,200 paid → `PAID`.
2. **Staggered payment already works** (comment 7). `recordPayment` computes `newPaid = amountPaid + amount` and runs it through `recomputeStatus()` (`:1340-1350`), which yields `PARTIAL`. Nothing needs building for partial payments _against one bill_ — only the UI to make it obvious, and the multi-invoice case below.
3. **The Payments register already has exactly the right columns.** `frontend/src/app/(app)/(dashboard)/accounting/ap-bills/payments/_components/APPaymentsList.tsx` renders Date / Reference / Paid from / Description / Payee / Accounts / Amount / Voucher # — the client's own legacy-tool shape, built under Scenario 43. It is read-only; it has no create affordance.
4. **A printable payment voucher exists** — `getPaymentDocument()` (`ap-bills.service.ts:1441`), routed at `GET /ap-bills/:id/payments/:paymentId/document`, rendered by `printAPPaymentVoucherDocument()`. It is already keyed by **payment id**, so it is the right shape for a per-payment voucher; it only reads the number off the wrong record.
5. **The backend list already supports a `search` param** — `findAll()` matches `billNumber` and `description` (`ap-bills.service.ts:667-668`).
6. **`clearedType`/`clearedDate` have a working precedent** on `BusinessExpense` (`prisma/schema.prisma:1401-1404`), built this same week. AP can mirror it field-for-field rather than inventing a second convention.
7. **An approval-chain precedent exists** for comment 3 — `StockAdjustment` (`prisma/schema.prisma:4555`) uses a `status` + `approvedAt`/`approvedById` shape where only `approve()` commits the effect.

## What's not done / gaps ❌⚠️

1. **One payment can only settle one bill.** `APPayment.apBillId` is a single required FK (`prisma/schema.prisma:1330`). The SHARP voucher — seven invoices, one check — has no representation. This is the structural blocker behind comment 4, and it is what makes comment 8's "one voucher for many APs" impossible today.
2. **The voucher belongs to the bill, not the payment.** `APBill.voucherNumber` is `@unique` and one-per-bill (`prisma/schema.prisma:1224`); `generateVoucherNumber()` (`ap-bills.service.ts:469`) mints `V-YYYYMMDD-NNNN` at `createVoucher()` time (`:497`), _before_ payment. Three instalments against one bill therefore share one voucher — the exact opposite of comment 8. The format also encodes neither bank nor check, so it can never match `BDO#0926-4430`.
3. **A two-step digital approval gates payment** (comment 1 asks for its removal). `voucherApprovalStatus` plus four approver columns (`prisma/schema.prisma:1225-1230`), routes `POST :id/voucher/approve-online` / `approve-onsite` / `reject` / `void`, and a hard block in `recordPayment()`: a bill with a voucher cannot be paid until `voucherApprovalStatus === 'approved'` (`ap-bills.service.ts:1311-1315`).
4. **Payment is a per-row action.** The dialog lives in `APBillsList.tsx:372`, opened by a per-row ₱ button (`setPayingFor`). There is no header-level entry point, and the bill detail page has no payment action at all. Comment 4's "checkbox to process multiple payment" has nowhere to attach.
5. **A settled bill can't be edited at all, by anyone** (comment 2). `update()` throws outright for `PAID`/`CANCELLED` (`ap-bills.service.ts:953-960`); for `RECEIVED` it permits only the payment-method fields and rejects everything else (`:961-975`). There is no owner override anywhere in the module.
6. **Only DRAFT bills can be deleted** (comment 3). `remove()` throws for anything else (`ap-bills.service.ts:1422-1426`). No request-and-approve path exists.
7. **A bill cannot be received without an SI number** (comment 6). `receive()` hard-throws when `billNumber` is null (`ap-bills.service.ts:1137`) — a wall, where the client asked for a flag.
8. **The AP Invoices list has no search box** (comment 5). The backend param exists (see ✅ 5) but nothing in `APBillsList.tsx` renders a search input. The backend also doesn't search supplier name, voucher number or reference.
9. **Cleared date is system-only** (comments 9-10). `APPayment.clearedAt` exists (`prisma/schema.prisma:1348`) but is written solely by Bank Reconciliation when a worksheet line is checked off (Scenario 42). There is no user-entered "same date / later date" choice and no user-entered clear date.

## Decisions (developer, 2026-09-05)

1. **One transaction = one voucher.** Count vouchers by counting times money left the bank, never by invoices. Confirmed explicitly.
2. **Payment moves out of the row entirely.** The per-row ₱ action and the per-bill Voucher panel (`FileText`) are both removed from `APBillsList.tsx`. A single **Record Payment** header button replaces them.
3. **Selection first, then the form.** Picking a payee loads their unpaid invoices with checkboxes; ticking the first one reveals an Expense-shaped form beneath, with the ticked invoices as its lines.
4. **The form is a page, not a modal** — it mirrors the Expense form, which is a page, and the line table needs the width.
5. **The line account is always Accounts Payable and is not editable.** Settling a payable means crediting cash and debiting that payable; letting the account be chosen is how an unclearable liability gets created.
6. **AP keeps its own Record Payment — Expenses is not a second door to it.** The client asked for one explicitly, and their AP comment list is made of payment features (staggered payment, each payment its own voucher, multiple payment, cleared date) that only make sense in a module that disburses. An earlier reading of this conversation — that AP merely produces a voucher and Expenses does the paying — was wrong. The two screens handle **different transactions**, not two routes to the same one: AP pays anything entered as owed (with or without an SI, per comment 6); Expenses pays what was never entered as owed at all. SHARP went through AP; SEASTAR never did; both produced a voucher because both were money leaving.
7. **Paying an AP does not create an Expense record — not even a draft.** The cost was already recognized when the goods were received (`Dr Inventory / Cr AP` at goods receipt, `ap-bills.service.ts:1167`); an expense at payment time books it a second time and leaves AP open. The real need behind the request — one screen showing everything paid — is met by the **Payments register as a shared view** (Part F), which costs no second record. A draft is specifically worse than nothing: it carries a total, and a total eventually gets posted by someone tidying the list.
8. **The Expense form's Voucher # stays a plain text field for now (developer, 2026-09-05).** No picker, no derivation from bank + check, no link to an AP-issued voucher — it is typed, exactly as it is today. This is a deliberate hold, not a conclusion: it keeps the screen working while Open Question 4's real answer ("voucher should be from AP" — reference or own series?) is still outstanding, and it avoids building a lookup against a voucher model that Part A is about to move anyway. Revisit once the client answers; until then nothing on the Expenses side is built against it.
9. **The Expense form's Voucher # stays Supplier-only (developer, 2026-09-05).** Asked explicitly and declined — it will not be widened to Customer / Employee / Other. **Accepted consequence**: a payee of "Other" cannot record a voucher number, which means the SEASTAR voucher (`CUR#0926-6354`, payee "SEASTAR CARGO LOGISTICS, INC.") — the very document given as the target print format — has nowhere to store its number on this screen. It still prints, since the voucher document derives from the expense itself; only the client's own number can't be captured. Revisit alongside Open Question 4 rather than on its own.

## Closing the gaps

Parts A and B touch the same table and must land together. C is trivial once B exists. D and E are independent of both and could go first if earlier visible progress is wanted.

### A. Retire the approval chain, move the voucher to the payment (gaps 2, 3 — comments 1, 8)

Drop `voucherApprovalStatus` and the four approver columns, the three approve/reject routes, `createVoucher()`/`voidVoucher()`, and the payment gate at `:1311`. Move `voucherNumber` off `APBill` onto `APPayment`, minted at payment time as `<bank>#<MMYY>-<last 4 of check>`. Backfill the single existing bill-level voucher onto its payment. `getPaymentDocument()` reads the number from the payment rather than the bill — no signature change, it is already payment-keyed.

**Destructive**: this discards the approval audit trail (who approved online/onsite and when, and any rejection reason). One bill in the dev DB is `approved`. See Open Question 1.

### B. One payment, many invoices (gap 1 — comments 4, 7)

Replace `APPayment.apBillId` with an allocation child table (`apPaymentId`, `apBillId`, `amount`). Payment moves from `POST /ap-bills/:id/payments` to a top-level `POST /ap-payments` taking payee + bank + check + cleared fields + an allocation array. One journal entry per payment: N debits to each bill's own resolved payable account, one credit to the bank. Each bill's `amountPaid`/status recomputes from its own allocation, so staggered payment works per-invoice inside one check.

New page `/accounting/ap-bills/payments/new`; the existing register gains a create button and stops being read-only.

### C. Cleared tracking (gap 9 — comments 9, 10)

Add `clearedType` (`SAME_DATE`/`LATER_DATE`) and `clearedDate` to `APPayment`, mirroring `BusinessExpense`'s columns exactly. Keep `clearedAt` untouched — that is Bank Reconciliation's own record of when the item actually cleared, and conflating the two would break Scenario 42's worksheet.

### D. Lifecycle unlocks (gaps 5, 6, 7 — comments 2, 3, 6)

- **Edit after settlement**: an owner-only override on `update()`'s `PAID`/`CANCELLED` branch, logged. Non-owners keep today's message.
- **Delete with approval**: a request-and-approve path on `remove()` for non-DRAFT bills, mirroring `StockAdjustment`'s status + `approvedAt`/`approvedById` shape.
- **Create/receive without an SI**: downgrade `receive()`'s `:1137` throw to a flag on the bill, surfaced as an amber **No SI** chip in the list and in the payment selection table. The bill stays payable.

### E. Search (gap 8 — comment 5)

Add a search box to `APBillsList.tsx`, and widen `findAll()`'s `OR` beyond `billNumber`/`description` to cover supplier name, voucher number and reference.

### F. Make the Payments register visible and shared (supports Decision 7)

`/accounting/ap-bills/payments` already exists (`APPaymentsList.tsx`, Scenario 43) with exactly the right columns — Date / Reference / Paid from / Description / Payee / Accounts / Amount / Voucher # — but it is **read-only and effectively hidden**: no sidebar entry, reachable only via a low-contrast "Payments" button in the AP Invoices header (`APBillsList.tsx:117`). Three changes turn it into the "everything we paid" screen the client is asking for, none of which create a record:

- Give it its own **Accounting sidebar entry**. Recommend top-level "Payments" rather than staying nested under AP Invoices — it is the register of everything that left the bank, not an AP sub-page.
- **Print button per row**, reopening that payment's voucher PDF.
- **List expense vouchers alongside AP ones**, so one screen covers both. Read-only; each side still posts through its own module.

## Open questions

1. **Is the approval audit trail expendable?** Part A drops `voucherOnlineApprovedById/At`, `voucherOnsiteApprovedById/At` and `voucherRejectedReason`. "No need digital approval" plausibly means "stop making me approve," not "erase who approved what." Keeping the columns read-only costs nothing; dropping them is irreversible. **Needs an explicit call before the migration is written.**
2. **Can one check ever pay two different suppliers?** This plan assumes not — a check is payable to one entity, so selection is scoped to one payee. If they ever cut a single check across suppliers, the payee must move from the header onto the line and that changes the whole form.
3. **Where do supplier credit memos go?** The SHARP voucher nets four "Support from Supplier" deductions (account `4-09-023` exists in the COA) against its seven invoices on the same sheet. This form pays invoices only; those deduction lines have nowhere to live. Decide before building — it changes the line table's shape, not just its contents.
4. **🚩 BLOCKING — what is the Voucher # field on the _Expense_ form?** The client said, verbatim, **"voucher should be from AP."** That is compatible with Decision 6 (AP pays) but leaves the Expense side unresolved, and today's field is almost certainly wrong either way: it is free text (`@IsOptional()`, typed by hand) and **Supplier-only** (`ExpenseForm.tsx:847`), which means the SEASTAR voucher they gave us as the target format — payee "Other", voucher `CUR#0926-6354` — cannot be recorded on that screen at all. Three possible answers, each implying different work:
   - **A reference to an AP-created voucher** → the field becomes a picker, and every payment must first exist in AP.
   - **Its own number in one shared series** → it should derive from bank + check exactly as AP's will, and show for every payee type, not just Supplier.
   - **Shouldn't be there** → remove it; the voucher is produced by whichever module made the payment and only displayed here.

   **Held for now (see Decisions 8-9)**: the field stays plain text and Supplier-only until they answer, so no work is committed to any of the three.

   **Ask them**: _"When you pay a supplier invoice, do you record it in AP or in Expenses? And on the Expense screen, is the Voucher # something you type, or do you pick one AP already created?"_ Two sentences, and it settles this entirely.

   **Interim decision (2026-09-05) — do this now, don't wait for the answer:** the same invoice must not be payable twice, and today nothing prevents it. An expense line's `apBillId` links to an AP bill and never touches its `amountPaid` or status (`expenses.service.ts:961-1060`), so both screens can settle the same invoice and neither will know. **Make the SI picker on the Expense form display-only** — it still prints "Payment for SI-…" on the voucher and still shows in the detail view, but it can no longer be used to route an AP settlement through Expenses. That closes the hole without pre-judging their answer and is small to undo if they say the link should become live.

   Parts A-F are all unaffected by this question and should not wait on it.

5. **Does a single-invoice shortcut stay?** Paying one bill now costs two extra clicks (Record Payment → pick payee → tick one). A "Pay this bill" link on the bill detail page could jump into the same form pre-filled — same screen, no second code path. Developer's call.

## Not in scope for this doc

- **Withholding tax at payment time.** The SHARP voucher deducts 1% w/tax (₱21,587.42) on the payment itself. `receive()` already handles withholding at bill entry (`ap-bills.service.ts:1260-1270`) and `APPayment.withholdingAmount` exists, but withholding _computed at payment_ is its own scope.
- **The Expenses side of the disbursement convergence.** Expenses got its own voucher, split payments and cleared date this same week (branch `feat/accounting-expenses-voucher`). Whether the two modules eventually share one disbursement engine and one voucher series is a real question — see Open Question 4 — but unifying them is not this scenario.
- **Debit memos.** `SupplierDebitMemoDialog.tsx` already exists and is unchanged by this work.
- **Bank Reconciliation.** Scenario 42's worksheet consumes AP payments; Part C is deliberately additive so nothing there changes.

## Implementation Log — 2026-09-05

**For this scenario, I have done:**

- **Part A** (voucher off the bill, approval retired) — the two-step approval gate in `recordPayment()` is gone, along with `POST :id/voucher` and its `/void`, `/approve-online`, `/approve-onsite`, `/reject` routes, the five service methods behind them, and `VoucherPanel.tsx`. Per the developer's decision, `APBill.voucherNumber` / `voucherApprovalStatus` / the four approver columns are **kept with their data intact** — nothing reads them to decide payability any more, so historical vouchers stay auditable. Three specs that tested the retired flow were removed rather than propped up (`purchasing-ap`'s whole Part 4 suite, 3 audit-log it-blocks, 1 rbac assertion), each replaced with a note saying why.
- **Part B** (one payment, many invoices) — new `APDisbursement` model + `POST /ap-bills/disbursements`. **Deviation from this doc's plan, deliberate**: the many-to-many is achieved with a **parent** row (one disbursement owns N `APPayment`s) rather than the child allocation table the plan specified. Same outcome, but purely additive — `APPayment.apBillId` and the eight `APBill.payments` include-sites keep working untouched, where the child table would have rippled through all of them plus two frontend readers. Posts one journal entry (a debit per bill against a single bank credit), enforces one payee per cheque, rejects over-allocation and duplicate bills, and derives the voucher as `<BANK>#<MMYY>-<last 4 of cheque>`. New page `/accounting/ap-bills/payments/new`: payee first, then that supplier's open invoices with checkboxes, then the form appears on first tick. Per-row ₱ and Voucher buttons removed from AP Invoices in favour of a header **Record Payment**.
- **Part C** (cleared) — `clearedType` / `clearedDate` on the disbursement, mirroring `BusinessExpense`'s columns and the Expense form's own wording. Server defaults to `SAME_DATE` and rejects `LATER_DATE` with no date. Deliberately distinct from `APPayment.clearedAt`, which is Bank Reconciliation's record of when something _actually_ cleared (Scenario 42).
- **Part D** (lifecycle) — `PATCH :id/override` gated on a new `accounting:ap-bills:override`; `POST :id/deletion-request` + `/approve` + `/reject` mirroring StockAdjustment's request/approve shape, where only approval has an effect; and receiving no longer requires an SI number. The list shows an amber **No SI** chip and a **Deletion pending** marker, and Delete on a non-DRAFT bill now prompts for a reason and files a request.
- **Part E** (search) — a search box on AP Invoices (there was none), and the backend `OR` widened from bill number + description to also cover supplier name, reference and voucher number.
- **Part F** (register) — the Payments register got a sidebar entry (it had none — reachable only via a secondary button), a **Record Payment** button so it can create rather than only list, and a print button per row so any voucher reopens as a PDF.

**Worth flagging:**

- **Two real bugs were caught by the new tests, not by review.** `create()` still rejected a bill with no `billNumber`, so "allow create w/o SI" was only half-done — the DTO now makes it optional. And the owner override returned 200 while silently discarding the edit: `update()`'s non-DRAFT branch writes only the three payment-method fields, so skipping the _throw_ wasn't enough; the override now falls through to the full update.
- **`accounting:ap-bills:override` is deliberately absent from the seeded permission catalogue.** Business Owner bypasses permission checks outright, so leaving it ungranted is what makes the override owner-only. A comment in `prisma/seed.ts` says so explicitly, to distinguish it from `inventory:bundles:delete`, whose absence was an oversight.
- **`billNumber` became nullable at posting time**, which the type-checker caught: `receive()`'s two `posting.post()` calls now fall back to the bill id for the description and pass `undefined` rather than `null` for the reference.
- **Part 1 was never manually verified.** Both dev servers were down for the whole run (the backend died during a Prisma regenerate), so the developer could not click through any part. Everything below is proven by e2e only.
- **The frontend Playwright spec (`e2e/ap-disbursement-record-payment.spec.ts`) was written but never executed.** Its `webServer` runs `start:e2e`, which does a full DB reset — blocked for this agent by the auto-mode classifier even after the developer consented. The backend specs were run by applying `prisma migrate deploy` to the test DB and invoking jest directly, which sidesteps the reset; there is no equivalent for Playwright.
- **Backend: 15/15 passing** in `test/ap-disbursement-voucher.e2e-spec.ts`. The spec **provisions its own suppliers** because the isolated e2e DB has 292 users and 325 accounts but **0 suppliers** — the same seed gap already flagged on Scenario 45's checklist entry, which is why `purchasing-ap` (18) and `accounting-audit-log-ap-bills` (5) still fail in `beforeAll`. Those failures are pre-existing and unrelated; one further `accounting-rbac-coverage-sweep` failure is a tax-configuration 404, also unrelated.
- **Open Question 4 remains blocking and untouched**, as agreed: the Expense form's Voucher # stays free text and Supplier-only (Decisions 8-9), and the interim SI display-only guard was **explicitly deferred by the developer** this run. Until it lands, the same invoice can still be settled twice — once here and once as an Expense line naming that SI — because an expense's `apBillId` never touches the bill.

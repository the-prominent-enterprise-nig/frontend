# Scenario 61 — Inter-Account Transfer & Bank Reconciliation Controls — Gap Analysis & Closing Plan

**Source**: client meeting notes, relayed 2026-09-30. The notes covered two areas: Fund Transfer (Part A, this doc, built on `feat/scenario-61-inter-account-transfer` in both repos) and Reports (Part B, now Scenario 62).

## Related ClickUp Tickets

None found. This is new scope.

## Part A — Inter-Account Transfer (formerly "Fund Transfer")

### What the client asked for

1. Rename "Fund Transfer" to **Inter-Account Transfer**.
2. Add a **Clearing Date**.
3. Allow editing after posting, but **only the clearing date and the reference**.
4. Transfer **history** must be visible. Today, saving a transfer just bounces back to Bank Accounts.
5. After the fields are completed, a **pop-up** should appear with a **printable voucher**.

### What existed before

- `BankAccountsService.transfer()` posted a journal entry and moved both `currentBalance` fields. The transfer was **not persisted anywhere else**. It existed only as the JE (`sourceModule 'BANK'`, `sourceDocumentId` = the source bank's id). That meant it had no history, no voucher, and no place in Bank Reconciliation (Scenario 42 dropped `FUND_TRANSFER` for exactly this reason).
- The form lived at `/accounting/fund-transfers` and redirected to `/accounting/bank-accounts` after saving.

### Decisions taken (developer, 2026-09-30)

| Question                                      | Decision                                                                                                                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What does the Clearing Date do?               | **Record + reconcile.** It is stored, editable, and printed on the voucher. Transfers become Bank Reconciliation candidates, one line per side. A side whose clearing date is on or before the statement date arrives pre-checked. |
| Transfers made before this shipped (JE only)? | **Backfill from the JEs** via a script, so history starts complete. Backfilled rows have no clearing date.                                                                                                                         |
| Sequencing                                    | Build Part A first on its own branch pair. Part B follows on a separate one.                                                                                                                                                       |

### What was built

**Backend**

- New `FundTransfer` model (`fund_transfers`), migration `20260930090000_scenario_60_inter_account_transfer`. Fields:
  - `transferNumber`: `IAT-YYYYMMDD-NNNN`, keyed on the transfer date. It is also the voucher number.
  - `date`, `clearingDate?`, `source`/`destination` bank, `amount`, `reference?`, `description?`, `journalEntryId`.
  - Per-side clearing: `sourceClearedAt`/`…InReconciliationId` and the same pair for the destination. Each bank reconciles on its own schedule.
- `BankReconciliationLineSourceType` gains `FUND_TRANSFER_OUT` and `FUND_TRANSFER_IN`.
- New `FundTransfersService` (`bank-accounts/fund-transfers.service.ts`), with posting unchanged from the old `transfer()`:
  - `create()` now persists the row in the same transaction.
  - The JE's `sourceDocumentId`/`sourceDocumentNo` now point at the transfer, not the source bank.
  - The JE reference falls back to the transfer number (it used to be `XFER-<timestamp>`).
  - A clearing date before the transfer date is rejected.
- Routes:
  - `POST bank-accounts/transfer` (unchanged path).
  - `GET bank-accounts/transfers`: filters `bankAccountId` (either side), `startDate`, `endDate`, `search`.
  - `GET bank-accounts/transfers/:id`
  - `PATCH bank-accounts/transfers/:id`: `clearingDate` and `reference` only. Other fields are stripped by the global whitelist. A reference change keeps the JE's `code` in step. There is no reversal, because nothing moves money.
  - `GET bank-accounts/transfers/:id/document`: the voucher envelope.
  - Reads accept `accounting:bank-accounts:read` OR `:transfer`. PATCH needs `:transfer`. No new permission strings.
- Reconciliation changes:
  - `findPendingCandidates()` adds both sides of each transfer.
  - `markReconciled()` clears the right side's fields.
  - `deleteReconciliation()` un-clears both sides.
- Backfill: `scripts/backfill-fund-transfers.ts` (`npm run backfill:fund-transfers`, dry run unless `DRY_RUN=false`).
  - It identifies legacy transfer JEs by their hard-coded line descriptions (`Transfer in from …` / `Transfer out to …`).
  - It matches the destination by name, and by GL account when two banks share a name.
  - It skips voided or reversed entries and anything already linked. Re-runs are a no-op.
  - It relinks each JE's `sourceDocumentId` to the new row.

**Frontend**

- Sidebar entry renamed to **Inter-Account Transfer**. It is visible with bank-accounts read OR transfer.
- `/accounting/fund-transfers` is now the **history**: filters, totals, row click to open, and a print icon per row.
- The form moved to `/accounting/fund-transfers/new` and gains **Clearing Date**. On success it opens a **"Transfer recorded" pop-up** with the summary and **Print Voucher**, **View transfer**, and **New transfer** buttons.
- `/accounting/fund-transfers/[id]` is the detail page:
  - **Edit** for clearing date and reference only.
  - Print Voucher.
  - A link to the JE.
  - Per-side reconciliation status, with a link to the reconciliation that cleared it.
- The voucher is `buildInterAccountTransferVoucherHtml()` in `libs/print/printInventoryDocument.ts`. It uses the same letterhead and signature family as the Expense voucher, with From/To accounts, Dr/Cr legs, date, clearing date, reference, and voucher number.
- The Bank Reconciliation worksheet labels the two new line types.
- The URL stays `/accounting/fund-transfers` so existing bookmarks still work. Only the label changed.

### Implementation Log — 2026-09-30

- Backend: `tsc` and `eslint` are clean. Unit tests pass, 25/25 (`bank-accounts.service.spec.ts` + new `fund-transfers.service.spec.ts`).
- Local DB migrated (`migrate deploy`, the 18 pending `development` migrations + this one, with the developer's go-ahead).
- The branch was later fast-forwarded onto the newer `development` (`634ed52`). Two files conflicted and were resolved by hand: `schema.prisma` (both sides added relations to `BusinessBankAccount`) and `printInventoryDocument.ts` (the voucher block was re-inserted into the upstream file). Unit tests were re-run afterwards: 25/25. The migration folder was renamed from `scenario_60` to `scenario_61`, and the local `_prisma_migrations` row was renamed to match.
- Live API check against the local backend passed for each of these:
  - Create
  - Clearing-date validation
  - List, filter, and search
  - PATCH: amount ignored, reference synced to the JE
  - Voucher document
  - A reconciliation on the destination picking up both transfer lines, with correct pre-checking
  - Delete-reconciliation
- Backfill: tested by planting one legacy-shaped JE, running dry, then applying, then re-running. It imported one row, dropped the auto `XFER-…` reference, kept the custom description, relinked the JE, and the re-run was a no-op. All test data was removed afterwards; audit-log rows from the test calls remain.
- The local DB has **zero** legacy transfer JEs. Run the backfill on staging/production after `migrate deploy`: dry first, review the list, then `DRY_RUN=false`.
- **Not verified in a browser.** The frontend typechecks, and `e2e/fund-transfer.spec.ts` was rewritten for the new flow (the old spec pointed at a route that no longer existed), but it has not been run. The local DB has only one bank account, so a transfer can't be made there without seeding a second.

### Worth flagging

- Pre-checking a transfer by clearing date relies on "checked = cleared on the statement". Part C below fixes the reconciliation math, which had the opposite sense.

## Part B — Reports → Scenario 62

The Reports notes are covered by Scenario 62 (drill-down, raw data export, and the Data Query Center) on `feat/scenario-62-reports-drilldown-query-center`. See [scenario-62-reports-drilldown-query-center-plan.md](./scenario-62-reports-drilldown-query-center-plan.md). The number moved because Scenario 60 was already taken on `development` (Employee Appliance Loan).

## Part C — Bank Reconciliation controls & printable vouchers

**Source**: client review notes, relayed 2026-09-30 (item 4, "Bank Recon feature"). The review raised these points:

- "System Balance appears to be manually editable."
- The Difference must drill down to every transaction behind the ERP bank balance, showing cleared vs outstanding.
- RECONCILED must never be manually selectable. It becomes available only at a zero difference; otherwise the status stays **In Progress** or **For Review**.
- Printed reconciliations should look like the client's "not reconciled" and "reconciled" samples.
- Adjusting Entry and Unidentified Bank Credit each need a **Voucher Control No.** and must be **printable**.

### What already held (Scenario 42), re-verified

- System Balance is computed from the GL. No screen accepts it as input; only the statement balance is typed.
- Mark Reconciled is disabled unless the discrepancy is ₱0.00, and the backend rejects it with a 400 otherwise.
- The worksheet's Discrepancy tile already opened a ledger drill-down.
- A letterhead PDF with a RECONCILED / NOT RECONCILED stamp already existed.

### Found and fixed: the checkbox math was inverted

The worksheet told users to "check off every item that actually cleared." But Adjusted Balance was computed as **statement + checked deposits − checked withdrawals**. That treats checked items as _outstanding_: a cleared item is already inside the statement balance, so adding it again double-counts it. The consequences:

- Following the on-screen instructions could never reach zero.
- Reaching zero meant ticking the _outstanding_ items. Complete then stamped those as cleared, so they vanished from next month's worksheet while the truly cleared ones kept coming back.
- The PDF listed every item as "pending" regardless of ticks.

It now follows the textbook rule, which is also the client's printed sample: **checked = cleared, unchecked = outstanding; Adjusted = statement + deposits in transit − outstanding withdrawals**. There is one shared helper on each side: `adjustedStatementBalance()` in `bank-accounts.service.ts` and in `AccountingV2Data.ts`. It is used by `markReconciled()`, the list, the worksheet and the PDF.

### What was built

- **Status.** "Pending" is replaced by **In Progress** (difference ≠ 0), **For Review** (difference = 0, awaiting Mark Reconciled) and **Reconciled**. Reconciled is only ever set by Mark Reconciled, and only at zero.
- **Clickable Difference.** The list page's Difference links to the worksheet with `?drill=1`, which opens the drill-down directly.
- **Cleared/outstanding in the drill-down.** Each ledger line now carries `clearingStatus`:
  - **Cleared**: ticked on this worksheet, or cleared by an earlier reconciliation.
  - **Outstanding**: not cleared.
  - **—**: not a reconciling item, e.g. bank charges or deposits.
  - Source: `clearingStatusByJournalEntry()` in `getReconciliationTransactions()`.
- **Printout** lists only the outstanding items. Its figures match the worksheet, and it is stamped NOT RECONCILED or RECONCILED like the samples.
- **Voucher Control No.** (required):
  - The Adjusting Entry endpoint's body was an untyped `any`; it is now a validated `CreateBankAdjustingEntryDto`. The number is stored on `journal_entries.referenceNumber`, which the schema documents as the voucher number, via a new `PostJEArgs.referenceNumber`.
  - Unidentified Bank Credit stores it on a new `unidentified_bank_credits.voucherControlNo` column (migration `20260930100000_scenario_61_voucher_control_no`) and on its JE.
- **Printable vouchers.**
  - A new `GET /journal-entries/:id/document` endpoint and `buildJournalVoucherHtml()` produce a letterhead Journal Voucher: Voucher Control No., date, reference, Account / Description / Debit / Credit lines, and Prepared / Certified / Approved blocks.
  - After posting, both forms turn into a "Posted" panel with **Print Voucher**, replacing the old `alert()`.
  - Unidentified credits show the number in their table and have a reprint icon.
  - Every journal entry's detail page has **Print Voucher** and shows its Voucher Control No.

### Implementation Log — 2026-09-30 (Part C)

- **Backend:** `tsc` clean. Unit tests pass, 28/28 bank-accounts plus 42/42 across bank-accounts, journal-entries and posting. New tests pin the math: cleared items are ignored, outstanding items adjust the balance, completing clears only the checked items, and a nonzero difference is refused.
- `test/bank-reconciliation-worksheet.e2e-spec.ts` completion case rewritten for the corrected math. **Not run**: the e2e DB needs a reset I can't run.
- **Browser-verified end to end as Business Owner:**
  - List: **In Progress**, a clickable Difference, and the Reconcile button disabled.
  - The Difference link opens the drill-down.
  - Adjusting Entry posts, then Print Voucher shows `JV-E2E-0141`.
  - Unidentified Credit posts, then its voucher shows `JV-E2E-0142`; the table row shows the number and a reprint icon.
  - Inter-Account Transfer: pop-up, voucher, detail edit of clearing date and reference, and both sides shown as Outstanding.
  - A new reconciliation picked the transfer up pre-ticked (its clearing date ≤ statement date):
    - at zero: **For Review**
    - unticked: **In Progress** at ₱750, Mark Reconciled disabled, and the drill-down tags the transfer **Outstanding**
    - re-ticked and marked: **Reconciled**, PDF preview stamped RECONCILED
  - Download PDF generated a 4.4 MB `application/pdf`.
  - Journal entry page: Print Voucher shows the control number.
- All test data was deleted afterwards. The two account mappings borrowed for the test (`BANK_CHARGES`, `UNIDENTIFIED_BANK_CREDITS`) were restored to unset. **Locally they are unset, so Adjusting Entry and Unidentified Credit fail with "mapping not configured" until they are set in Settings → Account Mapping.**
- **Worth flagging:** reconciliations already completed under the old math may have "cleared" items that were really outstanding. Re-check any completed reconciliation whose statement didn't include every ticked item, and delete and redo it if needed; Delete un-clears its items.

## Revision — no modals (2026-09-30)

Client UI/UX direction: **no modals**. This is the same rule that earlier moved the Expense and Fund Transfer forms onto full pages. Every modal in these screens is now a page:

| Was a modal                           | Now a page                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Adjusting Entry                       | `/accounting/bank-reconciliation/adjusting-entry`                                                                          |
| Record Unidentified Bank Credit       | `/accounting/bank-reconciliation/unidentified-credit`                                                                      |
| Settle Clearing Account               | `/accounting/bank-reconciliation/settle-clearing`                                                                          |
| Reclassify Credit                     | `/accounting/bank-reconciliation/unidentified-credit/[id]/reclassify`                                                      |
| Discrepancy drill-down (Transactions) | `/accounting/bank-reconciliation/[id]/transactions`. The list's Difference and the worksheet's Discrepancy tile link here. |
| Reconciliation print preview          | `/accounting/bank-reconciliation/[id]/print`, with Download PDF                                                            |
| "Transfer recorded" pop-up            | The new transfer's own page (`?created=1`), with a **Transfer recorded** banner, **Print Voucher** and **New transfer**    |

- Posting an Adjusting Entry or Unidentified Credit shows the "Posted" state with **Print Voucher** in the page itself. **Done** returns to the list.
- Delete confirmations still use the browser's own confirm box. That is not a modal screen.
- The forms moved from `BankRecon.tsx` into `_components/BankReconForms.tsx` (with page wrappers in `BankReconFormPages.tsx`). The worksheet sub-pages live in `[id]/_components/ReconciliationSubPages.tsx`.
- `e2e/fund-transfer.spec.ts` was updated for the redirect.
- Verified in the browser:
  - each page renders, with no visible overlays;
  - an Adjusting Entry posts, shows Print Voucher, and Done returns to the list;
  - the Transactions page shows Cleared/Outstanding;
  - the Print page shows the RECONCILED stamp;
  - New Transfer lands on the detail page with the banner.

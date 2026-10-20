# Scenario 77 — POS: installment collections on session close, full bank names

**Source**: _NIG Marketing Notes & Comments, October 16, 2026_. Re-audited against `development` on **2026-10-20**
(frontend `da853b4c`, backend `7d0d4e9`), counting Scenario 74 (FE #235 / BE #219) as merged and keeping to **POS only**.
Of the 16 POS lines, 8 are done once Scenario 74 merges, 4 reverse Chloe's decisions and 2 need the client (listed at
the end). That leaves **two lines that are safe to build**. This scenario builds those two.

**Base**: stacked on `feat/scenario-74-pos-inventory-client-feedback` (FE `44e97ac6`, BE `935e1de`). Scenario 74
rewrote `pos/sessions/page.tsx`, which Part 1 edits, so a branch off `development` would conflict on day one. Once
Scenario 74 merges, rebase onto `development` and the PR shows only this scenario.

Branch `feat/scenario-77-pos-bank-names-session-collections` in both repos, no upstream. Worktrees
`frontend/frontend-scenario-77` and `backend/backend-scenario-77`.

**Claimed** 2026-10-20 after checking `docs/scenario-*` and commit subjects on `origin/development`, remote branches
and open PRs. Highest in use: 76 (local only). Next free: 78.

**No migrations.** Part 1 reads data that already exists. Part 2 is a display lookup.

---

## Decisions (Kian, 2026-10-20)

| #   | Question                       | Answer                                                                                                                             |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| D1  | What the MI box on close shows | **Every payment method.** Installment payments taken this shift by Cash, GCash, card, bank and so on, one line each, plus a total. |
| D2  | Where the full bank names live | **A fixed list in code.** No migration. It also fixes old sessions, whose saved totals are keyed by the short name (`card::MBTC`). |
| D3  | Which "full name"              | **The legal name.** MBTC → Metropolitan Bank and Trust Company.                                                                    |

---

## Item 1 — Installment collections (MI) on session close · **M** · BE + FE

**Client line 18** (POS – Sessions): _"When closing a session, display the payment methods used (e.g., GCash) and
summarize the day's transactions. Provide a separate box for MI."_

**Already there:** the close screen lists every non-cash tender by provider ("Also taken this shift"), plus net sales,
invoice numbers and the cash build-up.

**What's wrong today:**

1. **Installment payments made by GCash, card, bank or QR show nowhere on close.** "Also taken this shift" reads only
   sale payments (`aggregateTenders` → `posPayment`). The POS Collections screen does stamp `posSessionId` on every
   receipt, whatever the method (`CollectionsScreen.tsx` ~1156/1188), so the data is there.
2. **"Counter collections" mixes in delivery fees.** The line says "installment dues paid in cash at the counter".
   It sums every cash `CollectionReceipt` on the session (`sessions.service.ts` ~301), and that includes Scenario 66's
   delivery-fee receipts (`purpose = DELIVERY_FEE`, `transactions.service.ts` ~6607).
3. **A closed session's detail lumps it all into "Cash taken in"** (sales + collections + petty cash in).

**Build:**

- **BE**: `computeExpectedCash` splits the cash collections query by `purpose`, returning
  `totalInstallmentCollectionsCash` and `totalDeliveryFeesCash`. **`totalCollectionsCash` stays their sum and
  `expectedClosingCash` stays the same figure.** Delivery-fee cash really is in the drawer.
- **BE**: `getReconciliation` adds `installmentCollections: { byTender: Record<tenderKey, number>, total }`. That's
  every `AR_COLLECTION` receipt on the session, not cancelled, any method, keyed with the same `buildTenderKey(method,
optionName)` the Daily Collection Report uses (`daily-collection.service.ts` ~1298).
- **FE close screen**: the cash build-up shows "Installment collections (cash)" and "Delivery fees (cash)" as two
  lines, each only when non-zero, replacing "Counter collections". A new **"Installment collections (MI)"** box sits
  under "Also taken this shift" and lists each method/provider plus a total. It shows "No installment payments this
  shift." when there are none.
- **FE closed-session detail** (`SessionDetail`): the same MI box.

**Not touched:** the stored `tenderBreakdown`, `expectedClosingCash`, Cash in Transit (`clearingAmountOf`), posting,
and the Daily Collection Report.

## Item 2 — Full bank names · **S–M** · FE (+ BE for one JE description)

**Client line 16** (POS – Customer Ledger): _"Replace 'MTCB' with Metrobank's full name and display the full names of
other banks as well."_

**Where the short names come from:** they're the `PosPaymentMethodOption.name` values Chloe seeded from the client's
lists on Sep 30 (`payment-methods.service.ts` `STANDARD_METHOD_OPTIONS`). "MTCB" in the note is the card option
**MBTC**. The customer ledger itself prints only "Payment (Card)". The bank shows on the Collections and checkout bank
pickers, the session-close tender lines, Daily Collection, and JE descriptions such as `card (MBTC)`.

**Why we don't rename the options:** the POS splits the QR list into its three checkout groups by name. The default
GL accounts are keyed by name (`STANDARD_OPTION_ACCOUNT_NUMBER`). Every closed session's `tenderBreakdown` is saved
with the name inside the key. So the stored name stays, and the full name is applied when it's displayed.

**The list.** Each branch suffix is taken from the client's own bank accounts in the seed:

| Option      | Shown as                                                           |
| ----------- | ------------------------------------------------------------------ |
| MBTC        | Metropolitan Bank and Trust Company                                |
| Metrobank   | Metropolitan Bank and Trust Company                                |
| BDO         | BDO Unibank                                                        |
| BDO-Q       | BDO Unibank — Iloilo Quezon                                        |
| BDO-GF      | BDO Unibank — Goldenfield                                          |
| BPI         | Bank of the Philippine Islands                                     |
| BPI-Araneta | Bank of the Philippine Islands — Araneta                           |
| BPI-Central | Bank of the Philippine Islands — Iloilo Central Market             |
| LB-PSB      | Land Bank of the Philippines — Passi (branch code PPSB)            |
| LB-Sipalay  | Land Bank of the Philippines — Sipalay                             |
| LB-Sagay    | Land Bank of the Philippines — Sagay                               |
| Sbank (QR)  | Security Bank Corporation (the schema calls it "Security Bank QR") |

Unchanged: Maya, GCash Send Money, Soundpay, Ecpay, Palawan Pay and Check. These are brands, not bank abbreviations.
Any name not on the list is shown as stored, so a bank added later still reads correctly.

**Build:** one shared FE helper (`bankDisplayName`) applied wherever an option name or tender provider is drawn. The
exact spots get listed in the Part 2 step 0. The BE JE description uses the same list. The POS settings page keeps
the short name as the editable value and shows the full name beside it.

---

## Build order

1. **Part 1 — Item 1** (MI box). BE, then FE. Stop for Kian's M1.
2. **Part 2 — Item 2** (bank names). Stop for Kian's M2.

Each part is committed on its own, with no co-author line. Nothing is pushed until Kian says so.

## Tests

Run one suite at a time, never chained. Baseline first, from the same worktrees.

### Part 1

- **New BE** `test/scenario-77-session-collections.e2e-spec.ts`: a cash installment collection, a GCash one and a cash
  delivery fee on one session. Check that reconciliation `installmentCollections.byTender` has `cash` and
  `qr::GCash Send Money` and no delivery fee, that the cash split adds up, and that `expectedClosingCash` is unchanged
  from before. Edge cases: a cancelled receipt is left out, and a receipt on another session is left out.
- **New FE** `e2e/pos-sessions-scenario-77.spec.ts`: on a real ₱0 session, the MI box with its empty state, no
  installment or delivery-fee line in the cash build-up, and the MI pane on an open and on a closed session's detail.
  The filled-in box is covered by the BE spec and by M1. A real installment payment on a session would post a real
  collection to a dev-DB customer, and the reconciliation is fetched by a server action, so the browser can't stub it.
- **Unit BE** `src/pos/sessions.service.spec.ts`: the collection mock moves from `aggregate` to `groupBy`, plus one new
  case: a cash delivery fee still counts toward expected cash.
- **Regression BE**: `closing-session-record`, `scenario-74-pos-sessions`, `accounting-audit-log-pos-sessions`,
  `daily-collection-offsite-counters`.
- **Regression FE**: `pos-sessions-scenario-74`, `closing-session-denominations`, `pos-session-list-ux-batch`
  (3/4 is the known baseline: the "Release Approvals" tab is gone).

**Part 1 results, 2026-10-20.** BE e2e ran against the test DB. FE ran against dev servers started from these
worktrees (:3001 / :3000).

| Suite                                  | Result                                                        |
| -------------------------------------- | ------------------------------------------------------------- |
| BE `scenario-77-session-collections`   | 7/7                                                           |
| BE `sessions.service.spec` (unit)      | 37/37 (36 existing + 1 new)                                   |
| BE `closing-session-record`            | 19/19                                                         |
| BE `scenario-74-pos-sessions`          | 6/6                                                           |
| BE `accounting-audit-log-pos-sessions` | 3/3                                                           |
| BE `daily-collection-offsite-counters` | 15/15                                                         |
| FE `pos-sessions-scenario-77`          | 4/4                                                           |
| FE `pos-sessions-scenario-74`          | 7/7                                                           |
| FE `closing-session-denominations`     | 1/1                                                           |
| FE `pos-session-list-ux-batch`         | 2/4. Release Approvals: known. Out-of-stock picker: see below |

The out-of-stock picker case failed twice. Its failure screenshot shows the expected text ("No available serial
numbers in stock for this item at this branch."). It rendered after the case's 5-second wait, because the serial lookup
over the dev DB's 3,600 items is slow. That's checkout, which Part 1 doesn't touch. Reported, not changed.

### Part 2

To be filled in at the Part 2 step 0, once the display spots are listed.

## Manual test script

### M1 — Part 1: installment collections on session close

**Verified by Kian, 2026-10-20: all 7 steps.**

**Setup.** Dev servers are running from the `*-scenario-77` worktrees (backend :3001, frontend :3000). Log in as the
business owner. Fixtures on the dev DB are two Bago customers, each with 3 unpaid dues of ₱3,888.00 (first due Nov 18,
2026):

- **Customer A**: `E2E S74 Checkout Customer 1792382346165`
- **Customer B**: `E2E S74 Checkout Customer 1792383025810`

M1 records two real collections against them. They're test customers, so nothing real is affected.

**Both are soft-deleted** (test cleanup on Oct 18), and Collections lists only live customers. The dev DB had no live
customer with an open installment due at all. For this run they were un-deleted, with Kian's OK, and afterwards set
back to their exact original `deletedAt`:

| Customer id                            | Name                | Original `deletedAt`     |
| -------------------------------------- | ------------------- | ------------------------ |
| `1fc8b122-ae5f-4efd-81cb-107e63438130` | … 1792382346165 (A) | 2026-10-18T19:59:48.804Z |
| `012caea6-eaed-4700-ba43-75beac7aaa22` | … 1792383025810 (B) | 2026-10-18T20:10:56.791Z |

A rerun needs the same: clear `deletedAt` on those two ids, run M1, then put the values above back. Their first dues
are now paid, so a rerun ticks the next unpaid due instead.

1. **Point of Sale → Management** (`/pos/sessions`). Click **Open session**. Verify the cashier with their PIN
   (**Verify PIN**), set **Terminal** to **E2E S77 Terminal** (Bago) and **Opening Cash (₱)** to **1000**, then click
   **Open Session**.
   ✅ A row "… · E2E S77 Terminal · opened …" appears with an **Open** chip.
2. Click the row's caret (**Show session detail**).
   ✅ Under the three panes there's a fourth, **INSTALLMENT COLLECTIONS (MI)**, reading "No installment payments
   taken this shift."
3. **Point of Sale → Collections** (`/pos/collections`). In **Filter by name or phone…**, type `1792382346165` and
   click Customer A. In the dues list on the left, tick **only the first due** (Nov 18, ₱3,888.00). The **Collect
   Payment** panel on the right fills in. In **Method** click **Cash on Hand**, and type **S77-M1-01** in **CR number**.
   Note the amount the panel will collect and call it **A1**. It's ₱3,888.00 less any rebate the panel pre-ticks. Click
   **Collect payment**.
   ✅ The payment saves and the due shows as paid.
4. Click **Change customer**, filter `1792383025810` and click Customer B. Tick only its first due. In **Method** click
   **GCash**, then pick **GCash Send Money** in the box under the tiles. Type **S77-M1-02** in **CR number**, note the
   amount as **A2**, and click **Collect payment**.
   ✅ The payment saves.
5. **Management** (`/pos/sessions`) again. On the E2E S77 Terminal row, click **Close session**.
   ✅ In the cash build-up on the left: **Opening float** 1,000.00, then **Installment collections** = **A1**,
   noted "installment dues paid in cash at the counter". There's no "Counter collections" line and no "Delivery fees"
   line.
   ✅ **Expected in drawer** = 1,000.00 + A1. The GCash payment is not in it.
   ✅ Below **ALSO TAKEN THIS SHIFT** (which still reads "No non-cash payments taken this shift."; that box is sales
   only), a new box **INSTALLMENT COLLECTIONS (MI)** lists:
   - **Cash** — A1
   - **QR / Online — GCash Send Money** — A2
   - **Total** — A1 + A2
6. Count the drawer at exactly **Expected in drawer**: enter note counts close to it, then put the remainder, centavos
   included, in **Loose coin total**, until the verdict reads **Drawer balances**. Click **Close session**.
   ✅ It closes without a variance and goes on to Daily Collection.
7. **Management** (`/pos/sessions`). Expand the E2E S77 Terminal row (now **Closed**).
   ✅ The **INSTALLMENT COLLECTIONS (MI)** pane shows the same two lines and total as step 5.

**Not in M1:** a cash delivery fee on the session showing up as its own **Delivery fees** line. That needs a sale with
a delivery fee, and the seeded stock makes that hard to ring up on the dev DB. The BE spec covers it (S77-1-B02/B03/B04)
and the unit spec does too.

---

## Not in this scenario (POS lines from the Oct 16 notes)

| Line                         | Note                                                                                                                         | Why not                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 6, 8, 10, 12, 13, 14, 23, 24 | Daily Collection print, session dates, CR for cash, credit app price, cash on hand, terms/rebate, hide undeposited, ₱0 close | Done on `development` or in Scenario 74                                                                |
| 9                            | Split payment                                                                                                                | Reverses Chloe's one-method-per-sale design                                                            |
| 11                           | Record under AR until delivery                                                                                               | Changes how every sale posts; needs Chloe                                                              |
| 17                           | Rebate only if paid before the due date                                                                                      | Reverses Chloe's late-rebate decision. The "no rebate on partial payments" half already works          |
| 25                           | ₱0 down payment                                                                                                              | Reverses Chloe's Oct 15 "never 0" rule                                                                 |
| 15                           | Amount due in the Due tab                                                                                                    | Client: there's no Due tab; "Due" is a per-row column (Chloe's design)                                 |
| 22                           | Branch selects a caravan                                                                                                     | Works for caravans hosted by the user's own branch. Client: do they need other branches' caravans too? |

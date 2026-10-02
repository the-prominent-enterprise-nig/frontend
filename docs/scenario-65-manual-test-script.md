# Scenario 65 — X-Deal (Barter) Transaction: Manual Test Script

Companion to [scenario-65-x-deal-transaction-plan.md](./scenario-65-x-deal-transaction-plan.md).
Click-by-click: every step names the menu, the button and what to type, then what you should see.
Tick **☐ → ✅ / ❌** as you go and note anything odd in the **Notes** line under each section.

- **✅ covered** — an automated test already checks this; a failure here means the screen and the
  test disagree.
- **⚠️ watch** — only covered indirectly. Give these the most attention.
- Case IDs (XD-…) point at the automated test for the same thing.

Branch: `feat/scenario-65-x-deal-transaction` in both repos.

---

## 0. Setup

### 0.1 Servers and database

1. Dev DB has both Scenario 65 migrations (`20261001090000_scenario_65_x_deal`,
   `20261001100000_scenario_65_x_deal_credit_memo`) and the backfill has run
   (`npx ts-node -r tsconfig-paths/register scripts/backfill-scenario-65-x-deal.ts` in
   `backend/backend` — four ✓ lines, safe to re-run).
2. Backend on `localhost:3001`, frontend on `localhost:3000`.
3. **Every login** uses password `dev-prominent-enterprise-2026`. Where a PIN box shows `••••`,
   use `1234`.

### 0.2 Accounts

| Who                 | Email                             | Used in    |
| ------------------- | --------------------------------- | ---------- |
| Bago cashier        | `technova.b1.cashier@test.com`    | §1, §3, §8 |
| Business Owner      | `technova.owner@test.com`         | §2, §4, §8 |
| Bago accountant     | `technova.b1.accounting@test.com` | §5, §6, §7 |
| Bago branch manager | `technova.b1.manager@test.com`    | §8.10      |
| Branch 2 accountant | `technova.b2.accounting@test.com` | §8.11      |

To switch user: avatar (top right) → log out → log in as the next one.

### 0.3 Test data

The seed leaves nothing that is both stocked and priced, so you need your own item. Either let
Claude create it through the API, or do it by hand as Business Owner:

1. **Item** — Inventory → Catalog → new **non-serial** item `X-Deal Test Aircon`, selling price
   ₱15,000 → submit → confirm accounting → approve.
2. **Stock** — Inventory → Stock Counts → Create Adjustment at **Bago**'s warehouse, reason
   _Found_, expected 0 / actual 10 → confirm → investigate → approve.
3. **Price** — Inventory → Price Lists → Price Use Types → add `XDEAL-TEST`; new price list under
   `XDEAL-TEST`, add the item at ₱15,000, approve. Don't add it to the shared WIP list (editing an
   active list sends it back to pending).
4. **Customer** — CRM → Customers → new individual customer `ABC Billboards (X-Deal test)`, any
   phone.

Write down what you used:

| Thing     | Value                                                                               |
| --------- | ----------------------------------------------------------------------------------- |
| Item      | `X-Deal Test Aircon 84567`                                                          |
| Price Use | `XDEAL-TEST-84567`                                                                  |
| Customer  | `ABC Billboards (X-Deal test) 84567`                                                |
| SI No.    | `SI-MAN-1790907893285` (txn POS-1790908943053-DFPBJ, account IA-93293DA8)           |
| Memo No.  | `CMHO0926-001` (₱16,200.00; the `0926` is the client's fixed control-number period) |

> **Price Use trap.** Every item added to the cart starts on the default Price Use (CR-BR). The
> test item has no CR-BR price, so it shows **No price — Override** until you switch its Price
> Use. Do that first, every time you add it.

---

## 1. Ring up the X-Deal — Bago cashier

> **Run 2026-10-02: ✅ passed** (after F1 fix).

Log in as **`technova.b1.cashier@test.com`**. Sidebar **Point of Sale** → top tab **Checkout**.

**1.1 Session** ☐

- If a session picker shows, pick the **Bago** counter. If there's no open session, open one from
  POS → Management → Sessions first.
- **Expect:** a green **Counter N** chip beside "New Sale", and the yellow banner _"This sale
  includes an installment item — it will need Business Owner or Branch Manager approval…"_ once
  the cart is installment.

**1.2 Add the item and price it** ☐

1. In **Search by name or serial**, type `84567`.
2. Click the **X-Deal Test Aircon 84567** card. It shows in Order Summary as **Cart · 1 item**.
3. Under the item name in the cart, open the small **Price Use** dropdown → pick
   **XDEAL-TEST-84567**.

- **Expect:** the line shows **₱15,000.00**, not "No price — Override".

**1.3 No X-Deal without a customer** ☐ ✅ XD-F01

- Look at the **CUSTOMER** section before picking anyone.
- **Expect:** no "X-Deal (barter)" checkbox.

**1.4 Pick the barter customer** ☐ ✅ XD-F01

1. Click **Search by name or phone…**, type `ABC Billboards`.
2. Click **ABC Billboards (X-Deal test) 84567**.

- **Expect:** the customer card turns purple, and under it a white box with an unticked
  **X-Deal (barter)** checkbox and the line _"Inhouse installment, no down payment, no credit
  application — accounting clears the balance with an X-Deal credit memo"_.

**1.5 Tick X-Deal** ☐ ✅ XD-F02, XD-F07

- Tick **X-Deal (barter)**.
- **Expect, all of these:**
  - [ ] A text box **X-Deal Reference (barter agreement no.) \*** appears under the checkbox.
  - [ ] **Payment Mode** switches to **Installment**.
  - [ ] **Cash** and **Delivery Receipt** are greyed out.
  - [ ] Under Installment, **Inhouse Installment** is selected and **TPF Installment** is greyed
        out.
  - [ ] The credit-application area reads _"X-Deal — no credit application required"_.
  - [ ] There is **no** Down Payment method toggle.

**1.6 Pick the term** ☐ ✅ XD-F02

- Open the term dropdown (**Select a term…**) → **3 months**.
- **Expect:**
  - [ ] The down payment card reads **Waived · ₱0.00 · X-Deal**.
  - [ ] A monthly amortization preview appears.
  - [ ] The payment box reads _"Nothing to collect at checkout for this cart."_ (correct: an
        X-Deal collects nothing at the register).

**1.7 Reference is required** ☐ ✅ XD-F03

1. In **Sales Invoice No. \***, type an SI number, e.g. `SI-XD-0001`.
2. Leave the X-Deal reference empty. **Expect:** the big bottom button reads **Enter the X-Deal
   reference** (this is a hint, not a field).
3. Click it. **Expect:** red box _"Enter the X-Deal reference."_; nothing is submitted.
4. Type three spaces in the reference box and click again. **Expect:** same red message.
5. Clear the spaces.

**1.8 Untick and re-tick** ☐ ✅ XD-F04

1. Untick **X-Deal (barter)**. **Expect:** the reference box disappears; the
   **Approved Credit Application** picker, the 10% down payment and the Down Payment method toggle
   come back; the button asks for a credit application.
2. Tick it again. **Expect:** everything from 1.5 is locked again, and the term you picked is
   still set.

**1.9 Submit** ☐ ✅ XD-S13

1. Click in the **X-Deal Reference** box and type `XD-2026-TEST-01`.
   **Expect:** the bottom button changes to **Create Installment Plan**, and the red message from
   1.7 disappears as you type.
2. Click **Create Installment Plan**.

- **Expect:** a **Pending Approval** card: _"Waiting for a Business Owner or Branch Manager to
  review."_, an **X-DEAL** pill, the item × 1 and **Total ₱15,000.00**.
- Write the SI No. into the table in §0.3.

**Notes:** …

---

## 2. Approve the hold — Business Owner

> **Run 2026-10-02: ✅ passed.** Stock 10 → 9. Sale JE: Dr A/R 16,200.00 / Cr Sales 13,392.86,
> Output VAT 1,607.14, Unearned 1,200.00. No COGS line — the test item has ₱0 cost (stock came in
> by a Found adjustment), not an X-Deal issue.

Log in as **`technova.owner@test.com`**.

Before approving, note the item's stock: Inventory → **Stock**, search `84567`, Bago column.
Stock before: \_\_\_\_

**2.1 Find the request** ☐

- Sidebar **Point of Sale** → **Release Approvals** → tab **Pending**.
- **Expect:** a row for the X-Deal Aircon with customer **ABC Billboards (X-Deal test) 84567**.
- ⚠️ Known display bug: the Pending table's headers sit one column off from the data (each row
  has a Ref # cell with no header). Read the cells, not the headers.

**2.2 Approve** ☐ ✅ XD-S01

1. Click the row's **Review** button. Modal **Review Release Request** opens.
2. Leave **Notes** empty. Type `1234` in **Manager / Owner PIN required**.
3. Click **Approve & Release**.
   - If it's greyed out with _"The Promissory Note must be signed before this sale can be
     released."_: Cancel → click the row → **Mark as Signed** → then Review again.

- **Expect:** the row leaves Pending and shows under **History** as approved.

**2.3 Stock dropped** ☐ ✅ XD-S01

- Inventory → **Stock**, search `84567`. **Expect:** Bago is 1 lower than before.

**2.4 The sale's journal entry** ☐ ✅ XD-S01

1. Sidebar **Accounting** → **Journal Entries**.
2. In **Search reference, description, payee...** type the SI No. (or `84567`).
3. Click the sale's entry (Source: POS).

- **Expect** in **Transaction Lines**:
  - [ ] Dr **Accounts Receivable** (cash price + markup)
  - [ ] Cr **Sales** and Cr **Output VAT**
  - [ ] Cr **Unearned Interest Income** (the markup)
  - [ ] Dr **Cost of Goods Sold** / Cr **Inventory**
  - [ ] **Balanced** = Yes; **Total Debit** = **Total Credit**

Write the A/R debit here: \_\_\_\_ and the Unearned credit here: \_\_\_\_. §5 should match.

**Notes:** …

---

## 3. Where the X-Deal shows up — any user

> **Run 2026-10-02: ✅ passed** (after F5 list badge fix; F6 POS customers pill added).

**3.1 Transactions list** ☐ ✅ XD-F11

- Point of Sale → top tab **Transactions** → in **Sales Invoice, Transaction # or Invoice #**
  type the SI No. → **Apply**.
- **Expect:** the row has an **X-DEAL** pill next to its Type.

**3.2 Transaction detail** ☐ ✅ XD-F11

- Click the row.
- **Expect:** an **X-DEAL** badge in the header and a row **X-Deal Reference:
  XD-2026-TEST-01**.

**3.3 Contract ledger** ☐ ✅ XD-F11

1. Sidebar **CRM** → **Customers** → search `ABC Billboards` → click the customer (Customer 360).
2. In **Installment Plans**, click the plan row → **Contract ledger →**.

- **Expect:** **Customer Ledger** page with status **Active** and an **X-DEAL** badge; rows for
  the sale and the monthly dues; the last **Outstanding** equals the A/R from 2.4 (give or take a
  few centavos, see §9).

**3.4 Installment Accounts list** ☐ ✅ XD-F11

- CRM → **Installment Accounts** → search the account number from the ledger.
- **Expect:** the account is listed, Status active, with an **X-DEAL** badge.

**3.4b POS Customers list** ☐ (F6)

- Point of Sale → **Customers** → search `ABC Billboards`.
- **Expect:** an **X-DEAL** pill next to the customer name; other customers have none.

**3.5 Customer 360** ☐ ⚠️ not tested

- Back on Customer 360 → **Installment Plans**.
- **Expect:** the plan is listed with its balance. No X-Deal marker was built here; just check
  nothing breaks.

**Notes:** …

---

## 4. Optional — the partly-released case ⚠️

**Skip unless you want it.** **Run Release** posts interest for **every** installment contract in
the DB that has an elapsed period, not just this one. The page has no as-of date, so on a sale
made today nothing will be pending yet. This case is really only reachable with an older sale;
XD-M02 covers it by simulating the release in the DB.

- Accounting → **Interest Release**. **Expect:** this contract is **not** in the
  _"Pending release — as of …"_ table (no period has elapsed). ☐

**Notes:** …

---

## 5. Issue the X-Deal memo — Bago accountant

> **Run 2026-10-02: ✅ passed** on the new page (F7). Double-click produced exactly one memo, CMHO0926-001.

Log in as **`technova.b1.accounting@test.com`**. Sidebar **Accounting** → **Credit Memos**.

**5.1 The button** ☐ ✅ XD-F12

- **Expect:** an **X-Deal offset** button next to **New Credit Memo**.

**5.2 The picker** ☐ ✅ XD-F12

1. Click **X-Deal offset**. The **X-Deal offset** page opens (`/accounting/credit-memos/x-deal`) with a **Back to Credit Memos** link; the sale picker and memo fields on the left, the journal-entry preview on the right.
2. Open the **X-Deal sale \*** dropdown.

- **Expect:** your sale listed as
  `ABC Billboards (X-Deal test) 84567 · <SI No.> · XD-2026-TEST-01 · ₱<outstanding>`. No ordinary
  (non-X-Deal) installment sale appears.

**5.3 Pick it** ☐ ✅ XD-F13

- Pick your sale.
- **Expect:**
  - [ ] A grey box with X-Deal reference, Sale date, Installment account, Invoice, Branch (Bago).
  - [ ] **JOURNAL ENTRY** preview:
    - Dr **1-02-060 Due from X-Deal Partners (Barter)** = cash price
    - Dr **Unearned Interest Income** = the markup (same as the Unearned credit in 2.4)
    - Cr **Accounts Receivable** = full outstanding (same as the A/R debit in 2.4)
    - Debits add up to the credit.

**5.4 Date and reason** ☐

- **Memo date**: leave as today. **What was received (reason)**: `Billboard space, Q4 2026`.

**5.5 Issue it (double-click on purpose)** ☐ ✅ XD-F14, XD-F15

- **Double-click** **Issue X-Deal memo**.
- **Expect:** the button reads **Issuing…**, then you land back on the Credit Memos list; toast _"X-Deal memo CM-…
  issued — ABC Billboards (X-Deal test) 84567 is settled at ₱0.00."_

**5.6 Only one memo** ☐ ✅ XD-F15

- **Expect:** in the list, **one** new memo: Type **X-Deal**, Origin **X-Deal offset**, Status
  Issued, Total = the outstanding. Write the memo number into §0.3.

**5.7 It's off the list** ☐ ✅ XD-F14

- Click **X-Deal offset** again → open the dropdown.
- **Expect:** your sale is gone (_"No open X-Deal sales"_ if it was the only one). **Cancel** takes you back to the list.

**Notes:** …

---

## 6. Check the books and the queues — Bago accountant

> **Run 2026-10-02: ✅ passed**, including the ⚠️ checks 6.6 (closed, ₱0, no dues) and 6.7 (1-02-060 = 15,000).

**6.1 The memo's journal entry** ☐ ✅ XD-M01

- Accounting → **Journal Entries** → search the memo number → open it.
- **Expect:** the same three lines as the 5.3 preview; **Balanced** = Yes.

**6.2 Ledger is settled** ☐ ✅ XD-F14, XD-M01, XD-M04

- CRM → Customers → `ABC Billboards` → **Installment Plans** → the plan → **Contract ledger →**.
- **Expect:**
  - [ ] Header reads **Settled — X-Deal credit memo CM-…** (your memo number).
  - [ ] Last row: description **X-Deal credit memo**, Credit = the remaining balance.
  - [ ] Last **Outstanding** = **0.00**.

**6.3 Installment AR aging** ☐ ✅ XD-Q01

- CRM → **Installment Accounts** → **AR Aging Report**.
- **Expect:** the account is **not** listed.

**6.4 Accounting AR aging** ☐ ✅ XD-Q03

- Accounting → **Reports** → tab **AR Aging**.
- **Expect:** the invoice is **not** listed.

**6.5 Interest release** ☐ ✅ XD-Q06

- Accounting → **Interest Release**.
- **Expect:** this contract is not in the pending table. (Its future months are marked released
  too; the automated test checks that with a future date, which this page can't do.)

**6.6 Collections** ☐ ⚠️ XD-Q02/Q04 check the status, not these screens

- CRM → **Installment Accounts** → search the account. **Expect:** Status **closed**, Balance
  **0.00**.
- If it has a collector: CRM → **Collectors** → that collector → **Assigned accounts**.
  **Expect:** listed with Balance 0.00 (or not listed).
- CRM → **CRM Dashboard** → **Collections Calendar**. **Expect:** no dues for this account.

**6.7 Clearing account** ☐ ⚠️ not tested

- Accounting → **Chart of Accounts** → search `1-02-060`.
- **Expect:** **Due from X-Deal Partners (Barter)**, Balance up by the 1-02-060 debit from 5.3
  (the balance is a plain number with no ₱ formatting).

**Notes:** …

---

## 7. Void and re-issue — Bago accountant

> **Run 2026-10-02: ✅ passed** with the new void dialog (F8). CMHO0926-001 voided; re-issued as CMHO0926-002.

**7.1 Void it** ☐ ✅ XD-F16, XD-M15

1. Accounting → **Credit Memos** → your memo's row → the ⊘ icon (**Void credit memo**).
2. **Expect** the app's confirm dialog **Void X-Deal memo CM…?** — _"This reverses its journal entry and
   reopens the installment account with its balance."_ → red **Void memo** (button shows **Working...**).

- **Expect:** toast **Memo voided**; Status **Voided**.

**7.2 Reversing entry** ☐ ✅ XD-M15

- Journal Entries → search the memo number.
- **Expect:** a second, reversing entry (each line flipped), balanced.

**7.3 Ledger reopened** ☐ ✅ XD-F16, XD-M15

- Contract ledger again.
- **Expect:** status **Active**, the **X-Deal credit memo** row is gone, Outstanding back to
  the 3.3 figure.

**7.4 Back in the aging** ☐ ✅ XD-M15

- CRM → Installment Accounts → **AR Aging Report**. **Expect:** the account is listed again.

**7.5 Can't void twice** ☐ ✅ XD-M16

- **Expect:** no void icon on the voided row (the API would refuse: _"Only issued credit memos
  can be voided."_).

**7.6 Re-issue** ☐ ✅ XD-M17

- **X-Deal offset** → your sale is back in the list → pick it → same figures as 5.3 → **Issue
  X-Deal memo**.
- **Expect:** a new memo, same amount as the first. Leave this one issued for §8.

**Notes:** …

---

## 8. Try to break it

Each should be **refused with a clear message, and nothing saved**.

**8.1 X-Deal vs Employee Appliance Loan** ☐ ✅ XD-F05, XD-S09 (cashier)

- Checkout, add the item, pick an **employee-tagged** customer (one that shows the **Employee
  Appliance Loan** checkbox).
- Tick **X-Deal (barter)**. **Expect:** Employee Appliance Loan unticks. Tick Employee Appliance
  Loan. **Expect:** X-Deal unticks.
- If no employee customer exists, mark N/A.

**8.2 Changing customer resets X-Deal** ☐ ✅ XD-F06 (cashier)

- With ABC Billboards picked, tick X-Deal, type a reference, then clear the customer (the **×**
  on the purple card) and pick any other customer.
- **Expect:** X-Deal is unticked and the reference is empty.

**8.3 Offline** ☐ ✅ XD-F09 (cashier)

- With a customer picked: F12 → **Network** tab → throttling **Offline**.
- **Expect:** the X-Deal checkbox is disabled and reads _"Unavailable offline"_. Set back to
  **No throttling**.

**8.4 Park and resume** ☐ ✅ XD-F08 (cashier)

1. Build a full X-Deal (item, Price Use, customer, X-Deal, reference `XD-PARK-01`, term).
2. Top right **Park Sale** → Label `X-Deal park test` → **Park Sale**.
3. Top tab **Parked Sales** → that row → **Resume**.

- **Expect:** X-Deal ticked, reference `XD-PARK-01`. Type a new SI No. → **Create Installment
  Plan** → Pending Approval with X-DEAL. (Approve or leave pending; it isn't used again.)

**8.5 Two terms in one X-Deal** ☐ ✅ XD-S08 (cashier)

- Two lines (add the item, then another installment-priced item, or the same item twice as
  separate lines if your stock allows); X-Deal ticked; give each line a **different** term;
  reference; SI No. → **Create Installment Plan**.
- **Expect:** _"Every item in an X-Deal must use the same financing term."_
- Hard to set up with seed data. If you can't get two separately-termed lines, mark N/A.

**8.6 Ordinary credit memo on an X-Deal invoice** ☐ ✅ XD-F17, XD-M06 (accountant)

- Credit Memos → **New Credit Memo** → **Invoice \*** → search your SI No. → pick it.
- **Expect:** **Type \*** offers only Sales Return / Billing Adjustment / Goodwill (no X-Deal).
  Fill a line and click **Issue Credit Memo**. **Expect:** refused with _"This invoice is an
  X-Deal — clear it with "X-Deal offset" in Credit Memos instead."_ (Your memo from 7.6 is still
  issued, so the invoice may not even be offered; either outcome passes.)

**8.7 Void the sale after the memo** ☐ ✅ XD-M18 (cashier)

- POS → **Transactions** → your SI No. → open → tab **Void Requests** → **Request Void** reason
  `test` → **Submit Void Request**.
- **Expect:** refused with _"This X-Deal was cleared by credit memo CM-… — void that memo before
  returning or voiding the sale."_ Same for **Refund** on the **Details** tab.

**8.8 Void requested before the memo, approved after** ☐ ✅ XD-M18b (several users)

1. Cashier: ring up a second X-Deal (reference `XD-RACE-01`); Business Owner approves it (§2).
2. Cashier: that sale → **Void Requests** → **Submit Void Request**. **Expect:** _"Void request
   submitted — pending manager review."_
3. Accountant: **X-Deal offset** on that sale → issue.
4. Business Owner: Point of Sale → **Void Requests** → the request → **Review** → PIN `1234` →
   **Approve & Void**.

- **Expect:** refused with the same _"…void that memo before returning or voiding the sale."_

**8.9 Memo dated before the sale** ☐ ✅ XD-M12b (accountant)

- Void the 7.6 memo first (or use the 8.8 sale before step 3). **X-Deal offset** → pick the sale →
  **Memo date** = yesterday → **Issue X-Deal memo**.
- **Expect:** red text _"The memo date cannot be earlier than the sale."_; no memo is created.

**8.10 Branch manager can't issue** ☐ ✅ XD-F18, XD-M13

- Log in as **`technova.b1.manager@test.com`** → Accounting → **Credit Memos**.
- **Expect:** **New Credit Memo** is there, **X-Deal offset** is **not**, and X-Deal memo rows
  have **no** void icon.
- Type `/accounting/credit-memos/x-deal` in the address bar. **Expect:** the 403 page.

**8.11 Other branch can't see it** ☐ ✅ XD-M14

- Log in as **`technova.b2.accounting@test.com`** → Credit Memos → **X-Deal offset** → open the
  dropdown.
- **Expect:** none of the Bago X-Deals are listed.

**Notes:** …

---

## 9. Known limits — don't log these as bugs

- **Ledger memo row vs memo amount.** The installment account recomputes its balance from a
  6-decimal factor, which can sit a few centavos off the invoice (₱16,500.03 vs ₱16,500.00 for a
  ₱15,000 / 3-month sale). The memo clears the invoice exactly; the ledger row clears the
  ledger's own balance so it ends at 0.00. The gap predates this scenario.
- **What the partner gives isn't booked automatically.** The memo debits `1-02-060`;
  reclassifying it when the goods or services arrive is a manual JE.
- **Manager approval** follows the normal installment rule (held unless the cashier has an
  override). Whether an X-Deal should always need approval is still open in the plan.
- **Fourth JE line** (Cr Financing Income, only when cash was collected on the X-Deal before the
  memo) is covered by unit tests only.
- **Release Approvals Pending table** headers are shifted one column (pre-existing).

---

## Findings log

| #   | Where                           | What happened                                                                                                                                                                    | Severity                       | Status                                                                                              |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| F1  | Checkout §1.7/1.9               | The red _"Enter the X-Deal reference."_ stayed after typing the reference, beside a button already reading **Create Installment Plan** — looked as if the reference were refused | Medium (UX)                    | Fixed — clears on typing                                                                            |
| F2  | Checkout                        | With an unpriced item, the button reads _"Enter the X-Deal reference"_ but clicking shows the price error; the button label skips the price check                                | Low (UX, pre-existing pattern) | Open                                                                                                |
| F3  | Release Approvals               | Pending table headers one column off (Ref # cell has no header)                                                                                                                  | Low (pre-existing)             | Open                                                                                                |
| F5  | CRM → Installment Accounts list | No X-DEAL badge on X-Deal accounts (API returned the flag; the list never rendered it)                                                                                           | Medium                         | Fixed — badge in both table and mobile rows                                                         |
| F6  | POS → Customers list            | Barter partners not marked (requested during the run)                                                                                                                            | Enhancement                    | Done — X-DEAL pill on customers with an X-Deal account (`xDealAccountCount` on GET /customers list) |
| F7  | Credit Memos → X-Deal offset    | Was a modal; requested as its own page                                                                                                                                           | Enhancement                    | Done — `/accounting/credit-memos/x-deal`, guarded by `accounting:x-deal-memos:issue`                |
| F8  | Credit Memos → void             | Void confirmation used the browser's native confirm()                                                                                                                            | Low (UX)                       | Fixed — app ConfirmDialog for both ordinary and X-Deal voids                                        |
| F4  | Journal Entry detail            | "Posted by" shows a raw user id instead of a name                                                                                                                                | Low (pre-existing)             | Open                                                                                                |
|     |                                 |                                                                                                                                                                                  |                                |                                                                                                     |

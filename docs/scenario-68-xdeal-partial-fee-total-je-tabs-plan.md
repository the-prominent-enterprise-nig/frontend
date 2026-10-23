# Scenario 68 — X-Deal partial payment & automatic memo, delivery fee in the checkout total

Client corrections (2026-10-06), one scenario because all three meet in the POS checkout and its journal
entries. Builds on Scenario 66 (delivery fee) and Scenario 67 (X-Deal).

Branch `feat/scenario-68-xdeal-partial-fee-total-je-tabs` in both repos (worktrees `*-scenario-68`).

> **X-Deal**
>
> - there can be payments that are not full, maybe half payment maybe half deal, so add an option that it
>   can be paid in the checkout, either cash, etc.
> - the X-Deal credit memo should be created automatically (if an X-Deal is created in the checkout, the
>   offset should be created automatically)
>
> **Delivery fee** — in the JE separate it, but in the POS checkout it should be totaled in the checkout.
>
> **JE accounting** — total item, delivery fee, and COGS, so separate on the tabs when it calculates.

---

## Part 0 — Decisions

| #   | Question                      | Decision (Kian, 2026-10-06)                                                                                                                                                                                                                                                   |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | How is "half payment" booked? | As the **down payment** of the X-Deal's in-house installment. Scenario 67's accounting stays. Taken at checkout with the same choices as Cash, on its own CR. Any amount from ₱0 up; no 10% floor.                                                                            |
| D2  | When is the memo made?        | **With the sale, always approved.** The memo is issued in the same database step that creates the sale, dated the sale date, and clears whatever the down payment didn't. The manual **X-Deal offset** page stays, only for re-issue after a void.                            |
| D3  | Delivery fee in the total     | **One total, one payment.** Checkout Total = items + fee; Amount received, change and Underpaid use it. The fee is paid with the sale's own tender. The separate **Paid with** shows only when the sale itself collects nothing. The fee keeps its own CR No. and its own JE. |
| D4  | "Separate on the tabs"        | **Dropped (Kian, 2026-10-06).** JE detail tabs were built (Items · Delivery Fee · COGS) and then reverted at Kian's request: the journal entry page stays as it was. COGS stays inside the sale's entry; the delivery fee stays its own entry, as since Scenario 66.          |

Defaults taken where the client note is silent (say if any is wrong):

| #   | Question                                  | Default                                                                                                                                                                                                                                |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D5  | Who must approve an X-Deal?               | No change needed: every X-Deal line is an installment line, so a cashier's X-Deal is **already** held for Owner / Branch Manager approval. Someone who holds `pos:transaction:override` (an approver) completes it directly, as today. |
| D6  | Most the down payment can be              | Less than the sale total. A down payment equal to the total leaves nothing to barter — that is a cash sale, not an X-Deal.                                                                                                             |
| D7  | Down-payment tenders                      | The sale's own down-payment choices: **Cash** (Cash on Hand, Check, Bank Transfer, GCash, Billers, QR) or **Debit/Credit Card** (acquirer). One tender for the down payment, as for every installment sale.                            |
| D8  | Whose name is on the automatic memo       | The approver's (the Owner / Branch Manager who approved the hold), or the user who completed it at the counter. Reason: `Issued automatically with X-Deal <reference>`.                                                                |
| D9  | Voiding an X-Deal                         | Unchanged: an accountant voids the memo first (X-Deal offset permission), then the sale. A sale with a down payment can't be voided at all, as for every installment sale.                                                             |
| D10 | Delivery fee's tender when it rides along | The sale's tender: the Cash sub-choice (with its check no. / bank / gateway) or the card (acquirer, Straight / Installment). A TPF or installment cart uses its down payment's tender.                                                 |

---

## Part 1 — X-Deal down payment (backend)

**Why it has to travel with the sale.** A cashier's X-Deal is held; the sale is only created when it is
approved, from the cart snapshot. Nothing records a down payment after approval today
(`project-dp-collection-gap`), and the memo (Part 2) must see the down payment before it clears the rest.
So the down payment and its tender details go **in the create request**, like a pure-TPF cart's down
payment already does, and are recorded **inside `create()`'s transaction**.

New `CreateTransactionDto` fields (all rejected unless `isXDeal`):

| Field                                | Rule                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| `xDealDownPaymentMethod`             | `cash` / `card` / `bank_transfer` / `qr`; required when the down payment > 0 |
| `xDealDownPaymentReferenceNumber`    | the down payment's own CR; required when > 0                                 |
| `xDealDownPaymentCheckNumber`        | cash only (Cash → Check)                                                     |
| `xDealDownPaymentMethodOptionId`     | bank / gateway / acquirer of that method                                     |
| `xDealDownPaymentVerifiedAtRegister` | bank transfer only                                                           |

Rules (validateAndPrepare):

- **R1** — today's R2 ("every line ₱0") becomes: down payment ≥ 0 and **< the sale total** (D6).
- **R2** — no 10% floor, no rate-card fixed down payment (unchanged for X-Deal).
- **R3** — down payment > 0 needs a method and its own CR; the CR can't be the delivery fee's CR.
- **R4** — tender details only on their own tender (same rules as the delivery fee's R5b).
- **R5** — down payment = 0 sends none of these fields.

Recorded inside `create()` after the installment plan is posted, in the same transaction:

1. `PosPayment` tagged to the schedule (method, amount, CR, check no., option, verified flag).
2. Down-payment JE (CashReceiptJournal): **Dr** the tender's account / **Cr** A/R.
3. `CollectionReceipt` + `ARPayment` (no due settled); invoice `amountPaid` += down payment → PARTIAL.

`addPayment` refuses any further payment on an X-Deal ("An X-Deal's down payment is taken with the sale").

## Part 2 — Automatic X-Deal memo (backend)

- `XDealMemosService` gets a transaction-aware core, `issueInTransaction(tx, { posTransactionId, memoDate,
reason, actor })`: reads through `tx`, numbers through `nextControlNumber(tx, …)`, no inner
  `$transaction`. The manual `issue()` wraps the same core in its own transaction, so both paths post
  identical entries. `CreditMemosModule` exports `XDealMemosService` (PosModule already imports the module).
- `create()` calls it as its **last step** for an X-Deal, after Part 1. Memo date = sale date. If the memo
  can't be issued (e.g. `X_DEAL_CLEARING` unmapped), the **whole sale is refused** and nothing is written —
  mappings are resolved up front in `validateAndPrepare`, so the cashier hears it at submit.
- `create()` gets an `actorId` option: the approver from `ReleaseFormRequestsService.approve()`, the
  submitter from the counter path (D8). The audit log gets an `ISSUE` entry for the memo, as the manual
  route writes.
- Result per X-Deal: memo amount = `totalPayable` (contract minus down payment):
  **Dr 1-02-060 X-Deal Clearing** (cash price − down payment) + **Dr Unearned Interest** (markup) /
  **Cr A/R**. Installment account closed at ₱0.00, dues settled, interest release stopped.
- Net books for a ₱15,000 X-Deal with ₱5,000 down: **Dr Cash 5,000 + Dr X-Deal Clearing 10,000 = Cr Sales +
  VAT 15,000**; A/R and Unearned net to zero.
- **X-Deal offset page**: lists only X-Deals with no standing memo (normally none — only after a void).
  Its intro text says memos are now automatic.

## Part 3 — X-Deal checkout (frontend)

- X-Deal no longer forces **Waived · ₱0.00**: the down payment card shows an editable amount (blank = ₱0)
  with the hint "Optional — the rest is cleared by the X-Deal memo."
- The **Down Payment** method toggle (Cash / Debit/Credit Card) and Cash's sub-choices (with check no.,
  bank, gateway, Verified at register) and the card acquirer show when the down payment > 0.
- The down payment's CR is entered in the payment box as for any installment down payment.
- On submit the down payment travels in the create request (Part 1); no `addPayment` call for an X-Deal.
- Copy: the X-Deal checkbox line, the pending-approval card and **Release Approvals** say "the rest is
  cleared automatically by an X-Deal credit memo when approved". Success screen shows the memo number.

## Part 4 — Delivery fee in the checkout total (frontend)

- **Order Summary**: `Total` = items + delivery fee, with a "Delivery fee ₱X" line above it.
- **Payment box**: `Total` = what's collected now + fee; Amount received, Change and **Underpaid** use it.
  Payments sent to the sale stay the sale's own (the fee is never sent through `addPayment`, never in
  `totalAmount`), so revenue, VAT and drawer cash are untouched.
- **Paid with** (Scenario 66) hides when the sale collects something; the fee then goes with the sale's
  tender (D10). It shows, as today, when the sale collects nothing (charge, ₱0 X-Deal, Employee Appliance
  Loan) — then the fee is the only thing collected and the payment box's Total is the fee alone.
- Fee keeps its own **Delivery CR Number** and its own JE (Scenario 66 R6 stays).
- Success screen: "Total collected" = sale + fee; the Delivery block stays.

## Part 5 — JE detail tabs — reverted

Built (a `posSale` breakdown on `GET /journal-entries/:id` and Items · Delivery Fee · COGS tabs on the
detail page, with their tests) and then **reverted on Kian's request (2026-10-06)** — nothing of it
remains on the branch. Asked whether COGS should instead become its own journal entry, Kian said no:
COGS stays inside the sale's entry, and the delivery fee stays its own entry, as since Scenario 66.

---

## Tests

All run before the manual script, against the test DB, one suite at a time. ✅ = passing on the
branch (2026-10-06).

| IDs                                              | Where                                                                                        | What                                                                                                                                                                                                                                                                                                                                        | Result              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| XP-U01–U08                                       | BE unit `src/pos/x-deal-down-payment.util.spec.ts`                                           | Down-payment rules R1–R5: ₱0, below the total, equal refused, tender + CR required, each detail on its own tender                                                                                                                                                                                                                           | ✅ 45/45            |
| —                                                | BE unit `transactions.service.spec`, `pos-posting.service.spec`, `delivery-fields.util.spec` | Constructor / memo wiring, unchanged behaviour                                                                                                                                                                                                                                                                                              | ✅ 156/156, 154/154 |
| XD-S01, XD-S07 (updated), XP-S01–S07, XP-A01–A03 | BE e2e `pos-x-deal-checkout`                                                                 | Counter X-Deal ₱0 and ₱5,000 down: payment, DP JE, receipt, memo JE, account closed, net books = ₱15,000, drawer cash; check / bank verified / card; refusals write nothing; no addPayment on an X-Deal; held → approve records DP + one memo in the approver's name; reject records nothing; unmapped clearing refuses submit and approval | ✅ 34/34            |
| XD-M01–M21 (now the re-issue path), XP-M01–M03   | BE e2e `credit-memos-x-deal`                                                                 | The fixture's automatic memo is voided, so every manual case runs as a re-issue; the automatic memo itself, void → re-listed → re-issue, second memo refused                                                                                                                                                                                | ✅ 23/23            |
| XD-F01–F19 (F02/F04/F19 updated), XP-F01–F03     | FE Playwright `pos-checkout-x-deal`                                                          | Optional down payment box, Cash/Card choice once > ₱0, check posts with its number, full payment refused, held X-Deal shows the part paid to the approver                                                                                                                                                                                   | ✅ 14/14            |
| XD-F12–F20, XP-F04                               | FE Playwright `credit-memo-x-deal`                                                           | X-Deal offset page note, a fresh X-Deal is not offered, ledger settled by its own memo                                                                                                                                                                                                                                                      | ✅ 8/8              |
| DF-F01–F18, DT-F01–F05                           | FE Playwright `pos-checkout-delivery`                                                        | One total; Paid with replaced by the sale's tender; underpaid without the fee; change on the grand total with the sale's payment unchanged; a check carried onto the fee receipt; fee-only carts keep Paid with (7 choices incl. GCash / Billers)                                                                                           | ✅ 17/17 ¹          |

¹ DT-F04's last assertion (the success screen names the check) was added with the fix found while
writing the manual script and has not been run yet.

**Regressions** (branch vs untouched `development`, one suite at a time): release-form-request 7/7,
employee-appliance-loan 7/7, pos-checkout-reserve-mode 3/3, pr199-checkout-down-payment 4/4 — pass.
Failing **identically on `development`** (not this branch): `pos-installment-financing` (29 — its
credit-application setup), `pos-delivery-fee-checkout` backend DF-S01/S15 (expect Undeposited Funds;
cash posts to Cash on Hand since d2c7292), `installment-interest-release` (3), `pos.smoke` (18, same
set), Playwright `pos-checkout-installment-down-payment-floor` (2 — two open Bago sessions on the test
DB). The Playwright `pos-checkout-delivery` suite was failing 8 on `development` for a stale CR
selector; reworked here, now 17/17.

**Edge cases** covered: DP = total; DP with no CR; tender details on the wrong tender; ₱0 X-Deal +
fee (Paid with shows); X-Deal + fee with a DP (fee follows the DP's tender); term pick must not
prefill an X-Deal DP (bug found and fixed); held X-Deal approved and rejected; unmapped clearing at
submit and at approval; void memo then re-issue; offline (X-Deal stays off).

## Manual test script

Click-by-click, run after the automated tests pass. Every step names the menu, the button and what
to type, then what you should see. Tick **☐ → ✅ / ❌** as you go and note anything odd in the
**Notes** line under each section.

- **✅ covered** — an automated test already checks this; a failure here means the screen and the
  test disagree.
- **⚠️ watch** — only covered indirectly. Give these the most attention.
- Case IDs (XP-…, DT-…, JT-…) point at the automated test for the same thing.

Branch: `feat/scenario-68-xdeal-partial-fee-total-je-tabs` in both repos (folders
`backend/backend-scenario-68`, `frontend/frontend-scenario-68`).

---

### 0. Setup

#### 0.1 Servers and database

1. Dev DB is fully migrated (Scenario 68 adds **no** migration). Check with
   `npx prisma migrate status` in `backend/backend-scenario-68` — _"Database schema is up to date!"_
2. Backend from `backend/backend-scenario-68` on `localhost:3001`, frontend from
   `frontend/frontend-scenario-68` on `localhost:3000` — **not** the main `backend/backend` /
   `frontend/frontend` checkouts, which are on `development` without these changes.
3. **Every login** uses password `dev-prominent-enterprise-2026`. Where a PIN box shows `••••`,
   use `1234`.

#### 0.2 Accounts

| Who             | Email                             | Used in      |
| --------------- | --------------------------------- | ------------ |
| Business Owner  | `technova.owner@test.com`         | §1–§3, §5–§9 |
| Bago cashier    | `technova.b1.cashier@test.com`    | §4           |
| Bago accountant | `technova.b1.accounting@test.com` | §6           |

To switch user: avatar (top right) → log out → log in as the next one.

#### 0.3 Test data

You need one **non-serial item at ₱15,000 that is stocked at Bago and priced on a Price Use of its
own**, and two customers.

- **Reuse Scenario 67's** `X-Deal Test Aircon 84567` on Price Use `XDEAL-TEST-84567` if Inventory →
  **Stock** shows at least **8** at Bago. Otherwise make one exactly as Scenario 67 §0.3 did
  (Catalog → item → Stock Counts _Found_ 0 → 20 → Price Lists → own Price Use + list at ₱15,000 →
  approve).
- **Customers** — CRM → Customers → new individual customers `S68 Barter Partner` (for X-Deals) and
  `S68 Delivery Customer` (for delivery — give it an address with a barangay).

Write down what you used:

| Thing     | Value |
| --------- | ----- |
| Item      |       |
| Price Use |       |
| Customers |       |

> **Price Use trap.** Every item added to the cart starts on the default Price Use (CR-BR). Switch
> the line's **Price Use** to your item's own before anything else, every time.

> **The figures below** are for the ₱15,000 item on the **3-month** term, as Scenario 67 ran it:
> VAT-inclusive, so **Sales ₱13,392.86 + Output VAT ₱1,607.14**, and an **8% markup** on whatever
> is financed. If your 3-month term's rate differs, the markup and Unearned lines differ — the
> check that always holds is **cash taken + X-Deal clearing = ₱15,000.00**.

---

### 1. X-Deal, fully bartered — memo issued with the sale (Business Owner at the counter)

Log in as **`technova.owner@test.com`**. **Point of Sale → Checkout**, pick the **Bago** session.

**1.1 Build the X-Deal** ☐ ✅ XD-F02

1. Add your item, switch its **Price Use**.
2. Customer → `S68 Barter Partner`. Tick **X-Deal**. Reference `XD-S68-01`.
3. Pick the term **3 months**.

- **Expect:**
  - [ ] The down payment card reads **Down payment · X-Deal · optional**, an **empty** box with
        placeholder _"0.00 — blank if fully bartered"_, and _"Fully bartered — the X-Deal credit
        memo clears the whole sale when it is approved."_
  - [ ] Picking the term did **not** fill in a 10% down payment (this was a bug found while
        building — the box stays empty). ⚠️
  - [ ] No **Down Payment** Cash / Debit-Credit toggle; the payment box reads _"Nothing to collect
        at checkout for this cart."_
  - [ ] The X-Deal line under the checkbox reads _"…Part of it may be paid now as the down
        payment; an X-Deal credit memo clears the rest automatically when the sale is approved"_.

**1.2 Complete it** ☐ ✅ XP-S02, XD-F10

- Sales Invoice No. `SI-S68-01` → **Create Installment Plan**.
- **Expect:** **Installment Plan Created**, an **X-DEAL** badge, and under it _"Cleared by an X-Deal
  credit memo, issued with the sale."_ (The Owner may approve, so it posts straight away.)

**1.3 The memo exists already** ☐ ✅ XP-S02, XP-M01

- **Accounting → Credit Memos**.
- **Expect** a new row: Type **X-Deal**, Origin **X-Deal offset**, Status **Issued**, Total
  **₱16,200.00** (₱15,000 + ₱1,200 markup). Open it (›): reason _"Issued automatically with X-Deal
  XD-S68-01"_.

**1.4 The account is settled** ☐ ✅ XP-S02

- CRM → Customers → `S68 Barter Partner` → **Installment Plans** → the plan → **Contract ledger →**.
- **Expect:** header **Settled — X-Deal credit memo CM…**, last Outstanding **0.00**.
- CRM → **Installment Accounts** → the account: Status **closed**, Balance **0.00**.

**1.5 The memo's entry** ☐ ✅ XP-S02

- Accounting → **Journal Entries** → search the memo number → open it.
- **Expect:** Dr **1-02-060 Due from X-Deal Partners** ₱15,000.00 · Dr **Unearned Interest** ₱1,200.00
  / Cr **Accounts Receivable** ₱16,200.00. Balanced.

**Notes:** …

---

### 2. X-Deal, half paid in cash — "half payment, half deal" (Business Owner)

**2.1 Type the down payment** ☐ ✅ XP-F01

1. New sale: item (Price Use), customer `S68 Barter Partner`, tick **X-Deal**, reference
   `XD-S68-02`, term **3 months**.
2. In the X-Deal down payment box type `5000`.

- **Expect:**
  - [ ] The line under it: _"Paid now at this counter. The rest, ₱10,000.00, is cleared by the
        X-Deal credit memo when the sale is approved."_
  - [ ] The **Down Payment (₱5,000.00)** toggle appears: **Cash** | **Debit/Credit Card**.
  - [ ] The installment preview below the term updates (financed ₱10,000).

**2.2 Pay it** ☐ ✅ XP-F01, XP-S01

1. Down Payment → **Cash** → the Cash row → **Cash on Hand**.
2. Payment box: **Total ₱5,000.00**. Amount received `5000`. **CR Number** `CR-S68-02`.
3. Sales Invoice No. `SI-S68-02` → **Create Installment Plan**.

- **Expect:** **Installment Plan Created** with the X-DEAL note.

**2.3 The money side** ☐ ✅ XP-S01

1. POS → **Transactions** → `SI-S68-02` → open. **Expect:** Payments: **Cash ₱5,000.00**, CR
   `CR-S68-02`.
2. Accounting → **Journal Entries** → search `SI-S68-02`'s transaction number (POS-…). Three entries:
   - [ ] **Installment Plan …** — Dr A/R **₱15,800.00** / Cr Sales ₱13,392.86, Cr Output VAT
         ₱1,607.14, Cr Unearned Interest **₱800.00**.
   - [ ] **Installment Down Payment …** (Cash Receipt) — Dr **Cash on Hand** ₱5,000.00 / Cr A/R
         ₱5,000.00.
   - [ ] The **X-Deal Credit Memo** (memo number) — Dr **1-02-060** **₱10,000.00** · Dr Unearned
         **₱800.00** / Cr A/R **₱10,800.00**.
3. **Expect, the check that matters:** cash ₱5,000 + X-Deal clearing ₱10,000 = **₱15,000.00**; A/R
   ends at ₱0.

**2.4 Receipt and ledger** ☐ ✅ XP-S01

- Contract ledger: a **Down payment** credit ₱5,000 (CR `CR-S68-02`), then the **X-Deal credit memo**
  row; Outstanding **0.00**; status **Settled**.

**2.5 The cash is in the drawer** ☐ ⚠️ XP-S01 checks the figure, not this screen

- POS → **Management → Sessions** → the open Bago session → its expected cash.
- **Expect:** up by **₱5,000.00** from before 2.2 (write both down: before \_\_\_ after \_\_\_).

**Notes:** …

---

### 3. X-Deal down payment by other tenders (Business Owner)

Each as §2, new reference / SI / CR each time, down payment **₱3,000**.

**3.1 Check** ☐ ✅ XP-S03, XP-F01

- Down Payment → **Cash** → **Check**, Check Number `0012345`.
- **Expect:** POS transaction Payments shows the check; the down payment's collection receipt (CRM
  ledger / Collection Receipts) is **CHECK** with `0012345`; the session's expected **cash** does
  **not** go up (a check is not drawer cash).

**3.2 Bank transfer, verified at register** ☐ ✅ XP-S04

- Down Payment → **Cash** → **Bank Transfer** → pick a **Bank** → tick **Verified at register**.
- **Expect:** the Down Payment JE debits **Cash in Bank** (not the clearing account).

**3.3 GCash / Billers** ☐ ⚠️ (QR options — the backend treats them as QR)

- Down Payment → **Cash** → **GCash** → pick a gateway.
- **Expect:** posts; the receipt reads **QR** with that gateway.

**3.4 Card** ☐ ✅ XP-S05

- Down Payment → **Debit/Credit Card** → pick a **Card Acquirer**.
- **Expect:** posts; Payments shows Card with the acquirer.

**Notes:** …

---

### 4. A cashier's X-Deal — held, approved, memo on approval

**4.1 Ring it up** ☐ ✅ XP-F03

1. Log in as **`technova.b1.cashier@test.com`** → Checkout → item, `S68 Barter Partner`, X-Deal,
   reference `XD-S68-04`, term 3 months, down payment `2000`, Cash → Cash on Hand, Amount received
   `2000`, CR `CR-S68-04`, SI `SI-S68-04` → **Create Installment Plan**.

- **Expect:** **Pending Approval**, X-DEAL badge, and _"When approved, the X-Deal credit memo is issued
  automatically."_
- Nothing posted yet: POS → Transactions has no `SI-S68-04`; Credit Memos has no new memo.

**4.2 The approver sees what was paid** ☐ ✅ XP-F03

1. Log in as **`technova.owner@test.com`** → **Point of Sale → Release Approvals → Pending** → the
   row → **Review**.

- **Expect** the amber X-Deal note: _"X-Deal (ref. XD-S68-04) — no credit application by design.
  ₱2,000.00 was paid at the counter as the down payment (CR CR-S68-04). Approving records it and
  issues the X-Deal credit memo for the rest."_

**4.3 Approve** ☐ ✅ XP-A01

- PIN `1234` → **Approve & Release** (if it asks for the Promissory Note: **Mark as Signed** first).
- **Expect:** the sale exists with Payments ₱2,000 (CR-S68-04) and **one** X-Deal memo for the
  rest. The memo is issued in the approving **Owner's** name, not the cashier's — no screen shows a
  memo's issuer, so this one is checked by the automated test only.

**4.4 Reject one** ☐ ✅ XP-A02

- Cashier: another held X-Deal with a down payment (`XD-S68-04B`). Owner: **Reject** it.
- **Expect:** no sale, no receipt, no memo.

**Notes:** …

---

### 5. Try to break it — X-Deal

Each must be **refused with a clear message, and nothing saved**.

**5.1 A down payment of the whole sale** ☐ ✅ XP-F02, XP-S06

- Down payment `15000`, Cash, amount `15000`, CR, SI → **Create Installment Plan**.
- **Expect:** _"An X-Deal's down payment must be less than the sale total — a sale paid in full is
  not an X-Deal."_

**5.2 A down payment with no CR** ☐ ✅ XP-S06

- Down payment `5000`, Cash, amount `5000`, **leave CR Number empty**.
- **Expect:** _"CR Number is required…"_ and nothing posted.

**5.3 Untick and re-tick** ☐ ✅ XD-F04

- With a down payment typed, untick **X-Deal**. **Expect:** the normal down payment (10% minimum /
  rate card) and the credit-application picker come back. Tick it again: **expect** the down payment
  box **empty again** (starts fully bartered).

**5.4 No second payment on an X-Deal** ☐ ✅ XP-S07 (backend only — the screen never offers it)

**5.5 Unmapped X-Deal Clearing** ☐ ✅ XP-A03 — automated only; don't unmap accounts on dev.

**Notes:** …

---

### 6. X-Deal offset page — now for re-issue only (Bago accountant)

Log in as **`technova.b1.accounting@test.com`** → **Accounting → Credit Memos → X-Deal offset**.

**6.1 The page says why it's (usually) empty** ☐ ✅ XP-F04

- **Expect:** _"X-Deal memos are now issued automatically when the sale is approved. Use this page
  only to re-issue one after its memo was voided."_ The **X-Deal sale** dropdown reads _"No X-Deal
  sales to re-issue"_ (or lists only sales whose memo was voided).

**6.2 Void, then re-issue** ☐ ✅ XP-M02

1. Credit Memos → the §1 memo's ⊘ → **Void memo**. **Expect:** Voided; §1's ledger is **Active**
   again with its balance.
2. **X-Deal offset** → the §1 sale is now listed → pick it → **Issue X-Deal memo**.

- **Expect:** a new memo, same amount (₱16,200.00); ledger **Settled** again.

**Notes:** …

---

### 7. Delivery fee totaled into the checkout (Business Owner, cash sale)

**7.1 One total** ☐ ✅ DF-F02 / DT-F01

1. Checkout → item (Price Use), customer `S68 Delivery Customer`, Payment Mode **Cash** → **Cash on
   Hand**.
2. **For delivery** → fee `150`.

- **Expect:**
  - [ ] **Order Summary:** a **Delivery fee ₱150.00** line, then **Total ₱15,150.00**.
  - [ ] **Payment box:** **Total ₱15,150.00** and _"Includes the delivery fee of ₱150.00, receipted
        on its own Delivery CR Number."_
  - [ ] **Delivery section:** no Paid with buttons — instead _"Paid with the sale's payment — the
        same tender, in one Amount received."_ — and the **Delivery fee CR No.** box (placeholder
        **Delivery CR Number**) is still there.
  - [ ] The grey line: _"₱150.00 is added to the checkout total and collected with the sale's
        payment, on its own Delivery CR Number."_

**7.2 Paying only the sale is short** ☐ ✅ DT-F02

- Amount received `15000`, CR `CR-S68-07`, Delivery CR `CR-S68-07F`, SI `SI-S68-07`.
- **Expect:** the big button reads **Underpaid by ₱150.00**; clicking it posts nothing.

**7.3 Pay sale + fee + extra** ☐ ✅ DT-F03

- Amount received `15200` → **Confirm Sale**.
- **Expect** on **Sale Complete**:
  - [ ] **Change: ₱50.00**.
  - [ ] Above the big figure: Sale total ₱15,000.00, **Delivery fee (own CR) +₱150.00**; **Paid Now
        ₱15,150.00**.
  - [ ] The Delivery block: fee ₱150.00 · Cash on Hand · CR `CR-S68-07F`.

**7.4 The sale stays the sale** ☐ ✅ DT-F03

- POS → Transactions → `SI-S68-07`:
  - [ ] Total **₱15,000.00**; Payments **₱15,000.00** (the fee is **not** in it).
  - [ ] Delivery block: Delivery fee ₱150.00 · **Paid with Cash on Hand** · CR `CR-S68-07F`.
- Sessions → expected cash: up **₱15,150.00** (₱15,000 sale + ₱150 fee receipt). ⚠️ — the screen;
  the backend figure is covered.

**Notes:** …

---

### 8. The fee follows the sale's tender

**8.1 A check sale** ☐ ✅ DT-F04

- Cash sale, Cash → **Check** `0099887`, fee `150`, Delivery CR, amount `15150` → Confirm.
- **Expect:** the **Sale Complete** Delivery block and the transaction detail (Delivery → Paid with)
  both read **Check #0099887**. (The success screen used to say Cash on Hand here — fixed while
  writing this script.)

**8.2 A GCash sale** ☐ ⚠️ not automated

- Cash → **GCash** → pick a gateway, fee `150` → Confirm.
- **Expect:** Paid with reads **GCash — <gateway>**.

**8.3 A card sale** ☐ ⚠️ not automated

- Payment Mode → **Debit/Credit Card** → acquirer, **Straight**, fee `150` → Confirm.
- **Expect:** Paid with reads **Debit/Credit Card — <acquirer> · Straight**.

**Notes:** …

---

### 9. When the sale collects nothing, the fee is collected on its own

**9.1 A fully bartered X-Deal with a fee** ☐ ✅ DF-F17 / DT-F05

- X-Deal as §1 (₱0 down), **For delivery**, fee `150`.
- **Expect:**
  - [ ] Payment box: **Total ₱150.00** and _"The delivery fee — paid with the Delivery section's
        Paid with, on its own Delivery CR Number. Nothing else is collected at checkout for this
        cart."_
  - [ ] Delivery section **Paid with** shows **Cash on Hand · Check · Bank Transfer · GCash ·
        Billers · QR · Debit/Credit Card**.

**9.2 Pay the fee by GCash** ☐ ⚠️ not automated

- Paid with → **GCash** → pick a gateway; Delivery CR → **Create Installment Plan**.
- **Expect:** posted; the fee's Paid with reads **GCash — <gateway>**; the X-Deal memo cleared the
  sale.

**9.3 Paid with's own rules** ☐ ✅ DF-F17, DF-F18

- Paid with → **Check** with no number → **Expect** _"Enter the check number for the delivery fee."_
- Paid with → **Debit/Credit Card** → **Installment** with no term → **Expect** _"Select a term for
  the delivery fee's card installment."_

**Notes:** …

---

### 10. Known limits — don't log these as bugs

- **Held sale, closed session.** A cashier's held X-Deal approved after its session closed adds its
  down payment to that closed session — same as a TPF down payment today.
- **Voiding an X-Deal** still means voiding its memo first (accountant, X-Deal offset permission),
  then the sale; one with a down payment can't be voided at all, like every installment sale.
- **Card Installment on an X-Deal down payment** — the Straight / Installment choice shows, but an
  X-Deal down payment records the acquirer only, not the term.
- **Customer display** (second screen) still shows the sale total without the delivery fee.
- **Not this scenario, found while building** (reported, not fixed): the Daily Collection Report can
  drop a delivery-fee row whose amount and customer match a down payment's; two Playwright suites
  fail on `development` too (`pos-checkout-installment-down-payment-floor` — two open Bago sessions
  on the test DB; `pos-installment-financing` backend — credit-application setup 400).

---

### Findings log

| #   | Where | What happened | Severity | Status |
| --- | ----- | ------------- | -------- | ------ |
|     |       |               |          |        |

## Found along the way (not ours — reported, not fixed)

- Daily Collection Report: the down-payment dedupe (8116b55) runs before the delivery-fee check, so a fee
  receipt with the same amount and customer as a down payment is swallowed.
- Chloe's ad605d1 removed COGS from the installment entry; her d2c7292 restored it the same day.
- Cash now posts to `POS_CASH` (d2c7292); Scenario 66 comments still say Undeposited Funds.
- A held sale approved after its session closed adds its down payment to that closed session (same as a
  TPF down payment today).

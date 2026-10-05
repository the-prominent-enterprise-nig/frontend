# Scenario 66 — POS Delivery — Manual Test Script

Plan: `docs/scenario-66-pos-delivery-fee-plan.md`. IDs in brackets (DF-…) are the automated cases each step mirrors.
Run on **dev** at **http://localhost:3000** (Scenario 66 worktree servers; both migrations and the mapping backfill are applied).

Legend: ☐ to do · ✅ passed · ❌ failed (log it at the end).

---

## §0 Setup (about 5 minutes)

**0.1 Logins.** Dev-bypass password `dev-prominent-enterprise-2026`.

| Who            | Login                          | Notes                   |
| -------------- | ------------------------------ | ----------------------- |
| Business Owner | `technova.owner@test.com`      | §1, §2, approvals, void |
| Bago cashier   | `technova.b1.cashier@test.com` | PIN 1234 · §3 and §5    |

**0.2 The item.** **DOWELL STF3238** floor fan, Price Use **WIP**, **₱1,051.08**, 25 in stock at Bago. It is serial-tracked, so adding it opens **Select Serial Number**: take any unit under **In this branch**.

**0.3 The session.** The only open one is **TN-B1-01** (the Bago cashier's). As owner, pick **Bago · TN-B1-01** in **Select session…** at the top of Checkout.

**0.4 Customers.**

- **Customer A = Rosa Villanueva**, already on dev with an address: _Purok 3, Bagroy, Bago City, Negros Occidental, Region VI (Western Visayas), Philippines_.
- **Customer B:** create one. CRM → Customers → **New**, name it e.g. `S66 Test Customer B`, phone any 11 digits. In the address: Region VI → **Negros Occidental** → **Bago City** → barangay **Abuanan** → street `12 Rizal St.` → Save.

**0.5 Mapping check.** Accounting → **Account Mapping**: **Delivery Fee Income** → **4-02-030 Delivery Income**.

**0.6 CR numbers.** Use these in order so the books are easy to read: `S66-CR-01` … `S66-CR-10`. Sales Invoice Nos.: `S66-SI-01` … `S66-SI-07`.

---

## §1 Owner — a counter sale with a delivery fee

Log in as **owner** → POS → **Checkout** → **Select session…** → **Bago · TN-B1-01**.

**1.1 Build the cart** ☐

- Search `STF3238` → click the fan → pick a serial under **In this branch**.
- On the cart line, **Price Use** → **WIP**. Line shows **₱1,051.08**.
- Payment Mode stays **Cash**.
- Customer: type `Rosa` in **Search by name or phone…** → **Rosa Villanueva**.
- **Write down the Order Summary Total** (should be ₱1,051.08).

**1.2 Turn on delivery — pre-fill** ☐ [DF-F01]
Below **Sales Invoice No.**, the **DELIVERY** row → tick **For delivery**.

- **Deliver to** = `Rosa Villanueva`.
- **Delivery Address** = a lilac box with Rosa's Bagroy address and **Change address** under it.
- **Delivery fee** is empty. No **Paid with** / **Delivery fee CR No.** yet.
- Grey note: **Free delivery — no fee to collect.**

**1.3 Type the fee — totals don't move** ☐ [DF-F02]
**Delivery fee** → `150`.

- Order Summary **Total** is still the number you wrote down.
- New purple line under it: **Delivery fee — on its own CR, not in the Total · ₱150.00**.
- **Paid with** (showing **Cash**) and **Delivery fee CR No. \*** appear.
- Grey note: **₱150.00 is collected on its own collection receipt — it is not part of the sale total.**
- Scroll to **Payment**: under **Total** (still the sale only): **Also collect the delivery fee of ₱150.00 on its own CR — not part of this total.**

**1.4 Fill the sale, leave the fee CR blank** ☐ [DF-F03]

- **Sales Invoice No.** → `S66-SI-01`.
- **Amount received** → `1100`. **CR Number \*** → `S66-CR-01`.
- Leave **Delivery fee CR No.** empty → click **Checkout**.
- Red error: **Enter the collection receipt (CR) number for the delivery fee.** Nothing is saved.

**1.5 Same CR as the payment** ☐ [DF-F04]
**Delivery fee CR No.** → `s66-cr-01` (same number, lower case) → **Checkout**.

- Error: **The delivery fee needs its own CR number — it can't be the same as the payment's.**

**1.6 Complete it** ☐ [DF-F05]
**Delivery fee CR No.** → `S66-CR-02` → **Checkout**.

- **Sale Complete**. The big amount (**Total Charged**) is **₱1,051.08**, not ₱1,201.08. Change ₱48.92.
- A **DELIVERY** block below the totals: Deliver to Rosa Villanueva · Address (Bagroy…) · **Delivery fee ₱150.00 · Cash** · **Delivery fee CR# S66-CR-02** · "On its own collection receipt — not part of the sale total."
- The payments list shows **CR# S66-CR-01** only (the sale's).

**1.7 Transaction detail** ☐ [DF-F15]
**Back to POS** → POS → **Transactions** → search `S66-SI-01` → click the row.

- **Total** ₱1,051.08. **Payments**: one, CR# S66-CR-01.
- Below Payments, a **DELIVERY** block: Deliver to · Address · **Delivery fee ₱150.00** · **Delivery fee CR# S66-CR-02**.

**1.8 The books** ☐ [DF-S01]
Accounting → **General Ledger** → account **4-02-030 Delivery Income**.

- One **credit ₱150.00** today, description "Delivery income: …" with the transaction number. Its reference is a system number `CR-YYYYMMDD-NNNN`.
- Same entry: **debit ₱150.00** to **Undeposited Funds**.
- Open the sale's own entry (reference = the transaction number): **no** Delivery Income line, and its totals are ₱1,051.08-based.

**1.9 Not A/R** ☐ [DF-R06, DF-R07]

- POS → **Customers** → Rosa Villanueva → her history/ledger: the S66-SI-01 sale, and **no** separate ₱150 payment row.
- Accounting → **A/R** → **Receipts**: search `S66-CR-02` → **nothing found**.

---

## §2 Owner — variations

Start each with a fresh cart: the fan (WIP), a customer, **Sales Invoice No.**, **Amount received** `1100`, a new **CR Number**.

**2.1 Free delivery** ☐ [DF-F06]
Customer **Rosa**, SI `S66-SI-02`, CR `S66-CR-03`. Tick **For delivery**, leave the fee **empty** → **Checkout**.

- No **Delivery fee CR No.** was asked for. Success **DELIVERY** block: **Free delivery**.
- General Ledger 4-02-030: nothing new.

**2.2 Another address, never written back** ☐
Customer **Rosa**, SI `S66-SI-03`, CR `S66-CR-04`. Tick **For delivery** → **Change address**.

- The picker opens already on Rosa's address (Region VI → Negros Occidental → Bago City → Bagroy, street "Purok 3").
- Change the barangay to **Alianza** → street `Purok 1` → the link **Use the customer's address** is under the picker (don't click it).
- **Checkout** → success **Address** shows the **Alianza** address.
- CRM → Customers → Rosa Villanueva: her address is **still Bagroy**.

**2.3 Customer change** ☐ [DF-F07]
Customer **Rosa** → tick **For delivery** → change **Deliver to** to `Lola Remedios`.
Clear the customer (the small **✕** at the right of Rosa's card) → pick **S66 Test Customer B**.

- **Deliver to** is still `Lola Remedios`.
- **Delivery Address** now shows **Customer B's** Abuanan address.
  (No need to complete — start a new sale.)

**2.4 Turning it off** ☐ [DF-F08]
Tick **For delivery**, fee `150`, then untick it.

- All delivery fields and the purple fee line disappear. Tick it again: everything is empty again. Untick.
- Complete with SI `S66-SI-04`, CR `S66-CR-05` → the transaction detail has **no** DELIVERY block.

**2.5 Fee paid by card** ☐ [DF-S06]
Customer **B**, SI `S66-SI-05`, CR `S66-CR-06`. **For delivery**, fee `80`, **Paid with** → **Credit/Debit Card**, **Delivery fee CR No.** `S66-CR-07` → **Checkout**.

- Success: **Delivery fee ₱80.00 · Credit/Debit Card**.
- General Ledger: 4-02-030 **credit ₱80.00**; the matching **debit** is on the **card clearing** account (POS card), not Undeposited Funds.

**2.6 TPF has no approved-amount box** ☐ [DF-F13]
Any cart → Payment Mode **Installment** → on the line pick **TPF Installment**.

- The **TPF Provider \*** panel asks for the provider and the financier's reference only. There is **no** "Approved amount (optional)". (Scenario 64.)

**2.7 Offline** ☐ [DF-F12]
Chrome DevTools (F12) → **Network** → throttling **Offline**.

- **For delivery** is greyed out with **Delivery needs a connection — add it once the POS is back online.**
- Set back to **No throttling**: it's enabled again.

---

## §3 Cashier — a held installment (TPF) sale

Log out → log in as **technova.b1.cashier@test.com** → POS → **Checkout** (session **TN-B1-01**).

**3.1 Submit with a delivery fee** ☐ [DF-A01, DF-F14]

- Fan (WIP), customer **Rosa**, Payment Mode **Installment** → line → **TPF Installment**.
- **TPF Provider** → **SKYRO**, financier's reference `S66-TPF-01`. Keep the suggested down payment (minimum is 10%).
- Down payment method → **Cash**; **Amount received** = the down payment; **CR Number** `S66-CR-08`.
- **Sales Invoice No.** `S66-SI-06`.
- **For delivery**, fee `200`, **Delivery fee CR No.** `S66-CR-09` → **Create Installment Plan**.
- **Pending Approval** screen. Under Total: **Delivery fee ₱200.00 on CR# S66-CR-09 is recorded when the sale is approved.**
- (Owner, other tab) General Ledger 4-02-030: **nothing new yet**.

**3.2 Approve** ☐ [DF-A02]
Owner → POS → **Release Approvals** → the S66-SI-06 request → **Approve**.

- POS → Transactions → `S66-SI-06`: DELIVERY block with **₱200.00 · CR# S66-CR-09**.
- General Ledger 4-02-030: **exactly one** new credit ₱200.00.
- POS → **Sessions** → TN-B1-01 → reconciliation: **Counter collections (cash)** includes ₱150 (1.6) + ₱200 = **₱350** (plus any other cash collections already there).

**3.3 Reject** ☐ [DF-A03]
Cashier submits the same kind of sale again (SI `S66-SI-07`, fee CR `S66-CR-10`). Owner → Release Approvals → **Reject**.

- No transaction `S66-SI-07`. General Ledger 4-02-030: no ₱200 for S66-CR-10. Counter collections unchanged.

---

## §4 Owner — void takes the fee back

**4.1** ☐ [DF-S12]
POS → Transactions → `S66-SI-01` → **Void Requests** tab → reason `S66 void test` → submit.
POS → **Return/Refund Approvals** → the request → **Approve & Void**.

- `S66-SI-01` shows **voided**. Its DELIVERY block reads **Delivery fee CR# S66-CR-02 (cancelled)**.
- General Ledger: a reversal — 4-02-030 **debit ₱150.00**, Undeposited Funds credit ₱150.00.
- Sessions → TN-B1-01 reconciliation: **Counter collections (cash)** dropped by ₱150.

---

## §5 Cashier — close and reports

**5.1 Close the drawer** ☐ [DF-S11]
Cashier → POS → **Sessions** → TN-B1-01 → close. The screen shows **Counter collections (cash)** with the help text "Installment collections and delivery fees taken this shift…". Enter exactly the **expected** cash.

- Closes with **no variance**.
  (This closes the only open session on dev — open a new one afterwards if you need it.)

**5.2 Daily Collection Report** ☐ [DF-R01–R03]
POS → **Daily Collection** → today, **Bago** → **Collection report**.

- **S66-CR-09** (₱200): one row, kind **DC**, Sales Invoice No. S66-SI-06, in the cash ledger.
- **S66-CR-07** (₱80, card): **not** in the cash ledger; in the **non-cash** block under card.
- **S66-CR-02**: a **cancelled** DC row at ₱0.00.
- The recap's **OTHERS / DC** line = the live cash fees (₱200 if nothing else).

**5.3 Sales monitoring** ☐ [DF-R04]
Same page → **Sales monitoring**.

- Total sales = the sales' own totals (₱1,051.08 each etc.), **not** reduced by any fee.

---

## §6 Known limits (not failures)

- Approving a held sale after the cashier's session has **closed** records the fee on that closed session; that close didn't count it.
- Refunding a delivery fee is a manual accounting action. A return/refund leaves the fee alone.
- The **Delivery Receipt No.** is still not captured anywhere.
- No printable collection receipt for the fee; the cashier writes the booklet CR and types its number.

---

## Findings log

Number findings `N1…`.

| #   | Step | What happened | Expected | Status |
| --- | ---- | ------------- | -------- | ------ |
|     |      |               |          |        |

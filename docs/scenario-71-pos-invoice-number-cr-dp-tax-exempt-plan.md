# Scenario 71 — POS: tax-exempt price, money formatting, payment-method view, CR only for down payments, invoice number everywhere, an obvious down-payment field

**Source**: the client meeting of **2026-10-07** (raw notes, Kian), scoped by Kian on 2026-10-13 to seven items:

1. Fix tax exempt
2. Put decimal and comma (in prices)
3. A view where they can see transactions that are cash, CC, …
4. No CR for cash. CR only for down payment (required) — or make optional. Also: the "approved / new application" wording is confusing
5. All transaction numbers should be the invoice number (always display the invoice, not the POS number)
6. A DP field for manual input (it should be obvious that it is editable, for easy access)

Everything else in the 2026-10-07 notes is out of scope here (see _Not in this scenario_).

**POS only, including what a POS sale feeds in CRM, accounting and inventory** (Kian, 2026-10-13). If a POS sale, payment or down payment shows up in another module, that screen is in scope too:

- CRM: installment accounts, the customer ledger, agents
- accounting: AR invoices, journal entries, tax reports
- inventory: stock movements, serial history, the reconciliation report

Inventory's own work (purchase requests / PO) and the main dashboard are not in scope. They are listed under _Not in this scenario_.

Verified against `development` on **2026-10-13** (frontend `32337964`, backend `83b29c7`). Nothing built yet.

---

## Step 0 — the seven items lined up against the notes

Each item is matched to the meeting-note lines it stands for, and to the earlier notes Scenario 69 already sorted ("notes 1", `scenario-69-inventory-rr-po-stock-transfer-client-feedback-plan.md`), so one change answers every place the client said it.

| #   | Item (Kian)                               | Meeting-note lines it covers (2026-10-07)                                                                                                                                                                                                                                                                                                                                         | Also said in notes 1 (Scenario 69)                                                  |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Fix tax exempt                            | _Tax Exempt — there should be no TAX or deduction, should be same price_                                                                                                                                                                                                                                                                                                          | #11 _PO — if tax exempt, retain the original price_ (PO side already built)         |
| 2   | Decimal and comma in prices               | _POS UI — in fields, increase size_; (_Inventory — in line items in new purchase request add comma automatically_: not POS, later)                                                                                                                                                                                                                                                | #8 _PO — add decimal for numerals (prices)_ (PO decimals already built, commas not) |
| 3   | View of transactions by cash / CC / …     | _POS — add filter in transactions to separate based on payment method (cash or card)_; _if CC (credit card) Straight or Terms_; _bug transaction date filters_                                                                                                                                                                                                                    | —                                                                                   |
| 4a  | No CR for cash, CR only for the DP        | _POS UI — CR number (if needed) — make it optional_                                                                                                                                                                                                                                                                                                                               | #12 _PO — CR for downpayment (optional for cash)_, sent to POS                      |
| 4b  | "Approved / new application" is confusing | _POS — change terms if there is approved credit application in checkout and if there's none, should change "approved credit application"_                                                                                                                                                                                                                                         | —                                                                                   |
| 5   | Invoice number, never the POS number      | _POS UI — instead of POS # make it as Invoice number_; _POS — add sales invoice number_; _JE — not POS number but SI Number, sale reference the primary key should be Sales Invoice number_; _CRM — CHANGE ALL POS-NUMBER TO SI-NUMBER_; _CRM — Change IA to invoice number in installment accounts lists_; (_invoice number before the unit in upcoming payables_: already done) | #13 _invoice number as primary key on recent transactions_, sent to POS             |
| 6   | An obvious, editable DP field             | _POS — downpayment field should be open field, customer discretion …_; _in tpf pwede 0, if inhouse inde pwede 0 pero pwede before required_; Kian 2026-10-08: in-house DP is never 0, the floor is the price-list / rate-card minimum; TPF DP can be 0                                                                                                                            | —                                                                                   |

Five more notes were folded in later the same day as items 7–12 (see _Folded in_): the QR down-payment title, full bank names, AR Invoices filters, installment accounts date filter and columns (both already built), and the credit applications Item Model column.

### Already done by someone else, so not in this scenario

| Note                                                                                                                                         | Where it landed                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| _bug on tpf, it saves downpayment twice_                                                                                                     | Chloe `9338c6ff` (2026-10-07), on development                                                                             |
| _do not put delivery fee in the order summary_; _transfer delivery tick to the bottom_; _enlarge checkbox for delivery_                      | Chloe's Scenario 70 checkout doc (`scenario-70-checkout-delivery-own-tender-application-term-plan.md`), merged 2026-10-12 |
| Part of 4b: the application's **term** should win at checkout                                                                                | Same Scenario 70 doc, D7 (term wins on return from "Continue to sale"). 4b here is only the wording.                      |
| _make the invoice number before the unit in upcoming payables_                                                                               | Already so: `Customer360` Upcoming Payables puts the SI first                                                             |
| Item 5 on the transactions list, transaction detail, checkout success, customer ledger, sale JE, installment accounts list, Daily Collection | Already show the SI, with the POS number only as a fallback (see item 5)                                                  |

---

## Item by item

### 1 — Tax exempt: same price, no VAT taken out · **S** · BE + FE

**Today.** An exempt sale **drops the price by the VAT inside it**: ₱10,744.67 becomes ₱9,593.46 (price ÷ 1.12). This was deliberate: Chloe, 2026-09-08, backend `b31c080` / frontend `c6d01638`, _"strip embedded VAT on a tax-exempt sale"_. Before that, an exempt sale kept its price, which is what the client now asks for. Scenario 69 (`a2caafd`) left the arithmetic alone and turned the on/off switch into a VAT class per sale (VAT-OUT-12 / VAT-OUT-0ZR / VAT-OUT-EXEMPT, with certificate, PIN and reason).

**Change.**

- FE `pos/checkout/_utils/calculations.ts:89-98` (`effectiveUnitPrice`) and `:144-156` return the shelf price when exempt; `page.tsx:1477` sends `rawSubtotal`. The backend builds the total from that subtotal (`transactions.service.ts:1630`), so the FE must send the gross figure.
- BE `transactions.service.ts:1502-1515`: stop dividing by 1.12 when `noVat`.
- Result: `vatExemptAmount` = the full shelf price, tax 0, JE Dr Cash 10,744.67 / Cr Sales 10,744.67, no Output VAT line. The receipt's VAT-Exempt Sales line shows the shelf price.
- Update `transactions.service.spec.ts:1715-1803`, which asserts the strip.
- **Zero-rated keeps the shelf price too (D1).** It shares the `noVat` path, so the same change covers it, and the figure lands in `zeroRatedAmount`.
- **CRM and accounting, check:**
  - The tax reports read `vatExemptAmount` / `zeroRatedAmount` (`accounting/tax-reports/tax-ledger.service.ts:334,617,694`). Confirm they show the shelf amount and no Output VAT.
  - An exempt **installment** sale finances the shelf price, so the installment account, customer ledger and AR invoice carry the higher figure. Confirm the schedule and the sale JE still balance.
  - Old exempt sales stay as they were posted. Nothing is backfilled.

**This reverses Chloe's 2026-09-08 change.** The client asked for it in so many words, so it is not a side effect, but Chloe should hear it from us first.

### 2 — Commas and two decimals in POS money fields · **M** · FE

**Today.** There is no shared money input, and no POS money field shows a thousands separator. Checkout's are bare `type="number"`: down payment (`page.tsx:5741`, `:5876`), Amount received (`:6343`), split amount (`:6432`, only `w-28` wide), X-Deal cash portion (`:5713`), price override (`PriceOverrideDialog.tsx:81`), delivery fee (`DeliverySection.tsx:278`). The nearest thing to a money input is a private `MoneyInput` in the PO form (`inventory/purchase-orders/_components/PurchaseOrderFormFields.tsx:724-765`). It keeps centavos while typing but adds no commas.

**Scope (D2): every peso-amount input under `pos/`.** Counts, percentages, months, points and factor rates stay as plain numbers:

| Screen                               | Field(s)                                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkout                             | down payment ×2, X-Deal cash portion, Amount received, split-payment amount, price override, delivery fee                                            |
| Sessions (`sessions/page.tsx`)       | opening cash `:579`, loose coin total `:1667`, declared cash `:2092` (the peso **counts** at `:1640` stay plain)                                     |
| Cash drawer (`cash-drawer/page.tsx`) | amount `:339`                                                                                                                                        |
| Collections                          | payment amount `CollectionsScreen.tsx:1411`; New Receipt `NewAcknowledgementReceiptForm.tsx:297` and its edit `AcknowledgementReceiptDetail.tsx:603` |
| Daily Collection                     | coin totals `DailyCollectionForm.tsx:396`, `DailyCollectionTotals.tsx:281` (note counts stay plain)                                                  |
| Undeposited funds                    | slip amount `CashInTransitList.tsx:928`                                                                                                              |
| Credit applications                  | money fields in `CreditApplicationFinancingFields.tsx:528` and `PaperRecordFields.tsx:73,93`                                                         |
| Service jobs                         | actual amount `ServiceJobDetailModal.tsx:294`                                                                                                        |
| POS back office                      | branch pricing price `branch-pricing/page.tsx:519`, gift card value `gift-cards/page.tsx:334`, promo min purchase `promo-codes/page.tsx:348`         |

Part 1 re-checks this list against the code before touching it. Any field found that isn't a peso amount is dropped.

**Change.**

- One shared `MoneyInput` (`src/components/…/MoneyInput.tsx`), written fresh but on the PO one's idea. It shows `12,345.67` when not focused, takes raw keystrokes while focused (so a typed `.` survives), and hands the parent a number. It is larger, for the "increase size" note.
- Apply it to the fields above.
- Display fixes on POS screens: `PriceOverrideDialog.tsx:91` and `service-jobs/_components/TransactionSearchCombobox.tsx:39` (`toFixed(2)`, no comma); the backend emailed receipt `receipt-notification.service.ts:150,159`.
- The commas must never reach the clipboard or the API. Chloe's Copy button (Scenario 70) copies `6190.00` for pasting into Amount received, and the input must also accept a pasted `6,190.00`.
- **Not POS, left alone:** the PO form keeps its own `MoneyInput`, and the purchase-request commas wait for later. So does PR/PO's discount field, which can't take centavos (`Number(raw)` on every keystroke turns "12." into 12).

### 3 — Transactions by payment method (cash / card straight / card terms / …) · **M** · BE + FE

**Today.** POS → Transactions (`pos/transactions/_components/TransactionsList.tsx`, `GET /pos/transactions`) filters by type, status, date and search. It has **no payment-method filter or column**. The data is already there: `PosPayment.paymentMethod` (cash, card, qr, bank_transfer, tpf, …; a check is `cash` plus a check number or the "Check" option), and **card Straight vs Terms already exists** as `PosPayment.cardTxnMode` (`straight` / `installment`) + `cardInstallmentTerm`. Checkout captures it, but nothing displays or filters it, not even `TransactionDetail`. Scenario 70's Daily Collection Report splits by tender, but only for one branch and one day, closed sessions, no TPF and no card split. It is not this view.

**Change.**

- BE `TransactionFilterDto`: add `paymentMethod` and `cardTxnMode`, and filter with `payments: { some: … }`. Check is its own choice, using the existing `CHECK_PAYMENT_WHERE`. A split-tender sale shows under each method it used. Say so in the UI.
- FE: a Payment method dropdown (All · Cash · Check · Card — Straight · Card — Terms · QR / e-wallet · Bank transfer · TPF), a Payment column on the list, and Straight / Terms + term months on `TransactionDetail`.
- **The client reported the date filter as a bug** (_"bug transaction date filters"_), so it is in scope. `transactions.service.ts:2576-2577` does `new Date('YYYY-MM-DD')`, which is UTC midnight, 08:00 in Manila. Sales before 8 a.m. on the From day are dropped, almost all of the To day is dropped, and From = To returns nothing. Fix with `manilaDayStart` / `manilaDayEnd` (`accounting/tax-reports/tax-period.util.ts:31,37`). The same pattern is at `:4085-4086`; check which screen uses it.

**Found, not on the client's list (report only, see D7):**

- The **Status** filter does nothing. The FE sends `status`, `TransactionFilterDto` has no such field, and the whitelist silently drops it.
- The list has **no pagination** and returns every matching sale with lines and payments.
- `daily-collection.service.ts:659-662` builds the day boundaries in server-local time, which is right only if the server runs on Manila time.

### 4a — CR only where there is a down payment · **XS–S** · FE (BE only if the DP CR becomes optional)

**Today.** CR Number is required on **every** sale payment (`page.tsx:6482-6485`, submit check `:3490-3511`). This came from Chloe, `e29165b7` (2026-09-30, _"CR Number on every sale payment"_). The comment just above the field still says a plain cash sale needs none. **The backend never required it for a plain sale.** Cash, check and card all take an optional `referenceNumber`, and the Daily Collection Report already prints the SI, not a CR, for an over-the-counter sale. What the backend does require:

| Payment                         | Backend requires a CR?                                              |
| ------------------------------- | ------------------------------------------------------------------- |
| Cash / check / card, plain sale | No                                                                  |
| QR / GCash / Maya               | Yes, but that field is the **gateway reference**, not a CR: keep it |
| In-house installment DP         | Yes (`transactions.service.ts:2983-2991`)                           |
| TPF DP (> 0)                    | Yes (`:2088-2101`)                                                  |
| X-Deal cash portion (> 0)       | Yes (`x-deal-down-payment.util.ts:119-123`)                         |
| Delivery fee                    | Yes, and it must differ from the sale's (Scenario 66)               |
| POS Collections payment         | Yes (`ar-invoices.dto.ts:88-95`)                                    |

**Change (recommended reading).** At checkout, show the CR field only when the sale collects a **down payment** (in-house DP, TPF DP, X-Deal cash portion) and keep it required there. For a plain sale, hide it, or show it as optional, see D3. The QR reference stays required as a reference, relabelled so it is not called a CR. The delivery fee's CR and the Collections CR are unchanged. **CRM and accounting, check:** wherever a plain sale's `referenceNumber` is printed (JE description, customer ledger, AR), a blank must fall back to the SI rather than print an empty "CR". Nothing in the backend breaks: `PosPayment.referenceNumber` has no unique constraint, and the delivery-fee "must differ" check already treats a blank as matching nothing.

### 4b — The "approved / new application" wording · **XS** · FE

**Today** (`page.tsx:5400-5541`). The heading always says **"Approved Credit Application"**, even when the customer has none. Under it, three states use three different styles and words:

- **No applications**: a purple button "New credit application" and _"Every installment sale requires an approved credit application."_
- **None that matches the cart**: a button "New application for this cart"
- **At least one matches**: a picker, a link "+ New application for this cart", and a dropdown action "New application for this cart"

The Confirm button says _"Select an approved credit application"_ either way.

**Change (proposed strings, see D4).**

- Heading: **"Credit Application"**, with a status pill: _Approved — CA-0012_ / _None on file_ / _None for these items_.
- None on file: _"This customer has no approved credit application. Create one to continue the installment sale."_ and one button, **"Create credit application"**.
- None matching: _"The approved application on file is for different items."_ and the same button.
- One or more matching: the picker. The "new" action appears **once**, as the same button style.
- Confirm button: _"Choose the credit application"_ when one exists, _"Create a credit application first"_ when none does.

### 5 — The Sales Invoice number everywhere, never the POS number · **M** · mostly FE, a little BE

**Today.** A sale has two numbers. `transactionNumber` = `POS-<timestamp>-<rand>`, system-generated and unique. `salesInvoiceNumber` = the SI the cashier types, required on every non-refund sale since `transactions.service.ts:836`, **free text, not unique and not indexed**. Already SI-first, with the POS number only as a fallback: the transactions list and detail, checkout success, Customer360 (including Upcoming Payables), the installment accounts list, the customer ledger, the sale JE and Daily Collection.

**Still showing the POS number:**

- **POS:**
  - dashboard Recent Transactions `pos/page.tsx:381` (the "primary key" note)
  - `RecentOrdersWidget.tsx:94`, `PendingApprovalsWidget.tsx:86`, `needsAttentionData.ts:72,126`
  - Void Requests `VoidRequestsList.tsx:321,445,508,599`
  - Return/Refund Approvals `:100,412`
  - Release Approvals `:103`
  - the refund and void modals in `TransactionDetail.tsx:659,672,699`
  - the checkout tooltip `:4643`
- **Collections**: `CollectionsScreen.tsx:670`.
- **Credit applications**: `CreditApplicationDetail.tsx:553,560,1275,1284,1295` and `CreditApplicationList.tsx:196,203,281,289`.
- **Service jobs**: `ServiceJobDetailModal.tsx:151`, `ServiceJobFormModal.tsx:417`, `TransactionSearchCombobox.tsx:38`.
- **Backend, POS outputs:**
  - the emailed/SMS receipt **labels the POS number "Sales Invoice"** (`transactions.service.ts:4307`, `receipt-notification.service.ts:111-114,197`)
  - the POS Sales Report Excel "Txn No." (`pos/reports/sales-report.workbook.ts:129`)

- **CRM, fed by POS sales:**
  - The "IA" number on installment screens: `InstallmentAccountDetail.tsx:324` heading, `AgingReportView.tsx:358`, `CollectorDetail.tsx:191,218`, `RemindersList.tsx:115`, `CollectionsCalendar.tsx:224`. For a POS sale this is just the first 8 characters of the schedule id. The installment accounts **list** already shows the SI.
  - The agent's sales: `AgentsList.tsx:467`.
- **Accounting, fed by POS sales:**
  - "Sale: POS-…" on AR invoices: `ARInvoicesList.tsx:595-599`, `ARInvoiceDetail.tsx:245-248`. The deep link `?search=` switches to the SI.
  - Refund / reversal JE reference and description: `pos-posting.service.ts:678-727, 836`. The sale's own JE already uses the SI.
  - X-Deal memo JE descriptions: `x-deal-memos.service.ts:439,449,465`.
  - AR down-payment rows: `ar-invoices.service.ts:846-848`.
  - The charge invoice number `CHG-<POS number>`: `transactions.service.ts:4625`.
- **Inventory, fed by POS sales** (customer returns already show the SI: `CreateReturnScreen.tsx:73`, `PurchaseRow.tsx:151`):
  - Reconciliation report: `inventory/reports/_components/ReconciliationReport.tsx:193`, from `inventory/services/reports.service.ts:976`.
  - Serial-number history, the "Sold to …" entry's reference: `serial-numbers.service.ts:1200`. It already carries `invoiceNumber` alongside.
  - Stock ledger, a sale row's reference: `stock.service.ts:5631-5636` maps the sale to its POS number.
  - Stock-movement notes `POS sale …` / `POS void/refund …`: `pos/pos-inventory.service.ts:207,256,300`.
  - The customer-return conflict messages _"Transaction POS-… behind invoice …"_: `stock.service.ts:4150,4169`.

**Change.** On every screen and output above, show the SI, using the existing helpers (`saleDocNo` / `saleReferenceOf`, SI falling back to the POS number). The rest of the change:

- The POS number stays the internal key, and appears as a muted secondary line on the transaction detail.
- A refund shows its original sale's SI.
- The receipt email shows the real SI.
- Searches that match `transactionNumber` keep doing so and also match the SI.

**Two records, not just displays. Only new rows change; nothing is backfilled:**

- **Refund / reversal JEs** get the SI as their reference from now on. Older entries keep theirs, because the tax ledger finds them by `transactionNumber` (`tax-ledger.service.ts:594`). New ones are found by `sourceDocumentId` first, so they are unaffected.
- **A new charge invoice** is numbered the way an installment invoice already is (`:4908-4916`): the SI, or `SI-<suffix>` when that SI is already an invoice number, cut to the 50 characters `ARInvoice.invoiceNumber` holds. Existing `CHG-…` invoices keep their numbers.
- **New stock-movement notes** read `POS sale <SI>` / `POS void/refund <SI>`. Old notes stay as written.

The serial history and the stock ledger are displays: they look up the sale's SI at read time, so old rows show it too. Nothing parses the `POS sale …` note text back into a transaction (checked 2026-10-13).

**Later, since a POS sale doesn't feed them:** the main dashboard widgets (`RecentOrdersWidget.tsx:94`, `PendingApprovalsWidget.tsx:86`, `needsAttentionData.ts:72,126`).

Since the SI is not unique, see D5.

### 6 — A down-payment field that is obviously editable · **S (field) / M (rule changes)** · FE, plus BE for TPF 0

**Today** (`page.tsx:5680-5944`).

- **In-house and TPF.** The DP is a read-only stat box with a pill ("Rate card" / "10% min") and a small dotted **"Change amount"** link. That is deliberate (comment at `:726-729`: _"so it doesn't read as an editable box"_). On a rate-card term the link is hidden and the DP cannot be changed at all, because the rate card's monthly is computed from that exact DP.
- **Per line, not per cart.** Two units of one model share one field, and the typed figure is **per unit** (it doubles).
- **TPF** must be > 0 and ≥ 10%, in both FE and BE (`transactions.service.ts:706-715`). **That contradicts the client: TPF DP can be 0.**
- Employee Appliance Loan and X-Deal already have an always-open field.

**Change.**

- One always-open money input (the item-2 component), labelled **"Down payment"** with a pencil icon or "editable" hint and the floor under it (_"Minimum ₱X (rate card)"_ / _"Minimum 10% — ₱X"_). It replaces the stat + "Change amount" link for in-house and TPF.
- **TPF**: floor 0, in FE `:3406-3424` and BE `:706-715`. The CR is required only when the DP > 0, which is already the BE rule.
- **In-house**: never 0. The floor stays the rate-card or 10% minimum (Kian, 2026-10-08).
- **On a rate-card term (D6)**: the same field, read-only. It shows the rate card's figure and the line _"Fixed by the rate card for this term — the monthly is computed from it."_
- **CRM and accounting, check, for a TPF sale with DP 0:**
  - The sale JE puts the whole amount on the TPF receivable, with no down-payment line and no DP collection receipt.
  - The customer ledger and the Daily Collection Report show no DP row.
  - Nothing divides by the DP or assumes it is above 0.

Untouched: the known gap that a held cashier installment sale never records its DP. Kian, 2026-10-02: leave it.

---

## Folded in (Kian, 2026-10-13)

Five more 2026-10-07 notes sit on the same screens and code as items 1–6, so Kian folded them in. Two turned out to be built already.

### 7 — A down payment paid by QR (Soundpay) says so · **S** · BE + FE

> _POS — Payment in transactions in QR Soundpay — add downpayments title_

**Today.** The transaction detail's "Payments" rows print the raw method (`{p.paymentMethod.replace('_', ' ')}` with `capitalize`, `pos/_components/TransactionDetail.tsx:337-355`). A Soundpay payment therefore reads **"Qr"**: no "Soundpay" and no "Down payment". The only other line is `CR# …`.

- `findOne` (`transactions.service.ts:2641`, mapping ~2797) doesn't load the option name. The delivery-fee receipt does (`:2668`).
- Nothing on `PosPayment` says "down payment" outright. An in-house DP payment carries `installmentScheduleId` (schema comment: it tags the payment as funding that schedule's DP). TPF and X-Deal DPs are their own payment rows, created from `tpfDownPayment*` / `xDealDownPayment*`.

**Change.**

- BE: `findOne` includes `paymentMethodOption { name }` and returns a per-payment `isDownPayment`:
  - in-house: `installmentScheduleId` is set
  - TPF / X-Deal: whatever marks their DP row, settled in Part 5 from the create path
- FE: each payment row reads **"Down payment · QR — Soundpay"** (or "Card — Straight", "Bank transfer — BDO-Quezon", …), using the same label builder as item 3's new Payment column.

### 8 — Full bank names (BDO-Q → BDO-Quezon) · **XS code + data** · FE

> _Collections — in method, in bank transfer, complete bank name (BDO-Q → BDO-Quezon)_

**Today.** The bank list is `PosPaymentMethodOption` rows. Code creates them once per tenant from `STANDARD_METHOD_OPTIONS.bank_transfer` (`backend/src/pos/payment-methods.service.ts:70-79`: `BDO-Q`, `BDO-GF`, `BPI-Araneta`, `BPI-Central`, `Metrobank`, `LB-PSB`, `LB-Sipalay`, `LB-Sagay`). Checkout and POS Collections both read them.

- The backend can already rename an option (`PATCH /pos/payment-method-configs/:id/options/:optionId`, `payment-methods.controller.ts:207`).
- Settings → Payment Methods (`PaymentMethodOptionsSection.tsx`) only adds, enables/disables and deletes. **There is no rename.**
- Delete is blocked once an option has been used.
- Scenario 56 already settled the long names as a data change (`scenario-56-inventory-po-uat-followup-plan.md:77`: BDO-Quezon, BDO-Golden Field, …).

**Change.**

- FE: a rename control on each option in Settings → Payment Methods, wired to the existing PATCH. The option keeps its id, so past payments show the new name.
- Data, not a deploy: the client (or Kian) renames the live options. Code's seed list changes too, so a new tenant starts with long names.
- **Open data question:** the full names for `LB-PSB`, `LB-Sipalay`, `LB-Sagay` (Landbank branches?). Ask the client; this doesn't block the build.
- Update the two tests that assert `'BDO-Q'`: `backend/test/pos-payment-method-configs.e2e-spec.ts:471` and `e2e/pos-checkout-payment-method-options.spec.ts:125`.

### 9 — AR Invoices: date and location filters · **S** · BE + FE

> _Accounting — add date filter and location filter in AR Invoices_

**Today.**

- `ArInvoicesService.findAll` (`ar-invoices.service.ts:340`) takes `search`, `status`, `customerId` and `branchId` (`:410`). It has no date filter and no pagination.
- The list (`accounting/ar-invoices/_components/ARInvoicesList.tsx:100-118`) sends only `customerId` / `search`, so **branch is never offered in the UI**.

**Change.**

- BE: `dateFrom` / `dateTo` on `invoiceDate`, with Manila-day bounds (`manilaDayStart` / `manilaDayEnd`, the same helpers as item 3's fix).
- FE: From / To and a Location (branch) dropdown, in both the customer-rollup view and the per-customer view.

### 10 — Installment accounts: date filter · **already built**

> _Installment accounts — add date filter_

The list already has a **Due Date** from–to filter, on Manila days (`InstallmentAccountsList.tsx:183-239`, `installment-account.service.ts:929-952`).

If the client meant the **sale date**, that needs a new filter. The aging report defines it as `posTransaction.occurredAt ?? arInvoice.invoiceDate ?? createdAt` (`:1679-1684`). Confirm with the client before building anything.

### 11 — Installment accounts list columns · **already built**

> _Change IA to invoice number in installment accounts lists (and remove status, add MI Due, add contact number, change to outstanding balance, and change branch to due date)_

Already like this on development (`InstallmentAccountsList.tsx:315-321`, last touched `7e921343`):

- Columns: **Cat · SI # · Customer / Contact # · Collector · Due Date · MI Due · Outstanding Balance**.
- SI # shows the IA number in grey under it.
- Status shows only as a badge when the account isn't active.
- There is no Branch column.

Nothing to build.

### 12 — Credit applications list: item model instead of co-maker · **XS** · FE

> _POS — in credit applications, instead of co-maker change to item model_

**Today.** The list's headers are **Application # · Applicant · Co-Maker · Amount · Status · Branch** (`pos/credit-applications/_components/CreditApplicationList.tsx:224-242`; the cell is `app.coMaker?.name ?? '—'` at `:259`). The response already carries `items[].item { name, sku, modelNumber }` (`credit-application.service.ts:117-125`).

**Change.**

- The column becomes **"Item Model"**, showing `modelNumber ?? name` for each item, comma-separated.
- The mobile card gains the same line.
- The co-maker stays on the application's detail page ("Related People or Co-maker") and in the intake form. The note is about the list.

---

## Decisions (Kian, 2026-10-13)

Kian took every recommendation as written, except D2, which became POS only. The scope then widened to the CRM and accounting screens a POS sale feeds.

| #   | Question                                                                                                                                                                                                        | Decision                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Tax exempt keeps the price. Does **zero-rated** keep it too? (Today they share the same path.) Is _"no deduction"_ only about this, or also customer withholding (CWT, booked at collection since Scenario 69)? | Both exempt and zero-rated keep the shelf price; CWT untouched. Tell Chloe before merging, since it reverses her `b31c080` / `c6d01638`.                                                   |
| D2  | How far does "commas" go?                                                                                                                                                                                       | **POS only**: shared `MoneyInput` on every peso-amount input under `pos/` (item 2's table). Purchase requests / PO and the other modules later.                                            |
| D3  | "No CR for cash": does **cash** mean cash on hand only, or every Cash-mode tender (cash, check, card, bank)? Hide the field, or show it as optional?                                                            | Every Cash-mode tender on a plain sale; **show it as optional** (some branches may still write a booklet CR). Keep it required wherever there is a DP, delivery fee or collection.         |
| D4  | The 4b wording above: OK as written?                                                                                                                                                                            | Yes, as proposed.                                                                                                                                                                          |
| D5  | The SI is free text and not unique. Add a duplicate check now that it is the number everyone sees?                                                                                                              | A **warning** at checkout when the SI is already used at that branch (not a hard block, not a migration).                                                                                  |
| D6  | Rate-card term: the client says DP is _"customer discretion"_, but the rate card's monthly is computed from its exact DP. Let the cashier type a higher DP there?                                               | Not in this scenario: keep a rate-card term locked (the field shows the figure and says why). Allowing it means recomputing the monthly, which belongs with the multi-item DP / FMI batch. |
| D7  | The Status filter no-op and the missing pagination on Transactions are not on the client's list. Fix them with item 3, since the filter bar is being rebuilt anyway?                                            | Fix the Status filter (small, same file); report the pagination and leave it.                                                                                                              |

---

## Build order

One part at a time, each verified before the next:

1. **Part 1 — `MoneyInput` + item 2** (FE). Every POS peso field. Everything after it reuses the component.
2. **Part 2 — item 6, DP field** (FE, plus BE for TPF 0, plus the TPF-0 JE / ledger check).
3. **Part 3 — items 4a + 4b + 12, CR rule, application wording, Item Model column** (FE; plus the blank-CR fallback wherever CRM / accounting prints it).
4. **Part 4 — item 1, tax-exempt and zero-rated keep the price** (BE + FE; plus the tax reports and the installment ledger check). Tell Chloe before this part merges.
5. **Part 5 — items 3 + 7 + 8 + 9, payment methods and filters** (BE + FE):
   - the payment-method filter, Straight / Terms, the date bug and the Status filter
   - the payment label builder, shared by the new column and the detail rows, with "Down payment · QR — Soundpay"
   - bank-option rename
   - AR Invoices date + location
6. **Part 6 — item 5, the SI sweep** (FE across POS, CRM, accounting and inventory; BE receipt, sales report, refund JE reference, X-Deal memo text, AR DP rows, new charge-invoice numbers, stock-movement notes) **+ D5's duplicate-SI warning**.

Items 10 and 11 are already built: nothing to do.

No migration is expected in any part.

---

## Tests

### How the tests run

- **One suite per command, never chained or looped.** The dev machine can't take more.
- **Baseline first.** Before Part 1, run every regression suite named below once on clean `development` and log each result in the _Baseline_ table. A failure that also happens on the baseline is pre-existing, recorded, and not fixed here. Only a new failure blocks a part.
- **Backend e2e** runs against the test DB (`the-prominent-enterprise-test`) by calling jest directly with `DATABASE_URL` set inline. **Playwright** runs against an already-running scenario-71 frontend/backend pair (`reuseExistingServer`). No DB reset without Kian's word.
- **New specs create their own data:** customer, item, stock, price-list row, session. The seed's stock and price lists don't overlap, and the seed deletes the demo item, so ambient rows can't be trusted.
- **Every part ends with:**
  - `tsc --noEmit` in both repos
  - eslint on the changed files: no new warnings beyond development's
  - prettier clean
  - BE `jest` unit suite for the touched service
- The FE has no unit runner. Its logic is covered by Playwright.

Test IDs: `S71-<part>-<F|B|U><nn>`. F = Playwright, B = backend e2e, U = backend unit.

### Part 1 — `MoneyInput` (item 2)

**New Playwright spec `e2e/pos-money-input.spec.ts`:**

| ID        | Case                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| S71-1-F01 | Amount received: type `12345.6`, blur → shows `12,345.60`; focus again → raw `12345.6` for editing                                           |
| S71-1-F02 | A typed `.` survives: `12.` stays `12.` while focused (the PO discount bug must not come back here)                                          |
| S71-1-F03 | Paste `6,190.00` → value 6190; paste `₱6,190` → 6190                                                                                         |
| S71-1-F04 | Chloe's Copy button → paste into Amount received → Change is right (copy still puts `6190.00` on the clipboard, no comma)                    |
| S71-1-F05 | Letters, a second `.`, and a minus sign are refused                                                                                          |
| S71-1-F06 | Delivery fee left blank still means free delivery (blank ≠ 0 where blank has a meaning)                                                      |
| S71-1-F07 | The request body carries a plain number: intercept the sale POST and assert `amount: 12345.6`, no string, no comma                           |
| S71-1-F08 | One pass over every screen in item 2's table: type `1234567.8`, blur, read `1,234,567.80`, save where the screen saves, reload, read it back |
| S71-1-F09 | Field size: the checkout money fields are at least the 52px height Chloe's delivery-fee field set                                            |

**Edge cases inside the spec:**

- `0.005` rounds to `0.01`, not `0.00`
- `9,999,999.99` fits without clipping
- clearing the field leaves it empty, not `0.00`
- `inputMode="decimal"` on mobile width

**Regressions:**

- **Playwright:**
  - `pos-checkout-delivery`, `pos-checkout-x-deal`, `pr199-checkout-down-payment`
  - `pos-checkout-installment-down-payment-floor`, `pos-checkout-payment-method-options`, `pos-checkout-reserve-mode`
  - `pos-collections-rebate`, `pos-collections-same-day-guard`
  - `undeposited-funds-deposit`, `cashier-day-baseline`, `pos-session-list-ux-batch`
  - `credit-application-intake`
- **Expected spec churn:** specs that `fill()` a `type="number"` field may need a selector or value fix once the field becomes text. Each such fix is listed in the Part 1 log, so a changed assertion is never mistaken for a pass.

### Part 2 — the DP field (item 6)

**Backend unit, `transactions.service.spec.ts`:**

| ID        | Case                                                                   |
| --------- | ---------------------------------------------------------------------- |
| S71-2-U01 | TPF DP 0 → accepted, no CR needed                                      |
| S71-2-U02 | TPF DP > 0 with no CR → rejected (existing rule kept)                  |
| S71-2-U03 | TPF DP negative or above the sale → rejected                           |
| S71-2-U04 | In-house DP 0 → rejected; below 10% → rejected; exactly 10% → accepted |
| S71-2-U05 | In-house rate-card term: DP ≠ card × qty → rejected (unchanged)        |

**Backend e2e, added to `pos-tpf-installment.e2e-spec.ts`:**

| ID        | Case                                                                                                                             |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| S71-2-B01 | TPF sale, DP 0 → 201; the JE balances with the whole amount on the TPF receivable; no DP `PosPayment`, no DP `CollectionReceipt` |
| S71-2-B02 | Same sale: the customer ledger has no DP row; the Daily Collection Report for the day has no DP row and its total is unchanged   |
| S71-2-B03 | TPF sale, DP ₱1,000 with a CR → DP payment + receipt as before (regression of the non-zero path)                                 |

**Playwright, added to `pos-checkout-installment-down-payment-floor.spec.ts`:**

| ID        | Case                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| S71-2-F01 | In-house line: the DP is an open input on arrival, with no "Change amount" click; the floor text is under it |
| S71-2-F02 | Typing below the floor shows the error and blocks Confirm; at the floor it clears                            |
| S71-2-F03 | Rate-card term: the field is read-only with "Fixed by the rate card for this term…"                          |
| S71-2-F04 | TPF line: DP 0 is allowed and Confirm enables; the CR field is not required at 0                             |
| S71-2-F05 | In-house line: DP 0 is refused                                                                               |
| S71-2-F06 | EAL and X-Deal fields look and behave as before                                                              |

**Regressions:**

- **Backend e2e:**
  - `pos-installment-financing` (29 failures were pre-existing at Scenario 68: compare against the baseline)
  - `pos-tpf-installment`, `pos-tpf-sale-returns`, `pos-employee-appliance-loan-checkout`
  - `pos-x-deal-checkout`, `credit-application-financing`, `cashier-day-baseline`
- **Playwright:** `pr199-checkout-down-payment`, `pos-checkout-installment-credit-application`, `pos-checkout-x-deal`.

### Part 3 — CR rule, application wording, Item Model (items 4a, 4b, 12)

**Playwright, new `e2e/pos-checkout-cr-optional.spec.ts`:**

| ID        | Case                                                                                     |
| --------- | ---------------------------------------------------------------------------------------- |
| S71-3-F01 | Plain cash sale, CR left blank → completes; the field is labelled "CR Number (optional)" |
| S71-3-F02 | Same with check, card and bank transfer (D3: every Cash-mode tender)                     |
| S71-3-F03 | A CR typed on a plain sale is still saved and shows on the transaction detail            |
| S71-3-F04 | In-house installment with DP, CR blank → blocked with the DP message                     |
| S71-3-F05 | TPF DP > 0, CR blank → blocked; X-Deal cash portion > 0, CR blank → blocked              |
| S71-3-F06 | Delivery fee, CR blank → still blocked (Scenario 66 rule)                                |
| S71-3-F07 | QR payment: the field reads "Reference No." (not CR) and is still required               |

**Playwright, added to `pos-checkout-installment-credit-application.spec.ts`:**

| ID        | Case                                                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S71-3-F08 | No application on file: heading "Credit Application", pill "None on file", one "Create credit application" button, Confirm reads "Create a credit application first" |
| S71-3-F09 | Applications on file but none for these items: pill "None for these items", same single button                                                                       |
| S71-3-F10 | A matching application: the picker, pill "Approved — CA-…", the "new" action appears once, Confirm reads "Choose the credit application"                             |

**Playwright, added to `credit-application-ux.spec.ts`:**

| ID        | Case                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| S71-3-F11 | The list shows "Item Model", not "Co-Maker"; two items show comma-separated; an application with no items shows "—" |
| S71-3-F12 | The detail page still shows the co-maker under "Related People or Co-maker"                                         |

**Backend e2e:**

| ID        | Case                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| S71-3-B01 | Cash sale with no `referenceNumber`: the sale JE description, customer ledger and Daily Collection Report print the SI, never an empty "CR" |

**Regressions:**

- **Playwright:** `pos-checkout-payment-method-options`, `pos-checkout-si-dr-numbers`, `pr199-credit-application`, `credit-application-intake`.
- **Backend e2e:** `pos-bank-transfer-verified`, `pos-delivery-fee-checkout` (DF-S01/S15 were pre-existing failures at Scenario 68), `cashier-day-baseline`.
- **Backend unit:** `daily-collection.service.spec`, `delivery-fields.util.spec`.

### Part 4 — tax-exempt and zero-rated keep the price (item 1)

**Backend unit, `transactions.service.spec.ts`** (rewrites the `:1715-1803` cases that assert the ÷ 1.12 strip):

| ID        | Case                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| S71-4-U01 | Exempt, VAT-inclusive ₱10,744.67 → total 10,744.67, tax 0, `vatExemptAmount` 10,744.67                                 |
| S71-4-U02 | Zero-rated, same → total 10,744.67, `zeroRatedAmount` 10,744.67                                                        |
| S71-4-U03 | Standard VAT unchanged (VATable 9,593.46 + VAT 1,151.21)                                                               |
| S71-4-U04 | Exempt with a discount, and with a price override → tax 0 on the discounted / overridden price, nothing else taken off |

**Backend e2e, added to `scenario-69-output-vat.e2e-spec.ts`:**

| ID        | Case                                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| S71-4-B01 | Exempt cash sale: JE Dr cash 10,744.67 / Cr sales 10,744.67, no Output VAT line                                               |
| S71-4-B02 | Exempt **installment** sale: schedule principal, AR invoice total and customer ledger all built on 10,744.67; the JE balances |
| S71-4-B03 | Tax reports for the period: VAT-exempt sales include 10,744.67; Output VAT unchanged                                          |
| S71-4-B04 | Refund of a new exempt sale → refunds 10,744.67                                                                               |
| S71-4-B05 | Refund of an **old** exempt sale (a fixture posted the old way, at 9,593.46) → refunds 9,593.46, what was actually charged    |

**Playwright, added to `output-vat-classification.spec.ts`:**

| ID        | Case                                                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| S71-4-F01 | Choosing an exempt customer keeps the cart line, Order Summary Total and payment Total at the shelf price; the summary row reads "VAT-exempt" |
| S71-4-F02 | The success receipt and transaction detail show VAT-Exempt Sales at the shelf price, VAT ₱0.00                                                |
| S71-4-F03 | Switching back to standard VAT shows VATable + VAT and the same total                                                                         |

**Regressions:**

- **Backend e2e:** `scenario-69-output-vat`, `scenario-69-tax-reports`, `scenario-69-tax-controls`, `price-list-vat-inclusive`, `pos-return-refund-credit-memo`.
- **Backend unit:** `output-vat.spec`, `tax-rows.spec`, `pos-posting.service.spec`.
- **Playwright:** `tax-reports`, `tax-code-overrides`.

### Part 5 — payment methods, filters, labels, bank names (items 3, 7, 8, 9)

**Backend e2e, new `test/pos-transactions-filters.e2e-spec.ts`:**

| ID        | Case                                                                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S71-5-B01 | `paymentMethod=cash` returns the cash sale and not the card sale                                                                                                                       |
| S71-5-B02 | Card sales: `cardTxnMode=straight` and `=installment` each return only their own                                                                                                       |
| S71-5-B03 | Check is its own choice (cash + the Check option) and isn't counted as cash                                                                                                            |
| S71-5-B04 | A split cash + card sale appears under both                                                                                                                                            |
| S71-5-B05 | A sale at **00:30 Manila** is in the From day; one at **23:30 Manila** is in the To day; From = To returns that day's sales                                                            |
| S71-5-B06 | `status=voided` returns only voided sales (the D7 fix)                                                                                                                                 |
| S71-5-B07 | `findOne`: an in-house DP paid by QR Soundpay returns `isDownPayment: true` and option name "Soundpay"; TPF DP and X-Deal cash portion are also flagged; a plain sale's payment is not |

**Backend e2e, added to `pos-payment-method-configs.e2e-spec.ts`:**

| ID        | Case                                                                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| S71-5-B08 | Rename BDO-Q → BDO-Quezon keeps the option id; a payment made before the rename now reads BDO-Quezon. The old `'BDO-Q'` assertion at `:471` changes |

**Backend e2e, AR Invoices** (new cases in `ar-invoice-detail-view.e2e-spec.ts`, or a new `ar-invoices-list-filters.e2e-spec.ts`):

| ID        | Case                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------ |
| S71-5-B09 | `dateFrom`/`dateTo` on `invoiceDate`, Manila days (the same 00:30 / 23:30 boundary cases as B05) |
| S71-5-B10 | `branchId` alone, and combined with `customerId` and a date range                                |

**Playwright:**

| ID        | Case                                                                                                                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S71-5-F01 | Transactions: the Payment method dropdown filters the list; a Payment column shows e.g. "Card — Straight", "QR — Soundpay"                                                                                |
| S71-5-F02 | Transactions: From = To = today shows today's sales, including one rung before 8 a.m.                                                                                                                     |
| S71-5-F03 | Transactions: the Status filter works                                                                                                                                                                     |
| S71-5-F04 | Transaction detail: the DP payment row reads "Down payment · QR — Soundpay"; a card row shows Straight / Terms and the term months                                                                        |
| S71-5-F05 | Settings → Payment Methods: rename an option; checkout's Bank Transfer and Collections' bank list show the new name. The `'BDO-Q'` assertion in `pos-checkout-payment-method-options.spec.ts:125` changes |
| S71-5-F06 | AR Invoices: From/To and Location narrow both the rollup and the per-customer view                                                                                                                        |

**Regressions:**

- **Playwright:** `pos-transactions-pending-release`, `pos-transaction-detail-invoices`, `settings-payment-methods`, `pos-checkout-payment-method-options`, `ar-invoices-transaction-search`, `ar-invoice-days-overdue`.
- **Backend e2e:**
  - `pos-payment-method-configs`, `daily-sales-monitoring`, `ar-invoice-detail-view`
  - `cashier-day-baseline`: the Daily Collection Report's bank lines read option names, so a rename must not break its 87,365.00 day.
- **Backend unit:** `payment-methods.service.spec`, `daily-collection.service.spec`.

### Part 6 — the SI sweep (item 5) + duplicate-SI warning (D5)

**Backend unit, `transactions.service.spec.ts` and `pos-posting.service.spec.ts`:**

| ID        | Case                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| S71-6-U01 | A new charge invoice is numbered with the SI; a second sale with the same SI gets `SI-<suffix>`; a 60-character SI is cut to 50 |
| S71-6-U02 | Refund and reversal JEs carry the original sale's SI as reference                                                               |
| S71-6-U03 | A sale with no SI (legacy, or a refund) falls back to the POS number everywhere                                                 |
| S71-6-U04 | New stock-movement notes read `POS sale <SI>` / `POS void/refund <SI>`                                                          |
| S71-6-U05 | The receipt notification's "Sales Invoice" holds the SI                                                                         |

**Backend e2e:**

| ID        | Case                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S71-6-B01 | Refund JE reference = SI; the tax ledger still links both a new refund JE (by `sourceDocumentId`) and an **old** one whose reference is the POS number |
| S71-6-B02 | Serial history "Sold to …" reference, stock-ledger sale row and reconciliation report all return the SI                                                |
| S71-6-B03 | The X-Deal memo JE description and the AR down-payment rows show the SI                                                                                |
| S71-6-B04 | The POS Sales Report Excel's first column is the SI                                                                                                    |
| S71-6-B05 | The duplicate-SI check returns a warning, not an error, when the SI is already used at that branch, and none for another branch                        |

**Playwright, new `e2e/si-number-sweep.spec.ts`.** One sale with SI `S71-SI-0001` is made through the API. Each listed screen must show `S71-SI-0001` and no `POS-…` as the primary number:

| ID        | Screen(s)                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| S71-6-F01 | POS dashboard Recent Transactions                                                                           |
| S71-6-F02 | Void Requests, Return/Refund Approvals, Release Approvals, and the refund and void modals                   |
| S71-6-F03 | POS Collections, Credit Applications list + detail, Service Jobs                                            |
| S71-6-F04 | AR Invoices "Sale:" link → opens the right transaction                                                      |
| S71-6-F05 | Installment account detail heading, aging report, collector detail, reminders, collections calendar, agents |
| S71-6-F06 | Serial history, stock ledger, reconciliation report                                                         |
| S71-6-F07 | Checkout: typing an SI already used at the branch shows the warning, and the sale can still go through      |
| S71-6-F08 | Transaction detail: SI as the title, POS number as the muted secondary line                                 |

**Edge cases:**

- two sales sharing an SI: search returns both, and links go by id
- an SI with spaces or a slash
- a refund shows its original sale's SI

**Regressions:**

- **Backend e2e:** `ar-invoice-source-sale-link`, `pos-return-refund-request`, `pos-return-refund-credit-memo`, `credit-memos-x-deal`, `installment-account-customer-ledger`, `crm-collectors-installment-accounts`, `inventory-reconciliation-report`, `scenario-69-tax-reports`, `pos-agents`.
- **Playwright:**
  - `ar-invoices-transaction-search`, `pos-checkout-si-dr-numbers`, `customer360-transaction-history`
  - `installment-account-customer-ledger`, `crm-collectors-installment-accounts`
  - `inventory-serial-numbers-history`, `inventory-stock-ledger-search`, `inventory-customer-returns`
  - `pos-sales-reports`, `credit-memo-x-deal`

### Final sweep, after Part 6

Every regression suite above runs once more, one at a time, against the finished branch, and is compared with the baseline.

- **Backend:** `pos.smoke` runs as well (18 failures were pre-existing at Scenario 68).
- **Playwright:** the `pos-checkout-*` family runs as well.

The plan's _Test results_ log records each suite as pass/fail with counts and the baseline count beside it.

### Baseline (filled before Part 1)

Run per part (Kian, 2026-10-13), one suite per command, on the untouched scenario-71 worktrees (= development `32337964` / `83b29c7`) against the dev DB with all 458 migrations applied. Playwright pointed at the running pair with `E2E_BASE_URL=http://localhost:3000 E2E_FRONTEND_PORT=3000 E2E_BACKEND_PORT=3001`.

**Part 1 regressions (Playwright), 2026-10-13:**

| Suite                                         | Repo | Development result           | Notes                                                                                                                        |
| --------------------------------------------- | ---- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `pos-checkout-delivery`                       | FE   | 1 pass · 1 fail · 17 not run | Fixture: no GL account `4-02-030` on the dev DB for the DELIVERY_FEE_INCOME mapping (DF-F01 setup); serial, so the rest skip |
| `pos-checkout-x-deal`                         | FE   | 13 pass · 1 fail             | XD-F02/F07: a locked-tender locator not found                                                                                |
| `pr199-checkout-down-payment`                 | FE   | 4 pass                       |                                                                                                                              |
| `pos-checkout-installment-down-payment-floor` | FE   | 1 pass · 2 fail              | Uses the seed-deleted demo item (`Universal Remote Control`)                                                                 |
| `pos-checkout-payment-method-options`         | FE   | 1 pass · 7 fail              | Uses the seed-deleted demo item                                                                                              |
| `pos-checkout-reserve-mode`                   | FE   | 3 pass                       |                                                                                                                              |
| `pos-collections-rebate`                      | FE   | 1 pass · 1 fail              | Uses the seed-deleted demo item (`sellingPrice` of undefined)                                                                |
| `pos-collections-same-day-guard`              | FE   | 1 pass · 1 fail · 2 not run  | Setup: Counter 1 already has an open session on the shared dev DB (Elijah Gabalda, 10:04)                                    |
| `undeposited-funds-deposit`                   | FE   | 2 pass · 1 fail              | Same open-session clash on Counter 1                                                                                         |
| `cashier-day-baseline`                        | FE   | 1 pass · 3 skipped           |                                                                                                                              |
| `pos-session-list-ux-batch`                   | FE   | 2 pass · 2 fail              | Release Approvals tab and out-of-stock serial picker locators not found                                                      |
| `credit-application-intake`                   | FE   | 2 pass                       |                                                                                                                              |

---

## Manual test script

On the **dev** database, with the scenario-71 worktree servers. Each step has its expected result. Write anything that differs in the _Findings log_ at the end.

### M0 — Setup

| Need                                                                                                                                  | Where                  |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| A cashier and a branch manager login at one branch, with an open session                                                              | POS → Sessions         |
| Customer **A** (regular), customer **B** tax-exempt with a certificate, customer **C** with an approved credit application for item X | CRM                    |
| Item **X** (≈ ₱10,744.67, in stock, with a rate-card term), item **Y** (in stock, no rate card)                                       | Inventory / price list |
| A TPF provider; the QR option "Soundpay"; a Bank Transfer option still named BDO-Q                                                    | Settings               |

### M1 — Money fields (item 2)

1. Checkout, item Y, Cash. In Amount received type `25000` and tab out → shows **25,000.00**; click back in → `25000` to edit.
2. Type `12.5` → the `.` doesn't vanish; blur → **12.50**.
3. Click Copy beside the Total and paste into Amount received → the amount pastes and the change is right.
4. Open Sessions (opening cash), Cash drawer, Collections, New Receipt and Undeposited funds. In each money field type `1234567.8` → **1,234,567.80**; save; reopen → still right.
5. Delivery fee left blank → free delivery, no error.

### M2 — Down payment (item 6)

1. In-house installment of item Y → the **Down payment** box is already open, with "Minimum 10% — ₱…" under it.
2. Type below the minimum → an error, and Confirm is disabled. Type the minimum → it clears.
3. Switch item X to its rate-card term → the DP is shown read-only with "Fixed by the rate card for this term…".
4. TPF sale, DP **0** → Confirm enables and no CR is asked. Complete it. Open its JE → the whole amount sits on the TPF receivable and there is no DP line. That day's Daily Collection → no DP row.
5. In-house DP **0** → refused.

### M3 — CR number (item 4a)

1. Cash sale of item Y, CR blank → the field says "(optional)" and the sale completes. On the Daily Collection Report the row shows the SI.
2. Repeat with check, card and bank transfer → all complete without a CR.
3. In-house installment with DP, CR blank → blocked. Type a CR → it goes through.
4. Add delivery with a fee and leave the delivery CR blank → blocked.
5. QR payment → the field reads "Reference No." and is required.

### M4 — Credit application wording (items 4b, 12)

1. Customer A, installment → the heading reads "Credit Application", the pill says "None on file", there is one "Create credit application" button, and Confirm reads "Create a credit application first".
2. Customer C with item Y (not X) → pill "None for these items".
3. Customer C with item X → the picker, pill "Approved — CA-…", and Confirm reads "Choose the credit application".
4. Credit Applications list → the **Item Model** column, with no Co-Maker column. Open one → the co-maker is still on the detail page.

### M5 — Tax exempt (item 1)

1. Customer B, item X, cash → the cart, Order Summary and Total all read **₱10,744.67**, not 9,593.46. The summary row says VAT-exempt.
2. Complete it. The receipt shows VAT-Exempt Sales ₱10,744.67 and VAT ₱0.00. The JE has Dr cash and Cr sales of 10,744.67 and no Output VAT.
3. Repeat as **zero-rated** → same price; the receipt shows Zero-Rated Sales.
4. Customer B, installment of item X → the installment account and customer ledger are built on 10,744.67.
5. Tax reports for today → the exempt sale appears at 10,744.67.
6. Refund an exempt sale made **before** this change (if any is on dev) → it refunds what was charged then.

### M6 — Transactions by payment method (items 3, 7)

1. POS → Transactions → Payment method = Cash → only cash sales. Then Card — Straight, Card — Terms, Check, QR.
2. The Payment column shows e.g. "Card — Straight", "QR — Soundpay".
3. From = To = today → today's sales all show, including any rung before 8 a.m.
4. Status = Voided → only voided sales.
5. Open an installment sale whose DP was paid by QR Soundpay → the payment row reads **"Down payment · QR — Soundpay"**.

### M7 — Bank names (item 8)

1. Settings → Payment Methods → Bank Transfer → rename **BDO-Q** to **BDO-Quezon** → saved.
2. Checkout Bank Transfer and Collections bank list → shows BDO-Quezon.
3. An older sale paid to BDO-Q → its detail now reads BDO-Quezon.
4. The Daily Collection Report for a day with a BDO payment → the bank line reads BDO-Quezon and the totals are unchanged.

### M8 — AR Invoices filters (item 9)

1. Accounting → AR Invoices → set From/To → only invoices dated in range, including the To day.
2. Location = this branch → only this branch's. Combine with a customer → both apply.

### M9 — Invoice number everywhere (item 5)

Make one sale with SI **S71-TEST-001**. Each of these must show S71-TEST-001, not POS-…:

1. The POS dashboard Recent Transactions; the transaction detail title (the POS number is muted under it).
2. Request a void → Void Requests. Request a refund → Return/Refund Approvals and the refund JE reference.
3. For an installment sale:
   - AR Invoices "Sale:" (click it, the right sale opens)
   - the installment account heading
   - Aging, Collector, Reminders and Collections calendar
   - Agents (if an agent was set)
4. For a serialized item: Serial history "Sold to …", the Stock ledger and the Reconciliation report.
5. For a charge sale, the new AR invoice number is S71-TEST-001 (or S71-TEST-001-… if taken).
6. The emailed receipt's "Sales Invoice" reads S71-TEST-001.
7. Start another sale and type S71-TEST-001 again → a duplicate warning shows; the sale can still be completed.

### M10 — Already built (items 10, 11): look only

1. Installment Accounts list → the columns are Cat · SI # · Customer / Contact # · Collector · Due Date · MI Due · Outstanding Balance, and the Due Date filter works.
2. Ask the client: did _"add date filter"_ mean due date, or sale date?

### Findings log

| #   | Step | What happened | Expected | Fixed in |
| --- | ---- | ------------- | -------- | -------- |
|     |      |               |          |          |

## Test results

_(Filled as each part finishes: suite, count, baseline count, pass/fail.)_

### Part 1 — `MoneyInput` (item 2), 2026-10-13

**Built.** `src/components/ui/MoneyInput.tsx` (+ `formatMoney`, `sanitizeMoney`). Plain text in and out: it shows `12,345.67` when not focused, the raw figure while focused, rounds to centavos on blur, and hands the parent plain text (`'12345.6'`, or `''` when cleared, so a blank delivery fee stays free). Fields switched, after re-checking the item 2 table against the code:

- Checkout: down payment ×2, X-Deal cash portion, Amount received, split/deposit amount, price override, delivery fee. The checkout money fields are at least 52px tall.
- Sessions: opening cash, loose coin total, declared cash. Cash drawer: amount.
- Collections: payment amount; New Receipt and its edit.
- Daily Collection: coins (form + totals). Undeposited funds: slip amount.
- Credit applications: down payment (financing fields), LCP, PPD rebate.
- POS back office: branch pricing price, gift card value, promo minimum purchase.
- **Added by the re-check (peso inputs under `pos/` the table missed):** promo "Discount Value" when the type is Fixed Amount (a percentage stays plain), and loyalty "₱ … per point".
- **Dropped by the re-check:** service jobs `ServiceJobDetailModal.tsx:294` is the _actual quantity_, not an amount; POS settings "Manager Override Threshold" is a percentage.
- Display fixes: `PriceOverrideDialog` "Currently resolved at", `TransactionSearchCombobox` amount, and the backend emailed receipt (`receipt-notification.service.ts`, every amount).
- Fields that had no accessible name got one (`Opening Cash`, `Declared Cash`, `Amount`, `Initial Value`, `Price`, `Min Purchase Amount`, `Discount Value`, `Payment amount`, `New Unit Price`); the two checkout down-payment inputs keep their placeholder as their name, as before.
- Not reused: `inventory/items/_components/item-form-shared.tsx` `NumericInput` (inventory quantities, no comma display; changing it would touch inventory screens, outside D2).

**New spec `e2e/pos-money-input.spec.ts`: 8/8 pass.** F01, F02, F05, F09 and the edge cases (0.005 → 0.01, 9,999,999.99 fits, clear → blank, `inputmode=decimal`) in one test; F03 + F04 (real clipboard paste of `6,190.00` / `₱6,190`, Chloe's Copy → paste settles the sale, Change ₱7,654.40 on ₱20,000); F06; F07 (a completed cash sale's payment server-action body carries `"amount":12345.6`, no string, no comma; the fixture item is priced ₱12,345.60 because checkout posts only the part of the tender the total needs); F08 on checkout (X-Deal cash portion), back office (New Receipt, gift card, loyalty), and save → reload (a promo saved with minimum purchase 1,234,567.80 reads back the same, then is deleted).
F08 does not save on Sessions, Cash drawer, Collections, Daily Collection, Undeposited funds or Credit applications: each would open a session, post cash or create a record on the shared dev DB. They are in the manual script (M1.4).

**Backend unit:** `receipt-notification.service.spec` 20/20 (its `'1120.00'` assertion is now `'1,120.00'`, the intended change).

**Checks:** FE `tsc --noEmit` clean; ESLint on the 19 changed files 22 warnings = development's 22, `MoneyInput` adds none; Prettier clean. BE `tsc --noEmit` clean; ESLint 1 warning = development's (`sendSms` has no await); Prettier clean.

**Regressions vs baseline (one suite per command):**

| Suite                                         | Baseline                     | After Part 1                 | Verdict                                              |
| --------------------------------------------- | ---------------------------- | ---------------------------- | ---------------------------------------------------- |
| `pos-checkout-delivery`                       | 1 pass · 1 fail · 17 not run | 1 pass · 1 fail · 17 not run | Same (fixture: no `4-02-030` account)                |
| `pos-checkout-x-deal`                         | 13 pass · 1 fail             | 13 pass · 1 fail             | Same test, same line (`:294` "Nothing to collect…")  |
| `pr199-checkout-down-payment`                 | 4 pass                       | 4 pass                       | Pass                                                 |
| `pos-checkout-installment-down-payment-floor` | 1 pass · 2 fail              | 1 pass · 2 fail              | Same (demo item)                                     |
| `pos-checkout-payment-method-options`         | 1 pass · 7 fail              | 1 pass · 7 fail              | Same (demo item)                                     |
| `pos-checkout-reserve-mode`                   | 3 pass                       | 3 pass                       | Pass                                                 |
| `pos-collections-rebate`                      | 1 pass · 1 fail              | 1 pass · 1 fail              | Same (demo item)                                     |
| `pos-collections-same-day-guard`              | 1 pass · 1 fail · 2 not run  | 1 pass · 1 fail · 2 not run  | Same (Counter 1 session clash)                       |
| `undeposited-funds-deposit`                   | 2 pass · 1 fail              | 2 pass · 1 fail              | Same (Counter 1 session clash)                       |
| `cashier-day-baseline`                        | 1 pass · 3 skipped           | 1 pass · 3 skipped           | Pass                                                 |
| `pos-session-list-ux-batch`                   | 2 pass · 2 fail              | 3 pass · 1 fail              | Better; opening-cash "0.00" passes with the new name |
| `credit-application-intake`                   | 2 pass                       | 2 pass                       | Pass                                                 |

**Spec churn (selectors only, no assertion changed):** the field is no longer `type="number"`, so these now find it by name — `pos-checkout-multi-serial-cart`, `pos-checkout-payment-method-options`, `pos-checkout-price-use`, `pos-cross-branch-serial-visibility` (`getByRole('spinbutton')` → `getByLabel('Opening Cash')`), `pos-session-list-ux-batch` (opening cash), `pos-collections-same-day-guard` ×2 and `pos-collections-rebate` (Collections amount → `getByLabel('Amount received')`). `multi-serial-cart`, `price-use` and `cross-branch-serial-visibility` were not run: they open a session on TN-B1-01, which already has one open on the dev DB.
**Follow-up, same day (Kian): commas while typing.** Kian asked for the commas to appear as the cashier types, with no click needed. `MoneyInput` now shows `25,000` while typing `25000` (whole-peso part grouped, the decimals exactly as typed), keeps the caret where the cashier is typing as commas move, and Backspace/Delete on a comma removes the digit beside it. Leaving the field still adds the centavos (`25,000.00`). The three call sites whose `onBlur` read the DOM value (both checkout down-payment inputs, opening cash) now strip commas first (`sanitizeMoney`), or `5,000` would have read as 5. New spec cases: typing `25000` reads `25,000`, typing at the start of `1,234` gives `91,234` then `981,234`, and Backspace after the comma in `1,234` gives `234`. New helper `fillMoneyStable` in `e2e/utils.ts` (fills the plain figure, expects it back with commas), used where specs fill these fields with 1,000 or more (`pos-checkout-delivery`, `pos-checkout-x-deal` ×6, `pos-checkout-installment-down-payment-floor`, `pos-checkout-promissory-note`); `pos-checkout-delivery` DT-F07's pasted value is now `8,000.00`.
Re-run after the change: `pos-money-input` 8/8; `pos-checkout-x-deal` 13 pass · 1 fail (same baseline test and line); `pr199-checkout-down-payment` 4/4; `pos-checkout-reserve-mode` 3/3; `credit-application-intake` 2/2; `pos-session-list-ux-batch` 3 pass · 1 fail (same as before); `cashier-day-baseline` 1 pass · 3 skipped. FE `tsc` and ESLint clean on the changed files.

**Follow-up, same day (Kian): one Total at checkout. ~~Superseded below~~ — reverted.** Scenario 70 (Chloe, `c538dfcc`) put a second "Total" above Amount received, with the Copy button and a second delivery-fee note; on a plain sale it repeated the Order Summary's Total. Kian: two totals is confusing. Decided (Kian took the recommendation): the Order Summary's **Total** is the only total. The second one shows only when the counter collects less than the Total today (an installment's down payment, an X-Deal's cash portion), as a **"Collect now"** line (`checkout-collect-now`) with "The rest of the Total is not paid at this counter today." The **Copy** button moved beside **Amount received** (still `checkout-total-copy`, still copies what is collected now). The delivery-fee note shows once, in the Order Summary. **This reverses part of Chloe's Scenario 70 layout at Kian's request: tell Chloe before this merges.**
Specs: `pos-money-input` checks one Total on a plain sale (`getByText('Total', { exact: true })` count 1, no `checkout-collect-now`, Copy beside Amount received) and "Collect now ₱1,234.50" on an X-Deal with a cash portion. `pos-checkout-delivery` DF-F02 and DT-F06 now assert one Total / one fee note and the order Summary → Delivery → Amount received → CR → Confirm (that suite still stops at its `4-02-030` fixture on the dev DB, so these lines did not run here).
Re-run: `pos-money-input` 8/8; `pos-checkout-x-deal` 13 pass · 1 fail (same baseline test and line); `pr199-checkout-down-payment` 4/4; `pos-checkout-reserve-mode` 3/3; `cashier-day-baseline` 1 pass · 3 skipped. `tsc` clean; ESLint 10 warnings = development's 10.

**Follow-up, same day (Kian): the Total moves down, Copy becomes "Exact amount". ~~Superseded below~~ — reverted.** Kian chose: (1) the one **Total** moves from the bottom of the Order Summary to just **above Delivery** — after VAT treatment, Item Payment Mode and the installment panels, so it is the last thing before the sale is paid (`checkout-total`; the figure keeps `order-summary-total`, the fee note keeps `order-summary-delivery-fee` under it). The Order Summary keeps the item breakdown (lines, Subtotal, Discount, VAT). (2) Scenario 70's **Copy** button is removed (`CopyAmountButton.tsx` deleted) and replaced by an **"Exact amount"** tickbox under Amount received (`exact-amount`): ticking fills the box with what is collected now (the Total, or the "Collect now" figure) and keeps it matched if the cart changes; typing in the box unticks it; unticking empties it; a new or parked sale, or a cart that no longer collects anything, clears it. **Chloe built the Copy button (Scenario 70 DT-F07): tell her before this merges.**
Specs: `pos-money-input` F04 now ticks/unticks Exact amount (fills ₱12,345.60, typing unticks, untick empties, no Copy button) and checks the order Total → Delivery → Amount received; `pos-checkout-delivery` DT-F07 now ticks Exact amount and expects ₱8,000.00 (the fee is not included).
Re-run: `pos-money-input` 8/8; `pos-checkout-x-deal` 13 pass · 1 fail (same baseline test and line); `pr199-checkout-down-payment` 4/4; `pos-checkout-reserve-mode` 3/3; `cashier-day-baseline` 1 pass · 3 skipped. `tsc` clean; ESLint on `checkout/page.tsx` 10 warnings = development's 10.

**Follow-up, same day (Kian): keep Chloe's Scenario 70 block; one Total by dropping the older line.** Kian did not want Chloe's work removed. The two commits above (`6a5d0874`, `8643b3ef`) are reverted: Chloe's block above the payment — **Total / "Total due now", her Copy button, the fee note** — and `CopyAmountButton.tsx` are back **byte-for-byte as on development** (checked with a diff against `32337964`), and the Exact amount tickbox is gone. One Total now comes from removing the **Order Summary's "Total" line** instead: it predates Scenario 70 (Chloe only changed it to leave the fee out). The Order Summary keeps the items, Subtotal, Discount, VAT and its fee note. The checkout page's only other change vs development is the `MoneyInput` fields.
Specs: `pos-money-input` F04 is back to Chloe's Copy → paste and now also checks one Total (`checkout-grand-total` ₱12,345.60, no `order-summary-total`, one "Total" on the page); `pos-checkout-delivery` DF-F02 / DT-F06 read Chloe's `checkout-grand-total` and use the "Order Summary" heading for the panel order (that suite still stops at its `4-02-030` fixture here).
Re-run: `pos-money-input` 8/8; `pos-checkout-x-deal` 13 pass · 1 fail (same baseline test and line); `pr199-checkout-down-payment` 4/4; `pos-checkout-reserve-mode` 3/3; `cashier-day-baseline` 1 pass · 3 skipped. `tsc` clean; ESLint 10 warnings = development's 10.

Not changed: `pos-collections-rebate`'s rebate locator (the rebate became a checkbox before this scenario; that spec already fails at its demo-item setup).

## Next scenario (Kian, 2026-10-13)

The scenario after this one takes these two. Its number is claimed when it starts, after checking open PRs, branches and docs again.

1. **The checkout-wide size pass:** _"POS UI — in fields, increase size"_ for every POS field, not only money ones, together with _"increase font size, avoid color grey, change UI"_.
2. **The multi-item down payment:**
   - one DP field for two or more units / items, with the in-house total exact but editable
   - the rebate summed across items
   - multi-item credit applications with different prices
   - letting the cashier type a DP on a rate-card term, which means recomputing the monthly (D6)

## Not in this scenario

The rest of the 2026-10-07 notes stay in the backlog. Notably:

- **Checkout UI:**
  - FMI date and override
  - removing the rate-card title, cart item total, instructions and quote ID
  - the LCP on the item
  - the out-of-stock pill
- **Labels and fixes:**
  - the employee auto-tag bug
  - Category A for new accounts
  - the MI Due labels
  - "contract ledger" → "customer ledger"
  - the TPF / in-house pill
  - collections "without rebate" → "Due"
  - the totals card and the ledger amounts on the right in the customer profile
- **Elsewhere:** the inventory, AP, accounting and collections-calendar items.
- **Left by the POS-only cut:**
  - commas on New Purchase Request / PO line items, and the PR/PO discount field that can't take centavos (item 2)
  - money inputs in non-POS modules (item 2)
  - the POS number on the main dashboard widgets (item 5)
- **Found, not asked for:** the Transactions list has no pagination.

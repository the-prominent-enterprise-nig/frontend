# Scenario 66 — POS Delivery (Deliver To, Address, Delivery Fee on Its Own Collection Receipt) — Gap Analysis & Closing Plan

**Source**: client feedback relayed by Kian, 2026-10-04:

> **Delivery** — ADD IN POS:
>
> - Deliver to, Delivery Address with delivery fee.
> - Delivery fee will not be included in the total, collection receipt only. Collection receipt for del fee.
> - Delivery fee GL mapping.
> - Separate collection receipt for the downpayment and delivery fee.
>
> **Third Party Financing** — Remove the amount (optional) line in the TPF breakdown.

These are the same notes Scenario 64 triaged on 2026-09-24 as items 3 and 11–14. Item 3 (TPF) shipped there. Items 11–13 were deferred "to a follow-up scenario" because they need a migration and a product decision (`docs/scenario-64-pos-client-feedback-batch-plan.md:187-189`). This is that follow-up.

**Branches**: `feat/scenario-66-pos-delivery-fee` in both repos, cut 2026-10-04 from the Scenario 64 branches. They were fast-forwarded the same day to pick up Scenario 64 item 29 (unit picker on the credit application): backend `4607e6e`, frontend `cd5ac4a1`. They are checked out as separate worktrees (`backend/backend-scenario-66`, `frontend/frontend-scenario-66`) so the Scenario 64 checkouts are never switched underneath other work.

**Status (2026-10-05)**: Parts 0–4 built and tested. Both migrations and `scripts/backfill-scenario-66-delivery-fee-mapping.ts` are applied on dev and test. **Manual test script (`docs/scenario-66-manual-test-script.md`) verified by Kian on dev.** One UI refinement came out of it: the transaction detail shows the delivery address on its own line instead of squeezed beside its label.

**Scenario number**: 66 was free on 2026-10-04 (open PRs, remote branches and `docs/scenario-*` on `origin/development` all checked; highest in use is 65).

## Related ClickUp Tickets

None found yet. Create one once this doc is confirmed.

---

## The scenario we're building toward

1. **Checkout.** The cashier ticks **For delivery**, which reveals the delivery fields:
   - **Deliver to** — pre-filled with the customer's name.
   - **Delivery Address** — the Philippine address picker, pre-filled from the customer's current address.
   - **Delivery fee**.
   - The fee's **tender** and its own **Collection Receipt No.**

   The sale's **Total does not move**. The fee shows on its own line, "collected on its own CR".

2. **Two documents, two numbers.**
   - The **sale** is on the Sales Invoice. Its total never includes the fee.
   - The **delivery fee** is on its own collection receipt.
   - On an installment sale, the **down payment** keeps the payment CR it uses today (Chloe's single CR pool, unchanged). It can never be the same number as the fee's CR.
3. **Accounting.** The fee posts its own journal entry: **Dr** the tender's account (cash → Undeposited Funds) / **Cr `4-02-030 Delivery Income`**, through a new `DELIVERY_FEE_INCOME` mapping. The sale's own journal entries are untouched.
4. **Downstream.**
   - The fee is counted in the cashier's expected closing cash.
   - It appears once, as **DC**, on the Daily Collection Report with the cashier's CR number.
   - It stays out of sales revenue, the down-payment floor, the financed amount, loyalty points, and the customer's A/R ledger.
5. **TPF.** No approved-amount line in the TPF panel. This is already true on this branch; see Part 0.

---

## What's already done ✅

1. **TPF "Approved amount (optional)" is already removed.** Commit `040024a5` (2026-09-24, Scenario 64 Part 2) removed it from `pos/checkout/page.tsx`. `:3369-3373` documents that `tpfApprovedAmount` is deliberately not sent. It is still present on `origin/development` (`page.tsx:5024`) only because PR #199 has not merged; that is why the client still sees it. No other "(optional)" amount exists in any TPF panel (checked: checkout TPF panel `:5477-5526`, TPF down-payment blocks `:5384-5471`, success-screen TPF box `:6982-6997`, `TransactionDetail.tsx`).
2. **The fee columns exist.** `PosTransaction.deliveryFee` (Decimal 15,2, default 0) and `deliveryFeeReferenceNumber` (VarChar 100) are in `backend/prisma/schema.prisma:3639-3643`. They come from migrations `20260831073152_add_pos_transaction_delivery_fee` and `20260901070439_add_pos_transaction_delivery_fee_reference`. Nothing writes them today, and on 2026-10-04 both the dev and test DBs had **0** rows with a fee above 0.
3. **`4-02-030 Delivery Income`** is already in the chart of accounts (`backend/src/accounting/coa-seed/coa-seed.service.ts:519-525`, REVENUE). It has no `mappingKey` yet.
4. **Adding a mapping key needs no migration.** `ensureStandardKeys()` (`account-mapping.service.ts:293-301`) upserts any new `STANDARD_MAPPINGS` key. `seedPH` can pre-point it through `mappingKey` on the COA row. Accounting can re-point it in the UI (`PATCH /account-mapping/:key`). There is a precedent backfill script for live databases: `backend/scripts/backfill-misc-collections-account-mapping.ts`.
5. **Counter collections already reach the drawer and the deposit.** `computeExpectedCash` sums cash `CollectionReceipt`s that carry a `posSessionId` (`backend/src/pos/sessions.service.ts:270-273`). Cash debits `POS_UNDEPOSITED_FUNDS` (`pos-posting.service.ts:111`), which the deposit flow clears. A fee recorded as a session-linked collection receipt is therefore counted and deposited with no new session code.
6. **An in-house down payment already gets its own `CollectionReceipt` row** (`transactions.service.ts:4673-4778`, system number `CR-YYYYMMDD-NNNN`). Its `reference`, the cashier's booklet CR, is copied from the down payment's `PosPayment.referenceNumber` (`:4703-4729`). The backend already keeps a separate receipt per down payment; what's shared is the **number the cashier typed**.
7. **`create()` is one DB transaction**, and installment plans already post inside it so that "a missing account mapping rolls back the sale too" (`transactions.service.ts:1415-1419`). The fee's receipt and journal entry can join that transaction.
8. **The cart snapshot carries the whole DTO** (`release-form-requests.service.ts:71`). Delivery fields on a held installment sale reach `create()` at approval with no extra plumbing.
9. **The Philippine address picker is reusable** (`src/components/common/PhilippineAddressPicker.tsx:26-52`). It takes `initialAddress`, `initialBarangayCode` and `defaultRegionCode`, and `onChange({address, barangayCode})`. It reads its initial values once, so it needs a `key` to re-mount (as `ApplicantContactFields.tsx:318-327` does).

---

## What's not done / gaps ❌⚠️

1. **Nothing at checkout captures delivery.** There is no field in the UI, `CreateTransactionDto` (`backend/src/pos/dto/pos.dto.ts:410-715`), or the frontend `CreateTransactionInput` (`src/schema/pos/index.ts:419-488`). **Deliver to** and **Delivery Address** do not exist as columns anywhere.
2. **The first delivery fee was removed, and it was built the opposite way.** Chloe added it on 2026-08-31 (backend `4dbed16`, frontend `e264f1ea`, released to `main` in #147/#158). That version **added the fee into `totalAmount`** (`subtotal - discountTotal + groupedTaxTotal + deliveryFee`) and credited it to **Sales Revenue**: there was no mapping of its own. It was removed on 2026-09-04 inside two unrelated expenses commits (backend `f049b63`, frontend `08b39218`), described only as "in-progress POS changes already present uncommitted". That is the behaviour the client is now rejecting. Its leftovers are stale comments (`transactions.service.ts:2788-2790`, `pos-posting.service.ts:354-356`, checkout `page.tsx:3568`), and these two readers ⚠️:
   - **Daily Sales Monitoring subtracts the fee from `totalAmount`** (`backend/src/pos/reports/daily-sales-monitoring.service.ts:155-174`, unit spec `…monitoring.service.spec.ts:34-41`). Once the fee lives outside the total, that **understates sales by the fee**.
   - **The Daily Collection Report's DC row is dead code.** It is built from the header (`daily-collection.service.ts:795-814`, `isCash:false`), then filtered out of the cash ledger (`:869`) **and** out of the non-cash block (`:873`). So the client form's DC line (`daily-collection.form-sheet.ts:307`) is always 0.
3. **No `DELIVERY_FEE_INCOME` mapping** and no posting line for the fee.
4. **Nothing stops the fee and the down payment sharing a CR.** In sale mode, checkout tenders the down payment "through this same Total pool — one CR Number" (`page.tsx:1745-1748`). It records the down payment with the payment row's `referenceNumber` (`:3642-3664`), and pure TPF sends the row CRs as `tpfDownPaymentReferenceNumber` (`:3385-3394`). That single pool is Chloe's deliberate design (`787d8577`, 2026-09-02) and **stays as is**. The client's "separate collection receipt for the downpayment and delivery fee" is met by giving the fee its **own** CR, and rejecting a fee CR that matches the payment/down-payment CR (D6).
5. **Recording the fee as a collection receipt has to stay out of AR views.** A fee receipt with no `ARPayment` under it would:
   - be **silently dropped** from the customer history, only because `[].every(isDownPayment)` is `true` (`transactions.service.ts:3236`), while `receiptCount` still counts it, so pagination is off by one;
   - land in Accounting's A/R receipts list (`ar-invoices.service.ts:258+`), which is built for AR payments.

   Neither should rely on accidents. `CollectionReceipt` needs an explicit **purpose**.

6. **Found, pre-existing, not in this scenario (Kian, 2026-10-04):** the Daily Collection Report likely **counts every cash in-house down payment twice**. That's by reading the code; no test covers it. It emits the down payment once from its `PosPayment` (`daily-collection.service.ts:754-793`, kind DP) and again from the down payment's own `CollectionReceipt` (`:645-651` filters on tenant, date, branch and cancelled only; `:817-859`, kind MI or FP). Tracked separately; see "Found along the way".

---

## What's on hand in the app — deep dive (2026-10-04)

Kian asked for a deeper look at what already exists before building. Two read-only sweeps covered both repos: (a) getting a sold unit to the customer, and (b) taking non-sale money at the counter. The short answer: **nothing in the app tracks delivering a sale**, and the money machinery to reuse is `CollectionReceipt`.

**Delivery side: nothing to hang "Deliver to / Delivery Address" on except the sale itself.**

| What exists                                                                        | What it really is                                                                                                                                                                           | Verdict for v1                                                                                                         |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `PosReleaseFormRequest` (`schema.prisma:3818-3840`, `/pos/release-approvals`)      | The manager-approval hold for installment sales. Originally "RFD — Request for Delivery" (`docs/module-scenarios.md:21`), now an approval gate only. No address, date, driver, DR           | Not a delivery record. Its `cartSnapshot` carries new DTO fields to `create()` for free                                |
| `UnitDocumentSheet` release/dispatch (`schema.prisma:8550-8655`, `/inventory/uds`) | Custody of a customer's unit **during repair**; system `DRC-` DR on release to the customer                                                                                                 | Repair only, no sale link. Leave alone                                                                                 |
| `StockTransfer` dispatch (`schema.prisma:5743-5783`)                               | Warehouse → warehouse (incl. caravans): driver, phone, plate, carrier, `dispatchedAt`                                                                                                       | No customer/sale. The pattern to copy if delivery **dispatch** is ever built                                           |
| `Vehicle` (`schema.prisma:403-435`, category `delivery`)                           | A seeded fleet list (~32 delivery rows), read-only lookup used by the transfer-dispatch autocomplete. No trip/usage log                                                                     | Leave alone for v1                                                                                                     |
| `PosTransaction.deliveryReceiptNumber` + Payment Mode **Delivery Receipt** (#198)  | The DTO accepts and `create()` writes the DR number, but **checkout never sends it** (no input has ever existed), so it is always null. The "Delivery Receipt" mode only sets lines to cash | ⚠️ Related but separate. See open question 3. Note: the Scenario 64 doc's "it _is_ already captured" (`:100`) is wrong |
| `CreditApplication.downPaymentCollection` (`online / branch / delivery`)           | A paper-record transcription field. Nothing reads it                                                                                                                                        | Don't merge with the fee. It does show the client sometimes collects a **down payment** on delivery                    |
| `SalesOrder` (`expectedDelivery`, `delivered` status), `Quotation`                 | Orphan schema: no service, controller or UI                                                                                                                                                 | Leave alone                                                                                                            |
| Dashboard "Pending Deliveries" widget                                              | Actually lists SKU reservations; the name is misleading                                                                                                                                     | Leave alone                                                                                                            |
| `Customer.address` + `barangayCode` (current), `homeAddress` + `homeBarangayCode`  | The only customer addresses. Scenario 24 deliberately **removed** `shippingAddress`. POS customer search returns no address; `GET /pos/customers/:id` returns the full row                  | Pre-fill source for Delivery Address. The address lives on the **sale** (D2), so this doesn't reopen Scenario 24       |
| `PhilippineAddressPicker` / `PhAddressText`                                        | Live in CRM, credit application and accounting customers; not used in checkout yet                                                                                                          | Reuse                                                                                                                  |

**Money side: `CollectionReceipt` is the right carrier. The alternatives each miss something essential.**

| Mechanism                                                                       | Why not (or why)                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`CollectionReceipt` + `purpose`** ✅                                          | Already the client's CR: `CR-` system number, `reference` = booklet number, `posSessionId` counted at close, on the Daily Collection Report, Undeposited Funds for cash. In-house down payments already use it. Needs: `purpose`, its own posting, DC classification                |
| Acknowledgement Receipt (`schema.prisma:1087-1156`, POS → New Receipts)         | Closest look-alike (pick-any credit account, prints as "Collection Receipt"), but **no `posSessionId`** (a cash fee would close as an overage), always debits `DEFAULT_CASH` (Cash in Bank, even for drawer cash/card), not on the report, no cancel, `ACK-` numbers, separate page |
| A "Delivery Fee" service item as a cart line (`Item.isService`)                 | Lands **inside** `totalAmount` and VAT, and posts to Sales Revenue because `Item.revenueAccountId` is stored but never read when posting. The opposite of what the client asked                                                                                                     |
| Reviving the header columns alone (`deliveryFee`, `deliveryFeeReferenceNumber`) | No receipt entity: no CR number, session link, cancel or print. Kept as the sale's own copy of the fee and CR; the receipt is the money record                                                                                                                                      |

Other facts that shape the build:

- **No CR booklet/series control or duplicate check exists anywhere.** `reference`, `PosPayment.referenceNumber`, `deliveryFeeReferenceNumber` have no index or check. R6's "the fee CR must differ from the sale's payment CR" is the first CR-number rule in the app, scoped to one sale. A global duplicate-CR check is **not** in this scenario.
- **The Account Mapping screen lists new keys automatically** under "Other mappings" (`AccountMappingPanel.tsx`), so `DELIVERY_FEE_INCOME` needs no frontend work there.
- **There are two CR-number generators** (the shared util and a private copy in `ar-invoices.service.ts:1749`), both read-max-plus-one, and the down-payment path generates its number outside a transaction (`transactions.service.ts:4722`). The fee receipt must use the shared util **with the `$transaction` client**, so the number is taken inside the sale's transaction.
- **Every sale already requires a customer** (`transactions.service.ts:620-628`, refunds exempt). `CollectionReceipt.customerId` is required too, so a delivery-fee receipt always has one.
- **The report's sort treats DC as unreceipted** (`daily-collection.service.ts:468-479`). Once DC carries a CR number, it sorts with the receipted rows.

---

## Decisions

D3, D4, D5 and D6 were confirmed by Kian on 2026-10-04. The others still carry a recommendation, and the tests assume it. Standing constraint from Kian: **nothing Chloe built changes**. That covers the single CR pool, "CR Number required on every payment", and the Delivery Receipt payment mode.

| #   | Decision                                                                                                                                                     | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | What is **Deliver to**? (Scenario 64 open question 3)                                                                                                        | Free-text **recipient name**, pre-filled with the customer's name and editable (a relative or the store may receive it).                                                                                                                                                                                                                                                                                                       |
| D2  | Where does **Delivery Address** come from?                                                                                                                   | A **point-in-time copy on the sale**, pre-filled from the customer's current address (`Customer.address` + `barangayCode`) through the PH address picker, editable. It **never writes back** to the customer.                                                                                                                                                                                                                  |
| D3  | **When is the fee collected?**                                                                                                                               | ✅ **Kian, 2026-10-04: at the sale, at the counter.** Not on delivery. (The Daily Collection Report's "collected on delivery" comment at `:795-796` is from the first version and goes.)                                                                                                                                                                                                                                       |
| D4  | Journal entry and VAT                                                                                                                                        | ✅ **Kian, 2026-10-04: no VAT.** **Dr** the tender's account (cash → `POS_UNDEPOSITED_FUNDS`, card → `POS_CARD`, bank transfer → `POS_BANK_TRANSFER`, QR → `POS_EWALLET`) / **Cr `DELIVERY_FEE_INCOME` → `4-02-030 Delivery Income`**, the whole fee.                                                                                                                                                                          |
| D5  | **Cashier installment sales go to manager approval** and checkout stops before any payment (`transactions.controller.ts:160-182`). When is the fee recorded? | ✅ **Kian, 2026-10-04: when the sale is made, like any counter sale.** Nothing is recorded at submit. The fee fields travel in the cart snapshot, and the receipt + journal entry are written inside `create()` when the manager approves. One code path for both routes. **Reject or cancel → nothing to reverse.** Known limit: if the cashier's session closed before approval, that close did not count the fee (see R12). |
| D6  | What does "separate collection receipt for the downpayment and delivery fee" require?                                                                        | ✅ **Kian, 2026-10-04: the literal reading.** The down payment and the delivery fee are on separate CRs **from each other**. The fee has its own CR input, and a fee CR equal to the sale's payment CR (which the down payment shares) is rejected. The down payment is **not** split from the sale's own CR: Chloe's single pool (`787d8577`) is untouched.                                                                   |
| D7  | Void, return, refund                                                                                                                                         | **Void** cancels the fee receipt and reverses its journal entry with the sale. **Return/refund leaves the fee alone**, since the delivery service was rendered. Refunding a fee is a manual accounting action for now.                                                                                                                                                                                                         |
| D8  | Where the fee is visible                                                                                                                                     | Success screen, transaction detail, Daily Collection Report (DC), session close, GL. **Not** the customer's A/R history or the A/R receipts list, because it is not A/R. **Not** on the Sales Invoice or POS receipt total.                                                                                                                                                                                                    |
| D9  | Offline checkout                                                                                                                                             | **Block delivery while offline**. The offline queue drops sale-level fields, the same reason Scenario 65 blocks X-Deal offline (S65 R7).                                                                                                                                                                                                                                                                                       |
| D10 | Payment Mode **Delivery Receipt** (`page.tsx:5148-5171`, a paper DR number that behaves as cash)                                                             | **Independent** of the new Delivery panel; it does not auto-tick For delivery. ❓ Ask the client whether picking it should.                                                                                                                                                                                                                                                                                                    |

---

## Closing the gaps — proposed parts

Each part is one reviewable commit (or a small group of them), in dependency order. Tests ship **with** their part; Part 5 is the full list. The two migrations are listed under Part 1 and Part 2 so Kian can apply them himself; nothing here runs `migrate deploy`/`dev`.

### Part 0 — TPF approved-amount line (no build)

Already gone on this branch (`040024a5`); it reaches the client when PR #199 merges. Add a Playwright regression check (DF-F13) so it cannot come back, and reply to the client that it rides #199.

### Part 1 — Backend: delivery details on the sale

- **Migration `20261004120000_scenario_66_delivery_details`** (additive, nullable). On `pos_transactions`:
  - `deliverTo VARCHAR(255)`, the width of `Customer.name`
  - `deliveryAddress VARCHAR(1000)`, the width of `Customer.address`, so a pre-filled address always fits
  - `deliveryBarangayCode VARCHAR(20)`, like `Customer.barangayCode` (PSGC codes are 9 digits)

  "For delivery" is derived: `deliverTo IS NOT NULL`. Kian applies it.

- `CreateTransactionDto`:
  - `deliverTo?`, `deliveryAddress?`, `deliveryBarangayCode?`
  - `deliveryFee?` (≥ 0, 2 dp)
  - `deliveryFeeMethod?` (`cash | card | bank_transfer | qr`), `deliveryFeeReferenceNumber?`
- Validation runs in `validateAndPrepare` (so the approval path is checked at submit too); see rules R1–R5 and R8 (R6 needs payments, so it's Part 2). Nothing is written on a 400. The rules live in a pure helper, `src/pos/delivery-fields.util.ts` (`prepareDeliveryFields`).
- `create()` writes the delivery columns plus the fee and its CR number. `totalAmount` stays `subtotal − discount + tax` (`:1148`, unchanged). The fee's **tender** has no column; it lands on the fee's collection receipt in Part 2.

**Built 2026-10-04** (uncommitted, backend worktree):

- unit: `delivery-fields.util.spec.ts`, 55/55; full unit suite 879/879; `tsc --noEmit` clean.
- e2e: `test/pos-delivery-fee-checkout.e2e-spec.ts` (DF-S01/S02/S03/S14 and DF-A01/A02/A07, the Part 1 slices): **17/17** against the test DB, after Kian approved applying the migration there (dev DB not yet).
- Regression: `pos.smoke` (18 failing) and `pos-tpf-installment` (TPF-06, TPF-11 failing) fail on **exactly the same tests** on the untouched base `4607e6e`. That's pre-existing, not Part 1.

### Part 2 — Backend: the fee's collection receipt and journal entry

- **Migration `…_scenario_66_delivery_fee_receipt`**:
  - enum `CollectionReceiptPurpose { AR_COLLECTION, DELIVERY_FEE }`
  - `collection_receipts.purpose` NOT NULL DEFAULT `AR_COLLECTION`
  - `pos_transactions.deliveryFeeCollectionReceiptId` (unique FK)

  No release-request column: under D5 nothing is recorded before the sale exists. Existing receipts all become `AR_COLLECTION` by the default; the down-payment path is not touched.

- **Mapping**:
  - `DELIVERY_FEE_INCOME` added to `MAPPING_KEYS` + `STANDARD_MAPPINGS`
  - `mappingKey: 'DELIVERY_FEE_INCOME'` on COA `4-02-030`
  - `scripts/backfill-scenario-66-delivery-fee-mapping.ts` for live DBs. It points the key at `4-02-030` **only if unmapped**, following the misc-collections precedent.
- **Recording, one path for both routes (D5):** inside `create()`'s `$transaction`, when `deliveryFee > 0`:
  - one `CollectionReceipt` with:
    - `purpose DELIVERY_FEE`
    - `number` from the shared `nextCollectionReceiptNumber(tenantId, tx, date)`, **with the transaction client**; `reference` = the cashier's CR
    - `method`, `posSessionId` = the sale's session, `paymentDate` = the sale's `occurredAt`
    - `branchId`, `customerId`, `amount`, `notes "Delivery fee - <TX#>"`
  - plus its journal entry (pure builder `buildDeliveryFeeJELines`, Cash Receipts journal).
  - The mapping is checked **before** anything is written (R10).
  - A counter sale runs this at checkout. A held cashier installment sale runs it when `approve()` calls `create()` from the snapshot. `submit()` only validates (R1–R6 via `validateAndPrepare`). Reject, cancel and expire need no change.
- **Fee CR ≠ payment CR (D6, R6):** comparison is trimmed and case-insensitive.
  - `addPayment` rejects a payment whose `referenceNumber` equals the sale's fee CR. That covers the down payment too, since it shares the payment row's CR.
  - At create, pure TPF's `tpfDownPaymentReferenceNumber` must not equal the fee CR.
  - Nothing else about payments changes.
- **Void:** `voidTransaction` / `approveVoidRequest` / `finalizeVoidApproval` cancel the fee receipt and reverse its journal entry (D7). Return/refund leave it alone.
- ~~Clean up the three stale comments from the first version.~~ Already gone on this base; nothing to clean.

**Built 2026-10-04** (uncommitted, backend worktree):

- Migration `20261004130000_scenario_66_delivery_fee_receipt` adds the enum, `collection_receipts.purpose` (default `AR_COLLECTION`) and `pos_transactions.deliveryFeeCollectionReceiptId` (unique, `ON DELETE SET NULL`).
- `DELIVERY_FEE_INCOME`:
  - in `MAPPING_KEYS` and `STANDARD_MAPPINGS` (it shows up in Settings → Account Mapping on its own);
  - COA `4-02-030` tagged with it;
  - `scripts/backfill-scenario-66-delivery-fee-mapping.ts` maps it to `4-02-030` only if unmapped.
- `PosPostingService.resolveDeliveryFeeAccounts` is called in `validateAndPrepare` (R10), so a held sale is checked at submit and again at approval.
- `TransactionsService.recordDeliveryFee` runs inside `create()`'s `$transaction`. It takes the CR number with the transaction's own client.
- `voidDeliveryFee` is wired into all three void paths. It cancels the receipt and reverses its entry in one transaction, and logs on failure (never throws), like `reverseVoidJE`.
- R6 is checked in `addPayment` and in `validateAndPrepare` (pure-TPF down-payment CR).
- Unit: 901/901, including new DF-U02/U03 (`delivery-fields.util.spec.ts`), DF-U04 (`pos-posting.service.spec.ts`), and `return-refund-requests.service.spec.ts` asserting a void calls `voidDeliveryFee` and a lost race doesn't. `tsc` clean.
- e2e: the Part 2 cases are added to `test/pos-delivery-fee-checkout.e2e-spec.ts` (DF-S01/S02 extended, DF-S04/S05/S06/S10/S11/S12, DF-A01/A02 extended, DF-A03, DF-A08). **27/27** against the test DB, after Kian approved applying the migration there (dev DB not yet). DF-S13 (refund leaves the fee) is covered by reading: no refund path calls `voidDeliveryFee`.
- Regression: these pass:
  - `closing-session-record` 19/19
  - `coa-seed` 2/2
  - `accounting-audit-log-account-mapping` 2/2
  - `accounting-audit-log-pos-cancellation-void-refund` 9/9
  - `pos-return-refund-request` 6/6

  `pos.smoke` and `pos-tpf-installment` fail on exactly the same tests as the untouched base, which is pre-existing.

- Note for Part 4: the close screen's `totalCollectionsCash` ("counter collections") now includes cash delivery fees, since they are session-linked cash receipts. The label may want to say so.

### Part 3 — Backend: every reader agrees the fee is outside the total

- **Daily Collection Report:**
  - remove the header-built DC row (`:795-814`) and its `kind !== 'DC'` filter (`:873`);
  - classify `purpose = DELIVERY_FEE` receipts as **DC** in the receipts loop, with `crNumber` = the cashier's `reference`;
  - cash → ledger and `byKind.DC`; non-cash → the non-cash block by tender;
  - cancelled → `cancelledReceiptRows` (`:1059`) as any receipt;
  - drop the "DC is unreceipted" special case in `byFormOrder` (`:468-479`), since DC now carries a CR number. The CR goes in the OFFICE column (a counter collection).
- **Daily Sales Monitoring:** `invoiced = totalAmount` when the sale has a fee receipt. Subtract `deliveryFee` only for **legacy** rows (fee > 0, no receipt link: the 4 days the first version was live, if production has any). Update the unit spec.
- **Customer history (`getCustomerHistoryWithPayments`) and A/R receipts list (`findAllReceipts`):** filter `purpose != DELIVERY_FEE` in the **where** clause, so the count and the items agree.
- **POS receipt (`getReceipt`, `:5129`) and transaction detail payload:** add the delivery block (deliver to, address, fee, CR#). The total stays the sale total.
- **Sales report:** revenue is from line totals (neutral). Keep `meta.deliveryFees`; confirm voided sales are excluded.

**Built 2026-10-04** (uncommitted, backend worktree):

- **Daily Collection Report.**
  - The header-built DC row and the `kind !== 'DC'` non-cash filter are gone.
  - `DELIVERY_FEE` receipts become DC rows in the receipts loop. Each carries the sale's invoice no. and, as its CR, the cashier's booklet number (`reference`), as the old DC line did. MI rows still show the system number.
  - The "DC is unreceipted" sort exception is dropped.
  - Cancelled fee receipts print as cancelled **DC** rows (they used to print as MI) under the same booklet number.
  - The doc comment is rewritten.
- **Daily Sales Monitoring:** `allocateInvoiceTotal` subtracts the fee only on a legacy row (fee with no `deliveryFeeCollectionReceiptId`).
- **Customer history** (`customerReceiptsWhere`) and **A/R receipts list** (`findAllReceipts`) filter `purpose: AR_COLLECTION`, so items and totals agree.
- **`findOne` and `getReceipt`** include `deliveryFeeCollectionReceipt` (number, reference, method, amount, cancelledAt) beside the delivery columns.
- **Sales report** already excludes voided sales (`status: { not: voided }`), so it needs no change.
- **Tests:**
  - unit: DF-U05 in `daily-sales-monitoring.service.spec.ts`; full suite 902/902.
  - DF-U06/U07 moved to e2e: the report's `build()` has no unit harness, only the pure `settlesAccount`. It's covered by **`test/pos-delivery-fee-reports.e2e-spec.ts` 8/8** (DF-R01–R04, R06–R08 against a real closed branch-8 day).
  - Regression, all green: `pos-delivery-fee-checkout` 27/27, `closing-session-record` 19/19, `customer-history-pagination` 6/6, `ar-collection-receipts-list` 6/6, `ar-collection-receipt-edit-cancel` 6/6, `sales-reports` 18/18.
  - Identical to the untouched base, so pre-existing: `daily-sales-monitoring` (1 failing), `customer-history-with-payments` (2), `ar-collection-receipt-document` (1), `collections-bulk-payment` (3).

### Part 4 — Frontend: checkout, success screen, detail

- **Delivery section** in `pos/checkout/page.tsx`, sale mode only, right after **Sales Invoice No.** (`~:4546`, before Order Summary). It's the per-sale header area, and it keeps the fee visibly away from Total. Contents:
  - a **For delivery** toggle;
  - Deliver to (pre-filled from the customer, D1);
  - `PhilippineAddressPicker` keyed by customer (pre-filled via `GET /pos/customers/:id`, which returns the full CRM customer, D2);
  - Delivery fee;
  - fee tender (`Select`, compact) and **Delivery fee CR No.** (both shown only when fee > 0).

  Re-pick a customer → re-pre-fill only the fields the cashier hasn't edited.

- **Totals:** Order Summary **Total** and Payment **Total** unchanged. A separate line reads "Delivery fee ₱X — collected on its own CR (not part of the sale total)". The fee is **not** added to `tenderTarget`, so change, loyalty and the down-payment split are untouched (R7).
- **CR inputs (D6):** the payment block's **CR Number** stays exactly as Chloe built it: one pool, required on every payment, shared by the down payment. The only new CR input is the **Delivery fee CR No.** inside the Delivery section. Confirm is blocked inline if it equals the payment CR, and the backend rejects it too.
- **Validation** mirrors R1–R6 with inline errors. The fee CR is required only when fee > 0.
- **Payload**: `src/schema/pos/index.ts` `CreateTransactionInput` gains the six fields. `generated.ts` is not imported anywhere, so there's nothing to regenerate.
- **Offline (D9):** the toggle is disabled with "Delivery needs a connection". Turning delivery off clears and never sends the fields.
- **Held for approval (cashier installment):** the pending message adds "Delivery fee ₱X on CR# … is recorded when the sale is approved" (D5). Nothing is posted at submit.
- **Success screen** (`SuccessScreen`, `:6803+`): a Delivery block (Deliver to, address, fee, CR#) beside Sales Invoice No. / Delivery Receipt No., outside **Paid now** and **Sale total**, so `paidNow`/`notCollectedHere` (`:6887-6889`) stay correct.
- **Transaction detail** (`pos/_components/TransactionDetail.tsx:283-285`): Deliver to / Delivery address / Delivery fee + CR rows. `PosTransaction` type (`schema/pos/index.ts:278-332`) gains the fields.
- Delete the stale "cash/TPF + delivery fee" comment (`:3568`).

**Built 2026-10-04** (uncommitted, frontend worktree):

- **New `checkout/_utils/delivery.ts`.** State, address resolution, `parseDeliveryFee`, `sameCrNumber`, `deliveryProblem` (mirrors backend R1–R6), and `deliveryPayload` (sends nothing at all when delivery is off).
- **New `checkout/_components/DeliverySection.tsx`.**
  - The customer's address shows pre-filled with **Change address**, which opens the PH picker; **Use the customer's address** switches back.
  - With no address on file, the picker opens directly.
  - The picker remounts only on an explicit `pickerKey` bump. Keying it on the address source would have wiped a pick the moment it was made.
- **`page.tsx`.**
  - New state and a pre-fill effect: Deliver to follows the customer until edited; the address comes from `getCustomerById`, since search results carry none.
  - The section renders after Sales Invoice No.
  - The fee line sits under the Order Summary Total and under the Payment Total, never added to either.
  - Confirm validation runs after Sales Invoice No.
  - Delivery is blocked offline and on a sale resumed from a table tab (it already exists).
  - Payload spread, pending-approval note, success-screen Delivery block, reset, stale comment fixed. `data-testid="order-summary-total"` added.
- **`TransactionDetail.tsx`:** a Delivery block after Payments, showing a cancelled fee CR as "(cancelled)".
- **`schema/pos/index.ts`:** types.
- **`sessions/page.tsx`:** "Installment collections (cash)" → **"Counter collections (cash)"**, help text naming delivery fees. Written by Karms (Scenario 53), not Chloe, and made inaccurate by this scenario.
- **Checks:** `tsc` clean. ESLint: no new warnings (the page's existing ones are untouched). Diffs are additive apart from the stale comment and the Total span.
- **Playwright:** `e2e/pos-checkout-delivery.spec.ts` covers DF-F01–F08, F12, F13, F15. **11/11**, run 2026-10-04 against this branch's own servers (backend on the test DB at :3011, frontend at :3010). DF-F07 first failed on a "Clear customer" button that only the Scenario 65 branch names. The spec now finds the selected customer's icon-only ✕ instead: that button is Chloe's, so it was left unlabelled. Not in Playwright, and why:
  - DF-F09/F10/F11 (mixed and installment carts): they need credit-application and financing fixtures. The same CR rule is DF-F04 plus backend DF-S08/S10.
  - DF-F14 (cashier pending screen): needs a cashier-owned session. Covered by backend DF-A01 and manual M11.
  - Checkout posts through Next server actions, so the spec checks "nothing posted" through the API by Sales Invoice No., not a request listener.
- **Playwright regression** (same servers):
  - `pos-checkout-reserve-mode` 3/3: delivery stays out of reserve mode.
  - `pos-checkout-si-dr-numbers` fails at its own fixture (`sessionId must be a UUID`: its session helper returns no id).
  - `pos-checkout-payment-method-options` and `pos-transaction-detail-invoices` need demo items the seed deletes.
  - `pos-checkout-selling-agent` "populated" fails **3/3 on the untouched base too**. The test clicks the picker about 450–600 ms before React attaches its handlers (measured on both), so the click never opens it. One early base pass was a fluke. None of these is caused by Scenario 66.

### Part 5 — Tests

Listed in full below.

---

## Part 5 — Tests

Each case has an ID so the PR, the manual script and the reviewer can point at it.

### Rules the edge cases pin down

| #   | Situation                                                                                                                                | Rule                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Any delivery field (address, fee, method, CR) sent without `deliverTo`                                                                   | **400**: no stray delivery data on a normal sale                                                                                                                                                                                                 |
| R2  | For delivery with blank or whitespace Deliver to / Delivery Address, or over-long values (255 / 1000; barangay code 20)                  | **400**                                                                                                                                                                                                                                          |
| R3  | Fee negative, more than 2 decimals, non-numeric, or beyond Decimal(15,2)                                                                 | **400**                                                                                                                                                                                                                                          |
| R4  | Fee = 0 (free delivery)                                                                                                                  | Details saved; **no** receipt, **no** journal entry. A CR or method sent with fee 0 → **400**                                                                                                                                                    |
| R5  | Fee > 0 without a CR (blank, whitespace, > 100 chars) or without a method, or with a method outside `cash, card, bank_transfer, qr`      | **400**                                                                                                                                                                                                                                          |
| R6  | Fee CR = the sale's payment CR (which the down payment shares) or pure TPF's `tpfDownPaymentReferenceNumber` (trimmed, case-insensitive) | **400**. The sale and its down payment sharing one CR is unchanged (Chloe's pool)                                                                                                                                                                |
| R7  | The fee and the money math                                                                                                               | Never in `totalAmount`, `subtotal`, lines, down-payment floor, financed amount, TPF financed amount, tender target, change, loyalty, promo base, Sales Invoice                                                                                   |
| R8  | Delivery fields on a refund                                                                                                              | **400**                                                                                                                                                                                                                                          |
| R9  | Offline                                                                                                                                  | Delivery blocked in the UI                                                                                                                                                                                                                       |
| R10 | `DELIVERY_FEE_INCOME` unmapped                                                                                                           | **400** naming the mapping, **before** anything is written (no sale, no stock move)                                                                                                                                                              |
| R11 | Fee receipt/journal entry fails on the direct path                                                                                       | Rolls back the whole sale (same `$transaction`)                                                                                                                                                                                                  |
| R12 | Approval path (D5)                                                                                                                       | Validated at submit, **recorded at approval** inside `create()`, on the sale's (cashier's) session. Reject/cancel/expire: nothing recorded, nothing to reverse. Known limit: approval after that session closed → the close didn't count the fee |
| R13 | Void / return / refund                                                                                                                   | Void cancels + reverses the fee; return/refund leave it                                                                                                                                                                                          |
| R14 | Session close                                                                                                                            | Cash fee counted in expected cash; non-cash fee not                                                                                                                                                                                              |
| R15 | Daily Collection Report                                                                                                                  | The fee appears **once**, as DC, with the cashier's CR                                                                                                                                                                                           |
| R16 | Daily Sales Monitoring on a legacy row (fee > 0, no receipt)                                                                             | Still subtracts, so old figures don't move                                                                                                                                                                                                       |

### Test fixtures and how to run

- **Backend e2e** follows `test/pos-x-deal-checkout.e2e-spec.ts` (on `feat/scenario-65-x-deal-transaction`; copy its helpers) and `test/pos-tpf-installment.e2e-spec.ts`:
  - `signDevJwt` auth, with **owner** `technova.owner@test.com` (override, direct path) and **cashier `technova.b7.cashier@test.com`** (branch 7 is unused by other specs; approval path);
  - own customer with a `S66-` prefix, item upserted and stock written directly (the seed stocks nothing financeable), own session on `TN-B7-01`;
  - `DELIVERY_FEE_INCOME` mapped in `beforeAll` if missing;
  - `afterAll` deletes from the customer IDs outward (receipts, AR payments, journal entries first).
- The worktree has no `.env.test` or `node_modules`. Before the first run, copy `.env.test` from `backend/backend` and install deps (or link `node_modules`).
- Run **one suite at a time**: `DOTENV_CONFIG_PATH=.env.test npx jest --config ./test/jest-e2e.json --runInBand --testPathPatterns <name>`. `pretest:e2e` resets the test DB, so ask first. Ask before starting dev servers or Playwright (laptop stability).
- **Frontend**: Playwright only (no unit runner). Copy the X-Deal spec's API-built fixtures and `pr199-checkout-down-payment.spec.ts`'s term picker (`openCustomSelect`).

### Backend unit

| ID     | Where                                    | Case                                                                           | Expected                                                                                                                                  |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| DF-U01 | `src/pos/delivery-fee.util.spec.ts`      | `assertDeliveryFields` table: each R1–R5, R8 input                             | Throws the expected message; valid inputs pass and are trimmed                                                                            |
| DF-U02 | same                                     | `sameCr` / R6: `" CR-1 "` vs `"cr-1"`, empty vs empty, null                    | Equal when trimmed case-insensitive; blanks never "collide"                                                                               |
| DF-U03 | `src/pos/pos-posting.service.spec.ts`    | `buildDeliveryFeeJELines(150, cash/card/bank_transfer/qr)`                     | Dr the method's mapped account 150 / Cr `DELIVERY_FEE_INCOME` 150; balanced; centavos exact (e.g. 99.99)                                  |
| DF-U04 | same                                     | Unmapped `DELIVERY_FEE_INCOME`                                                 | Throws before returning lines                                                                                                             |
| DF-U05 | `daily-sales-monitoring.service.spec.ts` | `allocateInvoiceTotal`: new sale (fee receipt) vs legacy row (fee, no receipt) | New: invoiced = total; legacy: total − fee (existing "1150 − 150" case kept, relabelled legacy)                                           |
| DF-U06 | `daily-collection.service.spec.ts`       | Receipt rows: cash fee, card fee, cancelled fee, ordinary MI receipt           | Cash → DC in ledger; card → non-cash under `card`; cancelled → cancelled rows; MI unchanged                                               |
| DF-U07 | same                                     | Sale with a fee on the header **and** its receipt                              | Exactly one DC row (the header row is gone)                                                                                               |
| DF-U08 | `transactions.service.spec.ts`           | Customer history with a `DELIVERY_FEE` receipt                                 | Not in items; `total` excludes it (count and items agree)                                                                                 |
| DF-U09 | same                                     | `addPayment` fee-CR guard (R6), incl. `" s66-df-1 "` vs `S66-DF-1`             | 400 when the payment CR equals the fee CR; distinct passes; sale + down-payment portions sharing one payment CR still pass (Chloe's pool) |

### Backend e2e — the sale — `test/pos-delivery-fee-checkout.e2e-spec.ts` (owner, direct path)

| ID     | Case                                                                                                                     | Expected                                                                                                                                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DF-S01 | Cash sale ₱5,000 + delivery, fee ₱150 cash, CR `S66-DF-1`; then the sale payment with CR `S66-SI-1`                      | 201. Header has deliverTo/address/barangay/fee/CR. `totalAmount` = 5,000. One `DELIVERY_FEE` receipt: reference `S66-DF-1`, amount 150, `posSessionId` set, linked from the sale. Fee journal entry: Dr `POS_UNDEPOSITED_FUNDS` 150 / Cr `4-02-030` 150, balanced. Sale journal entry: revenue + VAT = 5,000 (no fee in it) |
| DF-S02 | Free delivery (fee 0)                                                                                                    | 201; details saved; no receipt, no fee journal entry, `deliveryFeeCollectionReceiptId` null                                                                                                                                                                                                                                 |
| DF-S03 | Each R1–R5, R8 payload (table-driven)                                                                                    | 400 with the rule's message; **no** transaction, receipt or journal entry; stock and serials unchanged                                                                                                                                                                                                                      |
| DF-S04 | Sale payment reusing the fee CR (`S66-DF-1`, also `" s66-df-1 "`)                                                        | 400; no payment written; sale journal entry not posted                                                                                                                                                                                                                                                                      |
| DF-S05 | `DELIVERY_FEE_INCOME` unmapped (cleared in the test, restored after)                                                     | 400 naming the mapping; nothing written (R10)                                                                                                                                                                                                                                                                               |
| DF-S06 | Fee by card / bank transfer / QR                                                                                         | Dr `POS_CARD` / `POS_BANK_TRANSFER` / `POS_EWALLET` respectively                                                                                                                                                                                                                                                            |
| DF-S07 | In-house installment (owner) + down payment + fee: payment CR `S66-PAY-1` ≠ fee CR `S66-DF-2`                            | 201. The down payment's `CollectionReceipt.reference` = `S66-PAY-1` (as today, purpose `AR_COLLECTION`); the fee receipt is separate; installment plan, financed amount and down-payment floor identical to the same sale without delivery                                                                                  |
| DF-S08 | Same, but payment CR = fee CR                                                                                            | 400 at the down-payment `addPayment`                                                                                                                                                                                                                                                                                        |
| DF-S09 | Mixed cart (cash line + in-house line) + fee: **one** payment CR for the cash part and the down payment, fee CR distinct | 201. Both payments accepted with the shared CR, as today (Chloe's pool is unchanged); the fee receipt is separate                                                                                                                                                                                                           |
| DF-S10 | Pure TPF + down payment + fee; `tpfDownPaymentReferenceNumber` = fee CR, then distinct                                   | 400, then 201. TPF sale journal entry excludes the fee; the fee journal entry is separate                                                                                                                                                                                                                                   |
| DF-S11 | Session close after DF-S01 (cash fee) and DF-S06 (card fee)                                                              | Expected cash includes the 150 cash fee only; counting exactly that closes with no variance                                                                                                                                                                                                                                 |
| DF-S12 | Void the DF-S01 sale                                                                                                     | Fee receipt `cancelledAt` set with a reason; a reversing journal entry posted; sale journal entry reversed as before                                                                                                                                                                                                        |
| DF-S13 | Full return/refund of a delivered sale                                                                                   | Refund behaves as today; the fee receipt and journal entry are untouched (D7)                                                                                                                                                                                                                                               |
| DF-S14 | Regression: a sale with no delivery fields                                                                               | Byte-for-byte the same header, journal entries and payments as before                                                                                                                                                                                                                                                       |

### Backend e2e — approval path — `test/pos-delivery-fee-approval.e2e-spec.ts` (cashier b7 + owner)

| ID     | Case                                                                  | Expected                                                                                                                                                  |
| ------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DF-A01 | Cashier submits an in-house installment sale with a ₱200 cash fee     | `pending_approval`; the snapshot carries the delivery fields. **No** `DELIVERY_FEE` receipt, **no** fee journal entry yet                                 |
| DF-A02 | Owner approves DF-A01                                                 | Sale created with the delivery fields; exactly one `DELIVERY_FEE` receipt (on the cashier's session, `paymentDate` = sale time) and one fee journal entry |
| DF-A03 | Owner rejects a second such request                                   | No receipt, no journal entry, ever; serials released as today                                                                                             |
| DF-A04 | Cashier cancels their own pending request; and a request that expires | Same as DF-A03                                                                                                                                            |
| DF-A05 | Approve after the cashier's session has closed                        | Sale and fee still recorded (on that session, as the sale itself is); the documented limit: that close's expected cash did not include the fee            |
| DF-A06 | Cashier **cash** sale with delivery                                   | Direct path (no hold), same outcome as DF-S01                                                                                                             |
| DF-A07 | Cashier submit with an R1–R6 violation                                | 400 at submit; no request                                                                                                                                 |
| DF-A08 | `DELIVERY_FEE_INCOME` unmapped **between** submit and approve         | Approve fails with the R10 400; request stays pending, no sale, no receipt; approving again after mapping works                                           |

### Backend e2e — readers — `test/pos-delivery-fee-reports.e2e-spec.ts`

| ID     | Case                                                           | Expected                                                                                   |
| ------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| DF-R01 | Daily Collection Report for the day of DF-S01 (session closed) | One DC row: amount 150, CR `S66-DF-1`, in the cash ledger; `byKind.DC` = 150, counted once |
| DF-R02 | Same report with the card fee (DF-S06)                         | Under the non-cash `card` tender; not in the ledger                                        |
| DF-R03 | After the DF-S12 void                                          | The fee shows in cancelled rows, not in totals                                             |
| DF-R04 | Daily Sales Monitoring for the DF-S01 sale                     | Invoiced = 5,000 (fee not subtracted)                                                      |
| DF-R05 | Sales report                                                   | Revenue unchanged by fees; `meta.deliveryFees` = sum of non-voided fees                    |
| DF-R06 | `GET` customer history for the S66 customer                    | No fee row; `total` matches the items                                                      |
| DF-R07 | `GET /ar-invoices/receipts`                                    | No `DELIVERY_FEE` receipt listed                                                           |
| DF-R08 | `GET` POS receipt / transaction detail for DF-S01              | Delivery block present; total = 5,000                                                      |

### Frontend Playwright — `e2e/pos-checkout-delivery.spec.ts`

| ID     | Case                                                                     | Expected                                                                                                                                 |
| ------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| DF-F01 | Pick a customer that has an address, tick **For delivery**               | Deliver to = customer name; address picker shows the customer's address; fee empty; tender + fee CR hidden until fee > 0                 |
| DF-F02 | Type fee 150                                                             | Order Summary Total and Payment Total **unchanged**; separate "Delivery fee ₱150.00 — collected on its own CR" line appears              |
| DF-F03 | Confirm with blank Deliver to / blank address / fee > 0 and blank fee CR | Blocked with an inline error each; `POST /pos/transactions` never sent (request listener)                                                |
| DF-F04 | Fee CR = the payment block's CR Number                                   | Blocked inline; nothing posted                                                                                                           |
| DF-F05 | Happy cash sale with fee                                                 | Request carries the six fields, `totalAmount` excludes the fee; success screen shows the Delivery block apart from Paid now / Sale total |
| DF-F06 | Free delivery (fee 0)                                                    | No fee CR asked; success shows "Free delivery"                                                                                           |
| DF-F07 | Edit Deliver to, then change customer                                    | Edited Deliver to kept; untouched address re-pre-filled                                                                                  |
| DF-F08 | Untick For delivery after filling it                                     | Fields cleared; request has no delivery fields                                                                                           |
| DF-F09 | Mixed cart (cash + in-house) with delivery                               | Payment block unchanged: one **CR Number**, required, used for the cash part and the down payment as today; only the fee CR is new       |
| DF-F10 | Payment block regression, with and without delivery                      | CR Number label, "required on every payment" and the request payloads are identical to the base branch                                   |
| DF-F11 | Pure TPF cart with delivery                                              | `tpfDownPaymentReferenceNumber` sent exactly as today; a fee CR equal to it is blocked inline                                            |
| DF-F12 | Offline (`context.setOffline(true)`)                                     | For delivery disabled with the reason                                                                                                    |
| DF-F13 | TPF panel                                                                | No "Approved amount" input (Part 0 regression)                                                                                           |
| DF-F14 | Cashier installment + delivery (b1 cashier)                              | Pending message names the fee and its CR, "recorded when the sale is approved"; no fee posted yet                                        |
| DF-F15 | Transaction detail of the DF-F05 sale                                    | Deliver to / Delivery address / Delivery fee + CR rows                                                                                   |

### Regression — must still pass

- **Backend:**
  - `pos.smoke`, `pos-tpf-installment`, `pos-installment-financing`, `pos-gl-cogs-cit`
  - `closing-session-record`, `daily-sales-monitoring` (e2e + updated unit spec), `daily-collection.service.spec`, `sales-reports`
  - `accounting-audit-log-account-mapping`, `coa-seed`, `pos-return-refund-*`, `accounting-audit-log-pos-cancellation-void-refund`
  - ⚠️ `pos-installment-financing`, `price-list-installment-terms` and `pos-tpf-installment` already fail on the Scenario 64 base (fixtures missing a Price Use; TPF-11 journal-entry amount). Record the baseline first, then compare. Don't count them as new failures.
- **Frontend:** `pr199-checkout-down-payment`, `pr199-credit-application`, existing POS checkout specs.

### Manual test script

Run against dev servers after Kian applies both migrations and the mapping backfill.

**§0 Setup**

- Accounts: `technova.owner@test.com` (owner), `technova.b1.cashier@test.com` (cashier, PIN 1234). Dev-bypass password per `docs/seed-data-reference.md`.
- Accounting → Account Mappings: `DELIVERY_FEE_INCOME` points at `4-02-030 Delivery Income`.
- A customer **with** an address, and an item in stock at Bago with a price list and a financing term (the seed has none, so create them).

| #   | Step                                                                        | Expected                                                                                                                  | Covers             |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| M01 | Owner: cash sale, tick For delivery                                         | Deliver to + address pre-filled from the customer                                                                         | DF-F01             |
| M02 | Fee 150 → watch Total                                                       | Total unchanged; separate delivery line                                                                                   | DF-F02             |
| M03 | Leave the fee CR blank → Confirm; then type the payment's CR Number into it | Blocked each time                                                                                                         | DF-F03/F04         |
| M04 | Distinct CRs → Confirm                                                      | Success screen: Delivery block with CR; Sale total excludes 150                                                           | DF-F05, DF-S01     |
| M05 | Open the sale in Transactions                                               | Delivery rows present                                                                                                     | DF-F15             |
| M06 | Accounting → GL `4-02-030`                                                  | +150 credit from M04; Undeposited Funds +150 debit                                                                        | DF-S01             |
| M07 | Free delivery sale (fee 0)                                                  | No fee CR asked; nothing in `4-02-030`                                                                                    | DF-S02/F06         |
| M08 | Owner: in-house installment + down payment + fee                            | The usual CR Number + the fee CR; same value blocked; distinct posts; customer ledger shows the down payment, not the fee | DF-S07/S08, DF-R06 |
| M09 | Owner: mixed cart (cash + in-house) + fee                                   | Payment block looks and behaves exactly as before (one CR Number); only the fee CR is new                                 | DF-F09/F10         |
| M10 | Owner: pure TPF + fee                                                       | Usual CR + fee CR, which must differ; TPF panel has no approved-amount box                                                | DF-F11/F13         |
| M11 | Cashier: in-house installment + fee → submit                                | Held; message names the fee + CR; nothing new in `4-02-030` yet                                                           | DF-A01, DF-F14     |
| M12 | Owner approves M11                                                          | Sale has the delivery details; exactly one fee entry in `4-02-030`; cashier's expected cash now includes the fee          | DF-A02             |
| M13 | Cashier: another one; owner **rejects**                                     | Nothing in `4-02-030`, expected cash unchanged                                                                            | DF-A03             |
| M14 | Cashier: close the session counting exactly the expected cash               | No variance; the cash fee was in expected                                                                                 | DF-S11             |
| M15 | Daily Collection Report for the day                                         | Each fee once, as DC, with its CR; card fee under non-cash                                                                | DF-R01/R02         |
| M16 | Daily Sales Monitoring + Sales report                                       | Sales figures exclude fees; footnote shows the fee total                                                                  | DF-R04/R05         |
| M17 | Void M04's sale                                                             | Fee reversed; DC shows as cancelled                                                                                       | DF-S12, DF-R03     |
| M18 | DevTools → offline                                                          | For delivery disabled with the reason                                                                                     | DF-F12             |

**Findings log**: `| # | Step | What happened | Expected | Status |`. Number findings `N1…` so they don't clash with the `DF-F` IDs.

---

## Not in this scenario

- **The down payment is still not recorded on cashier installment sales** (`project-dp-collection-gap`). Kian said leave it (2026-10-02). On the approval path, the down-payment CR the cashier types is still discarded, exactly as the row CR is today. Only the **fee** is recorded there (D5).
- Delivery scheduling / dispatch / driver and vehicle assignment / "delivered" status. Nothing exists for sales today (see the deep dive); `StockTransfer` dispatch and `Vehicle` are the pieces a later scenario would reuse. Fee tables by zone or distance.
- Wiring the **Delivery Receipt No.** into checkout (open question 3).
- A global duplicate-CR / booklet-series check.
- A printable POS collection receipt. The only printable CR is the A/R one (`ar_collection_receipt`), keyed to an AR payment. The cashier writes the paper booklet CR and types its number.
- Refunding a delivery fee (manual accounting action, D7).
- Mixed carts with TPF lines still tender the whole TPF amount at the register with no separate down payment (`page.tsx:1732-1737`). That's existing behaviour, unchanged.
- Splitting the down payment's CR from the sale's own CR. Chloe's single CR pool stays (D6), as does everything else she built in checkout.
- Fixing the Daily Collection Report down-payment double count (Kian, 2026-10-04: separately).

## Found along the way — pre-existing, not in scope

Verified by reading the code on 2026-10-04 (none has a test proving it yet). No fixes in this scenario; each wants its own ticket.

1. **Daily Collection Report counts cash in-house down payments twice** (PosPayment DP row + its CollectionReceipt). Kian, 2026-10-04: fix separately.
2. **Late-penalty cash is missing from the drawer count.** The collection journal entry debits `amount + penalty` (`ar-invoices.service.ts:1172`), but `CollectionReceipt.amount` stores `dto.amount` only (`:1817`), and `computeExpectedCash` sums receipt amounts. A collection with a penalty closes as an overage of the penalty. The report also prints `penalty: 0` hard-coded (`daily-collection.service.ts:850`).
3. **POS Collections stamps the branch's first open session**, not necessarily the logged-in cashier's (`CollectionsScreen.tsx:944-947`, `data?.[0]`). With two counters open, one drawer's collections can be counted in the other's close.
4. **POS customer search has no tenant filter** (`pos-customers.service.ts:83-91`: `deletedAt` + name/phone only).
5. **`PosTransaction.deliveryReceiptNumber` is never captured** (no checkout input has ever existed), and its DTO field has no `@MaxLength(100)` while the column is VarChar(100). The Scenario 64 doc says otherwise (`:100`).
6. **Customer advances (reservation deposits) have no session link**, so cash taken for a reservation is not in expected cash either (`customer-advances.service.ts:125-160`, Dr `DEFAULT_CASH`).
7. **`Item.revenueAccountId` is stored but never read when posting.** Every POS line credits `SALES_REVENUE` (`pos-posting.service.ts:368-427`).
8. **A voided sale's cash still counts in the drawer's expected cash.** `computeExpectedCash` sums the session's cash `PosPayment`s with no transaction-status filter (`sessions.service.ts:238-247`), while every void path reverses the sale's journal entry. The delivery fee does not inherit this: voiding cancels its receipt, which drops it from expected cash and the books together.
9. **`e2e/pos-checkout-selling-agent.spec.ts` "populated" clicks before hydration** and fails consistently on this base. It needs to wait for the page to hydrate (or retry the open) before asserting the list.

## Open questions

None of these block Part 1.

1. Should "Deliver to" carry a **contact number** too? The note names only the person and address. (client)
2. Should delivery fee CRs show on Accounting's receipts list for booklet audits, labelled, instead of being hidden (D8)? (Ms. Sam)
3. **Delivery Receipt No.**: the DR number column exists but nothing captures it, and Payment Mode "Delivery Receipt" (D10) doesn't either. Should the new Delivery section ask for the DR No. too, and should picking that payment mode tick For delivery? (client / Chloe, who built #198)

Answered 2026-10-04 (Kian):

- D3: collected at the counter.
- D4: no VAT.
- D5: recorded when the sale is made.
- D6: literal reading only; Chloe's CR pool untouched.
- The down-payment double count is fixed separately.

# Scenario 61 — POS Session Close & Daily Sales Monitoring — Gap Analysis & Closing Plan

**Source**: POS management meeting notes relayed 2026-09-30, plus a photo of the client's paper **Daily Sales Monitoring** sheet (branch M/B, 09/21/26).

> - For closing the session: total sales already → and invoice numbers → cash collected
> - Bem to provide the format as presented by Elijah
> - Attachment of the deposit, multiple attachments for other payments / draft for now esp. the checks and transfers need to be cleared by the next day. Even if it is a draft, the session can still be closed. Then once the attachments have been checked and cleared, it will be posted in the journal entries. All collections of the branch will be under "undeposited" — all the cash and electronic money
> - Change the "count the drawer" to CASH COUNT
> - ACCOUNTING: Journal entry date should reflect the same day the cashier started the transaction; clearing date is the next day or when it will be deposited. Different posting dates
> - Bank reconciliation date should be on the date the funds were deposited
> - Description of the collection will be provided by NIG
> - Signatory: Cashier and Branch Manager; make it printable so that they can have it signed

## The paper sheet

```
DAILY SALES MONITORING          BRANCH: ____   DATE: ____

FOR SALES — PER CATEGORIES
  APPLIANCES                                   110,020
  FURNITURES      A: 3E                         21,900
                  B: NON-3E
  SMALL ITEMS                                    6,200
  I.T PRODUCTS    A: COM/LAPTOP/ACCESSORIES     36,920
                  B: CELLPHONE
  SPLIT TYPES                                  (aircon)
  AGENT SALES                                   58,820
  OFFICE SALES                                 116,220
  TOTAL SALES                                  175,040
  CASH INVOICE
  CHARGE INVOICE                               175,040

FOR ACCOUNTING — SUMMARY OF
  TOTAL COLLECTIONS                             71,172
  GCASH/DIRECT DEPOSIT                          15,385
  CHEQUE FOR DEPOSIT                                 —
  BPI/BDO SWIPE                                 12,530
  CASH FOR DEPOSIT                              43,257
  TOTAL MI                                      54,022
```

The sheet's own figures tie: categories = Agent + Office = Cash + Charge invoice = Total Sales (175,040), and GCash + Cheque + Swipe + Cash = Total Collections (71,172). The handwritten 309,530 beside SPLIT TYPES ties to nothing and is read as a stray figure, not a row value.

## Decisions taken (developer, 2026-09-30)

1. **"Posted once cleared" means the deposit entry only** (Dr Bank / Cr Undeposited). Sale JEs keep posting at checkout, dated `occurredAt`.
2. **Categories map from existing item data**, not a new classification.
3. **Agent vs Office** comes from `PosTransaction.sellingAgentId` (set → Agent Sales, null → Office Sales).
4. **Split Types = aircon** — the Item Master Type `Split_Type`, already routed to the Aircon GL bucket in Scenario 30.
5. **Total MI = monthly installment collections** for the day.
6. **The sheet is per branch per day**, not per session. It belongs alongside the Daily Collection Report (`/pos/daily-collection`), which is already branch + business date, not in `CloseSessionModal`.

## Category mapping

Item Master **Type** (`ItemType.name`) lines up with the sheet almost one-to-one (counts from the client's Item Master CSV):

| Sheet row                     | Item Type                                                                                    | Items |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ----- |
| Appliances                    | `Appliance`                                                                                  | 8,938 |
| Furnitures A: 3E              | `Furniture_3E`                                                                               | 538   |
| Furnitures B: Non-3E          | `Furniture_Non3E`                                                                            | 3,295 |
| Small Items                   | `Small_Items`                                                                                | 5,974 |
| I.T A: Com/Laptop/Accessories | `IT_Products`                                                                                | 1,246 |
| I.T B: Cellphone              | `Gadgets` where Group = `Cellphone`                                                          | ~265  |
| Split Types                   | `Split_Type`                                                                                 | 588   |
| **unmapped**                  | rest of `Gadgets` (speakers, tablets, power banks, watches), `Bid_Items`, `CCTV`, 4 one-offs | ~190  |

Unmapped sales must still land somewhere or the categories stop tying to Total Sales — see open question 1.

## What's already done ✅

- **Sale JE date = the transaction's own date.** `pos-posting.service.ts` posts every sale on `tx.occurredAt`.
- **Deposit JE date = deposit date.** `BankAccountsService.clearCashInTransit` posts Dr bank / Cr Undeposited on the user-entered `dto.depositDate`.
- **Cash goes to Undeposited.** `cash`/`custom` → `POS_UNDEPOSITED_FUNDS`.
- **Per-branch daily report with print layout and signatories exists.** Daily Collection Report (`/pos/daily-collection`), Excel form sheet, Prepared/Checked/Certified sign-offs, SI numbers per row, collection kinds including `MI`.
- **Tender breakdown by provider** is snapshotted at close (`PosSession.tenderBreakdown`), which is what splits "BPI/BDO swipe" from "GCash".
- **Generic attachment storage** — `FileAttachment{entityType, entityId}` + `POST /files/upload`, already used by expenses and AP vouchers.
- **Selling agent** and **per-line cash/charge invoice type** are captured on every POS transaction.

## What's not done / gaps ❌

1. ~~"Count the drawer" wording~~ — done in Part 1.
2. ~~Over/short JE dated at close time~~ — done in Part 1. (`sessions.service.ts` posted the variance JE on `new Date()`, so a session closed after midnight booked it on the wrong day.)
3. **No Daily Sales Monitoring view.** Nothing reports sales per category, Agent vs Office, or Cash vs Charge invoice totals per branch per day.
4. **No Cashier / Branch Manager signed printable.** The DCR's lines are Prepared / Checked / Certified.
5. **No cheque at POS.** `PosPaymentMethod` has no cheque; `CHECK` exists only on AR/AP.
6. **E-money doesn't go to Undeposited.** GCash/QR → `POS_EWALLET`, card → `POS_CARD`, transfer → `POS_BANK_TRANSFER` clearing accounts.
7. **Deposits have no attachments and no draft state.** The deposit form has only a reference-number text field and posts immediately.
8. **POS deposits aren't bank-reconciliation sources.** Reconciliation candidates are AR/AP payments and `ClearingSettlement`s only.
9. **Collection description text** — blocked on NIG.
10. **Final layout** — blocked on Bem (format as presented by Elijah). Parts 2–3 build to the paper sheet above and adjust when it arrives.

## Closing the gaps — proposed parts

### Part 1 — Cash Count wording + variance JE date ✅ (2026-09-30)

- FE `pos/sessions/page.tsx`: "Count the drawer" → "Cash count"; "Count the drawer to reconcile" → "Do the cash count to reconcile".
- BE `sessions.service.ts` `close()`: over/short JE dated `session.openedAt` instead of `new Date()`. `closedAt` itself stays the real close time.

### Part 2 — Daily Sales Monitoring data (backend)

New endpoint beside the DCR, `GET /pos/reports/daily-sales-monitoring?branchId&date`, same business-date and branch scoping as `daily-collection.service.ts`. Returns:

- **Sales per category** — sum of posted line totals grouped by the Item Type mapping above, plus an "Other" bucket so the rows always tie.
- **Agent / Office** — split on `sellingAgentId`.
- **Cash / Charge invoice** — split on `PosTransactionLine.invoiceType`.
- **Invoice range** — first/last SI number and count for the day.
- **Accounting summary** — Total Collections, GCash/Direct Deposit, Cheque for Deposit (0 until Part 4), Swipe (card tenders by provider), Cash for Deposit, Total MI (DCR rows of kind `MI` + `MI-PARTIAL`).

Tie-outs asserted in the service: categories = Agent + Office = Cash + Charge = Total Sales; tender lines = Total Collections.

### Part 3 — Daily Sales Monitoring printable (frontend)

A **Sales Monitoring** tab on `/pos/daily-collection` (same branch + date stepper), laid out like the paper sheet, `print:` styles, with **Cashier** and **Branch Manager** signature lines. Reachable from a closed session's row the same way the DCR link is (`handleViewCollectionReport`). Relayout when Bem's format arrives.

### Part 4 — Cheque as a POS tender

Add `cheque` to `PosPaymentMethod` (migration), capture bank / cheque no. / cheque date at checkout, post to Undeposited (Part 5 rule). Shows as "Cheque for deposit" in Part 2.

### Part 5 — All branch collections to Undeposited

Re-map GCash/QR, bank transfer, card swipe and cheque to `POS_UNDEPOSITED_FUNDS` at sale time, per the notes. **Accounting impact**: the e-wallet/card/transfer `ClearingSettlement` path stops receiving new POS tenders (fees are then booked at deposit instead). Confirm with accounting before building; existing open clearing balances are left to settle through the old path.

### Part 6 — Deposit with attachments, draft → cleared → posted

- `clearCashInTransit` splits into **record** (draft: amount, deposit date, bank, reference, 1+ attachments — deposit slip, cheque images, transfer screenshots) and **verify** (checker confirms cleared → posts Dr Bank / Cr Undeposited dated on the **deposit date**, not the verify date).
- Session close is **not** blocked by a draft deposit (already true — close no longer sweeps).
- New shared upload component under `src/components/` (none exists; expenses/AP each roll their own) — build once, reuse.

### Part 7 — POS deposits in bank reconciliation

Add posted POS deposits as a reconciliation source type, matched on the deposit date.

## Manual testing (Part 1)

1. Open a session as a cashier, ring a cash sale, close the session. The section header reads **Cash count**; with an empty grid the verdict line reads "Do the cash count to reconcile".
2. Close with a deliberate short (manager override). In Accounting → Journal Entries, the Cash Shortage JE's date is the session's **opened** date. To see the difference, open a session before midnight and close it after (or temporarily back-date `openedAt` in the DB).

## Open questions

1. **Unmapped item types** — where do non-cellphone Gadgets (speakers, tablets, power banks, smart watches), Bid Items and CCTV go on the sheet? Default until answered: an "Other" row so totals still tie.
2. **Who verifies a deposit** as cleared in Part 6 — Branch Manager, accounting, or either? Determines the permission.
3. **Part 5 accounting sign-off** — confirm e-money and card go to Undeposited rather than their clearing accounts, and where card/e-wallet fees get booked.
4. **Signatories on a per-branch sheet** — with several cashiers in a branch-day, one Cashier line, or one per cashier?
5. **Collection description** text — pending NIG.
6. **Layout** — pending Bem's format.

## Implementation Log — 2026-09-30

- Part 1 done (FE rename, BE variance JE date). Backend `tsc` clean for `sessions.service.ts`; frontend Prettier clean. Not yet committed.

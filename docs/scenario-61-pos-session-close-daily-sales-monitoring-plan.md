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

7. **Who deposits** (2026-10-02): accounting only. Accountant and Business Owner record and clear a deposit (`accounting:cash-in-transit:manage` to record, new `accounting:cash-in-transit:verify` to clear); the Branch Manager and Cashier read balances and statuses only.
8. **An attachment is required to clear** a deposit; recording a draft does not need one.
9. **Sales Monitoring is sales only** — the "For accounting" half and its signatures were removed; collections, recap and sign-offs live on the Daily Collection Report, which was relaid to the client's Alimodian paper form (print and Excel).
10. **Sales count at the invoice total**; the owner sees Sales Monitoring for a branch-day whether or not the branch has filed its collection report.

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

Unmapped sales must still land somewhere or the categories stop tying to Total Sales. **Resolved (developer, 2026-09-30):** every unmapped type — non-cellphone Gadgets, Bid Items, CCTV, the one-offs — counts under **I.T A: Com/Laptop/Accessories**. Cellphone is matched by the item's primary category or any category assignment named Cellphone.

## What's already done ✅

- **Sale JE date = the transaction's own date.** `pos-posting.service.ts` posts every sale on `tx.occurredAt`.
- **Deposit JE date = deposit date.** `BankAccountsService.clearCashInTransit` posts Dr bank / Cr Undeposited on the user-entered `dto.depositDate`.
- **Cash goes to Undeposited.** `cash`/`custom` → `POS_UNDEPOSITED_FUNDS`.
- **Per-branch daily report with print layout and signatories exists.** Daily Collection Report (`/pos/daily-collection`), Excel form sheet, Prepared/Checked/Certified sign-offs, SI numbers per row, collection kinds including `MI`.
- **Tender breakdown by provider** is snapshotted at close (`PosSession.tenderBreakdown`), which is what splits "BPI/BDO swipe" from "GCash".
- **Generic attachment storage** — `FileAttachment{entityType, entityId}` + `POST /files/upload`, already used by expenses and AP vouchers.
- **Selling agent** and **per-line cash/charge invoice type** are captured on every POS transaction.

## Parts — as built

Numbering below is the order built. The plan's original Part 5 (all e-money to Undeposited) is **held** pending accounting sign-off; the original Parts 6–7 became Parts 5–6.

### Part 1 — Cash Count wording + variance JE date ✅ (2026-09-30)

- FE `pos/sessions/page.tsx`: "Count the drawer" → "Cash count".
- BE `sessions.service.ts` `close()`: over/short JE dated `session.openedAt` instead of `new Date()`. `closedAt` stays the real close time.

### Part 2 — Daily Sales Monitoring data ✅ (2026-10-01)

- `GET /pos/reports/daily-sales-monitoring?branchId&date` (`daily-sales-monitoring.service.ts`): sales per category (Item Type mapping above), Agent / Office (`sellingAgentId`), Cash / Charge invoice, units per category, invoice numbers. Invoice totals are allocated across lines so categories tie to Total Sales.
- The Daily Collection Report consolidates **all of a branch's sessions for the day**: sales by `occurredAt` day; session counts, float and deposits to the day of the session's last sale (or its open day). Cancelled receipts listed at 0.00; FP (full payment) is its own DESC and counts under MI.

### Part 3 — Printables ✅ (2026-10-01)

- **Sales monitoring** tab first on `/pos/daily-collection` (the page opens on Collection report), A4 portrait, one page, no browser header/footer.
- **Collection report** print and Excel follow the client's paper form exactly: `DAILY COLLECTION REPORT / BRANCH / M-D-YY` header, CASH RECEIPT (Office/Field/Others) + INVOICE columns, recap COD / DP / MI / OTHERS-DC / TOTAL COLLECTION / GCASH / CHECK (CARD and OTHER only when nonzero), yellow DENOMINATION block, PREPARED BY and CHECK BY (pre-filled with the branch manager, BRANCH MANAGER beneath). The filing form pre-fills denominations from every session's cash count.
- Session close shows total sales, invoice numbers and cash collected.

### Part 4 — Check as a POS tender ✅ (2026-10-01)

Not a new enum value: a Cash payment with the option "Check" (or a check number) is keyed `check` (`tender-key.ts`). Checks are excluded from expected drawer cash, but included in the session's undeposited amount, and shown as CHECK on the report.

### Part 5 — Deposits: draft → cleared → posted ✅ (2026-10-02)

- New `PosDeposit` model and `/pos-deposits` API: record a draft (bank, deposit date, reference, sessions), clear (posts Dr Bank / Cr Undeposited Funds **dated the deposit date**, needs ≥1 attachment), cancel (sessions return to Undeposited). Compare-and-set transitions; branch-scoped 404s.
- Undeposited Funds page (POS and Accounting, accounting's renamed from Cash-in-Transit, Banknote icon) redesigned as **one session table** with a status column (To deposit / Awaiting / Deposited), branch picker, summary cards, search and date range. Record Deposit in the header; the modal keeps its footer pinned however many files are attached. Shared `AttachmentsPanel` for the proof.
- Permissions delivered by `scripts/backfill-pos-deposit-permissions.ts` (grants verify to Business Owner + Accountant, revokes manage from Branch Manager), as `seed.ts` is a destructive reseed.

### Part 6 — POS deposits in bank reconciliation ✅ (2026-10-02)

A cleared deposit is a reconciliation candidate (`POS_DEPOSIT` line, direction DEPOSIT) on its bank once the statement date is on or after its deposit date. Completing a reconciliation stamps `reconciledAt` / `reconciledInReconciliationId`; deleting it releases the deposit. Migration `20261002090000_scenario_61_pos_deposit_reconciliation`.

### Held — all e-money to Undeposited

GCash/QR, card and transfer still post to their clearing accounts. Needs accounting to confirm, and where card/e-wallet fees are booked, before building.

## Open questions

1. ~~Unmapped item types~~ — all to I.T A.
2. ~~Who verifies a deposit~~ — accounting (Accountant, Business Owner).
3. **E-money to Undeposited** — awaiting accounting sign-off (held item above).
4. ~~Signatories~~ — on the Collection report only: Prepared by (cashier) and Check by (branch manager).
5. **Collection description** text — pending NIG.
6. **Layout** — built to the client's paper forms; adjust if Bem's format differs.

## Verification

- Backend e2e: `test/pos-deposits.e2e-spec.ts` (S61P5-01..05, S61P6-01) 6/6; `test/daily-sales-monitoring.e2e-spec.ts`; S61 cases in `test/closing-session-record.e2e-spec.ts`. Unit: `tender-key.spec.ts`, `src/pos/reports/*.spec.ts`, `bank-accounts.service.spec.ts` 19/19.
- Playwright: `e2e/undeposited-funds-deposit.spec.ts` (record → awaiting → clear & post → deposited; Branch Manager read-only) 3/3; `e2e/cit-monitor.spec.ts` updated to the redesigned page, 8/8; `e2e/daily-sales-monitoring.spec.ts`.
- **Known pre-existing failure:** `test/bank-reconciliation-worksheet.e2e-spec.ts` fails 8/8 on the current test DB with or without these changes — its fixture needs an AR invoice the DB no longer has. Reseed the test DB.

## Deployment

1. `npx prisma migrate deploy` — two migrations: `20261001090000_scenario_61_pos_deposits`, `20261002090000_scenario_61_pos_deposit_reconciliation`.
2. `npx ts-node --project tsconfig.json ./scripts/backfill-pos-deposit-permissions.ts` (backend) — once per environment.
3. Restart the backend.

## Implementation Log

- **2026-09-30** — Part 1 built. Decisions 1–6 taken.
- **2026-10-01** — Parts 2–4. Collection report relaid to the paper form after review; Sales Monitoring cut to sales only; consolidation across a day's sessions fixed after a two-session test day showed the report reading one session only. A GRAND TOTAL line was added then reverted; centavo rounding of totals kept.
- **2026-10-02** — Part 5, then a redesign of Undeposited Funds from three tabs to one table after review ("checking 3 tabs after every action"). Fixed: Record Deposit sending no sessions (the modal now snapshots its selection), deposit lists not refreshing (per-query `staleTime: 0` + one invalidation root). Part 6 built. Playwright spec added; the old `cit-monitor` spec was updated, as it asserted the removed "Deposit Selected to Bank", "Monitor All Branches" and History UI.

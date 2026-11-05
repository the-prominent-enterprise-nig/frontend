# Collections override date — backdated MI payment splits the drawer across two days

Found 2026-11-05. Reproduced on the test DB by
`backend/test/override-date-drawer-repro.e2e-spec.ts` (4/4 pass, i.e. the bug is confirmed).

## What happens

The Collections screen's **Override current date** (Scenario 54; past dates only since Oct 29 UAT DC-02) also sets
the payment panel's **Payment date** (Scenario 84 DC-01). A cashier who collects an MI today with the override set
to an earlier day records a real receipt dated that earlier day — but always on **today's open POS session**
(`posSessionId: openSessionId` in `CollectionsScreen.tsx`).

The two halves of the system then disagree on which day the money belongs to:

| Reads the receipt by | Where                                                                                 | Day it lands on |
| -------------------- | ------------------------------------------------------------------------------------- | --------------- |
| `paymentDate`        | Daily Collection Report (`daily-collection.service.ts`, `collectionReceipt.findMany`) | Override day    |
| `posSessionId`       | Close Session expected cash (`sessions.service.ts`)                                   | Today           |

## Reproduced (₱1,050 cash collected today, one with the override set to yesterday)

| Where                        | Settled cash | Counted | Variance          |
| ---------------------------- | ------------ | ------- | ----------------- |
| Close Session (today)        | ₱2,100       | ₱2,100  | 0                 |
| Collection Report, today     | ₱1,050       | ₱2,100  | **+₱1,050 over**  |
| Collection Report, yesterday | ₱1,050       | ₱0      | **−₱1,050 short** |

Also: the report is computed live (a filed `DailyCollectionSheet` stores only signatories, remarks and a
denomination override), so **yesterday's already-filed report changes after the fact**. Non-cash MI payments move
to the override day's non-cash block too, but do not touch the drawer.

Scenario 84's own e2e (S84-1.6/1.7) covers a backdated collection **without** a session, which is why this was
never caught — the real screen never sends one without a session.

## Decision: option 1 — the override judges on time or late; the receipt stays today (2026-11-05)

Options considered: (1) rebate/penalty only, (2) really record it on the past day and explain the shifted cash on
both sheets, (3) block the override for real payments. Option 1 chosen.

### How it works now

One field used to do two jobs. `paymentDate` decided **which day the receipt is filed under** (Collection Report,
journal entry, same-day duplicate guard) **and** **whether a due was paid on time** (rebate default, 15-day penalty
cap). They are now separate:

| Field          | Decides                                                        | Collections sends                               |
| -------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| `paymentDate`  | The receipt's day: Collection Report, journal entry, drawer    | **Today**, whenever an open session is attached |
| `assessedAsOf` | On time vs late: rebate default (screen), penalty cap (server) | The override day, only when it is earlier       |

- **Screen** (`CollectionsScreen.tsx`): with an open session the panel's date field reads **Rebate / penalty as of**
  (it still follows the override), and an amber note says the receipt is dated today. With no open session (a
  collection entered after the fact) nothing changed: the field is **Payment date** and backdates the receipt.
- **Server** (`ar-invoices.service.ts` `withAssessedAsOf`, both single and bulk paths):
  - a backdated `paymentDate` **with** a `posSessionId` is refused — that is the request that split the drawer;
  - `assessedAsOf` may not be after `paymentDate`, and is dropped when it equals it;
  - the penalty cap counts days late against `assessedAsOf`;
  - the receipt's notes get `Rebate/penalty assessed as of YYYY-MM-DD`, so an auditor can see why a late due was
    treated as on time.

### Example, after the change

Override set to Nov 5 on Nov 6, ₱1,000 due 20 days earlier, collected in cash on Nov 6's session:

| Where                   | Before                  | Now                                    |
| ----------------------- | ----------------------- | -------------------------------------- |
| Receipt dated           | Nov 5                   | **Nov 6**, notes: assessed as of Nov 5 |
| Nov 5 Collection Report | Row added, drawer short | Untouched                              |
| Nov 6 Collection Report | No row, drawer over     | Row present, drawer balances           |
| Close Session (Nov 6)   | Balances                | Balances                               |
| Penalty                 | Judged as of Nov 5      | Judged as of Nov 5 (unchanged)         |

### Tests

- Backend e2e `test/collections-override-assessed-date.e2e-spec.ts` (replaces the repro; 7/7): refused backdated
  receipt on a session; penalty judged as of the assessment day; assessment after the payment refused; receipt on
  today's report, not the earlier day's; notes stamped; no-override control still owes the penalty; Close Session
  and the Collection Report both show zero variance. Scenario 84 Part 1 still passes (8/8).
- Frontend Playwright `S84-FE-1.4` added (not run: the Playwright web server resets the test DB via Prisma migrate,
  which needs the developer's go-ahead).

## Related

- Timezone: "today" for the override max, the default Payment date and the backend's future-date check was the UTC
  date, so between 00:00 and 08:00 Manila it was still yesterday. Fixed on `fix/manila-time-ar-01-name-search`.

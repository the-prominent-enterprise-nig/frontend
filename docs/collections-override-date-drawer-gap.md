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

## Decision needed (client)

What should the override mean for a real payment?

1. **Rebate/penalty only (recommended).** Keep the receipt dated today (on today's report and drawer); use the
   override date only to judge late/on-time for the rebate and penalty. Drawer and report always agree.
2. **Really record it on the past day.** Keep today's behaviour, but then the receipt should not sit on today's
   session — and the shifted cash needs explaining on both sheets, or a cash turnover between the days.
3. **Block it.** Payment date must be today whenever a session is open; the override stays a simulation only.

## Related

- Timezone: "today" for the override max, the default Payment date and the backend's future-date check was the UTC
  date, so between 00:00 and 08:00 Manila it was still yesterday. Being fixed on `fix/manila-business-time`.

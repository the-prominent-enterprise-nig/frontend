# Scenario 80 — Oct 29 UAT quick wins

Source: the "NIG Marketing UAT Checklist" (consolidated UAT notes, Oct 29 2026), its **Easy** items, audited against
`origin/development` on 2026-11-03 (FE 4e2008ab, BE f932571).

Of the 33 Easy items, 3 were already done (PO-01, POS-10, POS-12), 2 look done and only need a re-test (SNL-02,
CL-05), 4 were partial and 24 not done. This scenario finishes the partials and builds the rest, plus POS-15 (the
sale-date override) because POS-16/18/19 can't exist without it.

Branch `feat/scenario-80-oct29-uat-quick-wins` in both repos.

## Decisions (Kian, 2026-11-03)

1. **Sale-date override:** build POS-15 together with POS-16, POS-17, POS-18 and POS-19, as the last part.
2. **POS-11 and POS-14 / CC-01 are done as the client asked**, even though both reverse Chloe's recent work:
   - POS-11: in-house down payment must be > 0. Chloe's #234 (2026-10-28) made 0 allowed.
   - POS-14 / CC-01: CR number optional on collections. Chloe's release #253 and the AR receipt DTOs require it on
     every method.
     Both are flagged in the PR for Chloe's review.
3. **WH-05:** a Branch filter on the repairs (Unit Documents) list. The create form's "Location" picker stays as is.
4. **CA-02:** "Allow the waiver on TPF sales" was the first reading, but a TPF sale never needs a credit
   application, so a waiver there would do nothing. Built instead: **Third-Party Financing (TPF)** is offered as a
   reason when the credit application is waived. The backend adds it to every tenant's override reasons once, and
   refuses it on anything but a waiver.
5. **Chloe's code (2026-11-03):** Kian first said not to change Chloe's work, then "carry on" after seeing that all
   of Part 2 sits on it. The Part 2 changes that touch her code are listed in the PR for her review: the moved
   down-payment toggle (POS-06), the reference rules (POS-07/13) and the moved Payment Mode / provider toggles
   (POS-09).

## Merge with development (2026-11-03)

Karms' #270 (WH-01 to WH-07) landed on development during this scenario. On the merge, conflicts went his way:
WH-02 (Edit Request button), WH-03 (Add Item in the Item Master tab strip) and WH-04 (darker text) are his
implementations now; ours were dropped. Kept from Scenario 80: STR-02 (bold transfer serials) and SNL-01 (Origin
before Location, re-applied on his colours).

## Parts (easiest first; each part is committed and manually tested before the next)

### Part 1 — labels and looks (FE only)

| ID             | Change                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------- |
| WH-02          | Transfer "Edit Request" becomes a real bordered button                                        |
| WH-03          | Remove "Add Item" from Stock Balance; Item Master keeps its button                            |
| WH-04          | Stock transfer list and detail: light grey text darkened                                      |
| STR-02         | Serial numbers in transfers: bold, darker                                                     |
| SNL-01         | Serial Number Locator: Origin columns before Location columns                                 |
| SC-02          | "Repair Provider" → "Service Center" in every user-facing label, placeholder, toast and error |
| POS-08         | In-house / TPF selector enlarged to match the Cash / Installment toggle                       |
| POS-20 / CS-01 | "Counter collections" → "MI collections" in Close Session                                     |

### Part 2 — checkout layout and fields (FE, BE where a field was required)

| ID     | Change                                                                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| POS-06 | The down payment's Cash / Debit-Credit Card toggle moves down to the Payment section                                                                |
| POS-07 | No reference for GCash and bank transfer. BE: a QR payment through a GCash gateway needs none; FE sends the first GCash gateway when none is picked |
| POS-13 | No reference for debit/credit card                                                                                                                  |
| POS-09 | Payment Mode (Cash / Installment) and Inhouse / TPF move to the top of Order Summary                                                                |
| CA-02  | "Third-Party Financing (TPF)" reason, offered only on a waived credit application                                                                   |

### Part 3 — rules (FE + BE)

| ID             | Change                                                                                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POS-04         | Customer phone optional (CRM/POS form schema and backend DTO)                                                                                                                                                                                         |
| POS-11         | In-house down payment must be > 0 (FE field and BE check); TPF keeps 0 allowed                                                                                                                                                                        |
| POS-14 / CC-01 | CR number optional for POS Collections, AR receipts and down-payment sales                                                                                                                                                                            |
| DC-02          | Collections "Override current date" can't be in the future (FE `max` + BE rejection)                                                                                                                                                                  |
| CR-01          | Daily Sales Monitoring: an item with no (or an unlisted) Type is placed by its category group — Washer Dryer, Refrigeration, Television, Airconditioner, Electric Fan, Range → Appliances; AC Indoor/Outdoor → Split Type — before falling back to IT |

### Part 4 — filters

| ID     | Change                                                             |
| ------ | ------------------------------------------------------------------ |
| POS-02 | Date range filter on the POS Overview                              |
| POS-03 | Monthly filter for accumulated sales on the Sales Counter Overview |
| WH-05  | Branch filter on the repairs (Unit Documents) list                 |

### Part 5 — printed customer ledger

| ID    | Change                                                  |
| ----- | ------------------------------------------------------- |
| CL-01 | Customer phone on the single-plan (paper-form) printout |
| CL-03 | Total Amount Due on the multi-plan printout             |

### Deferred — POS sale-date override (Kian, 2026-11-03: leave all four for later)

| ID     | Change                                                                                 |
| ------ | -------------------------------------------------------------------------------------- |
| POS-15 | Authorized users can set the sale date (backdate) at checkout                          |
| POS-16 | Future dates rejected (FE `max` + BE validation)                                       |
| POS-17 | The date belongs to the sale being checked out, not shared across held/other customers |
| POS-18 | Calendar picker for the date                                                           |
| POS-19 | A reason is required whenever the date differs from today                              |

### Re-test only (no code)

- **SNL-02:** cost is hidden by the `inventory:receive:cost-view` permission. Re-test with a branch account, not an
  admin.
- **CL-05:** BE 0584fa5 (2026-10-29) removed the ₱0.12 drift on a POS sale's ledger. Re-test with a CR-BR sale.

## Tests

Each part ships with:

- **Regression:** BE unit specs for every rule touched; FE `type-check` + `lint`.
- **E2E:** a focused spec per part where the change is reachable in the browser or the API.
- **Manual:** click-by-click steps with ✅ expected results, in `Scenario-80-Manual-Test.md`.

Suites are run one at a time.

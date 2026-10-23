# Scenario 64 — PR #199 review: manual test

Walks through every point in Chloe's review of PR #199 (2026-10-02, two
"changes requested" reviews) on the dev servers. For each one: what she saw,
why it happened, and what you should see now. The **Before** column is what
the branch did when she reviewed it; **Expect** is the fixed behaviour.

| Chloe's point                                                    | Part          |
| ---------------------------------------------------------------- | ------------- |
| 1. "Please let user type/search the number"                      | 1             |
| 2. "Add checklist 'Home address is same as current address'"     | 1             |
| 3. "Upon credit application, the birthdate doesnt show anything" | 1 → 2         |
| 4. "There's 2 'relationship to applicant'"                       | 2             |
| 5. "Merge with development… calculation are currently wrong"     | 2 and 5       |
| 6. "Changing the item in a credit application breaks the submit" | 2 (LCP) and 3 |

## Before you start

|                |                                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Branches       | backend `feat/scenario-64-credit-application-v2`, frontend `feat/scenario-64-pos-client-feedback-batch` (both repos are checked out on them) |
| Migrations     | applied 2026-10-02 — `prisma migrate status` says up to date                                                                                 |
| Start          | backend `npm run start:dev`, frontend `npm run dev`                                                                                          |
| Frontend       | http://localhost:3000                                                                                                                        |
| Cashier        | `technova.b1.cashier@test.com` — Bago, Counter 1 (session already open)                                                                      |
| Business Owner | `technova.owner@test.com` — needed only to approve, Part 4                                                                                   |
| Password       | `dev-prominent-enterprise-2026` for both                                                                                                     |

### Test data — already in the dev database

| Item                           | SKU            | Why                                                      | Bago serials                                    |
| ------------------------------ | -------------- | -------------------------------------------------------- | ----------------------------------------------- |
| SHARP 2TC32GH3000X — 32" AQUOS | `TN-ITEM-0644` | Chloe's own example in her screenshots                   | `50646803299`, `50646804916`, `50646804999`     |
| ASTRON LED3277 — 32" LED TV    | `TN-ITEM-0665` | a second item on the rate card, for the item-change test | `00623-P`, `244590040112821`, `244590040112822` |
| DOWELL STF3238 — 16" floor fan | `TN-ITEM-0394` | on the WIP price list but **no** price-list down payment | `DS-STF3238-296NWH`                             |

The SHARP's rate card (WIP), straight from the client's price list — the
same row as Chloe's spreadsheet screenshot:

| Price  | Down payment | 3 mo (MI / PPD) | 6 mo        | 9 mo        | 12 mo       |
| ------ | ------------ | --------------- | ----------- | ----------- | ----------- |
| 15,380 | 3,380        | 4,845 / 360     | 2,650 / 200 | 1,930 / 140 | 1,570 / 120 |

### The rule this tests (point 5)

- **The price list quotes a down payment AND a monthly for the chosen term**
  → that down payment is the down payment: locked, on the credit application
  and at the till. The card's monthly was calculated from exactly that
  figure: 15,380 − 3,380 = 12,000 financed, and 4,845 × 3 = 14,535 is 1.21 ×
  12,000 — the same 1.21 on every 3-month row of the price list.
- **Anything else** (no price-list down payment, or a term the card does not
  quote) → development's behaviour: pre-fill the price-list figure if there
  is one, minimum **10%**, editable.

What Chloe saw was the branch's own rule (Scenario 64 item 22): 30% down,
while the monthly still came from the card. Merging development did not
change the numbers — the price list is identical on both — but the merge is
done anyway, since the PR conflicted.

---

## Part 1 — Create the customer (Chloe's points 1, 2 and 3)

**Log in as the cashier.** `POS → Customers → New Customer`.

Name **Rosa Villanueva**, phone `+63 917 555 0199`, Civil status **Single**,
Gender **F**. Then the birthday, by keyboard:

| #   | Do                                                                                     | Expect                                                                                                          | Before                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Click the **Month** box and type `sep`                                                 | The list narrows to **September**                                                                               | Same                                                                                                                                            |
| 1.2 | Press **Tab** — not Enter                                                              | Month shows **September**, the cursor moves to Day                                                              | The typed text was kept only on Enter or a click on the option. Tab left the list hanging open, and the next click anywhere **wiped the month** |
| 1.3 | In **Day**, type `2`                                                                   | The list is **2, 20, 21 … 29**                                                                                  | 2, **12**, 20–29, **22**… (matched the digit anywhere)                                                                                          |
| 1.4 | Type `1` (Day reads `21`), press **Tab**                                               | Day shows **21**, cursor in Year                                                                                | Same as 1.2 — lost                                                                                                                              |
| 1.5 | In **Year**, type `1990`, then **click into Tax ID** (no Enter)                        | Year shows **1990**                                                                                             | **This is Chloe's bug:** the click wiped "1990", the birthday saved as nothing, and the form gave no warning                                    |
| 1.6 | Look under the three boxes                                                             | Grey hint: _"Type or pick — e.g. sep, 21, 1990."_                                                               | No hint (Chloe's screenshot: a bare "Day" box)                                                                                                  |
| 1.7 | Click **Clear** under the boxes, then type only Month (`sep`, Tab) and Day (`21`, Tab) | Red: _"Pick the month, day and year — or clear the birthday."_                                                  | Nothing — half a birthday looked fine                                                                                                           |
| 1.8 | Click **Create customer** now                                                          | Refused: _"The birthday is incomplete — pick the month, day and year, or clear the birthday…"_ Nothing is saved | Saved, with **no birthday**                                                                                                                     |
| 1.9 | Type `1990` in Year again, press Tab                                                   | The red message goes away                                                                                       | —                                                                                                                                               |

Addresses:

| #    | Do                                                                                     | Expect                                                                                                                            | Before                                                                                      |
| ---- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1.10 | Current address: Region VI → Negros Occidental → Bago → any barangay; street `Purok 3` | Under it, a ticked checkbox **"Home address is same as current address"**, and **no** Home address block                          | Chloe's screenshot: a second "Home address (if different)" block, always shown, no checkbox |
| 1.11 | Untick it                                                                              | A **Home address** block appears, empty                                                                                           | —                                                                                           |
| 1.12 | Tick it again                                                                          | The block disappears                                                                                                              | —                                                                                           |
| 1.13 | **Create customer**                                                                    | Saved                                                                                                                             | —                                                                                           |
| 1.14 | Open Rosa again → **Edit**                                                             | Birthday **September / 21 / 1990**; the checkbox is **ticked**; **Save changes** is greyed out (opening the form is not a change) | Birthday blank — it never reached the database                                              |

Optional — the edit path of point 2:

| #    | Do                                                               | Expect                                                                                                                                              |
| ---- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.15 | Untick, pick a home address in **Iloilo City**, Save. Edit again | Opens **unticked**, with the Iloilo City address loaded                                                                                             |
| 1.16 | Tick, Save. Edit again                                           | Opens **ticked** — the home address was cleared. Before, the form could never clear a saved home address: it sent nothing instead of an empty value |

---

## Part 2 — The credit application (points 3, 4, 5, and the LCP half of 6)

Still the cashier. `POS → Credit Applications → New Application`.

### The birthdate arrives (point 3)

| #   | Do                                              | Expect                                                                                  | Before                                                                                                  |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 2.1 | Applicant: search **Rosa Villanueva**, pick her | The **Customer Profile** header does **not** say _"Missing birthdate — confirm or add"_ | Chloe's screenshot: _"Missing birthdate — confirm or add"_ — the customer really had none (Part 1, 1.5) |
| 2.2 | Expand Customer Profile                         | **Birthdate** shows 21 Sep 1990 (your browser's date format, e.g. `09/21/1990`)         | `mm/dd/yyyy`, empty                                                                                     |

### The two relationship fields (point 4)

| #   | Do                                                                                                              | Expect                                                                                     | Before                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.3 | Look at row 1 of **Related People or Co-maker**                                                                 | **Role \*** = Co-maker, Mobile \*, First name, Last name, **Relationship to applicant \*** | Chloe's screenshot: **"Relationship"** beside **"Relationship to applicant"** — read as the same question twice. They are not: the first picks which person on the paper form the row is; the second is how a co-maker is related |
| 2.4 | Change **Role** to Father                                                                                       | _Relationship to applicant_ disappears — a father's relationship is the role itself        | Same                                                                                                                                                                                                                              |
| 2.5 | Role back to **Co-maker**; Mobile `+63 917 555 0200`, First name `Ramon`, Relationship to applicant **Sibling** | —                                                                                          | —                                                                                                                                                                                                                                 |
| 2.6 | Character references: fill row 1 (any name, a relationship, a mobile)                                           | —                                                                                          | —                                                                                                                                                                                                                                 |

### The calculation (point 5) — an item with no price-list down payment first

| #    | Do                                                                                                        | Expect                                                                                                                  | Before                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 2.7  | Item / Model: search `STF3238`, pick the DOWELL fan. Price Use stays **WIP**, Financing Term **3 months** | Item total · WIP **₱1,051.08**. Down Payment pre-filled **105.11** and **editable**; placeholder _"Min. ₱105.11"_ (10%) | Pre-filled **315.32** — 30%                                                                     |
| 2.8  | Proposed Purchase & Paper Record                                                                          | LCP **1051.08**, PPD rebate **empty** (no rate card for this item), First due date **one month from today**             | Same LCP. The due date could land a day early before 8am, since it was cut from a UTC timestamp |
| 2.9  | Type `100` in Down Payment                                                                                | Red: _"Down payment must be at least ₱105.11 — 10% of the sale amount incl. VAT…"_                                      | "at least ₱315.32 — 30%…"                                                                       |
| 2.10 | Type `200`                                                                                                | Accepted — above the minimum is allowed here                                                                            | —                                                                                               |

### Chloe's item — the price list fixes the down payment

| #    | Do                                                                | Expect                                                                                                                                                     | Before (Chloe's screenshot)                                                                                          |
| ---- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 2.11 | Change the item **in the same row** to `2TC32GH3000X` (the SHARP) | Item total · WIP **₱15,380.00**                                                                                                                            | ₱15,380.00                                                                                                           |
| 2.12 | Down Payment                                                      | **3380.00**, greyed, read-only, with _"Set by the price list for this term — the monthly installment is calculated from it."_ — your typed 200 is replaced | **4614.00** (30%), editable                                                                                          |
| 2.13 | The breakdown                                                     | Amount financed **₱12,000.00** · Monthly × 3 mo. **₱4,845.00** · PNV **₱14,535.00** · Total price **₱17,915.00**                                           | ₱10,766.00 · ₱4,845.00 · ₱14,535.00 · **₱19,149.00**                                                                 |
| 2.14 | Compare with Chloe's spreadsheet row                              | 3,380 + 4,845 × 3 = **17,915** ✔                                                                                                                           | 4,614 + 14,535 = 19,149 — ₱1,234 more than the price list, with the same monthly                                     |
| 2.15 | Paper record                                                      | LCP **15380** (it followed the item), PPD rebate **360**                                                                                                   | **LCP stayed at the first item's price** — that is where Chloe's 12,452.67 came from: an item she had picked earlier |
| 2.16 | Try to type in Down Payment                                       | Nothing changes — it is the price list's figure                                                                                                            | Any figure from 30% up was accepted                                                                                  |

### Changing term and Price Use

| #    | Do                                    | Expect                                                                                                                                                                                                                         | Before                                           |
| ---- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| 2.17 | Term → **6 months**                   | DP stays **3,380** (the card's down payment is the same for every term). Monthly **₱2,650.00**, PNV **₱15,900.00**, Total **₱19,280.00**, PPD rebate **200**                                                                   | DP 4,614, Total 20,514, and **PPD stuck at 360** |
| 2.18 | Price Use → **CR-BR** (term 6)        | Item total **₱13,490.00**, DP **2970.00** locked, Monthly **₱2,230.00**, Total **₱16,350.00**, LCP **13490**, PPD **170**                                                                                                      | DP 4,047 (30%)                                   |
| 2.19 | Price Use → **ZI**, keep **6 months** | The ZI card only quotes **12** months, so the factor rate applies: DP pre-filled **3510.00** but **editable**, placeholder _Min. ₱1,599.00_, Monthly **₱2,392.00**, PNV ₱14,352.00, Total **₱17,862.00**, PPD rebate **empty** | —                                                |
| 2.20 | Term → **12 months** (still ZI)       | Back on the card: DP **3510.00** locked, Monthly **₱1,340.00**, PNV ₱16,080.00, Total **₱19,590.00**, PPD **300**                                                                                                              | —                                                |
| 2.21 | Back to **WIP**, **3 months**         | DP 3,380 locked · Total **₱17,915.00** · LCP 15380 · PPD 360                                                                                                                                                                   | —                                                |

The paper still wins where someone typed a figure:

| #    | Do                                                        | Expect                                                    |
| ---- | --------------------------------------------------------- | --------------------------------------------------------- |
| 2.22 | Type `15000` in **LCP**, then change the term to 6 months | LCP stays **15000** — a typed figure is never overwritten |
| 2.23 | Term back to 3 months; set LCP back to `15380`            | —                                                         |

### Submit it

| #    | Do                                                                                                                                                       | Expect                                                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 2.24 | Down payment collection **Branch**, POS draft / quote ID `QT-REVIEW-01`, Applicant is unit user **Yes**, tick the paper-form box, **Submit Application** | The detail page: Related People shows **Co-maker · Sibling**; financing shows DP **₱3,380.00**, monthly **₱4,845.00** |

Note its application number — Part 4 approves it.

---

## Part 3 — Change the item on an application raised from the cart (point 6)

Still the cashier. `POS → Checkout`, Bago · Counter 1.

| #   | Do                                                                                           | Expect                                                                                                                        | Before                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.1 | Customer: **Rosa Villanueva**. Add the SHARP (`2TC32GH3000X`), pick serial **`50646804916`** | —                                                                                                                             | —                                                                                                                                                                  |
| 3.2 | Payment **Installment** → **Inhouse Installment** → **+ New application for this cart**      | The application opens with Rosa and the SHARP filled in. (Chloe's "New Credit Application Form" — renamed during Scenario 64) | —                                                                                                                                                                  |
| 3.3 | Change the item to `LED3277` (the ASTRON); WIP, **3 months**                                 | Item total **₱10,560.00**, DP **2320.00** locked, Monthly **₱3,325.00**, Total **₱12,295.00**, LCP **10560**, PPD **250**     | LCP and PPD stayed at the SHARP's                                                                                                                                  |
| 3.4 | Fill related people, a reference and the paper record as in Part 2; **Submit Application**   | **It submits**, landing on the new application's page                                                                         | Chloe's screenshot: _"Serial BE362402-010-P belongs to a different item and cannot be recorded against this one."_ — the SHARP's serial went along with the ASTRON |

The serial picked at the till belongs to the SHARP, so it is dropped when the
item changes. The ASTRON's own unit is picked at the till when it is sold.

---

## Part 4 — Approve the Part 2 application

**Log out; log in as the Business Owner.**
`POS → Credit Applications` → the Part 2 application (SHARP, ₱3,380 down).

| #   | Do                                                                                             | Expect                      |
| --- | ---------------------------------------------------------------------------------------------- | --------------------------- |
| 4.1 | **Submit for Investigation** → **Start Investigation** → fill in the investigation and save it | Status **Pending Approval** |
| 4.2 | **Approve** (the SHARP line is pre-set to approve)                                             | Status **Approved**         |

---

## Part 5 — The same figure at the till (point 5, checkout side)

**Log back in as the cashier.** Open the approved application.

| #   | Do                                                                                                                                                                                 | Expect                                                                                                                                                                                                                                                                  | Before                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 5.1 | **Continue to sale**                                                                                                                                                               | Checkout opens with Rosa, the SHARP, Installment, 3 months, the application selected. The SHARP may arrive with serial `50646804916` already picked — Part 3's cart is still stashed in this browser, and it matches this application. Otherwise pick **`50646803299`** | —                                                                                                                 |
| 5.2 | The line's **Down payment** panel                                                                                                                                                  | **₱3,380.00**, badge **Rate card**, **no "Change amount" link**, and _"Set by the rate card for this term — its monthly installment is calculated from this down payment."_                                                                                             | **₱4,614.00**, badge **30% min**, "Change amount", _"Fixed at 30% of the sale amount — the same for every term."_ |
| 5.3 | The preview under it                                                                                                                                                               | **₱4,845.00/mo** · **₱14,535.00 total**                                                                                                                                                                                                                                 | Same monthly — on top of 4,614 down                                                                               |
| 5.4 | Optional: SI No. `SI-REVIEW-0001`, pay the ₱3,380 down payment, **Create Installment Plan** → have the Branch Manager (`technova.b1.manager@test.com`) approve the release request | The installment account shows **Total price ₱17,915.00**                                                                                                                                                                                                                | ₱19,149.00                                                                                                        |

For contrast, an item **without** a price-list down payment still shows the
**10% min** badge and **Change amount** — Part 2, 2.7, at the till.

---

## Not covered here

- **The approved ASTRON application (Part 3)** going to sale: "Continue to
  sale" now rebuilds the cart from the application instead of bringing back
  the old SHARP cart. Approve it as in Part 4 to see it.
- **A co-maker's relationship edited on its own** is now saved. Raise a second
  application for Rosa, pick Ramon from "Co-maker on file", change only
  _Relationship to applicant_, and submit. Before, that change was dropped.
- **For Chloe:** items with no price-list down payment are back to
  development's **10%**, not 30%. Scenario 64 item 18 (30%, the client's
  2026-09-28 note) is reversed with item 22.

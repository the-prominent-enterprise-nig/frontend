# Scenario 74 — Oct 16 client notes: the quick wins (POS sessions, daily collection, checkout, inventory)

**Source**: _NIG Marketing Notes & Comments, October 16, 2026_ (27 lines), audited line by line against `development` on **2026-10-19** (frontend `da853b4c`, backend `7d0d4e9`). This scenario took the **15 lines marked "doable today"**: small, clear asks that need no migration and reverse no one's design. **11 were built (Parts 1–4). Kian dropped the 4 accounting ones (Part 5) on 2026-10-19 to keep this scenario to POS and Inventory.** Those 4 and the other 12 lines are listed at the end with the reason each one waits.

**Base**: `origin/development`. Branch `feat/scenario-74-oct16-client-quick-wins` in both repos. Worktrees `frontend/frontend-scenario-74` and `backend/backend-scenario-74`. Not stacked on 71/72.

**Claimed** 2026-10-19 after checking `docs/scenario-*` and commit subjects on `origin/development` (73 = Karms' service-center repair; 71 and 72 are each used three times), remote branches (highest 71) and open PRs (FE #223, unnumbered; BE none).

**No migrations in this scenario.** The 28 migrations that landed on `development` 2026-10-13..16 must be on the dev DB before the dev servers run. Kian applies them.

---

## Step 0 — every note line, and where it goes

| #   | Note (module)                                              | Status on development                                                                              | Here?       |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Unable to close session when cash is 0.00 (POS Sessions)   | FE blocks it (`hasCount`); BE allows it                                                            | **Item 1**  |
| 2   | Clarify the POS date: session dates (POS)                  | List shows times only; BE date filter is UTC midnight                                              | **Item 2**  |
| 3   | Do not display the undeposited amount (Daily Collection)   | `UNDEPOSITED` credit lines drawn on screen                                                         | **Item 3**  |
| 4   | Daily collection printable                                 | Print exists per branch; the all-branches roll-up has none                                         | **Item 4**  |
| 5   | CR number not required for cash (POS)                      | Chloe `a80f69ca` made it optional for Cash on Hand / Check, no DP; no "(optional)" cue             | **Item 5**  |
| 6   | Terms, months and rebate display (POS Checkout)            | Months + monthly shown; rebate nowhere; success screen has no months                               | **Item 6**  |
| 7   | Credit application uses the POS "CR-BR" selection          | Hand-off doesn't carry Price Use or term; form opens on WIP                                        | **Item 7**  |
| 8   | "1 of 1 assigned" hard to see (Stock Transfer)             | `text-zinc-400`                                                                                    | **Item 8**  |
| 9   | Carrier not needed: remove or "NIG" (Stock Transfer)       | Required FE + BE, defaults blank                                                                   | **Item 9**  |
| 10  | Date only, no time (General Stock Book)                    | Movement history prints `date · time`                                                              | **Item 10** |
| 11  | Fix the stock ledger filter: correct units (Stock Balance) | Two bugs: parent category drops subcategory items; in-transit to a new destination counted nowhere | **Item 11** |
| 12  | Reference number should be required (Cash in Transit)      | Optional FE + BE                                                                                   | **Item 12** |
| 13  | Add a note and reference number (Cash in Transit)          | Per-slip reference exists; `note` is stored and sent but has no input                              | **Item 13** |
| 14  | Keep the End of Day button visible (Cash in Transit)       | No such button; Record Deposit sits in the page header                                             | **Item 14** |
| 15  | Delivery destination column (AP Bills)                     | Not shown; PO/RR carry the warehouse                                                               | **Item 15** |
| —   | The other 12 lines                                         | See _Not in this scenario_                                                                         | —           |

---

## Item by item

### 1 — Close a session with ₱0.00 in the drawer · **S** · FE

`CloseSessionModal` (`pos/sessions/page.tsx`) computes `hasCount = pieceCount > 0 || coinsAmount > 0` (~1223). `submit()` returns early on `!hasCount` (~1288) and `blocked` disables Close on it (~1435). The denomination inputs render `0` as `''` (~1625), so typing 0 changes nothing. The backend is fine: `CloseSessionDto.declaredClosingCash` is `@Min(0)` and `close()` only asks for an override when there is a variance.

**Change:**

- Add a "Drawer is empty — ₱0.00" action to the count card. It sets `drawerEmpty`. `hasCount` becomes `pieceCount > 0 || coinsAmount > 0 || coinsTyped || drawerEmpty`, where `coinsTyped` means the Coins box holds any value, including "0".
- Typing any count clears `drawerEmpty`.
- An expected ₱0 then closes cleanly. An expected amount above ₱0 goes through the existing variance reason and manager-approval path.

Author: Karms (`86d5338bb`). Not Chloe's.

### 2 — Session dates · **S** · FE + BE

**Today:**

- `SessionRow` shows `opened 8:02 AM` / `closed 5:10 PM` only (`shiftTime()`).
- The list sends no date filter.
- BE `findAll` (`sessions.service.ts:163-167`) uses `lte new Date('YYYY-MM-DD')`, which is midnight UTC: the chosen end day is lost and Manila time is ignored.

**Change:**

- **BE:** `dateFrom` / `dateTo` become Manila day bounds, reusing `manilaDayStart` / `manilaDayEnd` from `accounting/tax-reports/tax-period.util.ts`.
- **FE list:**
  - Each row leads with the business date (`isoDateOf(openedAt)`, "Mon, Oct 19").
  - Open/close times carry their own date when the shift crossed midnight ("opened Oct 18 10:30 PM · closed Oct 19 1:05 AM").
  - Add a date filter (From / To, empty = all) in the page header.
- **FE checkout:** a quiet notice when the selected session opened on an earlier Manila day ("This session opened yesterday, Oct 18. Sales are dated today"). No block.

### 3 — Hide the undeposited amount on Daily Collection · **XS** · FE

`form-model.ts:157-179` builds the `UNDEPOSITED` credit lines. `DailyCollectionLedger.tsx` draws them (table ~161-210, cards ~229-261). The print (`DailyCollectionForm.tsx`) and the Excel export (`daily-collection.form-sheet.ts:258`) build their own copy.

**Change:** filter `creditLabel === 'UNDEPOSITED'` in `DailyCollectionLedger.tsx` only (D2). Author: Karms.

### 4 — Print the all-branches Daily Collection · **S** · FE

Print exists per branch (`DailyCollectionView.tsx:232-236`, Karms `73576d76`). `showRollup` (~117) is true when no branch is selected, which is the Business Owner's default view, and the roll-up has no Print.

**Change:** a Print button on the roll-up that prints the roll-up table on the same page setup (`DailyCollectionPrintPages` approach, Letter/A4/Legal).

### 5 — CR number "(optional)" for cash · **XS** · FE

`crIsRequired` (`checkout/page.tsx` ~1968-1975, Chloe `a80f69ca`) already drops the requirement for Cash on Hand / Check with no DP. The field still looks mandatory.

**Change:**

- When `crIsRequired` is false, the label reads "CR number (optional)".
- Nothing about _when_ it's required changes (D3).

Also check the dev tenant's Cash `PosPaymentMethodConfig.referenceIsRequired`. If it's on, the field is required again by config, which would explain the client still seeing it required. That is reported, not changed in code.

### 6 — Terms, months and rebate at checkout · **S** · BE + FE

**Today:**

- In-house lines show a months dropdown plus a monthly / total-payable preview (`checkout/page.tsx` ~6927-6938, 7075-7098).
- The success screen (~8883-8897) shows monthly and total but not the months.
- The rebate (PPD) shows nowhere.
- BE `financing-terms.service.ts:225-241` returns `ppd` only when a rate-card row prices the term.

**Change:**

- **BE preview:** returns `ppd` when asked (`includeRebate`, sent by checkout only): the rate card's, else 7.5% of the monthly, the rule the installment account uses when it is created (`installment-account.service.ts` ~572). B03/B04 prove the quote equals the account's figure. Opt-in so the credit application form's PR #199 prefill is unchanged.
- **FE line panel and success screen:** one line, "6 months · ₱1,760.00/mo · Rebate ₱132.00/mo · Total ₱10,560.00".
- In-house only (D4). TPF lines show their term and months, no rebate.

Chloe wrote most of the checkout lines around it. The change is additive (display only).

### 7 — Credit application follows the POS Price Use (CR-BR) · **S** · FE

"Raise credit application" (`checkout/page.tsx` ~2766-2811) writes `credit_application_draft` with the customer and items only. `NewCreditApplicationForm` spreads `...draft`, so the form falls back to WIP.

**Change:**

- Add `priceUseTypeId` and `financingTermId` from the cart's first installment line to the draft.
- If the cart's installment lines use different Price Uses, take the first line's and show a notice on the form (D5).
- The BE already prices items under `dto.priceUseTypeId`.
- The per-item "Estimated amount" display (Chloe's lines) is not touched.

### 8 — "1 of 1 assigned" in black · **XS** · FE

`TransferDetailModal.tsx:322` `font-normal text-zinc-400` → the file's body colour `text-[#17171c]`. The class is Chloe's (`c2f582046`); this is the client's ask, colour only.

### 9 — Carrier auto-fills "NIG" · **XS** · FE

The dispatch form's carrier (`TransferDetailModal.tsx:2123-2139`) defaults to `''` (~897, ~1158) and is required (FE schema `transfers/index.ts:155`, BE DTO `@IsNotEmpty`). Default both to `'NIG'`; it stays editable and required (D6). No BE change.

### 10 — Movement history: date only · **XS** · FE

`SerialHistoryContent.tsx:168` renders `formatDate · formatTime`. Drop the time. The Stockbook table itself already uses `formatShortDate`. This also affects the Item 360 drawer, which uses the same component; that's intended (same "stock book" reading). Author: Karms.

### 11 — Stock Balance filter shows the wrong units · **S** · BE

Two bugs in `inventory/services/stock.service.ts`:

- **(a)** The category filter matches the exact category (`primaryCategoryId: categoryId`, ~5022). Items filed under a subcategory vanish when the parent is picked in the tree picker.
  - **Fix:** resolve the category plus its descendants and filter with `{ in: [...] }` in `buildItemFilter`, which covers both the bulk and serial paths.
- **(b)** `resolveInTransitMap` (~5354-5391) only decorates rows that already exist (~5271-5274). A transfer to a branch that has never held the item adds nothing, and serial units `in_transit` are counted nowhere (~4941-4955).
  - **Fix:** create a row for every unmatched transit key.

Author: Karms. Both fixed (D7).

### 12 — Cash in Transit: reference number required · **XS–S** · FE + BE · **DROPPED (Kian, 2026-10-19)**

- **FE:** `slipsProblem` (`SlipEditor.tsx:181-186`) checks bank, amount and date. Add the reference. Record Deposit's disabled state and tooltip already read it, and so does the draft edit.
- **BE:** `PosDepositLineDto.reference` becomes `@IsNotEmpty` (trimmed). For the legacy no-slip path (`CreatePosDepositDto` with no `lines`), the deposit-level `reference` is required instead (D8).
- Old rows are untouched.

### 13 — Cash in Transit: note per slip · **XS** · FE · **DROPPED (Kian, 2026-10-19)**

`Slip.note` exists (`SlipEditor.tsx:25`) and is sent (~194), stored in `PosDepositLine.note VarChar(200)`, but has no input.

**Change:** add a Note input to `SlipRow` (max 200) and a Note column to the deposit detail (`PosDepositsView.tsx:283-297`).

### 14 — Floating Record Deposit · **XS–S** · FE · **DROPPED (Kian, 2026-10-19)**

There's no "End of Day" button anywhere in the code. The action users scroll back up for is **Record Deposit** in the Undeposited Funds header (`CashInTransitList.tsx:432-442`), while sessions are ticked further down (D9).

**Change:** a sticky bottom bar while `selection.rows.length > 0`: branch, sessions ticked, total, and Record Deposit. The header button stays.

### 15 — AP Bills: delivery destination column · **S** · BE + FE · **DROPPED (Kian, 2026-10-19)**

APBill has no destination. `findAll` (`ap-bills.service.ts:973-985`) includes `purchaseOrder` and `goodsReceipts` without names.

**Change:**

- **BE:** include `warehouse { name }` (and the PO's `branch { name }`) on the PO and RRs.
- **FE:** add a "Delivery destination" column to `APBillsList.tsx`, showing:
  - the PO warehouse name;
  - else the RR warehouse names, comma-joined;
  - else "—" (D10).

The list is Chloe's; adding a column doesn't undo anything of hers.

---

## Decisions (defaults taken, Kian can override before each part)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Item 2: a sale keeps its own timestamp. The session row shows its business date; checkout warns, never blocks, on a session opened on an earlier day.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D2  | **Confirmed by Kian 2026-10-19.** Item 3: hidden on screen only. Print and Excel keep the UNDEPOSITED lines (they are the signed form). The Balance column stays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D3  | **Confirmed by Kian 2026-10-19.** Item 5: Chloe's rule stands. A CR is still required for a DP, card, bank transfer, e-wallet and QR; only the label changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D4  | **Confirmed by Kian 2026-10-19.** Item 6: the rebate shows for in-house lines only, and the BE preview's fallback uses the account's own rule.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D5  | **Confirmed by Kian 2026-10-19.** Item 7: Price Use and term come from the first installment line; mixed Price Uses show a notice; the item price display is untouched. Kept as is after M3 (Kian, 2026-10-19). There is no note or PR on mixed Price Uses: an application has had one Price Use since Scenario 17 (FE #113), is priced from that list since Scenario 64 items 21/26 (#199/#185), and Continue to sale puts it on every cart line on purpose (44d6eae2, "an application approved under any other Price Use would have been priced at the till off a different list than the owner approved"). Per-item Price Use would be a scenario of its own. |
| D6  | Item 9: auto-fill "NIG"; the field stays editable and required.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D7  | Item 11: fix both causes (category descendants; in-transit to a new destination).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D8  | **Moot, Part 5 dropped.** Item 12: required for new deposits, FE and BE, on both the slip path and the legacy no-slip path.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D9  | **Confirmed by Kian for later (Part 5 dropped).** Item 14: "End of Day" = Record Deposit, as a sticky bar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D10 | **Confirmed by Kian for later (Part 5 dropped).** Item 15: PO warehouse, else RR warehouses, else "—".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D11 | Anything of Chloe's is touched additively only (items 5, 6, 8, 15). Nothing she decided is reversed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

---

## Build order

Each part is committed in each repo it touches (no co-author, not pushed) and stops for Kian's manual test.

| Part  | Items              | What                                                                  | Repos   |
| ----- | ------------------ | --------------------------------------------------------------------- | ------- |
| 1     | 1, 2               | POS Sessions: close at ₱0.00, session dates + date filter             | FE + BE |
| 2     | 3, 4               | Daily Collection: hide undeposited, print the roll-up                 | FE      |
| 3     | 5, 6, 7            | Checkout: CR (optional), terms/months/rebate, Price Use to credit app | FE + BE |
| 4     | 8, 9, 10, 11       | Inventory: colour, carrier, date only, Stock Balance filter           | FE + BE |
| ~~5~~ | ~~12, 13, 14, 15~~ | **Dropped** (Kian, 2026-10-19: POS and Inventory only, no accounting) | —       |

**Per part:**

1. Blame the lines to be touched; anything of Chloe's is worked around (D11).
2. Run that part's regression suites on the branch **before** editing (baseline).
3. Build, then run the new tests and the regressions, one suite per command.
4. `tsc --noEmit` in each repo touched, eslint + prettier on changed files.
5. Commit: `feat(<area>): Scenario 74 Part N — …`, no co-author.
6. Hand Kian that part's M-section, then stop.

---

## Tests

### How the tests run

- **One suite per command, never chained or looped.**
- **Baseline per part:** the part's regression suites run once before it is built. A failure already there is pre-existing: recorded, not fixed. Only a new failure blocks a part.
- **Backend e2e:** jest called directly with `DATABASE_URL` set inline to `the-prominent-enterprise-test` (skips `pretest:e2e`).
- **Playwright:** against a running scenario-74 pair: `E2E_BASE_URL=http://localhost:3000 E2E_FRONTEND_PORT=3000 E2E_BACKEND_PORT=3001`. No DB reset without Kian's word.
- **New specs create their own data** (terminal session, customer, item, stock, price-list row). The seed's stock and price lists don't overlap, and any spec that searches for "Universal Remote Control" can't pass on a seeded DB.
- Test IDs: `S74-<part>-<F|B|U><nn>` (F = Playwright, B = backend e2e, U = backend unit). Edge cases are marked **(edge)**.

### Part 1 — Sessions (items 1, 2)

**Backend e2e, new `test/scenario-74-pos-sessions.e2e-spec.ts`:**

| ID        | Case                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| S74-1-B01 | Open with ₱0 float, no sales, close with `declaredClosingCash: 0` and an empty breakdown → closed, variance 0   |
| S74-1-B02 | **(edge)** Expected > ₱0, close with 0 and no override → rejected with the variance-override marker (unchanged) |
| S74-1-B03 | **(edge)** Session opened 23:30 Manila on D (15:30Z): `dateFrom=D&dateTo=D` includes it                         |
| S74-1-B04 | **(edge)** Session opened 00:10 Manila on D+1 (16:10Z on D): `dateTo=D` excludes it, `dateFrom=D+1` includes it |
| S74-1-B05 | `dateFrom` only and `dateTo` only each bound one side                                                           |
| S74-1-B06 | **(edge)** `dateTo=not-a-date` → 400                                                                            |

**Playwright, new `e2e/pos-sessions-scenario-74.spec.ts`:**

| ID        | Case                                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S74-1-F01 | Session row shows its date and open time                                                                                                                    |
| S74-1-F02 | **(edge)** A shift that crossed midnight shows both dates — **manual only (M1 step 8)**: `closedAt` is server-stamped, so a browser test can't back-date it |
| S74-1-F03 | Date filter: a day with sessions → only that day; a day with none → empty state; Clear → all                                                                |
| S74-1-F04 | Close screen, nothing typed → Close disabled; "Drawer is empty" → enabled; expected ₱0 → "matches"; closes                                                  |
| S74-1-F05 | **(edge)** Coins "0" typed → counts as counted; Close enabled                                                                                               |
| S74-1-F06 | **(edge)** Expected > ₱0, "Drawer is empty" → Short verdict; reason required before Close                                                                   |
| S74-1-F07 | **(edge)** "Drawer is empty", then type a ₱100 count → empty flag clears, total ₱100                                                                        |
| S74-1-F08 | Checkout with a session opened on an earlier day → notice shown; today's session → no notice                                                                |

**Regressions:**

- **Playwright:** `closing-session-denominations`, `pos-session-list-ux-batch`.
- **BE e2e:** `closing-session-record`, `accounting-audit-log-pos-sessions`.

### Part 2 — Daily Collection (items 3, 4)

**Playwright, new `e2e/daily-collection-scenario-74.spec.ts`:**

| ID        | Case                                                                                      |
| --------- | ----------------------------------------------------------------------------------------- |
| S74-2-F01 | Branch day with cash still undeposited: no UNDEPOSITED row on screen (table and cards)    |
| S74-2-F02 | **(edge)** The same day's print pages still contain the UNDEPOSITED line                  |
| S74-2-F03 | **(edge)** Only UNDEPOSITED goes: every DEPOSIT line on the print copy is still on screen |
| S74-2-F04 | All-branches view has a Print button; clicking it calls `window.print` (stubbed)          |
| S74-2-F05 | **(edge)** All-branches print pages list every branch row and the totals                  |

nFixture: the ledger cases (F01–F03) look for a day with undeposited cash that the Business Owner can see (any branch, last 21 days) instead of ringing test sales onto a real branch's form. With none, they annotate and return, which is the suite's convention. On 2026-10-19 they found one and ran in full.

**Regressions:**

- **Playwright:** `daily-sales-monitoring`, `cashier-day-baseline`.
- **BE e2e:** `daily-collection-offsite-counters`.

### Part 3 — Checkout + credit application (items 5, 6, 7)

**How the rebate reaches checkout (as built).** `POST /pos/financing-terms/preview` takes a new optional `includeRebate`. With it, `ppd` is always present: the rate card's figure, else 7.5% of the monthly, which is the account's own fallback. Without it, `ppd` still means "a rate card was found". The opt-in exists because the first build changed the answer for every caller, and `pr199-credit-application` caught the credit application form prefilling its "PPD rebate" with 7.5% where PR #199 deliberately leaves it blank. Checkout sends it; nothing else does.

**Backend e2e, new `test/scenario-74-financing-preview.e2e-spec.ts`:**

| ID        | Case                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| S74-3-B01 | Factor-rate term, no rate card, `includeRebate` → `ppd` = 7.5% of the monthly, > 0; one line per month               |
| S74-3-B02 | Rate-card term → the card's monthly and PPD (unchanged)                                                              |
| S74-3-B03 | **(edge)** Sell the previewed line → the installment account's PPD equals the quoted one                             |
| S74-3-B04 | **(edge)** Qty 2 → the quote on the line total equals the account's PPD                                              |
| S74-3-B05 | **(edge)** Typed plan → 7.5% of the typed monthly                                                                    |
| S74-3-B06 | **(edge)** Without `includeRebate`: no rate card → no `ppd`; a rate card → its PPD (the credit application contract) |

**Playwright, new `e2e/pos-checkout-scenario-74.spec.ts`:**

| ID        | Case                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| S74-3-F01 | Plain Cash on Hand sale → the CR label carries "(optional)"                                                              |
| S74-3-F02 | **(edge)** In-house installment, DP paid in Cash → CR required, no "(optional)"                                          |
| S74-3-F03 | **(edge)** GCash → its reference stays required                                                                          |
| S74-3-F04 | In-house line: "N months · ₱X/mo … total" plus "Rebate ₱Y/mo when paid in full by the due date"; another term updates it |
| S74-3-F05 | Complete the plan → the success screen shows "N months" and the same rebate                                              |
| S74-3-F06 | **(edge)** Switch the line to TPF → no rebate, no in-house terms line                                                    |
| S74-3-F07 | "New credit application" from checkout → the form opens on the line's Price Use and term, no notice                      |
| S74-3-F08 | **(edge)** Two lines on different Price Uses → the notice names the first line's                                         |
| S74-3-F09 | **(edge)** New application from the list (no draft) → no notice                                                          |

**Regressions:**

- **Playwright (run):** `pos-checkout-typed-plan`, `credit-application-intake`, `pr199-credit-application`.
- **Playwright (not run):** `pos-checkout-price-use`, `pos-checkout-installment-credit-application`, `pos-checkout-installment-down-payment-floor`, `pos-checkout-payment-method-options` all search for the demo item "Universal Remote Control", which the seed deletes. They cannot pass on this DB whatever the code does.
- **BE e2e:** `pos-installment-financing`, `credit-application-financing`, `pos-typed-installment-plan`.

### Part 4 — Inventory (items 8, 9, 10, 11)

**As built.**

- **Stock Balance** reuses `expandCategoryFilterIds`, which the Items and Serial Numbers lists already use, on both the bulk and the serial path.
- **In transit:** stock is looked up by the balances' own item filter. A destination with stock on the way but no balance row gets a row of its own (`id: transit:<item>:<warehouse>`): nothing on hand, the travelling quantity in transit. These rows still respect search, category, branch and warehouse.
- **Carrier:** the dispatch form now shows "Carrier name is required" when the field is emptied. Before, the rule existed but Confirm Dispatch silently did nothing.

**Backend e2e, new `test/scenario-74-stock-balance.e2e-spec.ts`** (fixtures: two branches, a P → S → S2 tree plus Q, bulk and serial items, in-transit transfers):

| ID        | Case                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| S74-4-B01 | Parent P lists items filed under S (bulk and serial); Q's item is excluded                                                                   |
| S74-4-B02 | Leaf S2 → only its item; sibling Q → only its item                                                                                           |
| S74-4-B03 | **(edge)** Three levels: P reaches the S2 item                                                                                               |
| S74-4-B04 | Bulk item travelling to B (never held there) → a row at B, 0 on hand, 4 in transit                                                           |
| S74-4-B05 | **(edge)** Serial unit travelling to B → a row at B with 1 in transit; A keeps its 2 in stock; rolled up per item: 2 available, 1 in transit |
| S74-4-B06 | The "In transit" filter finds all three destination rows; summary in transit = 7                                                             |
| S74-4-B07 | **(edge)** Partly received (1 of 3 landed) → one row at B, 1 on hand + 2 in transit, never two rows                                          |
| S74-4-B08 | **(edge)** The category filter applies to transit-only rows too                                                                              |

Run once against unchanged `development` code: **6 of 8 fail** (B02 and B07 pass, as they should). So the suite does catch both bugs.

**Playwright, new `e2e/inventory-scenario-74.spec.ts`:**

| ID        | Case                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------- |
| S74-4-F01 | Dispatch form: "0 of 1 assigned" is the body colour rgb(23, 23, 28), not zinc-400                                           |
| S74-4-F02 | Carrier opens as "NIG" and can be changed                                                                                   |
| S74-4-F03 | **(edge)** Carrier cleared → "Carrier name is required", not dispatched                                                     |
| S74-4-F04 | Serial Number Locator → a unit's history: every entry date reads like "Oct 19, 2026", no time                               |
| S74-4-F05 | Stock Balance → pick the parent category → the item filed under its child is listed (one fixed fixture, reused across runs) |

The transfer in F01–F03 is created and accepted through the API, never dispatched, and cancelled afterwards, so no stock moves.

**Regressions:**

- **BE e2e:** `stock-balance-rollup`, `stock-balance-serial-tracked`, `stock-transfer-serial-in-transit`, `stock-transfer-partial-receipt`.
- **Playwright:** `inventory-stock-balance-rollup`, `inventory-stock-in-transit`, `inventory-serial-numbers-history`, `inventory-item-360-serial-movements`.
- **Not run:** `inventory-transfer-dispatch-multiselect`. It really dispatches **and receives** three serial units on the dev DB (its own header: "not self-cleaning"), which would move real stock between branches.

### Part 5 — Cash in Transit + AP Bills (items 12, 13, 14, 15) · DROPPED

Dropped by Kian on 2026-10-19 ("focus on POS and Inventory for this, no accounting"). No tests were written. The items and the two choices already made for them are in _Not in this scenario_.

### Final sweep, after Part 4 (Part 5 dropped)

Every regression suite above runs once more, one at a time, and is compared with the baseline.

**Run 2026-10-19, after the Payment Mode fix (`bcb21104`), one suite at a time:**

| Suite                           | Repo | Result                                      |
| ------------------------------- | ---- | ------------------------------------------- |
| `scenario-74-pos-sessions`      | BE   | 6/6                                         |
| `scenario-74-financing-preview` | BE   | 6/6                                         |
| `scenario-74-stock-balance`     | BE   | 8/8                                         |
| `pos-sessions-scenario-74`      | FE   | 7/7                                         |
| `daily-collection-scenario-74`  | FE   | 5/5                                         |
| `pos-checkout-scenario-74`      | FE   | 10/10 (incl. new S74-3-F10, the detour fix) |
| `inventory-scenario-74`         | FE   | 5/5                                         |

**Also done after Part 4:**

- **Payment Mode restore fix** (`bcb21104`, findings log #3, pre-existing, fixed on Kian's go-ahead). A restored cart with installment lines now brings the toggle back on Installment, the same as Continue to sale already does.
- **Dev DB tidy-up.** The 10 timestamped "E2E S74 …" test items left by earlier spec runs were zeroed with `ADJ-20261019-0011` / `-0012` (reason: miscounted) and archived. The checkout spec now reuses two fixed items (`E2E-S74C-1/-2`), and F05 reuses one fixed item and category pair.

### Baseline (filled before each part)

| Part | Suite                               | Repo | Before-part result  | Notes                                                                                                                                                              |
| ---- | ----------------------------------- | ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `closing-session-record`            | BE   | 19/19               | Run from the main `backend/backend` checkout (same base commit)                                                                                                    |
| 1    | `accounting-audit-log-pos-sessions` | BE   | 3/3                 | Same                                                                                                                                                               |
| 1    | `closing-session-denominations`     | FE   | 1/1                 | Run on the branch (see note)                                                                                                                                       |
| 1    | `pos-session-list-ux-batch`         | FE   | 3/4                 | **Pre-existing:** "Release Approvals is a tab alongside Checkout". Karms' `b6a771f9` (Oct 5) removed that tab from `PosNav`, and this branch doesn't touch the nav |
| 2    | `daily-collection-offsite-counters` | BE   | 15/15               | Part 2 is frontend-only; the backend is unchanged                                                                                                                  |
| 2    | `daily-sales-monitoring`            | FE   | 3/3                 | Run on the branch                                                                                                                                                  |
| 2    | `cashier-day-baseline`              | FE   | 1 passed, 3 skipped | Skips are by design: no seeded baseline day on the dev DB                                                                                                          |
| 3    | `pos-installment-financing`         | BE   | 10/32               | **Pre-existing:** 22 tests still expect the in-house release-form hold (`pending_approval`), which Scenario 71 retired; they get `completed`                       |
| 3    | `credit-application-financing`      | BE   | 34/34               |                                                                                                                                                                    |
| 3    | `pos-typed-installment-plan`        | BE   | 13/14               | **Pre-existing:** TP-14 still expects the 10% DP floor that Chloe removed on 2026-10-15 (`17356bf`)                                                                |
| 4    | `stock-balance-rollup`              | BE   | 24/24               |                                                                                                                                                                    |
| 4    | `stock-balance-serial-tracked`      | BE   | 2/2                 |                                                                                                                                                                    |
| 4    | `stock-transfer-serial-in-transit`  | BE   | 11/11               |                                                                                                                                                                    |
| 4    | `stock-transfer-partial-receipt`    | BE   | 12/12               |                                                                                                                                                                    |

FE baseline note: the Playwright regressions ran on the branch rather than on `development`, so the machine didn't have to restart both servers for a baseline. The one failure was checked against `development`'s source instead.

---

## Manual test script

Run on the **dev** DB with the scenario-74 worktree servers, after the 28 pending migrations are applied. After each part, run that part's section. Anything that differs goes in the _Findings log_.

### M0 — Setup

| Need                                                                         | Where                  |
| ---------------------------------------------------------------------------- | ---------------------- |
| A cashier and a Business Owner login; one branch (e.g. Bago) with a terminal | POS → Sessions         |
| ASTRON LED3277 on WIP and on CR-BR at Bago, with a 6-month term              | Price lists            |
| One serial item and one bulk item with stock at Bago only                    | Inventory              |
| A category with a subcategory, and an item filed under the subcategory       | Inventory → Categories |
| A closed session at Bago with cash still undeposited                         | POS → Sessions         |
| An AP bill made from a PO (and one entered with no PO)                       | Accounting → Payables  |

### M1 — Part 1: Sessions

1. POS → Sessions. → Each row shows a date ("Mon, Oct 19") before the open time.
2. Set the date filter to today. → Only today's sessions. Set it to a day with none → "No sessions found". Clear → all back.
3. Open a session with ₱0 float, make no sales, Close session. → Close is disabled until you count. Click **Drawer is empty — ₱0.00**. → Close is enabled and the verdict says the count matches ₱0.00. Close. → Lands on the Daily Collection form as before.
4. Open a session with ₱500 float, Close session, click **Drawer is empty**. → "Short by ₱500.00"; a reason is required; manager approval as before.
5. On the same screen, type 1 × ₱100. → The empty flag clears; counted ₱100.
6. Type "0" in Coins only. → Counts as counted; Close enabled.
7. Leave a session open overnight (or ask me to back-date one on dev), then open checkout. → The "opened yesterday" notice shows. A session opened today → no notice.
8. Close that overnight session after midnight. → Its row reads "opened Mon, Oct 19 · … closed Tue, Oct 20 1:05 AM": the close names its own day.

### M2 — Part 2: Daily Collection

Log in as the Business Owner and open **POS → Daily Collection**. The fixture day is **Bago, Mon Oct 13 2026**, which has undeposited CASH ₱95,193.60 and CHECK ₱21,000.00. It is not filed, and the owner can see it.

**A: undeposited is hidden on screen**

1. Set the branch switcher to **Bago**, the date control (‹ › arrows and a date box) to **Oct 13**, and the tab to **Collection report**. → The ledger table shows: Date, SI#, Customer, Desc … Amount / debit, Credit, Balance.
2. Scroll to the bottom of the ledger. → No row starts with **UNDEPOSITED**. Every collection row and every DEPOSIT row is still there, and so is the Balance column.
3. Narrow the window to phone width (cards). → No "UNDEPOSITED:" card.

**B: the print still has it**

4. **Print** on the same page. → Two pages (sales monitoring, then the collection form). Page 2's credit lines **do** show UNDEPOSITED CASH 95,193.60 and CHECK 21,000.00.
5. (Optional) **Export**. → The workbook has the UNDEPOSITED lines.

**C: Print on All branches**

6. Click "← All branches", or set the switcher to **All Branches**. → Three summary boxes and the **Branches** table.
7. → A **Print** button next to the date control (new).
8. **Print**. → One sheet: the company name, "Daily Collection Report — All branches" and the date. One row per branch in screen order (Branch, Entries, Total collection, Cash counted, Status in words, Note). An **ALL BRANCHES** totals row with "X of Y trading branches filed". Unfiled branches show "—", with the note under the table.
9. Switch the paper size between Letter, A4 and Legal. → The sheet fits each one.
10. On All branches, set the date to Oct 13 and print. → Oct 13's figures, with Bago's row.

**M2 — verified by Kian 2026-10-19** (all steps).

### M3 — Part 3: Checkout + credit application

Log in as the Business Owner with the switcher on **Bago**. The fixture items are **ASTRON LED3277**: serial-tracked, CR-BR ₱9,460, rate card 6 months ₱1,565/mo with ₱120 rebate, 12 months ₱900/mo with ₱70 rebate. The second item is **ASTRON LED4277** (42", WIP ₱14,760 / CR-BR ₱13,220).

**A: CR number**

1. Checkout, add LED3277 and pick a unit, Cash on Hand. → **CR Number (optional)**.
2. Click GCash. → Red **\***, no "(optional)". Back to Cash on Hand.

**B: months and rebate**

4. Pick a customer, **Installment** → **Inhouse Installment**.
5. Set CR-BR and **6 months**. → **6 months · ₱1,565.00/mo**, **₱9,390.00 total**, **Rebate ₱120.00/mo when paid in full by the due date**.
6. Change to **12 months**. → **₱900.00/mo**, **₱10,800.00 total**, **Rebate ₱70.00/mo**.
7. Under "Down Payment", click **Cash**. → The CR Number gets a red **\***.
8. Click **TPF Installment**. → The terms box and the rebate line disappear.

**C: Price Use to the credit application** (always a **fresh cart**; see finding 2)

9. LED3277, a customer with no approved application, Installment → Inhouse, CR-BR, 6 months, **New credit application**. → The form opens with LED3277, **Price Use CR-BR**, **term 6 months**, and no yellow note.
10. A fresh cart with **LED3277 on CR-BR** and **LED4277 on WIP**, both in-house with a term, then **New credit application**. → Two items, **Price Use CR-BR**, and the **yellow note** naming CR-BR. Two units of the _same_ item share one Price Use selector in checkout, so they can't produce the note.
11. Credit Applications → New directly. → No note; Price Use WIP.

**D: success screen** (optional; needs an approved application)

12. Complete an in-house sale on CR-BR, 6 months. → **Terms: 6 months**, **Rebate (paid on time): ₱120.00/mo**.

**M3 — verified by Kian 2026-10-19** (steps 1–11; step 12 is optional and was not run).

### M4 — Part 4: Inventory

Log in as the Business Owner.

**A: transfer dispatch**

1. Inventory → Stock Transaction → Transfers → **New transfer**: Bago → another branch, ASTRON LED3277 × 1. **Accept** it if asked.
2. Open it → **Dispatch**. → "(0 of 1 assigned)" is **black**; **Carrier / Logistics Company** reads **NIG**. The carrier box is on the Dispatch form only, under Logistics / Driver, not on New transfer.
3. Type over the carrier. → Editable.
4. Clear it and **Confirm Dispatch**. → **"Carrier name is required"**; nothing is dispatched.
5. **Back**; cancel the transfer if not wanted.

**B: serial history, date only**

6. Inventory → Stock Ledger → **Serial Number Locator**, unit **24459004089651** (ASTRON). → Every entry shows a date like "Oct 13, 2026" and no time.

**C: Stock Balance category filter** (dev data: **Electric Fan** has no items of its own; they're filed under Desk Fan, Exhaust Fan, Box Fan, Stand Fan)

7. Stock Balance → All Categories → **Electric Fan**. → Fans of every sub-type are listed. Before the fix the list was empty.
8. **Stand Fan**. → Stand fans only.
9. (Optional) **Refrigeration** / **Airconditioner**. → Their sub-types.

**D: in transit to a new branch** (optional; dispatches a real unit)

10. Dispatch a real transfer to a branch that never held the item.
11. Stock Balance, that branch, **In transit**. → The item with 0 on hand and the quantity under Transferred. Receive it afterwards.

**M4 — verified by Kian 2026-10-19** (steps 1–9; D is optional and was not run).

### M5 — Part 5: dropped

Part 5 was dropped (Kian, 2026-10-19: POS and Inventory only, no accounting). See _Not in this scenario_.

### Findings log

| #   | Step  | What happened                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Expected                              | Fixed in                                  |
| --- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------- |
| 1   | M1-2  | The From/To boxes opened their calendar only from the small icon; clicking the text just selected month/day/year                                                                                                                                                                                                                                                                                                                                                      | A click anywhere opens the calendar   | Part 1 follow-up: `showPicker()` on click |
| 2   | M3-10 | The first script asked for two units of the **same** item on different Price Uses. Checkout gives same-item units one shared Price Use selector, so that can't happen                                                                                                                                                                                                                                                                                                 | Use two different items               | Script corrected (LED3277 + LED4277)      |
| 3   | M3-10 | After going to "New credit application" and coming back, a newly added unit reached the form as nothing (1 item, not 2). The restored cart keeps its Installment lines but the **Payment Mode** toggle resets to Cash, so the new unit is a cash line. **Pre-existing**: the restore is Kian's #179 (2026-09-21); lines follow the toggle per Chloe (2026-08-21 / 09-02). Chloe's `e49b2a0e` (Oct 7) only covers the Continue-to-sale path. Not fixed; Kian to decide | The toggle follows the restored lines | — (workaround: click Installment again)   |

**M1 — verified by Kian 2026-10-19** (steps 1–8). Steps 7–8 used a session back-dated on the dev DB, on the E2E S74 Terminal only. Kian looked at a range calendar and a simpler one-tap calendar for the filter, then chose to keep the plain From/To boxes.

## Test results

**Migrations:** the 28 `development` migrations from 2026-10-13..16 were applied to the dev and test DBs on 2026-10-19 (Kian's go-ahead) before any run.

| Part | Suite                                                                                                                           | Repo | Result           | Baseline | Verdict                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `scenario-74-pos-sessions` (new)                                                                                                | BE   | 6/6              | —        | pass                                                                                                                                                                         |
| 1    | `pos-sessions-scenario-74` (new)                                                                                                | FE   | 7/7              | —        | pass (F08 needed two locator fixes in the spec itself: the picker's hidden `<option>` and the code-based label)                                                              |
| 1    | `closing-session-record`                                                                                                        | BE   | 19/19            | 19/19    | pass                                                                                                                                                                         |
| 1    | `accounting-audit-log-pos-sessions`                                                                                             | BE   | 3/3              | 3/3      | pass                                                                                                                                                                         |
| 1    | `closing-session-denominations`                                                                                                 | FE   | 1/1              | —        | pass                                                                                                                                                                         |
| 1    | `pos-session-list-ux-batch`                                                                                                     | FE   | 3/4              | —        | 1 pre-existing failure (see Baseline)                                                                                                                                        |
| 1    | `tsc --noEmit`, eslint (13 → 13 warnings, none new), prettier                                                                   | both | clean            | —        | pass                                                                                                                                                                         |
| 2    | `daily-collection-scenario-74` (new)                                                                                            | FE   | 5/5              | —        | pass (the ledger cases ran on a real undeposited day, not skipped)                                                                                                           |
| 2    | `daily-collection-offsite-counters`                                                                                             | BE   | 15/15            | 15/15    | pass                                                                                                                                                                         |
| 2    | `daily-sales-monitoring`                                                                                                        | FE   | 3/3              | —        | pass                                                                                                                                                                         |
| 2    | `cashier-day-baseline`                                                                                                          | FE   | 1 + 3 skipped    | —        | pass (skips by design)                                                                                                                                                       |
| 2    | `tsc --noEmit`, eslint (no warnings in changed files), prettier                                                                 | FE   | clean            | —        | pass                                                                                                                                                                         |
| 3    | `scenario-74-financing-preview` (new)                                                                                           | BE   | 6/6              | —        | pass                                                                                                                                                                         |
| 3    | `pos-checkout-scenario-74` (new)                                                                                                | FE   | 9/9              | —        | pass (F03/F04 ran, not skipped)                                                                                                                                              |
| 3    | `pos-installment-financing`                                                                                                     | BE   | 10/32            | 10/32    | same 22 pre-existing failures                                                                                                                                                |
| 3    | `credit-application-financing`                                                                                                  | BE   | 34/34            | 34/34    | pass                                                                                                                                                                         |
| 3    | `pos-typed-installment-plan`                                                                                                    | BE   | 13/14            | 13/14    | same TP-14 pre-existing failure                                                                                                                                              |
| 3    | `pos-checkout-typed-plan`                                                                                                       | FE   | 7/7              | —        | pass                                                                                                                                                                         |
| 3    | `credit-application-intake`                                                                                                     | FE   | 1/1              | —        | pass                                                                                                                                                                         |
| 3    | `pr199-credit-application`                                                                                                      | FE   | 6/6              | —        | pass after the `includeRebate` opt-in. It caught the first build ("LCP/PPD follow the item and term": PPD prefilled 179.4 instead of blank)                                  |
| 3    | 4 `pos-checkout-*` regressions                                                                                                  | FE   | not run          | —        | need the seed-deleted "Universal Remote Control"                                                                                                                             |
| 3    | `tsc --noEmit` both, eslint (11 → 11 warnings, none new), prettier                                                              | both | clean            | —        | pass                                                                                                                                                                         |
| 4    | `scenario-74-stock-balance` (new)                                                                                               | BE   | 8/8              | —        | pass (6/8 fail on `development` code: the bugs are caught)                                                                                                                   |
| 4    | `inventory-scenario-74` (new)                                                                                                   | FE   | 5/5              | —        | pass                                                                                                                                                                         |
| 4    | `stock-balance-rollup` · `stock-balance-serial-tracked` · `stock-transfer-serial-in-transit` · `stock-transfer-partial-receipt` | BE   | 24 · 2 · 11 · 12 | same     | pass                                                                                                                                                                         |
| 4    | `inventory-stock-in-transit`                                                                                                    | FE   | 13/13            | —        | pass                                                                                                                                                                         |
| 4    | `inventory-stock-balance-rollup`                                                                                                | FE   | 4/9              | —        | **pre-existing**: it looks for a `<table>` header and region buttons the current grid no longer has (spec from 2026-09-14). The API answered 200 with rows on the same calls |
| 4    | `inventory-serial-numbers-history`                                                                                              | FE   | 0/1              | —        | **pre-existing**: Karms' `0f77c880` (Oct 6) removed serial links from the stock book tab; the history lives on the Locator tab                                               |
| 4    | `inventory-item-360-serial-movements`                                                                                           | FE   | 0/1              | —        | **pre-existing**: expects the drawer link's text, now with ages ("RR 9 Mo(s) · Branch 9 Mo(s)"), verbatim in the history title                                               |
| 4    | `inventory-transfer-dispatch-multiselect`                                                                                       | FE   | not run          | —        | would dispatch and receive real stock on the dev DB                                                                                                                          |
| 4    | tsc, eslint (no new warnings), prettier                                                                                         | both | clean            | —        | pass                                                                                                                                                                         |

---

## Found, not fixed (pre-existing; reported only)

- **"Counter collections" on the close screen counts cash delivery-fee receipts as installment dues.** `sessions.service.ts` ~301-304 has no `purpose` filter. The expected-drawer figure is still right; only the label is wrong.
- **`PosDate` shows the UTC date** (`pos/_components/PosDate.tsx`, `iso.slice(0,10)`), so 00:00–08:00 Manila reads as the previous day. Only promo codes use it today.
- **Switching the Cash sub-mode clears a typed CR** (`checkout/page.tsx` ~2091-2114, Chloe).
- **`PosTransaction.rebateEligible`** exists, but nothing sets it.
- **`e2e/pos-session-list-ux-batch.spec.ts` "Release Approvals is a tab"** fails on `development`. Karms' `b6a771f9` (Oct 5) dropped that tab from `PosNav`, but the spec wasn't updated.
- **`pos-installment-financing.e2e-spec.ts`: 22 of 32 tests fail on `development`.** They still expect an in-house installment sale to wait in `pending_approval` for a release form, but Scenario 71 posts it at once.
- **`pos-typed-installment-plan.e2e-spec.ts` TP-14 fails on `development`.** It still expects the 10% down-payment floor that Chloe removed on 2026-10-15.
- **4 `pos-checkout-*` Playwright specs can't run on a seeded DB.** They need the demo item "Universal Remote Control", which the seed's cleanup deletes.
- **The checkout down-payment box still says "10% default"** although the 10% floor is gone (Chloe, 2026-10-15). Copy only, and hers.
- ~~Payment Mode isn't restored after the "New credit application" detour~~: **fixed in `bcb21104`** on Kian's go-ahead.
- **Three inventory Playwright specs are out of date on `development`:** `inventory-stock-balance-rollup` (5 of 9), `inventory-serial-numbers-history`, `inventory-item-360-serial-movements`. See the Part 4 results.
- ~~Test items left on the dev DB by checkout specs~~: **cleaned up** (zeroed and archived, see Final sweep), and the specs now reuse fixed items.
- **Stock Balance's "Transferred" header shows in-transit qty** (`StockBalanceList.tsx` ~357-359).
- **Cash in Transit history:** Deposited rows show the amount collected, not the amount banked; partial deposits only show once settled; `citClearingJournalEntryId` is overwritten per clearing; `depositedTo` reads a field itemised deposits never set. This is note line "Balance for Cleaning", which is not in this scenario.

## Not in this scenario

| Note line                                            | Why it waits                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Split payment (cash + GCash)                         | Reverses Chloe's one-method-per-sale design (`e264f1ead`); L                                                                                                       |
| Record under A/R until delivery                      | Which amount? Likely a migration; L                                                                                                                                |
| Cash on hand "interchangeable"                       | Ambiguous: three readings                                                                                                                                          |
| Allow ₱0.00 down payment                             | Conflicts with "in-house never 0" and Chloe's Oct 15 rule; TPF-only = Scenario 71 Part 2                                                                           |
| No rebate on partial payments                        | Reverses Chloe's "late rebate allowed"; two BE paths + FE                                                                                                          |
| Amount due in the Due tab                            | Chloe's deliberate design; three possible readings                                                                                                                 |
| Session close: payment methods + MI box              | M; best done with the counter-collections label bug above                                                                                                          |
| Bank full names (MBTC → Metrobank)                   | Needs the full name for each code (BDO-Q, BDO-GF, LB-PSB, Sbank…)                                                                                                  |
| Branch accounts pick the caravan                     | Needs scope: any running caravan, or own branch/region                                                                                                             |
| RR move above (Books)                                | Which screen: JE lines or the hub tabs                                                                                                                             |
| Stock transfer: enter available quantities           | Read-only column (S) or editable "qty we can send" (M, migration)                                                                                                  |
| "Balance for Cleaning" → Collected Funds History     | M, mostly Chloe's BE; root cause is in _Found, not fixed_                                                                                                          |
| Cash in Transit: reference number required (item 12) | **Dropped from Scenario 74 by Kian (2026-10-19): "focus on POS and Inventory, no accounting".** Still open: which reference (bank slip per slip vs. whole deposit) |
| Cash in Transit: note per slip (item 13)             | Dropped with item 12. The note is already stored and sent; only the input and the detail column are missing (XS)                                                   |
| Floating "End of Day" button (item 14)               | Dropped with item 12. **Decided for later:** "End of Day" = **Record Deposit**, as a bar stuck to the bottom once sessions are ticked                              |
| AP Bills: delivery destination column (item 15)      | Dropped with item 12. **Decided for later:** show the **PO's warehouse**, else the RR warehouse(s), else "—"                                                       |

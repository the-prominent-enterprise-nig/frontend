# Scenario 51 — Correcting a Unit Cost on a Receiving Report — Gap Analysis & Implementation Plan

**Source**: developer decision, 2026-09-14, arising directly from a re-reading of client line 3 of the 2026-09-13 meeting list ("RR — what was received; if edited should reflect on the AP").

The one idea:

> **A cost that was typed in wrong must be fixable, and fixing it must reach the books.**

Today it is not fixable at all. `unitCost` cannot be edited anywhere — not on the receiving report, not through any other screen — and the escape hatch the code claims exists was never built.

## Related ClickUp Tickets

None yet. Create via the `clickup-create-ticket` skill.

---

## This reverses a decision recorded one day earlier

Scenario 50's plan doc says, of the same client lines:

> `quantityReceived` and `unitCost` being uneditable on a receiving report is **correct by design**, not a missing feature. The PO says how much; a receipt does not get to contradict it.

That framing is now **half-reversed by the developer (2026-09-14)**:

- **Quantity stays frozen.** Scenario 50's reasoning holds. Quantity is a physical claim about what came off the truck; the fix for a wrong one is a stock count, not a document edit.
- **Unit cost opens up.** The reasoning does not hold here. A cost is a claim about what we agreed to pay, and it is routinely mistyped. The PO-is-source-of-truth argument does not cover the case where the PO itself carried the wrong price, or where the supplier's invoice differs from what was ordered.

`scenario-checklist.md` line 5 repeats the "correct by design" conclusion in its Scenario 50 summary. **It needs amending when this lands**, or the next reader will find two documents in direct contradiction.

The same Scenario 50 doc also recorded, under "one hole in them":

> that restate moves VAT, withholding and total only. It never recomputes `subtotal` … Either the notice should not fire for a price-only edit, or the restate should carry the price through. Not part of this scenario; noted so it is not rediscovered.

**This scenario closes that hole**, and takes the second of the two options: the restate carries the price through.

---

## Finding 1 — the documented escape hatch does not exist

`stock.service.ts`'s `updateReceivingReport` doc comment states:

> Corrections that must reach the ledger belong on the AP bill, where the difference posts as a real entry against the same stock.

Traced on 2026-09-14. **No part of that sentence is implemented.**

| Claim                                       | Reality                                                  |
| ------------------------------------------- | -------------------------------------------------------- |
| Corrections belong on the AP bill           | `subtotal` _is_ in `UpdateAPBillDto`, so it can be typed |
| …where the difference posts as a real entry | `update()` writes **no journal entry at all**            |
| …against the same stock                     | Nothing touches `StockCostLayer`                         |

And for a receipt-sourced bill it cannot post even in principle: `receive()` takes the `matchedReceiptsAlreadyPosted` branch and deliberately posts nothing, because the receipt already posted `Dr Inventory / Cr AP` when the goods landed. `supersedeFromReceipt()` copies `subtotal: bill.subtotal` across unchanged, so raising a replacement invoice does not fix a cost either.

**Net: there is currently no path, anywhere in the system, that corrects a wrong unit cost in the ledger.** Editing the AP bill's subtotal changes a number on a document and leaves the GL, the cost layers and the stock valuation untouched — and once the higher amount is disbursed, AP is left carrying a residual debit that nothing accounts for.

## Finding 2 — landed cost has the same allocation bug, live today

`landed-cost.service.ts` posts `Dr Inventory / Cr AP` for the **full** `totalLandedCost`, but the loop immediately above it only increments `stockCostLayer` rows filtered `fullyConsumed: false`.

So any landed cost applied after some of the stock has already sold debits Inventory in the GL by more than the cost layers actually rose. The GL and the cost-layer subledger diverge silently; nobody finds it until a stock valuation report disagrees with the balance sheet.

The consumed portion should go to `COGS_EXPENSE`. This is the identical allocation problem Scenario 51 has to solve, so **the developer's call (2026-09-14) is to fix it here rather than file it separately** — both paths share one split helper instead of the logic being written twice and diverging.

## Finding 3 — a settled invoice will not come off "paid" by itself

`recomputeInvoiceStatus()` produces the right answer: cash paid of ₱10,000 against a total raised to ₱12,000 is `PARTIAL`.

But `displayInvoiceStatus()` guards on `LIVE_STATUSES = ['SENT', 'RECEIVED', 'PARTIAL', 'OVERDUE']`. `PAID` is absent — deliberately, since until now nothing could raise a total after settlement. A bill stored as `PAID` therefore never re-evaluates.

The correction must **write the status back explicitly**. It looks like it should just work, and it will not.

## Finding 4 — a neighbouring feature has the identical silence, found while building Part 1

`costing.service.ts`'s `createItemRevaluation` — a separate, existing "correct this item's cost outright" screen — rewrites open cost layers to a new absolute cost and records an `ItemRevaluation` row carrying `previousCost`, `newCost`, `adjustmentAmt`, a reason code and notes. It posts **no journal entry at all**. Inventory value changes on paper and the general ledger is never told — the same class of gap as Finding 1, on a different screen, with its own already-computed `adjustmentAmt` just sitting there unused. `ItemRevaluation.journalEntryId` already exists on the schema; nothing had ever written it.

It is a genuinely different operation from this scenario's own correction — item/warehouse-wide and absolute, versus this scenario's receipt-scoped and delta-based — so it is fixed as its own addition (Part 5) rather than folded into the same code path. It reuses the `adjustmentAmt` this feature already computes and posts `Dr/Cr Inventory` against `DEFAULT_EXPENSE`, the same counterparty `adjustments.service.ts` already uses for every other inventory value change (a stock-count net gain/loss, a write-off) — not a new, dedicated variance account.

---

## The allocation rule

The credit is fixed: the supplier is owed the full difference. The debit side splits by how much of each cost layer is left.

Worked example — 10 units received at ₱1,000, true cost ₱1,200, six already sold:

```
Dr Inventory      800     4 units still on hand  × ₱200
Dr COGS         1,200     6 units already sold   × ₱200
Cr Accounts Payable     2,000
```

Splitting whole layers on `fullyConsumed` instead — Dr Inventory 800 against Cr AP 2,000 — **does not balance and cannot post**. Forcing it to balance by debiting Inventory the full ₱2,000 is exactly the landed-cost bug in Finding 2.

Layers are partially consumed, so the split is proportional per layer, not per layer-status:

- **Inventory portion** = `remainingQty × delta`
- **COGS portion** = `(originalQty − remainingQty) × delta`

Summed across every layer the line produced. When nothing has sold, the COGS line is zero and the entry is plain `Dr Inventory / Cr AP` — the same shape landed cost posts today.

`COGS_EXPENSE` already exists as a mapping key.

---

## Decisions taken

| Question                                               | Decision                                                                                                                                                                                                              | Decided    |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| New journal entry, or amend the receipt's?             | **New adjusting entry.** The original stays untouched.                                                                                                                                                                | 2026-09-14 |
| Who may correct a cost?                                | **Anyone, for now.** No role restriction.                                                                                                                                                                             | 2026-09-14 |
| Does a paid invoice block the edit?                    | **Warn, don't block** — and write the bill back to `PARTIAL`.                                                                                                                                                         | 2026-09-14 |
| Must the accountant say why?                           | **Yes** — a required reason, shown on the receipt and the entry.                                                                                                                                                      | 2026-09-14 |
| Fix landed cost here or separately?                    | **Here**, sharing one split helper.                                                                                                                                                                                   | 2026-09-14 |
| Quantity too?                                          | **No.** Quantity stays frozen.                                                                                                                                                                                        | 2026-09-14 |
| Transferred stock — a third bucket?                    | **No.** Dissolved — the premise was wrong; a transfer never consumes cost layers. See Open questions.                                                                                                                 | 2026-09-14 |
| Per-serial cost?                                       | **No.** Layers only — `SerialNumber` has no cost field and nothing reads one.                                                                                                                                         | 2026-09-14 |
| A real cost on a freebie line?                         | **Allowed**, and it clears `isFreebie`.                                                                                                                                                                               | 2026-09-14 |
| Fix Finding 4 (silent revaluation) here or separately? | **Here, as its own Part 5.** Genuinely different operation from the receipt correction; reuses the counterparty pattern `adjustments.service.ts` already established (`DEFAULT_EXPENSE`), not a new variance account. | 2026-09-14 |

On amending versus posting anew: `journal-entries.service.ts` already refuses it — _"Cannot edit a POSTED journal entry. Reverse it instead."_ Posted entries are immutable here, and amending one would silently restate a closed period.

---

## The flow, in plain language

**1. The accountant opens the receiving report.** Unit cost is now an editable field. Quantity is still plain text.

**2. They change the cost.** The form immediately says this is not cosmetic: how much more (or less) is owed, and how many of the units are still in stock versus already sold — the fact that decides where the money lands, and the one thing the receipt itself does not show.

**3. They give a reason and confirm.** The confirmation spells the entry out in words, not account names: inventory value rises by X for the units on hand; cost of goods sold rises by Y because units already sold were costed too cheaply, so those sales were recorded as more profitable than they were; the supplier is owed Z more. If the invoice is already settled, it also warns that it will go back to partially paid.

**4. On confirm, four things happen.** The receipt shows the corrected cost. A new entry posts, dated today, leaving the original receipt entry intact — so the history reads honestly: this is what we believed then, this is the correction now. The remaining units are revalued. The AP invoice is flagged.

**5. Someone opens the AP invoice** and finds the existing amber _RR has been edited_ banner — but now with a populated change table, showing the subtotal actually moving. Today that table is almost always empty, because cost could not move.

**6. They accept it.** The invoice restates. The banner clears. **Nothing further posts** — the books were corrected at step 4. The receipt owns the posting in this system; accepting on the AP side is bookkeeping catching up, not a second event. Posting again would double the correction.

---

## Parts to build

Each part gets its own e2e coverage and manual test steps, and stops for confirmation before the next begins.

**Part 1 — the split helper, and landed cost onto it.** Extract the proportional `remainingQty`/`originalQty` allocation as a shared unit. Route `landed-cost.service.ts` through it, fixing Finding 2. Landed cost gets measurably more correct here; that must be called out in the PR rather than arriving as a surprise.

**Part 2 — the correction itself.** `unitCost` and a required reason into the receiving-report update path; the delta computed; layers adjusted proportionally; the adjusting entry posted via the shared helper; the receipt's own totals brought up. Handle a negative delta (entry flips). Bump `contentEditedAt` so the existing AP flag fires.

**Part 3 — AP catches up.** Extend the restate to carry `subtotal` (closing Scenario 50's recorded hole). Write a settled bill back to `PARTIAL` per Finding 3. Verify the banner's change table is populated for a cost edit, and that accepting posts nothing.

**Part 4 — the remaining screens.** The paid-invoice warning, and the reason surfaced on the posted entry's own detail view.

> **Reordered 2026-09-14, at the developer's instruction.** The editable field, impact summary and reason input were originally Part 4 and were pulled forward into Part 2, because a backend-only part is not manually testable — verifying it needed a hand-written `curl`, which is not a test anyone will actually run. Each part now lands with enough UI to exercise it. Later parts follow the same rule.

**Part 5 — revaluation stops being silent.** `costing.service.ts`'s `createItemRevaluation` (Finding 4) rewrote cost layers and posted nothing to the general ledger — the schema already carried an unused `ItemRevaluation.journalEntryId` column. Posts now, mirroring `adjustments.service.ts`'s existing `postAdjustment()` pattern (`Dr/Cr Inventory` against `DEFAULT_EXPENSE`, this codebase's established counterparty for every other inventory value change) rather than inventing a dedicated variance account. `previousCost`/`newCost`/`adjustmentAmt` are read, never recomputed. No frontend screen for this endpoint existed before or exists now — out of scope for this scenario, same as before.

**Part 6 — amend `scenario-checklist.md`** so the Scenario 50 "correct by design" conclusion does not stand unqualified against this one, and record this scenario's own line.

---

## Open questions — resolved 2026-09-14

All four were put to the developer before implementation began. Two rested on
premises that turned out to be false once checked against the live code;
both are corrected here rather than left as originally written.

- **~~Stock that has moved branch.~~ Dissolved — the premise was wrong.** The
  original wording assumed a transfer consumes cost layers at the source and
  writes new ones at the destination. It does not: `transfers.service.ts`
  has zero references to `stockCostLayer` and never calls into
  `costing.service.ts` — a transfer only writes `StockLedger` rows and moves
  `StockBalance`. Origin layers keep their full `remainingQty` across a
  transfer, so a later correction already routes that quantity to
  Inventory, which is correct. **No third bucket needed — the two-bucket
  Inventory/COGS split stands as designed.** (This does surface a
  pre-existing, separate gap: stock that has moved warehouse by transfer
  carries no cost layers of its own at the destination at all — found again,
  the hard way, while writing this scenario's own e2e tests for Part 5. Real,
  out of scope here, not touched.)
- **~~Serial-tracked items.~~ Dropped — layers only.** `SerialNumber` carries
  no cost field of any kind, and nothing in the system resolves cost from a
  serial row. Valuation and COGS both read from cost layers, which the
  correction already adjusts; a per-serial field would have been write-only
  data.
- **Freebie lines — decided.** A correction is allowed to put a real cost on
  a line marked `isFreebie`, and doing so clears the flag. Setting a real
  cost means the line was not actually free, so the flag is what gives way
  — the two rules can no longer contradict each other. Implemented in Part 2.
- **Closed periods.** Unchanged, and still open: the correction posts to
  today's period, never backdated. The confirmation dialog should name the
  period it lands in — **not yet built**, since Part 4 only added the
  paid-invoice warning, not a period-aware message.

## Risks

- **The COGS line restates past profitability.** That is the correct accounting and also the thing most likely to be questioned. The confirmation wording carries the whole weight of making it understood before it is posted.
- **No role restriction.** Anyone can post a GL entry through this path. Deliberate for now, and worth revisiting before the client's own staff use it.
- **Landed cost changes behaviour in the same release.** Its inventory debit will drop for any application over partly-sold stock. Correct, but it will look like a regression to anyone comparing against the old numbers.

## Accepted tradeoffs

- The original receipt entry is never corrected, only supplemented. Reading the true cost of a receipt means reading two entries. This is deliberate and standard.
- Quantity remains uncorrectable by design, so a wrong quantity still needs a stock count.

## Verification

Parts 1–5 implemented and automated-tested. See the Implementation Log below
for the full run. Not yet manually clicked through by the developer as of
this log entry.

25 e2e (`backend/test/rr-unit-cost-correction.e2e-spec.ts`) + 10 unit
(`cost-layer-allocation.util.spec.ts`) cover: nothing-sold (all inventory),
all-sold (all COGS), partly-sold (the split), a downward correction, a
no-op resubmit raising no entry (both the cost-edit path and the ordinary
document-edit path), a correction against a settled invoice (Part 3), a
landed cost applied over partly-sold stock (Part 1), and a revaluation
write-up/write-down/no-op (Part 5).

Zero regressions: the same suite of neighbouring specs
(`inventory-receiving-enhancements`, `stock-receiving-gl-ap-posting`,
`ap-bill-from-receipt`, `ap-disbursement-voucher`,
`accounting-audit-log-inventory-costing`) reports an identical pass/fail
count with and without this scenario's backend changes stashed out —
44 failed / 41 passed both ways, all pre-existing.

**One flake found and fixed during Part 5's own test-writing, worth
recording so it is not mistaken for a code defect if seen again**: an
earlier version of the Part 5 tests picked items from the real seed
catalog to revalue. 38 of this tenant's 41 non-serial-tracked items
already carry stock in the branchless receiving warehouse, and the tests'
own cleanup never removed the `StockBalance` rows they created — so each
run of the suite permanently marked another few items "already stocked,"
and the pool of genuinely fresh items silently exhausted itself within a
handful of runs, at which point every test in the file started failing
with "need at least 4 items." Fixed by giving the revaluation tests their
own throwaway `Item` rows instead of borrowing from the catalog, fully
created and deleted within the test file's own lifecycle. After the fix:
15 of the next 16 full runs passed cleanly; one flake occurred with its
error detail lost to a logging mistake on this end and has not
reproduced across 10 further attempts since. Recorded rather than hidden
— this class of cross-run e2e flakiness is already a known, documented
property of this codebase's suite (see `scenario-checklist.md`'s own
notes on sequence-generator races), not something this scenario
introduced.

## Implementation Log — 2026-09-15

**For this scenario, I have done:**

- **Part 1** — `src/inventory/utils/cost-layer-allocation.util.ts`, the shared proportional Inventory/COGS split, and `landed-cost.service.ts` routed through it. Fixes the live bug in Finding 2: it debited Inventory the full landed cost while only incrementing cost layers still `fullyConsumed: false`.
- **Part 2** — `unitCost` and `costCorrectionReason` on `UpdateReceivingReportDto`/line DTO; `stock.service.ts`'s `updateReceivingReport` revalues cost layers, posts a new adjusting journal entry (split Inventory/COGS, flips sides on a downward correction), and clears `isFreebie` when a real cost lands on a freebie line. Frontend: `ReceivingReportEditForm.tsx` — the unit cost field, the impact summary panel, the required reason, Save disabled until it's filled in.
- **Part 3** — `ap-bills.service.ts`'s `receiptChanges`/`applyReceiptChanges`/`supersedeFromReceipt` now compute and restate `subtotal` from the receipts' own lines (closing the hole Scenario 50 recorded), and `applyReceiptChanges` writes a settled bill's status back from `PAID` to `PARTIAL` when the correction raises the total past what was already paid.
- **Part 4** — `getReceivingReport()` now includes the linked AP bill's status; the edit form warns before saving when that invoice is already `PAID`. The reason-on-the-entry half of this part needed no new code — the Journal Entry detail page already renders each transaction line's description, and Part 2 already embeds the reason there.
- **Part 5** — `costing.service.ts`'s `createItemRevaluation` (Finding 4, found while building Part 1) now posts a journal entry using its own already-computed `adjustmentAmt`, mirroring `adjustments.service.ts`'s existing `Dr/Cr Inventory` against `DEFAULT_EXPENSE` pattern. No frontend screen for this endpoint existed before or was added now.
- **Part 6** — this log entry, the doc's Open Questions/Parts/Decisions/Verification sections brought in line with what was actually built and decided, and `scenario-checklist.md` updated with this scenario's own line.

**Worth flagging:**

- **Rebuilt once, deliberately, under a stricter constraint.** Parts 1–3 were built once already this session, reverted in full at the developer's instruction, then rebuilt from a clean `development` baseline under an explicit "do not touch calculations" rule — because the first pass had, alongside the correction feature itself, also changed `discountedCost`'s existing SRP-recompute formula on an ordinary document edit (multiplying it by the receipt's VAT-inclusive net share). That specific change is _not_ present in this build. `receiveStock()` — the function computing VAT, withholding and net unit costs for every ordinary receipt — has zero diff against `development`, confirmed by grep, not just by inspection.
- **Two small features were prototyped and then explicitly reverted, not silently dropped:** an "SRP gives ₱X — Apply" hint on the unit cost field (with its own backend VAT-share fix to `discountedCost`), and swapping the printed Driver/Helper line for the supplier's address on the Receiving Report sheet. Both worked; both were reverted alongside the calculation-touching change above rather than cherry-picked back in, since re-litigating which pieces were "safe" mid-revert was not what was asked. Neither is present in this build. Straightforward to redo if wanted — noted here so a future session doesn't rediscover the idea from scratch.
- **The transfer-destination cost-layer gap (Finding 4's aside) is real and unfixed.** Stock that reaches a warehouse by transfer carries no cost layers of its own there — found twice now, once reasoning through the original "third bucket" open question, once again the hard way while isolating Part 5's own test fixtures. Out of scope for this scenario both times.
- **No manual click-through yet.** Every part above is automated-tested (25 e2e + 10 unit) and regression-checked against five neighbouring specs, but the developer has not yet walked through the UI. Manual test steps were given after each part in the conversation; none were confirmed back.
- **Two items from the plan remain genuinely open**, not just untested: the closed-period naming in the confirmation dialog, and any role restriction narrower than "anyone" on who may post a cost correction.

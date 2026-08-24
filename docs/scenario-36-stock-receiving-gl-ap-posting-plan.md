# Scenario 36 — Stock Receiving GL/AP Posting Gaps — Gap Analysis & Closing Plan

Source: developer question, 2026-08-20 — "why is it that when we receive stocks it is not creating a Journal Entry, also shouldn't it create AR or AP?" Investigated via a full audit of the live receiving/accounting code, then cross-checked against the client's own posting-entries spec, `backend/prisma/data/NIG ERP- GL MAPPING & POSTING ENTRIES.xlsx - POSTING ENTRIES.csv` (rows 3A-6 cover receiving, invoice matching, payment, and returns). That CSV is treated as the source of truth for "what should be" throughout this doc. Started as a planning-only pass, then moved into implementation the same session — see the Implementation Log at the bottom.

## Sources

- `backend/prisma/data/NIG ERP- GL MAPPING & POSTING ENTRIES.xlsx - POSTING ENTRIES.csv` — client's own end-to-end posting spec, rows 3A/3B (received with/without invoice), 4 (non-VATable), 5 (supplier payment), 6 (return/debit memo), 7/8A/8B (stock transfer — no GL).
- `backend/src/inventory/services/stock.service.ts` — PO/supplier receiving.
- `backend/src/inventory/services/transfers.service.ts` — stock transfer receiving.
- `backend/src/inventory/services/manual-receiving-report.service.ts` — manual receiving.
- `backend/src/inventory/services/serialized-import.service.ts` — CSV/serialized import.
- `backend/src/inventory/services/landed-cost.service.ts` — landed cost on a GRN.
- `backend/src/accounting/ap-bills/ap-bills.service.ts` — AP bill creation, matching, payment.
- `backend/src/accounting/supplier-debit-memos/supplier-debit-memos.service.ts` — supplier returns.
- `backend/src/accounting/posting/posting.service.ts` — `MAPPING_KEYS`, JE posting engine.
- `backend/src/accounting/reports/reports.service.ts` — AP Aging, Supplier Statement, GL reconciliation checks.

## What's already fine — verified, not re-scoped here

- **PO/supplier receiving already posts a journal entry** inside the same transaction as the stock write — Dr Inventory, Cr AP Payable, Cr WHT Payable (`stock.service.ts:767-815`), gated on `totalCost > 0` and the account mappings existing, matching the CSV's rows 3A/3B in basic shape.
- **Stock Transfer receiving correctly posts no GL entry** (`transfers.service.ts:1262-1650`) — it's an internal movement between the company's own locations, not a purchase, matching the CSV's rows 7/8A/8B exactly ("No GL entry").
- **Serialized CSV import intentionally posts no GL entry** — documented inline as backfill/import tooling, not a live receiving path (`serialized-import.service.ts:131-136`).
- **Supplier debit memo (return to supplier) already posts Dr AP / Cr Inventory** (`supplier-debit-memos.service.ts:264-274`), matching the CSV row 6's basic shape.
- **AP Bill payment already posts Dr AP / Cr Cash** — matches the CSV row 5's basic shape (see Gap 5 below for a real account-specificity mismatch within this otherwise-correct flow).
- **AR is correctly never touched anywhere in receiving.** No consignment-inbound or returns-from-supplier flow creates AR — the CSV never calls for it either. Confirmed not a gap.

## Decisions made (developer, 2026-08-20)

1. **Gap 1 mechanism**: skip the second JE. Keep crediting `AP_PAYABLE` directly at receipt, as today. When a bill is later matched to that receipt, do **not** post a new `Dr Expense / Cr AP` — just attach the invoice reference/status to the already-posted receipt. No new GRNI clearing account. This determines the shape of Gaps 1 and 6 both.
2. **Gap 3 (Manual Receiving Report)**: add a real unit-cost field to the manual form and post the same `Dr Inventory / Cr AP / Cr WHT` entry PO receiving does — manual receiving is still a real inbound stock event and should carry financial value, not stay documentation-only.
3. **Gap 4 (VAT source)**: SUPERSEDED 2026-08-20 mid-implementation — see Gap 4's own Fix note below. Not a new manual PO-line flag after all; reuses the existing Item/Category tax-rate resolution (`TaxRatesService.resolve()`) POS already uses for Output VAT.
4. **Cost-view-permission gap (Gap 7)**: the GL must always reflect reality regardless of who's logged in. The journal entry posts using the real unit cost from PO/supplier data even when the receiving user lacks `inventory:receive:cost-view` — only the UI continues to hide the number from that user.

## Closing the gaps

### 1. Receiving and AP Bill entry both credit AP Payable for the same delivery — no clearing mechanism between them

**Problem**: `stock.service.ts:791-795` credits `AP_PAYABLE` at the moment of receiving. Separately, `ap-bills.service.ts:443-480` credits `AP_PAYABLE` **again** when the matching supplier invoice/bill is entered — even when the bill is linked via `goodsReceiptIds` to a `GoodsReceipt` that already has a `journalEntryId`. `APBillsService.receive()` reads `bill.goodsReceipts` for the 3-way match but never checks whether any of them already posted a JE. Net effect: AP Payable is credited twice for one delivery, and the purchase is booked twice (once as an Inventory asset on receipt, once as an Expense on the bill). The CSV's own rows 3A/3B show this posting happening **once**, at physical receipt, regardless of whether the invoice is already in hand — there is no separate row for "post again when the invoice arrives." The invoice-matching step in the client's design is documentary (attaching the invoice/DR to the RR for AP Aging + 3-way match), not a second GL-posting event.

**Fix** (per Decision 1): `APBillsService`'s bill-creation/approval flow must detect when it's being matched against `GoodsReceipt` rows that already carry a `journalEntryId`, and skip re-posting `Dr Expense / Cr AP` for that matched portion — only bills with no linked (or unposted) receipt post their own new JE. No new GL account needed; `AP_PAYABLE` keeps being credited once, at receipt, exactly as it is today. The bill still gets created (for the 3-way match, invoice number, due date, aging), it just stops re-posting the GL side when a linked receipt already has.

**Status**: done — see Implementation Log below (Part 3)

### 2. No GRNI (Goods Received, Not Invoiced) report

**Problem**: the CSV's own UAT test for row 3B literally says "Receive goods without invoice and verify GRNI report." The client expects a report showing receipts that have posted to AP but have no matched supplier invoice/bill yet. No such report exists today. `GoodsReceipt.apBillId` (null = unmatched) is the only field that could drive it, but nothing surfaces it as a dedicated view — AP Aging and the Supplier Statement only ever query `APBill`.

**Fix**: a report/query filtering `GoodsReceipt` rows with a non-null `journalEntryId` and a null `apBillId`, alongside the existing AP Aging report in `reports.service.ts`.

**Status**: done — see Implementation Log below (Part 5)

### 3. Manual Receiving Report posts no ledger entries or GL at all

**Problem**: `manual-receiving-report.service.ts`'s `approve()` (lines 156-209) only writes a `SerialNumber` row — no `StockLedger`, no `StockBalance`, no `StockCostLayer`, no `JournalEntry`. Stock received through this path is invisible in both inventory value and the GL. Unlike Stock Transfer's deliberate no-GL design, this looks like an oversight — it doesn't even update the inventory quantity ledger, which no other receiving path skips.

**Fix** (per Decision 2): bring this path in line with `stock.service.ts`'s `receiveStock()` — add a unit-cost field to the manual form, write `StockLedger`/`StockBalance`/`StockCostLayer`, and post the same `Dr Inventory / Cr AP / Cr WHT` entry.

**Status**: done, with one correction — see Implementation Log below (Part 6). No `StockBalance` write after all: on-hand for a serial-tracked item (the only kind this flow handles) is derived from `SerialNumber` rows everywhere else in the codebase, so adding one would have double-counted this unit.

### 4. Input VAT is never posted at receiving, and there's no schema field to drive it

**Problem**: the CSV's row 3A explicitly requires debiting Input VAT when the receipt is VATable, and row 4 explicitly shows the non-VATable case posting no VAT line at all — meaning the system needs a way to know, per receipt, whether VAT applies. Today there is no `isVatable`/`taxCode` field anywhere on `PurchaseOrder`, `PurchaseOrderLine`, `GoodsReceipt`, or `GoodsReceiptLine` (confirmed via schema + grep), so the receiving JE in `stock.service.ts` can never build a VAT line no matter what — it only ever assembles Inventory/AP/WHT lines.

**Fix** (superseded 2026-08-20, mid-implementation): the originally-planned new manual `isVatable` flag on `PurchaseOrderLine` was dropped in favor of reusing the _existing_ tax-rate resolution the codebase already has — `Item.taxRateId`, falling back to the item's category default (`TaxRatesService.resolve()`), the identical mechanism `transactions.service.ts` already calls for Output VAT at POS checkout. No new field, no manual step for Purchasing. Each line's VAT is resolved from its item at receiving time and debited to `INPUT_VAT` (mapping key already existed, `posting.service.ts:21`, just never consumed by `stock.service.ts` before this); the AP credit grows by the VAT amount, withholding stays computed on the VAT-exclusive cost.

**Status**: done — see Implementation Log below (Part 8). **Worth knowing**: this tenant's `BusinessSettings` has a default tax rate of VAT 12% configured, so any item with no explicit override still resolves to 12% via that fallback — in practice, VAT now applies broadly across receiving, not just specifically-flagged items. Confirmed this is the intended blanket behavior implicitly by reusing the existing resolution mechanism as-is; flag if that's not actually wanted.

### 5. AP payment always credits the generic AP Payable account, not the supplier's specific Trade/Non-Trade payable

**Problem**: originally described as "receiving/bill entry resolves `supplier.defaultPayableAccountId`, payment doesn't" — confirmed via direct code check, 2026-08-20, this was only half right. `ap-bills.service.ts`'s own `receive()` (the general/unmatched-bill posting path) really did resolve the supplier override. But `stock.service.ts`'s `receiveStock()` — the path that actually posts the GL entry for the common, PO-matched case — never did; it always used the plain generic `AP_PAYABLE` mapping (`stock.service.ts:537` before this fix). Combined with Part 3's fix (a PO-matched bill's `receive()` skips re-posting its own JE, since the receipt already posted one), this meant the _only_ JE that ever posts for a normal receive → bill → pay cycle is receiving's own — always on the generic account, never the supplier's override. So payment always debiting the generic account was actually already symmetric with the one JE that mattered; the real gap was that a supplier's specific-account override was never honored _anywhere_ in that common path, not that payment was the odd one out.

**Fix**: resolve the supplier's `defaultPayableAccountId` (falling back to the generic mapping) in **both** places — `stock.service.ts:receiveStock()` (previously never did this at all) and `ap-bills.service.ts:recordPayment()` (previously always used the generic mapping) — so receiving, bill entry, and payment all agree, and a supplier override actually clears symmetrically end to end.

**Status**: done — see Implementation Log below (Part 9). Zero real suppliers in this environment currently have `defaultPayableAccountId` set, so this fix is a no-op against real/existing data today — it only changes behavior once a supplier is actually configured with a Trade/Non-Trade override, verified with a dedicated test fixture.

### 6. Landed Cost has the same no-subledger-record gap as PO receiving

**Problem**: `landed-cost.service.ts:174-201` posts `Dr Inventory / Cr AP_PAYABLE` for freight/duty/other landed costs on a GRN — same pattern as Gap 1, with no `APBill` created. It's invisible to AP Aging for the same reason, and would double-book the same way if a landed-cost invoice is later entered as its own bill.

**Fix** (per Decision 1): once Gap 1's fix lands, this path inherits it automatically — Landed Cost keeps crediting `AP_PAYABLE` directly, and any later bill entry for the freight/duty invoice must apply the same already-posted-receipt check before re-posting.

**Status**: done by inheritance — no separate code needed, confirmed as part of Part 3. Landed Cost never created its own `APBill` in the first place, so it was never actually part of this double-booking.

### 7. Cost-view-restricted receivers post a financially blank receipt

**Problem**: `stock.controller.ts:76-86` computes `canViewCost` from `inventory:receive:cost-view`; when false, `stock.service.ts:339-344` wipes `line.unitCost`/`dto.nndpCost` before totals are computed. `totalCost` then comes out to 0, which skips the entire GL-posting block (gated on `totalCost > 0`) and skips `StockCostLayer` creation — so _who_ receives the goods currently determines whether inventory gets capitalized at all.

**Fix** (per Decision 4): resolve and post the real unit cost (from the PO/supplier data) into the JE and cost layer regardless of the acting user's `cost-view` permission — the permission should only gate what that user's own UI response/receipt document displays, never what actually gets posted to the ledger.

**Status**: done — see Implementation Log below (Part 1). One residual, documented limit: a restricted receiver on a line with no linked PO still posts zero cost — no authoritative source exists to resolve a real cost from in that case.

### 8. Blank-cost PO receipt lines show a real price on the document but post to the GL/ledger as zero

**Problem**: confirmed via direct code check, 2026-08-20. `stock.service.ts:475-490` builds a PO-price fallback (`poLineCostMap`) for lines with a blank `unitCost`, and `:528-542` persists that resolved value onto the `GoodsReceiptLine` — so the GRN document and API response (`:807-810`) show a real price. But the ledger/cost-layer/JE code re-reads the raw incoming line separately and uses a bare `line.unitCost ?? 0` (`:583`, `:608`, `:435-438`) — no PO fallback. Result: `StockLedger.unitCost` posts as 0, `StockCostLayer` creation is skipped entirely (gated on `unitCost > 0` at `:616-628`), `totalCost` sums to 0, and — because the JE block is gated on `totalCost > 0` — **no journal entry posts at all**.

This directly compounds Gap 7: a cost-view-restricted receiver's line always has `unitCost` wiped to `undefined` (`:326-331`), which always routes into this exact zero-cost path. The stripping is leaky in the wrong direction too — the GRN document/response still shows the real PO price (the strip never touches the already-resolved/persisted value), while the ledger and GL silently zero out. So today, a cost-view-restricted receive both leaks the real cost on the document _and_ destroys it in accounting.

**Fix**: the ledger/cost-layer/JE code must use the same resolved cost (including the PO-line fallback) that the `GoodsReceiptLine` persists, instead of re-reading the raw incoming line's `unitCost ?? 0`. This should land together with Gap 7's fix, since both need the same single resolved-cost value used consistently everywhere in the transaction.

**Status**: done — see Implementation Log below (Part 1, landed together with Gap 7 as planned).

### 9. 3-way match compares against a free-typed header field, not real line costs

**Problem**: confirmed via direct code check, 2026-08-20. `ap-bills.service.ts:163-166` sums each matched `GoodsReceipt`'s `nndpCost` — a nullable, hand-typed header field (`schema.prisma:4572`) — instead of real `GoodsReceiptLine.unitCost` values; the match-check query doesn't even load GR lines (`:146`). Combined with Gap 7/8's cost-view stripping, `nndpCost` is wiped to `null` **permanently at write time** for any receipt entered by a non-cost-view user (`stock.service.ts:326-331`, `:506`) — so that receipt contributes exactly 0 to the match total forever. Correction to how this was originally suspected: the failure mode is a **false mismatch** (a legitimate bill fails to auto-match and gets blocked), not a silent false pass — though a hand-typed `nndpCost` that doesn't reflect the real lines could still cause the reverse.

**Fix**: derive the match total from real `GoodsReceiptLine` costs (quantity × the same resolved unit cost from Gap 8) instead of the free-standing `nndpCost` field, loading GR lines in the match-check query.

**Status**: done — see Implementation Log below (Part 2)

### 10. Landed Cost allocation silently no-ops while still posting its journal entry

**Problem**: confirmed via direct code check, 2026-08-20 — this is a live, active bug, not receiving-flow scope creep. `LandedCostService.allocate()` queries `StockCostLayer` by `receiptLedgerId: grLineId`, i.e. a `GoodsReceiptLine.id` (`landed-cost.service.ts:159-161`). But every write of `StockCostLayer.receiptLedgerId` in the codebase (`stock.service.ts:622`, `:891` — confirmed as the only two writes repo-wide) stores a `StockLedger.id` instead. The two id spaces never overlap (both are UUIDs, structurally indistinguishable, but produced by different rows) — `schema.prisma:4126` has no FK/relation on the field, so nothing ever caught the mismatch. The `findMany` at `landed-cost.service.ts:160` always returns empty; the allocation loop is a complete no-op. Meanwhile `create()` still posts a full `Dr Inventory / Cr AP` journal entry for the landed cost (`:174-202`). **Net effect: the GL inventory asset balance is inflated by every landed cost recorded to date, while the actual FIFO/LIFO cost layers never move — so COGS on every subsequent issue of that stock permanently understates by the landed amount**, and the `allocationBreakdown` the API returns describes an allocation that never happened.

**Fix**: needs a short design pass before a one-line fix — resolve the correct join between a `GoodsReceiptLine` and its `StockLedger`/`StockCostLayer` row (no such link exists explicitly today) so `allocate()` queries by the right key.

**Status**: done — see Implementation Log below (Part 4). Landed costs recorded _before_ this fix are not retroactively repaired — see "Worth flagging" in the log.

### 11. Accounting has no way to see Receiving Reports at all

**Problem**: found live, 2026-08-20, while manually testing the GRNI report (Gap 2). The Accountant role holds **zero** `inventory:*` permissions — confirmed directly against the seeded `role_permissions` table, no `inventory:receive:read` or equivalent — so an Accountant cannot open `/inventory/operations` or `/inventory/stock` to browse Receiving Reports at all. The only visibility Accounting has into RRs today is: (a) the GRNI report (Gap 2), which only shows posted-and-_unmatched_ receipts — a receipt disappears from it the moment it's matched to a bill; and (b) the AP Bill creation modal's own RR picker, which only shows receipts for one specific PO while actively creating a bill, not a general browse/search view. There is no standalone "view all Receiving Reports" screen anywhere in the Accounting module.

**Fix** (developer decision, 2026-08-20): add a dedicated **Receiving Reports** tab to the Accounting Reports hub (`/accounting/reports`), alongside the GRNI/AP Aging tabs — not a permission grant onto Inventory's operational screens. Lists every RR (matched or not, unlike GRNI), with the fields Accounting actually needs: code, supplier, warehouse, received date, total (real line costs, same approach as Gaps 2/9), JE status, and matched-bill status/reference. No RBAC changes, no exposure of Inventory's receive/edit actions (built for Stock Controllers, not Accounting) to a role that has no reason to touch them.

**Status**: done — see Implementation Log below (Part 7)

## Verification (once implemented)

Expected shape: for Gap 1, a full receive → bill → pay cycle should leave the sum of open (unpaid, GoodsReceipt-linked) journal entries matching AP Aging's total exactly, with no double-counted amount — likely worth its own `reconcileApSubledger` check alongside the existing `reconcileArSubledger` (`reports.service.ts:618`) as a standing regression guard, since the AP side currently has no equivalent to that reconciliation family. For Gap 10 specifically, verification should include a spot-check of landed cost entries already posted in the live/dev database against their supposed cost-layer allocations, since this bug is confirmed active today, not just a risk for future receipts. For the remaining gaps, expect a mix of new backend e2e coverage (JE balance assertions, GRNI report query results, a cost-view-restricted-user receive posting the real cost, a blank-cost-line receive) and, where a UI surface exists (Manual Receiving Report form, AP Bills screen), a manual click-through pass.

## Implementation Log — 2026-08-20

**For this scenario, I have done:**

- **Part 1 (Gaps 7+8)** — `receiveStock()` now resolves every line's real unit cost (explicit value, or the linked PO line's price as fallback) before computing `totalCost`/withholding/mappings, instead of a bare `line.unitCost ?? 0`. This is used consistently for the persisted `GoodsReceiptLine`, the `StockLedger`/`StockCostLayer` writes, and the JE — so a cost-view-restricted receiver's line still posts its real cost to the ledger/GL, and a blank-cost PO line no longer silently zeroes out. Also fixed the response-side leak: a restricted caller's own API response now masks `unitCost`/`nndpCost`, matching what was already supposed to happen.
- **Part 2 (Gap 9)** — `APBillsService.matchCheck()`'s 3-way match now sums real `GoodsReceiptLine.quantityReceived × unitCost` instead of the free-typed `nndpCost` header field.
- **Part 3 (Gaps 1+6)** — `APBillsService.receive()` skips re-posting its own JE when every matched `GoodsReceipt` already has a `journalEntryId`. Gap 6 (Landed Cost) closed by inheritance — it was never creating its own `APBill` in the first place.
- **Part 4 (Gap 10)** — added `StockLedger.goodsReceiptLineId` (migration `20260819172629`), populated at receiving time, so `LandedCostService.allocate()` can resolve the correct `StockCostLayer` row via the right join instead of querying by an id that never matched.
- **Part 5 (Gap 2)** — new `GET /reports/grni`, plus a GRNI tab on the Accounting Reports hub.
- **Part 6 (Gap 3)** — `ManualReceivingReportService.approve()` now posts the same `Dr Inventory / Cr AP / Cr WHT` entry normal receiving does, with a real `StockLedger`/`StockCostLayer` trail. Added `unitCost`/`supplierId`/`withholding` fields (migration `20260819174533`) and the matching UI fields on the New Manual Receiving Report form.
- **Part 7 (Gap 11, added mid-implementation)** — new `GET /reports/receiving-reports` plus a Receiving Reports tab on the Accounting Reports hub, listing every RR (matched or not) — the Accountant role had zero `inventory:*` permissions, so this was the only way Accounting could browse RRs at all before this.
- **Part 8 (Gap 4)** — receiving now resolves Input VAT per line from the item's own tax rate (falling back to its category default), reusing `TaxRatesService.resolve()` — the same mechanism POS already uses for Output VAT — instead of the originally-planned new manual PO-line flag. Added `GoodsReceipt.vatAmount` (migration `20260820050915`) and surfaced it on the receiving document/detail view and print template.
- **Part 9 (Gap 5)** — both `stock.service.ts:receiveStock()` and `ap-bills.service.ts:recordPayment()` now resolve a supplier's `defaultPayableAccountId` override (falling back to the generic `AP_PAYABLE` mapping). Receiving previously never resolved this at all — only bill entry did — which combined with Part 3's fix meant the one JE that actually posts for a normal receive→bill→pay cycle was always on the generic account regardless. Fixing payment alone would have introduced a _new_ mismatch; fixing both makes the whole chain agree.

**All 11 closing gaps are now done.** Scenario 36 is functionally complete — see Phase 5/"are you done" gate before generating PR text.

**Worth flagging:**

- Part 8's real-data discovery: this tenant's `BusinessSettings` default tax rate is VAT 12%, so any item with no explicit override still resolves to 12% via that fallback — VAT now applies broadly across receiving, not just specifically-flagged items. This surfaced as a real test failure (an item used throughout earlier parts' tests turned out to resolve VAT too, once Part 8 landed) — fixed by moving those tests to a dedicated no-VAT fixture item, but the underlying blanket-VAT behavior is real and worth confirming is actually wanted before this ships.
- Part 4's fix is not retroactive — landed costs recorded before the `goodsReceiptLineId` migration have no way to resolve the join after the fact; their GL entries were already correct, only their per-unit cost layers were never bumped. Worth a spot-check against real posted entries if this matters for historical valuation.
- Part 1's residual gap: a cost-view-restricted receiver on a line with no linked PO still posts zero cost — there's no authoritative source to resolve a real cost from in that case.
- Two small side fixes done opportunistically, outside this scenario's original scope but requested live during testing: removed the unused "Cost Center" field from the AP Bills "New Bill" modal, and General Ledger now shows newest transactions first (running balance still computed chronologically internally, only the display order is reversed).
- No real seeded persona exists with `inventory:receive:create` but not `inventory:receive:cost-view` (Part 1), nor with `inventory:manual-rr:create` besides the single Business Owner account (Part 6) — both are pre-existing "dead persona" gaps flagged in earlier scenario docs, not something this pass could fix. Verified via temporary test-only roles inside the e2e spec instead.

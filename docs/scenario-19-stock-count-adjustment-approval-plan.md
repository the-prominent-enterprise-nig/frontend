# Scenario 19 — Stock Count & Inventory Adjustment Approval — Gap Analysis & Closing Plan

Source: `NIG_ERP_Core_Operational_Scenarios_Draft_2_20260727.pdf`, row "13. Counting stock and approving an inventory adjustment." New scenario, mapped from this row — no equivalent existed in the original `module-scenarios.md` source, and it doesn't fit any of Scenarios 01-14 (Scenario 07's write-off path is the closest existing neighbor, but is repair-specific, not a general count/adjustment workflow).

## Related ClickUp Tickets

None found. Net-new scope.

## The scenario we're building toward

A cycle count, monthly audit or variance alert is due:

1. Stock Custodian counts without editing on-hand.
2. The system compares by SKU/serial and produces the variance.
3. Branch Manager confirms the count.
4. HO Inventory/Audit investigates.
5. An Authorized Approver posts or rejects the adjustment.
6. The system updates inventory/GL and logs before and after values.

**Result**: variance is resolved through an approved transaction; saleable and non-saleable statuses remain distinct.

## What's already done ✅

1. **`StockCount` model + full lifecycle already exists.** Enums `StockCountType`/`StockCountStatus` (`backend/prisma/schema.prisma:2579-2590`), model at `:3179-3196`; create → start → submit → cancel in `src/inventory/services/counts.service.ts`, `src/inventory/controllers/counts.controller.ts`, `src/inventory/dto/counts.dto.ts`.
2. **`AdjustmentsService.createAdjustment()` already supports multiple variance reasons**, not just write-off — `AdjustmentReasonCode` includes damaged, miscounted, expired, theft, write_off, found (`schema.prisma:2570-2577`).
3. **Frontend UI for physical counts + live variance already exists.** `frontend/.../inventory/stock-counts/_components/CountSessionView.tsx`; also `cycle-counts/` and `mobile-count/` pages.
4. **`StockLedger` already records a delta + reason code** per movement (`schema.prisma:3071-3095`).

## What's not done / gaps ❌⚠️

1. **No server-generated system snapshot to diff against.** `submit()` takes `expectedQty` as caller-supplied input (`counts.dto.ts:59-65`), not a snapshot the system captured at count-start time — so the "variance" isn't provably against a true system-of-record baseline.
2. **No approval chain on `StockAdjustment` at all.** No status field; adjustments post immediately on creation, gated only by a single `inventory:stock:adjust` permission (`adjustments.controller.ts:38-52`). The PDF's confirm → investigate → approve/reject chain doesn't exist anywhere.
3. **No explicit before/after audit log.** `StockLedger` records deltas (`quantityChange`), not the before/after on-hand values themselves — balances mutate via `increment`.
4. ~~No serial-level counting UI.~~ **Done** — see Part 5 in the implementation log below.
5. **No general "saleable/non-saleable" status bucket.** Only per-serial `SerialNumberStatus` (defective/held) and per-batch `BatchStatus.quarantine` exist — no general concept a count could flag a unit into.

## Closing the gaps

Ordered by risk/value.

### 1. Snapshot the expected quantity server-side

**Problem**: a caller-supplied `expectedQty` means the "variance" can't be trusted as a true system comparison.
**Fix**: have `counts.service.ts` snapshot `expectedQty` from current `StockLedger` balances at session start, not accept it as input. This is an integrity fix and should land first regardless of what else gets built.

### 2. Add an approval chain to `StockAdjustment`

**Problem**: adjustments post immediately with no review.
**Fix**: add a status field (`submitted` → `confirmed` → `investigating` → `approved`/`rejected`) mirroring the PDF's chain, carrying the existing reason codes through unchanged.

### 3. Add explicit before/after values

**Problem**: reconstructing an audit trail from deltas alone is fragile.
**Fix**: add `beforeQty`/`afterQty` columns (or a computed view) alongside the existing delta.

### 4. Confirm serial-level counting scope

**Problem**: serialized categories (aircon, appliances) may need serial-by-serial reconciliation, which is materially more UI/scan-flow work than SKU-level counting.
**Fix**: confirmed needed — built as Part 5, see the implementation log.

### 5. Decide on a "non-saleable" status

**Problem**: no general status exists for a unit a count finds to be damaged/questionable.
**Fix**: decide whether this needs a new general Item/SerialNumber-level status, or whether the existing per-serial/per-batch statuses already cover it once surfaced consistently in the count UI.

## Dead code / unused-feature flags

None found.

## Implementation Log — 2026-08-04

**For this scenario, I have done:**

- Item #1 (snapshot expected quantity) — Part 1: new `StockCountLine` model, snapshotted from live `StockBalance` when `start()` runs. `submit()` no longer accepts `expectedQty` from the caller at all (removed from the DTO) — it diffs the counter's `countedQty` against the snapshot. New `GET /inventory/counts/:id/lines` exposes the snapshot; the Count Sheet UI shows Expected as read-only, with an "Add Found Item" path for genuine finds with no prior balance.
- Item #2 (approval chain) — Part 2: new `StockAdjustmentStatus` (`submitted → confirmed → investigating → approved`/`rejected`) and `StockAdjustmentLine` model holding pending line data. Both creation paths (manual `POST /inventory/adjustments` and Part 1's count-triggered adjustments) now hold pending — actual `StockLedger`/`StockBalance`/GL posting only happens on `approve()`. Four new endpoints (`confirm`/`investigate`/`approve`/`reject`), three new permissions, and a new frontend **Stock Adjustments** page (`/inventory/adjustments`) with list + detail/action views.
- Item #3 (before/after audit values) — Part 3: nullable `beforeQty`/`afterQty` added to `StockLedger`, captured from the live balance at the moment `approve()` actually posts — not copied from the line's `expectedQty`, which can be stale by the time a reviewed adjustment finally posts. Backend-only; no UI surface for this one.
- Item #5 (non-saleable status) — Part 4: no new status field. The existing `BatchStatus` (quarantine/expired/recalled) and `SerialNumberStatus` (held/defective/in_repair/pulled_out) now surface directly on adjustment lines — a Batch/Serial picker with a "Non-saleable" badge on the Create Adjustment form, and the same on the Stock Adjustments detail view so every approver sees it too.

**Worth flagging:**

- Decision (Phase 3, Part 2 fork): approval reaching **approved** is the point stock/GL actually posts (deferred posting), not an after-the-fact rubber stamp on an already-posted adjustment — matches the doc's own wording ("An Authorized Approver posts or rejects the adjustment. The system updates inventory/GL") and is what actually closes gap #2's stated problem.
- Decision: the chain applies uniformly to both creation paths (manual adjustments and Part 1's count-triggered ones) — a count variance is exactly the kind of thing this chain exists to review, not a carve-out.
- Decision: no existing role cleanly maps to "HO Inventory/Audit" or "Authorized Approver" — mapped **Branch Manager → confirm** only. `investigate`/`approve`/`reject` are not granted to any role in seed data, so **Business Owner** (full-permission wildcard grant) is the only one who can perform them in practice — not "Inventory role"/"Accountant" as an earlier draft of this decision considered. Worth a dedicated role if the business later wants those steps performed by someone short of Business Owner.
- Decision: Scenario 07's Repair Transfer write-off (`UdsService.writeOff`) also calls the adjustment creator and expected immediate posting (no approval chain in its own doc) — added `AdjustmentsService.createAndAutoApprove()` so that flow keeps posting instantly, unchanged, rather than silently picking up a multi-step review it never had.
- Found and fixed two real pre-existing bugs surfaced while re-verifying/building on this area (both outside this scenario's own gaps, fixed because they blocked or were directly adjacent to this work): (1) `e2e/utils.ts`'s `ensureItemStock()` helper (used by the Aircool specs) posted stock via the same endpoint Part 2 changed to defer — updated it to drive the new chain itself so those specs keep getting real stock; (2) the frontend's `SerialStatusSchema` only had 5 of the backend's 8 real `SerialNumberStatus` values (missing `held`, `in_repair`, `pulled_out`) — silently broke the existing Serial Numbers list/filter page for those statuses too, not just Part 4's new UI.
- Confirmed pre-existing, unrelated to this scenario (do not attribute to this work if seen failing again): `procurement-closeout.e2e-spec.ts`'s "GL posting — write-off" test hits `POST /inventory/adjustments/write-off`, a route that has never existed (404) — its own bug, Scenario 10 territory. The same file's "Spending quota enforcement"/"PO receipt linkage"/"Purchase Order lifecycle" tests are flaky under repeated same-day runs (a day-based sequential PO-code generator race, same class of bug as the ADJ-/CNT- number generators noted elsewhere in this doc's own fix). `repair-transfer.e2e-spec.ts`'s "auto-paired transfer dispatches and receives with no approval gate" test fails identically on a clean `development` checkout with none of this scenario's changes applied (verified via `git stash`) — pre-existing, not caused by this work.
- Hit the same recurring DB-tooling friction Scenario 16 flagged: every `migrate dev`/`migrate deploy` run against the shared local DB re-drops `items_name_trgm_idx` (Scenario 16's pg_trgm index) as spurious drift, since it's raw-SQL-only and not declared in `schema.prisma` — caught and stripped from each of this run's three migrations before applying, and restored the index each time it slipped through once. Also hit new tables landing owned by `karmslajo` instead of `postgres` (same root cause as Scenario 16's note) — fixed via `ALTER TABLE ... OWNER TO postgres` after each migration with a new table. Still worth a real fix (declare the extension/index properly, and sort out the DB owner) so it stops costing a manual step on every migration that touches this schema.
- Part 4's non-saleable-batch path has no batch-tracked item in the seed data to click through manually — verified via backend e2e instead (`inventory-stock-adjustment-approval-chain.e2e-spec.ts`). Worth seeding one if batch-tracked scenarios keep coming up.

## Implementation Log — 2026-08-05

**For this scenario, I have done:**

- Item #4 (serial-level counting) — Part 5: for a serial-tracked item, `start()` now snapshots one `StockCountLine` per physically-present `SerialNumber` (status `in_stock`/`held`/`defective`/`in_repair`) at the target warehouse, `systemQty` always `1`, instead of one aggregate balance line — non-serial items are unaffected. `submit()` matches serial lines by `serialNumberId` alone (not item/variant/batch/location, which can't disambiguate individual units of the same SKU); any serial line still uncounted after the submitted set is processed is swept and resolved as "0 found" (missing), producing a discrepancy the same way an explicitly-submitted miscount would. `postAdjustment()`'s `approve()` is now delta-aware for serial lines: `delta < 0` (never scanned — missing) scraps the serial as before; `delta > 0` (a genuine find, `systemQty` 0) now restores it to `in_stock` at the adjustment's warehouse instead of scrapping something that was just located — previously every serial-carrying adjustment line was unconditionally scrapped regardless of direction, which would have been wrong for this new case. New `serialNumberId` column on `StockCountLine` (nullable, FK to `SerialNumber`). Frontend: the Count Sheet renders a serial-tracked line as a read-only serial-number badge next to the item name, still using the same numeric "Counted" field every other line uses (1 for found, blank for not found — a checkbox was tried first but replaced per feedback: it's ambiguous when it flips between two opposite-meaning labels, and there was no way to express "counted something other than expected" the way a typed number naturally does), and a parallel "Add Found Serial" control (alongside the existing "Add Found Item") for a serial the snapshot didn't expect present. The sheet also lists most-recently-added first (reversed from creation order), consistent for both the initial snapshot and anything added mid-session.
- Fixed a real regression this surfaced: `start()`/`submit()` now reconcile _every_ serial-tracked unit physically in the target warehouse, not just ones relevant to whatever's being tested. The shared dev warehouses (WH-01/02/03) carry ~1000 real serials each from other scenario work — running a count against one and submitting would sweep nearly all of it into a single pending adjustment (non-destructive on its own, since posting only happens on `approve()`, but a real risk if that adjustment were ever approved). Fixed by pointing both the new Part 5 test and the pre-existing Part 1 snapshot test at a freshly-created, dedicated, isolated `Warehouse` instead of a shared one — confirmed no actual scrap occurred in any prior run (every failing run threw before reaching the approval chain). Applied the same fix to the frontend's `e2e/inventory-stock-count-snapshot.spec.ts`, which selected a shared warehouse by dropdown index and calls Submit Count — exposed to the identical regression at the UI layer.
- Fixed a second, unrelated bug this exposed: `CountSessionView.tsx`'s snapshot-seeding effect re-ran on every background refetch of the count-lines query, not just the first. Starting a count against a fast/empty warehouse and immediately clicking "Add Found Item"/"Add Found Serial" could have the just-added local row silently wiped out moments later when the snapshot query's first resolution landed and re-seeded over it. Guarded with a per-count-id ref so seeding only happens once, after the snapshot has actually loaded.
- Fixed this doc's own stale text: gap #4 was marked deferred (see the superseded "Worth flagging" bullet, now removed) and the role-mapping decision above previously said "Inventory role → investigate, Accountant → approve/reject" — neither is granted those permissions in seed data; only Business Owner can perform them, corrected in place.
- **Real incident during manual testing, not a code bug**: manually testing Part 5 against Alimodian Warehouse (a real, shared, seed-populated warehouse, not an isolated test one — the same class of risk flagged above) submitted and approved a full count with most lines left unresolved. This scrapped 993 real seeded serials across 4 items (TN-AC-SPLIT-1_5HP, TN-FURN-SET-001, TN-REF-001, TN-WM-001) — the entire "generous per-branch serial stock" buffer `seed.ts` creates specifically so manual/e2e testing doesn't run low (200 per item per warehouse). This also surfaced a latent aggregate-balance bug: `postAdjustment()` decrements `StockBalance` for every line regardless of whether it's serial-based, but serial-tracked items never had that aggregate balance seeded/maintained in the first place (their tracking IS the serials) — so the balance went negative instead of settling at zero. Reversed via a direct, scoped SQL correction (restore the exact 993 `SerialNumber` rows this one adjustment's lines touched back to `in_stock`, restore the 4 `StockBalance` rows to their pre-adjustment value, and add one traceable `stock_ledger` reversal entry per item so the ledger sum still matches the corrected balance instead of silently drifting from it) — confirmed restored via direct query afterward. The `approve()` aggregate-balance-decrement-for-serial-lines behavior itself was flagged, not changed — worth a follow-up decision on whether serial lines should skip the aggregate balance entirely, since it isn't meant to be authoritative for those items.
- **Nav reorg, prompted by the user questioning whether Cycle Schedules and Stock Counts were the same thing (they were)**: confirmed no `CycleCount` model exists at all — `inventory/cycle-counts/`'s "Cycle Schedules" tab called the exact same `GET/POST /inventory/counts` as Stock Counts, just pre-filtered to `countType: 'cycle'`, which Stock Counts' own Count Type filter already covers. Worse, clicking a Cycle Schedules row did nothing — no detail view, no Count Sheet, no Submit — so a cycle count started from that tab could only be finished by separately finding the same session under the Stock Counts tab. Removed `cycle-counts/` (frontend route, actions, components, hook) and `schema/inventory/cycle-counts/` entirely, along with the now-orphaned `CYCLE_COUNT_READ`/`CYCLE_COUNT_MANAGE` frontend permission constants. That tab slot in the Counting hub now shows **Stock Adjustments** instead (moved from Operations, at the user's explicit request) — most adjustments originate from a count variance, so it lives next to the count sessions that create them; Operations' own `adjustments` tab and its now-unneeded `STOCK_ADJUST`/`STOCK_ADJUSTMENT_*` page-level permission checks were removed. Updated the one dashboard quick-link that pointed at the old `/inventory/operations?tab=adjustments` URL, and the e2e specs that navigated there directly.

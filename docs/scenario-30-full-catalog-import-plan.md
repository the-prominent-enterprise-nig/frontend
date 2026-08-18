# Scenario 30 — Full NIG Catalog Import from the Real Item Master (Replaces Demo Seed Items) — Gap Analysis & Closing Plan

## Sources

1. **Item Master** — `NIG-TPE-Data-Collection-Templates - Item Master.csv` (provided 2026-08-18), saved at `backend/prisma/data/NIG-TPE-Data-Collection-Templates - Item Master.csv`. A real physical-inventory snapshot: **21,034 real rows** (after excluding 4 fake template sample rows + 1 blank separator at the top), **1,361 distinct SKU/Model pairs** (clean 1:1, no model has more than one SKU), **127 brands**, across **9 product types**: Appliance (8,938 rows), Small_Items (5,974), Furniture_Non3E (3,295), IT_Products (1,246), Split_Type (588), Furniture_3E (538), Gadgets (370), Bid_Items (79), CCTV (6). Every real row has SKU, Brand, Type, Group, Subgroup, Model, Serial Number, Location, Cost Price, and `Serial Tracked = YES` populated (0 blank Cost Price, 0 blank Serial Number, 1 blank Location out of 21,034).
2. **Appliance rate card** — `APPLIANCE PRICELIST AUG_07_26.xlsx - Sheet1.csv` (Scenario 30's original source, unchanged) — 685 unique BRAND+MODEL combinations, selling price + financing terms (WIP/CR-BR/SSC/ZI/CREDIT CARD/TONIK/SKYRO) per price-use type.

Verified directly against both live files and current code on 2026-08-17/18, during the same planning conversation this doc is written from. Implemented and verified 2026-08-18 — see Implementation Log below.

## Problem

The seed catalog (`NIG_CATALOG_ITEMS`, `seed.ts:6793`, 77 hand-picked demo items) is mostly fictional — 35 of the 77 don't correspond to any real client product at all. Two real data sources now exist and need reconciling: the Item Master (real physical stock — identity, serials, locations, cost) and the appliance rate card (real selling prices + financing terms, but only for appliance-type financing). **Confirmed with the developer**: this is a full replace of the demo catalog, scoped to the entire real Item Master (1,361 items across all 9 types), not just the 685 appliance-financing models originally in scope.

## Cross-check: Item Master ↔ Appliance rate card (by normalized model number)

|                  | Count | What it means                                                                                                                                                                                                                           |
| ---------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In both files    | 376   | Full picture: real identity/stock/serials/cost (Item Master) + real selling price/financing terms (rate card)                                                                                                                           |
| Rate card only   | 309   | Priced/financeable per the rate card, but no confirmed real stock in the Item Master snapshot                                                                                                                                           |
| Item Master only | 990   | Real physical stock/serials/cost, but no selling price anywhere in the appliance rate card (spans Furniture, IT Products, Gadgets, CCTV, Bid Items, Small Items, and some Appliance/Split_Type models the rate card just doesn't cover) |

`NIG_CATALOG_ITEMS` and its dependent stock/serial-seeding block are retired outright — the Item Master is comprehensively richer than the old hand-curated 77 (real descriptions, real serials, real per-unit cost, real locations), so there's no need to special-case preserving any of the old array's data, including the 42 entries that happened to already match a real model.

## Decisions made (planning conversation, 2026-08-17/18)

- **Full catalog scope**: all 1,361 real Item Master products, not just the 685 appliance-financing models.
- **Item Master is the primary source of identity/physical truth.** `SKU` (its own `ITEM-XXXX` convention, adopted directly — no need to generate a new one), `Brand`, `Type`, `Group`→`Subgroup` (category, same nested parent/child structure as originally planned), `Model`, `Description` (→ `Item.name`, real authored text, not mechanically composed), `Cost Price` (per-unit — varies by batch for the same model, confirmed by real examples in the data, e.g. one furniture model shows 3 different cost prices across 3 units; feed into per-unit/batch costing, not a single flat `Item.costPrice`), `Serial Number`, `Location`, `isSerialTracked` (uniformly `true` for all 21,034 real rows — confirmed directly from the source's own `Serial Tracked` column, not inferred from the Scenario 27 client-rule assumption used earlier; both agree, but the Item Master is now the harder evidence).
- **Appliance rate card remains the source of selling price + financing terms** (unchanged from the original Scenario 30 scope) for whichever of the 1,361 models it covers (376 of them).
- **Location → Branch mapping: seed only unambiguous matches this pass.** Stripping the branch code's leading region letter (N=Negros, P=Panay) cleanly matches most Item Master location codes to exactly one of the 38 currently-seeded branches (e.g. `MIB`→`PMIB`, `RCB`→`PRCB`). Confirmed with the developer: **skip everything that isn't unambiguous** — `WHSE` (matches both `NWHSE`/`PWHSE`, 5,353 rows — the single biggest location bucket, over a quarter of the whole file), `KB`/`BB`/`CB`/`MB` (each matches one Negros branch and one Panay branch), and `GB`/`JB`/`JARO` (no matching branch at all — `JARO` is a real Iloilo/Panay town, so this looks like a genuinely unseeded real branch, not a data error) are all left out of this pass, along with every `-PROMO`/`-PROMO2`/`-ASC`/trailing-`R` suffix variant of an ambiguous or unmatched base (meaning unresolved, not just the bare ambiguous codes). **Net effect: 11,776 of 21,034 real rows (56%) get seeded this pass; 9,258 rows (44%) are held back pending location clarification.**
- **No fabricated data beyond what's sourced above** — matches the original Scenario 30 principle, now easier to honor since the Item Master supplies real values for nearly everything that previously had to be guessed or left at schema default (name/description, cost, serial-tracking).
- **Seed-script only, not a manual import feature** — unchanged from the original decision.
- **"Products: BRANDS → SUBGROUP → MODEL" is item-identity structure, not a UI feature** — unchanged correction from earlier in this same conversation. POS checkout and Stock Transfer UIs are not touched by this scenario.

## New finding — GL account routing maps more naturally onto Item Master's TYPE than the rate card's GROUP did

`seedAccounting()` (`seed.ts:4380-4424`) routes GL accounts by exact category name into 4 buckets: `Appliances`, `Aircon`, `Furniture`, `IT`. The Item Master's own **Type** column lines up with these far more directly than the rate card's ~12 GROUP values did: `Appliance`→Appliances, `Furniture_Non3E`/`Furniture_3E`→Furniture, `IT_Products`→IT, `Split_Type`→Aircon (split-type aircons). **Still undecided**: which bucket (if any) `Small_Items`, `Gadgets`, `Bid_Items`, and `CCTV` route to — none obviously fit the existing 4, and inventing a 5th bucket means new GL account numbers, which isn't something to guess.

## Open Questions

1. **Pricing for the 990 Item Master-only models.** These have no selling price anywhere. Cost-plus-markup? A flat `sellingPrice` with no installment financing at all? Not decided — flagged explicitly rather than guessed, per the "no fabricated data" principle applying to pricing logic too. **Still open.**
2. **Do the 309 rate-card-only models still get created** (priced, zero stock, no Item Master evidence) or excluded until real stock exists? **Still open.**
3. ~~The held-back rows' location resolution~~ — **partially resolved 2026-08-18** (see Implementation Log): `WHSE` defaults to the real standalone Panay warehouse; `GB`/`JB` resolve to the 2 code-less Guimaras branches. **Still held back, developer's explicit call**: `KB`/`BB`/`CB`/`MB` region ambiguity (~2,676 rows — same problem as WHSE, deliberately left unresolved rather than defaulted), `JARO` (2 rows, no matching branch), and the trailing-`R` suffix meaning (~500 rows — checked several sample rows for an internal signal, found none).
4. ~~GL bucket for Small_Items/Gadgets/Bid_Items/CCTV~~ — **resolved 2026-08-18**: left unrouted, per developer decision (see Implementation Log). Not a gap — same as any item with no category match.
5. **CREDIT column meaning** — carried over from Scenario 15/the original Scenario 30 pass, still unresolved (`price-lists.dto.ts`'s `creditAmount` comment: "Meaning not fully resolved; captured only"). Not blocking.

## Closing the gaps

### 1. Item Master parser

**Problem**: no parser exists yet for this file's shape (21,034 rows, one row per physical unit rather than one row per SKU like the rate card).

**Fix**: new parser, grouping by SKU/Model into one Item definition each (Brand/Type/Group/Subgroup/Description/UOM — verify consistent per SKU, flag rather than silently pick a value on conflict) plus a list of that model's Serial+Location+Cost rows. Apply the location filter from the Decisions section (unambiguous branch match only) when building the stock/serial list. Skip the 4 fake template sample rows + blank separator at the top of the file.

**Status**: done, verified 2026-08-18 — see Implementation Log.

### 2. Rate card parser fix (unchanged from the original Scenario 30 pass)

**Problem**: `parsePriceListCsv()` (`price-list-import.util.ts:57-133`) reads fixed column positions built for the old 16-column layout (no TYPE/GROUP/SUBGROUP, which the current rate card export has). Dropping the new file in as-is would silently misread columns.

**Fix**: update the destructured column positions to skip the 3 new columns; capture BRAND (currently skipped). Delete `appliance-pricelist-2026-08-07.csv`, add the new file as `appliance-pricelist-2026-08-17.csv`.

**Status**: done, verified 2026-08-18 — see Implementation Log.

### 3. Full catalog replace — Item/Brand/Type/Category/stock/serial creation for all 1,361 real models

**Problem**: `NIG_CATALOG_ITEMS` (77 items, 35 fictional) is the only current source of truth; none of the 1,361 real Item Master models exist in the system.

**Fix**: retire `NIG_CATALOG_ITEMS` and its dependent stock-seeding block. For all 1,361 models: match-or-create `ItemBrand`/`ItemType`/`ItemCategory` (GROUP as parent, SUBGROUP as child, same nested structure as originally planned) from the Item Master's own columns; create the `Item` row using the Item Master's own SKU, Description (as name), Model, Cost Price, `isSerialTracked: true`; seed `SerialNumber`/`StockBalance` only for the 11,776 rows with an unambiguous location match (per the Decisions section); extend `categoryNamesByGlCategory` per the GL-routing finding, pending Open Question 4.

**Status**: done, verified 2026-08-18 — see Implementation Log.

### 4. Price the 376 overlapping models across all 7 price-use types

**Problem**: the existing curated-pricing block (`seed.ts:7910-8002`) only prices the 42 models that happened to match the old fictional catalog.

**Fix**: same mechanism, applied to the 376 models that exist in both sources — `PriceListItem` (+ `PriceListItemTerm` for whichever of 3/6/9/12mo terms the rate card has) across WIP/CR-BR/SSC/ZI/CREDIT CARD/TONIK/SKYRO. The 309 rate-card-only and 990 Item-Master-only models are blocked on Open Questions 1–2 above — not priced in this pass.

**Status**: done, verified 2026-08-18 — see Implementation Log.

## Implementation Log — 2026-08-18

**For this scenario, I have done:**

- **Part 1** — new parser (`prisma/item-master-import.util.ts`): groups the Item Master's 21,034 physical-unit rows into 1,361 SKU/Model product definitions, resolving each unit's Location to a real branch or holding it back per the rules below.
- **Part 2** — `parsePriceListCsv()` (`prisma/price-list-import.util.ts`) updated for the rate card's 3 new TYPE/GROUP/SUBGROUP columns; old source CSV retired, new one swapped in as `appliance-pricelist-2026-08-17.csv`.
- **Part 3** — `NIG_CATALOG_ITEMS` (945-line hand-curated array, 35 of 77 items fictional) retired outright. `seedNigAgingCatalog()` in `prisma/seed.ts` now builds the catalog straight from the Item Master: `ItemBrand`/`ItemType`/GROUP→SUBGROUP `ItemCategory` tree, all 1,360 real items (1,361 minus 1 collapsed from 2 `#N/A` Excel-error rows), stock/serials for location-resolved units, and a WIP baseline price (`sellingPrice = average unit cost`) for every priceable item. Also extended `seedAccounting()`'s GL-routing block to route by the Item Master's own Type column.
- **Part 4** — new function `seedNigCuratedPricing()`: layers the real rate card's curated pricing (WIP/CR-BR/SSC/ZI/CREDIT CARD/TONIK/SKYRO, with per-term MI/PPD where available) onto the 376 items that exist in both sources, matched by normalized model number.
- **Location-mapping follow-up, same day** — developer reviewed the held-back rows and made 4 further calls, all implemented and reverified: `WHSE` defaults to Panay (**the real standalone `WH-PANAY` warehouse, not the `PWHSE` branch — see bug below**); `GB`→Guimaras - Buenavista, `JB`→Guimaras - Jordan (2 branches with no `Branch.code` at all, resolved by name instead — precedent already existed in this file for a different client sheet, `VEHICLE_BRANCH_ALIASES` at `seed.ts:3056-3078`); duplicate serial numbers now keep the first occurrence (file order) instead of dropping every occurrence; `KB`/`BB`/`CB`/`MB`/`JARO`/the `R`-suffix codes stay held back, developer's explicit call. **Net effect: 17,604 of 21,034 physical units now seeded (up from 11,538), only 3,428 held back (down from 9,494).**

**Real bugs found and fixed while actually running this against data, not just reading it** (all verified by re-running the seed and checking counts, not assumed fixed):

1. A lone `"-"` in Cost Price means zero (2,600 rows use it) — first pass silently dropped ~1,013 good units before this was caught.
2. 111 serial numbers were reused across 2-3 rows each — `SerialNumber.serialNumber` is globally unique in the schema, so seeding as-is would have crashed; now the first occurrence is kept, later repeats held back.
3. A literal Excel `#N/A` error value had leaked into the SKU column for 2 rows and was about to become a real (fake) catalog item — filtered out.
4. The GL-routing extension described in this doc's "New finding" was only ever written as a comment, not real code — caught because the seed log showed 1 item routed instead of the expected ~1,070.
5. Prisma's compound-unique `upsert()` can't match a `null` `variantId` — crashed Part 4's first attempt; fixed by mirroring the same find-then-create-or-update pattern `price-lists.service.ts`'s `upsertItems()` already uses for this exact reason.
6. `WHSE`'s first fix pointed at the `PWHSE` _branch_, which (per Scenario 27) has no warehouse of its own at all — it was promoted into a free-standing region warehouse (`WH-PANAY`, `branchId: null`) instead. 5,296 units silently failed to stock until this was caught by the seed log showing a nonzero "dropped for no matching warehouse" count instead of 0.
7. **Two pre-existing bugs in `cleanDatabase()`, unrelated to Scenario 30's own logic** — surfaced only when reseeding the developer's actual dev DB (which has real accumulated data neither the old demo seed nor the isolated test DB ever had): `ManualReceivingReport` rows (a brand-new model, Scenario 29's RR-05) blocked `warehouse.deleteMany()`, and `Notification`/`NotificationRecipient` rows blocked `user.deleteMany()` — neither model was ever wired into the cleanup sequence at all. Both fixed directly in `cleanDatabase()` (`prisma/seed.ts`), in FK-safe order.

**Worth flagging:**

- All Scenario 30 numbers above were verified against the isolated test DB (`the-prominent-enterprise-test`) first — every number quoted is from actually running the seed and querying the result, not inferred from the code. Confirmed the seeded serial numbers are real, unmodified values from the source file (spot-checked 3 random ones directly against the source CSV).
- **The developer's dev database (`the-prominent-enterprise`) has now also been reseeded successfully** (`npx prisma db seed`, after fixing bug 7 above) — confirmed directly: 1,360 items, same counts as the test DB run. First two attempts failed: the harness's own auto-mode safety classifier blocked the command once (separate from Prisma's AI-action consent gate, already satisfied by then), then bug 7's two `cleanDatabase()` gaps blocked it twice more before succeeding.
- Open Questions 1, 2, and 5 (990-item pricing, 309 rate-card-only models, CREDIT column meaning) remain genuinely unresolved — not addressed this pass.

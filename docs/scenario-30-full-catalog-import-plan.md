# Scenario 30 — Full NIG Catalog Import from the Real Item Master (Replaces Demo Seed Items) — Gap Analysis & Closing Plan

## Sources

1. **Item Master** — `NIG-TPE-Data-Collection-Templates - Item Master.csv` (provided 2026-08-18), saved at `backend/prisma/data/NIG-TPE-Data-Collection-Templates - Item Master.csv`. A real physical-inventory snapshot: **21,034 real rows** (after excluding 4 fake template sample rows + 1 blank separator at the top), **1,361 distinct SKU/Model pairs** (clean 1:1, no model has more than one SKU), **127 brands**, across **9 product types**: Appliance (8,938 rows), Small_Items (5,974), Furniture_Non3E (3,295), IT_Products (1,246), Split_Type (588), Furniture_3E (538), Gadgets (370), Bid_Items (79), CCTV (6). Every real row has SKU, Brand, Type, Group, Subgroup, Model, Serial Number, Location, Cost Price, and `Serial Tracked = YES` populated (0 blank Cost Price, 0 blank Serial Number, 1 blank Location out of 21,034).
2. **Appliance rate card** — `APPLIANCE PRICELIST AUG_07_26.xlsx - Sheet1.csv` (Scenario 30's original source, unchanged) — 685 unique BRAND+MODEL combinations, selling price + financing terms (WIP/CR-BR/SSC/ZI/CREDIT CARD/TONIK/SKYRO) per price-use type.

Verified directly against both live files and current code on 2026-08-17/18, during the same planning conversation this doc is written from. No code changed yet.

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

## Open Questions — genuinely unresolved, need an answer before implementation

1. **Pricing for the 990 Item Master-only models.** These have no selling price anywhere. Cost-plus-markup? A flat `sellingPrice` with no installment financing at all? Not decided — flagged explicitly rather than guessed, per the "no fabricated data" principle applying to pricing logic too.
2. **Do the 309 rate-card-only models still get created** (priced, zero stock, no Item Master evidence) or excluded until real stock exists? Not yet decided.
3. **The held-back 9,258 rows' location resolution** — `WHSE`/`KB`/`BB`/`CB`/`MB` region ambiguity, `GB`/`JB`/`JARO` unseeded branches, and the meaning of the trailing-`R`/`-PROMO`/`-ASC` suffixes (checked several sample rows for an internal signal — found none). Confirmed deferred, not solved here.
4. **GL bucket for Small_Items/Gadgets/Bid_Items/CCTV** (see finding above).
5. **CREDIT column meaning** — carried over from Scenario 15/the original Scenario 30 pass, still unresolved (`price-lists.dto.ts`'s `creditAmount` comment: "Meaning not fully resolved; captured only"). Not blocking.

## Closing the gaps

### 1. Item Master parser

**Problem**: no parser exists yet for this file's shape (21,034 rows, one row per physical unit rather than one row per SKU like the rate card).

**Fix**: new parser, grouping by SKU/Model into one Item definition each (Brand/Type/Group/Subgroup/Description/UOM — verify consistent per SKU, flag rather than silently pick a value on conflict) plus a list of that model's Serial+Location+Cost rows. Apply the location filter from the Decisions section (unambiguous branch match only) when building the stock/serial list. Skip the 4 fake template sample rows + blank separator at the top of the file.

**Status**: not started.

### 2. Rate card parser fix (unchanged from the original Scenario 30 pass)

**Problem**: `parsePriceListCsv()` (`price-list-import.util.ts:57-133`) reads fixed column positions built for the old 16-column layout (no TYPE/GROUP/SUBGROUP, which the current rate card export has). Dropping the new file in as-is would silently misread columns.

**Fix**: update the destructured column positions to skip the 3 new columns; capture BRAND (currently skipped). Delete `appliance-pricelist-2026-08-07.csv`, add the new file as `appliance-pricelist-2026-08-17.csv`.

**Status**: not started.

### 3. Full catalog replace — Item/Brand/Type/Category/stock/serial creation for all 1,361 real models

**Problem**: `NIG_CATALOG_ITEMS` (77 items, 35 fictional) is the only current source of truth; none of the 1,361 real Item Master models exist in the system.

**Fix**: retire `NIG_CATALOG_ITEMS` and its dependent stock-seeding block. For all 1,361 models: match-or-create `ItemBrand`/`ItemType`/`ItemCategory` (GROUP as parent, SUBGROUP as child, same nested structure as originally planned) from the Item Master's own columns; create the `Item` row using the Item Master's own SKU, Description (as name), Model, Cost Price, `isSerialTracked: true`; seed `SerialNumber`/`StockBalance` only for the 11,776 rows with an unambiguous location match (per the Decisions section); extend `categoryNamesByGlCategory` per the GL-routing finding, pending Open Question 4.

**Status**: not started.

### 4. Price the 376 overlapping models across all 7 price-use types

**Problem**: the existing curated-pricing block (`seed.ts:7910-8002`) only prices the 42 models that happened to match the old fictional catalog.

**Fix**: same mechanism, applied to the 376 models that exist in both sources — `PriceListItem` (+ `PriceListItemTerm` for whichever of 3/6/9/12mo terms the rate card has) across WIP/CR-BR/SSC/ZI/CREDIT CARD/TONIK/SKYRO. The 309 rate-card-only and 990 Item-Master-only models are blocked on Open Questions 1–2 above — not priced in this pass.

**Status**: not started.

## Implementation Log

_(empty — no implementation has started; this is the planning pass only)_

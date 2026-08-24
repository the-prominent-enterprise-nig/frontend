# Scenario 37 — POS Price Use Guide & Payment Mode Alignment — Gap Analysis & Closing Plan

Source: developer walkthrough (2026-08-20) of NIG's real "Price Use Guide" (WIP / CR-BR / SSC / PROMO / ZI, each row carrying reference LCP/CREDIT columns), the third-party financing list (Salmon, Skyro, Tonik), the payment gateway list (Palawan, GCash Soundpay, ECPay, Maya QR, Security Bank (SCB) QR), and the POS transaction/credit-card list (BDO, BPI, Metrobank, Maya) — plus two whiteboard photos of the intended checkout flow (Customer → Agent → Price → Price Used → Sale Mode → Item Payment Mode). Reconciled live, in conversation, against the current schema, seed data, and `pos/checkout/page.tsx`; every open decision below was confirmed with the developer before this doc was written. No code changed this session — planning-only pass.

## What's already fine — verified, not re-scoped here

- Scenario 15's `PriceUseType`/`PriceList` machinery is fully wired to POS checkout (`PriceUseSelector.tsx`, `usePriceResolution.ts`) — WIP, CR-BR, SSC, PROMO, ZI, TONIK, and SKYRO already exist as real, selectable rows, each resolving a price list once per sale (`PosTransaction.priceUseTypeId`), with a documented per-line override path (`priceOverrideBy`). Admin CRUD for the taxonomy itself already exists (`inventory/price-use-types/`, `PriceUseTypesService`, plus in-context management via `ManageCategoriesDrawer.tsx`).
- Sale Mode (Sale/Reserve) already exists end-to-end — `saleMode: 'sale' | 'reserve'` in checkout, backed by the reservation/`ParkedSale` flow closed under Scenario 03.
- Customer search/create and Selling Agent selection are both already live in checkout.
- The Cash/Card/Installment split already exists at the schema level: `PosInvoiceType` (cash/charge/installment/mixed), `PosPaymentMethod` (cash/card/gcash/maya/gift_card/store_credit/loyalty_points/bank_transfer/tpf/custom), `InstallmentProvider` (inhouse/tpf), and a real `TpfProvider` model settling a sale in full outside NIG's own underwriting — exactly the "in-house vs. third-party, don't calculate" split the guide describes. Per-line Pay Now/Installment switching (`setLineInstallmentProvider`) is already live.
- VAT-inclusive/exclusive price handling already exists (`_utils/calculations.ts`'s `isLineInclusive` / `displayUnitPriceWithTax` / `taxContribution`, tenant default `defaultPricingMode`) — the underlying math for "item price already includes VAT" is there. Whether it's _surfaced_ to the cashier as an explicit Initial Price + VAT = Uploaded Price breakdown needs a direct check during implementation — not confirmed either way this session.
- `PosPaymentMethodConfig` (+ branch overrides) already gives tenants a manage-your-own-methods screen (`BranchPaymentMethodsSection.tsx`) for the top-level methods (cash, card, bank_transfer, gcash, maya, etc.).

## The problem being fixed

1. **Stray "CREDIT CARD" price-use type.** `prisma/seed.ts`'s price-use-type block (~line 5906) seeds an 8th type, "CREDIT CARD — reference price only," that isn't part of the real Price Use Guide (WIP/CR-BR/SSC/PROMO/ZI). Confirmed with developer: remove it.
2. **No seasonal on/off for a price-use type.** "Tonik ZI (Seasonal)" needs to be toggleable without losing history, but `PriceUseType` has no active/enabled flag — `PriceUseTypesService.remove()` is a hard `delete`, blocked by a foreign-key conflict (`price_use_type_in_use`) the moment any `PriceList`/`PosTransaction`/`InstallmentAccount` has ever referenced it. Once Tonik ZI has been used in one real sale, delete-and-recreate stops working as a seasonal toggle.
3. **No structured dropdown lists for card terminals, transfer banks, or QR gateways.** `PosPaymentMethodConfig` models one row per top-level method (e.g. one "Bank Transfer" row, one "Card" row) with a single free-text reference field — there's no child list of specific values (BDO/BPI/Metrobank/Maya for the POS Terminal; Palawan/GCash Soundpay/ECPay/Maya QR/Security Bank QR for the QR gateway). Confirmed with developer: these should be tenant-managed lookups, same editability model as `PriceUseType`, not hardcoded.
4. **No "Credit Card Installment + Term" capture.** `PosPayment` records `paymentMethod`, `referenceNumber`, `cardLast4` — nothing distinguishes a card transaction run Straight (one-time charge) from one run as Installment, and there's no field to record the Term (e.g. 6/12/18/24 months) a bank card issuer is running it on. Confirmed with developer: this is capture-only, the same "don't calculate" treatment as third-party financing — NIG never computes DP/MI for a card-issuer installment plan.
5. **(To verify during implementation) VAT breakdown display.** Whether the checkout line item currently shows "Item Initial Price + VAT = NIG Uploaded Price" as an explicit breakdown, or just the final tax-inclusive number, wasn't confirmed by reading the render JSX this session — needs a direct check before deciding whether this is a real gap or just documentation of existing behavior.

## Re-verification note — implementation kickoff, 2026-08-20

Both flagged-for-verification items above turned out not to be what they looked like when this doc was first written. Re-checked live during `/implement-scenario`'s Phase 1, before any code was touched:

- **Item 5 (VAT breakdown) is already satisfied — no gap, no code change.** `pos/checkout/page.tsx`'s Order Summary panel (~line 3004-3045) already shows Subtotal (VAT-excl.) → VAT → Total, driven by `vatExclSubtotalForBackend`/`taxTotal`/`totalAmount`. Cart-level rather than per-line, but nothing in the requirement demanded per-line.
- **Item 1 (the "CREDIT CARD" price-use type) is reversed — it is kept, not removed.** It's not a stray unused label: `prisma/seed.ts`'s `seedNigCuratedPricing` (~line 7068-7186) creates a real `PriceList` for it and populates it from the client's own rate-card CSV (`prisma/data/appliance-pricelist-2026-08-17.csv`), which has a `PRICE USE` column carrying 668 real rows tagged `CREDIT CARD` — genuine per-model Price/Down Payment/MI/PPD/Credit/CM data, same as WIP/CR-BR/SSC. It just wasn't mentioned in the separate Price Use Guide summary table this scenario started from. Developer confirmed (2026-08-20, on seeing this): **keep it as its own price-use type.** Section 1 below is closed with no action.

## Closing the gap

### 1. ~~Remove the stray "CREDIT CARD" price-use type~~ — closed, no action (see Re-verification note above)

Superseded: it's real client rate-card data (668 rows), not a stray seed row. Kept as-is.

### 2. Add an active/enabled flag to `PriceUseType`

New `isActive Boolean @default(true)` column (mirrors `PosPaymentMethodConfig.isEnabled`). `PriceUseTypesService.findAll` gets an `activeOnly` filter that POS checkout's `PriceUseSelector.tsx` always passes; the admin screen (`inventory/price-use-types/`) shows all rows with a toggle instead of only offering hard delete. Tonik ZI's seasonal on/off becomes a toggle, not a delete/recreate — preserves every `PriceList`/`PosTransaction`/`InstallmentAccount` that already references it.

### 3. New tenant-managed dropdown-option lookup

New model (e.g. `PosPaymentMethodOption`) parented to a `PosPaymentMethodConfig` row by key (`card` → POS Terminal list; `bank_transfer` → bank list; a QR-type config → gateway list), with `name`, `isEnabled`, `displayOrder`, following the exact `PriceUseType`/`PosPaymentMethodConfig` admin pattern (own CRUD service/controller, own admin screen section alongside `BranchPaymentMethodsSection.tsx`). Seed with the three confirmed lists:

- POS Terminal (card): BDO, BPI, Metrobank, Maya
- QR gateways: Palawan, GCash Soundpay, ECPay, Maya QR, Security Bank (SCB) QR
- Bank Transfer banks: reuse the POS Terminal list unless the developer confirms a separate/longer bank list is wanted (not settled this session — the guide only gave the 4-bank card list, not an explicit Bank Transfer list).

### 4. Capture card Straight/Installment + Term

Add `cardTxnMode PosCardTxnMode? ('straight' | 'installment')` and `cardInstallmentTerm String?` to `PosPayment` (only meaningful when `paymentMethod: 'card'`). Checkout's Credit/Debit Card payment UI gains the POS Terminal dropdown (from #3) plus a Straight/Installment toggle that reveals a Term field when Installment is picked — mirrors the existing TPF DP/Terms/MI hand-entry fields already on the Installment path: plain captured values, nothing computed.

### 5. ~~Confirm/close the VAT breakdown display gap~~ — closed, no action (see Re-verification note above)

Already shown at the Order Summary level. No code change.

## Decisions already settled with the developer (2026-08-20)

1. ~~LCP/CREDIT guide columns are reference-only~~ — **reversed, 2026-08-20, mid-implementation**: the client (Ann/NIG, via chat) confirmed CREDIT is a real "Incentive Scheme" amount credited to the branch — Full credit = branch receives the full invoice amount, Half credit = half (e.g. ₱10,000 invoice → ₱10,000 full / ₱5,000 half). This is not new: it maps directly to `PriceListItem.creditAmount`, already in the schema since Scenario 15, already populated by the rate-card CSV's own `CREDIT` column, and already editable/visible in the Price Lists UI since Scenario 34 — it just wasn't understood as a real rule until now. Whether `creditAmount` should _auto-derive_ from the Full/Half/None/capped rule per price-use row (it's currently hand-typed, per Scenario 34) is **out of scope for Scenario 37** — developer decision: log as its own follow-up scenario, to be scoped later once the exact per-row rule and LCP's meaning (still unclarified) are confirmed. Doesn't block or change Scenario 37's 3 payment-mode/price-use-plumbing parts, which are unrelated to `creditAmount`.
2. ~~The stray "CREDIT CARD" price-use type is removed~~ — **reversed at implementation kickoff** (see Re-verification note above): it carries 668 rows of real rate-card data and is kept as its own price-use type, not removed or merged.
3. **Bank/gateway/terminal dropdown lists are tenant-managed lookups**, not hardcoded enums — same editability model as `PriceUseType`. Bank Transfer reuses the same 4-bank list as POS Terminal (BDO/BPI/Metrobank/Maya) — confirmed at implementation kickoff, no separate/longer list.
4. ~~"Tonik ZI (Seasonal)" is a toggle on the existing TONIK price-use type~~ — **reversed, 2026-08-21**: checked directly against the client's own Price Use Guide document (WIP/CR-BR/SSC/PROMO/ZI only, each with real sub-rows like "ZI Installment Only"/"Split Type ZI Installment" — no Tonik entry anywhere) — TONIK and SKYRO are **TPF providers** (see `TpfProvider`, seeded alongside SALMON), not Price Use categories at all. The `isActive` toggle built for item 2 above turned out to be exactly the right tool for a different job: both are now toggled `isActive: false` (not deleted — each still carries 100+ rows of real curated rate-card pricing from the appliance rate card CSV, kept for history/potential reuse, just no longer offered as a selectable Price Use at checkout). `CREDIT CARD` (see item 2) is unaffected by this correction — it's a separate, still-open case.
5. **Credit Card Installment only records a Term** — no DP/MI calculation, matching third-party financing's existing "hard code, don't calculate" treatment.
6. **"COD" in the whiteboard notes is shorthand for Cash** — not a separate delivery-timing concept; no new fulfillment dimension needed.

## Explicitly out of scope

- Auto-calculating `PriceListItem.creditAmount` from the Full/Half/None/capped rule per price-use row — confirmed real (see Decision 1 above, corrected mid-implementation), but deferred to its own follow-up scenario doc rather than folded into this one; LCP's meaning is still unclarified.
- A separate Bank Transfer bank list distinct from the 4-bank POS Terminal list — not requested; #3 defaults to reusing the same 4 unless told otherwise.
- Salmon as its own reference price-use type (unlike Tonik/Skyro, which already have "reference price only" `PriceUseType` rows) — the guide lists Salmon only as third-party financing, never as a price-use row; not adding one unless asked.

## Verification (once implemented)

1. Fresh seed: price-use types are exactly WIP, CR-BR, SSC, PROMO, ZI, TONIK, SKYRO, CREDIT CARD — all 8 kept (none deleted), but TONIK/SKYRO seed as `isActive: false` (see Decision 4 correction) — checkout's Price Used selector shows only WIP, CR-BR, SSC, PROMO, ZI, CREDIT CARD.
2. Admin screen (Inventory → Price Lists → Price Use Types): toggle any type on/off — it disappears from/reappears in checkout's Price Used selector, but any existing sale/price list that referenced it is untouched. Confirmed live for TONIK/SKYRO specifically.
3. Checkout, Credit/Debit Card payment: POS Terminal dropdown shows BDO/BPI/Metrobank/Maya; picking Installment reveals a Term field; the sale completes without any DP/MI calculation happening for that line.
4. Checkout, Cash payment: Bank Transfer and QR both show their tenant-managed dropdowns (Bank Transfer: BDO/BPI/Metrobank/Maya; QR: Palawan/GCash Soundpay/ECPay/Maya QR/SCB QR) instead of free text.
5. Admin: the new dropdown-option lists (POS Terminal, QR gateways, Bank Transfer) are addable/renameable/retireable from the same settings area as existing payment-method config, no deploy required to change them.

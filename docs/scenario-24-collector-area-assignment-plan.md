# Scenario 24 — Area-Based Collector Assignment — Gap Analysis & Closing Plan

Source: developer-defined, 2026-08-08 — not sourced from either client PDF. Requested directly as a **counter-check scenario**, same class as Scenarios 21-23: operationalizing a POS/collections team meeting comment from last week. The comment: _"Area – can be pulled out from the address information in the CRM; from there, the collector will be assigned to an area."_

## Related ClickUp Tickets

Not checked this pass — recommend a quick `clickup_search` before implementation starts, same as Scenario 23.

## Related docs

- `scenario-20-collections-namidre-dam-plan.md` — the Collector/InstallmentAccount collections workflow this scenario's assignment step feeds into.
- `scenario-02-crm-customer-profile-plan.md` — the Customer profile/address capture flow this scenario extends.
- `scenario-23-transaction-invoice-lookup-plan.md` — a sibling developer-defined counter-check scenario from the same pass, unrelated subsystem.

## The scenario we're building toward

1. "Area" is a real, structured concept — not free text — derived from a customer's address. **Area = barangay** (developer-confirmed 2026-08-08), the natural unit for a Philippine field-collection route, identified by the barangay's own code (`brgy_code`) rather than its name, since barangay names repeat across different cities/provinces (e.g. multiple "San Isidro" barangays nationwide) and matching on name alone could group unrelated areas together.
2. A Collector is assigned to cover one or more Areas (in addition to their existing branch).
3. When a customer needs a collector (e.g. their Installment Account is created), the system uses the customer's stored Area to automatically assign — or at minimum narrow the choice to — the collector(s) who cover it, instead of today's flat pick-anyone dropdown.

**Result**: collector assignment follows where a customer actually lives, matching how field-collection routes work in practice, instead of being an arbitrary manual pick from every collector in the system regardless of location.

## What's already done ✅

1. **A real structured Philippine address picker already exists and is wired into customer creation.** `PhilippineAddressPicker.tsx` (`frontend/src/components/common/PhilippineAddressPicker.tsx`) is a cascading Region → Province → City/Municipality → Barangay selector, backed by real self-hosted PH address datasets (`public/data/ph-address/*.json`), used by the CRM "New Customer" form. This is most of the hard part (a real barangay-level dataset + working UI) already solved — the gap is narrower than "build address structure from scratch."
2. **`Collector` already has a home to attach coverage data to** — it's a real model (`prisma/schema.prisma:2075-2096`) with `branchId`, `status`, and relations into `InstallmentAccount`/`CollectorRemittance`/`CollectionIncentive`. Adding an area-coverage relation is additive, not a redesign.
3. **Collector assignment already has one real entry point** — `InstallmentAccount.collectorId`, set via `dto.collectorId` in `installment-account.service.ts` (create at L312, update at L479) — there's exactly one place assignment logic needs to plug in, not several scattered call sites.

## What's not done / gaps ❌⚠️

1. **"Area" doesn't exist anywhere as stored data.** Schema-wide search (case-insensitive) for `area`/`zone` returns zero hits. Nothing on `Customer`, nothing on `Collector`, no standalone model.
2. **The address picker resolves structured data and then throws it away.** Its `onChange` callback signature is `(formattedAddress: string) => void` (`PhilippineAddressPicker.tsx:61-64`) — region/province/city/barangay are all resolved internally to build one composed string (`"street, barangay, city, province, region, Philippines"`), then discarded. Nothing downstream ever sees the structured pieces, only the flattened text.
3. **`Customer.billingAddress`/`shippingAddress` are unstructured free text** (`VarChar(1000)` each, `prisma/schema.prisma:4206-4207`) — there's no city/barangay column to read an Area from even if we wanted to parse it back out after the fact (fragile anyway — inconsistent formatting, abbreviations).
4. **The two address fields are functionally one field today, adding noise to any address-structuring work.** Every real customer-creation path mirrors one value into both: the CRM "New Customer" form (`CustomerForm.tsx:224-229`) explicitly copies `form.shippingAddress` into `billingAddress`, and the POS walk-in path (`pos-customers.service.ts:29-30`) does the same. No UI path today ever sets them to different values — carrying two fields through the Area-extraction work would double the surface area for no real benefit today.
5. **`Collector` has no geographic coverage concept beyond `branchId`.** A branch typically spans a whole city/region — far coarser than a walkable collection route — and there's no second, finer-grained field at all.
6. **Collector assignment is a flat, unfiltered manual pick.** The `InstallmentAccount` create/edit forms show every collector (`collectorsApi.list({ limit: 200 })`, `NewInstallmentAccountForm.tsx:176-186`) with zero connection to the customer's address. No auto-assign, no filtering, no suggestion logic exists anywhere in `installment-account.service.ts` or `collector.service.ts`.

## Closing the gaps

Ordered so each item's output is what the next item needs.

### 1. Collapse `billingAddress`/`shippingAddress` into one `address` field

**Fix**: since no UI path ever sets them differently (gap 4), consolidate to a single `Customer.address` column before doing any structural work on top of it — otherwise the next steps have to duplicate everything across two fields for no real gain. Migration: backfill `address` from `shippingAddress` (already always equal to `billingAddress` in practice), drop the old columns, update `customer.dto.ts`/`customer.service.ts` and every read site (`accounting/customers`, `purchase-order` PO delivery-address usage, `CustomerForm.tsx`, `MergeCustomerModal.tsx`, etc.).

### 2. Stop discarding the picker's structured data

**Fix**: change `PhilippineAddressPicker`'s `onChange` to also emit the barangay it already resolves — specifically its `brgy_code`, not just `barangayName` (the component tracks `barangayName` today per `PhilippineAddressPicker.tsx:73`, but the underlying `PhBarangay` records it fetches already carry a unique `brgy_code`; the picker just needs to also bubble that up). Add a real column — `Customer.barangayCode` — populated alongside `address` whenever the picker fires. (City stays implicit — every `brgy_code` already maps to exactly one city in the PH dataset, so there's no need for a separate `Customer.city` column just to disambiguate.)

### 3. Give `Collector` an area-coverage list

**Fix**: add a coverage relation on `Collector` — a join table (`CollectorArea`: `collectorId`, `barangayCode`) so one collector can cover several barangays and barangays can (deliberately or not) be covered by more than one collector. Surface it in the Collector create/edit form as a multi-select over the same barangay dataset the address picker already uses.

### 4. Auto-assign/filter collector by the customer's barangay at account creation

**Fix**: when creating (or reassigning) an `InstallmentAccount`, look up `Collector`s whose `CollectorArea` coverage includes the customer's `barangayCode` and either auto-fill `collectorId` or narrow the dropdown to just those matches — resolving Open Questions 1 and 2 below determines which.

## Open questions requiring developer/business confirmation

1. **No collector covers a customer's barangay** — fall back to a manual pick (today's behavior, unblocked), or block/flag the account until someone is assigned coverage for that barangay?
2. **More than one collector covers the same barangay** — auto-pick by some rule (least current caseload? alphabetical? branch match?), or surface just the matching collectors and let staff choose among them rather than fully auto-assigning?
3. **Does this apply retroactively** to the existing `Collector`/`InstallmentAccount` population, or only to new records going forward? Existing collectors have no area data and existing customers have no stored `barangayCode` (only legacy free-text addresses) — a backfill pass would need someone to manually map existing free-text addresses to barangays, which isn't something to automate reliably.

## Verification — the counter-check test matrix

Concrete pass/fail steps, to run after each closing-gap item lands. Current (2026-08-08) expected result noted for each.

### Address consolidation

- Create a customer via the CRM form or POS walk-in → exactly one `address` value is stored, no separate/divergent billing vs. shipping value anywhere. **Currently: PASS in practice (both paths already mirror one value) — but via two redundant columns, not a real single field.**

### Structured area capture

- Create a customer through the address picker, selecting a real barangay → the customer record stores that barangay's `brgy_code` as queryable data, not just buried in a formatted string. **Currently: FAIL — picker output is a single composed string, the resolved `brgy_code` is discarded.**
- Two customers in different cities who happen to share a barangay name (e.g. two different "San Isidro"s) → store two different `barangayCode` values, never conflated. **Currently: N/A — no structured storage exists yet to test this against.**

### Collector area coverage

- Create/edit a Collector and assign it coverage over one or more specific barangays → that coverage is stored and visible on the Collector record. **Currently: FAIL — no such field exists.**

### Assignment

- Create an Installment Account for a customer whose barangay matches exactly one collector's coverage → that collector is auto-assigned (or is the only one offered), not picked from a flat list of all collectors. **Currently: FAIL — `collectorId` is an unfiltered manual dropdown of every collector regardless of area.**
- Create an Installment Account for a customer whose barangay has no covering collector → falls back per Open Question 1's resolution, not a silent dead end. **Currently: N/A — no area concept exists to trigger this case at all.**

## Implementation Log — 2026-08-10

**For this scenario, I have done:**

- **Closing Gap 1** (address consolidation) — `Customer.billingAddress`/`shippingAddress` collapsed into one `address` column (migration `20260809142702_consolidate_customer_address`, `COALESCE(shippingAddress, billingAddress)` backfill — moot in practice, verified live that only 1/90 customers had both fields populated, and identical). Every read/write site updated: CRM customer DTO/service, Accounting customers service (root cause of the doc's stale "always mirrored" claim — this module's own path only ever wrote `billingAddress`), POS walk-in DTO/service, seed scripts, and all frontend forms/lists (`CustomerForm.tsx`, `CustomersList.tsx` in both CRM and Accounting, `MergeCustomerModal.tsx`, POS checkout's walk-in modal).
- **Closing Gap 2** (structured area capture) — `PhilippineAddressPicker`'s `onChange` now emits `{ address, barangayCode }` instead of a flattened string alone; the Barangay `SearchableSelect` tracks by `brgy_code` (not name) internally. New `Customer.barangayCode` column (migration `20260809150000_add_customer_barangay_code`), wired through both call sites that use the picker (CRM customer form, POS walk-in checkout via the shared `CustomerExtraFields.tsx`). Accounting's own customer form was left alone — it never used the picker (plain free-text address), so there's no source to capture a code from.
- **Closing Gap 3** (collector area coverage) — new `CollectorArea` join table (migration `20260809160000_add_collector_area`, cascade-delete with the collector; unique per `(collectorId, barangayCode)` but deliberately _not_ unique across collectors, since Open Question 2's resolution requires overlapping coverage to be valid). `CreateCollectorDto.areaBarangayCodes` on create/update, full-replace-on-update semantics (omitted = unchanged, explicit array including `[]` = new full set) — same pattern already used by Customer's `bankAccounts`/`coMakers`. New `CollectorAreaPicker.tsx` (multi-select accumulator over the same cascading Region/Province/City/Barangay dataset the address picker uses, factored into a shared `libs/data/ph-address.ts` so both components share one fetch/cache) wired into the Collector create/edit forms and shown read-only on the Collector detail page.
- **Closing Gap 4** (auto-assignment) — `InstallmentAccountService.suggestCollector()`: matches the customer's `barangayCode` against `CollectorArea` coverage; no match → `null` (Open Question 1: falls back to manual pick); one match → that collector; multiple matches → least active caseload, tied on earliest-registered collector (Open Question 2). Also branch-scoped the same way `CollectorService` already scopes everything else (branchless collector = available to everyone, branch-specific = only within that branch) — not explicitly asked for, but without it a Branch Manager could get auto-assigned a collector their own collectors dropdown wouldn't even show them. Wired into `POST /crm/installment-accounts` (explicit `collectorId` always wins over auto-assign) and a new read-only `GET /crm/installment-accounts/suggest-collector` preview endpoint. Frontend: `NewInstallmentAccountForm` calls the preview endpoint once a customer is picked, pre-selects the suggested collector while still showing the full unfiltered list (developer's confirmed choice over a filtered-dropdown or fully-silent-backend design), tags the matched option "— suggested," and shows a hint when there's no match. Same-day follow-up (developer-requested after live testing): `EditInstallmentAccountForm` now calls the same preview endpoint and pre-selects a suggestion too, but only when the account genuinely has no collector yet — an already-assigned collector is never silently swapped out just because a coverage change now produces a "better" match.
- **Open Question 3** (retroactive backfill) — confirmed not attempted, per the doc's own reasoning that mapping existing free-text addresses to barangays isn't reliably automatable. Existing customers keep `barangayCode: null` until next edited through the picker; existing collectors have no `CollectorArea` rows until someone adds coverage.

**Worth flagging:**

- Found live while testing Part 3 (not part of the original scope, fixed alongside it): the Collectors list table only had the stub-number cell as a link — the rest of the row wasn't clickable — and there was no delete action anywhere in the Collector UI (the backend `DELETE` route existed and was already covered by e2e tests via direct API calls, but nothing in the UI reached it). Both fixed: the whole row now navigates like the CRM Customers list already does, and a "Danger Zone" delete button was added to the Collector detail page, matching the Customer profile's own delete pattern exactly.
- A pre-existing, unrelated Swagger/OpenAPI documentation bug found while regenerating types for Part 2: `CreateCustomerDto` is defined as two different classes (CRM's and Accounting's) with the same name, so NestJS's generated OpenAPI doc silently shows only one of them under that name. Cosmetic only — each controller still validates against its own actual imported class at runtime, confirmed nothing in the frontend consumes the generated type for this specific class — not fixed, flagged in case it's worth a rename later.
- A live `invalid_relation_id` error was reported once during manual testing of an unrelated customer edit, mid-way through Part 2's backend deploy. Investigated at length (direct reproduction attempts against the same record, temporary diagnostic logging of the Prisma error's `meta` field) but never reproduced again once the backend settled — most likely a transient artifact of the dev server restarting mid-request while backend files were being actively edited, not a persistent bug. Diagnostic code was reverted; if this recurs, the temporary `meta`-logging change is a fast way back to a real root cause.
- "Area = barangay" only labels the composed `address` string's _first_ real-address segment where the street/building line was left blank — some real barangay names (e.g. "PHHC Block 17" in Iloilo City) read like a street address to a human, which surfaced as two separate "the barangay isn't showing" reports that turned out to be correct data, just an unlabeled/ambiguous display. **Escalated same day into a real bug, not just a display nitpick**: a test customer ("Chloe Belle Estilo," `CUS-RDYBTZ`) ended up with a fully-formatted-looking address but `barangayCode: null`, because "PHHC Block 17" had been typed into the free-text street box rather than clicked from the Barangay dropdown — both produce an identical-looking composed address, so there was no way to tell after the fact which one happened. Fixed at the source: `PhilippineAddressPicker` now shows a live status line once a city is selected — "✓ Barangay selected: \<name>" or "⚠️ No barangay picked yet — select one above; typing it into the street line below won't match it to a collector area" — so the ambiguity can't happen silently going forward. The one existing affected record was backfilled directly (`barangayCode` set to `063022127`, the correct code for "PHHC Block 17").
- Two more list-row-not-fully-clickable gaps found live (same root cause and same fix as the Collectors list, above): the Installment Accounts list only had the Account # cell as a link. Fixed the same way — the whole row now navigates.
- **Developer-requested design change to `EditInstallmentAccountForm`**, prompted by live testing revealing Create and Edit have entirely different field sets with no shared context: rather than unifying the two into one unified form component (discussed and explicitly declined — too large a change for the benefit), added a read-only "Account summary" card above Edit's editable fields, showing the customer name and the original financing terms (listed cash price, down payment, term, MI factor, amount financed, monthly installment, PNV, total price) as plain labeled values, clearly marked "set at creation, not editable here." Solves the actual complaint (no visibility into who/what an account is for while servicing it) without the risk of a full form-component merge.

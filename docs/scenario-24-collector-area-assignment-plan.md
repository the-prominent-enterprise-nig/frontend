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

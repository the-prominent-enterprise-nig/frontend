# Scenario 60 — POS Client Feedback Batch (Customer Creation, Credit Application, Delivery, TPF) — Gap Analysis & Closing Plan

**Source**: client feedback relayed 2026-09-24, covering four POS surfaces in one pass — customer creation, the credit application form, Cancel Sale, and a net-new Delivery capture at checkout, plus one TPF cleanup.

Unlike most scenarios in this series, this one is not a single feature. It is a batch of 17 separate client notes at wildly different sizes — three are one-line string edits, six need a migration, two are blocked on someone else, and one the client explicitly parked. The point of this doc is therefore to **separate what can ship today from what cannot**, and to say why for each.

---

## Verdict table

Verified against `development` on 2026-09-24 (both repos freshly pulled; frontend `cb7b48e8`, backend `f8dc9ee`).

| #   | Client note                                             | Verdict                   | Why                                                             |
| --- | ------------------------------------------------------- | ------------------------- | --------------------------------------------------------------- |
| 1   | Region 6 default on the first dropdown                  | ✅ **Today**              | Frontend only — one `useState` seed                             |
| 2   | "Raise one for this cart" → New Credit Application Form | ✅ **Today**              | One string                                                      |
| 3   | Remove "Approved amount (optional)" from TPF            | ✅ **Today**              | Field is nullable end-to-end, nothing reads it                  |
| 4   | Co-maker **number** required                            | ✅ **Today**              | Frontend only — and it fixes a real drift (see gap 4)           |
| 5   | "Spouse or Co-maker" wording                            | ✅ **Shipped** 2026-09-28 | Built as a two-level picker, not a relabel — see the log        |
| 6   | Approved-but-incomplete when ID is missing              | ✅ **Shipped** 2026-09-28 | Derived; the list surface needed a backend field after all      |
| 7   | Co-maker **address** required                           | ❌ Migration              | `CoMaker` has no address column at all                          |
| 8   | Collector on the credit application                     | ❌ Migration              | No FK exists; `Collector` does                                  |
| 9   | Address on the New Credit Application                   | ❌ Migration              | **Clarified 2026-09-28** — it is the CURRENT address, read-only |
| 10  | Home + current address, current synced                  | ❌ Migration              | **Clarified 2026-09-28** — "synced" is now resolved, see below  |
| 11  | Deliver to / Delivery Address / delivery fee            | ❌ Migration              | Half the columns exist and are never written; two don't exist   |
| 12  | Delivery fee excluded from the total                    | ➖ Already designed for   | Schema already keeps it out of `subtotal`/`totalAmount`         |
| 13  | Delivery fee GL mapping                                 | ❌ Depends on 11          | No migration needed, but nothing to post until 11 lands         |
| 14  | Separate CR for down payment and delivery fee           | ➖ Already built          | The report already emits it as its own CR line                  |
| 15  | Cancel Sale → dropdown                                  | 🚧 **Blocked**            | Elijah owes the list of cancellation reasons                    |
| 16  | Friends-and-family price override                       | 🚧 **Parked by client**   | "format is not finalized with client"                           |
| 17  | Reference lives on the hard copy; TPE is lite           | ➖ No build               | Informational — it is a decision _not_ to add a field           |
| 18  | Down payment is 30%, not 10%                            | ✅ **Shipped** 2026-09-28 | Was 10% at 15 sites across both repos, incl. user-facing copy   |
| 19  | Application number, auto-generated                      | ✅ **Shipped** 2026-09-28 | Already existed; was unlabelled, so it did not read as one      |
| 20  | Supporting docs optional / approve but incomplete       | ✅ **Shipped** 2026-09-28 | Same work as gap 6 — see the second 2026-09-28 log              |
| 21  | Item price must come from the Inventory price list      | ✅ **Shipped** 2026-09-28 | No application had EVER been priced from a price list — see log |

**Doable today: items 1, 2, 3, 4, 5, 6.** Two of those need a one-line answer first (5 and 6) — both are under _Decisions needed_ below, and both have a safe reading that ships today either way.

---

## What's already done ✅

More than the notes assume, in three places:

- ~~**A cashier can already approve a credit application without an ID, and the sale can already proceed** (item 6). There is no document gate anywhere.~~ **WRONG — corrected 2026-09-28.** Nothing gates on the `applicant_id` type specifically, which is what I checked; but there were **three** separate blocks on the surrounding workflow, and I missed all of them because I grepped `credit-application.service.ts` for `documents` and stopped there. See the 2026-09-28 implementation log: submit required at least one document (enforced in **both** repos), and attaching was refused outright once a decision was made — that guard lives in `credit-application-documents.service.ts`, a different file from the one I searched. The behaviour the client asked for was **not** already there.
- **Delivery fee is already modelled, and the separate collection receipt already exists** (items 12, 14). `PosTransaction.deliveryFee` and `PosTransaction.deliveryFeeReferenceNumber` exist (`prisma/schema.prisma:3485`, `:3489`), added by two migrations in Aug/Sep 2026, and `daily-collection.service.ts:604-617` already emits the delivery fee as its **own collection-receipt line** with its own CR number and a `delivery_fee` tender — which is item 14, built. The schema's own doc comment states item 12 as the design intent: _"kept separate from subtotal/taxTotal so it never enters the per-line/per-financing-term amounts used to balance charge/installment JEs."_
- **The Philippine address picker is cascading and already puts Region first** (item 1). `PhilippineAddressPicker.tsx:204` renders Region as the first `SearchableSelect`, backed by a self-hosted PSGC dataset. Region VI is `region_code` `'06'` in `public/data/ph-address/region.json`.
- **`Collector` is a real, branch-scoped model** (item 8) with barangay-level `CollectorArea` coverage used for auto-assignment. Adding it to a credit application is a wiring job, not a new concept.
- **`AccountMapping` is keyed free-text, upserted from code** (item 13) — `STANDARD_MAPPINGS` in `account-mapping.service.ts`. A `DELIVERY_FEE_INCOME` key needs **no migration**, just an entry and a mapping sync.

---

## What's not done / gaps ❌

### Shippable today

1. **The Region dropdown starts empty.** ❌
   `PhilippineAddressPicker.tsx:50` — `useState('')`. Every customer creation begins with the cashier searching for a region that is, in practice, always the same one.
   **Fix**: seed `regionCode` to `'06'`. Must not fight the edit-mode hydration path (`:84-120`), which resolves a saved `initialBarangayCode` up the chain and sets `regionCode` itself — seed only when there is no `initialBarangayCode`.
   **Scope question**: the picker has three real consumers (`CustomerExtraFields`, `CollectorAreaPicker`, accounting's `CustomersList`). See _Decisions needed_.

2. **The button reads "Raise one for this cart".** ❌
   `pos/checkout/page.tsx:4252`. Client wants **New Credit Application Form**.
   **Fix**: the string. The surrounding copy at `:4231` and `:4254` still reads correctly with the new label — no other wording needs to move.

3. **TPF still asks for an approved amount.** ❌
   `pos/checkout/page.tsx:4606` renders `placeholder="Approved amount (optional)"`, state at `:573`, submitted at `:2657-2659`.
   **Fix**: remove the input and its state. Safe end to end — `tpfApprovedAmount` is optional in the frontend schema (`schema/pos/index.ts:308`, `:423`), optional in the backend DTO (`pos/dto/pos.dto.ts:652`), and nullable in the column (`prisma/schema.prisma:3553`), and `transactions.service.ts:1066` already coalesces it to `null`. Nothing reads it back. **Frontend only, no backend change.**

4. **Co-maker phone is labelled optional but the column is `NOT NULL`.** ❌ — _this is a live data-quality bug, not just a label_
   `CoMakerFields.tsx:207` and `:302` both render `Phone (optional)`; the zod schema agrees (`schema/credit/applications/index.ts:147`, `:157`). But `CoMaker.contactNumber` is `String @db.VarChar(50)` — **required**. `NewCreditApplicationForm.tsx:232` writes `(data.newCoMakerContactNumber ?? '').trim()`, so leaving it blank stores an **empty string** in a required column rather than failing. Co-makers exist specifically to be reachable when the account goes bad; empty-string contact numbers defeat that silently.
   **Fix**: make it required in zod and drop the `(optional)` marker on both the existing-co-maker and new-co-maker blocks. **Frontend only** — the column already agrees.

5. **The co-maker block is labelled "Co-Maker (optional)" with a free-text Relationship.** ❌
   `CoMakerFields.tsx:85` for the label; Relationship is a plain `<input maxLength={100}>` in both the existing-co-maker and new-co-maker blocks.
   The note reads _"Spouse or Co-maker"_ and can mean either. See _Decisions needed_.

6. **Nothing marks an approved application as incomplete.** ❌
   As established above, approving without an ID already works. `CreditApplicationDetail.tsx` shows the documents list but never contrasts it against what _should_ be there, and `CreditApplicationList.tsx` shows a plain `approved` badge.
   **Fix (no-migration reading)**: derive it — `status === 'approved' && !documents.some(d => d.documentType === 'applicant_id')` → render **"Approved — ID pending"** on the detail and in the list. Nothing is gated; the sale still proceeds, which is what the client asked for. See _Decisions needed_ for the persisted-flag alternative.

### Needs a migration — not today

7. **`CoMaker` has no address column.** ❌ Not in the model, not in the form, not in the DTO. Making it _required_ also needs a position on existing rows (nullable column + app-level required is the only non-destructive route). Pairs naturally with gap 9.

8. **`CreditApplication` has no collector.** ❌ No FK on the model. The interesting part is not the column — it is whether the collector should be **auto-suggested** from the applicant's `barangayCode` via `CollectorArea`, which already exists for exactly this, and whether the picker is branch-scoped to the application's branch (it should be — see the skill's _Branch data scoping_ rules).

9. **The New Credit Application captures no address.** ❌ `ApplicantContactFields.tsx` is 49 lines and holds phone (`:24`) and email (`:37`) only. The client's reasoning — _"the customer profile is different"_ — is the important bit: this is a **point-in-time address on the application**, not a read-through to `Customer.address`. That means a real column, not a join.

10. **Home + current address, with current synced.** ❌ — _flagged: this reverses a prior decision_
    `Customer.address` is deliberately **one** column. Scenario 24 Part 1 collapsed `billingAddress`/`shippingAddress` into it, and the schema comment says why: _"two columns every real write path already treated as one… Collapsed to a single column since nothing in this codebase ever legitimately needed them to differ."_ Re-splitting it is a migration plus every read path plus a backfill, and _"current address should be synced"_ has no defined meaning yet — synced **to** what, in which direction, and what happens when they legitimately differ (which is the entire reason for having two)? This is the single largest item in the batch and the one most likely to be mis-built from the note alone.

11. **Nothing at checkout captures delivery.** ❌
    `deliveryFee` is **orphan schema**: grep across `backend/src` finds only _reads_ (`daily-collection.service.ts`, `sales-report.workbook.ts`) — no create path sets it, and it is absent from `pos/dto/pos.dto.ts`. The frontend never sends it. So the fee is permanently `0` in production and the report line can never fire. On top of that, **"Deliver to" and "Delivery Address" do not exist in any form** — those are net-new columns. (`deliveryReceiptNumber` at `:3496` is a different thing: the paper DR number, and it _is_ already captured.)

12. **Delivery fee GL mapping.** ❌ No `DELIVERY_FEE_INCOME` in `STANDARD_MAPPINGS`, and no posting line for it. No migration needed — but nothing to post until 11 lands.

### Added after the original triage

16. **The down payment floor is 10%, and the client says it should be 30%.** ❌ — _raised 2026-09-28, after the first six parts shipped_
    Not on the original checklist; surfaced while answering a question about where the credit application's down payment comes from. There is **no 30% anywhere in either repo** — the floor is hardcoded `0.1` in **nine places**:

    | Repo     | Where                                                                                                                          |
    | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
    | backend  | `credit/services/credit-application.service.ts:445` — the credit application itself                                            |
    | backend  | `pos/transactions.service.ts:458` and `:503` — checkout, two separate paths                                                    |
    | backend  | `credit/dto/credit-application.dto.ts:108` — the DTO description                                                               |
    | frontend | `pos/checkout/page.tsx` — `lineFloor` (`:2070`), two submit guards (`:2511`, `:2529`), `minDownPayment` (`:4309`)              |
    | frontend | `pos/checkout/page.tsx:4416`, `:4436-4437` — user-facing copy: the **"10% min"** badge and _"Fixed at 10% of the sale amount"_ |

    **The copy must move with the rule**, or the screen advertises 10% while the server rejects anything under 30% — the worst version of this change.

    **Open questions, none answered yet:**
    - Is 30% a **floor** (pay more if you like), as 10% is today, or a **fixed** amount?
    - Does it apply to **checkout as well**, or only the credit application? They share the rule today but are enforced separately.
    - How does it interact with a **curated down payment** on a price list item? Those are peso amounts per SKU and can sit below 30% — does the curated figure win, or is it floored?
    - What happens to **existing** applications and installment accounts raised at 10%? Nothing reads the floor retroactively, but it is worth confirming none should be re-checked.

    Related and **unresolved**: the same note said _"there's a set price, price should follow their own price in credit application"_. Ambiguous between "use a manually entered price, overriding the price list" and "follow the price list for the chosen Price Use rather than the fallback it uses now" — today `resolveItemPricing()` resolves through `resolvePosPrice()` for the chosen Price Use and falls back to `Item.sellingPrice` when no price list covers the item. Needs clarifying before either is built.

### Blocked / parked

13. **Cancel Sale is a free-text textarea.** 🚧 `pos/checkout/page.tsx:5206-5213` — _"Grounds for Cancellation \*"_, `rows={3}`, validated only for non-emptiness at `:3166`. Converting it to a dropdown is small; **Elijah owes the reason list**, and picking placeholder reasons now would just have to be re-migrated once the real ones arrive.

14. **Friends-and-family price override.** 🚧 Parked by the client in the same breath as raising it — _"Not yet included because the format is not finalized with client."_ Recorded here so it is not lost, not scoped.

15. **Reference number field.** ➖ _"Reference will be in the hard copy… The TPE version is just the essentials or the lite."_ Read as a decision **not** to add a Reference field to the TPE credit application. No work — logged so the next person does not add one thinking it was an oversight.

---

## Decisions needed before Part 1

Two of the six today-items need one answer each. Neither blocks the other four.

**A. Region 6 default — everywhere, or customer creation only?**
`PhilippineAddressPicker` is shared by three consumers. Defaulting inside the component hits all of them, including `CollectorAreaPicker`, where a pre-filled region may or may not be wanted. The alternative is a `defaultRegionCode` prop passed only by the customer form. Recommendation: **a prop with `'06'` as the default value**, so the behaviour is opt-out rather than invisible.

**B. "Spouse or Co-maker" — relabel, or a Relationship dropdown?**
Two readings: (i) the section header at `CoMakerFields.tsx:85` should read _"Spouse or Co-maker"_; (ii) the free-text Relationship field should become a select whose options include Spouse and Co-maker. (i) is a string. (ii) constrains existing free-text data and needs the full option list from the client. Recommendation: **ship (i) today**, raise (ii) with the client.

**C. "Approved but incomplete" — derived badge, or persisted status?**
A derived badge ships today with no migration and no new status value. A persisted marker (a new `CreditApplicationStatus` member, or an `isIncomplete` flag) is reportable and survives the document being deleted, but it is a migration and it touches every status switch in both repos. Recommendation: **derived today**; revisit if the client wants to _report_ on incomplete approvals.

---

## Conventions this scenario must follow

- **Role access hierarchy** — none of the six today-items adds or changes a permission. The credit-application surfaces already gate on the existing credit permissions; the checkout strings are inside already-gated views. Nothing here may narrow Business Owner access.
- **Branch data scoping** — not applicable to the six today-items (no new list/detail/action endpoint). It **is** applicable to gap 8's collector picker when that is built, and to gap 11's delivery capture.

---

## Closing the gaps — proposed parts

One part per item, smallest first, each independently verifiable and independently revertable. Parts 1, 2 and 4 need no answers; Part 3 needs decision A, Parts 5–6 need B and C.

### Part 1 — "New Credit Application Form" button label (gap 2)

One string in `pos/checkout/page.tsx:4252`. Frontend only.

### Part 2 — Remove the TPF approved-amount input (gap 3)

Delete the input at `:4606`, its state at `:573`, and its submit branch at `:2657-2659`. Frontend only; the column stays and stays null.

### Part 3 — Region 6 default (gap 1, decision A)

Seed `regionCode` in `PhilippineAddressPicker`, guarded so it never overrides the `initialBarangayCode` hydration path. Frontend only.

### Part 4 — Co-maker phone required (gap 4)

Zod required + drop `(optional)` at `CoMakerFields.tsx:207` and `:302`. Closes the empty-string-into-a-`NOT NULL`-column path at `NewCreditApplicationForm.tsx:232`. Frontend only.

### Part 5 — "Spouse or Co-maker" label (gap 5, decision B)

Relabel `CoMakerFields.tsx:85` under reading (i). Frontend only.

### Part 6 — "Approved — ID pending" indicator (gap 6, decision C)

Derive from the already-fetched documents list; render on `CreditApplicationDetail` and in `CreditApplicationList`. **Gates nothing** — the sale must still proceed, which is the client's explicit requirement. Frontend only.

### Deferred to a follow-up scenario

Gaps 7, 8, 9, 10, 11, 12 — every one needs a migration, and gaps 10 and 11 need a product decision first (address semantics; what "Deliver to" is — free text, a contact, or the customer). Gaps 13 and 14 are blocked on other people. **Sequencing note**: gaps 7 + 9 are one migration (addresses on co-maker and application), and gaps 11 → 12 are an ordered chain that must be built in that order.

---

## Manual testing

Accounts from `docs/seed-data-reference.md`. Parts 1–2 as any cashier; Parts 3–6 need credit-application access.

**Part 1** — POS → Checkout, add an item, set Payment Mode to Installment with a customer who has no approved application. The amber panel's button reads **New Credit Application Form**; clicking it still carries the cart and customer into the form.

**Part 2** — Checkout → Installment → Third Party Financing. Provider and _Financier's reference number_ remain; the approved-amount box is gone. Complete a TPF sale and confirm it posts.

**Part 3** — CRM → Customers → New. The Region dropdown shows **Region VI (Western Visayas)** already selected and Province is enabled immediately. Then open an **existing** customer with a saved address and confirm all four levels still resolve to that customer's real region — not Region VI.

**Part 4** — Credit Applications → New → pick an applicant → **Add a new co-maker**. Leave Phone blank and submit: blocked with a field error. Fill it and submit: saved. Reopen and confirm the number persisted.

**Part 5** — Same form: the co-maker section header reads **Spouse or Co-maker**.

**Part 6** — Raise an application with **no** `applicant_id` document and approve it as Business Owner. Detail and list both read **Approved — ID pending**. Then take that application through an installment checkout — it must still be selectable and the sale must complete. Upload an `applicant_id` document and confirm the badge drops back to plain **Approved**.

Prerequisite: the seed strips its own demo customers and agents, so an applicant may need creating first.

---

## Open questions

1. Decisions A, B, C above.
2. **Gap 10** — what does "current address should be synced" mean concretely? Direction, trigger, and behaviour when the two legitimately differ. Cannot be built from the note.
3. **Gap 11** — is "Deliver to" a free-text name, a contact on the customer, or the customer themselves? And is Delivery Address seeded from the customer's address or always typed fresh?
4. **Gap 13** — the cancellation reason list, from Elijah.
5. **Gap 16** — the friends-and-family discount format, from the client.
6. Should the delivery fee ever appear on the **printed receipt**, given it is deliberately excluded from the total? The notes say collection receipt only — worth confirming that means the printed sales receipt omits it entirely.

## Related ClickUp Tickets

None matched yet — to be identified before Phase 7.

---

## Implementation Log — 2026-09-24

**For this scenario, I have done:**

- **Part 1 (gap 2) — "New Credit Application Form" button label.** One string in `pos/checkout/page.tsx`. Manually confirmed by the developer.
- **Part 2 (gap 3) — removed the TPF approved-amount input.** Five references, not one: the input, its state, both reset handlers and the submit branch. `tpfApprovedAmount` stays in the DTO and the column and is simply never sent, so it is null on new TPF sales; a comment at the submit site says so, since a silently-absent field invites a later "fix". No backend change. Manually confirmed.
- **Part 3 (gap 1, decision A) — Region VI default.** `PH_DEFAULT_REGION_CODE = '06'` now lives in `libs/data/ph-address.ts` beside the dataset it comes from, and `PhilippineAddressPicker` takes a `defaultRegionCode` prop defaulting to it (developer decision: a prop, so the behaviour is opt-out and visible in the signature rather than buried in a `useState`). Seeded **only** when there is no `initialBarangayCode`, so editing an existing customer still resolves that customer's real region. Manually confirmed.
- **Part 4 (gap 4) — co-maker contact number required.** Added to the form `superRefine` and the `(optional)` markers dropped from both co-maker blocks. Manually confirmed.

**Also done this session, outside this scenario's own gap list** (developer-requested mid-run, on the same branch):

- **Four checkout dropdowns moved from native `<select>` to the shared `Select`**: TPF provider, card acquirer, approved credit application, and financing term. The credit-application picker is now also `disabled` when the list is empty rather than opening onto a single dead row — the amber note beneath already explains that case.
- **"POS Terminal" renamed to "Card Acquirer" at checkout.** Its options are BDO/BPI/Metrobank/Maya — the institutions that provide the terminal and settle the money, not the terminal. "Acquirer" rather than any bank-flavoured wording was chosen deliberately: **Maya is a non-bank acquirer**, so "Card Bank"/"Acquiring Bank" would have been wrong for a quarter of the list, and neither the issuing bank nor the card network is what is being picked. Renamed in the heading, the placeholder, the tender-section pointer note and one stale code comment.

**Worth flagging:**

- **A regression I introduced in Part 3 and caught before it shipped.** The picker's compose effect decides "has the user entered anything?" by counting non-empty parts. With the region pre-seeded that count was 1 rather than 0 on an untouched form, so creating a customer without ever opening Address would have silently saved `"Region VI (Western Visayas), Philippines"` as their address. Emptiness is now judged on street/barangay/city/province only, excluding the region — which is the right test even when the user picks a region by hand, since a region alone is not an address.
- **Part 4's bug was narrower than the plan doc claimed, and the fix is wider.** Validation existed **only** on the new-co-maker branch; the `*` markers on the existing co-maker's First/Last/Relationship enforced nothing. So the empty-string-into-a-`NOT NULL`-column path was specific to the new-co-maker branch (`(value ?? '').trim()`); the existing branch sends `value || undefined` and leaves a blank alone. The rule was added to both anyway — on the existing branch it surfaces co-makers saved before this rule with a blank number. Name/relationship were left unvalidated there, matching what that branch already did rather than quietly widening the change.
- **Six pre-existing broken specs were found and fixed to get any of this verified**, none of them caused by this work: two assertions in `pos-checkout-installment-credit-application.spec.ts` (one failing outright, one vacuous — a string matching nothing always has count 0); `New Application` asserted as role `button` when it is a `<Link>`, in two specs; and a search empty-state asserted as "No credit applications found", which neither of the list's two empty states says (the search case is "No applications match your filters").
- **The `Select` swap had a real blast radius in the specs.** The term dropdown alone was driven by five specs via `selectOption({ index: 1 })`. Converted using the suite's existing `openCustomSelect` helper. Note `{ index: 1 }` became `.first()`, not `.nth(1)` — index 0 on the native select was the placeholder `<option>`, which the shared `Select` has no equivalent of.
- **Verification is uneven, and honestly so.** Parts 3 and 4 have specs that were **run and pass** (`crm-add-customer` 2/2, `credit-application-ux` 4/4, including a new test proving a co-maker cannot be saved without a number). Parts 1 and 2 and every dropdown conversion are **type-checked and manually confirmed but not automatically verified**, because their specs all route through `addInstallmentLine`/`addAnyItemToCart`, which search for the demo item `Universal Remote Control`.
- **That demo item is deleted by the seed, by design — 25 specs depend on it.** `seed.ts:6149` creates it as `ACC-REMOTE-UNIV`; `cleanup-demo-business-data.ts` then deletes it, since `TN-ACC-REMOTE-UNIV` is in its `FICTIONAL_ITEM_SKUS`. Confirmed empirically: after a full clean seed this session, the POS catalog holds 1,399 items and zero matches for that name. **A reseed cannot fix these specs** — they only ever passed on a DB where someone had created the item by hand. The fix is either dropping the six `ACC-*`/`CLN-*`/`FAN-001` SKUs from that cleanup list, or making the specs create and stock their own item.
- **`credit-application-intake.spec.ts` still fails, and it is not a test bug.** It logs in as a cashier and POSTs to `/crm/customers`, which returns `403 Missing required permissions: crm:customers:create` (reproduced directly against the API). Worth attention given `development` recently merged "create customer and raise applications inside checkout" for cashiers — if a cashier cannot create a customer, that feature does not work for the role it was built for. No permissions were changed here.
- **"POS Terminal" still appears in Settings** — `PaymentMethodOptionsSection.tsx:113` and `BranchDetailClient.tsx:425`. An admin configures "POS Terminals" while the cashier now picks a "Card Acquirer". Left alone deliberately as out of scope; worth renaming for one vocabulary end to end.
- **Nothing is committed**, and the branch `feat/scenario-60-pos-client-feedback-batch` (frontend only) also carries one unrelated pre-existing modification to `e2e/pos-checkout-selling-agent.spec.ts` that predates it.
- **Gaps 5 and 6 remain open**, both awaiting decisions B and C, and both were in the confirmed "doable today" set — they were simply not part of the Parts 1–4 scope the developer approved. Gaps 7–14 are unchanged and still need migrations; 15 and 16 are still blocked on Elijah and the client.

---

## Implementation Log — 2026-09-28

Second run on this scenario, on the same branch as the first
(`feat/scenario-60-pos-client-feedback-batch`) so all six parts live together.

**For this scenario, I have done:**

- **Part 5 (gap 5) — Spouse-or-Co-maker picker.** Not the relabel the plan doc proposed. Asked about the wording and the answer reframed the requirement: _"the choices are either spouse or co-maker, but can we make it like, if its co-maker we have dropdown if its parent or etc."_ So it is **two questions, not one** — first the person's role, then, for a co-maker only, their relation to the applicant (Parent / Sibling / Child / Relative / Friend / Other). A spouse is asked nothing further, because the role already gives the relation. Decision A in the earlier log (a flat six-option list) was built first and then replaced.
- **Part 6 (gap 6) — "Approved — ID pending".** Amber panel on the detail view and amber pill in the queue when an approved application has no `applicant_id` document. Derived, never stored, so it clears itself when the ID is attached.

**Worth flagging:**

- **Part 6 was not frontend-only, contrary to this doc's own prediction.** The detail view needed no backend, as expected — but the queue did: `findAll()` builds from `detailInclude`, which carries no documents, and the list cannot fetch them per row without an N+1. So the backend now returns a `hasApplicantId` boolean, on its own branch `feat/scenario-60-credit-application-id-pending`. Still **no migration** — a service/DTO change only — but it makes this a two-repo part, and **the backend must land first** or the queue pill silently shows plain "Approved" for everything. `creditApplicationBadge()` checks `hasApplicantId === false` rather than falsy for exactly this reason: `undefined` means the caller doesn't know, and must not be read as "ID missing".
- **The role/relation pair is stored in one column** as `"Spouse"` or `"Co-maker — Parent"` (developer decision: keep the role rather than flatten to the relation, since a spouse co-signing is not the same instrument as a third-party guarantee). A real `role` column is the better shape and would be queryable; it needs a migration, so it was not done. Parsing is tolerant of legacy free text and of a plain hyphen, so existing or imported values round-trip.
- **Choosing "Co-maker" with no relation yet composes to `''` deliberately**, so the existing "Relationship is required" rule fires and the second dropdown cannot be skipped. No new validation was added.
- **Safe to constrain when it was done:** `co_makers` held zero rows, so no free-text value was orphaned. That will not be true again — a later change to this list needs a backfill question.
- **Part 5 only covers half its checklist line.** The client wrote _"make the number and address required"_. The number shipped in Part 4; the **address is still not done** and is gap 7, needing a migration (`CoMaker` has no address column).
- **Neither part is manually confirmed yet.** Both type-check clean with zero lint errors, and the backend field was verified live (`GET /credit/applications` returns `hasApplicantId`). The click-through was written up but not run — the picker was rebuilt as a cascade after the steps were handed over, so step 5 of those steps is now stale.
- **PR #190 was closed unmerged by another developer (chloebellee) on 2026-09-28, with no comment.** `origin/development` was untouched, so nothing landed. The branch and all commits survive. Unresolved at the time of writing — possibly an objection to that PR bundling 11 unrelated `main` commits alongside the scenario, which was a known risk when that shape was chosen.

**Still open on this scenario:** gaps 7-14 (all need migrations; 10 and 11 need a product decision first), 15 (blocked on Elijah's cancellation-reason list) and 16 (parked by the client).

---

## Implementation Log — 2026-09-28 (second entry)

Manual testing of Parts 5-6 turned up four defects. Two were regressions from
this scenario's own earlier parts; two were pre-existing and unrelated.

**Gap 6 was far larger than this doc predicted, and the prediction was based on a wrong reading of the code.**

It was scoped here as a display-only, no-migration, frontend-only change. It
was actually four changes across both repos, because the workflow blocked the
client's process at three separate points:

1. **The badge** — "Approved — ID pending" on the detail and the queue. Frontend.
2. **`hasApplicantId` on `findAll()`** — the queue carried no documents and could not fetch them per row without an N+1. Backend, no migration.
3. **Submit required at least one document** — enforced in the UI (disabled button) _and_ the backend (`credit-application.service.ts`). Removed in both on the client's explicit instruction: _"allow submission with none and the documents are to follow"_. An applicant whose only document is the ID could not otherwise submit at all, which is exactly the case the client described.
4. **Attaching was refused after a decision** — `credit-application-documents.service.ts` threw _"Documents can no longer be managed once a decision has been made"_. So the badge told the user to attach the ID and the API refused. Attaching now permits `approved`/`partially_approved`; **removal deliberately still does not**, since chasing a missing document is additive while deleting evidence from a decided (and possibly already-sold) application is a different question nobody asked for.

**Two regressions this scenario introduced, both found by manual testing, not by the type-checker:**

- **Part 4 broke the new-co-maker submit.** Adding the required-contact-number rule to the _existing_ co-maker branch was wrong because the payload changes shape between client and server validation: the submit handler resolves `coMakerId` to a real id before calling the server action, which re-validates with the same schema — so the schema takes its "existing co-maker" branch and demands `coMakerContactNumber`, a field this flow never populates. The co-maker was created, then the application failed. Fixed by carrying the number across into the payload. Symptom was exactly as reported: _"it says failed cause contact number is required BUT when I select co-maker again which is the new co-maker I added, it submits"_.
- **The "Approved — ID pending" copy told users to attach the ID "above"** when no upload control was rendered at that status. Fixed as item 4 above.

**Two pre-existing bugs fixed along the way, neither on the client checklist:**

- **Autofilled phone numbers were silently discarded** in all four forms that capture one (co-maker ×2, CRM customer, New Lead, Accounting customer). A browser autofill assigns `input.value` directly, which updates React's own value tracker, so the `input` event that follows looks like a no-op and `onChange` never fires — the number is on screen while the form holds `''`, and the next render wipes it back to "+63". Invisible until Part 4 made one of those fields required. Now one shared `components/ui/PhoneField`, which owns its display state and reads the DOM back on blur and shortly after mount. Three duplicate copies of `toDisplayPhoneValue` deleted.
- **A retried submit created duplicate co-makers.** The dedupe (from PR #179) reads `coMakers` out of a react-query cache that `addCoMaker` never invalidated, so a retry could not see what it had just created. One customer reached the hard cap of 5 identical co-makers during testing, at which point "Add a new co-maker" is withheld and the form becomes unusable for that applicant. Fixed by invalidating after add and after update.

**Worth flagging:**

- **A real product tension the client's instruction creates, raised and deliberately left as-is.** With no document required to submit, the Credit Investigator and Business Owner can be reviewing an application with nothing attached. The approval chain itself is unchanged and still enforced (`draft → submitted → under_investigation → pending_approval → decide`, with `decideItems()` refusing anything not `pending_approval`, and approval remaining Business-Owner-only). A middle option — require documents to **approve** but not to **submit** — was put to the developer and declined for now: the client gave a clear instruction and it is their process.
- **Method note.** Three wrong diagnoses preceded the real one on the co-maker bug, each from reasoning instead of instrumenting. What settled it was tagging the two validation branches with distinct messages and reading which fired. The lesson for this codebase: the same zod schema runs client-side and again inside the server action, on a payload the handler has already reshaped — so a form error can come from a shape the user never saw.
- **Not manually confirmed yet:** that checkout accepts an ID-pending application and completes the sale. That is the client's actual requirement for gap 6 and remains the one untested step.

---

## Clarifications received 2026-09-28 (second batch)

Four points from the client. **Two were already satisfied**, and saying so
matters more than logging them as work:

- **"Supporting documents in credit application to follow, make it optional"** and **"add approve but incomplete, meaning can proceed without attached documents"** — this is gap 6, and both shipped earlier the same day. Submitting no longer requires an attachment (removed in both repos), an approved application with no `applicant_id` is badged **"Approved — ID pending"** on the detail and in the queue, and documents can now be attached after approval so the ID really can follow. Nothing further to build.
- **"In credit application, add application number (auto-generated)"** — already built and has been for some time. `CreditApplicationService.generateApplicationNumber()` issues `CA-YYYYMMDD-NNNN`, sequential per tenant per day, unique on `(tenantId, applicationNumber)`, and it is already displayed on the queue and the detail page. If the client means it should appear somewhere it currently does not — on the intake form before submission, say, or on a printed form — that is a different and much smaller request, and worth confirming which they mean before building anything.

**The remaining point is the valuable one, because it resolves what gap 10 could not previously be built from:**

> _"add address to credit application (current address, current address is non-editable). So there's two, home address and current, current is the one used in credit application."_

This settles the question the original triage flagged as unanswerable. The earlier note — _"current address should be synced"_ — had no definable meaning; this replaces it with a concrete rule:

|                                        |                                               |
| -------------------------------------- | --------------------------------------------- |
| The customer carries **two** addresses | `home` and `current`                          |
| The credit application uses            | the **current** address                       |
| On the credit application it is        | **read-only** — displayed, never edited there |

So the credit application does **not** need its own address column after all, which is a meaningful simplification of gap 9: it reads the customer's current address rather than snapshotting one. That also explains the original note _"add the address since the customer profile is different"_ — the profile shows the home address, and the application needs the current one.

**What it still costs**, and it is not small:

- `Customer.address` is **one** column today. Scenario 24 Part 1 deliberately collapsed `billingAddress`/`shippingAddress` into it, on the grounds that _"nothing in this codebase ever legitimately needed them to differ"_. That judgement is now overtaken by the business: home and current genuinely differ, and the difference is what the credit decision rests on. Re-splitting is a migration plus a backfill (existing `address` becomes which of the two?) plus every read path.
- `Customer.barangayCode` has the same problem — it is the area key used for collector assignment, so it has to follow whichever address the collector actually visits. Almost certainly the current one, but that needs confirming rather than assuming.
- The CRM and Accounting customer forms, `PhilippineAddressPicker`'s single-value contract, and the POS walk-in create path all assume one address.

**Still open on this**, and worth asking in the same breath as anything else:

1. When only one address is known — a walk-in with no separate current address — does current default to home, or stay blank?
2. Which address does **collector assignment** use? (`barangayCode` today is singular.)
3. Read-only on the credit application is clear. Where **is** the current address edited — the CRM customer profile only, or also the POS customer form?
4. Does an existing customer's single `address` backfill into home, current, or both?

---

## Implementation Log — 2026-09-28 (third entry)

Items 18, 19 and 21, all from the client the same day, all shipped.

**For this scenario, I have done:**

- **Item 18 — the down-payment floor is 30%, not 10%.** A floor, not a fixed amount, applying to both the credit application at intake and in-house installment lines at checkout. Now driven by a named constant in each repo (`DOWN_PAYMENT_FLOOR_RATE`) rather than inlined.
- **Item 19 — the application number is labelled.** It has always been auto-generated (`CA-YYYYMMDD-NNNN`, sequential per tenant per day) and displayed; the client asked for one to be _added_ because on the detail page it was a bare unexplained heading and on the mobile card an unlabelled mono string. Both now say **"Application No."**. The desktop table already had an "Application #" column header and is unchanged — which is probably why this went unnoticed for so long.
- **Item 21 — applications are priced from the Inventory price list, "and only that."**

**Worth flagging:**

- **No credit application had ever been priced from a price list.** This is the significant finding of the three. `entry.unitPrice` won outright when supplied, and the intake form always supplied one, seeded from the flat `Item.sellingPrice`. So the price shown to the applicant came from the item record rather than the branch's agreed price list. Worse, that path also set `priceListItemId: null`, which is what the curated per-SKU down payment and the rate-card (`PriceListItemTerm`) instalment figures hang off — so that entire mechanism was inert on credit applications, silently falling back to a generic `factorRate` approximation. Fixed on both sides: the form no longer sends `unitPrice`, and the server ignores it if sent (the DTO field stays so existing callers do not 400).
- **Two further fallbacks removed** for the same reason: no Price Use chosen fell back to `resolveDefaultSellingPrice`, and an item on no active list under the chosen Price Use fell back to flat `Item.sellingPrice`. Both now return null, which surfaces as a rejection rather than a wrong price.
- **This will reject more items than before, and that is the point.** The catalog is ~1,399 items and only a handful sit on active price lists. An item nobody has priced under the chosen Price Use cannot be financed until somebody prices it; the error now says so and points at Inventory. **Worth checking price-list coverage on the items actually sold on credit before this reaches a counter** — it is the one part of this change likely to surprise someone.
- **The 10% was at 15 sites, not the 9 my first pass reported.** Three of them were user-facing copy — the "10% min" badge and two explanatory sentences — which is exactly how a screen ends up advertising one rule while the server enforces another. All copy now derives its percentage from the constant.
- **The two constants must stay in step.** `DOWN_PAYMENT_FLOOR_RATE` exists separately in each repo (`backend/src/common/constants/financing.constants.ts`, `frontend/src/libs/constants/financing.ts`). A drift between them shows up as a form accepting a value the till then rejects.

## Manual testing — items 18, 19, 21

Business Owner (`technova.owner@test.com`). A **priced** item is now required — `SHARP ESWP85` is ₱7,490 on the **WIP** price list; `CAMEL COF16` is ₱1,713.60 on WIP.

**Item 21 — price comes from the price list**

1. Credit Applications → New Application → pick an applicant.
2. Add **SHARP ESWP85** and set Price Use to **WIP**.
3. ✅ The requested amount should be **₱7,490** — the WIP price list figure, not the item's own selling price. If those two differ for an item, that difference is the whole test.
4. Change Price Use to a different type the item is also listed under and confirm the amount follows the list, not the item.
5. ✅ Pick an item that is on **no** active price list for the chosen Price Use → submitting is rejected with _"… is not on an active price list for the selected Price Use — price it in Inventory before it can be financed."_
6. ✅ Leave Price Use unset entirely → same rejection. An application can no longer be priced without one.

**Item 18 — 30% floor**

7. With ₱7,490 selected and a financing term chosen, enter a down payment of **₱1,500** (~20%) → ✅ rejected, _"Down payment must be at least 30% of the item total"_.
8. Enter **₱2,300** (~31%) → ✅ accepted.
9. ✅ At checkout, the down-payment badge on an installment line reads **"30% min"**, not "10% min", and the explanatory text underneath says 30% too. A mismatch between badge and rule is the specific failure this test exists to catch.
10. ✅ At the till, an installment line with a down payment below 30% is refused — the same floor, enforced separately from the application.

**Item 19 — application number**

11. ✅ Open any application: the header reads **APPLICATION NO.** above the number, rather than the bare code.
12. ✅ On a narrow window (phone width), the queue card shows _"Application No. CA-…"_ rather than an unlabelled string.

**Not yet confirmed by hand:** steps 9 and 10, the checkout half of item 18. Everything else above was verified against the running stack via the API during implementation.

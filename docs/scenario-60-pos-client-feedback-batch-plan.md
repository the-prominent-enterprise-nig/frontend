# Scenario 60 — POS Client Feedback Batch (Customer Creation, Credit Application, Delivery, TPF) — Gap Analysis & Closing Plan

**Source**: client feedback relayed 2026-09-24, covering four POS surfaces in one pass — customer creation, the credit application form, Cancel Sale, and a net-new Delivery capture at checkout, plus one TPF cleanup.

Unlike most scenarios in this series, this one is not a single feature. It is a batch of 17 separate client notes at wildly different sizes — three are one-line string edits, six need a migration, two are blocked on someone else, and one the client explicitly parked. The point of this doc is therefore to **separate what can ship today from what cannot**, and to say why for each.

---

## Verdict table

Verified against `development` on 2026-09-24 (both repos freshly pulled; frontend `cb7b48e8`, backend `f8dc9ee`).

| #   | Client note                                             | Verdict                       | Why                                                           |
| --- | ------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------- |
| 1   | Region 6 default on the first dropdown                  | ✅ **Today**                  | Frontend only — one `useState` seed                           |
| 2   | "Raise one for this cart" → New Credit Application Form | ✅ **Today**                  | One string                                                    |
| 3   | Remove "Approved amount (optional)" from TPF            | ✅ **Today**                  | Field is nullable end-to-end, nothing reads it                |
| 4   | Co-maker **number** required                            | ✅ **Today**                  | Frontend only — and it fixes a real drift (see gap 4)         |
| 5   | "Spouse or Co-maker" wording                            | ✅ **Today** (needs 1 answer) | Relabel is trivial; the ask is ambiguous                      |
| 6   | Approved-but-incomplete when ID is missing              | ✅ **Today** (needs 1 answer) | Derivable with no migration; a persisted flag is not          |
| 7   | Co-maker **address** required                           | ❌ Migration                  | `CoMaker` has no address column at all                        |
| 8   | Collector on the credit application                     | ❌ Migration                  | No FK exists; `Collector` does                                |
| 9   | Address on the New Credit Application                   | ❌ Migration                  | Applicant block is phone + email only                         |
| 10  | Home + current address, current synced                  | ❌ Migration + decision       | Reverses a deliberate Scenario 24 decision                    |
| 11  | Deliver to / Delivery Address / delivery fee            | ❌ Migration                  | Half the columns exist and are never written; two don't exist |
| 12  | Delivery fee excluded from the total                    | ➖ Already designed for       | Schema already keeps it out of `subtotal`/`totalAmount`       |
| 13  | Delivery fee GL mapping                                 | ❌ Depends on 11              | No migration needed, but nothing to post until 11 lands       |
| 14  | Separate CR for down payment and delivery fee           | ➖ Already built              | The report already emits it as its own CR line                |
| 15  | Cancel Sale → dropdown                                  | 🚧 **Blocked**                | Elijah owes the list of cancellation reasons                  |
| 16  | Friends-and-family price override                       | 🚧 **Parked by client**       | "format is not finalized with client"                         |
| 17  | Reference lives on the hard copy; TPE is lite           | ➖ No build                   | Informational — it is a decision _not_ to add a field         |

**Doable today: items 1, 2, 3, 4, 5, 6.** Two of those need a one-line answer first (5 and 6) — both are under _Decisions needed_ below, and both have a safe reading that ships today either way.

---

## What's already done ✅

More than the notes assume, in three places:

- **A cashier can already approve a credit application without an ID, and the sale can already proceed** (item 6). There is no document gate anywhere: `CreditApplicationDocument` exists with an `applicant_id` type (`prisma/schema.prisma:7035`), but `credit-application.service.ts` never checks for one before allowing `approve`, and `CreditApplicationDetail.tsx` never blocks the button on it. The _behaviour_ the client asked for is the behaviour we already have. What is missing is only that nothing **says** the record is incomplete.
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

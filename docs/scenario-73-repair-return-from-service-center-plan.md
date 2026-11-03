# Scenario 73 — Repair/Return: Unit Origin (Customer vs Service Center) & Service Center Master Data — Gap Analysis & Closing Plan

**Source**: client's annotated screenshot of the Create RR "Delivery details" panel (Reason = Repair/Return), plus the client's "Repair flow in NIG Central" write-up, relayed by the developer 2026-10-15. The annotations ask for:

1. A new field for the **Origin of the unit**: _From Customer_ or _From Service Center_.
2. From Customer → keep the current form. From Service Center → **replace Repair Type with a Service Center picker** ("must have master data for all the Service Centers").
3. With a service center picked, the units list shows **only units delivered to that service center** (e.g. Sharp Service Center → only units delivered to Sharp; never units at other service centers or locations).

The write-up adds one more line that lands on the same form: **Home Service** — "upon receipt, the Service Center is already determined. Add a field for Service Center so we can identify what the service center is, for better monitoring."

**Status**: gap analysis only. Nothing built.

## Related ClickUp Tickets

None. Searched "service center" and "repair provider" on 2026-10-15; no TPE ticket covers this scenario.

## Related docs

- [scenario-55-standalone-rr-repair-repossession-plan.md](./scenario-55-standalone-rr-repair-repossession-plan.md) — added the RR `reason` (repair_return / repossession / other) and wired UDS `receiveFromProvider()` through `receiveStock()`.
- [scenario-50-inventory-uat-batch-plan.md](./scenario-50-inventory-uat-batch-plan.md) — "Repair Journey for Customer" (branch → head office → service center) and the UDS intake fields.
- [scenario-18-returns-exchanges-disposition-plan.md](./scenario-18-returns-exchanges-disposition-plan.md) — POS return with `disposition: repair` raising a UDS.

---

## The scenario we're building toward

The client's repair flow, step by step, with where each step lives today:

| #   | Client step                                                                              | Lives today in                                                                                 | State                                   |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | Receive units from customer                                                              | Create RR, Reason = Repair/Return, invoice search → tick units (auto-raises a UDS per unit)    | ✅ client: "DONE and OK"                |
| 2a  | In-Store: stock transfer branch → Main Office (from General Stock Book or Stock Balance) | Serial Numbers list tick-to-transfer (`SerialNumberList.tsx`), Stock Balance → Transfers       | ✅ exists, not re-verified in this pass |
| 2b  | Main Office → Service Center, custodian encodes a Delivery Receipt                       | UDS → Assess (repairable, pick Repair Provider) → Dispatch to Provider (DR #)                  | ⚠️ works, but provider = any Supplier   |
| 2c  | Service Center → Main Office, **in our Receiving Report form**                           | Only UDS → "Receive from Provider". The RR form has no service-center path — **this scenario** | ❌                                      |
| 2d  | Stock transfer Main Office → branch                                                      | Same as 2a                                                                                     | ✅                                      |
| 2e  | Branch DRs the unit back to the customer                                                 | UDS → Release to Customer (DR #)                                                               | ✅                                      |
| 3a  | Home Service: service center known at receipt — record it                                | Nothing. Repair Type = Home Service captures no service center                                 | ❌ **this scenario**                    |
| 3b  | Repaired or unrepaired, custodian DRs the unit back                                      | UDS → Release to Customer                                                                      | ✅ (assessment gate to verify, see Q5)  |

End state for this scenario:

1. A custodian at Main Office opens Create RR, picks **Repair/Return**, then **Origin: From Service Center**, then **Sharp Service Center**. The units panel lists only units currently out at Sharp (serial, model, brand, the customer it belongs to, the UDS code and the DR it went out on). They tick the units that came back and post. Each unit's UDS moves from _At provider_ to _Repaired_ with this RR as its return document, and the unit is back in Main Office stock ready for 2d.
2. A branch receives a Home Service unit: **Origin: From Customer**, **Repair Type: Home Service**, and a now-visible **Service Center** field (required). The service center is stored on the unit's UDS so monitoring can report "units at / handled by each service center".
3. An admin maintains the list of service centers in one place (code, name, brand served, address, contact), separate from ordinary suppliers.

---

## What's already done ✅

1. **Reason = Repair/Return on Create RR** — `REASON_OPTIONS` and the Repair Type picker (In-Store / Home Service) in [RrDeliveryPanel.tsx](<../src/app/(app)/(dashboard)/inventory/goods-receiving/_components/create-rr/RrDeliveryPanel.tsx>). Repair/Return hides Source, Location and Reference #; destination is the receiver's own branch.
2. **Units panel** — [ReturnedUnitsPanel.tsx](<../src/app/(app)/(dashboard)/inventory/goods-receiving/_components/create-rr/ReturnedUnitsPanel.tsx>): blocks of _invoice → customer → checkbox per unit_, "Add another invoice", per-unit cost. Built entirely around a customer's invoice (`InstallmentAccountSearchCombobox`).
3. **Backend `RepairType` on `GoodsReceipt`** — `backend/prisma/schema.prisma:7171` (enum) and `:7549` (field). `receiveStock()` rejects `repairType` without `reason: repair_return` (`backend/src/inventory/services/stock.service.ts:1080`).
4. **Auto-UDS on intake** — `receiveStock()` creates a UDS per repair_return unit, **skipping any unit already on an open UDS** ("the repair provider returning it") (`stock.service.ts:1759-1800`).
5. **Repair provider = `Supplier` FK on the UDS** — `UnitDocumentSheet.repairProviderId` (`schema.prisma:9474`), set at Assess or via `PATCH /uds/:id/repair-provider` (`backend/src/inventory/services/uds.service.ts:1198`).
6. **"Delivered to that service center" is already recorded per serial.** `dispatchToProvider()` sets `SerialNumber.consignedToSupplierId = uds.repairProviderId` and the UDS goes to `at_provider` with `dispatchDeliveryReceiptNumber` (`uds.service.ts:919-960`). That is exactly the filter the client asks for.
7. **The UDS provider-return leg exists** — `receiveFromProvider()` posts a real repair_return RR through `receiveStock()`, records `actualCost`, posts the variance JE (REPAIR_EXPENSE / REPAIR_PROVIDER_PAYABLE), and moves the UDS to `repaired` (`uds.service.ts:973-1100`).

---

## What's not done / gaps ❌⚠️

1. **No Origin field.** The RR form assumes every repair/return comes from a customer's invoice.
2. **No service-center master data.** A repair provider is any `Supplier`; `VendorType` (`schema.prisma:649`) has no service-center value, and the Assess modal's "Repair Provider" picker lists every supplier (`AssessUdsModal.tsx:191-215`). Sharp Service Center and a cement supplier look the same.
3. **No service-center unit list.** Nothing queries "serials out at provider X". The units panel can only load units from an invoice.
4. **Receiving a provider return through the RR form leaves the UDS stuck.** If a custodian does pick the customer's invoice and tick the unit today, `receiveStock()` clears `consignedToSupplierId` (`stock.service.ts:1728`) and skips UDS creation because one is open — but **never moves that UDS out of `at_provider`**, never records the return RR on it, and never posts the actual-vs-estimate variance. The unit is back in stock while its UDS says it is still at the provider. The only correct path today is the UDS screen, which the client does not use for this step.
5. **Home Service captures no service center.** Repair Type = Home Service records nothing about who services it, so there is no monitoring per service center.
6. **⚠️ The filter only works for units that went out through UDS Dispatch.** Units that left Main Office some other way (a plain stock transfer, paper DR, pre-system) have no `consignedToSupplierId` and will not appear. See Q3.

---

## Decisions needed

| #   | Question                                                                                                                                                      | Recommendation                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Service center master data: a new `VendorType.SERVICE_CENTER` on `Supplier`, or a new `ServiceCenter` model?                                                  | **`VendorType.SERVICE_CENTER` on `Supplier`.** `repairProviderId`, `consignedToSupplierId` and REPAIR_PROVIDER_PAYABLE / AP bills all already key on `Supplier`; a new model would mean migrating three FKs and the AP path. Add a filtered "Service Centers" view in Inventory → Master Data (or a tab under Suppliers) and a `brand` field if wanted. |
| Q2  | When origin = Service Center, does the RR form close the UDS leg the way `receiveFromProvider()` does — including the **actual repair cost** and variance JE? | **Yes, route through the same logic** so there is one way to close the leg. Ask the client whether the custodian knows the actual cost at receipt; if not, default it to the estimate (no variance JE) and let accounting adjust later.                                                                                                                 |
| Q3  | Units that went to the service center outside UDS Dispatch — show them, or not?                                                                               | **Not, to start.** The filter is `consignedToSupplierId = X AND open UDS at_provider`. Show an empty state that says "only units dispatched through UDS appear here". Revisit if the client's custodians DR units another way (see Q6).                                                                                                                 |
| Q4  | Home Service: does the service center go on the `GoodsReceipt`, the UDS, or both?                                                                             | **On the UDS (`repairProviderId`)**, set at intake from the RR. That is where monitoring and dispatch already read it. Optionally mirror on `GoodsReceipt` (new nullable `serviceCenterId`) for the RR printout.                                                                                                                                        |
| Q5  | Home Service skips Main Office assessment ("service center already determined"). Can Release to Customer run without Assess today?                            | Verify in Part 1. If `releaseToCustomer()` requires an assessed/repaired UDS, Home Service needs a shortcut (e.g. provider set at intake counts as assessed-repairable).                                                                                                                                                                                |
| Q6  | Step 2b, "custodian encodes via Delivery Receipt" — is that the UDS Dispatch to Provider screen, or some other DR the client uses?                            | **Confirm with the client.** If it is a different screen, it must also set `consignedToSupplierId`, or the Service Center filter will miss those units.                                                                                                                                                                                                 |
| Q7  | Origin = Service Center: still show Repair Type?                                                                                                              | **No** — the client says "replace the Repair Type with Service Center". In-Store/Home Service is already on the unit's UDS from intake.                                                                                                                                                                                                                 |

---

## Closing the gaps — proposed parts

### Part 1 — Service center master data (backend + frontend)

- Migration: add `SERVICE_CENTER` to `VendorType`. Optional `brand` (free text) on `Supplier` if the client wants "Sharp" vs "Samsung" grouping.
- `GET /suppliers?type=SERVICE_CENTER` (check whether the existing list endpoint already filters on `type`).
- Frontend: a "Service Centers" list/create/edit, reusing the supplier form with `type` fixed. Seed 2–3 rows (e.g. Sharp Service Center).
- Restrict the UDS Assess "Repair Provider" picker to `SERVICE_CENTER` suppliers.
- Verify Q5 (Release to Customer without Assess).

### Part 2 — Units out at a service center (backend)

- New endpoint, e.g. `GET /inventory/uds/at-provider?repairProviderId=…`: open UDS lines with `status = at_provider` and `repairProviderId = X`, scoped to the actor's branch/warehouse. Returns serial, item (model/brand), customer, UDS code, `dispatchDeliveryReceiptNumber`, `dispatchedAt`, `repairEstimatedCost`.
- e2e: units at Sharp appear; units at another provider, already returned, or never dispatched do not.

### Part 3 — Receive from Service Center through `receiveStock()` (backend)

- `ReceiveStockDto`: new `origin: 'customer' | 'service_center'` (default customer) and `serviceCenterId` (required when origin = service_center; must be a `SERVICE_CENTER` supplier). `repairType` not allowed with origin = service_center.
- Every ticked serial must be on an open UDS `at_provider` with that `repairProviderId`, else 400.
- For each affected UDS, run the `receiveFromProvider()` close-out (status `repaired`, `returnReceivingReportNumber = receipt.code`, `returnedAt/ById`, `repairActualCost`, variance JE) inside the same transaction. Extract the post-receipt half of `receiveFromProvider()` into a shared `closeProviderLegTx()` so both paths stay identical.
- Fixes gap 4 at the same time: a customer-origin RR that ticks a serial already `at_provider` should be rejected with "this unit is at <provider> — receive it as From Service Center".
- e2e: ledger row, UDS status, variance JE, the rejection above.

### Part 4 — Create RR form: Origin + Service Center (frontend)

- `RrDeliveryPanel`: when Reason = Repair/Return, a required **Origin** select (From Customer / From Service Center) above Repair Type.
  - From Customer: current form, unchanged (Repair Type, invoice blocks).
  - From Service Center: **Service Center** `SearchableSelect` (SERVICE_CENTER suppliers) in place of Repair Type.
- New `ServiceCenterUnitsPanel` (or a `mode` on `ReturnedUnitsPanel` if the reuse holds at 80%+): no invoice/customer search, no "Add another invoice"; a checkbox list from Part 2 showing Serial – Model – Brand, the customer, UDS code and the outbound DR #. Changing the service center clears ticked units.
- Actual cost per unit (prefilled with the estimate), per Q2.
- Zod: `origin` required with repair_return; `serviceCenterId` required with service_center; `repairType` required only with customer.
- Empty state per Q3.

### Part 5 — Home Service: capture the service center (backend + frontend)

- Origin = From Customer + Repair Type = Home Service shows a required **Service Center** picker.
- `receiveStock()` passes it to `createFromReturnTx()` → UDS `repairProviderId`; optionally stores it on `GoodsReceipt` too (Q4).
- UDS list/detail: show and filter by service center, so "monitoring" has a view.

### Part 6 — Tests

- Backend e2e for Parts 2, 3, 5; Playwright for the Part 4 form (origin switch, filtered list, post, UDS shows Repaired).

---

## Out of scope

- Steps 2a / 2d (stock transfers from General Stock Book and Stock Balance) and 2e (release to customer) — exist; only re-verified if a part touches them.
- A standalone outbound "Delivery Receipt" screen, unless Q6 says the client uses one.
- Repair billing to the customer (separate AR invoice, already noted in `releaseToCustomer()`).

## Worth flagging

- Gap 4 is a live data-integrity issue today, independent of the new UI: any repaired unit received back through Create RR by invoice leaves its UDS stuck at `at_provider`. Part 3 fixes it; worth calling out to QA now.
- Restricting the Assess picker to SERVICE_CENTER (Part 1) will hide existing providers until they are re-typed. Include a one-off data step: re-type every supplier already used as a `repairProviderId`.

---

## Implementation Log — 2026-10-15

Built on `feat/scenario-73-service-center` in both repos, branched off `feat/scenario-72-delivery-receipt` (Scenario 72's "For repair to service center" DR turned out to be the client's step 2b, which answered Q6). Backend commits `acc78e2` (Parts 2–3) and `c7f0abc` (Part 5 and the journey fixes); frontend `f63e74f1` (supplier onboarding gate) and `f4689472` (Scenario 73). The final fixes (Home Service center required by the API, two stale tests) and these docs are uncommitted. Not pushed.

**For this scenario, I have done:**

- **Part 1 — service center master data (Q1, reversed).** First built as a `SERVICE_CENTER` `VendorType` with a brand and its own Master Data tab, then reverted at the developer's call: a service center _is_ the supplier picked as the UDS Repair Provider, so the Suppliers list is the master data. The migration was undone in both local DBs. Kept, at the developer's request: the supplier onboarding gate is gone from Suppliers (no Pending card, review chip, Needs attention filter or Onboarding status field); the backend never enforced it.
- **Part 2 — units out at a service center (gap 3).** `GET /inventory/uds/at-provider/providers`, `GET /inventory/uds/at-provider?repairProviderId=`, and `GET /inventory/uds/at-provider/serial-search` (Q3: the fallback for units that went out on a paper DR or before the system).
- **Part 3 — receive from a service center through `receiveStock()` (gaps 1, 4; Q2, Q7).** `origin: service_center` + `serviceCenterId` + per-unit `repairCosts`; each ticket closes through the shared `UdsService.closeProviderLegTx()` (status repaired, return RR, actual cost, variance JE). The UDS screen's Receive from Provider now takes the same path. The service center is the RR's supplier; line cost is zeroed. Gap 4 fixed: a From Customer RR refuses a unit still at a provider.
- **Part 4 — Create RR form (gaps 1, 3).** Origin (From Customer / From Service Center); Service Center replaces Repair Type and lists every supplier, those with units out first with their count; a units panel with actual cost (prefilled with the estimate), the empty state and search by serial; Location shown and editable for From Service Center; backend refusals shown as sentences.
- **Part 5 — Home Service (gap 5; Q4, Q5).** Home Service requires a Service Center (form and API), stored on the RR (supplier) and the UDS (`repairProviderId`, new `UnitDocumentSheet.repairType`, migration `20261016090000_uds_repair_type`). A Home Service ticket goes straight to a DR to the customer, repaired or unrepaired. The UDS list shows "· Home Service" and filters by service center.
- **The client's whole repair flow, end to end** (`backend/test/scenario-73-repair-journey.e2e-spec.ts`). Running it found gaps against steps 2a–2e, fixed by developer decision: a customer's unit in for repair may ride a stock transfer (as a repair unit, carrying its ticket to main and home again), reversing Scenario 72's "not our stock" refusal; Main Office (the main branch) sees and acts on every branch's repair tickets; a customer's unit back from repair stays `in_repair`, never sellable; a repair DR is issued from where the unit is.

**Worth flagging:**

- **Decisions made:** Q1 reversed to plain suppliers; Q2 editable actual cost prefilled with the estimate; Q3 a serial-search fallback; Q4 service center on UDS and RR (the RR's supplier, no new column); Q5 Home Service releases straight from intake; Q6 answered by Scenario 72's DR; Q7 Repair Type hidden for From Service Center. UDS Repair Provider pickers left unrestricted.
- **Scenario 72 behaviour changed:** customer units on stock transfers, Main Office scoping on UDS / repair DRs, repair DR warehouse from the unit's location, Receive from Provider no longer overwrites UDS notes with receipt notes.
- **Owner account:** with no branch, an owner's Repair/Return intake lands in the first standalone warehouse (Negros in dev); Location is hidden for customer intakes by Scenario 55's design.
- **Tests:** backend `scenario-73-service-center-units` 10/10, `scenario-73-service-center-receipt` 17/17, `scenario-73-repair-journey` 1/1, `stock-transfer-in-repair` 10/10, `delivery-receipt-repair` 10/10, `delivery-receipts` 47/47, `inventory-branch-scoping` 23/23, `inventory-receiving-branch-serial-gl` 33/33, `scenario-55-uds-repair-return` 1/1; frontend `scenario-73-rr-from-service-center` and `supplier-no-onboarding-gate` green. Three older tests updated to the new rules; one stale installment-account test corrected.
- **Not green, pre-existing (they fail on base `3f6b122` too):** 4 `inventory-receiving-enhancements` tests (VAT/withholding JE shapes, receipt detail scope); `repair-transfer` needs a test-DB reseed (its fixture serials are used up).
- **Dev DB test data:** item "E2E-BASE aircon" made serial-tracked (model `TEST-S73`) and serial `TEST-S73-AC-0001` sold to Dela Cruz, Alice May M on account `5A2969F1`, for manual testing.
- **Deploy:** one migration (`20261016090000_uds_repair_type`), backend and frontend together.

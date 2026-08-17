# Module Scenarios — How Each Module Works in a Real Day

Source: `NIG-TPE-Module-Scenarios.pdf`, NIG × TPE, companion to the workflow diagrams, July 2026. This walks each module through a concrete, day-in-the-life scenario — who does what, what they enter, and what the system does. Each scenario shows the trigger, the steps, and the result.

Each scenario has its own gap-analysis-and-closing-plan doc: `scenario-NN-<slug>-plan.md` in this same folder.

---

## 1. POS — a customer walks in and buys

_Closed — see scenario-checklist.md for status (plan doc removed 2026-08-14)._

Scenario: A walk-in customer buys a phone on installment at the Ajuy branch.

1. **Find or create the customer** — the cashier searches the customer in CRM by name or contact. If new, they create the profile first (name, contact, email, address incl. barangay, customer type) — a customer can exist without buying.
2. **Start the sale** — the cashier opens a POS sale, pulls the customer from CRM (no re-typing), and tags the selling agent on the sale.
3. **Add the item by serial** — each physical unit is one line with its own serial; the sale is blocked if there is no serial or it does not match branch stock (no serial, no invoice). A split-type aircon captures both indoor + outdoor serials; a furniture set uses one serial across its part-SKUs.
4. **Price, discount, VAT** — the system shows the price used, applies any PROMO/discount net, and computes 12% VAT (inclusive) on the receipt.
5. **Choose Cash or Credit** — for an installment, the price checker shows the term options and the monthly installment (MI = amount financed × factor); the down payment and MI are kept separate.
6. **Take payment** — the cashier records the tender — cash, GCash, card or bank — and can split one sale across several tenders, each mapped to its GL account.
7. **Release document** — a cash sale generates a digital RFD (Request for Delivery); a credit sale generates an Application Form + RFD; branch-manager approval where required.
8. **Post automatically** — on save the system deducts inventory by serial, posts the journal (sale, VAT, COGS, payment) and, for a charge sale, opens the customer's AR ledger and installment schedule.
9. **Credit the agent & quota** — the sale is attributed to the selling agent (commission by scheme) and counts toward the branch quota.
10. **End of day** — at close the cashier moves collections Undeposited to Cash in Transit (drawer ends at ₱0.00); next day accounting clears CIT and the deposit lands in the bank.

**Result**: one sale captured once — serial-tracked inventory, automatic journals, the customer's AR set up, the agent credited, and cash reconciled to zero.

---

## 2. CRM — documenting a customer before the sale

_See [scenario-02-crm-customer-profile-plan.md](./scenario-02-crm-customer-profile-plan.md)_

Scenario: A new customer is entered before they decide to buy.

1. **Capture the profile** — the CRM user creates the customer: name, email, barangay (city/province), customer type (Individual / B2B Private / B2B Government), family/group ID and status — no purchase required.
2. **Loyalty & engagement** — loyalty points are enrolled and Smart SMS is available for updates.
3. **Make a purchase?** — if they buy, the sale pulls this profile at POS; if not, the profile stays for marketing retargeting.
4. **On a sale** — Cash generates a Digital RFD, Credit generates an Application Form + RFD, with data carried from the profile.
5. **Terms** — installment terms run up to 12 months; there is no hard credit limit (credit is per-unit / terms-based).

**Result**: a clean customer master (~200K records) that feeds POS, AR and marketing.

---

## 3. Reservation / advance sale — item not in stock yet

_Closed — see scenario-checklist.md for status (plan doc removed 2026-08-14)._

Scenario: A customer wants furniture the branch does not have on hand.

1. **Reserve by SKU** — the cashier reserves the item by model/SKU (no serial yet).
2. **Payment is optional** — the customer may pay nothing, a deposit, partial or full; split & multi-tender allowed. Any payment is held as a customer advance in AR.
3. **Hold against incoming stock** — the reservation flags a backorder; an arriving serial is earmarked to it.
4. **Fulfil on arrival** — when a serial arrives it is assigned; collect any balance, issue the invoice, deduct inventory and recognise revenue.
5. **Cancel** — if cancelled, the reservation closes and any deposit is refunded.

**Result**: the branch can sell items it does not have yet, with flexible payment, and convert cleanly when stock lands.

---

## 4. POS serial availability — the item is in another branch

_Closed — see scenario-checklist.md for status (plan doc removed 2026-08-14)._

Scenario: The model the customer wants is out at this branch.

1. **Search at POS** — the cashier searches the item; POS lists every serial company-wide and highlights the ones in this branch.
2. **See other branches** — for serials elsewhere, POS shows which branch holds each one.
3. **One-tap request** — the cashier raises a stock request from another branch straight from POS, without leaving the sale.
4. **Feeds the transfer** — the request flows into the inter-branch transfer.

**Result**: the customer is served even when local stock is out.

---

## 5. Receiving — a delivery arrives at a warehouse

_See [scenario-05-receiving-plan.md](./scenario-05-receiving-plan.md)_

Scenario: A supplier delivery arrives. **Updated 2026-08-14 (Scenario 27 — Warehouse Tier Correction)**: a delivery can no longer be received directly into a branch's own stock — it must land at one of the 2 real warehouses (PANAY or NEGROS); the system rejects any receipt targeting a branch-local shadow warehouse. Getting the stock onward to a branch is a separate step, via a warehouse-leg Stock Transfer (see Scenario 6).

1. **Encode the RR** — whoever handles receiving at the warehouse encodes the Receiving Report on the tablet for the delivery (with or without a PO): reference, date, PO # & date, origin, mode, destination warehouse, Cost.
2. **Withholding** — flag the 1% supplier withholding where applicable.
3. **Link to the PO** — the RR links to the PO to monitor delivered versus lacking.
4. **Post** — saving updates the warehouse's stock (by serial / SKU) and auto-updates the account ledger.
5. **Onward to the branch** — the branch that needs the stock raises (or receives) a warehouse-leg transfer, which skips the usual Manager/HQ approval step and picks specific serials at dispatch.

**Result**: every delivery is recorded on the tablet, tied to the PO, posted to inventory and the books at the receiving warehouse, then moved on to the requesting branch via transfer.

---

## 6. Stock request & inter-branch transfer — a branch needs stock

_Closed — see scenario-checklist.md for status (plan doc removed 2026-08-14)._

Scenario: A branch is out of a model a customer wants.

1. **Check availability** — the branch opens the Stock Request module, picks a warehouse, and sees Available / Reserved / Remaining (no serial needed).
2. **Raise the request** — the branch raises a request (Brand / Model / Serial), often straight from the POS serial view.
3. **Approval (configurable)** — if the head-office-approval setting is on, it routes for approval first; if off, it goes straight to the source branch.
4. **Accept or reject** — the source branch accepts or rejects; on accept it transfers and issues the RR (serial on the RR). Expect a 1–2 day wait.

**Result**: stock moves between branches with control and a clear trail.

---

## 7. Repair transfer — a unit needs repair

_Closed — see scenario-checklist.md for status (plan doc removed 2026-08-14)._

Scenario: A sold or stock unit is found defective and needs service.

1. **Raise a Repair Transfer** — the branch creates a Repair Transfer; the RFS form is attached as the supporting document.
2. **Transfer to main** — the unit moves to the main branch for assessment (auto-paired stock transfer); main issues the RR (no approval).
3. **Assess & decide** — repairable units go DR to the repair provider; unrepairable units need a manual decision (no auto-junk), then a write-off.

**Result**: repairs are tracked with their own document and disposal is controlled.

---

## 8. Caravan — a caravan sale at a host branch

_Closed — see scenario-checklist.md for status (plan doc removed 2026-08-14)._

Scenario: The company runs a caravan event at a host branch.

1. **Set up consignment** — head office sends stock to the host as consignment: location moves to the host, ownership and serial stay with the origin; units sit in a "Caravan @ host" tab.
2. **Sell at the host** — the host rings, collects and receipts as normal; the serial is captured at sale.
3. **Attribution** — quota credit and inventory deduction follow the serial to the origin branch, while cash / Cash-in-Transit sit with the host (payments consolidated there), serial tagged for accounting.
4. **Onward or return** — unsold units return to the origin (or move to another branch) at the close of the event.

**Result**: caravan sales run cleanly — quota to the origin, cash to the host.

---

## 9. Aircool — aircon sale plus installation

_Closed — see scenario-checklist.md for status (plan doc removed 2026-08-14)._

Scenario: A customer buys a split-type aircon and needs it installed.

1. **Sell aircon + service** — on one POS sale: the aircon (split-type captures indoor + outdoor serials, sold together) plus an installation service SKU.
2. **Open a service draft** — POS opens a reopenable service draft estimating the materials for the install.
3. **Source the materials** — pull from the warehouse; if short, raise a PR to PO to an area supplier (estimates carried on the PO).
4. **Install** — the technician installs and records actual versus estimate.
5. **Return & bill** — unused materials return to inventory; finalise and bill the aircon + service + materials, then close the draft.

**Result**: the aircon sale, installation and materials are handled end-to-end in POS.

---

## 10. Purchasing & accounts payable — restocking from a supplier

_See [scenario-10-purchasing-ap-plan.md](./scenario-10-purchasing-ap-plan.md)_

Scenario: Head office replenishes stock from a supplier.

1. **PR to PO** — a purchase request is approved and converted to a PO (quota enforced; supplier maintained in Inventory).
2. **Receive & match** — goods arrive and an RR is raised (partial deliveries are all RRs against one main invoice); 3-way match PO ↔ RR ↔ Invoice.
3. **Create the voucher** — on the invoice a voucher is created (manual #, supplier auto-fills the payee, attachments); online and onsite approval.
4. **Pay** — payment prints the cheque and applies 1% withholding; supplier returns are handled as write-offs / debit memos.

**Result**: purchases are controlled from request to paid, matched and withheld correctly.

---

## 11. Collections & AR aging — the collector's day

_See [scenario-11-collections-ar-aging-plan.md](./scenario-11-collections-ar-aging-plan.md)_

Scenario: A collector works their accounts and a customer pays an installment.

1. **See what to bill** — the collector opens their aging view (by branch → collector → category): each customer's MI due this month plus arrears and penalty.
2. **Collect** — the customer pays; the collector issues an OR (stub) and later remits to the cashier, who enters the collection report.
3. **Post to AR** — the payment posts to the customer's AR ledger and the outstanding balance draws down.
4. **Age & score** — the account re-ages by the three clocks (months past due, months since invoice, months since last payment) into current / 30 / 60 / 90; classified A / B / C and flagged Pink / Green / Red.
5. **Early payoff** — if the customer settles early, the system quotes the pro-rated early closure.

**Result**: collectors know exactly what to bill, payments post to AR, and account health is tracked.

---

## 12. End-of-day cash & Cash in Transit — closing the branch

_Closed — see scenario-checklist.md for status (plan doc removed 2026-08-14)._

Scenario: A branch closes for the day and accounting reconciles it.

1. **Cashier close** — the cashier moves the day's Undeposited collections to Cash in Transit (Dr Cash in Transit / Cr Undeposited), by tender; the drawer ends at ₱0.00.
2. **Deposit** — the branch deposits to the bank.
3. **Next-day clearing** — accounting confirms the bank and clears Cash in Transit to ₱0.00 (Dr Cash in Bank / Cr Cash in Transit).
4. **Monitor** — the CIT monitor shows every branch's transit balance; any branch not at ₱0.00 — e.g. a GCash settlement or a Negros batch-upload deposit pending — is flagged and chased.

**Result**: every branch's cash reconciles to zero daily, fully traceable.

---

## 13. Credit & debit memos — a return or adjustment

_Closed — see scenario-checklist.md for status (plan doc removed 2026-08-14)._

Scenario: A customer returns an item, or a bill needs adjusting.

1. **Credit Memo** — the accountant raises a Credit Memo (type: Customer Credit; reason: Sales Return) with line items and serials; Gross Credit − Deductions = Total Credit.
2. **Auto-post** — on posting, the memo type drives the journal entry and updates the customer's subsidiary ledger; a replacement or extra charge uses a Debit Memo instead.
3. **Stock & supplier** — the returned unit is restocked or flagged for repair; supplier returns update AP + Inventory.

**Result**: returns and adjustments are documented, approved and posted correctly.

---

## 14. Accounting — the daily and month-end run

_Closed — see scenario-checklist.md for status (plan doc removed 2026-08-14)._

Scenario: The accountant keeps the books current and closes the month.

1. **Auto journals** — POS sales auto-post (sale, VAT, COGS, payment) to the chart of accounts (Balance Sheet 1-3, P&L 4-6).
2. **Tax** — Output and Input VAT and the 1% withholding post to their GL accounts; tax codes are approver-controlled; BIR filing stays manual.
3. **Bank reconciliation** — at month end the accountant enters the statement balance and reconciles to zero; discrepancies are explained or carried to a later period.
4. **Reports** — per-branch P&L, AR aging, gross (internal) vs net (reports), and cost centres.

**Result**: the books stay current with minimal manual entry, and month-end reconciles.

---

## Draft 2 additions — `NIG_ERP_Core_Operational_Scenarios_Draft_2_20260727.pdf`

A second, independently-sourced client scenario map (27 July 2026, 18 rows, chronological process view) was cross-checked against the 14 scenarios above and the current codebase on 2026-07-31. Most rows matched an existing scenario 1:1; a handful described real capabilities nothing above tracks, so they got new scenario docs (numbered 15-21, continuing this same series). Full per-row evidence lives in each doc's own "What's already done"/"What's not done" sections — this is just the routing table.

| Draft 2 row                                                         | Routed to                                                                                            | Outcome                                                                                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Encoding and activating multiple price lists                     | **[Scenario 15](./scenario-15-price-list-management-plan.md)** (new)                                 | A `PriceList` model exists but has no branch scoping, approval workflow, floor price, or true versioning                                                |
| 2. Creating or updating an item master record                       | **Scenario 16** (new, closed — plan doc removed 2026-08-14)                                          | Item CRUD publishes instantly today — no draft/approve workflow, no Master Data Approver role                                                           |
| 3. Creating or updating a customer and co-maker profile             | Scenario 02 (see its [updates doc](./scenario-02-crm-customer-profile-updates.md), 2026-07-31 entry) | Co-maker entity, duplicate detection, and BM/AR merge-resolution are real gaps on top of the existing profile flow                                      |
| 4. Processing a cash or card sale with serial validation            | Scenario 01                                                                                          | Already implemented                                                                                                                                     |
| 5. Processing an installment sale from application to release       | **Scenario 17** (new, closed — plan doc removed 2026-08-14)                                          | Checkout mechanics are Scenario 01 (closed); the pre-sale Credit Application / Credit Investigation / Promissory Note process is net-new                |
| 6. Recording a reservation and converting it to a sale              | Scenario 03                                                                                          | Already implemented                                                                                                                                     |
| 7. Processing a customer return, exchange or refund                 | **[Scenario 18](./scenario-18-returns-exchanges-disposition-plan.md)** (new)                         | Building blocks exist (request record, JE reversal, restock) but Quarantine, tiered custodian+approver flow, and working Exchange are missing           |
| 8. Creating and completing a Repair Transfer                        | Scenario 07                                                                                          | Already implemented                                                                                                                                     |
| 9. Creating a purchase request and converting it to a PO            | Scenario 10                                                                                          | Already implemented                                                                                                                                     |
| 10. Receiving supplier units and updating the open PO               | Scenarios 05 + 10                                                                                    | Already implemented                                                                                                                                     |
| 11. Matching supplier documents and recording payment               | Scenario 10                                                                                          | Matches its existing, still-open AP-side gap (voucher, 3-way match, cheque printing, withholding, supplier returns)                                     |
| 12. Requesting, dispatching and receiving a stock transfer          | Scenario 06                                                                                          | Already implemented                                                                                                                                     |
| 13. Counting stock and approving an inventory adjustment            | **Scenario 19** (new, closed — plan doc removed 2026-08-14)                                          | `StockCount`/`AdjustmentsService` exist but with no system snapshot, no approval chain, no before/after audit                                           |
| 14. Closing the cashier and reconciling the deposit                 | Scenario 12                                                                                          | Already implemented                                                                                                                                     |
| 15. Posting a collection and updating the correct contract          | Scenario 11                                                                                          | Already implemented                                                                                                                                     |
| 16. Performing NAMIDRe reminders and follow-up                      | **Scenario 20** (new, closed — plan doc removed 2026-08-14, combined with row 17)                    | Net-new on top of the real Collections module — no reminder-task system tied to `InstallmentAccount`/`Collector`                                        |
| 17. Managing a DAM account and escalating it for legal action       | **Scenario 20** (new, closed — plan doc removed 2026-08-14, combined with row 16)                    | Net-new — no delinquency-escalation stage, no legal/Small Claims pipeline                                                                               |
| 18. Working from role queues and synchronizing audited transactions | **[Scenario 21](./scenario-21-role-queues-maker-checker-plan.md)** (new)                             | Action-queue aggregation, maker-checker, and approval limits are additive; true offline-first sync is flagged as future work, not scoped into this pass |

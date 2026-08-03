# Scenario Checklist — Implementation Status

One-page status for all module scenarios (14 from the original source, plus 15-21 added 2026-07-31 from a second client scenario map — see [module-scenarios.md](./module-scenarios.md)'s "Draft 2 additions" for the full routing table). Each row is re-verified against the actual `development` branch code in both repos (not just the plan docs' own checkmarks, which can drift) — see the full gap analysis and Implementation Log in each scenario's own plan doc for file/line evidence.

Last verified: 2026-08-01.

- [x] **01 — POS Installment Sale** — fully closed. [plan](./scenario-01-pos-installment-sale-plan.md)
- [ ] **02 — CRM Customer Profile** — core done (2026-08-01: co-maker, duplicate detection, BM/AR merge-resolution, ID/consent capture, Lead-conversion loyalty bug); Smart SMS + segment campaigns remain out of scope pending their own integration/scoping pass. [plan](./scenario-02-crm-customer-profile-plan.md) / [updates](./scenario-02-crm-customer-profile-updates.md)
  - [ ] Smart SMS — still just a TODO comment, no provider wired
  - [ ] Segment → campaign send mechanism doesn't exist
- [x] **03 — Reservation / Advance Sale** — fully closed. [plan](./scenario-03-reservation-advance-sale-plan.md)
- [x] **04 — POS Cross-Branch Serial** — fully closed. [plan](./scenario-04-pos-cross-branch-serial-plan.md)
- [ ] **05 — Receiving** — core gaps fixed, 2 minor items open. [plan](./scenario-05-receiving-plan.md) / [updates](./scenario-05-receiving-updates.md)
  - [ ] Item cost/price still visible to Branch Manager/Employee roles (no role-gating)
  - [ ] No "freebies" line-item section
- [x] **06 — Stock Request & Inter-Branch Transfer** — fully closed (doc is stale, needs a rewrite). [plan](./scenario-06-stock-request-transfer-plan.md)
- [x] **07 — Repair Transfer** — fully closed, all 5 parts. [plan](./scenario-07-repair-transfer-plan.md)
- [ ] **08 — Caravan** — done, 2 small items open. [plan](./scenario-08-caravan-plan.md)
  - [ ] No "Consign to Branch" UI button — consigning is API-only today
  - [ ] No event name/date field
- [x] **09 — Aircool (aircon sale + install)** — fully closed. [plan](./scenario-09-aircool-plan.md)
- [ ] **10 — Purchasing & Accounts Payable** — PR→PO→RR solid; AP side largely unbuilt. [plan](./scenario-10-purchasing-ap-plan.md) / [updates](./scenario-10-purchasing-ap-updates.md)
  - [ ] Voucher creation (manual #, attachments, approval workflow)
  - [ ] 3-way PO ↔ RR ↔ Invoice match (`APBill` has no PO/RR link; `Vendor`/`Supplier` are disconnected models)
  - [ ] Cheque printing
  - [ ] Auto 1% withholding on payment (still a manual free-text field, defaults to 0)
  - [ ] Supplier returns / debit memos
  - [ ] Updates-doc items: AP-side payment-method/GL config, PO PDF/print/send-to-supplier, PO freebies section, supplier discount fields
- [x] **11 — Collections & AR Aging** — doc was very stale; a real Collector/InstallmentAccount module already shipped. [plan](./scenario-11-collections-ar-aging-plan.md)
  - [ ] (minor) Generic AR aging report (`reports.service.ts`) still flat/single-clock, not integrated with the new collections aging
- [x] **12 — EOD Cash & Cash-in-Transit Monitor** — fully closed, incl. company-wide monitor + Excel export. [plan](./scenario-12-eod-cit-monitor-plan.md) / [updates](./scenario-12-eod-cit-monitor-updates.md)
- [ ] **13 — Credit & Debit Memos** — only half built. [plan](./scenario-13-credit-debit-memos-plan.md)
  - [ ] `CreditMemo` is thin: no type field, no line items, no serial link, not connected to POS returns
  - [ ] `DebitMemo` — zero implementation
  - [ ] Supplier-side returns/credit — zero implementation
- [ ] **14 — Accounting Daily & Month-End** — mostly done, 4 real gaps. [plan](./scenario-14-accounting-month-end-plan.md)
  - [ ] No tax-rate approval workflow
  - [ ] P&L report has no branch filter
  - [ ] No gross-vs-net report variant
  - [ ] `costCenter` is captured on records but never read back in any report
- [ ] **15 — Price List Management & Approval** — new (2026-07-31), not started. [plan](./scenario-15-price-list-management-plan.md)
  - [ ] No branch scoping, no approval workflow, no floor price, no true versioning on `PriceList`
- [ ] **16 — Item Master Governance** — new (2026-07-31), not started. [plan](./scenario-16-item-master-governance-plan.md)
  - [ ] No draft/approve workflow, no Master Data Approver role, dedupe is exact-SKU-only
- [ ] **17 — Credit Application, Investigation & Promissory Note** — new (2026-07-31), not started; depends on Scenario 02's co-maker entity. [plan](./scenario-17-credit-application-promissory-note-plan.md)
  - [ ] No `CreditApplication` entity, no Credit Investigator role/CI record, no `PromissoryNote`
- [ ] **18 — Customer Returns, Exchanges & Disposition** — new (2026-07-31), not started. [plan](./scenario-18-returns-exchanges-disposition-plan.md)
  - [ ] No Quarantine hold, no tiered custodian+approver flow, Exchange is a vestigial enum value, not connected to `CreditMemo`
- [ ] **19 — Stock Count & Inventory Adjustment Approval** — new (2026-07-31), not started. [plan](./scenario-19-stock-count-adjustment-approval-plan.md)
  - [ ] No server-side count snapshot, no approval chain on adjustments, no before/after audit log
- [ ] **20 — Collections Reminder Track (NAMIDRe) & Delinquency Escalation (DAM)** — new (2026-07-31), not started. [plan](./scenario-20-collections-namidre-dam-plan.md)
  - [ ] No NAMIDRe/DAM two-track bifurcation, no structured PTP tracking, no legal-escalation pipeline
- [ ] **21 — Role-Based Action Queues, Maker-Checker & Approval Limits** — new (2026-07-31), not started. [plan](./scenario-21-role-queues-maker-checker-plan.md)
  - [ ] `PendingApprovalsWidget` is hardcoded mock data, no maker≠checker enforcement, `AccountingAuditLog` unused, no approval limits
  - [ ] Offline sync explicitly deferred — flagged as future work, not scoped into this doc's implementation

## Notes

- Scenarios 15-21 were added 2026-07-31 from a second, independently-sourced client scenario map (`NIG_ERP_Core_Operational_Scenarios_Draft_2_20260727.pdf`) — see [module-scenarios.md](./module-scenarios.md)'s "Draft 2 additions" section for the full row-by-row routing table, including which of that PDF's 18 rows matched an existing scenario 1:1 (no new doc needed) versus required a new one.
- Two unresolved conflicting findings on **RFD/Application Form** printability: Scenario 01's check found a working `handlePrint()` in `ReleaseApprovalsList.tsx` (real client-side printable HTML); Scenario 02's check said the backend only returns a status label. Both can be true at once (frontend prints from the label's data) — worth a manual click-through if it matters.
- Several branches that looked "unmerged" (`feat/scenario-04-...`, `feat/scenario-08-caravan`, `feat/aircool-*`, `feat/scenario-12-cit-monitor`, etc.) are actually **stale**, not pending — their content already shipped to `development` via later commits and the branches were never cleaned up.
- Scenario 06 and 11's plan docs describe large gaps that are already closed in code — flagged for a docs refresh, not because the work is missing.

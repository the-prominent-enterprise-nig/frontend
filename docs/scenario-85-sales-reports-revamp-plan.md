# Scenario 85 — Sales Reports Revamp (Dashboard · Sales per Branch · Sales Report) — Gap Analysis & Closing Plan

**Source**: Google Doc "Sales Report" (`1mR2gez7XAhik1vZbEZl8jGb4IPI2QF3YMMKkCX4IXbc`), read 2026-11-05. It's an outline (Module: POS → Feature: Sales Reports → Subfeatures: Dashboard, Sales per Branch, Sales Report) with five screenshots and one line of text: _"This is the full view in the excel file."_ The screenshots are the whole spec, so everything below was read off them.

Saved copies of the screenshots: `/private/tmp/claude-501/-Users-karmslajo-Documents-Prom-tpe-nig-frontend/03935910-325f-4a21-a629-7092defaa4e5/scratchpad/salesdoc/` (session scratchpad, not permanent; re-download from the doc if it's gone).

**Replaces** the current `/pos/reports` screen (Scenario 47 / 56 / 57: "Sales per Branch" and "Sales per Brand" grouped tables plus the Net/Gross/Discount/Margin/Refunds/Units stat row).

## The target screen

One page, **Sales Reports**, with the subtitle _"Units and sales by model and brand, month by month."_, an **Export to Excel** button, and three tabs.

**Shared by all three tabs**

- **Filters**: From, To, Region, Branch, Type, Group, Brand.
- **Stat cards**:
  - Total Sales (gross)
  - Office Sales, with its % of total
  - Agent Sales, with its % of total
  - Total Quantity Sold

### Tab 1 — Dashboard

| Panel                   | Content                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Top models**          | Top 10 models as horizontal bars. Each bar is split into month segments shaded from light (oldest, Nov 25) to dark (newest, Oct 26). Shows units and amount on the right. |
| **Units by brand**      | The same bar view, one bar per brand.                                                                                                                                     |
| **Top models by month** | Table: # · Model · Brand · one column per month (units, with the amount underneath) · Grand total row. Horizontal scroll. "Show all 21" expands past the top 10.          |
| **Brands by month**     | The same table, one row per brand.                                                                                                                                        |

### Tab 2 — Sales per Branch (two sub-tabs)

The sub-tab title reads like _"Negros Operations · October 1–31, 2026"_, which is the Region name plus **the month of the To date**. The footnote says _"Month to date through the To date."_

**2a. Branch Scorecard**

- **KPI cards**:
  - Total Branches (gross)
  - Ach Rate (month pace %)
  - Ahead of pace or met (e.g. "2 of 19")
  - BTS (balance to quota)
- **Table columns**: Branch (expandable) · Total Sales · Office Sales · % Office · Quota · Ach Rate (progress bar with a pace tick) · BTS · Status.
- **Rows** are sorted by Ach Rate, descending.
- **Footer**:
  - **Total Branches** sums the real branches only.
  - **Grand Total** also includes non-branch lines. In the mock, "AC Unit + Services" (quota 2,300,000) is the difference: 26.7M + 2.3M = 29M quota, and 5,412,873 + 282,660 = 5,695,533 sales.
- **Footnote rules**:
  - Sales are gross: the sheet's net figures plus 12% VAT.
  - Clicking a branch shows its daily sales.
  - The tick on the bar is where the branch should be today to stay on pace.
  - **Status**: _Met_ is ≥100%. _Ahead_ is at or past the tick. _Behind_ is past half the tick. _Far behind_ is under half.
- **Merged branches**: "San Carlos + Buluangan" and "Sagay + Escalante" are satellite branches folded into their parent.

**2b. Daily Sales Monitoring**

- **Grid shape**: one column per branch (numbered 1…n) and one row per day. Days are grouped into collapsible **weeks of 8 days** (Week 1 = 1–8, Week 2 = 9–16, and so on). There's a "Hide all weeks" toggle.
- **Rows inside each week**:
  - Each day has a total row, plus an **Office Sales** row under it.
  - Each week ends with **TOTAL** and **OFFICE SALES** subtotal rows.
- **Rows after the weeks**:
  - **WEEK 1–2** (cumulative total)
  - Office Sales
  - % Office Sales
  - Quota
  - Ach Rate
  - BTS (balance to quota)
- **Footer figures**:
  - _October 2025 Sales_ (the same month last year)
  - _January–December 2025 Sales_
  - _Running Bal. Jan–October 2025_
  - _Running Bal. Jan–Sept 2026_

### Tab 3 — Sales Report

_"Every unit sold, as in the sales export. Use Export to Excel to copy it. The total is gross sales (the LCP column)."_

- **Cards**: Total Sales (gross) and Units sold.
- **Scrollable raw table**, one row per unit:
  - Date · Month · Invoice Type · Classification · Branch · SI No. · Firstname · Lastname · Type · Group · Subgroup · Brand · Model No. …
- **Excel export columns** (the "full view"): everything above, plus Serial No. · LCP · Unit Cost · Price Used · Agent · Commission · Credit · SMI.
- **Header row** is yellow with filter dropdowns.

## What's already done ✅

Verified against `development` on 2026-11-05:

- **The page, route and permission exist.**
  - `/pos/reports` (`src/app/(app)/(dashboard)/pos/reports/page.tsx`) is gated on `pos:reports:read`, and it's the `sales-reports` tab of `REPORTS_HUB` (`pos/_shared/pos-hubs.ts:414`).
  - Cashiers are already kept out.
- **One line-level dataset already backs the report.** `SalesReportService.fetchLines()` (`backend/src/pos/reports/sales-report.service.ts`) already provides:
  - Sale lines, with voids excluded and refunds flagged
  - Branch, resolved via terminal, with caravans labelled
  - Brand and primary category
  - Model No. and serials, including the secondary aircon serial
  - Unit cost and invoice type
  - **Branch scoping**: a branch-tied actor is forced to their own branch.
  - This is the right base for all three tabs.
- **Excel export plumbing exists** (Scenarios 47 and 56):
  - `buildReportWorkbook()` with its Summary / Detail / Parameters sheets
  - The native pivot writer (`pivot.util.ts`)
  - `<ExportButton>` and `downloadXlsx`
  - `sales-report.workbook.ts` already writes a Detail sheet with Date, Month, SI/DR No., Branch, Brand, Category, Model, Serial, Unit Cost, Invoice Type…
- **Office vs Agent is already decided** (Scenario 61, decision 3): `PosTransaction.sellingAgentId` set → Agent Sales; null → Office Sales.
- **The satellite fold exists.** `resolveReportingBranch()` (`backend/src/pos/reports/reporting-branch.ts`) folds a `reportsToBranchId` satellite into its parent. That's the "San Carlos + Buluangan" behaviour.
- **Most filter dimensions exist in data**:
  - **Region**: `Branch.region`, an enum with `panay` and `negros`.
  - **Type**: Item Master Type, `ItemType`.
  - **Group / Subgroup**: top-level `ItemCategory` and its child.
  - **Brand**: `Item.brandId`.
- **Most Excel columns are traceable**:
  - **Classification "Repo"** maps to `SerialNumber.repossessedFromInstallmentAccountId` being set.
  - **Price Used** maps to `PosTransactionLine.priceUseTypeId`.
  - **Agent** maps to `sellingAgentId`.
  - **Commission** maps to `AgentCommission.commissionAmount`.
  - **Customer first and last name** come from the transaction's customer.

## What's not done / gaps ❌⚠️

1. **No sales quota anywhere.** ❌ The only quota model is `ProcurementQuota`, a PO spending cap. The scorecard, Daily Sales Monitoring and every BTS figure need a **monthly sales quota per branch** (plus non-branch lines like "AC Unit + Services"), and a screen to enter it.
2. **No month-by-month aggregation.** ❌ The current service groups by branch/brand/category/model with no time axis. The Dashboard needs model × month and brand × month, plus top-N.
3. **No Region / Type / Group filters.** ❌
   - The DTO only takes `branchIds`, `brandIds`, `categoryIds` and `invoiceType`.
   - The screen only has Branch and Brand.
4. **No Office / Agent split.** ❌ It's computed for Scenario 61's single-branch-day sheet (`daily-sales-monitoring.service.ts`), but not in the sales report.
5. **No daily branch × day grid or scorecard endpoint.** ❌
6. **The sales basis must change to "gross (LCP)".** ⚠️
   - The screen currently leads with Net, and Scenario 57 left "use the actual price / what is LCP" open.
   - This mock answers part of it: _"The total is gross sales (the LCP column)"_ and _"the sheet's net figures plus 12% VAT"_.
   - What LCP is for an **installment** line still needs a decision (see Q2).
7. **Detail rows lack several Excel columns.** ❌
   - Classification, customer first/last name, Type, Group/Subgroup split, LCP, Price Used, Agent, Commission, Credit and SMI are all missing.
   - **Credit** and **SMI** aren't defined anywhere (see Q4).
8. **Prior-year comparison figures** (October 2025 Sales, Jan–Dec 2025, running balances) need sales from before go-live, and the system doesn't hold them. ⚠️ See Q5.
9. **Name collision.** ⚠️ Scenario 61 already shipped a "Daily Sales Monitoring" sheet (one branch, one day, by category) at `/pos/daily-collection`. The new tab is a different report (all branches × days of the month) with the same name.

## Open questions — need the developer's / client's call

| #   | Question                                                                                                                                                                                         | Recommended default                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | **Quotas: who enters them, and where?** Is it per branch per month? Are non-branch lines ("AC Unit + Services") quota-only rows, or a real sales bucket (an item Type?) that also carries sales? | A new `SalesQuota { branchId?, label?, year, month, amount }` with a grid editor under POS Configuration. Gate it on a new `pos:sales-quotas:manage` (Business Owner + Accountant). Allow Excel paste/import of a year at once. "AC Unit + Services" becomes a named non-branch line whose sales come from Split Type items plus service lines (**confirm with client**). |
| Q2  | **LCP for an installment line.** Is it the cash price (`InstallmentAccount.lcp`) or the installment total?                                                                                       | Use the cash price: `lineTotal` for cash/charge lines, and the account's `lcp` for installment lines. Gross means VAT-inclusive, which is what our `inclusive` price lists already store. **Confirm with client.**                                                                                                                                                        |
| Q3  | **Scorecard period.** Is it always the To date's month, month-to-date?                                                                                                                           | Yes, as the footnote says. The pace tick is `day(To) / daysInMonth`. Dashboard and Sales Report use the full From–To range.                                                                                                                                                                                                                                               |
| Q4  | **Credit and SMI columns.** What are they?                                                                                                                                                       | Leave them out until the client defines them.                                                                                                                                                                                                                                                                                                                             |
| Q5  | **Prior-year figures.** Do we import historical monthly totals per branch, or show only what the system has?                                                                                     | Add a small "historical monthly sales" import (branch × month totals) that is used only by these footer lines. If declined, hide the lines when there's no data.                                                                                                                                                                                                          |
| Q6  | **Does "Sales per Brand" survive?**                                                                                                                                                              | No. The Dashboard's Units by Brand and Brands by Month replace it. Drop the `sales-by-brand` endpoints after the revamp ships.                                                                                                                                                                                                                                            |
| Q7  | **Daily Sales Monitoring naming.**                                                                                                                                                               | Keep the client's name on the new tab and rename Scenario 61's sheet to "Daily Sales by Category". **Confirm.**                                                                                                                                                                                                                                                           |
| Q8  | **Refunds.** The mock has no refund column.                                                                                                                                                      | Net refunds into the figures they reverse, dated on the refund date.                                                                                                                                                                                                                                                                                                      |

## Decisions taken (developer, 2026-11-05)

1. **Q1 — Quotas**:
   - A **Sales Quotas grid under POS Configuration** (year → branches × 12 months), gated on new `pos:sales-quotas:manage`. Originally Business Owner and Accountant; **narrowed to Business Owner only** later the same day (see decision 10).
   - **"AC Unit + Services"** is a non-branch line. Its sales are every **Split Type** item plus service lines, across all branches.
   - Those sales **leave their branch's row**, so nothing is counted twice. Total Branches therefore excludes them, and Grand Total includes them.
2. **Q2 — LCP**:
   - **Installment** lines use the account's cash price (`InstallmentAccount.lcp`).
   - **Cash and charge** lines use the charged, VAT-inclusive line total.
3. **Q3 — Scorecard period**: the To date's month, month to date. Pace = `day(To) / daysInMonth`.
4. **Q4 — Credit and SMI**: kept as **empty columns** in the Excel to match the layout, until the client defines them.
5. **Q5 — Prior-year footer**: **system data only**. A line with no data for its period is hidden. No historical import.
6. **Q6 — Old reports**: removed in Part 7, meaning the Sales per Brand / per Branch view and the `sales-by-branch` and `sales-by-brand` endpoints.
7. **Q7 — Naming**: **both keep "Daily Sales Monitoring"**. They live on different pages, and Scenario 61's sheet is not renamed.
8. **Q8 — Refunds**: netted into the figures they reverse, dated on the refund date (plan default; not separately asked).
9. **Quota page placement** (2026-11-05, Part 4): a **Sales Quotas tab in the POS Reports hub**, not POS Settings. POS Settings is gated by role (`canManagePosSettings`: Business Owner and Branch Manager), so the Accountant could never reach it. The new tab is gated on `pos:sales-quotas:manage`.

- **Business Owner only** (developer, 2026-11-05, during Part 4): the Accountant grant was dropped from the migration and the seed. The backend and frontend check the role itself (`canManageQuotas` / `canManageSalesQuotas`), because Branch Manager's `pos:*:*` wildcard matches the permission.
- **"AC Unit + Services"** is a fixed non-branch line (`SalesQuota.line = ac_unit_services`), not a free-text label. Part 5 needs a rule for which sales a line covers, and only this line has one.

9. **Delivery**: 7 parts, one at a time, each confirmed before the next.

## Closing the gaps

Backend first in each part. Each part ships on its own and is testable.

### Part 1 — Shared filter bar, stat cards, and the gross/LCP basis

- **Backend**
  - Extend `SalesReportQueryDto` with `regions`, `itemTypeIds` and `groupIds`, where a group covers that category plus its subgroups.
  - Put line selection in one place in `fetchLines()`, so every tab reads the same filtered lines.
  - Add `lcp`, `isAgentSale`, `agentName`, `customerFirst/Last`, `typeName`, `groupName`, `subgroupName`, `classification`, `priceUseName` and `commission` to `SalesDetailRow`.
  - New `GET /pos/reports/sales/summary` → `{ totalGross, officeGross, agentGross, units }`.
- **Frontend**
  - Replace `SalesReportsView` with a shell: header, Export button, tab bar, a `SalesReportFilters` row (all searchable selects per house rules), and the four stat cards.
  - Filters live in one `useSalesReportFilters()` hook, shared by the tabs and kept in the URL so a tab switch keeps them.
  - Default range: from the start of month-11 to today. This matches the mock's 12-month Dashboard.

### Part 2 — Tab 3 · Sales Report (raw detail + Excel)

Done before the Dashboard because it's the same dataset with no new aggregation, and the export is what the client checks figures against.

- **Backend**
  - `GET /pos/reports/sales/lines`, paginated server-side, because a 12-month range is thousands of rows.
  - `GET /pos/reports/sales/lines/export` writes the full Excel column set in the mock's order: yellow header, autofilter, frozen header row.
  - Keep the Scenario 56 pivots on that workbook.
- **Frontend**
  - Totals cards.
  - A sticky-header, horizontally scrollable table with the mock's columns.

### Part 3 — Tab 1 · Dashboard

- **Backend**
  - `GET /pos/reports/sales/by-month?dimension=model|brand&top=10`.
  - Returns `{ months: ['2025-11', …], rows: [{ key, brand?, perMonth: [{ units, gross }], totalUnits, totalGross }], grandTotal }`, ranked by units.
  - `top` omitted returns all rows (for "Show all N").
- **Frontend**
  - `MonthSegmentBar`: one bar split into month segments, on a purple sequential ramp, with a legend from the oldest month to the newest.
  - Two bar panels and two month tables (sticky first columns, horizontal scroll, Grand total row, "Show all N").
  - Read the `dataviz` skill before building the bars.

### Part 4 — Quotas (prerequisite for Part 5)

- **Backend**
  - Prisma `SalesQuota` (tenant, nullable `branchId` **or** `label` for non-branch lines, `year`, `month`, `amount`, unique per tenant + target + month), plus a migration.
  - CRUD and a bulk-upsert endpoint.
  - New permission, added to Business Owner and Accountant.
- **Frontend**
  - **Sales Quotas** page under POS Configuration: a year picker, then a branches × 12 months grid of money inputs.
  - Satellites are hidden; their quota sits on the parent.
  - Includes an "add non-branch line" action and Excel paste.

### Part 5 — Tab 2a · Branch Scorecard

- **Backend**
  - `GET /pos/reports/sales/scorecard?asOf=` for the month of `asOf`, month to date.
  - Per **reporting branch** (satellites folded via `resolveReportingBranch`, caravans per Q-decision):
    - total, office, % office
    - quota, ach rate, BTS
    - status from the footnote thresholds
  - Plus the Total Branches row, non-branch lines and the Grand Total.
  - Status logic goes in a pure, unit-tested function.
- **Frontend**
  - KPI cards and the scorecard table: progress bar with the pace tick, status pill, sorted by ach rate.
  - Expanding a branch row shows that branch's daily sales for the month (reuses the Part 6 day query with one branch).

### Part 6 — Tab 2b · Daily Sales Monitoring

- **Backend**
  - `GET /pos/reports/sales/daily-monitoring?asOf=` returns `{ branches[], days: [{ day, perBranch: [{ total, office }] }], quota/ach/bts per branch }`, already bucketed into 8-day weeks.
  - Plus `GET …/daily-monitoring/export`.
- **Frontend**
  - A wide grid with a sticky Day column and numbered branch headers.
  - Collapsible weeks with "Hide all weeks", banded subtotal rows, and summary rows at the bottom.
  - Prior-year footer lines per Q5.

### Part 7 — Excel export per tab, and cleanup

- Make **Export to Excel** follow the active tab:
  - Dashboard: model × month and brand × month sheets.
  - Scorecard: the scorecard sheet.
  - Daily Monitoring: the grid.
  - Sales Report: the raw sheet.
- Remove the `sales-by-branch` and `sales-by-brand` endpoints, the old view, and `SUMMARY_KEY_HEADERS`, unless Q6 says keep.
- Scenario 61's sheet keeps its name (Q7).

## Conventions this scenario must follow

- **Branch scoping**: a branch-tied actor sees only their reporting branch on every tab and in every export. Business Owner (`actorBranchId === null`) is unrestricted.
- **Same numbers everywhere**: the stat cards, tab totals and Excel totals all come from the same filtered line set. Add a backend spec asserting that scorecard Grand Total = summary Total Sales for the same month.
- **Code style**:
  - Forms use RHF + Zod + `Controller`, and dropdowns use `SearchableSelect`.
  - Icon buttons get tooltips.
  - Grey text uses `ink` tokens.
  - No inline styles.

## Progress log

_(empty — filled in by `/implement-scenario`)_

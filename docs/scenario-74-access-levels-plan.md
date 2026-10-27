# Scenario 74 — Access Levels (client sheet → roles)

Source: the client's "NIG Central ERP: Access Levels" Google Sheet (Access Levels, Approvals and Email tabs).
Roles are defined once in `backend/prisma/access-level-roles.ts` and used by both `prisma/seed.ts` and `scripts/backfill-access-level-roles.ts`.

## Part 1 — roles and permissions (this branch)

The sheet's 254 rows group into 21 distinct permission sets. Each set is one role, named for its function. We don't use the client's codes or job titles anywhere in the code: people are assigned to roles by our role name. No role is made per person.

**Role names below are proposals for Chloe to approve.**

| Proposed role       | People |
| ------------------- | ------ |
| Finance Head        | 2      |
| Expense Clerk       | 2      |
| Liquidation Clerk   | 1      |
| Deposit Clerk       | 5      |
| Bank Clerk          | 1      |
| Payables Clerk      | 2      |
| Treasury Clerk      | 2      |
| Inventory Manager   | 4      |
| Stock Clerk         | 5      |
| Sales Admin         | 6      |
| AR Supervisor       | 2      |
| Sales Support       | 21     |
| Branch Support      | 8      |
| Aircon Staff        | 6      |
| Aircon Clerk        | 1      |
| HR Officer          | 2      |
| Service Coordinator | 2      |
| Receptionist        | 4      |
| Custodian           | 3      |
| Collector           | 9      |
| Warehouse Custodian | 2      |

Branch Manager and Cashier keep their existing roles **unchanged**. See "Conflicts" below.

### New permissions

Three sheet features had no permission of their own, so the sheet couldn't be followed without adding one:

| Permission                                                  | Used to be gated by              | Why split                                                                                                             |
| ----------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `accounting:recurring-expenses:{read,create,update,delete}` | `accounting:expense:*`           | Branch staff and Aircon Clerk get Expenses without Recurring                                                          |
| `accounting:special-accounts:{read,create}`                 | `accounting:expense:read/create` | Bank Clerk and HR Officer get Special Accounts without Expenses; Deposit Clerk gets Expenses without Special Accounts |
| `pos:catalog:read`                                          | `pos:transactions:read`          | Inventory roles get Product Catalog without the rest of POS                                                           |

No existing role loses access:

- The migration `20261027100000_access_level_permissions` adds the 7 permissions and gives every role that held `accounting:expense:<action>` the matching new one, and the Business Owner all of them. It runs with `prisma migrate deploy`, so nobody loses a tab between the deploy and a backfill. It skips the 21 Access Levels roles, whose grants come from the sheet.
- The seed grants the same to Branch Manager, and Accountant's `accounting:*` covers it.
- `pos/catalog` accepts either permission, so nothing that read it before is cut off.
- The Special Accounts register (`GET /expenses/special-accounts`) needs `special-accounts:read`. The Expense form's payee picker reads `GET /expenses/special-accounts/options` instead, which accepts `expense:read` and returns only the name, balance and linked employee on one control account.
- Item cost: `GET /inventory/items` and `GET /inventory/items/:id` return `costPrice: null` to callers without `inventory:costing:read`.

### Decisions made here (please confirm)

1. **"POS ALL" is `pos:*:*`.** The client's rulings hold without an exclusion: approving a credit application is checked by role name, Business Owner only (2026-09-18), and depositing cash is gated on `accounting:cash-in-transit:manage` (Scenario 53), which no `pos:` permission reaches.
2. **Branch staff get POS the way Cashier does.** Receptionist, Custodian and Collector don't get `pos:transaction:override` (approving another cashier's override, refund or cancellation) or `pos:reports:read` (the cost-bearing sales reports). **Exclusion kept, please confirm:** it means they hold concrete POS rows, not the wildcard, so a POS permission added later doesn't reach them.
3. **"Stock Transaction ALL" doesn't include approval steps** for Employee-tier roles. That covers stock-adjustment confirm, investigate and approve; PO approve; DR approve and void; transfer manager/HQ approve and direct; and supplier-return approve, finalize and void. This is the same line Stock Controller is drawn with.
4. **Inventory Manager** gets all of Inventory except `inventory:stock-adjustment:investigate`, `inventory:stock-adjustment:approve` (Business Owner only, Scenario 19) and `inventory:manual-rr:create` (owner only by default). It **does** approve Delivery Receipts, per the Approvals tab. **Exclusion kept, please confirm:** it means concrete inventory rows, not `inventory:*:*`.
5. **Where the sheet says ALL, the role holds the module wildcard** (`accounting:*:*`, `pos:*:*`, `crm:*:*`, `inventory:*:*`), like Accountant, so a permission added to the module later reaches it. The two exclusions above are the only ALL modules held as concrete rows, because a wildcard can't carry an exclusion.
6. **Lookups and attachments come with the feature**, not role by role. See "Modules and Sharing Plan" below: a feature's screens get the pick lists they use (customers, suppliers, items, warehouses…) and Files with attach rights automatically. Every account picker outside the Chart of Accounts (Expense, Recurring, the Expenses filter, Bill form, Record Payment, deposit slip, New Special Account, debit memo lines, acknowledgement receipts, supplier, item and category accounts, POS settings) picks from `GET /accounts/options`, which each of those features' permissions open, because `GET /accounts` carries every posted transaction.
7. **"Paid from".** Bank accounts don't come with a feature (they carry live balances, and Part 2 limits which ones a role may use). Receptionist and Aircon Clerk get `accounting:bank-accounts:read` directly, so until Part 2 they see every bank and cash account there, not just their petty cash.

## Modules and Sharing Plan (Chloe's plan, Steps 0–6)

Every feature belongs to one module, a role reads as "Module: access level", and anything another module also uses carries a "Shared with" note. The map is code: `backend/src/auth/access-map.ts`, served to the frontend by `GET /permissions/access-map`.

**What's built:**

- **Step 0, the map.** 45 features; each of the 124 permission resources in Accounting, Inventory, POS, CRM and Files belongs to exactly one (`access-map.spec.ts` checks none is listed twice; `test/shared-access.e2e-spec.ts` checks every permission in the database has a feature). "Shared with" comes from the code: each route's `@RequirePermissions` against the module of every frontend screen that calls it. The owner is the module the permission lives in today; ownership questions A–F below are marked pending until answered.
- **Step 2, "Shared with" notes.** Manage Role Access groups each module's resources by feature, with On/Off, "Shared with", what the feature comes with, and any pending question.
- **Step 3, shared items come with the module.** `withSharedAccess()` adds what a role's features need, view or pick only, in the guard, the session and `getUserPermissions`. Nothing is stored on roles and needs don't chain. Navigation (sidebar, hub tabs) is built from the roles' own rows (`rolePermissions` in the session), so what a feature brings never adds a page to anyone's menu; pages stay reachable by URL, view only. Two lists are left out on purpose: bank accounts (live balances; shared once Part 2 limits them) and the full chart of accounts (every posted transaction): every account picker outside the Chart of Accounts uses `GET /accounts/options`, the accounts without balances or transactions, open to each feature whose screens pick an account.
- **Step 4, every role.** The 21 roles no longer list lookups by hand. Migration `20261027130000_access_level_wildcard_cleanup` removes rows a role's own module wildcard already covers, never `accounting:query-center:read`.
- **Step 5, summaries.** The roles list, the role editor and Add User read each module as **All access**, **All access \*** (everything but protected steps, listed on hover), **Partial (k of n features)** ("…, some steps off" when every feature is on but steps inside are off), or nothing. Add User reads the picked roles back with the branch scope.
- **Step 6, checks.** `scripts/compare-role-access.ts` compares every role before and after (nothing lost, every addition on the map): 29/29 locally. e2e: `test/shared-access.e2e-spec.ts` (fails with the helper disabled) and Playwright `e2e/roles-access-module-map.spec.ts`.

**Protected steps** (a role holding everything else reads "All access \*"): `pos:transaction:override`, `pos:reports:read`, `inventory:stock-adjustment:investigate`, `inventory:stock-adjustment:approve`, `inventory:manual-rr:create`.

### The map

### Accounting

| Feature                                             | Permissions                                                                                                                                   | Shared with    | Comes with (view only)                                                        | Note                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Journal Entries & General Ledger                    | `journalEntry`, `generalLedger`, `recurring-entries`, `transaction`, `fx`                                                                     | -              | -                                                                             |                                                                   |
| Chart of Accounts & Account Mapping                 | `account`                                                                                                                                     | POS            | -                                                                             |                                                                   |
| Fiscal Periods                                      | `fiscal`                                                                                                                                      | -              | -                                                                             |                                                                   |
| Receivables (AR Invoices, collections, advances)    | `ar-invoices`, `payment`, `customer-advances`, `unapplied-collections`, `retention`, `penalty-waivers`, `installmentInterest`, `x-deal-memos` | POS            | Customers                                                                     |                                                                   |
| Customers                                           | `customer`                                                                                                                                    | CRM, POS       | -                                                                             | Decision A                                                        |
| Credit & Debit Memos                                | `credit-memos`, `debit-memos`, `supplier-debit-memos`, `inventory-debit-memos`                                                                | Inventory      | AR invoices, Customers                                                        | Decision F; Inventory debit memos have their page under Inventory |
| Payables (AP Invoices, Payments, Receiving Reports) | `ap-bills`, `ap-payment-methods`, `disbursement`, `manual-rr`                                                                                 | Inventory      | Suppliers, Files (upload and attach)                                          | Decision D; manual-rr also exists as inventory:manual-rr          |
| Suppliers (Accounting)                              | `supplier`                                                                                                                                    | -              | Suppliers                                                                     | Decision B; checked by no route today                             |
| Expenses                                            | `expense`, `employee`                                                                                                                         | -              | Customers, Suppliers, Files (upload and attach), Files (remove an attachment) |                                                                   |
| Recurring Expenses                                  | `recurring-expenses`                                                                                                                          | -              | -                                                                             |                                                                   |
| Special Accounts                                    | `special-accounts`                                                                                                                            | -              | Employees list                                                                |                                                                   |
| Employee Cash Loans                                 | `employee-cash-loan`                                                                                                                          | -              | -                                                                             |                                                                   |
| Cash & Banking                                      | `bank-accounts`, `cash-in-transit`, `cash-forecast`                                                                                           | POS            | Files (upload and attach), Files (remove an attachment)                       |                                                                   |
| Fixed Assets                                        | `fixedAsset`                                                                                                                                  | -              | -                                                                             |                                                                   |
| Budget                                              | `budget`                                                                                                                                      | -              | -                                                                             |                                                                   |
| Reports & BIR                                       | `financial_report`, `bir_export`                                                                                                              | CRM, Inventory | -                                                                             |                                                                   |
| Tax Codes & Tax Closing                             | `tax-codes`, `tax-closing`                                                                                                                    | -              | -                                                                             |                                                                   |
| Data Query Center (Business Owner only)             | `query-center`                                                                                                                                | -              | -                                                                             | exact row checked; never covered by a wildcard                    |

### Inventory

| Feature                          | Permissions                                                                                                                  | Shared with     | Comes with (view only)                                                     | Note                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- |
| Item Master                      | `items`, `attributes`, `barcodes`, `bundles`, `categories`, `uom`                                                            | -               | -                                                                          |                                                           |
| Price Lists                      | `price-lists`                                                                                                                | POS             | -                                                                          |                                                           |
| Warehouses                       | `warehouses`                                                                                                                 | -               | -                                                                          |                                                           |
| Stock Ledger                     | `stock`, `stock-levels`, `serial`, `serial_numbers`, `batch`, `batches`, `expiry`, `negative-stock`, `projection`, `reports` | POS             | -                                                                          |                                                           |
| Costing                          | `costing`, `landed-cost`, `revaluation`                                                                                      | -               | -                                                                          |                                                           |
| Receiving                        | `receive`, `goods-receipts`, `manual-rr`, `quality-hold`                                                                     | Accounting      | Items, Warehouses, Suppliers, Files (upload and attach)                    | Decision D; manual-rr also exists as accounting:manual-rr |
| Purchasing                       | `purchase-requests`, `purchase-orders`, `quotas`, `reorder`                                                                  | Accounting      | Items, Warehouses, Suppliers                                               |                                                           |
| Suppliers                        | `suppliers`                                                                                                                  | Accounting      | -                                                                          | Decision B                                                |
| Transfers                        | `transfers`, `caravan`                                                                                                       | Accounting, POS | Items, Warehouses                                                          |                                                           |
| Delivery Receipts, Returns & UDS | `delivery-receipts`, `returns`, `supplier-returns`, `uds`, `backorders`                                                      | Accounting      | Items, Warehouses, Files (upload and attach), Files (remove an attachment) |                                                           |
| Stock Counts & Adjustments       | `stock-adjustment`, `stock-count`, `cycle-count`, `mobile-count`                                                             | -               | -                                                                          |                                                           |
| Reservations                     | `reservations`, `sku-reservations`                                                                                           | POS             | -                                                                          |                                                           |
| Drivers                          | `drivers`                                                                                                                    | Accounting      | -                                                                          | Decision C; page is under Accounting › Expenses           |

### POS

| Feature                        | Permissions                                                                                                                                | Shared with     | Comes with (view only)                                             | Note                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| Checkout & Transactions        | `transactions`, `transaction`, `sessions`, `cash-drawer`, `cashier-pin`, `terminals`, `service-drafts`, `investigation`, `promissory-note` | Inventory       | Customers                                                          |                                                              |
| Catalog & Pricing              | `catalog`, `branch-pricing`, `promo-codes`, `financing-terms`, `tpf-providers`                                                             | -               | -                                                                  |                                                              |
| Collections & Daily Collection | `collections`, `daily-collection`, `cash-in-transit`                                                                                       | Accounting, CRM | Customers, Files (upload and attach), Files (remove an attachment) | Decision E; pos:cash-in-transit is retired since Scenario 53 |
| Credit Applications            | `application`                                                                                                                              | -               | CRM customers, POS customers, Files (upload and attach)            |                                                              |
| POS Customers                  | `customers`                                                                                                                                | -               | -                                                                  | Decision A                                                   |
| Loyalty & Gift Cards           | `loyalty`, `loyalty-program`, `gift-cards`                                                                                                 | -               | -                                                                  |                                                              |
| Sales Reports                  | `reports`                                                                                                                                  | -               | -                                                                  |                                                              |
| POS Settings                   | `config`                                                                                                                                   | Accounting      | -                                                                  |                                                              |

### CRM

| Feature                      | Permissions                                                             | Shared with                | Comes with (view only)               | Note       |
| ---------------------------- | ----------------------------------------------------------------------- | -------------------------- | ------------------------------------ | ---------- |
| CRM Customers                | `customers`                                                             | POS                        | Customers, Files (upload and attach) | Decision A |
| Leads, Pipeline & Follow-ups | `leads`, `pipeline`, `interactions`, `segments`, `reminders`            | -                          | -                                    |            |
| Installment Accounts         | `installment-accounts`                                                  | Accounting, Inventory, POS | -                                    |            |
| Collectors & Incentives      | `collectors`, `collections-calendar`, `collection-incentives`, `agents` | -                          | Customers                            |            |
| CRM Settings                 | `settings`                                                              | -                          | -                                    |            |

### Files

| Feature             | Permissions            | Shared with                     | Comes with (view only) | Note                                                                                         |
| ------------------- | ---------------------- | ------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| Files & Attachments | `files`, `attachments` | Accounting, CRM, Inventory, POS | -                      | shared with upload and attach rights (the one exception); remove only where a screen removes |

### Ownership questions (pending)

| #   | Feature                  | Today                                                                                                                                        | Question                                                                                          |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A   | Customers                | Three sets: `accounting:customer`, `crm:customers`, `pos:customers`                                                                          | Which module owns Customers? The other two become "Shared with" (the merge is its own later step) |
| B   | Suppliers                | The Suppliers page sits under Accounting › Payables but calls the `inventory:suppliers` routes. `accounting:supplier` is checked by no route | Accounting or Inventory as owner? Drop the unused `accounting:supplier`?                          |
| C   | Drivers                  | `inventory:drivers`, but the page is under Accounting › Expenses › Drivers                                                                   | Accounting or Inventory?                                                                          |
| D   | Manual Receiving Reports | `accounting:manual-rr` and `inventory:manual-rr`, either one opens the routes                                                                | Which one is the owner's?                                                                         |
| E   | Cash-in-transit          | `accounting:cash-in-transit` (deposits) and the retired `pos:cash-in-transit`                                                                | Remove the retired POS rows?                                                                      |
| F   | Inventory Debit Memos    | `accounting:inventory-debit-memos`, page under Inventory › Debit Memos                                                                       | Accounting or Inventory?                                                                          |

### Not checked by any backend route

18 permission resources open nothing on the backend. Some only show or hide a page on the frontend:

- Frontend gating only: `accounting:bir_export`, `accounting:disbursement`, `accounting:payment`, `accounting:supplier`, `accounting:transaction`, `crm:settings`, `inventory:goods-receipts`, `inventory:mobile-count`, `inventory:quality-hold`, `inventory:returns`
- Used nowhere: `accounting:fx`, `accounting:installmentInterest`, `inventory:batches`, `inventory:cycle-count`, `inventory:reorder`, `inventory:serial_numbers`, `inventory:stock-levels`, `pos:branch-pricing`

## Questions for the client

- The Approvals tab says department heads can approve Delivery Receipts. The aircon department head shares the Aircon Staff permission set. Should they get a separate role that can approve DRs?
- "CRM ALL" includes CRM approvals: collection incentives, category graduation and legal escalation. Is that intended for branch collectors, receptionists and custodians?
- Branch roles have "ALL" as the CRM restriction, while POS says "Limited to their Branch". Does CRM span all branches?
- Stock Ledger says "ALL, No item cost", while Stock Transaction says "Limited to their Branch". Is that difference intended?
- Payables "ALL" (Payables Clerk): the Receiving Reports tab is gated on `financial_report:read`, which also opens Accounting › Reports. It's not granted yet. Should it be?

## Conflicts with existing roles — not changed

| Role           | Today                                                      | Sheet                                                                       |
| -------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| Branch Manager | Module wildcards across accounting, inventory, POS and CRM | POS, CRM, Stock Ledger and Transaction, and branch petty-cash expenses only |
| Cashier        | POS (minus four), CRM customer read/update, AR collect     | POS, CRM, Stock Ledger and Transaction, and branch petty-cash expenses      |
| Accountant     | `accounting:*`                                             | Not in the sheet. The clerks above split its duties                         |
| Business Owner | Full access                                                | Not in the sheet. Untouched                                                 |

## Part 2 — restrictions (proposed design, needs Chloe's OK before building)

Several sheet restrictions are allow-lists that a permission string can't express:

| Restriction                    | Roles                                                                                                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bank accounts                  | Expense Clerk: Revolving Fund Panay and Construction Panay only. Liquidation Clerk: Palawan (BDO) and GCash (Corporate) only                                                                               |
| Special Accounts by GL code    | Liquidation Clerk: 1-01-320, 1-01-321, 1-01-323 · Bank Clerk: 1-01-321, 1-01-323 · Payables Clerk: 1-03-010, 1-03-020, 1-03-021, 1-03-022, 1-03-030, 1-03-040, 1-03-060 · HR Officer: 1-01-320 to 1-01-323 |
| Expense "Paid From" petty cash | Receptionist and branch staff: their own branch's petty cash · Aircon Clerk: Petty Cash - Aircool. Until this lands they see every account in "Paid from"                                                  |
| Acknowledgment receipt only    | Treasury Clerk on POS › New Receipts                                                                                                                                                                       |
| No item cost                   | Branch roles, Warehouse Custodian, and Service Coordinator on Stock Ledger                                                                                                                                 |

**Proposal:**

- **One table, `RoleScope`.** Columns: `roleId`, `kind` (`bank-account` | `gl-account` | `petty-cash`), `targetId`, and `targetBranchScoped` (bool, meaning "the user's own branch"). One allow-list mechanism covers the first three rows.
  - A role with no rows of a kind is unrestricted for that kind.
  - A role with rows is limited to them, and the union across the user's roles applies.
  - Per role, not per user. The clerks differ in their allow-lists as well as their permissions, so they're already separate roles.
- **A `ScopeService.allowed(user, kind)`** returns `null` (unrestricted) or a set of IDs. It's enforced in the services on list, detail and every write, mirroring the `actorBranchId` pattern in `transfers.service`. A write against an ID outside the set gets a 403, and lists filter to the set.
- **Acknowledgment-only:** a new `pos:acknowledgement-receipts:create` permission. New Receipts accepts either it or `pos:collections:manage`, and the receipt-type picker shows only Acknowledgment for the narrow permission. No allow-list needed.
- **No item cost:** strip the cost fields from the stock-balance, stockbook and transaction API responses when the caller lacks `inventory:costing:read`. Hiding them in the frontend isn't enough. Part 1 already withholds `costing:read` and `receive:cost-view` from these roles, and strips `costPrice` from the item list and detail.
- **UI:** a full page under Settings › Roles & Access › (role) › Scopes, using `SearchableSelect`. No modals.

**Found while writing the e2e spec:** the Stock Ledger tabs read `GET /inventory/stock/balances` and `GET /inventory/serial-numbers`, which have no `@RequirePermissions` at all. Any signed-in user can read stock balances and serials, so "No Access" on Inventory (Finance Head) doesn't fully hold, and `inventory:stock:read` isn't checked anywhere in the backend. Gating them on `inventory:stock:read` / `inventory:serial:read` belongs in Part 2, with the no-item-cost stripping, since both touch the same responses. The spec carries it as a `todo`.

## Rollout

> **Don't run `assign-access-level-roles.ts --apply` for real people before Part 2.** The bank-account, GL-account, petty-cash and item-cost limits aren't built yet, so a real clerk would see every bank account, Special Account and petty cash fund their permissions reach.

- **Fresh environments:** `prisma db seed` creates everything. **Never on staging or prod** — it wipes the data.
- **On deploy:** `prisma migrate deploy` adds the 7 new permissions and keeps existing roles' Recurring and Special Accounts access (steps 1 and 2 of the backfill), adds every permission row the 21 roles need if missing, and removes rows a role's own module wildcard covers.
- **Before and after:** `npx ts-node -r tsconfig-paths/register scripts/compare-role-access.ts` lists, per role, anything lost (must be none) and what its features now bring.
- **Existing environments, the 21 roles:**
  ```
  npx ts-node -r tsconfig-paths/register scripts/backfill-access-level-roles.ts           # dry run
  npx ts-node -r tsconfig-paths/register scripts/backfill-access-level-roles.ts --apply
  ```
  The script is additive and checks every role before writing. If a permission it needs is missing (e.g. `backfill-delivery-receipt-permissions.ts` never ran), it stops without writing anything and names the missing ones.
- **The people file:** a `Name,Email,Branch,Role` CSV, where Role is our role name and Branch is a branch name, a branch code (`NWHSE` and "Negros Warehouse" both work) or `Head Office`. It holds real emails, so it stays out of the repo. The current one (107 people) was made once from the client's Email tab.
- **Assigning people to roles:** `scripts/assign-access-level-roles.ts --csv <people CSV>` (dry run, `--apply` to write). It finds each person by email and adds the named role. It never creates accounts, removes roles or changes branches, and it reports people with no account, a leftover role, or a branch that doesn't match the file.
- **Local accounts for manual testing:** `scripts/create-access-level-test-accounts.ts --csv <people CSV>` creates one login per row on the CSV's branch with the CSV's role. Localhost only, safe to re-run, no invites or emails. Without `--csv` it creates the `technova.al-*` logins the e2e specs use.
- **E2E:** `test/access-level-roles.e2e-spec.ts` covers 12 roles (allowed, denied, and other-branch denied) checks that Branch Manager and Accountant keep Recurring and Special Accounts, that ALL modules are held as wildcards, attachments, the Expense form's Account and "Paid from" lookups, the Special Accounts picker vs register, and item cost on `GET /inventory/items`. 108 pass, plus 1 `todo` for the ungated Stock Ledger reads. `test/user-invite-flow.e2e-spec.ts` checks that a user created with no branch gets head-office scope.

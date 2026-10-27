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
6. **The Expense form's lookups.** Every expense role gets `accounting:account:read` (each line's Account). Receptionist and Aircon Clerk also get `accounting:bank-accounts:read` for "Paid from", so until Part 2 they see every bank and cash account there, not just their petty cash. Without these the form couldn't be filled in at all.
7. **Attachments.** Every feature whose screens attach files carries `files:files:create` and `files:attachments:{create,read,delete}`: expenses, fund transfers and Cash & Banking, Payables, POS, CRM and Inventory. That reaches AR Supervisor, Bank Clerk, Branch Support, Collector, HR Officer, Inventory Manager, Sales Support and Treasury Clerk, which had none.

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
- **On deploy:** `prisma migrate deploy` adds the 7 new permissions and keeps existing roles' Recurring and Special Accounts access (steps 1 and 2 of the backfill).
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

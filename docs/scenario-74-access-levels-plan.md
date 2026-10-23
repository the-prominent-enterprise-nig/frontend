# Scenario 74 — Access Levels (client sheet → roles)

Source: the client's "NIG Central ERP: Access Levels" Google Sheet (Access Levels, Approvals and Email tabs).
Roles are defined once in `backend/prisma/access-level-roles.ts` and used by both `prisma/seed.ts` and `scripts/backfill-access-level-roles.ts`.

## Part 1 — roles and permissions (this branch)

The sheet's 254 rows group into 21 distinct permission sets. Each set is one role, named for its function rather than the client's job title. People are assigned to roles; no role is made per person.

**Role names below are proposals for Chloe to approve.**

| Proposed role       | Sheet code(s)                               | Sheet people                                                |
| ------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| Finance Head        | HOG_AF_01                                   | Glory, Sam                                                  |
| Expense Clerk       | HOG_AC_01                                   | Rhea, Pearlyn                                               |
| Liquidation Clerk   | HOG_AC_02                                   | Jenny                                                       |
| Deposit Clerk       | HOG_AC_03                                   | Sweden, Neil, Angel, Sarah, Jessica                         |
| Bank Clerk          | HOG_AC_04                                   | Danica                                                      |
| Payables Clerk      | HOG_FC_01                                   | Cathleen, Dessah                                            |
| Treasury Clerk      | HOG_FC_02                                   | Aleah, Angeline                                             |
| Inventory Manager   | HOG_IH_01                                   | Rhia, Christian, Ivie, Azraf                                |
| Stock Clerk         | HOG_IC_01                                   | Rose, Karyl, Yul, Matt, Krisha                              |
| Sales Admin         | HOG_SAC_01                                  | Pinky, Francis, Queenie, Romulo, Miechie, Juvy              |
| AR Supervisor       | HOG_ARH_01                                  | Kenneth, Judelyn                                            |
| Sales Support       | HOG_ARC_01, HOG_AS_01, HOG_EH_01, HOG_EC_01 | AR clerks, area supervisors, EDP head and clerks            |
| Branch Support      | HOG_MKTG_01 (head and clerk), HOG_BRSUP_01  | Kristal, Alex, Mariel, Ghislain, Donna, Justine, Cano, Paul |
| Aircon Staff        | HOG_PACMAN_01, HOG_ASC_01                   | Rizalie, Joy, Angela, Faith, Kristine, Lito                 |
| Aircon Clerk        | HOG_ASC_02                                  | Lowella                                                     |
| HR Officer          | HOG_HR_01                                   | Thea, Lucky                                                 |
| Service Coordinator | HOG_REP_01                                  | Gillie, Phealyn                                             |
| Receptionist        | BG_BR_01 (Branch Receptionist)              | All branch receptionists                                    |
| Custodian           | BG_BR_03                                    | All branch custodians                                       |
| Collector           | BG_BR_02                                    | All branch collectors                                       |
| Warehouse Custodian | BG_BR_04                                    | All warehouse custodians                                    |

Branch Manager and Cashier (BG_BR_01) keep their existing roles **unchanged**. See "Conflicts" below.

### New permissions

Three sheet features had no permission of their own, so the sheet couldn't be followed without adding one:

| Permission                                                  | Used to be gated by              | Why split                                                                                                 |
| ----------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `accounting:recurring-expenses:{read,create,update,delete}` | `accounting:expense:*`           | Branch staff and Lowella get Expenses without Recurring                                                   |
| `accounting:special-accounts:{read,create}`                 | `accounting:expense:read/create` | Danica and HR get Special Accounts without Expenses; Deposit Clerk gets Expenses without Special Accounts |
| `pos:catalog:read`                                          | `pos:transactions:read`          | Inventory roles get Product Catalog without the rest of POS                                               |

No existing role loses access:

- The backfill gives every role that held `accounting:expense:<action>` the matching new permission, and gives the Business Owner all of them.
- The seed grants the same to Branch Manager, and Accountant's `accounting:*` covers it.
- `pos/catalog` accepts either permission, so nothing that read it before is cut off.
- The Special Accounts register still accepts `expense:read`, because the Expense form's picker reads it.

### Decisions made here (please confirm)

1. **"POS ALL" leaves out what the client already ruled on.** Approving a credit application stays Business Owner only (2026-09-18), and only Accounting deposits cash (Scenario 53). It also excludes `pos:cash-in-transit:manage`, except for Deposit Clerk, whose "Undeposited" row is explicit.
2. **Branch staff get POS the way Cashier does.** Receptionist, Custodian and Collector don't get `pos:transaction:override` or `pos:reports:read`.
3. **"Stock Transaction ALL" doesn't include approval steps** for Employee-tier roles. That covers stock-adjustment confirm, investigate and approve; PO approve; DR approve and void; transfer manager/HQ approve and direct; and supplier-return approve, finalize and void. This is the same line Stock Controller is drawn with.
4. **Inventory Manager** gets all of Inventory except investigating or approving a stock adjustment and manual RR (owner only), the same exclusions as Branch Manager. It **does** approve Delivery Receipts, per the Approvals tab.
5. **Grants are concrete permission rows, never wildcard rows.** A permission added later doesn't reach these roles by itself.

## Questions for the client

- The Approvals tab says the "Department Head Group" can approve Delivery Receipts. Rizalie (Aircon Department Head) shares a permission set with the Aircool staff. Should Rizalie get a separate role that can approve DRs?
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

| Restriction                    | Roles                                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bank accounts                  | Expense Clerk (Rhea, Pearlyn): Revolving Fund Panay and Construction Panay only. Liquidation Clerk (Jenny): Palawan (BDO) and GCash (Corporate) only                                    |
| Special Accounts by GL code    | Jenny: 1-01-320, 1-01-321, 1-01-323 · Danica: 1-01-321, 1-01-323 · Cathleen and Dessah: 1-03-010, 1-03-020, 1-03-021, 1-03-022, 1-03-030, 1-03-040, 1-03-060 · HR: 1-01-320 to 1-01-323 |
| Expense "Paid From" petty cash | Receptionist and branch staff: their own branch's petty cash · Lowella: Petty Cash - Aircool                                                                                            |
| Acknowledgment receipt only    | Treasury Clerk on POS › New Receipts                                                                                                                                                    |
| No item cost                   | Branch roles, Warehouse Custodian, and Service Coordinator on Stock Ledger                                                                                                              |

**Proposal:**

- **One table, `RoleScope`.** Columns: `roleId`, `kind` (`bank-account` | `gl-account` | `petty-cash`), `targetId`, and `targetBranchScoped` (bool, meaning "the user's own branch"). One allow-list mechanism covers the first three rows.
  - A role with no rows of a kind is unrestricted for that kind.
  - A role with rows is limited to them, and the union across the user's roles applies.
  - Per role, not per user. The clerks differ in their allow-lists as well as their permissions, so they're already separate roles.
- **A `ScopeService.allowed(user, kind)`** returns `null` (unrestricted) or a set of IDs. It's enforced in the services on list, detail and every write, mirroring the `actorBranchId` pattern in `transfers.service`. A write against an ID outside the set gets a 403, and lists filter to the set.
- **Acknowledgment-only:** a new `pos:acknowledgement-receipts:create` permission. New Receipts accepts either it or `pos:collections:manage`, and the receipt-type picker shows only Acknowledgment for the narrow permission. No allow-list needed.
- **No item cost:** strip the cost fields from the stock-balance, stockbook and transaction API responses when the caller lacks `inventory:costing:read`. Hiding them in the frontend isn't enough. Part 1 already withholds `costing:read` and `receive:cost-view` from these roles.
- **UI:** a full page under Settings › Roles & Access › (role) › Scopes, using `SearchableSelect`. No modals.

**Found while writing the e2e spec:** the Stock Ledger tabs read `GET /inventory/stock/balances` and `GET /inventory/serial-numbers`, which have no `@RequirePermissions` at all. Any signed-in user can read stock balances and serials, so "No Access" on Inventory (Finance Head) doesn't fully hold, and `inventory:stock:read` isn't checked anywhere in the backend. Gating them on `inventory:stock:read` / `inventory:serial:read` belongs in Part 2, with the no-item-cost stripping, since both touch the same responses. The spec carries it as a `todo`.

## Rollout

- **Fresh environments:** `prisma db seed` creates everything. **Never on staging or prod** — it wipes the data.
- **Existing environments:**
  ```
  npx ts-node -r tsconfig-paths/register scripts/backfill-access-level-roles.ts           # dry run
  npx ts-node -r tsconfig-paths/register scripts/backfill-access-level-roles.ts --apply
  ```
  The script is additive and checks every role before writing. If a permission it needs is missing (e.g. `backfill-delivery-receipt-permissions.ts` never ran), it stops without writing anything and names the missing ones.
- **Assigning people to roles:** `scripts/assign-access-level-roles.ts --csv <Email tab CSV>` (dry run, `--apply` to write). It finds each person by email and adds the role their code maps to; BG_BR_01 is told apart by Position. It never creates accounts, removes roles or changes branches, and it reports people with no account, a leftover role, or a branch that doesn't match the sheet. All 98 rows map to a role. None of the 98 emails has an account in the local (staging-copy) DB, so they have to be invited first.
- **E2E:** `test/access-level-roles.e2e-spec.ts` covers 12 roles (allowed, denied, and other-branch denied) and checks that Branch Manager and Accountant keep Recurring and Special Accounts. 76 pass, plus 1 `todo` for the ungated Stock Ledger reads.

# Seed Data Reference — TechNova (dev database)

Living reference doc for manually testing against the current dev database. Not committed (matches `pos-installment-plan.md`'s treatment) — regenerate/update this by hand if the seed changes.

Single tenant seeded: **TechNova Systems Inc.** (`technova`) — **39 real operational branches** (type `office`, split across the `negros` and `panay` regions) plus **2 real warehouses** (`Negros Warehouse` / `WH-NEGROS`, `Panay Warehouse` / `WH-PANAY`). Every one of these 41 branches has its own full set of seeded human test accounts — see "Accounts" below.

## Logging in

Two ways to log in as any seeded user below:

1. **Real Auth0 login** — password `Test@1234`. (Not currently working in this dev setup — confirmed failing with "Wrong email or password" earlier this session; real login goes through Auth0 and these accounts may not be provisioned there.)
2. **Dev bypass** (what actually works locally) — enter the user's email, and for the password use the `DEV_API_KEY` value from `backend/.env`:
   ```
   dev-prominent-enterprise-2026
   ```
   This only works when `NODE_ENV !== production` (`backend/src/auth/auth.service.ts::login()`).

Cashier PIN (for cashier-PIN-gated actions like manager overrides/approvals): **`1234`** for every cashier account.

## Accounts (users)

> **Note (2026-08-08, corrected 2026-08-14, corrected again same day):** this
> table used to show 3 placeholder branches (**Manila HQ / Cebu Office / Davao
> Branch**) that don't exist anymore — the live dev DB has 41 real branches
> (39 real operational + 2 real warehouses). A first pass fixed the branch
> _names_ (Manila HQ → Bago, Cebu Office → Binalbagan, Davao Branch → Candoni)
> but still wrongly claimed only those 3 of the 41 branches have seeded
> accounts. A full DB query found that's wrong too: **every one of the 41
> branches has its own complete 7-role account set** — this was already true
> all along, the doc just never reflected it. See the full `bN` → branch
> mapping below.
>
> **Name values are Faker-generated per seed run and effectively random** —
> don't rely on them for anything (a prior version of this table had Name/Role
> pairings that had drifted from what the live DB actually has attached to
> each email). Only email, role, and branch are meaningful and stable.
>
> **Note (2026-08-08, merge from development, resolved):** development
> independently seeded a role literally named `Inventory` (b1/b2/b3.
> inventory@test.com) with real users, distinct from the `inventory`
> legacy slug this branch already purges. Checked directly against this
> environment's DB post-merge: neither the `Inventory` role, its
> `RolePermission` rows, nor its 3 seeded users exist here at all — this
> dev DB never ran development's seed. The merged `prisma/seed.ts` source
> also no longer creates the role (its `role.upsert` call didn't survive
> the merge, only its permission grant did, which was already dropped as
> redundant — `Stock Controller`'s `inventory:*` wildcard is a strict
> superset of what `Inventory` granted). So there was nothing to reassign
> or purge; the 3 rows below have been removed as inapplicable to this
> environment. Same applies to Credit Investigator's b1/b2/b3.
> investigator@test.com — merged into the role/permission model, but not
> yet seeded as real users here.

**Pattern:** every branch-scoped account is `technova.b{N}.{role}@test.com`,
where `N` is 1–41 (see mapping below) and `role` is one of `manager`,
`accounting`, `stock`, `approver`, `investigator`, `cashier`, `crm`. That's
41 branches × 7 roles = 287 branch-scoped accounts, plus 4 branchless Head
Office role accounts + 1 Business Owner = **292 accounts total**.

### `bN` → real branch mapping

| bN  | Branch                | Region | Type          |
| --- | --------------------- | ------ | ------------- |
| b1  | Bago                  | negros | office        |
| b2  | Binalbagan            | negros | office        |
| b3  | Candoni               | negros | office        |
| b4  | Canlaon               | negros | office        |
| b5  | Cauayan               | negros | office        |
| b6  | Don Salvador          | negros | office        |
| b7  | Guihulngan            | negros | office        |
| b8  | Hinobaan              | negros | office        |
| b9  | Kabankalan            | negros | office        |
| b10 | Mabinay               | negros | office        |
| b11 | Murcia                | negros | office        |
| b12 | Sagay                 | negros | office        |
| b13 | San Carlos            | negros | office        |
| b14 | San Sebastian         | negros | office        |
| b15 | Sipalay               | negros | office        |
| b16 | Talisay               | negros | office        |
| b17 | Tanjay                | negros | office        |
| b18 | Victorias             | negros | office        |
| b19 | NWHSE                 | negros | **warehouse** |
| b20 | Ajuy                  | panay  | office        |
| b21 | Alimodian             | panay  | office        |
| b22 | Antique               | panay  | office        |
| b23 | Balasan               | panay  | office        |
| b24 | Banate                | panay  | office        |
| b25 | Barotac Nuevo         | panay  | office        |
| b26 | Caticlan              | panay  | office        |
| b27 | Culasi                | panay  | office        |
| b28 | GT                    | panay  | office        |
| b29 | Guimaras - Buenavista | panay  | office        |
| b30 | Guimaras - Jordan     | panay  | office        |
| b31 | Guimbal               | panay  | office        |
| b32 | Kalibo                | panay  | office        |
| b33 | Lambunao              | panay  | office        |
| b34 | Mabini                | panay  | office        |
| b35 | Miag-ao               | panay  | office        |
| b36 | Pandan                | panay  | office        |
| b37 | Passi                 | panay  | office        |
| b38 | Pototan               | panay  | office        |
| b39 | Roxas                 | panay  | office        |
| b40 | San Rafael            | panay  | office        |
| b41 | PWHSE                 | panay  | **warehouse** |

`b19`/`b41` (NWHSE/PWHSE) are the tenant's 2 real standalone warehouses — they
still carry a full 7-role account set as a legacy artifact from before the
"warehouse tier correction" project split Warehouse from Branch; nothing in
the app currently expects a Branch Manager/Cashier/etc. at a warehouse, so
these specific accounts are unlikely to be useful for real testing, but they
do exist and will log in.

### Worked example: `b1`/`b2`/`b3` (the branches most other docs/tests reference)

One Business Owner (no branch, sees everything) + 7 roles × 3 branches shown
here + 4 branchless Head Office roles (below) + 280 more branch accounts
following the same pattern for `b4`–`b41` = 292 accounts total.

| Email                               | Name               | Role                 | Branch           | Region |
| ----------------------------------- | ------------------ | -------------------- | ---------------- | ------ |
| `technova.owner@test.com`           | Darrin Kassulke    | **Business Owner**   | — (all branches) | —      |
| `technova.b1.manager@test.com`      | Jenna Hahn         | Branch Manager       | Bago             | negros |
| `technova.b1.accounting@test.com`   | Alayna Champlin    | Accountant           | Bago             | negros |
| `technova.b1.stock@test.com`        | Nicolas Quitzon    | Stock Controller     | Bago             | negros |
| `technova.b1.approver@test.com`     | Shane Cormier      | Master Data Approver | Bago             | negros |
| `technova.b1.investigator@test.com` | Ronaldo Armstrong  | Credit Investigator  | Bago             | negros |
| `technova.b1.cashier@test.com`      | Bernard Hettinger  | Cashier              | Bago             | negros |
| `technova.b1.crm@test.com`          | Darren Gusikowski  | Marketing Manager    | Bago             | negros |
| `technova.b2.manager@test.com`      | Tyrell Buckridge   | Branch Manager       | Binalbagan       | negros |
| `technova.b2.accounting@test.com`   | Terri Lynch        | Accountant           | Binalbagan       | negros |
| `technova.b2.stock@test.com`        | Jay Bechtelar      | Stock Controller     | Binalbagan       | negros |
| `technova.b2.approver@test.com`     | Shari Parker       | Master Data Approver | Binalbagan       | negros |
| `technova.b2.investigator@test.com` | Quentin Hudson     | Credit Investigator  | Binalbagan       | negros |
| `technova.b2.cashier@test.com`      | Dennis Heidenreich | Cashier              | Binalbagan       | negros |
| `technova.b2.crm@test.com`          | Dallas Tillman     | Marketing Manager    | Binalbagan       | negros |
| `technova.b3.manager@test.com`      | Shelia Yost        | Branch Manager       | Candoni          | negros |
| `technova.b3.accounting@test.com`   | Vernie Carroll     | Accountant           | Candoni          | negros |
| `technova.b3.stock@test.com`        | Bethany Mann       | Stock Controller     | Candoni          | negros |
| `technova.b3.approver@test.com`     | Cristian MacGyver  | Master Data Approver | Candoni          | negros |
| `technova.b3.investigator@test.com` | Meredith Feest     | Credit Investigator  | Candoni          | negros |
| `technova.b3.cashier@test.com`      | Coby Satterfield   | Cashier              | Candoni          | negros |
| `technova.b3.crm@test.com`          | Valerie Pfeffer    | Marketing Manager    | Candoni          | negros |

Need a specific account for `b4`–`b41`? Same pattern, same 7 roles — query
`User.email` starting with `technova.b{N}.` or just log in directly, you don't
need the Name/table entry to do that (see "Logging in" above).

### Head Office accounts (added 2026-08-08)

Same role as their branch-scoped counterparts above — no new roles, just no
branch assigned (no `Employee` record at all, same shape as Business Owner).
Branch-scoping treats a branchless caller as "no filter," so these see every
branch's data within their one module, e.g. Head Office Accountant sees
every branch's journal entries but nothing outside Accounting.

| Email                          | Name          | Role              | Sees                                 |
| ------------------------------ | ------------- | ----------------- | ------------------------------------ |
| `technova.accounting@test.com` | Jasper Rempel | Accountant        | All branches, Accounting module only |
| `technova.stock@test.com`      | Irma Daniel   | Stock Controller  | All branches, Inventory module only  |
| `technova.cashier@test.com`    | Malcolm Moore | Cashier           | All branches, POS module only        |
| `technova.crm@test.com`        | Fred Murray   | Marketing Manager | All branches, CRM module only        |

**Business Owner bypasses every permission check** (`hasPrivilegedRole` short-circuit) — use it for anything without worrying about role gates.

There's also a platform-level super admin, `dev@prominent.com` — unrelated to this tenant's day-to-day testing (no tenant login, manages enterprises).

## Branches / Warehouses / Terminals

| Branch     | Code | Warehouse | POS Terminal |
| ---------- | ---- | --------- | ------------ |
| Bago       | MNL  | WH-01     | TN-B1-01     |
| Binalbagan | CBU  | WH-02     | TN-B2-01     |
| Candoni    | DVO  | WH-03     | TN-B3-01     |

(Branch names above updated to match the corrected account table — same `b1`/`b2`/`b3` accounts, same `WH-01`/`WH-02`/`WH-03` + `TN-B1-01`/`TN-B2-01`/`TN-B3-01` identifiers the Serial numbers section below still references. Note the tenant's real warehouse structure is now regional — 2 warehouses total, `WH-NEGROS`/`WH-PANAY` — not one per branch; this `WH-01`/`WH-02`/`WH-03` mapping is legacy Phase 1/2 demo-data scaffolding kept as-is here since the sections below still key off these specific codes.)

One warehouse per branch, resolved automatically by branch when opening a POS session — you don't need to pick a warehouse manually.

## Serial numbers — what's actually registered right now

| Item SKU            | Name                     | Serial-tracked? | Dual-serial? | Registered serials                                                                                                                 |
| ------------------- | ------------------------ | --------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `TN-REF-001`        | Refrigerator             | Yes             | No           | **None** — 0 serials registered. Can't currently be sold at POS (checkout requires picking a serial, and there's nothing to pick). |
| `TN-WM-001`         | Washing Machine          | Yes             | No           | **None** — same as above.                                                                                                          |
| `TN-FURN-SET-001`   | TV Console Furniture Set | Yes             | No           | **6 total, all `in_stock`** — see table below. Added this session as the furniture-set/kit demo (see "Phase 2 demo data").         |
| `TN-AC-SPLIT-1_5HP` | Split-Type Aircon 1.5HP  | Yes             | **Yes**      | **6 total, all `in_stock`** — see table below. Added this session as the dual-serial demo.                                         |

### Furniture Set serials (`TN-FURN-SET-001`)

| Serial Number       | Status   | Warehouse | Branch |
| ------------------- | -------- | --------- | ------ |
| `FURNSET-WH-01-001` | in_stock | WH-01     | MNL    |
| `FURNSET-WH-01-002` | in_stock | WH-01     | MNL    |
| `FURNSET-WH-02-001` | in_stock | WH-02     | CBU    |
| `FURNSET-WH-02-002` | in_stock | WH-02     | CBU    |
| `FURNSET-WH-03-001` | in_stock | WH-03     | DVO    |
| `FURNSET-WH-03-002` | in_stock | WH-03     | DVO    |

If you want to test the **branch-scoped serial rejection** (Phase 2b), you now have real cross-branch data to try it with: open a session on, say, Bago's terminal (`TN-B1-01`), and if you register/move a serial into WH-02 or WH-03 instead, it should be rejected as "in stock at a different branch."

### Aircon dual-serial pairs (`TN-AC-SPLIT-1_5HP`)

One indoor + one outdoor serial per branch — checkout will prompt for both, in order (primary/indoor first, then secondary/outdoor):

| Branch | Indoor serial         | Outdoor serial         |
| ------ | --------------------- | ---------------------- |
| MNL    | `AC-INDOOR-WH-01-001` | `AC-OUTDOOR-WH-01-001` |
| CBU    | `AC-INDOOR-WH-02-001` | `AC-OUTDOOR-WH-02-001` |
| DVO    | `AC-INDOOR-WH-03-001` | `AC-OUTDOOR-WH-03-001` |

If `TN-REF-001`/`TN-WM-001` need to be sellable for some other test, register serials for them via `POST /inventory/serial-numbers` (`{ itemId, warehouseId, serialNumbers: [...] }`) — same endpoint the Item Master's serial registration UI calls.

## Phase 2 demo data

Part of the official seed now — `seedFurnitureAndAirconDemo()` in `backend/prisma/seed.ts`, called from `main()` right after `seedPos(...)`. Running `npm run seed` (a full reseed) regenerates this automatically; it's no longer a separate side script.

### Furniture Set / kit

| Item                     | SKU                   | Role                                                | Stock                                |
| ------------------------ | --------------------- | --------------------------------------------------- | ------------------------------------ |
| TV Console Furniture Set | `TN-FURN-SET-001`     | The bundle (`isBundle` + `isSerialTracked`), ₱5,800 | See serials above                    |
| TV Stand                 | `TN-FURN-TVSTAND-001` | Component — 1 per set                               | 20 units in every branch's warehouse |
| Side Cabinet             | `TN-FURN-CABINET-001` | Component — 2 per set                               | 20 units in every branch's warehouse |

Both components are also independently sellable on their own (not locked to the bundle).

### Aircon dual-serial

| Item                                       | SKU                 | Role                                                   |
| ------------------------------------------ | ------------------- | ------------------------------------------------------ |
| Split-Type Aircon 1.5HP (Indoor + Outdoor) | `TN-AC-SPLIT-1_5HP` | `isSerialTracked` + `requiresSecondarySerial`, ₱26,500 |

Selling it prompts for the indoor serial first, then automatically re-opens the picker for the outdoor serial — see serial pairs above.

**Note:** this data is currently in the live dev DB from when it was still a standalone script (now removed, folded into `seed.ts` instead) — a full `npm run seed` hasn't been run since integrating it, since that wipes the entire database (including your manually-created "Chloe Belle" customer and everything else) and I didn't want to do that without asking first. The logic is a faithful port of the already-proven standalone scripts, verified via `tsc`/`eslint`, but not yet exercised end-to-end via an actual `npm run seed` run.

## Phase 1 data

Phase 1 (CRM Add Customer) didn't add persistent seed data — it's a capability, not demo data, and the automated e2e coverage (`crm-add-customer.spec.ts` / backend e2e specs) creates and deletes its own throwaway customers per run.

One real leftover from manual testing during Phase 1 exists in the database — not seeded, created through the actual UI:

| Customer Code | Name        | Type       | Email           | Payment Terms |
| ------------- | ----------- | ---------- | --------------- | ------------- |
| `CUS-L9TAWW`  | Chloe Belle | Individual | chloe@gmail.com | Annual        |

(One other leftover, an orphaned customer from an earlier flaky e2e run — `CUS-A2TRST`, missing its first name due to the hydration-race bug fixed since — was cleaned up while putting this doc together.)

## General CRM/AR seed data (not phase-specific)

The base seed also includes ~19 regular AR/CC customers (`TN-AR-001`–`TN-AR-008`, `TN-CC-001`–`TN-CC-00N`, etc.) and 4 sales agents — generic demo data for the CRM/Accounting modules, unrelated to any specific phase. Browse them under CRM → Customers / Sales Agents if you need generic-looking data for something.

## Known backend e2e test fixtures (not for manual testing)

These items exist only because Jest e2e specs upsert them as fixtures and deliberately leave them behind between runs (an item can't be deleted once it has ledger history). They were cluttering the real POS catalog, so they've been set to `lifecycle: 'archived'` — the e2e specs themselves don't care about lifecycle (they POST directly to the API with a known itemId, never through the catalog), so this is safe and won't break any test. They have 0 registered serials right now anyway since each spec's own serials get cleaned up in `afterAll`.

If they ever reappear in the catalog (e.g. a future e2e spec change resets `lifecycle` back to `active` on upsert), just re-run:

```sql
UPDATE items SET lifecycle = 'archived' WHERE sku LIKE 'E2E%';
```

- `E2E-SERIAL-ITEM`, `E2E-DUAL-SERIAL-ITEM` (from `pos-serial-branch-scoping.e2e-spec.ts`)
- `E2E-RFD-SERIAL-ITEM` (from `pos-release-form-request.e2e-spec.ts`)
- `E2E-COGSCIT-WAC-ITEM` (from `pos-gl-cogs-cit.e2e-spec.ts`)
- `E2E-RR-ITEM` (from `pos-return-refund-request.e2e-spec.ts`)
- `E2E-SD-ITEM-A`, `E2E-SD-ITEM-B`, `E2E-AIRCOOL-UNIT` (from `aircool.e2e-spec.ts`)

**Branch**: `aircool.e2e-spec.ts` (Aircool scenario, Parts 1 & 2) also leaves behind a real Branch fixture, `E2E Aircool — Branch` (code `E2E-AIRCOOL-BR`) — its Warehouse has real `StockLedger` rows from the spec's actual stock deductions/restocks, so unlike a Branch/Warehouse/Terminal set from other specs (see `pos-serial-branch-scoping.e2e-spec.ts`'s own cleanup, which fully deletes its fixtures since its sales never reach real deduction), this one can't be deleted once the spec has run. Set to `status: 'inactive'` / `isActive: false` so it's honestly labeled, though note **`GET /branches` does not currently filter by active status** (unlike the item catalog's `lifecycle` filtering) — this branch will still appear in branch pickers everywhere until that's fixed, if ever. If it ever reappears as `active` (e.g. a future spec change resets it on upsert), re-run:

```sql
UPDATE branches SET status = 'inactive', "isActive" = false WHERE code = 'E2E-AIRCOOL-BR';
```

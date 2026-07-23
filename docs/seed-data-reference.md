# Seed Data Reference — TechNova (dev database)

Living reference doc for manually testing against the current dev database. Not committed (matches `pos-installment-plan.md`'s treatment) — regenerate/update this by hand if the seed changes.

Single tenant seeded: **TechNova Systems Inc.** (`technova`), 3 branches.

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

One Business Owner (no branch, sees everything) + 5 roles per branch × 3 branches = 16 accounts total.

| Email                             | Name             | Role               | Branch             |
| --------------------------------- | ---------------- | ------------------ | ------------------ |
| `technova.owner@test.com`         | Darrin Kassulke  | **Business Owner** | — (all branches)   |
| `technova.b1.manager@test.com`    | Jasper Rempel    | Branch Manager     | Manila HQ (MNL)    |
| `technova.b1.accounting@test.com` | Fred Murray      | Accountant         | Manila HQ (MNL)    |
| `technova.b1.stock@test.com`      | Jenna Hahn       | Stock Controller   | Manila HQ (MNL)    |
| `technova.b1.cashier@test.com`    | Tyrell Buckridge | Cashier            | Manila HQ (MNL)    |
| `technova.b1.crm@test.com`        | Shelia Yost      | Marketing Manager  | Manila HQ (MNL)    |
| `technova.b2.manager@test.com`    | Irma Daniel      | Branch Manager     | Cebu Office (CBU)  |
| `technova.b2.accounting@test.com` | Bette Little     | Accountant         | Cebu Office (CBU)  |
| `technova.b2.stock@test.com`      | Janis Langosh    | Stock Controller   | Cebu Office (CBU)  |
| `technova.b2.cashier@test.com`    | Lexus Boehm      | Cashier            | Cebu Office (CBU)  |
| `technova.b2.crm@test.com`        | Corey Torp       | Marketing Manager  | Cebu Office (CBU)  |
| `technova.b3.manager@test.com`    | Malcolm Moore    | Branch Manager     | Davao Branch (DVO) |
| `technova.b3.accounting@test.com` | Adriana Cronin   | Accountant         | Davao Branch (DVO) |
| `technova.b3.stock@test.com`      | Emmalee Howell   | Stock Controller   | Davao Branch (DVO) |
| `technova.b3.cashier@test.com`    | Flo Jacobi       | Cashier            | Davao Branch (DVO) |
| `technova.b3.crm@test.com`        | Flavio Pouros    | Marketing Manager  | Davao Branch (DVO) |

**Business Owner bypasses every permission check** (`hasPrivilegedRole` short-circuit) — use it for anything without worrying about role gates.

There's also a platform-level super admin, `dev@prominent.com` — unrelated to this tenant's day-to-day testing (no tenant login, manages enterprises).

## Branches / Warehouses / Terminals

| Branch       | Code | Warehouse | POS Terminal |
| ------------ | ---- | --------- | ------------ |
| Manila HQ    | MNL  | WH-01     | TN-B1-01     |
| Cebu Office  | CBU  | WH-02     | TN-B2-01     |
| Davao Branch | DVO  | WH-03     | TN-B3-01     |

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

If you want to test the **branch-scoped serial rejection** (Phase 2b), you now have real cross-branch data to try it with: open a session on, say, Manila's terminal (`TN-B1-01`), and if you register/move a serial into WH-02 or WH-03 instead, it should be rejected as "in stock at a different branch."

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

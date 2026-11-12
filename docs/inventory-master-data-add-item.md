# Inventory — Add Item from Master Data (2026-11-12)

Ticket: _"As a Stock Controller, I should add new items from Inventory → Master Data instead of from Item Master"_ (filed by Belle, 2026-11-12).
Branches: `feat/inventory-master-data-add-item` in both repos.

## What changed for users

### Adding an item

- **Where:** Inventory → Master Data → **Add Item**, the hub's first tab. It replaced the Add Item button on Item Master's tab strip.
- **Shape:** the form sits inline in the tab, the same way Stock Transaction → Stock Request works, and uses the same visual style. There's no Cancel. A successful save shows a toast and clears the form for the next item.
- **Who sees it:** anyone with `inventory:items:create` — Business Owner, Executive, Department Head, Inventory OIC, Stock Controller, Branch Manager and **Branch Custodian** (new, see Permissions). The Warehouse Custodian does not.

### Approval

- **A new item is approved on save.** `POST /inventory/items` sets `approvalStatus = approved` and records the creator as the approver. It starts with no stock, so the Scenario 16 chain is skipped. The form's header says so.
- **The Scenario 16 chain (draft → Accounting confirmation → Master Data Approver) still applies** to items that land as drafts: **bulk CSV import**, and an item edited after a **rejection**.

### Form fields

| Card                     | Fields                                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basic Info               | Item Name*, SKU*, Unit of Measure*, Type*, **Category\*** + **Subgroup\*** (two pickers), **Brand\***, **Model Number\***, Description                                     |
| Pricing                  | Cost Price\*, **Selling Price** (Item Master's Price column)                                                                                                               |
| Tracking                 | Serial Tracking, Dual Serial, Bundle Item, Service Item                                                                                                                    |
| Initial Stock (optional) | **Warehouse**, Date In, RR #, **Origin** (supplier list or `WHSE`), **Unit Cost**, **Classification** (Brand New / Repair / Repo / Return), Serial Number. Open by default |
| Images                   | Item images                                                                                                                                                                |

- **Item Name fills itself in** as Brand + Category + Model, matching how the ledgers title an item. Typing your own name stops it; clearing the box hands it back.
- **Brand and Model are required** except for service items.
- **Subgroup is required** when the chosen Category has subgroups. The item is filed under the Subgroup (`primaryCategoryId`), or under the Category when it has none.
- **Removed:** Batch and Expiry tracking (unused anywhere; still saved as off), Physical Dimensions, Warranty, Tags.
- **Origin** used to be free text that created a supplier from whatever was typed. It's now a list of suppliers on file, plus `WHSE` for internal stock.
- **Classification** is saved as the unit's `SerialNumber.receivedAs`, so it shows correctly in the General Stockbook.

### Stock Balance

- **Items with no stock now appear**, at 0, with an "Out of Stock" status. That covers new items and any approved, active, non-service item never received.
- They appear **only when no branch, region or warehouse filter is set**. A never-stocked item sits in no location.
- General Stockbook and Serial Number Locator list units (serials), so a 0-stock item doesn't appear there until something is received.

### Getting stock onto a 0-stock item

- **Branch staff:** Stock Balance → click the item → **Stock Request**. It opens Stock Transaction → Stock Request with the item on the first line.
- **Warehouse / head office:** Stock Transaction → Receiving Report → New, when the delivery arrives.
- **A receipt with no PO and no reason can only go into Panay or Negros Warehouse.** The backend already refused a branch location without a PO raised for that branch (Scenario 27). The form now lists only the two warehouses in that case, with a tooltip on Location, so the error can't come up. Linking a PO for a branch, or setting a reason (repair, repo, return), brings branches back.
- The item panel no longer has a **Receive Stock** button. Receiving starts from the delivery's paperwork in Stock Transaction.

### Fixes along the way

- **Item panel showed "Out of Stock" for a branch user** while the list said In Stock. Its stock query didn't ask for every branch, so the backend narrowed it to the user's own branch. It now sends `allBranches: true`, as the list does.
- **The receiving report's Location list was empty for a branch user**, for the same reason. It now loads every location; the form and backend still decide which ones a receipt may use.
- **Labels in the receiving delivery panel** now sit directly above their boxes instead of across a gap when a neighbouring field makes the row taller.
- **The shared search box** (`SearchCombobox`) now shows the label for a value set by code after it mounted. It only fills a blank label, never replaces a picked one.

## Permissions

The Branch Custodian gains, in `backend/prisma/access-level-roles.ts` (`BRANCH_CUSTODIAN_ADD_ITEM`) and migration `20261112100000_access_level_branch_custodian_add_item`:

- `inventory:items:create` — the Add Item tab and recording initial stock
- `inventory:suppliers:read` — the Origin supplier list
- `files:files:create` — item image upload

Editing, approving and managing brands/types stay out. The Branch Custodian is otherwise "without item cost", but enters Cost Price and Unit Cost on this form; that was confirmed as acceptable.

## Where the code is

| Area                              | Frontend                                                                                                                                      | Backend                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Add Item tab                      | `inventory/master-data/_components/MasterDataHub.tsx`, `inventory/items/_components/AddItemTab.tsx`                                           | —                                                                        |
| Form                              | `items/_components/CreateItemModal.tsx`, `item-create-fields.tsx`, `itemFormChrome.ts`, `item-form-shared.tsx` (`FormSection variant="card"`) | —                                                                        |
| Schema                            | `src/schema/inventory/items/index.ts`                                                                                                         | `inventory/dto/serialized-import.dto.ts` (`classification`)              |
| Approve on save                   | —                                                                                                                                             | `inventory/services/items.service.ts` `create()`                         |
| Initial stock classification      | `items/_actions/receive-initial-unit.ts`                                                                                                      | `inventory/services/serialized-import.service.ts` `receiveInitialUnit()` |
| 0-stock rows                      | —                                                                                                                                             | `inventory/services/stock.service.ts` `zeroStockItemRows()`              |
| Stock Request from the item panel | `components/inventory/item-360/Item360Drawer.tsx`, `transfers/_components/StockRequestTab.tsx`                                                | —                                                                        |
| Receiving locations               | `goods-receiving/_components/ReceivingReportsTab.tsx`, `create-rr/RrDeliveryPanel.tsx`, `ReceiveStockModal.tsx`                               | —                                                                        |

Frontend paths are under `src/app/(app)/(dashboard)/inventory/` unless they start with `components/` or `src/`. Backend paths are under `backend/src/`.

## Tests

Four backend e2e files changed because a new item is no longer a draft: `item-master-governance`, `accounting-audit-log-inventory-items-governance`, `accounting-audit-log-inventory-items-core`, `notifications-item-master`. Tests that walk the approval chain reset the new item to draft first. They need a seeded database and haven't been run yet.

## Open

- **Editing an item has no visible entry point.** Edit Item lives on the Items list, which is hidden in Item Master (`CatalogHub` `hidden: true`, "moves to POS"); `/inventory/items` still works but has no menu link. The Edit form also still has the single Category picker and the fields removed from Add Item.
- **Should branch staff do no-PO receipts at all?** Today anyone with `inventory:receive:create` can receive a direct delivery into the warehouses, Branch Custodian included.

---
name: project-ux-refactor
description: UX architecture refactor for inventory module — what was designed and what was implemented
metadata:
  type: project
---

Designed and partially implemented a UX architecture refactor for the inventory module (feat/inventory-updates branch).

**Why:** The system was entity-modular (35+ top-level routes) causing heavy context switching. Goal: shift to task-ambient navigation where the right action surfaces in context without requiring module navigation.

**What was designed (full doc in conversation):**

- Entity-centric + workflow overlay hybrid architecture
- Item 360 Drawer (right panel, 5 tabs: overview/stock/movements/batches/planning)
- Workflow engine (multi-step panels replacing modals)
- Command Palette (⌘K global search + navigation)
- Active Operations Bar (persist in-progress sessions)
- Standardized stale times via STALE constants
- Feature flag infrastructure

**What was implemented (Phase 1 — immediate wins + foundation):**

New files created:

- `src/libs/query/stale-times.ts` — STALE constants (REALTIME/OPERATIONAL/LOOKUP/REFERENCE/STATIC)
- `src/libs/flags.ts` — Feature flag system with localStorage override
- `src/stores/ui-shell.store.ts` — Zustand store for panel stack + command palette state
- `src/components/ui/drawer/Drawer.tsx` — Generic drawer component (not yet wired, Item 360 uses its own portal)
- `src/components/inventory/item-360/Item360Drawer.tsx` — Full Item 360 panel with Overview/Stock/Movements tabs
- `src/components/inventory/item-360/hooks/useItem360.ts` — React Query hook (tab-aware lazy loading)
- `src/components/inventory/item-360/tabs/OverviewTab.tsx` — Item metadata, pricing, tracking flags
- `src/components/inventory/item-360/tabs/StockTab.tsx` — Per-warehouse stock with status badges
- `src/components/inventory/item-360/tabs/MovementsTab.tsx` — Stock balance table
- `src/components/shell/CommandPalette.tsx` — ⌘K palette with nav search + live item search
- `src/components/shell/ShellProviders.tsx` — Client component wrapper for dynamic imports (SSR-safe)
- `src/app/(app)/(dashboard)/inventory/items/_actions/get-item.ts` — Single item fetch
- `src/app/(app)/(dashboard)/inventory/stock/_actions/get-item-stock-summary.ts` — Item-specific stock

Modified files:

- `src/app/(app)/layout.tsx` — Mounts ShellProviders (Item360Drawer + CommandPalette)
- `src/components/layout/TopBar.tsx` — Added ⌘K search button
- `src/app/(app)/(dashboard)/inventory/items/_components/ItemMasterTable.tsx` — Row click opens Item 360, ExternalLink button in actions column
- `src/app/(app)/(dashboard)/inventory/goods-receiving/_components/GoodsReceivingList.tsx` — ExternalLink button per row opens Item 360
- `src/app/(app)/(dashboard)/inventory/page.tsx` — Dashboard alert items clickable (opens Item 360), "Receive" action buttons on low-stock + stockout alerts
- `src/app/(app)/(dashboard)/inventory/items/_hooks/useItemMaster.ts` — Uses STALE constants
- `src/app/(app)/(dashboard)/inventory/goods-receiving/_hooks/useGoodsReceiving.ts` — Uses STALE constants, invalidates inventory-item-360 on receive

**Next phases to implement:**

- Phase 2: Workflow panels (Receive Stock multi-step, Transfer workflow)
- Phase 3: Active Operations Bar
- Phase 4: DataTable system with bulk actions + saved filters
- Phase 5: Item 360 Batches + Planning tabs
- Phase 6: Mobile scan-first count interface

**How to apply:** When resuming this work, check the feat/inventory-updates branch and continue from Phase 2.

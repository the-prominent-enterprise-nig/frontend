/**
 * Re-export only. The implementation moved to `components/ui/TabNav` once
 * Accounting started using it too — the "Inventory" in the name described
 * where it was first used, not what it does. Six Inventory hubs still import
 * from here, so the old names stay valid rather than churning them all.
 */
export { TabNav as InventoryTabNav, type NavTab as InventoryTab } from '@/src/components/ui/TabNav'

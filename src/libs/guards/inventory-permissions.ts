export const INVENTORY_PERMISSIONS = {
  // ── Items ──────────────────────────────────────────────────────────────────
  ITEMS_READ: 'inventory:items:read',
  ITEMS_CREATE: 'inventory:items:create',
  ITEMS_UPDATE: 'inventory:items:update',
  ITEMS_DELETE: 'inventory:items:delete',
  ITEMS_MANAGE_LIFECYCLE: 'inventory:items:manage_lifecycle',
  ITEMS_MANAGE_CLASSIFICATION: 'inventory:items:manage_classification',

  // ── Categories ─────────────────────────────────────────────────────────────
  CATEGORIES_READ: 'inventory:categories:read',
  CATEGORIES_CREATE: 'inventory:categories:create',
  CATEGORIES_UPDATE: 'inventory:categories:update',
  CATEGORIES_DELETE: 'inventory:categories:delete',

  // ── Warehouses ─────────────────────────────────────────────────────────────
  WAREHOUSES_READ: 'inventory:warehouses:read',
  WAREHOUSES_CREATE: 'inventory:warehouses:create',
  WAREHOUSES_UPDATE: 'inventory:warehouses:update',

  // ── Units of Measure ───────────────────────────────────────────────────────
  UOM_READ: 'inventory:uom:read',
  UOM_CREATE: 'inventory:uom:create',
  UOM_UPDATE: 'inventory:uom:update',

  // ── Stock ──────────────────────────────────────────────────────────────────
  STOCKS_READ: 'inventory:stock:read',
  STOCKS_CREATE: 'inventory:stock:create',

  // ── Transfers ──────────────────────────────────────────────────────────────
  TRANSFERS_READ: 'inventory:transfers:read',
  TRANSFERS_CREATE: 'inventory:transfers:create',
  TRANSFERS_DISPATCH: 'inventory:transfers:dispatch',
  TRANSFERS_RECEIVE: 'inventory:transfers:receive',

  // ── Write-offs ─────────────────────────────────────────────────────────────
  WRITE_OFFS_READ: 'inventory:write-offs:read',
  WRITE_OFFS_CREATE: 'inventory:write-offs:create',

  // ── Bundles ────────────────────────────────────────────────────────────────
  BUNDLES_READ: 'inventory:bundles:read',
  BUNDLES_CREATE: 'inventory:bundles:create',

  // ── Reports ────────────────────────────────────────────────────────────────
  REPORTS_VALUATION: 'inventory:reports:valuation',
  REPORTS_TURNOVER: 'inventory:reports:turnover',

  // ── Receive (Stock Controller) ─────────────────────────────────────────────
  RECEIVE_READ: 'inventory:receive:read',
  RECEIVE_CREATE: 'inventory:receive:create',

  // ── Stock Count (Stock Controller) ─────────────────────────────────────────
  STOCK_COUNT_READ: 'inventory:stock-count:read',
  STOCK_COUNT_CREATE: 'inventory:stock-count:create',
  STOCK_COUNT_ADJUST: 'inventory:stock-count:adjust',

  // ── Reorder ────────────────────────────────────────────────────────────────
  REORDER_READ: 'inventory:reorder:read',
  REORDER_MANAGE: 'inventory:reorder:manage',

  // ── Batch / Lot ────────────────────────────────────────────────────────────
  BATCH_READ: 'inventory:batch:read',
  BATCH_MANAGE: 'inventory:batch:manage',

  // ── Serial Numbers ─────────────────────────────────────────────────────────
  SERIAL_READ: 'inventory:serial:read',
  SERIAL_MANAGE: 'inventory:serial:manage',

  // ── Unit Document Sheets (UDS) ─────────────────────────────────────────────
  UDS_READ: 'inventory:uds:read',
  UDS_MANAGE: 'inventory:uds:manage',

  // ── Expiry (Stock Controller) ──────────────────────────────────────────────
  EXPIRY_READ: 'inventory:expiry:read',
  EXPIRY_MANAGE: 'inventory:expiry:manage',

  // ── Cycle Count (Stock Controller) ─────────────────────────────────────────
  CYCLE_COUNT_READ: 'inventory:cycle-count:read',
  CYCLE_COUNT_MANAGE: 'inventory:cycle-count:manage',

  // ── Mobile Count (Stock Controller) ────────────────────────────────────────
  MOBILE_COUNT_USE: 'inventory:mobile-count:use',

  // ── Quality Hold ───────────────────────────────────────────────────────────
  QUALITY_HOLD_READ: 'inventory:quality-hold:read',
  QUALITY_HOLD_MANAGE: 'inventory:quality-hold:manage',

  // ── Returns ────────────────────────────────────────────────────────────────
  RETURNS_READ: 'inventory:returns:read',
  RETURNS_CREATE: 'inventory:returns:create',

  // ── Costing ────────────────────────────────────────────────────────────────
  COSTING_READ: 'inventory:costing:read',
  COSTING_CONFIGURE: 'inventory:costing:configure',

  // ── Variants ───────────────────────────────────────────────────────────────
  VARIANTS_READ: 'inventory:variants:read',
  VARIANTS_MANAGE: 'inventory:variants:manage',

  // ── Price Lists (INV-32) ───────────────────────────────────────────────────
  PRICE_LISTS_READ: 'inventory:price-lists:read',
  PRICE_LISTS_CREATE: 'inventory:price-lists:create',
  PRICE_LISTS_UPDATE: 'inventory:price-lists:update',
  PRICE_LISTS_DELETE: 'inventory:price-lists:delete',

  // ── Stock Level Boundaries (INV-33) ────────────────────────────────────────
  STOCK_LEVELS_READ: 'inventory:stock-levels:read',
  STOCK_LEVELS_MANAGE: 'inventory:stock-levels:manage',

  // ── Stock Reservations (INV-35) ────────────────────────────────────────────
  RESERVATIONS_READ: 'inventory:reservations:read',
  RESERVATIONS_CREATE: 'inventory:reservations:create',
  RESERVATIONS_RELEASE: 'inventory:reservations:release',

  // ── Stock Requisitions ─────────────────────────────────────────────────────
  STOCK_REQUISITIONS_READ: 'inventory:stock-requisitions:read',
  STOCK_REQUISITIONS_CREATE: 'inventory:stock-requisitions:create',
  STOCK_REQUISITIONS_APPROVE: 'inventory:stock-requisitions:approve',

  // ── Negative Stock Policy (INV-36) ─────────────────────────────────────────
  NEGATIVE_STOCK_READ: 'inventory:negative-stock:read',
  NEGATIVE_STOCK_CONFIGURE: 'inventory:negative-stock:configure',

  // ── Backorders (INV-37) ────────────────────────────────────────────────────
  BACKORDERS_READ: 'inventory:backorders:read',
  BACKORDERS_CREATE: 'inventory:backorders:create',
  BACKORDERS_UPDATE: 'inventory:backorders:update',

  // ── Barcode Management (INV-39) ────────────────────────────────────────────
  BARCODES_READ: 'inventory:barcodes:read',
  BARCODES_MANAGE: 'inventory:barcodes:manage',

  // ── Landed Cost (INV-40) ───────────────────────────────────────────────────
  LANDED_COST_READ: 'inventory:landed-cost:read',
  LANDED_COST_CREATE: 'inventory:landed-cost:create',

  // ── Inventory Revaluation (INV-42) ─────────────────────────────────────────
  REVALUATION_READ: 'inventory:revaluation:read',
  REVALUATION_CREATE: 'inventory:revaluation:create',

  // ── Custom Item Attributes (INV-44) ────────────────────────────────────────
  ATTRIBUTES_READ: 'inventory:attributes:read',
  ATTRIBUTES_MANAGE: 'inventory:attributes:manage',

  // ── Stock Projection (INV-50) ──────────────────────────────────────────────
  PROJECTION_READ: 'inventory:projection:read',

  // ── Wildcard ───────────────────────────────────────────────────────────────
  WILDCARD: 'inventory:*',
} as const

export const INVENTORY_PERMISSION_DESCRIPTIONS: Record<
  (typeof INVENTORY_PERMISSIONS)[keyof typeof INVENTORY_PERMISSIONS],
  string
> = {
  'inventory:items:read': 'View item master records',
  'inventory:items:create': 'Create new inventory items',
  'inventory:items:update': 'Edit inventory item details',
  'inventory:items:delete': 'Delete inventory items',
  'inventory:items:manage_lifecycle':
    'Change item lifecycle status (Active / Discontinued / Archived)',
  'inventory:items:manage_classification':
    'Manage item classification (groups, subgroups, brands, types)',
  'inventory:categories:read': 'View item categories',
  'inventory:categories:create': 'Create item categories',
  'inventory:categories:update': 'Edit item categories',
  'inventory:categories:delete': 'Delete item categories',
  'inventory:warehouses:read': 'View warehouses and sub-locations',
  'inventory:warehouses:create': 'Create warehouses and sub-locations',
  'inventory:warehouses:update': 'Edit warehouses and sub-locations',
  'inventory:uom:read': 'View units of measure',
  'inventory:uom:create': 'Create units of measure and conversion rates',
  'inventory:uom:update': 'Edit units of measure and conversion rates',
  'inventory:stock:read': 'View real-time stock balances',
  'inventory:stock:create': 'Post stock entries',
  'inventory:transfers:read': 'View stock transfers',
  'inventory:transfers:create': 'Create stock transfer requests',
  'inventory:transfers:dispatch': 'Dispatch stock transfers',
  'inventory:transfers:receive': 'Receive incoming stock transfers',
  'inventory:write-offs:read': 'View write-off records',
  'inventory:write-offs:create': 'Create stock write-offs',
  'inventory:bundles:read': 'View bundle / kit definitions',
  'inventory:bundles:create': 'Create and manage bundles',
  'inventory:reports:valuation': 'Generate stock valuation reports',
  'inventory:reports:turnover': 'View stock turnover and aging reports',
  'inventory:receive:read': 'View goods receiving records',
  'inventory:receive:create': 'Record goods received against a PO',
  'inventory:stock-count:read': 'View stock count sheets',
  'inventory:stock-count:create': 'Initiate a stock count',
  'inventory:stock-count:adjust': 'Submit count variances as adjustments',
  'inventory:reorder:read': 'View reorder requests',
  'inventory:reorder:manage': 'Configure reorder points and manage reorder requests',
  'inventory:batch:read': 'View batch / lot records',
  'inventory:batch:manage': 'Assign and manage batch numbers',
  'inventory:serial:read': 'View serial number records',
  'inventory:serial:manage': 'Assign and manage serial numbers',
  'inventory:uds:read': 'View Unit Document Sheets (repair, pull-out, loan)',
  'inventory:uds:manage': 'Issue and update Unit Document Sheets',
  'inventory:expiry:read': 'View expiry-tracked stock',
  'inventory:expiry:manage': 'Manage expiry dates and FEFO picking',
  'inventory:cycle-count:read': 'View cycle count schedules',
  'inventory:cycle-count:manage': 'Create and manage cycle count schedules',
  'inventory:mobile-count:use': 'Perform mobile barcode stock counts',
  'inventory:quality-hold:read': 'View quality-hold records',
  'inventory:quality-hold:manage': 'Place, release, or reject quality holds on received stock',
  'inventory:returns:read': 'View return records',
  'inventory:returns:create': 'Process returned items back into inventory',
  'inventory:costing:read': 'View stock costing configuration',
  'inventory:costing:configure': 'Configure stock costing method (FIFO / LIFO / Weighted Average)',
  'inventory:variants:read': 'View item variants',
  'inventory:variants:manage': 'Create and manage item variants',
  'inventory:price-lists:read': 'View price lists',
  'inventory:price-lists:create': 'Create price lists',
  'inventory:price-lists:update': 'Edit price lists',
  'inventory:price-lists:delete': 'Delete price lists',
  'inventory:stock-levels:read': 'View min / max stock level boundaries',
  'inventory:stock-levels:manage': 'Configure min / max stock level boundaries',
  'inventory:reservations:read': 'View stock reservations',
  'inventory:reservations:create': 'Create stock reservations',
  'inventory:reservations:release': 'Release stock reservations',
  'inventory:negative-stock:read': 'View negative stock policy',
  'inventory:negative-stock:configure': 'Configure negative stock policy',
  'inventory:backorders:read': 'View backorders',
  'inventory:backorders:create': 'Create backorder records',
  'inventory:backorders:update': 'Update backorder status',
  'inventory:barcodes:read': 'View item barcodes',
  'inventory:barcodes:manage': 'Generate and manage item barcodes',
  'inventory:landed-cost:read': 'View landed cost records',
  'inventory:landed-cost:create': 'Record landed costs on goods receipts',
  'inventory:revaluation:read': 'View inventory revaluation history',
  'inventory:revaluation:create': 'Create inventory revaluation entries',
  'inventory:attributes:read': 'View custom item attributes',
  'inventory:attributes:manage': 'Create and manage custom item attributes',
  'inventory:projection:read': 'View forward stock projection',
  'inventory:*': 'Wildcard full Inventory access',
  'inventory:stock-requisitions:read': 'View branch stock requisitions',
  'inventory:stock-requisitions:create': 'Create branch stock requisitions',
  'inventory:stock-requisitions:approve': 'Approve or reject branch stock requisitions',
}

export type InventoryPermission = (typeof INVENTORY_PERMISSIONS)[keyof typeof INVENTORY_PERMISSIONS]

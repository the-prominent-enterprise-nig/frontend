import { z } from 'zod'

/** One step of a supplier discount chain, applied in order off SRP. Same shape
 * PO lines use, so a receipt taken against a PO carries the terms unchanged. */
const LineDiscountSchema = z.object({
  name: z.string().optional().nullable(),
  type: z.enum(['percentage', 'amount']),
  value: z.number(),
})

const ReceiveStockLineSchema = z
  .object({
    itemId: z.string().min(1, 'Item is required'),
    purchaseOrderLineId: z.string().optional(),
    quantityReceived: z.number().positive('Quantity must be greater than 0'),
    unitCost: z.number().min(0).optional(),
    // Scenario 46 — the supplier's pricing as stated: SRP and the ordered
    // discount chain that produced unitCost, plus per-line tax.
    //
    // These were missing here while the Receive modal collected them and the
    // backend persisted them, and zod strips unknown keys — so receive-stock.ts
    // forwards parsed.data with all four silently deleted. Every receipt line
    // ever created landed with srp/discounts NULL, and the RR could never show
    // why a cost was what it was (found 2026-09-07: the PO showed
    // "SRP ₱3,000 · 3% → ₱500 off → ₱2,410", the receipt showed only 2410).
    srp: z.number().min(0).optional(),
    discounts: z.array(LineDiscountSchema).optional(),
    taxCode: z.string().optional(),
    taxAmount: z.number().min(0).optional(),
    // Promotional/free item included in the delivery — server forces
    // unitCost to 0 for these regardless of what's submitted (Scenario 05
    // followup, "freebies" gap).
    isFreebie: z.boolean().optional(),
    batchNumber: z.string().optional(),
    qualityHold: z.boolean().optional(),
    serialNumbers: z.array(z.string().min(1)).optional(),
    notes: z.string().optional(),
  })
  .refine(
    (line) =>
      !line.serialNumbers ||
      line.serialNumbers.length === 0 ||
      line.serialNumbers.length === line.quantityReceived,
    {
      message: 'Serial count must match quantity received',
      path: ['serialNumbers'],
    }
  )

export const ReceiveStockFormSchema = z
  .object({
    code: z.string().optional(),
    purchaseOrderNumber: z.string().optional(),
    purchaseOrderDate: z.string().optional(),
    supplierId: z.string().optional(),
    // Tax as printed on the supplier's invoice. `withholding` is the rate
    // rule (the supplier's default when omitted); `withheldAmount` is the
    // amount actually withheld and overrides it. `vatTreatment` says how the
    // entered unit costs relate to VAT — `inclusive` (what PH invoices
    // normally quote) has the server back the VAT out of the cost rather
    // than add it on top — and `vatAmount` overrides the derived figure.
    withholding: z.enum(['none', 'pct_1']).optional(),
    withheldAmount: z.number().min(0).optional(),
    vatTreatment: z.enum(['inclusive', 'exclusive', 'exempt']).optional(),
    vatAmount: z.number().min(0).optional(),
    warehouseId: z.string().min(1, 'Destination warehouse is required'),
    applicationType: z.enum(['new_stock', 'revert']),
    modeOfTransfer: z.string().optional(),
    nndpCost: z.number().positive().optional(),
    receivedAt: z.string().optional(),
    notes: z.string().max(1000).optional(),
    // Document chain: PO -> DR from supplier -> Invoice (SI) from supplier
    // -> this Receiving Report. Both are the supplier's own paperwork,
    // typed in by whoever is physically receiving the delivery.
    // Scenario 46 — the DR is required at receiving, the SI is not. The
    // delivery receipt comes in the driver's hand with the goods, so it always
    // exists at this moment; the supplier's invoice often follows days later
    // and the client wants it filled in (and editable) when it does. See the
    // refine below — this used to be the other way round.
    deliveryReceiptNumber: z.string().optional(),
    supplierInvoiceNumber: z.string().optional(),
    // Who physically brought the delivery — the Receiving Report's
    // "Driver/Helper" line. Free text, not the Vehicle roster: that roster is
    // our own fleet, for branch-to-branch transfers, and a supplier's crew
    // will never be on it.
    driverName: z.string().max(150).optional(),
    helperName: z.string().max(150).optional(),
    lines: z.array(ReceiveStockLineSchema).min(1, 'At least one item line is required'),
  })
  .refine((data) => !!data.supplierId || data.lines.some((line) => !!line.purchaseOrderLineId), {
    message: 'Supplier is required when this receipt is not linked to a PO',
    path: ['supplierId'],
  })
  .refine((data) => data.applicationType !== 'new_stock' || !!data.deliveryReceiptNumber?.trim(), {
    message: "Delivery receipt number is required — it's on the paper that came with the goods",
    path: ['deliveryReceiptNumber'],
  })

export type ReceiveStockFormValues = z.infer<typeof ReceiveStockFormSchema>

// ─── Stock Balances ───────────────────────────────────────────────────────────

const StockBalanceItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  // Scenario 50 — the Stock Balance list reads an item as brand + model
  // ("Sharp SJML70"), and search resolves through these three.
  modelNumber: z.string().nullable().optional(),
  brand: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  primaryCategory: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
})

const StockBalanceWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  branch: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
})

export const StockBalanceSchema = z.object({
  id: z.string(),
  itemId: z.string().optional(),
  item: StockBalanceItemSchema.optional().nullable(),
  warehouse: StockBalanceWarehouseSchema.optional().nullable(),
  // A real StockBalance row's Decimal fields arrive as strings over JSON
  // (Prisma Decimal.toJSON()), while the serial-derived and rolled-up rows
  // are plain numbers — coerce so both shapes parse.
  onHandQty: z.coerce.number().default(0),
  availableQty: z.coerce.number().default(0),
  reservedQty: z.coerce.number().default(0),
  // Scenario 50 — all-time sold, scoped to the active filter.
  soldQty: z.coerce.number().default(0),
  // Scenario 50 — units on the road toward this location, summed from open
  // transfer lines. The balance rows don't know about them (dispatch
  // decrements the source); serials do since Scenario 56 (`in_transit`).
  inTransitQty: z.coerce.number().default(0),
  // Only present on a groupBy=item row: how many locations were rolled up.
  locationCount: z.number().optional(),
  reorderPoint: z.number().optional().nullable(),
  unitCost: z.number().optional().nullable(),
  updatedAt: z.string().optional(),
})

// The backend nests pagination under `meta` (`{ data, meta: { total, page,
// limit, lastPage } }`), not at the top level — same shape as
// ItemListResponseSchema/SerialNumberListResponseSchema. Parsing the real
// shape and transforming it back to a flat one keeps every existing
// consumer (useStockBalance's `pagination`) unchanged.
const StockBalanceSummarySchema = z.object({
  totalOnHandQty: z.number(),
  totalAvailableQty: z.number(),
  totalReservedQty: z.number(),
  totalSoldQty: z.number().optional(),
})

export const StockBalanceListResponseSchema = z
  .object({
    data: z.array(StockBalanceSchema),
    summary: StockBalanceSummarySchema.optional(),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
    }),
  })
  .transform(({ data, meta, summary }) => ({
    data,
    total: meta.total,
    page: meta.page,
    limit: meta.limit,
    summary,
  }))

export type StockBalance = z.infer<typeof StockBalanceSchema>
export type StockBalanceListResponse = z.infer<typeof StockBalanceListResponseSchema>

// ─── Stock Ledger ─────────────────────────────────────────────────────────────

const BranchSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().optional().nullable(),
})

const LedgerWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  branchId: z.string().optional().nullable(),
  branch: BranchSchema.optional().nullable(),
})

export const StockLedgerEntrySchema = z.object({
  id: z.string(),
  transactionType: z.string(),
  /** Absolute size of the movement — no direction. Read `quantityChange`
   *  for that: an `adjustment` goes either way, so transactionType alone
   *  cannot tell an inflow from an outflow. */
  quantity: z.number(),
  /** The signed movement: negative for sales, transfer-outs, write-offs and
   *  supplier returns. Optional so older payloads still parse. */
  quantityChange: z.number().optional().nullable(),
  condition: z.string().optional().nullable(),
  originalSaleId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  item: StockBalanceItemSchema.optional().nullable(),
  warehouse: LedgerWarehouseSchema.optional().nullable(),
  occurredAt: z.string().optional(),
  createdAt: z.string().optional(),
  /** What the movement was worth. Carried by receipts and, since customer
   *  returns started posting to the GL, by returns too. */
  unitCost: z.coerce.number().optional().nullable(),
  serialNumberId: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  // Scenario 50 Gap 4 — where the movement came from. Present on every row
  // for a stable shape; null on movements with no receipt behind them.
  goodsReceiptLineId: z.string().optional().nullable(),
  receivingReportId: z.string().optional().nullable(),
  receivingReportCode: z.string().optional().nullable(),
  purchaseOrderNumber: z.string().optional().nullable(),
  deliveryReceiptNumber: z.string().optional().nullable(),
  supplierInvoiceNumber: z.string().optional().nullable(),
  supplier: z.object({ id: z.string(), name: z.string() }).optional().nullable(),
  customerId: z.string().optional().nullable(),
  customer: z
    .object({
      id: z.string(),
      name: z.string(),
      customerCode: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  journalEntryId: z.string().optional().nullable(),
  creditMemoId: z.string().optional().nullable(),
  creditMemoNumber: z.string().optional().nullable(),
  // Where a transfer_out/transfer_in row leads: the ST number, and the
  // OTHER end of the move (a dispatch row's own `warehouse` is already the
  // source, so this is the destination, and vice versa for a receive row).
  stockTransferNumber: z.string().optional().nullable(),
  transferWarehouse: LedgerWarehouseSchema.optional().nullable(),
  // A supplier_return row traces back to the RR its returned line
  // originally arrived on (via the debit memo line), same as a receipt.
  supplierDebitMemoNumber: z.string().optional().nullable(),
})

export const StockLedgerListResponseSchema = z.object({
  data: z.array(StockLedgerEntrySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type StockLedgerEntry = z.infer<typeof StockLedgerEntrySchema>
export type StockLedgerListResponse = z.infer<typeof StockLedgerListResponseSchema>

// ─── Receiving Reports ────────────────────────────────────────────────────────

const DiscrepancySchema = z.object({
  purchaseOrderId: z.string(),
  qtyOrdered: z.number(),
  qtyReceived: z.number(),
  // Across every receipt against the PO line, this one included.
  qtyReceivedToDate: z.number().optional(),
  qtyVariance: z.number(),
  hasQtyDiscrepancy: z.boolean(),
  hasConditionIssue: z.boolean(),
})

const ReceivingReportPoLineSchema = z.object({
  id: z.string(),
  quantity: z.number(),
  purchaseOrderId: z.string(),
  purchaseOrder: z.object({ code: z.string() }).optional().nullable(),
})

const ReceivingReportLineItemSchema = StockBalanceItemSchema.extend({
  // Catalog-level classification, used to fill the printed Receiving
  // Report's Brand / Subgroup / Model columns.
  modelNumber: z.string().optional().nullable(),
  brand: z.object({ name: z.string() }).optional().nullable(),
  type: z.object({ name: z.string() }).optional().nullable(),
  primaryCategory: z.object({ name: z.string() }).optional().nullable(),
})

const ReceivingReportLineSchema = z.object({
  id: z.string(),
  // Optional: a merged-in Manual Receiving Report row (see sourceType below)
  // has no goodsReceiptId/itemId of its own — it's a different Prisma model
  // entirely, normalized just enough to render in this same list/row shape.
  goodsReceiptId: z.string().optional(),
  itemId: z.string().optional(),
  item: ReceivingReportLineItemSchema.optional().nullable(),
  purchaseOrderLineId: z.string().optional().nullable(),
  purchaseOrderLine: ReceivingReportPoLineSchema.optional().nullable(),
  quantityReceived: z.number(),
  batchNumber: z.string().optional().nullable(),
  serialNumbers: z.array(z.string()).optional(),
  unitCost: z.number().optional().nullable(),
  // Scenario 46 — the supplier's pricing as stated, not just the resulting
  // cost, so the DR can show WHY a unit cost is what it is.
  srp: z.number().optional().nullable(),
  discounts: z
    .array(
      z.object({
        name: z.string().optional().nullable(),
        type: z.enum(['percentage', 'amount']),
        value: z.number(),
      })
    )
    .optional()
    .nullable(),
  discountedCost: z.number().optional().nullable(),
  taxCode: z.string().optional().nullable(),
  taxAmount: z.number().optional().nullable(),
  qualityHold: z.boolean().optional(),
  isFreebie: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  discrepancy: DiscrepancySchema.nullable().optional(),
})

const ReceivingReportWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  branchId: z.string().optional().nullable(),
  branch: BranchSchema.optional().nullable(),
})

const ReceivingReportSupplierSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
})

export const ReceivingReportSchema = z.object({
  id: z.string(),
  code: z.string(),
  status: z.string(),
  // Present on every row from getReceivingReports() (see stock.service.ts) —
  // optional here only so this schema still fits the single-receipt detail
  // response, which never sets it since a merged list is meaningless there.
  sourceType: z.enum(['goods_receipt', 'manual_rr']).optional(),
  applicationType: z.string().optional(),
  modeOfTransfer: z.string().optional().nullable(),
  receivedAt: z.string(),
  notes: z.string().optional().nullable(),
  warehouse: ReceivingReportWarehouseSchema.optional().nullable(),
  supplier: ReceivingReportSupplierSchema.optional().nullable(),
  receivedById: z.string().optional().nullable(),
  receivedByName: z.string().optional().nullable(),
  poDate: z.string().optional().nullable(),
  purchaseOrderNumber: z.string().optional().nullable(),
  driverName: z.string().optional().nullable(),
  helperName: z.string().optional().nullable(),
  // Set only on a receipt that arrived from another branch rather than a
  // supplier. Its number takes the printed report's PO slot — a transfer
  // receipt has no purchase order behind it.
  stockTransfer: z
    .object({
      id: z.string().optional(),
      transferNumber: z.string().optional().nullable(),
      transferDate: z.string().optional().nullable(),
      // Where the goods came FROM. The reports list has no supplier to name
      // on a transfer-sourced row, so it names this branch instead; only the
      // list endpoint selects it, hence optional.
      fromWarehouse: ReceivingReportWarehouseSchema.optional().nullable(),
    })
    .optional()
    .nullable(),
  deliveryReceiptNumber: z.string().optional().nullable(),
  supplierInvoiceNumber: z.string().optional().nullable(),
  journalEntryId: z.string().optional().nullable(),
  withholding: z.enum(['none', 'pct_1']).optional(),
  withheldAmount: z.number().optional().nullable(),
  // Scenario 36 Gap 4 — Input VAT, resolved from each line's item's own
  // tax rate at receiving time.
  vatAmount: z.number().optional().nullable(),
  lines: z.array(ReceivingReportLineSchema),
  hasAnyDiscrepancy: z.boolean(),
  // Scenario 56 — for a PO-linked receipt: does its order still expect more?
  // Null when there's no PO (transfer, standalone). List response only.
  deliveryStatus: z.enum(['partial', 'complete']).nullable().optional(),
  // Scenario 51 — the receipt-sourced invoice behind this receipt, if any.
  // Used to warn before a cost correction pushes an already-settled invoice
  // back to owing money.
  apBill: z
    .object({
      id: z.string(),
      status: z.string(),
      totalAmount: z.number(),
      amountPaid: z.number(),
      // Scenario 56 — the supplier's SI number, shown on the Reports list.
      billNumber: z.string().nullable().optional(),
    })
    .optional()
    .nullable(),
})

export const ReceivingReportListResponseSchema = z.object({
  data: z.array(ReceivingReportSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    lastPage: z.number(),
  }),
})

export type ReceivingReport = z.infer<typeof ReceivingReportSchema>
export type ReceivingReportListResponse = z.infer<typeof ReceivingReportListResponseSchema>

// ─── Withholding Summary ──────────────────────────────────────────────────────

export const WithholdingSummaryRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  receivedAt: z.string(),
  withholding: z.enum(['none', 'pct_1']),
  withheldAmount: z.number().nullable(),
  supplier: ReceivingReportSupplierSchema.optional().nullable(),
})

export const WithholdingSummaryResponseSchema = z.object({
  data: z.array(WithholdingSummaryRowSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    lastPage: z.number(),
    totalWithheld: z.number(),
  }),
})

export type WithholdingSummaryRow = z.infer<typeof WithholdingSummaryRowSchema>
export type WithholdingSummaryResponse = z.infer<typeof WithholdingSummaryResponseSchema>

// Scenario 50 (Closing Gap 3) — the states the Stock Balance filter offers.
// Four mirror the badge the list derives per row (`stockStatusOf` in
// StockBalanceList, and `deriveStockState` server-side, which must stay in
// step with it); `in_transit` is the separate open-transfer axis, counted off
// open transfer lines rather than the balance row's own quantities.
export const StockStateFilterSchema = z.enum([
  'in_stock',
  'in_transit',
  'out',
  'fully_reserved',
  'low',
])
export type StockStateFilter = z.infer<typeof StockStateFilterSchema>

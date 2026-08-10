import { z } from 'zod'

// ─── Service catalog (Closing Gap 6) ────────────────────────────────────────
// NIG's fixed "Services Offered" catalog (developer-provided 2026-08-08).
// Mirrors backend's SERVICE_CATALOG (src/pos/service-catalog.const.ts) —
// duplicated here rather than shared, since frontend/backend are separate
// repos/runtimes; both are the same fixed, rarely-changing business list, so
// drift risk is low. category values match the backend's ServiceCategory
// Prisma enum exactly; subType is a plain string on both sides (several
// sub-item labels repeat verbatim across categories — see ServiceCategory's
// schema.prisma doc comment for why it isn't a second enum).

export const ServiceCategorySchema = z.enum([
  'general_cleaning',
  'replacement_minor_electrical_part',
  'replacement_major_electrical_parts',
  'repair_leakage_recharging_reprocessing',
  'replacement_motor_compressor_reprocessing_recharging',
  'relocation_split_type_aircon',
])
export type ServiceCategory = z.infer<typeof ServiceCategorySchema>

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  general_cleaning: 'General Cleaning',
  replacement_minor_electrical_part: 'Replacement of Minor Electrical Part',
  replacement_major_electrical_parts: 'Replacement of Major Electrical Parts',
  repair_leakage_recharging_reprocessing: 'Repair Leakage, Recharging & Reprocessing the System',
  replacement_motor_compressor_reprocessing_recharging:
    'Replacement of Motor Compressor, Reprocessing and Recharging of Refrigerant',
  relocation_split_type_aircon: 'Relocation of Split Type Aircon',
}

export const SERVICE_CATALOG: Record<ServiceCategory, string[]> = {
  general_cleaning: [
    'Window Type',
    'Split Type — Wall/Floor/Ceiling Mounted',
    'Split Type — Ceiling Cassette',
    'FCU',
    'Check-up (Window & Split Type)',
  ],
  replacement_minor_electrical_part: [
    'Capacitor',
    'Switches',
    'Magnetic Contactor',
    'Temperature Sensor',
    'Bearing',
    'Thermostat',
    'Relays',
    'Thermistor',
    'Overload Protector',
  ],
  replacement_major_electrical_parts: [
    'Fan Motor',
    'Fan Blower',
    'Fan Blade',
    'Blower Wheel',
    'Motor Compressor',
    'Printed Circuit Board',
    'Expansion Valve',
    'Evaporator Coil',
    'Condenser Fan',
    'Air Filter',
    'Condensate Drain Pump',
  ],
  repair_leakage_recharging_reprocessing: ['Window Type', 'Split Type'],
  replacement_motor_compressor_reprocessing_recharging: ['Window Type', 'Split Type'],
  relocation_split_type_aircon: [
    'Pull Out Existing Unit',
    'Excess Piping After 10ft',
    'Lay Out of Electrical Supply',
    'Chipping Works',
  ],
}

// Materials auto-suggestion fires only for a sub-type literally named after
// a physical part — the two "Replacement of ... Electrical Part(s)"
// categories. The other four don't map to a specific part.
export const AUTO_SUGGEST_MATERIAL_CATEGORIES: ServiceCategory[] = [
  'replacement_minor_electrical_part',
  'replacement_major_electrical_parts',
]

// ─── Write schemas (create/edit form) ───────────────────────────────────────
// Mirrors CreatePrLineSchema / CreatePurchaseRequestFormSchema from
// src/schema/inventory/purchase-requests — a ServiceDraft is a reopenable
// materials estimate for an install job, edited the same way a PR is: a
// title/customer/notes header plus N estimated-material lines.

export const CreateServiceDraftLineSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  // Plain z.number() (not .coerce) — mirrors CreatePrLineSchema. NumericInput
  // already emits a JS number via its onChange, and z.coerce.number() inside
  // a useFieldArray array item breaks zodResolver's generic inference under
  // zod v4 (input type collapses to `unknown`, output type stays `number`).
  estimatedQty: z.number().positive('Estimated quantity must be greater than 0'),
  notes: z.string().max(500).optional(),
  // Required (checked at submit time in ServiceJobFormModal, not here — this
  // schema has no way to know whether itemId is serial-tracked) when the
  // picked material is serial-tracked; estimatedQty is locked to 1 in that
  // case. The backend re-validates both regardless.
  serialNumberId: z.string().optional(),
})

// Closing Gap 6 — one catalog entry a job is tagged with. Kept optional at
// the array level on the parent schema (see below) so editing a job created
// before this gap existed — which has zero service types on record — isn't
// blocked; a new job's form defaults to one pre-added row as a soft nudge
// instead of a hard minimum (mirrors the backend's non-breaking design).
// category is a plain non-empty string here (not ServiceCategorySchema) so
// an un-selected form row can default to '' without fighting the enum's
// literal-union TS type — the picker only ever offers the 6 real category
// keys, and the superRefine below (plus the backend) still enforces a real
// value reaches the API.
export const CreateServiceDraftServiceTypeSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  subType: z.string().min(1, 'Select a sub-type'),
  quotedAmount: z.number().positive('Quoted amount must be greater than 0'),
})

export const CreateServiceDraftFormSchema = z
  .object({
    // Optional fallback used only when the caller has no branchId of their own
    // (Business Owner) — branch-scoped actors (Cashier/Branch Manager) have
    // their branchId force-resolved server-side regardless of what's submitted
    // here. Mirrors CreatePurchaseRequestFormSchema's branchId handling exactly.
    branchId: z.string().optional(),
    title: z.string().min(1, 'Title is required'),
    customerId: z.string().optional(),
    posTransactionId: z.string().optional(),
    notes: z.string().max(1000).optional(),
    lines: z.array(CreateServiceDraftLineSchema).min(1, 'Add at least one estimated material line'),
    serviceTypes: z.array(CreateServiceDraftServiceTypeSchema).optional(),
  })
  // Defense-in-depth mirror of the backend's validateServiceTypes() — the
  // form UI's subType select is already filtered to the picked category's
  // list, so this should be unreachable in practice, but catches it cleanly
  // if it ever isn't (e.g. a future UI change).
  .superRefine((data, ctx) => {
    data.serviceTypes?.forEach((st, index) => {
      // Skip an incomplete row — the base field schemas' own .min(1) checks
      // already surface "Category is required" / "Select a sub-type" for
      // those; this check only makes sense once both are actually picked.
      if (!st.category || !st.subType) return
      if (!SERVICE_CATALOG[st.category as ServiceCategory]?.includes(st.subType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'This sub-type does not belong to the selected category',
          path: ['serviceTypes', index, 'subType'],
        })
      }
    })
  })

// PATCH bulk-replaces the same fields as POST, so the update form shares the
// create schema — same precedent as UpdatePurchaseRequestFormSchema.
export const UpdateServiceDraftFormSchema = CreateServiceDraftFormSchema

// ─── Read schemas (list/detail display) ─────────────────────────────────────

export const ServiceDraftStatusSchema = z.enum([
  'draft',
  'sourcing',
  'installing',
  'completed',
  'cancelled',
])

const ServiceDraftLineItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  isSerialTracked: z.boolean().optional(),
})

const ServiceDraftLineSerialSchema = z.object({
  id: z.string(),
  serialNumber: z.string(),
})

export const ServiceDraftLineSourceSchema = z.enum(['warehouse', 'purchase_order'])

export const ServiceDraftLineSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  item: ServiceDraftLineItemSchema,
  estimatedQty: z.coerce.number(),
  actualQty: z.coerce.number().nullable().optional(),
  source: ServiceDraftLineSourceSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
  serialNumberId: z.string().nullable().optional(),
  serialNumber: ServiceDraftLineSerialSchema.nullable().optional(),
})

// Closing Gap 6 — read shape of a saved service-type entry.
export const ServiceDraftServiceTypeSchema = z.object({
  id: z.string(),
  category: ServiceCategorySchema,
  subType: z.string(),
  quotedAmount: z.coerce.number(),
})
export type ServiceDraftServiceType = z.infer<typeof ServiceDraftServiceTypeSchema>

// Closing Gap 2 follow-up — the sale this job was linked to at creation.
// Backend has always included this on every ServiceDraft response
// (ServiceDraftsService's sdInclude), just never had a matching form field
// or display until now.
export const ServiceDraftPosTransactionSchema = z.object({
  id: z.string(),
  transactionNumber: z.string(),
  status: z.string(),
})

// ─── Sourcing (Closing Gap 3) — stock-check preview + linked PRs ───────────

export const ServiceDraftSourcingPrSchema = z.object({
  id: z.string(),
  code: z.string(),
  status: z.string(),
})

export const StockCheckLineSchema = z.object({
  lineId: z.string(),
  itemId: z.string(),
  sku: z.string(),
  name: z.string(),
  estimatedQty: z.number(),
  availableQty: z.number(),
  shortfallQty: z.number(),
})

export const StockCheckResponseSchema = z.object({
  lines: z.array(StockCheckLineSchema),
  hasShortfall: z.boolean(),
})

// ─── Install (Closing Gap 4) — assign technician + record actuals ─────────
// technicianName is plain free text, not tied to a User record — a
// developer-confirmed follow-up ask that reversed the original design
// (a staff search combobox resolving to a real user).

export const StartInstallFormSchema = z.object({
  technicianName: z.string().min(1, 'Technician is required'),
})

export const RecordActualLineSchema = z.object({
  lineId: z.string(),
  actualQty: z.number().min(0, 'Actual quantity cannot be negative'),
})

export const RecordActualsFormSchema = z.object({
  lines: z.array(RecordActualLineSchema).min(1),
})

// ─── Complete (Closing Gap 5b) — auto-generated materials invoice ─────────

export const ServiceDraftInvoiceLineSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  item: ServiceDraftLineItemSchema,
  quantity: z.coerce.number(),
  unitPrice: z.coerce.number(),
  lineTotal: z.coerce.number(),
})

export const ServiceDraftInvoiceSchema = z.object({
  id: z.string(),
  invoiceNumber: z.string(),
  totalAmount: z.coerce.number(),
  lines: z.array(ServiceDraftInvoiceLineSchema),
  createdAt: z.string(),
})

const ServiceDraftBranchSchema = z.object({
  id: z.string(),
  name: z.string(),
})

const ServiceDraftCustomerSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
})

export const ServiceDraftSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: ServiceDraftStatusSchema,
  notes: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  customer: ServiceDraftCustomerSchema.nullable().optional(),
  posTransactionId: z.string().nullable().optional(),
  posTransaction: ServiceDraftPosTransactionSchema.nullable().optional(),
  branchId: z.string().nullable().optional(),
  branch: ServiceDraftBranchSchema.nullable().optional(),
  lines: z.array(ServiceDraftLineSchema),
  serviceTypes: z.array(ServiceDraftServiceTypeSchema).optional(),
  sourcingPurchaseRequests: z.array(ServiceDraftSourcingPrSchema).optional(),
  technicianName: z.string().nullable().optional(),
  invoice: ServiceDraftInvoiceSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
})

export const ServiceDraftListResponseSchema = z.object({
  data: z.array(ServiceDraftSchema),
  total: z.number().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
})

export type CreateServiceDraftLineValues = z.infer<typeof CreateServiceDraftLineSchema>
export type CreateServiceDraftServiceTypeValues = z.infer<
  typeof CreateServiceDraftServiceTypeSchema
>
export type CreateServiceDraftFormValues = z.infer<typeof CreateServiceDraftFormSchema>
export type UpdateServiceDraftFormValues = z.infer<typeof UpdateServiceDraftFormSchema>
export type ServiceDraftStatus = z.infer<typeof ServiceDraftStatusSchema>
export type ServiceDraftLineSource = z.infer<typeof ServiceDraftLineSourceSchema>
export type ServiceDraftPosTransaction = z.infer<typeof ServiceDraftPosTransactionSchema>
export type ServiceDraftLine = z.infer<typeof ServiceDraftLineSchema>
export type ServiceDraft = z.infer<typeof ServiceDraftSchema>
export type ServiceDraftListResponse = z.infer<typeof ServiceDraftListResponseSchema>
export type StockCheckLine = z.infer<typeof StockCheckLineSchema>
export type StockCheckResponse = z.infer<typeof StockCheckResponseSchema>
export type ServiceDraftInvoiceLine = z.infer<typeof ServiceDraftInvoiceLineSchema>
export type ServiceDraftInvoice = z.infer<typeof ServiceDraftInvoiceSchema>
export type StartInstallFormValues = z.infer<typeof StartInstallFormSchema>
export type RecordActualLineValues = z.infer<typeof RecordActualLineSchema>
export type RecordActualsFormValues = z.infer<typeof RecordActualsFormSchema>

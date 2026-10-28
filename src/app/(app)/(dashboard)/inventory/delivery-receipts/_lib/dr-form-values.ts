import {
  RAFFLE_OCCASIONS,
  type DrDetail,
  type DrFormValues,
  type DrLineFormValues,
} from '@/src/schema/inventory/delivery-receipts'

/** Today in the user's own timezone, as the date input wants it. */
export function todayIso(): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function emptyDrForm(): DrFormValues {
  return {
    purpose: 'office_use',
    occasion: '',
    occasionOther: '',
    giveawayRecipient: '',
    issueDate: todayIso(),
    warehouseId: '',
    departmentId: '',
    udsId: '',
    udsLabel: '',
    udsFixesParty: false,
    customerId: '',
    customerLabel: '',
    supplierId: '',
    supplierLabel: '',
    deliveredTo: '',
    customerCode: '',
    address: '',
    contactNo: '',
    referenceNo: '',
    referenceDate: '',
    reason: '',
    remarks: '',
    lines: [],
  }
}

/** A stored raffle occasion back into the select + "Other" text pair. */
function occasionFields(detail: string | null): Pick<DrFormValues, 'occasion' | 'occasionOther'> {
  if (!detail) return { occasion: '', occasionOther: '' }
  const named = (RAFFLE_OCCASIONS as readonly string[]).includes(detail)
  return named
    ? { occasion: detail, occasionOther: '' }
    : { occasion: 'Other', occasionOther: detail }
}

export function drToFormValues(dr: DrDetail): DrFormValues {
  const day = (iso: string | null): string => (iso ? iso.slice(0, 10) : '')
  return {
    purpose: dr.purpose,
    ...occasionFields(dr.purposeDetail),
    giveawayRecipient: dr.giveawayRecipient ?? '',
    issueDate: day(dr.issueDate),
    warehouseId: dr.warehouseId,
    departmentId: dr.departmentId ?? '',
    udsId: dr.udsId ?? '',
    udsLabel: dr.uds?.code ?? '',
    udsFixesParty: !!dr.uds && (dr.purpose !== 'to_service_center' || !!dr.uds.repairProviderId),
    customerId: dr.customerId ?? '',
    customerLabel: dr.customer?.name ?? '',
    supplierId: dr.supplierId ?? '',
    supplierLabel: dr.supplier?.name ?? '',
    deliveredTo: dr.deliveredTo ?? '',
    customerCode: dr.customerCode ?? '',
    address: dr.address ?? '',
    contactNo: dr.contactNo ?? '',
    referenceNo: dr.referenceNo ?? '',
    referenceDate: day(dr.referenceDate),
    reason: dr.reason ?? '',
    remarks: dr.remarks ?? '',
    lines: groupSerialLines(dr.lines.map(toFormLine)),
  }
}

type DetailLine = DrDetail['lines'][number]

function toFormLine(l: DetailLine): DrLineFormValues {
  return {
    itemId: l.itemId,
    itemLabel: l.item.name,
    isSerialTracked: l.item.isSerialTracked,
    serials:
      l.serialNumberId && l.serialNumber
        ? [{ id: l.serialNumberId, label: l.serialNumber.serialNumber }]
        : [],
    quantity: l.quantity,
    modelNumber: l.item.modelNumber ?? '',
    brandName: l.item.brand?.name ?? '',
    unitCost: l.unitCost ?? l.estimatedUnitCost ?? null,
    // A draft's line has a stored cost only when one was typed.
    costTyped: l.unitCost != null,
  }
}

/** The backend keeps one line per serial; the form shows one line per item
 * (and typed cost), with its serials picked together. */
function groupSerialLines(lines: DrLineFormValues[]): DrLineFormValues[] {
  const out: DrLineFormValues[] = []
  const byKey = new Map<string, DrLineFormValues>()
  for (const line of lines) {
    const key = `${line.itemId}|${line.costTyped ? line.unitCost : ''}`
    const group = line.isSerialTracked ? byKey.get(key) : undefined
    if (group) {
      group.serials.push(...line.serials)
      group.quantity = group.serials.length
      continue
    }
    out.push(line)
    if (line.isSerialTracked) byKey.set(key, line)
  }
  return out
}

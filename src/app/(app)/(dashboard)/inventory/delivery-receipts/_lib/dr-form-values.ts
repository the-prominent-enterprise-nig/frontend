import {
  RAFFLE_OCCASIONS,
  type DrDetail,
  type DrFormValues,
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
    issueDate: todayIso(),
    warehouseId: '',
    departmentId: '',
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
    issueDate: day(dr.issueDate),
    warehouseId: dr.warehouseId,
    departmentId: dr.departmentId ?? '',
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
    lines: dr.lines.map((l) => ({
      itemId: l.itemId,
      itemLabel: l.item.name,
      isSerialTracked: l.item.isSerialTracked,
      serialNumberId: l.serialNumberId ?? '',
      serialLabel: l.serialNumber?.serialNumber ?? '',
      quantity: l.quantity,
      modelNumber: l.item.modelNumber ?? '',
      brandName: l.item.brand?.name ?? '',
      unitCost: l.unitCost ?? l.estimatedUnitCost ?? null,
    })),
  }
}

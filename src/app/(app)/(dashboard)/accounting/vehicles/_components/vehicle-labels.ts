import type { VehicleCategory, VehicleExpenseKind } from '@/src/schema/inventory/vehicles'

export const CATEGORY_LABELS: Record<VehicleCategory, string> = {
  delivery: 'Delivery',
  service: 'Service',
  collector: 'Collector',
}

export const EXPENSE_KIND_LABELS: Record<VehicleExpenseKind, string> = {
  FUEL: 'Fuel',
  VEHICLE_REPAIR: 'Vehicle Repair',
}

import { redirect } from 'next/navigation'

/**
 * The Counting hub (Stock Adjustments / Mobile Count / Batches) is retired.
 * Stock Counts moved to Stock Report → Physical Inventory (Scenario 87), and a
 * count's variance now posts on submit, so the Stock Adjustments approval
 * list has nothing left to act on. Old links and notifications land here.
 */
export default function CountingPage(): never {
  redirect('/inventory/reports?tab=physical-inventory')
}

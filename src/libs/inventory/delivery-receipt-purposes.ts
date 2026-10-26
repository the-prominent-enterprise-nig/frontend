import type { DrPurpose } from '@/src/schema/inventory/delivery-receipts'

// Scenario 72 — one place that says what each Delivery Receipt purpose does.
// The form (labels, which fields show and which are required, the info box),
// the list and the printed DR's purpose checkboxes all read this, so they
// cannot disagree about a purpose.

export type DrCounterparty = 'customer' | 'supplier' | 'none'

export type DrPurposeConfig = {
  label: string
  /** "With debit memo" (approval drafts a DMINV memo) or "without". */
  withDebitMemo: boolean
  /** The purple box under the dropdown: what approval will do. */
  effect: string
  /** Who the stock goes to, which decides the picker shown. */
  counterparty: DrCounterparty
  requiresDepartment?: boolean
  requiresOccasion?: boolean
  /** Shown but not yet submittable — kept for a purpose whose approval path
   * lands later (the backend refuses to submit it until then). None today. */
  comingLater?: boolean
}

const MEMO_TAIL = 'No sales invoice is created. A debit memo is generated with the journal entry.'

export const DR_PURPOSE_CONFIG: Record<DrPurpose, DrPurposeConfig> = {
  office_use: {
    label: 'Office use',
    withDebitMemo: true,
    effect: `When approved, the debit memo posts automatically: the stock moves out of the issuing branch and its cost goes to Office equipment, furniture and fixtures. ${MEMO_TAIL}`,
    counterparty: 'none',
    requiresDepartment: true,
  },
  raffle_prize: {
    label: 'Raffle prize',
    withDebitMemo: true,
    effect: `When approved, the debit memo posts automatically: the stock moves out of the issuing branch and its cost goes to Employee benefits and wellness. ${MEMO_TAIL}`,
    counterparty: 'none',
    requiresOccasion: true,
  },
  giveaway: {
    label: 'Giveaways',
    withDebitMemo: true,
    effect: `When approved, the debit memo posts automatically: the stock moves out of the issuing branch and its cost goes to Advertising and promotion. ${MEMO_TAIL}`,
    counterparty: 'none',
  },
  donation: {
    label: 'Donation',
    withDebitMemo: true,
    effect: `When approved, the debit memo posts automatically: the stock moves out of the issuing branch and its cost goes to Donations and charitable contributions. ${MEMO_TAIL}`,
    counterparty: 'none',
  },
  redeemed_unit: {
    label: 'Redeemed unit',
    withDebitMemo: true,
    effect: `When approved, the debit memo posts automatically: the stock moves out of the issuing branch and its cost goes to Marketing and sales support. ${MEMO_TAIL}`,
    counterparty: 'customer',
  },
  return_to_supplier: {
    label: 'Return units to supplier',
    withDebitMemo: true,
    effect:
      'A supplier debit memo is drafted with this DR and follows it while it is a draft. When the Branch Manager approves, the memo posts automatically — the stock moves out and what the supplier owes back is recorded. Accounting applies it to an invoice later.',
    counterparty: 'supplier',
  },
  to_service_center: {
    label: 'For repair to service center',
    withDebitMemo: false,
    effect:
      'Pick a repair ticket (UDS), or leave it blank and pick the unit and provider — approval opens the ticket for you. The unit goes to the provider and stays on the books.',
    counterparty: 'supplier',
  },
  repaired_to_customer: {
    label: 'Repaired unit to customer',
    withDebitMemo: false,
    effect:
      'Pick the repair ticket (UDS) if there is one — its unit and customer fill in, and approval releases the repaired unit back to its customer and closes the ticket. Without a ticket, pick the customer and their unit; the DR records the hand-over and moves no stock. No debit memo.',
    counterparty: 'customer',
  },
  unrepaired_to_customer: {
    label: 'Unrepaired unit to customer',
    withDebitMemo: false,
    effect:
      'Pick the repair ticket (UDS) if there is one — its unit and customer fill in, and approval returns the unrepaired unit to its customer and closes the ticket. Without a ticket, pick the customer and their unit; the DR records the hand-over and moves no stock. No debit memo.',
    counterparty: 'customer',
  },
  sales_invoice_to_follow: {
    label: 'Sales invoice to follow',
    withDebitMemo: false,
    effect:
      'When approved, the units are held for this customer and nothing is posted. Use Proceed to POS to ring up the sale; the sale moves the stock and creates the invoice.',
    counterparty: 'customer',
  },
}

/** Dropdown order, grouped the way the client wrote the list. */
export const DR_PURPOSE_GROUPS: { label: string; purposes: DrPurpose[] }[] = [
  {
    label: 'With debit memo',
    purposes: [
      'office_use',
      'raffle_prize',
      'giveaway',
      'donation',
      'redeemed_unit',
      'return_to_supplier',
    ],
  },
  {
    label: 'Without debit memo',
    purposes: [
      'to_service_center',
      'repaired_to_customer',
      'unrepaired_to_customer',
      'sales_invoice_to_follow',
    ],
  },
]

export function drPurposeLabel(purpose: DrPurpose): string {
  return DR_PURPOSE_CONFIG[purpose].label
}

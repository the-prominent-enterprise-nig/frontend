import type { DrGiveawayRecipient, DrPurpose } from '@/src/schema/inventory/delivery-receipts'

// Scenario 72 — one place that says what each Delivery Receipt purpose does.
// The form (labels, which fields show and which are required, the info box),
// the list and the printed DR's purpose checkboxes all read this, so they
// cannot disagree about a purpose.

export type DrCounterparty = 'customer' | 'supplier' | 'none'

export type DrPurposeConfig = {
  label: string
  /** "With debit memo" (the DR carries a DMINV memo) or "without". */
  withDebitMemo: boolean
  /** Submitting posts the memo — no Branch Manager approval, no accounting
   * step (client, 2026-10-26). Otherwise submit waits for approval. */
  postsOnSubmit?: boolean
  /** The purple box under the dropdown: what submit or approval will do. */
  effect: string
  /** Who the stock goes to, which decides the picker shown. */
  counterparty: DrCounterparty
  requiresDepartment?: boolean
  requiresOccasion?: boolean
  /** Giveaways: customers, or partners and suppliers. */
  requiresRecipient?: boolean
  /** Shown but not yet submittable — kept for a purpose whose approval path
   * lands later (the backend refuses to submit it until then). None today. */
  comingLater?: boolean
}

const MEMO_TAIL = 'No sales invoice is created. A debit memo is generated with the journal entry.'

/** What submitting a memo purpose does, ending on the account it debits. */
const postsTo = (account: string): string =>
  `When submitted, the debit memo posts automatically, with no approval or accounting step: the stock moves out of the issuing branch and its cost goes to ${account}. ${MEMO_TAIL}`

export const DR_PURPOSE_CONFIG: Record<DrPurpose, DrPurposeConfig> = {
  office_use: {
    label: 'Office use',
    withDebitMemo: true,
    postsOnSubmit: true,
    effect: postsTo('Office equipment, furniture and fixtures'),
    counterparty: 'none',
    requiresDepartment: true,
  },
  raffle_prize: {
    label: 'Raffle prize',
    withDebitMemo: true,
    postsOnSubmit: true,
    effect: postsTo('Company events and employee engagement'),
    counterparty: 'none',
    requiresOccasion: true,
  },
  giveaway: {
    label: 'Giveaways',
    withDebitMemo: true,
    postsOnSubmit: true,
    effect: postsTo(
      'Advertising and promotion (to customers) or Representation and entertainment (to partners and suppliers)'
    ),
    counterparty: 'none',
    requiresRecipient: true,
  },
  donation: {
    label: 'Donation',
    withDebitMemo: true,
    postsOnSubmit: true,
    effect: postsTo('Donations and charitable contributions'),
    counterparty: 'none',
  },
  redeemed_unit: {
    label: 'Redeemed unit',
    withDebitMemo: true,
    postsOnSubmit: true,
    effect: postsTo('Marketing and sales support'),
    counterparty: 'customer',
  },
  return_to_supplier: {
    label: 'Return units to supplier',
    withDebitMemo: true,
    postsOnSubmit: true,
    effect:
      'A supplier debit memo is drafted with this DR and follows it while it is a draft. When submitted, the memo posts automatically, with no approval step: the stock moves out and what the supplier owes back is recorded. Accounting applies it to an invoice later.',
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
  others: {
    label: 'Others',
    withDebitMemo: true,
    effect:
      'Needs the Branch Manager’s approval. When approved, the stock moves out of the issuing branch and a debit memo goes to Accounting, who choose the account and post the journal entry. Say what it is for in the reason.',
    counterparty: 'none',
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
      'others',
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

/** The memo number's placeholder until the memo exists. */
export function memoNumberPlaceholder(purpose: DrPurpose): string {
  return DR_PURPOSE_CONFIG[purpose].postsOnSubmit ? 'Assigned on submit' : 'Assigned on approval'
}

export const GIVEAWAY_RECIPIENT_LABELS: Record<DrGiveawayRecipient, string> = {
  customer: 'Customers',
  partner: 'Partners / suppliers',
}

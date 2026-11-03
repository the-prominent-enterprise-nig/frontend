/**
 * Scenario 62 — take a journal entry back to the document that posted it, so a
 * figure on a report can be traced: report → General Ledger → journal entry →
 * source document.
 *
 * A JE only carries free-text provenance (sourceModule, sourceDocumentId,
 * sourceDocumentNo) and several modules post more than one kind of document
 * under the same sourceModule (AR alone posts invoices, installment plans,
 * penalties, advances, unapplied collections and acknowledgement receipts).
 * Each case is told apart by what that posting code writes into the JE's own
 * description/code — the rules below mirror those call sites. Where the
 * document has no page of its own the link goes to the closest list, and
 * where there is nothing to open it returns null.
 */
export interface JournalSource {
  sourceModule?: string | null
  sourceDocumentId?: string | null
  sourceDocumentNo?: string | null
  /** The JE's own code (= the reference it was posted with). */
  code?: string | null
  /** The JE's own header description, not a line's. */
  description?: string | null
  /** The POS deposit a bank entry was posted for, resolved server-side from the
   * slips it was stamped on (only on the single-entry GET). */
  posDepositId?: string | null
}

export interface SourceLink {
  href: string
  /** What the link opens, e.g. "AR Invoice". */
  kind: string
  /** The closest list, because the document has no page of its own. Fine for
   * "where did this come from"; not a specific source, so amounts do not use
   * it. */
  list?: true
}

const q = (v: string) => encodeURIComponent(v)

export function sourceDocumentLink(je: JournalSource): SourceLink | null {
  const id = je.sourceDocumentId ?? ''
  const no = je.sourceDocumentNo ?? ''
  const code = je.code ?? ''
  const desc = je.description ?? ''
  const starts = (p: string) => desc.startsWith(p)

  switch (je.sourceModule) {
    case 'AR':
      if (starts('Installment Plan'))
        return no ? { href: `/pos/transactions?search=${q(no)}`, kind: 'POS Transaction' } : null
      if (starts('Penalty assessed:'))
        return id ? { href: `/crm/installment-accounts/${id}`, kind: 'Installment Account' } : null
      if (starts('Customer advance')) return null // no advances screen to open
      if (starts('Unapplied collection'))
        return {
          href: '/accounting/unapplied-collections',
          kind: 'Unapplied Collections',
          list: true,
        }
      if (starts('Acknowledgement Receipt'))
        return id
          ? {
              href: `/pos/collections/acknowledgement/view?id=${q(id)}`,
              kind: 'Acknowledgement Receipt',
            }
          : null
      return id ? { href: `/accounting/ar-invoices/${id}`, kind: 'AR Invoice' } : null

    case 'AP':
      if (starts('Expense '))
        return id ? { href: `/accounting/expenses/${id}`, kind: 'Expense' } : null
      return id
        ? { href: `/accounting/ap-bills/${id}`, kind: 'AP Bill' }
        : { href: '/accounting/ap-bills/payments', kind: 'AP Payments', list: true }

    case 'POS':
      if (starts('Installment Down Payment'))
        return no ? { href: `/pos/transactions?search=${q(no)}`, kind: 'POS Transaction' } : null
      if (/session/i.test(desc) && id && no === id)
        return { href: '/pos/sessions', kind: 'POS Sessions', list: true }
      if (/reservation/i.test(desc))
        return { href: '/pos/reservations', kind: 'Reservations', list: true }
      return id ? { href: `/pos/transactions?id=${q(id)}`, kind: 'POS Transaction' } : null

    case 'INVENTORY':
      if (starts('Manual Receiving Report'))
        return id
          ? { href: `/accounting/receiving-reports/manual-rr/${id}`, kind: 'Manual RR' }
          : null
      if (starts('Goods Receipt') || starts('Unit cost correction for'))
        return id ? { href: `/accounting/receiving-reports/${id}`, kind: 'Receiving Report' } : null
      if (starts('Repair Transfer'))
        return { href: '/inventory/uds', kind: 'Unit Document Sheets', list: true }
      if (starts('Stock Adjustment'))
        return { href: '/inventory/operations', kind: 'Stock Adjustments', list: true }
      if (starts('Item Revaluation'))
        return { href: '/inventory/revaluation', kind: 'Revaluations', list: true }
      if (starts('Landed Cost'))
        return { href: '/inventory/landed-cost', kind: 'Landed Costs', list: true }
      if (/^(EXC|RET)-/.test(code) || /^(EXC|RET)-/.test(no))
        return { href: '/inventory/returns', kind: 'Returns', list: true }
      return null

    case 'BANK':
      // A deposit's entry points at the deposit itself, whatever its slips'
      // numbers were posted as.
      if (je.posDepositId)
        return {
          href: `/accounting/cash-in-transit?deposit=${q(je.posDepositId)}`,
          kind: 'POS Deposit',
        }
      // Scenario 61 — an Inter-Account Transfer's JE points at the transfer.
      // Scenario 72 Part 4 — numbered INTRA0926-NNN since then; IAT-… before it.
      if ((no.startsWith('INTRA') || no.startsWith('IAT-')) && id)
        return { href: `/accounting/fund-transfers/${id}`, kind: 'Inter-Account Transfer' }
      if (code.startsWith('XFER-'))
        return { href: '/accounting/fund-transfers', kind: 'Inter-Account Transfers', list: true }
      if (code.startsWith('CIT-DEP-'))
        return { href: '/accounting/cash-in-transit', kind: 'Cash-in-Transit', list: true }
      if (code.startsWith('BANK-ADJ-') || code.startsWith('CLR-') || code.startsWith('UBC-'))
        return { href: '/accounting/bank-reconciliation', kind: 'Bank Reconciliation', list: true }
      return { href: '/accounting/bank-accounts', kind: 'Bank Accounts', list: true }

    case 'MANUAL':
      if (code.startsWith('REV-') && id)
        return { href: `/accounting/journal-entries/${id}`, kind: 'Reversed Entry' }
      if (code.startsWith('DISP-') || code.startsWith('DEP-'))
        return { href: '/accounting/fixed-assets', kind: 'Fixed Assets', list: true }
      if (starts('Employee Cash Loan'))
        return {
          href: `/accounting/employee-cash-loans${no ? `?search=${q(no)}` : ''}`,
          kind: 'Employee Cash Loans',
        }
      return null

    case 'RECURRING':
      return { href: '/accounting/recurring-entries', kind: 'Recurring Entries', list: true }

    default:
      return null
  }
}

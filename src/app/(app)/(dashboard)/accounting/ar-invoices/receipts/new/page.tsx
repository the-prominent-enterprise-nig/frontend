import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import NewReceiptForm from './_components/NewReceiptForm'

export const metadata = { title: 'New Receipt' }
// Scenario 79 — ?customerId&customerName&invoiceId pre-fill the form, as the
// CRM Installment Account page's "Record payment" links here for an
// imported/hand-entered account (POS Collections only lists POS-sale plans).
// ?returnTo sends the user back there after saving.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    customerId?: string
    customerName?: string
    invoiceId?: string
    returnTo?: string
  }>
}) {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.AR_INVOICES_READ)
  const { customerId, customerName, invoiceId, returnTo } = await searchParams
  return (
    <div className="min-h-screen bg-gray-50">
      <NewReceiptForm
        initialCustomer={customerId ? { id: customerId, name: customerName || 'Customer' } : null}
        initialInvoiceId={invoiceId ?? null}
        // Same-site paths only — never an absolute or protocol-relative URL
        // (browsers read "/\host" like "//host").
        returnTo={returnTo && /^\/(?![/\\])/.test(returnTo) ? returnTo : null}
      />
    </div>
  )
}

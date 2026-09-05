import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import RecordPaymentForm from './_components/RecordPaymentForm'

export const metadata = { title: 'Record Payment' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.AP_BILLS_PAY)
  return (
    <div className="min-h-screen bg-gray-50">
      {/* The form reads the selection carried over from AP Invoices via
          useSearchParams, which needs a Suspense boundary to render. */}
      <Suspense fallback={<div className="px-4 py-6 text-sm text-gray-400">Loading…</div>}>
        <RecordPaymentForm />
      </Suspense>
    </div>
  )
}

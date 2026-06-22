import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin } from '@/src/libs/guards/permission'
import { getOwnerPaymentMethods } from './_actions/owner-payment-methods'
import { OwnerPaymentMethodsSection } from '@/src/components/settings/OwnerPaymentMethodsSection'

export const metadata = { title: 'Configuration | Prominent Enterprise' }

export default async function ConfigurationPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!isAdmin(session)) redirect('/403')

  const paymentMethodsResult = await getOwnerPaymentMethods()

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">
          Global settings that apply across all branches.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <OwnerPaymentMethodsSection initialMethods={paymentMethodsResult.data ?? []} />
      </div>
    </div>
  )
}

import { getSessionOrNull } from '@/src/libs/auth/actions'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/src/libs/guards/permission'
import { getPaymentMethods } from '../../pos/_actions/pos-actions'
import PaymentMethodOptionsSection from './_components/PaymentMethodOptionsSection'

export const metadata = {
  title: 'Payment Methods | Prominent Enterprise',
}

// Scenario 37 — manages the named sub-choices under a payment method (POS
// Terminal for card, bank for bank_transfer, gateway for qr), tenant-wide.
// Per-branch enable/disable of the methods themselves already lives on each
// branch's own settings page (BranchPaymentMethodsSection) — this page is
// specifically for the option lists those methods offer at checkout.
export default async function PaymentMethodsSettingsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!isAdmin(session)) redirect('/403')

  const result = await getPaymentMethods()

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold text-zinc-900">Payment Methods</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Manage the named choices offered at checkout under Card, Bank Transfer, and QR — add,
            rename, or retire your own, without a deploy.
          </p>
        </div>
        <PaymentMethodOptionsSection
          initialMethods={result.success ? (result.data?.data ?? []) : []}
        />
      </div>
    </div>
  )
}

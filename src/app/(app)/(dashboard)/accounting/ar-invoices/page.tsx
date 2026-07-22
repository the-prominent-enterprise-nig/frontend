import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import ARInvoicesList from './_components/ARInvoicesList'

export const metadata = { title: 'AR Invoices' }
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  const { customerId } = await searchParams
  return (
    <div className="min-h-screen bg-gray-50">
      <ARInvoicesList initialCustomerId={customerId} />
    </div>
  )
}

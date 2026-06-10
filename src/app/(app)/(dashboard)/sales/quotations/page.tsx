export const dynamic = 'force-dynamic'

import { getQuotations } from '@/src/libs/actions/sales.actions'
import QuotationsClient from './QuotationsClient'

export default async function QuotationsPage() {
  const result = await getQuotations()
  const quotations = result.success && result.data ? result.data.data : []
  const total = result.success && result.data ? result.data.total : 0

  return <QuotationsClient initialData={quotations} initialTotal={total} />
}

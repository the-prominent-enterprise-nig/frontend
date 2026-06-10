export const dynamic = 'force-dynamic'

import { getOrders } from '@/src/libs/actions/sales.actions'
import OrdersClient from './OrdersClient'

export default async function SalesOrdersPage() {
  const result = await getOrders()
  const orders = result.success && result.data ? result.data.data : []
  const total = result.success && result.data ? result.data.total : 0

  return <OrdersClient initialData={orders} initialTotal={total} />
}

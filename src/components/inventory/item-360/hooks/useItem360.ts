'use client'

import { useQuery } from '@tanstack/react-query'
import { getItem } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-item'
import { getItemStockSummary } from '@/src/app/(app)/(dashboard)/inventory/stock/_actions/get-item-stock-summary'
import { getSerialNumbers } from '@/src/app/(app)/(dashboard)/inventory/serial-numbers/_actions/get-serial-numbers'
import { STALE } from '@/src/libs/query/stale-times'

export function useItem360(itemId: string, activeTab: string) {
  const item = useQuery({
    queryKey: ['inventory-item-360', itemId, 'overview'],
    queryFn: () => getItem(itemId),
    staleTime: STALE.OPERATIONAL,
    enabled: !!itemId,
  })

  const stock = useQuery({
    queryKey: ['inventory-item-360', itemId, 'stock'],
    queryFn: () => getItemStockSummary(itemId),
    staleTime: STALE.REALTIME,
    enabled: !!itemId && activeTab === 'stock',
  })

  const serials = useQuery({
    queryKey: ['inventory-item-360', itemId, 'serials'],
    queryFn: () => getSerialNumbers({ itemId, limit: 100 }),
    staleTime: STALE.OPERATIONAL,
    enabled: !!itemId && activeTab === 'serials',
  })

  return { item, stock, serials }
}

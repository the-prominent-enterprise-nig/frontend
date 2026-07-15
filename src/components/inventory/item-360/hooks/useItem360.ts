'use client'

import { useQuery } from '@tanstack/react-query'
import { getItem } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-item'
import { getItemStockSummary } from '@/src/app/(app)/(dashboard)/inventory/stock/_actions/get-item-stock-summary'
import { getSubstitutes } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/substitutes'
import { getChangeHistory } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/change-history'
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

  const substitutes = useQuery({
    queryKey: ['inventory-item-360', itemId, 'substitutes'],
    queryFn: () => getSubstitutes(itemId),
    staleTime: STALE.OPERATIONAL,
    enabled: !!itemId && activeTab === 'substitutes',
  })

  const history = useQuery({
    queryKey: ['inventory-item-360', itemId, 'history'],
    queryFn: () => getChangeHistory(itemId),
    staleTime: STALE.OPERATIONAL,
    enabled: !!itemId && activeTab === 'history',
  })

  return { item, stock, substitutes, history }
}

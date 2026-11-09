'use client'

import { useQuery } from '@tanstack/react-query'
import { getRepairProviders } from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_actions/get-repair-providers'

/**
 * Under a repair-provider picker: says why it lists every supplier — no
 * supplier is marked a service center yet — and where to fix that. Renders
 * nothing once any service center is marked.
 */
export function RepairProvidersFallbackNote(): React.JSX.Element | null {
  const { data } = useQuery({
    queryKey: ['repair-providers-fallback'],
    queryFn: () => getRepairProviders(),
    staleTime: 5 * 60 * 1000,
  })
  if (!data?.data?.fallback) return null
  return (
    <p className="mt-1 text-xs text-amber-700">No service centers set — showing all suppliers.</p>
  )
}

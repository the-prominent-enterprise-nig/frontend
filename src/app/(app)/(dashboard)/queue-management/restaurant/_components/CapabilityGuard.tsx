'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRestaurantConfig } from '@/src/libs/hooks/useRestaurantConfig'
import type { RestaurantCapabilities } from '@/src/libs/data/RestaurantData'

interface Props {
  capability: keyof RestaurantCapabilities
  children: React.ReactNode
  redirectTo?: string
}

export function CapabilityGuard({
  capability,
  children,
  redirectTo = '/queue-management/restaurant/settings',
}: Props) {
  const { data: config, isLoading } = useRestaurantConfig()
  const router = useRouter()

  const enabled = config?.capabilities?.[capability] ?? false

  useEffect(() => {
    if (!isLoading && !enabled) {
      router.replace(redirectTo)
    }
  }, [isLoading, enabled, redirectTo, router])

  if (isLoading || !enabled) return null

  return <>{children}</>
}

'use server'

import { api } from '@/src/libs/api/client'
import { EMPTY_ACCESS_MAP, type AccessMap } from '@/src/components/settings/module-map'

/**
 * The module map behind Roles & Access (Scenario 74). An empty map when it
 * can't be loaded: the screens then fall back to their per-resource labels.
 */
export async function getAccessMap(): Promise<AccessMap> {
  const result = await api.get<AccessMap>('/permissions/access-map', undefined, {
    tags: ['permissions', 'access-map'],
  })
  if (!result.success || !result.data) {
    console.error('Failed to load the access map:', result.error, result.message)
    return EMPTY_ACCESS_MAP
  }
  return result.data
}

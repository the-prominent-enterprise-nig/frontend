import { useQuery } from '@tanstack/react-query'
import { RestaurantConfigAPI, type RestaurantConfig } from '@/src/libs/data/RestaurantData'

export function useRestaurantConfig() {
  return useQuery<RestaurantConfig | null>({
    queryKey: ['restaurant-config'],
    queryFn: async () => {
      const res = await RestaurantConfigAPI.get()
      return res.success ? (res.data ?? null) : null
    },
    staleTime: 30_000,
  })
}

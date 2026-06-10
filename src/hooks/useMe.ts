import { useQuery } from '@tanstack/react-query'
import { getSession } from '@/src/libs/auth/actions'
import type { SessionUser } from '@/src/libs/guards/permission'

export const useMe = () => {
  return useQuery<SessionUser>({
    queryKey: ['me'],
    queryFn: getSession,
    retry: false,
  })
}

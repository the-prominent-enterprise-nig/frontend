import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import FloorBoard from './_components/FloorBoard'
import { CapabilityGuard } from './_components/CapabilityGuard'

export const metadata = { title: 'Restaurant Floor Board' }

export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <CapabilityGuard capability="floorPlan">
      <FloorBoard />
    </CapabilityGuard>
  )
}

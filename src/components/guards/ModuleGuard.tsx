import { canAccessModule } from '@/src/libs/guards/permission'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { redirect } from 'next/navigation'

export default async function ModuleGuard({
  module,
  children,
}: {
  module: string
  children: React.ReactNode
}) {
  const user = await getSessionOrNull()

  if (!user) {
    redirect('/login')
  }

  if (!canAccessModule(user, module)) {
    redirect('/403')
  }

  return <>{children}</>
}

import { getSessionOrNull } from '@/src/libs/auth/actions'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  redirect('/dashboard')
}

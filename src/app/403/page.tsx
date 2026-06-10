import { ShieldOff } from 'lucide-react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { logoutAndRedirect } from '@/src/libs/auth/actions/login'
import { redirect } from 'next/navigation'

export default async function ForbiddenPage() {
  const user = await getSessionOrNull()
  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <main className="flex flex-col items-center justify-center text-center px-4">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <ShieldOff className="h-10 w-10 text-red-500" />
        </div>

        <h1 className="text-5xl font-bold text-gray-900">403</h1>
        <p className="mt-2 text-xl font-semibold text-gray-700">Access Forbidden</p>
        <p className="mt-2 text-sm text-gray-500 max-w-sm">
          You don&apos;t have permission to view this page. Contact your administrator if you
          believe this is a mistake.
        </p>

        <form action={logoutAndRedirect} className="mt-8">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Sign out and try a different account
          </button>
        </form>
      </main>
    </div>
  )
}

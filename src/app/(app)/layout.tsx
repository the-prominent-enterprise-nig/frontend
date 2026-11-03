import TopBar from '@/src/components/layout/TopBar'
import SideBar from '@/src/components/layout/SideBar'
import { Toaster } from '@/src/components/ui/sonner'
import { getSessionState } from '@/src/libs/auth/actions'
import { QueryProvider } from '@/src/provider/query-provider'
import { redirect } from 'next/navigation'
import ShellProviders from '@/src/components/shell/ShellProviders'
import SessionUnavailable from '@/src/components/shell/SessionUnavailable'
import { isSuperAdmin } from '@/src/libs/guards/permission'

export function generateMetadata() {
  return {
    title: 'NIG Central',
    description: 'Main application layout for NIG Central',
  }
}

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const state = await getSessionState()

  // Only a session the backend actually rejected (or a missing cookie) is a
  // logout. A timeout or 5xx while the API is busy says nothing about whether
  // the user is signed in, so keep them here and retry instead of bouncing
  // them to /login.
  if (state.status === 'unauthenticated') {
    redirect('/login')
  }
  if (state.status === 'unavailable') {
    return <SessionUnavailable />
  }

  const session = state.session

  if (isSuperAdmin(session)) {
    redirect('/super-admin/dashboard')
  }

  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-black">
        <SideBar session={session} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar session={session} />
          {/* Non-scrolling positioning frame for full-content modals (`absolute
              inset-0`) — the actual page scrolls in the inner wrapper below.
              If `main` itself scrolled, an absolutely-positioned modal would
              be pinned to the top of the scrolled *content*, not the visible
              viewport, leaving the real page visible underneath it once the
              page had been scrolled. */}
          <main className="relative flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">{children}</div>
          </main>
        </div>
      </div>
      <Toaster position="top-right" richColors />
      <ShellProviders />
    </QueryProvider>
  )
}

import TopBar from '@/src/components/layout/TopBar'
import SideBar from '@/src/components/layout/SideBar'
import { Toaster } from '@/src/components/ui/sonner'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { QueryProvider } from '@/src/provider/query-provider'
import { redirect } from 'next/navigation'
import ShellProviders from '@/src/components/shell/ShellProviders'
import { isSuperAdmin } from '@/src/libs/guards/permission'

export function generateMetadata() {
  return {
    title: 'App - Prominent Enterprise',
    description: 'Main application layout for Prominent Enterprise',
  }
}

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let session = null
  try {
    session = await getSessionOrNull()
  } catch {
    redirect('/login')
  }

  if (!session) {
    redirect('/login')
  }

  if (isSuperAdmin(session)) {
    redirect('/super-admin/dashboard')
  }

  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-black">
        <SideBar session={session} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar session={session} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <Toaster position="top-right" richColors />
      <ShellProviders />
    </QueryProvider>
  )
}

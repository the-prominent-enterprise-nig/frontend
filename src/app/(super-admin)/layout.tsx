import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isSuperAdmin } from '@/src/libs/guards/permission'
import { SuperAdminSideBar } from '@/src/components/super-admin/SuperAdminSideBar'
import { Toaster } from '@/src/components/ui/sonner'

export function generateMetadata() {
  return {
    title: 'TPE Platform — Administration',
  }
}

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!isSuperAdmin(session)) redirect('/403')

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <SuperAdminSideBar email={session.email ?? ''} />
      <div className="flex flex-1 flex-col overflow-hidden bg-zinc-50">
        <header className="flex h-12 items-center border-b border-zinc-200 bg-white px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              Platform Administration
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600">
              Platform Admin
            </span>
            <span className="text-xs text-zinc-400">{session.email}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  )
}

import ModuleGuard from '@/src/components/guards/ModuleGuard'

export const metadata = {
  title: 'CRM - Prominent Enterprise',
  description: 'Manage leads, customers, and the sales pipeline',
}

export default function CrmLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ModuleGuard module="crm">
      <section className="min-h-full bg-gray-50">{children}</section>
    </ModuleGuard>
  )
}

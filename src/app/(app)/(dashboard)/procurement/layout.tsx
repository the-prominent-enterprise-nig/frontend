import ModuleGuard from '@/src/components/guards/ModuleGuard'

export const metadata = {
  title: 'Procurement - Prominent Enterprise',
  description: 'Manage suppliers, purchase requests, purchase orders, and goods receiving',
}

export default function ProcurementLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ModuleGuard module="procurement">
      <section className="min-h-full bg-gray-50">{children}</section>
    </ModuleGuard>
  )
}

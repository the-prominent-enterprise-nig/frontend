import ModuleGuard from '@/src/components/guards/ModuleGuard'

export function AccountingMetadata() {
  return {
    title: 'Accounting - Prominent Enterprise',
    description: 'Manage your accounting workflows with Prominent Enterprise',
  }
}

export default function AccountingLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <ModuleGuard module="accounting">{children}</ModuleGuard>
}

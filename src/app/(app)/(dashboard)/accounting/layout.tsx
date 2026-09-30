import ModuleGuard from '@/src/components/guards/ModuleGuard'

export function AccountingMetadata() {
  return {
    title: 'Accounting - NIG Central',
    description: 'Manage your accounting workflows with NIG Central',
  }
}

export default function AccountingLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <ModuleGuard module="accounting">{children}</ModuleGuard>
}

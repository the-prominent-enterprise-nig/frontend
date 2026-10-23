import ModuleGuard from '@/src/components/guards/ModuleGuard'

export function InventoryMetadata() {
  return {
    title: 'Inventory - NIG Central',
    description: 'Manage your inventory workflows with NIG Central',
  }
}

export default function InventoryLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <ModuleGuard module="inventory">{children}</ModuleGuard>
}

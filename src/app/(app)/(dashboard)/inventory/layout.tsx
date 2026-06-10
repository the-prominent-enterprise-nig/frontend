import ModuleGuard from '@/src/components/guards/ModuleGuard'

export function InventoryMetadata() {
  return {
    title: 'Inventory - Prominent Enterprise',
    description: 'Manage your inventory workflows with Prominent Enterprise',
  }
}

export default function InventoryLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <ModuleGuard module="inventory">{children}</ModuleGuard>
}

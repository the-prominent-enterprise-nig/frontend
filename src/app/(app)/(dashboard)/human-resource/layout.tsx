import ModuleGuard from '@/src/components/guards/ModuleGuard'
import HrShell from '@/src/components/human-resource/HrShell'

export function HumanResourcesMetadata() {
  return {
    title: 'Human Resources - Prominent Enterprise',
    description: 'Manage your human resources with Prominent Enterprise',
  }
}

export default function HumanResourcesLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ModuleGuard module="hr">
      <HrShell>{children}</HrShell>
    </ModuleGuard>
  )
}

import HrModuleCard from './HrModuleCard'
import { hrModules } from '@/src/libs/data/HrAdminData'

export default function HrModulesGrid() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Modules</h2>
        <p className="text-sm text-zinc-600">Open a section to manage HR records and workflows.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {hrModules.map((module) => (
          <HrModuleCard
            key={module.title}
            title={module.title}
            description={module.description}
            href={module.href}
            icon={module.icon}
          />
        ))}
      </div>
    </section>
  )
}

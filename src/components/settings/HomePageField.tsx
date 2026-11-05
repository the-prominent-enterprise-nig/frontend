'use client'

import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { HOME_MODULE_OPTIONS, isHomeModule } from '@/src/libs/guards/home-module'

type HomePageFieldProps = {
  /** The saved home page, or null for automatic. */
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
}

/**
 * A role's home page: where its people land after sign-in, and the menu and
 * dashboard they open with. Empty is automatic: the first module they can open.
 */
export default function HomePageField({ value, onChange, disabled }: HomePageFieldProps) {
  const current = isHomeModule(value) ? value : ''
  const hint =
    HOME_MODULE_OPTIONS.find((option) => option.value === current)?.hint ??
    'Automatic: lands in the first module this role can open.'

  return (
    <div>
      <SearchableSelect
        value={current}
        onChange={(next) => onChange(next === '' ? null : next)}
        options={HOME_MODULE_OPTIONS.map(({ value: v, label }) => ({ value: v, label }))}
        placeholder="Automatic"
        clearable
        // The field sits in a card with overflow-hidden (and in a grid on Create
        // Role); an in-flow list would be cut off by it.
        portal
        disabled={disabled}
      />
      <p className="mt-1 text-xs text-zinc-400">{hint}</p>
    </div>
  )
}

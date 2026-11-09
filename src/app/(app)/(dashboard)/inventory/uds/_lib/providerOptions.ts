import type { SearchableSelectOption } from '@/src/components/ui/SearchableSelect'

type ServiceCenter = { id: string; code: string; name: string }

/**
 * The repair-provider picker's options: every service center. `current` — the
 * ticket's provider today — stays in the list even when it is not marked a
 * service center (set before the flag existed), so it still shows by name.
 */
export function providerOptions(
  serviceCenters: ServiceCenter[],
  current?: ServiceCenter | null
): SearchableSelectOption[] {
  const sorted = [...serviceCenters].sort((a, b) => a.name.localeCompare(b.name))
  const list = current && !sorted.some((s) => s.id === current.id) ? [current, ...sorted] : sorted
  return list.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))
}

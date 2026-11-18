'use client'

import { useEffect, useState } from 'react'
import SegmentedControl from '@/src/components/ui/SegmentedControl'
import SearchableSelect, { type SearchableSelectOption } from '@/src/components/ui/SearchableSelect'
import { collectorsApi } from '@/src/libs/api/crm'
import type { Collector } from '@/src/schema/crm/types'

/** Whose receipt booklet (stub) the CR came off: the office's own, or a field
 * collector's — in which case the collector is named on the receipt. */
export type StubOwner = 'office' | 'field'

const STUB_OWNER_OPTIONS: { value: StubOwner; label: string }[] = [
  { value: 'office', label: 'Office' },
  { value: 'field', label: 'Field' },
]

const INVALID_CHROME = {
  idle: 'border-red-400',
  focused: 'border-red-500 ring-1 ring-red-500',
}

/** "Amoyot Sylvester · Mabini Central" — the area tells two same-named
 * collectors apart. The client's area codes use underscores
 * ("Mabini_Central"); they're shown as spaces here. */
function collectorOption(c: Collector): SearchableSelectOption {
  const area = (c.area || c.areaCode || '').replace(/_/g, ' ').trim()
  return { value: c.id, label: area ? `${c.name} · ${area}` : c.name }
}

/** The branch's active collectors, fetched only while Field is chosen. The
 * server already narrows a branch-assigned cashier to their own branch. */
function useBranchCollectors(
  branchId: string,
  enabled: boolean
): { options: SearchableSelectOption[]; loading: boolean } {
  const [options, setOptions] = useState<SearchableSelectOption[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    collectorsApi
      .list({ status: 'active', limit: 200, ...(branchId ? { branchId } : {}) })
      .then((res) => {
        if (cancelled) return
        setOptions(res.success && res.data ? res.data.data.map(collectorOption) : [])
        setLoading(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [branchId, enabled])
  return { options, loading }
}

export default function StubOwnerField({
  stubOwner,
  collectorId,
  branchId,
  invalid,
  onChange,
}: {
  stubOwner: StubOwner
  collectorId: string
  branchId: string
  /** Field is chosen but no collector is picked yet, and the cashier has
   * already pressed Collect payment. */
  invalid: boolean
  onChange: (next: { stubOwner: StubOwner; collectorId: string }) => void
}): React.ReactElement {
  const isField = stubOwner === 'field'
  const { options, loading } = useBranchCollectors(branchId, isField)

  return (
    <div className="space-y-3" data-testid="collection-stub-owner">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Stub owner <span className="text-red-500">*</span>
        </label>
        <SegmentedControl
          name="Stub owner"
          value={stubOwner}
          options={STUB_OWNER_OPTIONS}
          onChange={(value) => onChange({ stubOwner: value, collectorId: '' })}
        />
      </div>
      {isField && (
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Collector <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            ariaLabel="Collector"
            value={collectorId}
            options={options}
            loading={loading}
            loadingLabel="Loading collectors…"
            placeholder="Select collector"
            chrome={invalid ? INVALID_CHROME : undefined}
            portal
            onChange={(id) => onChange({ stubOwner, collectorId: id })}
          />
          {!loading && options.length === 0 && (
            <p className="mt-1 text-[12px] text-ink-muted">No active collectors at this branch.</p>
          )}
        </div>
      )}
    </div>
  )
}

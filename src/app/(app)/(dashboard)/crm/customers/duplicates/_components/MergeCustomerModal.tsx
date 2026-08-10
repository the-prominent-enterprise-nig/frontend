'use client'

import { useEffect, useState } from 'react'
import { X, ArrowRight } from 'lucide-react'
import { customersApi } from '@/src/libs/api/crm'
import type { Customer } from '@/src/schema/crm/types'
import type { UpdateCustomerInput } from '@/src/schema/crm/customer'

type CompareField = {
  key: keyof Customer & keyof UpdateCustomerInput
  label: string
}

// Only fields worth reviewing per-record — arrays (bankAccounts, coMakers)
// and file/consent fields are combined automatically by the merge itself,
// not something the reviewer picks a side for.
const COMPARE_FIELDS: CompareField[] = [
  { key: 'name', label: 'Name' },
  { key: 'customerType', label: 'Type' },
  { key: 'companyName', label: 'Company name' },
  { key: 'employeeNumber', label: 'Employee ID' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address' },
  { key: 'taxId', label: 'Tax ID' },
  { key: 'groupId', label: 'Group ID' },
  { key: 'idType', label: 'ID Type' },
  { key: 'idNumber', label: 'ID Number' },
  { key: 'notes', label: 'Notes' },
]

function fieldValue(c: Customer, key: CompareField['key']): string {
  const v = c[key]
  return v === null || v === undefined || v === '' ? '—' : String(v)
}

export default function MergeCustomerModal({
  open,
  onClose,
  onMerged,
  customerAId,
  customerBId,
}: {
  open: boolean
  onClose: () => void
  onMerged: () => void
  customerAId: string
  customerBId: string
}) {
  const [customerA, setCustomerA] = useState<Customer | null>(null)
  const [customerB, setCustomerB] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [survivorSide, setSurvivorSide] = useState<'A' | 'B'>('A')
  const [fieldChoices, setFieldChoices] = useState<Record<string, 'A' | 'B'>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    setCustomerA(null)
    setCustomerB(null)
    setFieldChoices({})
    Promise.all([customersApi.get(customerAId), customersApi.get(customerBId)]).then(
      ([resA, resB]) => {
        if (resA.success && resA.data && resB.success && resB.data) {
          setCustomerA(resA.data)
          setCustomerB(resB.data)
          // Default the survivor to whichever record is older — usually the
          // "original" profile the newer duplicate got created on top of.
          setSurvivorSide(
            new Date(resA.data.createdAt) <= new Date(resB.data.createdAt) ? 'A' : 'B'
          )
        } else {
          setError(resA.error ?? resB.error ?? 'Failed to load customer details')
        }
        setLoading(false)
      }
    )
  }, [open, customerAId, customerBId])

  if (!open) return null

  async function onMerge() {
    if (!customerA || !customerB) return
    setSubmitting(true)
    setError(null)

    const survivor = survivorSide === 'A' ? customerA : customerB
    const duplicate = survivorSide === 'A' ? customerB : customerA
    const fieldOverrides: Partial<UpdateCustomerInput> = {}
    for (const field of COMPARE_FIELDS) {
      const choice = fieldChoices[field.key] ?? survivorSide
      // Only need to send a value when the reviewer picked the *other*
      // record's value — the survivor's own current value needs no override.
      if (choice !== survivorSide) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(fieldOverrides as any)[field.key] = duplicate[field.key] ?? undefined
      }
    }

    const res = await customersApi.merge(survivor.id, duplicate.id, fieldOverrides)
    setSubmitting(false)
    if (res.success) {
      onMerged()
      onClose()
    } else {
      setError(res.message ?? 'Failed to merge customers')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Compare & merge</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">
              Pick which record survives, then resolve any conflicting fields.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && <p className="py-10 text-center text-gray-400">Loading…</p>}

        {!loading && customerA && customerB && (
          <>
            <div className="mb-5 grid grid-cols-2 gap-4">
              {(['A', 'B'] as const).map((side) => {
                const c = side === 'A' ? customerA : customerB
                const isSurvivor = survivorSide === side
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setSurvivorSide(side)}
                    className={`rounded-xl border-2 p-4 text-left transition-colors ${
                      isSurvivor
                        ? 'border-prominent-orange-500 bg-prominent-orange-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-gray-500">{c.customerCode}</span>
                      {isSurvivor && (
                        <span className="rounded-full bg-prominent-orange-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Keeps this record
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-medium text-gray-900">{c.name}</div>
                    <div className="mt-0.5 text-[12px] text-gray-500">
                      Created {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-[13px]">
                <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Field</th>
                    <th className="px-3 py-2">Record A</th>
                    <th className="px-3 py-2">Record B</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {COMPARE_FIELDS.map((field) => {
                    const valueA = fieldValue(customerA, field.key)
                    const valueB = fieldValue(customerB, field.key)
                    const differs = valueA !== valueB
                    const choice = fieldChoices[field.key] ?? survivorSide
                    return (
                      <tr key={field.key} className={differs ? 'bg-amber-50/50' : ''}>
                        <td className="px-3 py-2 font-medium text-gray-700">{field.label}</td>
                        {(['A', 'B'] as const).map((side) => (
                          <td key={side} className="px-3 py-2">
                            {differs ? (
                              <label className="flex cursor-pointer items-center gap-1.5">
                                <input
                                  type="radio"
                                  name={`field-${field.key}`}
                                  checked={choice === side}
                                  onChange={() =>
                                    setFieldChoices((f) => ({ ...f, [field.key]: side }))
                                  }
                                />
                                <span
                                  className={choice === side ? 'text-gray-900' : 'text-gray-500'}
                                >
                                  {side === 'A' ? valueA : valueB}
                                </span>
                              </label>
                            ) : (
                              <span className="text-gray-500">
                                {side === 'A' ? valueA : valueB}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-[12px] text-gray-500">
              Bank accounts, co-makers, POS/AR history, leads, and loyalty points from both records
              are combined onto the surviving record automatically — no need to pick a side for
              those.
            </p>

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={onMerge}
                className="inline-flex items-center gap-1.5 rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
              >
                {submitting ? 'Merging…' : 'Merge customers'}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

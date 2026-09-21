'use client'

import { useEffect, useRef, useState } from 'react'

import type { CustomerType } from '@/src/schema/crm/types'
import { BUSINESS_CATEGORY_OPTIONS } from '@/src/schema/crm/customer'
import PhilippineAddressPicker from '@/src/components/common/PhilippineAddressPicker'
import SearchableSelect from '@/src/components/ui/SearchableSelect'

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Days in a given 1-indexed month, leap years included. Day 0 of the next
 * month is the last day of this one. */
function daysInMonth(year: number, month: number): number {
  if (!year || !month) return 31
  return new Date(year, month, 0).getDate()
}

type BirthdayParts = { year: number; month: number; day: number }

function parseBirthday(value: string): BirthdayParts {
  const [y, m, d] = (value || '').split('-')
  return { year: Number(y) || 0, month: Number(m) || 0, day: Number(d) || 0 }
}

function composeBirthday({ year, month, day }: BirthdayParts): string {
  if (!year || !month || !day) return ''
  // Clamp so switching Jan 31 -> February can't produce the 31st.
  const clamped = Math.min(day, daysInMonth(year, month))
  return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`
}

/**
 * Month / day / year selects rather than a native `<input type="date">`.
 *
 * Birthdays are the one date in this app you can't reach from today — a
 * native picker opens on the current month and needs decades of paging to
 * get to a real birth year. Everywhere else still uses the native input,
 * which is fine for dates near today; this is deliberately the exception,
 * not the start of a migration.
 *
 * Emits the same 'YYYY-MM-DD' string the field always stored, and '' until
 * all three parts are chosen, so nothing downstream changes.
 */
function BirthdayPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  // The parent only stores a complete 'YYYY-MM-DD', so the three
  // in-progress picks have to live here. Deriving them from `value` alone
  // meant the first two selections composed to '' and the dropdowns snapped
  // straight back to their placeholders — nothing appeared selectable.
  const [parts, setParts] = useState<BirthdayParts>(() => parseBirthday(value))
  const lastEmitted = useRef(value)

  // Re-sync only on a genuinely external change (edit mode loading a
  // customer, or a form reset) — never from the '' this component itself
  // emits mid-selection, which would wipe the partial picks again.
  useEffect(() => {
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    setParts(parseBirthday(value))
  }, [value])

  const { year, month, day } = parts
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 100 }, (_, i) => thisYear - i)

  function emit(nextYear: number, nextMonth: number, nextDay: number) {
    // Clamp into the stored parts too, not just the emitted string. Keeping
    // the raw day here meant switching Jan 31 -> February left the Day box
    // holding 31 while the value said the 29th — the two disagreed and the
    // box showed nothing, since 31 matches no February option.
    const clampedDay = nextDay ? Math.min(nextDay, daysInMonth(nextYear, nextMonth)) : 0
    const next = { year: nextYear, month: nextMonth, day: clampedDay }
    setParts(next)
    const composed = composeBirthday(next)
    lastEmitted.current = composed
    onChange(composed)
  }

  // Moves focus along Month -> Day -> Year as each is picked, so the whole
  // birthday can be typed without reaching for the mouse: "mar" Enter "15"
  // Enter "1990". Kept local rather than pushed into SearchableSelect —
  // advancing to a sibling field is this picker's concern, not something
  // every dropdown in the app should start doing.
  const rowRef = useRef<HTMLDivElement>(null)
  function focusField(index: number) {
    const inputs = rowRef.current?.querySelectorAll('input')
    const next = inputs?.[index]
    if (next) window.setTimeout(() => next.focus(), 0)
  }

  return (
    // SearchableSelect rather than Select: typing filters the list, so a
    // year is reachable by typing "1990" instead of scrolling 100 rows, and
    // a month by typing "mar". Native <select> gave this for free via
    // type-to-jump; the custom Select does not, which is why the searchable
    // variant is the right one here.
    <div ref={rowRef} className="mt-1 grid grid-cols-3 gap-2">
      <SearchableSelect
        className="min-w-0"
        value={month ? String(month) : ''}
        onChange={(v) => {
          emit(year, Number(v), day)
          focusField(1)
        }}
        placeholder="Month"
        options={MONTH_LABELS.map((label, i) => ({
          value: String(i + 1),
          label,
        }))}
      />
      <SearchableSelect
        className="min-w-0"
        value={day ? String(day) : ''}
        onChange={(v) => {
          emit(year, month, Number(v))
          focusField(2)
        }}
        placeholder="Day"
        options={Array.from({ length: daysInMonth(year, month) }, (_, i) => ({
          value: String(i + 1),
          label: String(i + 1),
        }))}
      />
      <SearchableSelect
        className="min-w-0"
        value={year ? String(year) : ''}
        onChange={(v) => emit(Number(v), month, day)}
        placeholder="Year"
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
      />
    </div>
  )
}

export interface CustomerExtraFieldsValues {
  customerType: CustomerType
  companyName: string
  businessCategory: string
  employeeNumber: string
  birthday: string
  address: string
  barangayCode: string
  taxId: string
  isTaxExempt: boolean
  taxExemptionRef: string
  groupId: string
  notes: string
}

const BUSINESS_CATEGORY_LABELS: Record<string, string> = {
  private: 'Private',
  government: 'Government',
}

/**
 * The customer fields beyond name/phone/email that CRM's own customer-create
 * form and POS's walk-in customer modal both need — shared here so the two
 * don't drift into two different field sets/validation over time. Laid out
 * as a landscape 2x2 grid (not a stacked single column) so it reads as a
 * wide form, not a long scroll.
 */
export default function CustomerExtraFields({
  values,
  onChange,
  showGroupId = true,
}: {
  values: CustomerExtraFieldsValues
  onChange: (patch: Partial<CustomerExtraFieldsValues>) => void
  /** CRM's full customer form drops Group ID (superseded by clearer
   * grouping elsewhere); POS's quick walk-in modal keeps it, so this
   * defaults to on and CRM opts out explicitly. */
  showGroupId?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      {/* Top-left: identity */}
      <div className="space-y-3">
        <div>
          <label className="block text-[13px] font-medium text-gray-700">Type</label>
          <select
            value={values.customerType}
            onChange={(e) => onChange({ customerType: e.target.value as CustomerType })}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="individual">Individual</option>
            <option value="business">Business</option>
            <option value="employee">Employee</option>
          </select>
        </div>

        {values.customerType === 'business' && (
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Company name</label>
            <input
              value={values.companyName}
              maxLength={255}
              onChange={(e) => onChange({ companyName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none"
            />
          </div>
        )}

        {values.customerType === 'business' && (
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Business category</label>
            <select
              value={values.businessCategory}
              onChange={(e) => onChange({ businessCategory: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select category</option>
              {BUSINESS_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {BUSINESS_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        )}

        {values.customerType === 'employee' && (
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Employee ID</label>
            <input
              value={values.employeeNumber}
              maxLength={50}
              onChange={(e) => onChange({ employeeNumber: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none"
            />
          </div>
        )}

        <div>
          <label className="block text-[13px] font-medium text-gray-700">Birthday</label>
          <BirthdayPicker value={values.birthday} onChange={(v) => onChange({ birthday: v })} />
        </div>

        {showGroupId && (
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Group ID</label>
            <input
              value={values.groupId}
              maxLength={50}
              onChange={(e) => onChange({ groupId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Top-right: tax + terms */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Tax ID</label>
            <input
              value={values.taxId}
              maxLength={50}
              onChange={(e) => onChange({ taxId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none"
            />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <input
              id="isTaxExempt"
              type="checkbox"
              checked={values.isTaxExempt}
              onChange={(e) => onChange({ isTaxExempt: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="isTaxExempt" className="text-[13px] font-medium text-gray-700">
              Tax-exempt
            </label>
          </div>
        </div>
        {values.isTaxExempt && (
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Exemption ref</label>
            <input
              value={values.taxExemptionRef}
              maxLength={100}
              onChange={(e) => onChange({ taxExemptionRef: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Full width: address, with notes stacked underneath, smaller */}
      <div className="col-span-2">
        <label className="mb-1 block text-[13px] font-medium text-gray-700">Address</label>
        <PhilippineAddressPicker
          onChange={(v) => onChange({ address: v.address, barangayCode: v.barangayCode })}
          initialBarangayCode={values.barangayCode || undefined}
          initialAddress={values.address || undefined}
        />

        <label className="mt-3 mb-1 block text-[13px] font-medium text-gray-700">Notes</label>
        <textarea
          value={values.notes}
          maxLength={1000}
          rows={2}
          onChange={(e) => onChange({ notes: e.target.value })}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'

import type { CustomerType } from '@/src/schema/crm/types'
import { BUSINESS_CATEGORY_OPTIONS, CIVIL_STATUS_OPTIONS } from '@/src/schema/crm/customer'
import PhilippineAddressPicker from '@/src/components/common/PhilippineAddressPicker'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { Select } from '@/src/components/ui/Select'

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

/** Some parts picked, but not all three — which saves as no birthday. */
function isIncompleteBirthday({ year, month, day }: BirthdayParts): boolean {
  return !!(year || month || day) && !(year && month && day)
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
 * all three parts are chosen, so nothing downstream changes — plus whether
 * the parts picked so far are an unfinished birthday, so the form can stop
 * one being saved as no birthday at all (PR #199 review: a customer created
 * with a birthday reached the credit application with none).
 */
function BirthdayPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string, incomplete: boolean) => void
}) {
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
    onChange(composed, isIncompleteBirthday(next))
  }

  // Moves focus along Month -> Day -> Year as each is picked, so the whole
  // birthday can be typed without reaching for the mouse: "mar" Enter "15"
  // Enter "1990". Kept local rather than pushed into SearchableSelect —
  // advancing to a sibling field is this picker's concern, not something
  // every dropdown in the app should start doing.
  //
  // Only on a pick. A part kept from typed text as the user left (Tab, or a
  // click on another field) must not pull focus back here — Tab already
  // moves along this row by itself.
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
    //
    // commitOnBlur: what was typed counts when the user moves on, not only on
    // Enter — "21", Tab used to be thrown away. matchFrom="start": "2" offers
    // 2 and 20–29, and "19" offers the 1900s, not 2019 first. clearable: an
    // unfinished birthday needs a way back to blank.
    <div>
      <div ref={rowRef} className="mt-1 grid grid-cols-3 gap-2">
        <SearchableSelect
          className="min-w-0"
          value={month ? String(month) : ''}
          onChange={(v, reason) => {
            emit(year, Number(v), day)
            if (reason === 'select' && v) focusField(1)
          }}
          placeholder="Month"
          commitOnBlur
          matchFrom="start"
          clearable
          options={MONTH_LABELS.map((label, i) => ({
            value: String(i + 1),
            label,
          }))}
        />
        <SearchableSelect
          className="min-w-0"
          value={day ? String(day) : ''}
          onChange={(v, reason) => {
            emit(year, month, Number(v))
            if (reason === 'select' && v) focusField(2)
          }}
          placeholder="Day"
          commitOnBlur
          matchFrom="start"
          inputMode="numeric"
          clearable
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
          commitOnBlur
          matchFrom="start"
          inputMode="numeric"
          clearable
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
        />
      </div>
      {isIncompleteBirthday(parts) ? (
        <p className="mt-1 text-xs text-red-600">
          Pick the month, day and year — or clear them to leave the birthday blank.
        </p>
      ) : (
        <p className="mt-1 text-xs text-gray-400">Type or pick — e.g. sep, 21, 1990.</p>
      )}
    </div>
  )
}

export interface CustomerExtraFieldsValues {
  customerType: CustomerType
  /** Company name for a business, Employer for everyone else — one column,
   *  two labels. See the Customer type's comment for why. */
  companyName: string
  businessCategory: string
  employeeNumber: string
  birthday: string
  // Scenario 64 item 27 — the credit application mockup's CUSTOMER PROFILE
  // block. Captured here, on the customer, because the mockup prefills the
  // application from the profile rather than storing these per application.
  civilStatus: string
  gender: string
  facebookName: string
  address: string
  barangayCode: string
  homeAddress: string
  homeBarangayCode: string
  /** "Home address is same as current address" (PR #199 review). Ticked, the
   *  home block is hidden and the home address is saved empty — which every
   *  reader already treats as "same as current". */
  homeSameAsCurrent: boolean
  /** Some birthday parts picked but not all three. Not saved — the form
   *  refuses to submit while it is true, since it would save as no birthday. */
  birthdayIncomplete: boolean
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

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'self_employed', label: 'Self-employed' },
  { value: 'business', label: 'Business' },
  { value: 'employee', label: 'Employee' },
]

/** The same column under three names. A business has a company name, a
 *  self-employed customer has their own business, and everyone else has an
 *  employer — all of them "the organisation this customer is attached to",
 *  which is what `companyName` stores. Splitting them into three columns
 *  would leave two empty for every customer. */
const COMPANY_NAME_LABEL: Record<string, string> = {
  business: 'Company name',
  self_employed: 'Business name',
  individual: 'Employer',
  employee: 'Employer',
}

const GENDER_OPTIONS = [
  { value: 'M', label: 'M' },
  { value: 'F', label: 'F' },
]

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
  // One shared set of control classes — the fields used to be split between
  // two hand-built columns that had drifted into slightly different widths.
  const labelClass = 'block text-[13px] font-medium text-gray-700'
  const inputClass =
    'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none'

  return (
    /**
     * One flat two-column grid of fields, not two stacked columns of their
     * own (2026-09-30).
     *
     * The old layout hard-split into an identity column and a tax column.
     * Adding the credit-application profile fields put seven controls in the
     * left column against two in the right, so the left half became a cramped
     * scroll — Civil status and Gender ended up quarter-width inside it —
     * while the right half sat empty. Letting every field be a cell in one
     * grid keeps both halves used and every control the same width.
     *
     * Single column below `sm`: two half-width dropdowns on a phone are
     * worse than a list.
     */
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      <div>
        <label className={labelClass}>Type</label>
        <div className="mt-1">
          <Select
            value={values.customerType}
            onChange={(v) => onChange({ customerType: v as CustomerType })}
            options={CUSTOMER_TYPE_OPTIONS}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>
          {COMPANY_NAME_LABEL[values.customerType] ?? 'Employer'}
        </label>
        <input
          value={values.companyName}
          maxLength={255}
          placeholder={
            values.customerType === 'individual' || values.customerType === 'employee'
              ? 'Employer name, if employed'
              : ''
          }
          onChange={(e) => onChange({ companyName: e.target.value })}
          className={inputClass}
        />
      </div>

      {values.customerType === 'business' && (
        <div>
          <label className={labelClass}>Business category</label>
          <div className="mt-1">
            <Select
              value={values.businessCategory}
              onChange={(v) => onChange({ businessCategory: v })}
              options={BUSINESS_CATEGORY_OPTIONS.map((c) => ({
                value: c,
                label: BUSINESS_CATEGORY_LABELS[c],
              }))}
              placeholder="Select category"
            />
          </div>
        </div>
      )}

      {values.customerType === 'employee' && (
        <div>
          <label className={labelClass}>Employee ID</label>
          <input
            value={values.employeeNumber}
            maxLength={50}
            onChange={(e) => onChange({ employeeNumber: e.target.value })}
            className={inputClass}
          />
        </div>
      )}

      {/* Share one cell: Gender holds two one-letter options and looked
          absurd at the same width as everything else, so it takes a fixed
          narrow column and Civil status keeps the rest. */}
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <div className="min-w-0">
          <label className={labelClass}>Civil status</label>
          <div className="mt-1">
            <Select
              value={values.civilStatus}
              onChange={(v) => onChange({ civilStatus: v })}
              options={CIVIL_STATUS_OPTIONS.map((c) => ({ value: c, label: c }))}
              placeholder="Select"
            />
          </div>
        </div>

        <div className="min-w-0">
          <label className={labelClass}>Gender</label>
          <div className="mt-1">
            <Select
              value={values.gender}
              onChange={(v) => onChange({ gender: v })}
              options={GENDER_OPTIONS}
              placeholder="—"
            />
          </div>
        </div>
      </div>

      {/* Half width like every other field. It holds three selects, but a
          full-width row made Month/Day/Year enormous next to the controls
          above and below them — the row is short, not wide. */}
      <div>
        <label className={labelClass}>Birthday</label>
        <BirthdayPicker
          value={values.birthday}
          onChange={(birthday, birthdayIncomplete) => onChange({ birthday, birthdayIncomplete })}
        />
      </div>

      <div>
        <label className={labelClass}>
          Facebook / Messenger name <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          value={values.facebookName}
          maxLength={255}
          placeholder="Ask customer; enter name or None"
          onChange={(e) => onChange({ facebookName: e.target.value })}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Tax ID</label>
        <input
          value={values.taxId}
          maxLength={50}
          onChange={(e) => onChange({ taxId: e.target.value })}
          className={inputClass}
        />
      </div>

      <div className="flex items-end pb-2">
        <label className="flex items-center gap-2 text-[13px] font-medium text-gray-700">
          <input
            type="checkbox"
            checked={values.isTaxExempt}
            onChange={(e) => onChange({ isTaxExempt: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300"
          />
          Tax-exempt
        </label>
      </div>

      {values.isTaxExempt && (
        <div>
          <label className={labelClass}>Exemption ref</label>
          <input
            value={values.taxExemptionRef}
            maxLength={100}
            onChange={(e) => onChange({ taxExemptionRef: e.target.value })}
            className={inputClass}
          />
        </div>
      )}

      {showGroupId && (
        <div>
          <label className={labelClass}>Group ID</label>
          <input
            value={values.groupId}
            maxLength={50}
            onChange={(e) => onChange({ groupId: e.target.value })}
            className={inputClass}
          />
        </div>
      )}

      {/* Two addresses (Scenario 64 items 9/10). Current is first and is the
          one the rest of the app uses — collector assignment matches on its
          barangay, so it is the address someone will actually be sent to.
          Home is second and optional: it exists for the credit application,
          which asks for both, and most customers will leave it blank because
          it is the same place. */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-[13px] font-medium text-gray-700">Current address</label>
        <PhilippineAddressPicker
          onChange={(v) => onChange({ address: v.address, barangayCode: v.barangayCode })}
          initialBarangayCode={values.barangayCode || undefined}
          initialAddress={values.address || undefined}
        />

        <label className="mt-3 flex items-center gap-2 text-[13px] text-gray-700">
          <input
            type="checkbox"
            checked={values.homeSameAsCurrent}
            onChange={(e) => onChange({ homeSameAsCurrent: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300"
          />
          Home address is same as current address
        </label>

        {/* Removed rather than greyed out while ticked: the picker reads its
            starting values once, when it mounts, so a disabled copy of the
            current address would go stale the moment the current address
            changed. Unticking mounts it fresh with the saved home address. */}
        {!values.homeSameAsCurrent && (
          <div role="group" aria-label="Home address">
            <label className="mt-3 mb-1 block text-[13px] font-medium text-gray-700">
              Home address
            </label>
            <PhilippineAddressPicker
              onChange={(v) =>
                onChange({ homeAddress: v.address, homeBarangayCode: v.barangayCode })
              }
              initialBarangayCode={values.homeBarangayCode || undefined}
              initialAddress={values.homeAddress || undefined}
            />
          </div>
        )}

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

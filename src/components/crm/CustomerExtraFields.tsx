'use client'

import type { CustomerType } from '@/src/schema/crm/types'
import { BUSINESS_CATEGORY_OPTIONS } from '@/src/schema/crm/customer'
import PhilippineAddressPicker from '@/src/components/common/PhilippineAddressPicker'

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
  showAddressHint = false,
  showGroupId = true,
}: {
  values: CustomerExtraFieldsValues
  onChange: (patch: Partial<CustomerExtraFieldsValues>) => void
  /** Edit-only: the picker always starts blank (it can't reverse-parse a
   * saved free-text address back into region/province/city/barangay), so
   * surface what's already on file above it — otherwise an editor has no
   * way to see the current address before picking a new one. */
  showAddressHint?: boolean
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
          <input
            type="date"
            value={values.birthday}
            onChange={(e) => onChange({ birthday: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none"
          />
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
        {showAddressHint && values.address && (
          <p className="mb-1.5 text-xs text-gray-500">
            Current: <span className="text-gray-700">{values.address}</span> — pick below to replace
            it.
          </p>
        )}
        <PhilippineAddressPicker
          onChange={(v) => onChange({ address: v.address, barangayCode: v.barangayCode })}
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

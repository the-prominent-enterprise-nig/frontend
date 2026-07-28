'use client'

import { PAYMENT_TERMS_OPTIONS } from '@/src/schema/crm/customer'
import type { CustomerType, CustomerStatus } from '@/src/schema/crm/types'
import PhilippineAddressPicker from '@/src/components/common/PhilippineAddressPicker'

export interface CustomerExtraFieldsValues {
  customerType: CustomerType
  companyName: string
  employeeNumber: string
  shippingAddress: string
  taxId: string
  isTaxExempt: boolean
  taxExemptionRef: string
  paymentTerms: string
  status: CustomerStatus
  groupId: string
  notes: string
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
}: {
  values: CustomerExtraFieldsValues
  onChange: (patch: Partial<CustomerExtraFieldsValues>) => void
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
          <label className="block text-[13px] font-medium text-gray-700">Group ID</label>
          <input
            value={values.groupId}
            maxLength={50}
            onChange={(e) => onChange({ groupId: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none"
          />
        </div>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Payment terms</label>
            <select
              value={values.paymentTerms}
              onChange={(e) => onChange({ paymentTerms: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select terms</option>
              {PAYMENT_TERMS_OPTIONS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Status</label>
            <select
              value={values.status}
              onChange={(e) => onChange({ status: e.target.value as CustomerStatus })}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bottom-left: address */}
      <div>
        <label className="mb-1 block text-[13px] font-medium text-gray-700">Shipping address</label>
        <PhilippineAddressPicker onChange={(v) => onChange({ shippingAddress: v })} />
      </div>

      {/* Bottom-right: notes, height-matched to the address block beside it */}
      <div className="flex flex-col">
        <label className="block text-[13px] font-medium text-gray-700">Notes</label>
        <textarea
          value={values.notes}
          maxLength={1000}
          onChange={(e) => onChange({ notes: e.target.value })}
          className="mt-1 w-full flex-1 min-h-33 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Paperclip, Plus, Trash2, X } from 'lucide-react'
import PhoneInput, { parsePhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { customersApi } from '@/src/libs/api/crm'
import { uploadIdDocument } from '../_actions/upload-id-document'
import {
  createCustomerSchema,
  updateCustomerSchema,
  ID_TYPE_OPTIONS,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type CoMakerFormValues,
} from '@/src/schema/crm/customer'
import type {
  CustomerType,
  CustomerSourceChannel,
  DuplicateCheckResult,
} from '@/src/schema/crm/types'
import CustomerExtraFields from '@/src/components/crm/CustomerExtraFields'

type FormState = {
  customerCode: string
  firstName: string
  middleName: string
  lastName: string
  customerType: CustomerType
  companyName: string
  businessCategory: string
  employeeNumber: string
  birthday: string
  taxId: string
  isTaxExempt: boolean
  taxExemptionRef: string
  email: string
  phone: string
  address: string
  barangayCode: string
  creditLimit: string
  groupId: string
  sourceChannel: CustomerSourceChannel
  notes: string
  coMakers: CoMakerFormValues[]
  idType: string
  idNumber: string
  idDocumentFileId: string
  consentGiven: boolean
}

const empty: FormState = {
  customerCode: '',
  firstName: '',
  middleName: '',
  lastName: '',
  customerType: 'individual',
  companyName: '',
  businessCategory: '',
  employeeNumber: '',
  birthday: '',
  taxId: '',
  isTaxExempt: false,
  taxExemptionRef: '',
  email: '',
  phone: '',
  address: '',
  barangayCode: '',
  creditLimit: '',
  groupId: '',
  sourceChannel: 'pos_walkin',
  notes: '',
  coMakers: [],
  idType: '',
  idNumber: '',
  idDocumentFileId: '',
  consentGiven: false,
}

/**
 * PhoneInput's own `value` prop must always be E.164 (a leading `+`) or
 * `undefined` — some existing customer records predate this component
 * (imported/seeded data entered in a local format like "(656) 929-6118")
 * and break it otherwise, logging a console error every time that record's
 * edit form mounts. Best-effort re-parses a legacy value assuming PH as the
 * default country and returns its real E.164 form when that succeeds;
 * `undefined` otherwise (PhoneInput just renders empty — the underlying
 * `form.phone` state keeps the original raw string either way, so an
 * unrelated edit-and-save never silently overwrites/loses it).
 */
function toDisplayPhoneValue(raw: string): string | undefined {
  if (!raw) return undefined
  if (raw.startsWith('+')) return raw
  try {
    const parsed = parsePhoneNumber(raw, 'PH')
    return parsed?.isValid() ? parsed.number : undefined
  } catch {
    return undefined
  }
}

/**
 * Shared by both /crm/customers/new and /crm/customers/[id]/edit — a single
 * `id` prop switches the few things that genuinely differ (customer code,
 * source channel, POST-vs-PATCH, dirty-tracking, the create-only duplicate
 * check) so the two flows can no longer drift apart field-by-field the way
 * the previous two hand-rolled copies did.
 */
export default function CustomerForm({ id }: { id?: string }) {
  const isEdit = Boolean(id)
  const router = useRouter()
  const [form, setForm] = useState<FormState>(empty)
  const [initialForm, setInitialForm] = useState<FormState>(empty)
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // Scenario 02 (2026-07-31 update): non-blocking duplicate flag — never
  // prevents submission, just warns so the Cashier can double-check before
  // creating a second profile for the same person. Create-only: an existing
  // customer's own email/phone would otherwise "duplicate" against itself.
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCheckResult | null>(null)
  const [duplicateDismissed, setDuplicateDismissed] = useState(false)
  const duplicateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ID document upload — same central Files store + direct-upload server
  // action pattern as UDS's RFS form (uds/_actions/upload-rfs-form.ts).
  const [uploadingId, setUploadingId] = useState(false)
  const [idDocumentName, setIdDocumentName] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    customersApi.get(id).then((res) => {
      if (res.success && res.data) {
        const c = res.data
        // Prefer the real stored firstName/lastName (developer-requested
        // 2026-08-27) — only fall back to splitting the merged `name` on
        // its first space for a customer saved before those columns
        // existed and never re-saved since.
        const [splitFirst, ...splitLastParts] = c.name.split(' ')
        const loaded: FormState = {
          customerCode: c.customerCode,
          firstName: c.firstName ?? splitFirst ?? '',
          middleName: c.middleName ?? '',
          lastName: c.lastName ?? splitLastParts.join(' '),
          customerType: c.customerType,
          companyName: c.companyName ?? '',
          businessCategory: c.businessCategory ?? '',
          employeeNumber: c.employeeNumber ?? '',
          birthday: c.birthday ? c.birthday.slice(0, 10) : '',
          taxId: c.taxId ?? '',
          isTaxExempt: c.isTaxExempt,
          taxExemptionRef: c.taxExemptionRef ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          address: c.address ?? '',
          barangayCode: c.barangayCode ?? '',
          creditLimit: c.creditLimit != null ? String(c.creditLimit) : '',
          groupId: c.groupId ?? '',
          sourceChannel: c.sourceChannel,
          notes: c.notes ?? '',
          coMakers: (c.coMakers ?? []).map((cm) => ({
            name: cm.name,
            relationship: cm.relationship,
            contactNumber: cm.contactNumber,
            email: cm.email ?? '',
          })),
          idType: c.idType ?? '',
          idNumber: c.idNumber ?? '',
          idDocumentFileId: c.idDocumentFile?.id ?? '',
          consentGiven: c.consentGiven,
        }
        setForm(loaded)
        setInitialForm(loaded)
        setIdDocumentName(c.idDocumentFile?.originalName ?? null)
      } else {
        setServerError(res.error ?? 'Customer not found')
      }
      setLoading(false)
    })
  }, [id])

  const hasChanges = JSON.stringify(form) !== JSON.stringify(initialForm)

  async function handleIdFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingId(true)
    const formData = new FormData()
    formData.set('file', file)
    const result = await uploadIdDocument(formData)
    setUploadingId(false)

    if (result.success && result.data) {
      setField('idDocumentFileId', result.data.id)
      setIdDocumentName(result.data.originalName)
    } else {
      setServerError(result.message ?? 'ID document upload failed')
      e.target.value = ''
    }
  }

  useEffect(() => {
    if (isEdit) return
    const email = form.email.trim()
    const phone = form.phone.trim()
    if (!email && !phone) {
      setDuplicateWarning(null)
      return
    }
    if (duplicateTimer.current) clearTimeout(duplicateTimer.current)
    duplicateTimer.current = setTimeout(async () => {
      const res = await customersApi.checkDuplicate({
        email: email || undefined,
        phone: phone || undefined,
      })
      if (res.success && res.data) {
        setDuplicateWarning(res.data.duplicate ? res.data : null)
        setDuplicateDismissed(false)
      }
    }, 300)
    return () => {
      if (duplicateTimer.current) clearTimeout(duplicateTimer.current)
    }
  }, [form.email, form.phone, isEdit])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const shared = {
      name: `${form.firstName} ${form.lastName}`.trim(),
      firstName: form.firstName,
      middleName: form.middleName || undefined,
      lastName: form.lastName,
      customerType: form.customerType,
      companyName: form.customerType === 'business' ? form.companyName || undefined : undefined,
      businessCategory:
        form.customerType === 'business' && form.businessCategory
          ? (form.businessCategory as 'private' | 'government')
          : undefined,
      employeeNumber:
        form.customerType === 'employee' ? form.employeeNumber || undefined : undefined,
      birthday: form.birthday ? new Date(form.birthday) : undefined,
      taxId: form.taxId || undefined,
      isTaxExempt: form.isTaxExempt,
      taxExemptionRef: form.taxExemptionRef || undefined,
      email: form.email || undefined,
      phone: form.phone,
      address: form.address || undefined,
      barangayCode: form.barangayCode || undefined,
      creditLimit: form.creditLimit === '' ? undefined : Number(form.creditLimit),
      groupId: form.groupId || undefined,
      notes: form.notes || undefined,
      coMakers: form.coMakers.map((cm) => ({ ...cm, email: cm.email || undefined })),
      idType: form.idType || undefined,
      idNumber: form.idNumber || undefined,
      idDocumentFileId: form.idDocumentFileId || undefined,
      consentGiven: form.consentGiven,
    }

    setSubmitting(true)

    if (isEdit && id) {
      const payload: UpdateCustomerInput = {
        ...shared,
        customerCode: form.customerCode,
        sourceChannel: form.sourceChannel,
        // Only stamp a new consentGivenAt when consent is being turned on
        // *this* edit — otherwise omit it so the backend keeps the original
        // grant date instead of re-stamping it on every unrelated save.
        consentGivenAt: form.consentGiven && !initialForm.consentGiven ? new Date() : undefined,
      }
      const parsed = updateCustomerSchema.safeParse(payload)
      if (!parsed.success) {
        const errs: Record<string, string> = {}
        parsed.error.issues.forEach((i) => {
          errs[i.path[0] as string] = i.message
        })
        setErrors(errs)
        setSubmitting(false)
        return
      }
      setErrors({})
      const res = await customersApi.update(id, parsed.data)
      setSubmitting(false)
      if (res.success) {
        router.push(`/crm/customers/${id}`)
        router.refresh()
      } else {
        setServerError(res.error ?? 'Failed to update customer')
      }
    } else {
      const payload: CreateCustomerInput = {
        ...shared,
        // Fixed, not user-selectable — this form is a direct manual add
        // under CRM; a new customer always starts active, matching the
        // backend's own default.
        status: 'active',
        sourceChannel: 'sales',
        consentGivenAt: form.consentGiven ? new Date() : undefined,
      }
      const parsed = createCustomerSchema.safeParse(payload)
      if (!parsed.success) {
        const errs: Record<string, string> = {}
        parsed.error.issues.forEach((i) => {
          errs[i.path[0] as string] = i.message
        })
        setErrors(errs)
        setSubmitting(false)
        return
      }
      setErrors({})
      const res = await customersApi.create(parsed.data)
      setSubmitting(false)
      if (res.success && res.data) {
        router.push(`/crm/customers/${res.data.id}`)
        router.refresh()
      } else {
        setServerError(res.error ?? 'Failed to create customer')
      }
    }
  }

  if (loading) {
    return <div className="px-6 py-8 text-gray-400">Loading customer…</div>
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href={isEdit ? `/crm/customers/${id}` : '/crm/customers'}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {isEdit ? 'Back to customer' : 'Back to customers'}
      </Link>

      <h1 className="text-2xl font-semibold text-prominent-purple-900">
        {isEdit ? 'Edit Customer' : 'New Customer'}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {isEdit
          ? 'Update profile, billing, tax, and account status.'
          : 'Create a customer profile — no sale required.'}
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 space-y-5 rounded-xl border border-gray-200 bg-white p-6"
      >
        {isEdit && (
          <Field
            label="Customer code *"
            error={errors.customerCode}
            value={form.customerCode}
            onChange={(v) => setField('customerCode', v)}
          />
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field
            label="First name *"
            value={form.firstName}
            maxLength={120}
            onChange={(v) => setField('firstName', v)}
          />
          <Field
            label="Last name *"
            value={form.lastName}
            maxLength={120}
            onChange={(v) => setField('lastName', v)}
          />
          <Field
            label="Middle name"
            value={form.middleName}
            maxLength={120}
            onChange={(v) => setField('middleName', v)}
          />
        </div>
        {errors.name && <p className="-mt-3 text-[12px] text-red-600">{errors.name}</p>}

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Email"
            error={errors.email}
            value={form.email}
            maxLength={255}
            type="email"
            onChange={(v) => setField('email', v)}
          />
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Phone *</label>
            <PhoneInput
              value={toDisplayPhoneValue(form.phone ?? '')}
              defaultCountry="PH"
              international
              countryCallingCodeEditable={false}
              onChange={(v) => setField('phone', v ?? '')}
              numberInputProps={{ className: 'phone-input-field' }}
              className="ph-phone-input mt-1"
            />
            {errors.phone && <p className="mt-1 text-[12px] text-red-600">{errors.phone}</p>}
          </div>
        </div>

        {!isEdit && duplicateWarning?.duplicate && !duplicateDismissed && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              A customer named{' '}
              <span className="font-medium">{duplicateWarning.customer?.name}</span> already has
              this {duplicateWarning.matchedField}. You can still create this profile if it&apos;s a
              different person.
            </div>
            <button
              type="button"
              onClick={() => setDuplicateDismissed(true)}
              className="shrink-0 text-amber-600 hover:text-amber-800"
              aria-label="Dismiss duplicate warning"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <CustomerExtraFields
          values={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          showAddressHint={isEdit}
          showGroupId={false}
        />

        {isEdit && (
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Source channel</label>
            <select
              value={form.sourceChannel ?? 'pos_walkin'}
              onChange={(e) => setField('sourceChannel', e.target.value as CustomerSourceChannel)}
              className="mt-1 w-full max-w-xs rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="pos_walkin">POS Walk-in</option>
              <option value="sales">Sales</option>
              <option value="crm_lead">CRM Lead</option>
              <option value="online">Online</option>
            </select>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-[13px] font-medium text-gray-700">
              Co-maker (guarantor)
            </label>
            <button
              type="button"
              onClick={() =>
                setField('coMakers', [
                  ...form.coMakers,
                  { name: '', relationship: '', contactNumber: '', email: '' },
                ])
              }
              className="flex items-center gap-1 text-[12px] font-medium text-prominent-orange-700 hover:text-prominent-orange-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add co-maker
            </button>
          </div>
          <div className="mt-2 space-y-3">
            {form.coMakers.map((cm, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-2 rounded-lg border border-gray-200 p-3"
              >
                <div>
                  <label className="block text-[12px] font-medium text-gray-600">Name</label>
                  <input
                    value={cm.name}
                    maxLength={255}
                    placeholder="e.g. Juan Dela Cruz"
                    onChange={(e) => {
                      const next = [...form.coMakers]
                      next[idx] = { ...next[idx], name: e.target.value }
                      setField('coMakers', next)
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-600">
                    Relationship
                  </label>
                  <input
                    value={cm.relationship}
                    maxLength={100}
                    placeholder="e.g. Spouse"
                    onChange={(e) => {
                      const next = [...form.coMakers]
                      next[idx] = { ...next[idx], relationship: e.target.value }
                      setField('coMakers', next)
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-600">
                    Contact number
                  </label>
                  <input
                    value={cm.contactNumber}
                    maxLength={50}
                    placeholder="e.g. 0917 000 1111"
                    onChange={(e) => {
                      const next = [...form.coMakers]
                      next[idx] = { ...next[idx], contactNumber: e.target.value }
                      setField('coMakers', next)
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-600">Email</label>
                  <input
                    value={cm.email ?? ''}
                    maxLength={255}
                    type="email"
                    onChange={(e) => {
                      const next = [...form.coMakers]
                      next[idx] = { ...next[idx], email: e.target.value }
                      setField('coMakers', next)
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setField(
                      'coMakers',
                      form.coMakers.filter((_, i) => i !== idx)
                    )
                  }
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove co-maker"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-gray-700">
            ID & Consent <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-600">ID Type</label>
              <select
                value={form.idType}
                onChange={(e) => setField('idType', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">Select ID type</option>
                {ID_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600">ID Number</label>
              <input
                value={form.idNumber}
                maxLength={100}
                onChange={(e) => setField('idNumber', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-[12px] font-medium text-gray-600">ID Document</label>
            <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-500">
              <Paperclip className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {uploadingId ? 'Uploading…' : (idDocumentName ?? 'Attach a scanned ID')}
              </span>
              <input
                type="file"
                className="hidden"
                disabled={uploadingId}
                onChange={handleIdFileChange}
              />
            </label>
          </div>
          <div className="mt-3 flex items-start gap-2">
            <input
              id="consentGiven"
              type="checkbox"
              checked={form.consentGiven}
              onChange={(e) => setField('consentGiven', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="consentGiven" className="text-[13px] text-gray-700">
              Customer has given consent to store their ID information on file.
            </label>
          </div>
        </div>

        {serverError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            href={isEdit ? `/crm/customers/${id}` : '/crm/customers'}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || (isEdit && !hasChanges)}
            className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
          >
            {isEdit
              ? submitting
                ? 'Saving…'
                : 'Save changes'
              : submitting
                ? 'Creating…'
                : 'Create customer'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  error,
  maxLength,
  max,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  maxLength?: number
  max?: number
  type?: string
}) {
  // Derived, stable id — also lets tests target fields via getByLabel()
  // instead of brittle selectors, since label/input weren't otherwise linked.
  const id = `field-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value ?? ''}
        maxLength={maxLength}
        max={max}
        min={type === 'number' ? 0 : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none"
      />
      {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}
    </div>
  )
}

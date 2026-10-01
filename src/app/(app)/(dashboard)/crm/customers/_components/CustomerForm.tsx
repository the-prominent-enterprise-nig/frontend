'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Paperclip, X } from 'lucide-react'
import { customersApi } from '@/src/libs/api/crm'
import { posCustomersApi } from '@/src/libs/api/pos-customers'
import { showToast } from '@/src/components/ui/toast'
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
  CustomerAccountType,
  DuplicateCheckResult,
} from '@/src/schema/crm/types'
import CustomerExtraFields from '@/src/components/crm/CustomerExtraFields'
import { BranchesApi, type BranchLite } from '@/src/libs/data/OrgStructureData'
import { PhoneField } from '@/src/components/ui/PhoneField'
import { Select } from '@/src/components/ui/Select'
import SearchableSelect from '@/src/components/ui/SearchableSelect'

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
  // Scenario 64 item 27 — the credit application mockup's CUSTOMER PROFILE
  // block. `isSelfEmployed` is a string here ('' / 'yes' / 'no') because
  // unanswered is a third state, not false.
  altPhone: string
  civilStatus: string
  gender: string
  facebookName: string
  taxId: string
  isTaxExempt: boolean
  taxExemptionRef: string
  email: string
  phone: string
  address: string
  barangayCode: string
  homeAddress: string
  homeBarangayCode: string
  creditLimit: string
  groupId: string
  branchId: string
  accountType: CustomerAccountType
  sourceChannel: CustomerSourceChannel
  notes: string
  coMakers: CoMakerFormValues[]
  idType: string
  idNumber: string
  idDocumentFileId: string
  consentGiven: boolean
}

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'charge', label: 'Charge' },
]

const SOURCE_CHANNEL_OPTIONS = [
  { value: 'pos_walkin', label: 'POS Walk-in' },
  { value: 'sales', label: 'Sales' },
  { value: 'crm_lead', label: 'CRM Lead' },
  { value: 'online', label: 'Online' },
]

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
  altPhone: '',
  civilStatus: '',
  gender: '',
  facebookName: '',
  taxId: '',
  isTaxExempt: false,
  taxExemptionRef: '',
  email: '',
  phone: '',
  address: '',
  barangayCode: '',
  homeAddress: '',
  homeBarangayCode: '',
  creditLimit: '',
  groupId: '',
  branchId: '',
  accountType: 'cash',
  sourceChannel: 'pos_walkin',
  notes: '',
  coMakers: [],
  idType: '',
  idNumber: '',
  idDocumentFileId: '',
  consentGiven: false,
}

/**
 * Shared by both /crm/customers/new and /crm/customers/[id]/edit — a single
 * `id` prop switches the few things that genuinely differ (customer code,
 * source channel, POST-vs-PATCH, dirty-tracking, the create-only duplicate
 * check) so the two flows can no longer drift apart field-by-field the way
 * the previous two hand-rolled copies did.
 */
export default function CustomerForm({
  id,
  returnTo,
  scope = 'crm',
}: {
  id?: string
  /** Where to go when this form is done — on save in either mode, and on
   * Back/Cancel. On CREATE the new customer is appended as `?customerId=`
   * so the caller can pick them up; POS checkout's "New Customer" button
   * relies on that to get the cashier back to the till with the customer
   * attached. On EDIT it is simply the page the caller came from, which is
   * how the list's Edit action returns to the list rather than to a profile
   * the cashier never visited.
   *
   * Already validated as an internal path by the page via safeReturnTo() —
   * never interpolate a raw query param into a redirect. */
  returnTo?: string
  /** Which module is hosting this form. Selects the API it writes through
   * and the routes it navigates back to, so the POS copy uses
   * pos:customers:* and returns to /pos/customers instead of stranding a
   * cashier in a CRM route they cannot open. Both APIs reach the same
   * Customer table through the same CustomerService — it is the permission
   * surface that differs, not the data (2026-09-19 review request).
   *
   * A plain string rather than the API object itself: these pages are
   * server components, and functions cannot cross the server/client
   * boundary as props. Passing the object threw "Functions cannot be passed
   * directly to Client Components". */
  scope?: 'crm' | 'pos'
}) {
  const isEdit = Boolean(id)
  const api = scope === 'pos' ? posCustomersApi : customersApi
  const basePath = scope === 'pos' ? '/pos/customers' : '/crm/customers'
  const router = useRouter()
  // In create mode a returnTo overrides the normal "back to the list"
  // destination, so Back/Cancel return the cashier to the till rather than
  // stranding them in CRM.
  // Both modules have a customer detail page to land on after a save or a
  // cancel — CRM's full 360, POS's read-only profile — so this resolves the
  // same way for either scope.
  const detailHref = (customerId: string) => `${basePath}/${customerId}`
  // returnTo wins in BOTH modes. Reaching Edit from the list and pressing
  // Back used to land on the customer's profile — a page the cashier had
  // not come from — because edit mode always resolved to the detail route.
  // The caller says where it sent you from; only fall back to the profile
  // when nobody said.
  const cancelHref = returnTo ?? (isEdit && id ? detailHref(id) : basePath)
  const [form, setForm] = useState<FormState>(empty)
  const [initialForm, setInitialForm] = useState<FormState>(empty)
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [branches, setBranches] = useState<BranchLite[]>([])

  useEffect(() => {
    BranchesApi.list().then((r) => setBranches(r.data?.data ?? []))
  }, [])

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
    api.get(id).then((res) => {
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
          altPhone: c.altPhone ?? '',
          civilStatus: c.civilStatus ?? '',
          gender: c.gender ?? '',
          facebookName: c.facebookName ?? '',
          taxId: c.taxId ?? '',
          isTaxExempt: c.isTaxExempt,
          taxExemptionRef: c.taxExemptionRef ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          address: c.address ?? '',
          barangayCode: c.barangayCode ?? '',
          homeAddress: c.homeAddress ?? '',
          homeBarangayCode: c.homeBarangayCode ?? '',
          creditLimit: c.creditLimit != null ? String(c.creditLimit) : '',
          groupId: c.groupId ?? '',
          branchId: c.branchId ?? '',
          accountType: c.accountType ?? 'cash',
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
      const res = await api.checkDuplicate({
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
      // Sent for every customer type since 2026-09-30, not business-only:
      // the credit application mockup asks for an individual's employer, and
      // this is the column that holds it (see the Customer type's comment).
      companyName: form.companyName || undefined,
      businessCategory:
        form.customerType === 'business' && form.businessCategory
          ? (form.businessCategory as 'private' | 'government')
          : undefined,
      employeeNumber:
        form.customerType === 'employee' ? form.employeeNumber || undefined : undefined,
      birthday: form.birthday ? new Date(form.birthday) : undefined,
      altPhone: form.altPhone || undefined,
      civilStatus: form.civilStatus
        ? (form.civilStatus as 'Single' | 'Married' | 'Widowed' | 'Separated')
        : undefined,
      gender: form.gender ? (form.gender as 'M' | 'F') : undefined,
      facebookName: form.facebookName || undefined,
      taxId: form.taxId || undefined,
      isTaxExempt: form.isTaxExempt,
      taxExemptionRef: form.taxExemptionRef || undefined,
      email: form.email || undefined,
      phone: form.phone,
      address: form.address || undefined,
      barangayCode: form.barangayCode || undefined,
      homeAddress: form.homeAddress || undefined,
      homeBarangayCode: form.homeBarangayCode || undefined,
      creditLimit: form.creditLimit === '' ? undefined : Number(form.creditLimit),
      groupId: form.groupId || undefined,
      branchId: form.branchId || undefined,
      accountType: form.accountType,
      notes: form.notes || undefined,
      // coMakers is deliberately NOT sent. This form no longer captures them,
      // and CustomerService.update() treats a provided array as a full
      // replace — deleteMany + recreate — which hands every co-maker a new id
      // and, because CreditApplication.coMakerId is an optional FK (SET NULL
      // on delete), silently detaches the guarantor from every credit
      // application referencing them. Verified live 2026-09-16. Omitting the
      // key takes the service's untouched path instead.
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
          errs[i.path.join('.')] = i.message
        })
        setErrors(errs)
        setSubmitting(false)
        return
      }
      setErrors({})
      const res = await api.update(id, parsed.data)
      setSubmitting(false)
      if (res.success) {
        showToast({ title: 'Customer updated', status: 'success' })
        router.push(returnTo ?? detailHref(id))
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
          errs[i.path.join('.')] = i.message
        })
        setErrors(errs)
        setSubmitting(false)
        return
      }
      setErrors({})
      const res = await api.create(parsed.data)
      setSubmitting(false)
      if (res.success && res.data) {
        // Confirms the save before navigating away. Matters most on the
        // returnTo path: the caller's page just repopulates with the new
        // customer selected, which on its own is easy to misread as
        // "nothing happened". The Toaster is mounted in (app)/layout, so
        // the toast outlives this route change.
        showToast({
          title: 'Customer saved',
          description: res.data.name ? `${res.data.name} (${res.data.customerCode})` : undefined,
          status: 'success',
        })
        if (returnTo) {
          // Hand the new customer back to whoever sent us here (POS
          // checkout attaches them to the open sale). name is passed so the
          // caller can label the customer without a second fetch.
          const sep = returnTo.includes('?') ? '&' : '?'
          const label = encodeURIComponent(res.data.name ?? '')
          router.push(`${returnTo}${sep}customerId=${res.data.id}&customerName=${label}`)
        } else {
          router.push(detailHref(res.data.id))
        }
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
        href={cancelHref}
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

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Email (optional)"
            error={errors.email}
            value={form.email}
            maxLength={255}
            type="email"
            onChange={(v) => setField('email', v)}
          />
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Phone *</label>
            <PhoneField
              value={form.phone ?? ''}
              onChange={(v) => setField('phone', v)}
              className="mt-1"
            />
            {errors.phone && <p className="mt-1 text-[12px] text-red-600">{errors.phone}</p>}
          </div>
          <div>
            {/* Scenario 64 item 27 — "Alt mobile (optional)". Sits beside the
                main number rather than in the extra fields below, because
                the two are only ever read together, and the duplicate check
                above deliberately still looks at `phone` alone: a shared
                second number is not the same person. */}
            <label className="block text-[13px] font-medium text-gray-700">
              Alt mobile <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <PhoneField
              value={form.altPhone ?? ''}
              onChange={(v) => setField('altPhone', v)}
              className="mt-1"
            />
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
          showGroupId={false}
        />

        {/* Both drive the CRM customer list's filters. accountType is stored
            rather than derived from whether an installment account exists,
            so it stays correctable by hand.

            Edit-only since 2026-09-21 (review request: "For Customer
            Creation, can we remove these"). Neither is known at the counter
            when someone is first being written down — Branch defaults to
            "— None —" and Cash-or-charge to Cash, so both were just noise
            on the create screen, and Cash-or-charge in particular implied a
            decision the till has not made yet. They stay on Edit because
            that is exactly where correcting them is the point; the same
            treatment Source channel already gets below.

            The submitted values are unchanged: a new customer still posts
            branchId undefined (the "— None —" option's own value) and
            accountType 'cash', which is what picking the defaults by hand
            did anyway. */}
        {isEdit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[13px] font-medium text-gray-700">Branch</label>
              {/* SearchableSelect, not Select: this tenant runs 25-odd
                  branches, so the list is one to type into rather than
                  scroll. Clearable, because "— None —" is a real state a
                  customer can go back to. */}
              <SearchableSelect
                className="mt-1"
                value={form.branchId}
                onChange={(v) => setField('branchId', v)}
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                placeholder="— None —"
                clearable
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700">Cash or charge</label>
              <div className="mt-1">
                <Select
                  value={form.accountType}
                  onChange={(v) => setField('accountType', v as CustomerAccountType)}
                  options={ACCOUNT_TYPE_OPTIONS}
                />
              </div>
            </div>
          </div>
        )}

        {isEdit && (
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Source channel</label>
            <div className="mt-1 max-w-xs">
              <Select
                value={form.sourceChannel ?? 'pos_walkin'}
                onChange={(v) => setField('sourceChannel', v as CustomerSourceChannel)}
                options={SOURCE_CHANNEL_OPTIONS}
              />
            </div>
          </div>
        )}

        {/* Co-maker capture lives on the Credit Application, not here — a
            customer profile is just the customer. The existing coMakers are
            still hydrated and submitted unchanged above so editing a profile
            never wipes guarantors captured elsewhere. */}

        <div>
          <label className="block text-[13px] font-medium text-gray-700">
            ID & Consent <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-600">ID Type</label>
              {/* compact to match the ID Number input beside it, which is
                  py-1.5 rather than the form's usual py-2. */}
              <div className="mt-1">
                <Select
                  value={form.idType}
                  onChange={(v) => setField('idType', v)}
                  options={ID_TYPE_OPTIONS.map((t) => ({ value: t, label: t }))}
                  placeholder="Select ID type"
                  compact
                />
              </div>
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
            href={cancelHref}
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

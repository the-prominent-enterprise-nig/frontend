'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, Check, Loader2, Pencil, ShoppingCart } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import { MONO } from '@/src/libs/design/plex'
import type { SupplierDetail } from '@/src/schema/inventory/suppliers'
import { getSupplier } from '../_actions/get-supplier'
import { updateSupplier } from '../_actions/update-supplier'
import {
  fmtCreditLimit,
  nextOnboardingStep,
  ONBOARDING_META,
  readinessChecks,
  STATUS_META,
  supplierSubline,
  termsLabel,
  typeLabel,
  vatLabel,
  withholdingLabel,
  type OnboardingStatus,
} from '../_lib/supplier-format'
import SupplierItemsPanel from './SupplierItemsPanel'

type AccountOption = { id: string; name: string; number?: string }
type ItemOption = { id: string; name: string; sku: string }
type Tab = 'items' | 'profile' | 'banks'

const TABS: { id: Tab; label: string }[] = [
  { id: 'items', label: 'Items carried' },
  { id: 'profile', label: 'Profile' },
  { id: 'banks', label: 'Bank accounts' },
]

const monoHeadClass = `${MONO} text-[10px] font-semibold uppercase tracking-[0.09em] text-[#5b5b6b]`

/** One fact, read-only. A blank reads grey — these are facts about a supplier,
 * not gaps somebody has to close; the onboarding card above says which of them
 * actually cost anything. */
function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  const shown = value?.trim()
  return (
    <div className="min-w-0">
      <p className={monoHeadClass}>{label}</p>
      <p
        className={`mt-0.5 truncate text-[12.5px] font-medium ${shown ? 'text-[#17171c]' : 'text-[#a3a3b2]'}`}
        title={shown || undefined}
      >
        {shown || 'Not set'}
      </p>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  const shown = value?.trim()
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-[#5b5b6b]">{label}</p>
      <p
        className={`mt-0.5 text-[12.5px] font-medium break-words ${shown ? 'text-[#17171c]' : 'text-[#a3a3b2]'}`}
      >
        {shown || 'Not set'}
      </p>
    </div>
  )
}

function ProfileGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className={monoHeadClass}>{title}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">{children}</div>
    </div>
  )
}

export default function SupplierDetailPanel({
  supplierId,
  itemOptions,
  accountOptions,
  canUpdate,
  canBuy,
  onEdit,
  onBack,
}: {
  supplierId: string
  itemOptions: ItemOption[]
  accountOptions: AccountOption[]
  canUpdate: boolean
  /** Whether this reader may start a purchase at all — the same PR_CREATE
   * the Procurement screen gates its own "+ New Purchase" on. */
  canBuy: boolean
  /** Opens the form over this supplier. The panel asks rather than owning the
   * form, so the directory keeps one modal for both create and edit. */
  onEdit: (supplier: SupplierDetail) => void
  /** Phone only — the list and the panel share the screen there, so the panel
   * has to hand it back. */
  onBack: () => void
}) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('items')
  const [confirmingBlock, setConfirmingBlock] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['supplier', supplierId],
    queryFn: () => getSupplier(supplierId),
    staleTime: 30_000,
  })

  const supplier = detailQuery.data?.success ? detailQuery.data.data : undefined

  const onboardingMutation = useMutation({
    mutationFn: (onboardingStatus: OnboardingStatus) =>
      updateSupplier(supplierId, { onboardingStatus }),
    onSuccess: (result, onboardingStatus) => {
      setConfirmingBlock(false)
      if (!result.success) {
        showToast({
          title: 'Could not change the onboarding',
          description: result.message || result.error,
          status: 'error',
        })
        return
      }
      showToast({
        title: `Onboarding moved to ${ONBOARDING_META[onboardingStatus].label.toLowerCase()}`,
        description:
          onboardingStatus === 'approved'
            ? 'The buying team can raise purchase orders against this supplier now.'
            : onboardingStatus === 'blocked'
              ? 'No new purchase orders may be raised against it.'
              : undefined,
        status: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['supplier', supplierId] })
      queryClient.invalidateQueries({ queryKey: ['suppliers-directory'] })
    },
  })

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-[#e4e4e9] bg-white py-20 text-[#8b8b9b]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="rounded-xl border border-[#f3c9c5] bg-[#fdeceb] px-5 py-6">
        <p className="text-sm font-medium text-[#8f1c14]">Could not load this supplier</p>
        <p className="mt-1 text-xs text-[#b42318]">
          {detailQuery.data?.message || 'Please try again.'}
        </p>
        <button
          type="button"
          onClick={() => detailQuery.refetch()}
          className="mt-3 rounded-lg border border-[#f3c9c5] bg-white px-3 py-1.5 text-xs font-medium text-[#b42318] hover:bg-[#fff5f4]"
        >
          Try again
        </button>
      </div>
    )
  }

  const status = STATUS_META[supplier.status]
  const onboarding = ONBOARDING_META[supplier.onboardingStatus]
  const unfinished = supplier.onboardingStatus !== 'approved'
  const isBlocked = supplier.onboardingStatus === 'blocked'
  const step = nextOnboardingStep(supplier.onboardingStatus)
  // Nothing new may be raised against a blocked onboarding or a blacklisted
  // supplier — the screen that says so is also the one that offers to buy.
  const blockedFromBuying = isBlocked || supplier.status === 'blacklisted'
  const checks = readinessChecks(supplier)
  const gaps = checks.filter((c) => !c.ok)
  const busy = onboardingMutation.isPending

  const accountLabel = (id: string | null | undefined): string | null => {
    if (!id) return null
    const account = accountOptions.find((a) => a.id === id)
    if (!account) return 'On file'
    return account.number ? `${account.number} — ${account.name}` : account.name
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#e4e4e9] bg-white">
      {/* ── Head ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3.5 border-b border-[#eeeef1] px-4 py-4 md:px-5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 self-start text-xs font-medium text-[#3f1490] lg:hidden"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All suppliers
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-semibold tracking-tight text-[#17171c] md:text-xl">
                {supplier.name}
              </h2>
              <span
                title={status.hint}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-0.5 text-[11.5px] font-medium ${status.chip}`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`} />
                {status.label}
              </span>
              {unfinished && (
                <span
                  title={onboarding.hint}
                  className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ${onboarding.chip}`}
                >
                  {onboarding.label}
                </span>
              )}
            </div>
            <p className="mt-1 text-[12.5px] text-[#5b5b6b]">{supplierSubline(supplier)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                onClick={() => onEdit(supplier)}
                className="flex items-center gap-1.5 rounded-lg border border-[#d3d3db] bg-white px-3 py-2 text-[12.5px] font-medium text-[#17171c] hover:border-[#a3a3b2] hover:bg-[#fbfbfc]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit supplier
              </button>
            )}
            {/* Opens Procurement's own create form with this supplier already
                picked. Says "purchase", not "purchase order", because that is
                what it drafts — a purchase request, which becomes a PO once
                it is approved. Withheld while the supplier is barred: the
                form would let them raise it and the approver would have to
                be the one to say no. */}
            {canBuy && !blockedFromBuying && (
              <Link
                href={`/inventory/purchase-orders?tab=orders&newFor=${encodeURIComponent(supplier.id)}&supplierName=${encodeURIComponent(supplier.name)}`}
                title={`Draft a purchase from ${supplier.name} — it becomes a purchase order once approved`}
                className="flex items-center gap-1.5 rounded-lg bg-[#5b21b6] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#4a189b] hover:no-underline"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                New purchase
              </Link>
            )}
          </div>
        </div>

        {/* Onboarding — only while it is unfinished. Once approved the
            supplier just works, and a card saying so is noise. */}
        {unfinished && (
          <div
            className={`flex flex-col gap-3 rounded-xl px-4 py-3.5 ${
              isBlocked
                ? 'border border-[#f3c9c5] bg-[#fffbfb]'
                : 'border border-[#f5e2c6] bg-[#fffdf8]'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3.5">
              <div className="min-w-0">
                <p
                  className={`text-[13px] font-semibold ${isBlocked ? 'text-[#b42318]' : 'text-[#8a4b06]'}`}
                >
                  {onboarding.headline}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#3d3d4a]">
                  {isBlocked
                    ? supplier.notes?.trim() ||
                      'Somebody stopped this onboarding. Reopen it to carry on.'
                    : gaps.length > 0
                      ? `${gaps.length} of ${checks.length} requirements outstanding — you can still approve, but every gap carries into the documents raised against this supplier.`
                      : 'Everything is on file. Approve to let the buying team raise purchase orders.'}
                </p>
              </div>
              {canUpdate && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {!isBlocked && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmingBlock(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-[#f3c9c5] bg-white px-3 py-2 text-[12.5px] font-medium text-[#b42318] hover:bg-[#fff5f4] disabled:opacity-50"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Block
                    </button>
                  )}
                  {step && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onboardingMutation.mutate(step.next)}
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50 ${
                        step.tone === 'green'
                          ? 'bg-[#0f7b52] hover:bg-[#0b6644]'
                          : 'bg-[#5b21b6] hover:bg-[#4a189b]'
                      }`}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      {step.label}
                    </button>
                  )}
                </div>
              )}
            </div>

            {!isBlocked && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-[#f2e6d2] pt-3 lg:grid-cols-4">
                {checks.map((check) => (
                  <div key={check.key} className="flex min-w-0 items-start gap-2">
                    <span
                      className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                        check.ok
                          ? 'bg-[#0f7b52] text-white'
                          : 'border border-[#d9bb84] bg-white text-transparent'
                      }`}
                    >
                      {check.ok ? '✓' : ''}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-[12px] font-medium ${check.ok ? 'text-[#17171c]' : 'text-[#8a4b06]'}`}
                      >
                        {check.label}
                      </p>
                      <p className="truncate text-[10.5px] text-[#5b5b6b]" title={check.note}>
                        {check.note}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* The four terms every document raised against this supplier inherits. */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#eeeef1] pt-3.5 lg:grid-cols-4">
          <Fact label="Payment terms" value={termsLabel(supplier.paymentTerms)} />
          <Fact label="Credit limit" value={fmtCreditLimit(supplier.creditLimit)} />
          <Fact label="Input VAT" value={vatLabel(supplier.defaultInputVat)} />
          <Fact
            label="Withholding"
            value={withholdingLabel(supplier.defaultWithholding, supplier.alphanumericTaxCode)}
          />
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[#eeeef1] px-4 md:px-5">
        {TABS.map((t) => {
          const isOn = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={isOn ? 'page' : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 pb-2.5 pt-3 text-[12.5px] ${
                isOn
                  ? 'border-[#5b21b6] font-semibold text-[#3f1490]'
                  : 'border-transparent text-[#5b5b6b] hover:text-[#17171c]'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="px-4 py-4 md:px-5">
        {tab === 'items' && (
          <SupplierItemsPanel
            key={supplier.id}
            supplierId={supplier.id}
            itemOptions={itemOptions}
            canUpdate={canUpdate}
          />
        )}

        {tab === 'profile' && (
          <div className="flex flex-col gap-5">
            <ProfileGroup title="Identity">
              <FieldRow label="Legal name" value={supplier.legalName} />
              <FieldRow label="Tax ID / TIN" value={supplier.taxId} />
              <FieldRow label="Type" value={typeLabel(supplier.type)} />
              <FieldRow label="Business type" value={supplier.businessType} />
            </ProfileGroup>
            <ProfileGroup title="Contact">
              <FieldRow label="Contact person" value={supplier.contactPerson} />
              <FieldRow label="Email" value={supplier.email} />
              <FieldRow label="Phone" value={supplier.phone} />
              <FieldRow label="Address" value={supplier.address} />
            </ProfileGroup>
            <ProfileGroup title="Buying terms">
              <FieldRow label="Payment terms" value={termsLabel(supplier.paymentTerms)} />
              <FieldRow label="Discount terms" value={supplier.discountTerms} />
              <FieldRow label="Currency" value={supplier.currency} />
              <FieldRow label="Credit limit" value={fmtCreditLimit(supplier.creditLimit)} />
            </ProfileGroup>
            <ProfileGroup title="Tax defaults">
              <FieldRow label="Default input VAT" value={vatLabel(supplier.defaultInputVat)} />
              <FieldRow
                label="Default withholding"
                value={supplier.defaultWithholding === 'none' ? 'None' : '1%'}
              />
              <FieldRow label="ATC" value={supplier.alphanumericTaxCode} />
              <FieldRow label="Tax rate" value={supplier.taxRate} />
            </ProfileGroup>
            <ProfileGroup title="Accounting">
              <FieldRow
                label="Default AP account"
                value={accountLabel(supplier.defaultPayableAccountId) ?? 'Uses the default mapping'}
              />
              <FieldRow
                label="Default expense account"
                value={accountLabel(supplier.defaultExpenseAccountId) ?? 'Uses the default mapping'}
              />
              <FieldRow label="Notes" value={supplier.notes} />
            </ProfileGroup>
          </div>
        )}

        {tab === 'banks' &&
          (supplier.bankAccounts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d3d3db] px-5 py-10 text-center">
              <p className="text-sm font-medium text-[#3d3d4a]">No bank account on file</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#5b5b6b]">
                Payments to this supplier cannot be released until one is recorded. Add it from{' '}
                <span className="font-medium text-[#3d3d4a]">Edit supplier</span>.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {supplier.bankAccounts.map((account) => (
                <div
                  key={account.id}
                  className={`rounded-xl px-4 py-3.5 ${
                    account.isPrimary
                      ? 'border border-[#cfe9dd] bg-[#fbfefc]'
                      : 'border border-[#e4e4e9] bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className="text-[13px] font-semibold text-[#17171c]">{account.bankName}</p>
                    {account.isPrimary && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#e7f5ef] text-[#0b6644]">
                        primary
                      </span>
                    )}
                  </div>
                  <p className={`${MONO} mt-1 text-[12px] text-[#3d3d4a]`}>
                    {account.accountNumber}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-[#5b5b6b]">
                    {account.accountName?.trim() || 'No account name on file'}
                  </p>
                </div>
              ))}
            </div>
          ))}
      </div>

      <ConfirmDialog
        open={confirmingBlock}
        title={`Block ${supplier.name}?`}
        message={
          <p>
            No new purchase order may be raised against a blocked supplier. Anything already raised
            is untouched, and the onboarding can be reopened later.
          </p>
        }
        confirmLabel="Block supplier"
        destructive
        loading={busy}
        onConfirm={() => onboardingMutation.mutate('blocked')}
        onCancel={() => setConfirmingBlock(false)}
      />
    </div>
  )
}

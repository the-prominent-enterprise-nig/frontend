'use client'

/* Scenario 72 Part 4 — the internal debit memo (DMINV), laid out as the
 * client's "Debit memo" form: number, date, purpose, branch, department,
 * reference, reason, then Account / Description / Debit / Credit with totals.
 * Accounting edits a draft and posts it; posting a DR's memo moves the DR's
 * stock and posts this journal entry together. Same full-screen shell as the
 * Delivery Receipt. */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Controller, FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Ban, Loader2 } from 'lucide-react'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import { showToast } from '@/src/components/ui/toast'
import { CONTROL_CHROME } from '@/src/libs/design/plex'
import {
  DR_PURPOSE_CONFIG,
  DR_PURPOSE_GROUPS,
  drPurposeLabel,
} from '@/src/libs/inventory/delivery-receipt-purposes'
import {
  IdmFormSchema,
  type IdmDetail,
  type IdmFormValues,
} from '@/src/schema/accounting/inventory-debit-memos'
import {
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  DrShell,
  Field,
  HeaderFigure,
  INPUT,
  NumberChip,
  READONLY,
  Section,
  TEXTAREA,
} from '../../../../inventory/delivery-receipts/_components/drFormUi'
import { ReasonDialog } from '../../../../inventory/delivery-receipts/_components/ReasonDialog'
import { fmtDrDate, fmtPeso } from '../../../../inventory/delivery-receipts/_lib/dr-format'
import {
  postInventoryDebitMemo,
  saveInventoryDebitMemo,
  voidInventoryDebitMemo,
} from '../_actions/inventory-debit-memos'
import { IdmLinesSection } from './IdmLinesSection'

const BACK_HREF = '/accounting/debit-memos'

/** Memo purposes only — the ones that carry a DMINV memo. */
const PURPOSE_OPTIONS = DR_PURPOSE_GROUPS[0].purposes
  .filter((p) => p !== 'return_to_supplier')
  .map((p) => ({ value: p, label: DR_PURPOSE_CONFIG[p].label }))

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-[#f1f1f4] text-[#3d3d4a]',
  POSTED: 'bg-[#e7f5ef] text-[#0b6644]',
  VOID: 'bg-[#f1f1f4] text-[#8b8b9b] line-through',
}

export type IdmPermissions = { canEdit: boolean; canPost: boolean; canVoid: boolean }

function toFormValues(memo: IdmDetail | null): IdmFormValues {
  const day = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : '')
  if (!memo) {
    return {
      memoDate: new Date().toISOString().slice(0, 10),
      purpose: '',
      referenceNo: '',
      referenceDate: '',
      reason: '',
      lines: [
        { accountId: '', description: '', debit: 0, credit: 0 },
        { accountId: '', description: '', debit: 0, credit: 0 },
      ],
    }
  }
  return {
    memoDate: day(memo.memoDate),
    purpose: memo.purpose ?? '',
    referenceNo: memo.referenceNo ?? '',
    referenceDate: day(memo.referenceDate),
    reason: memo.reason ?? '',
    lines: memo.lines.map((l) => ({
      accountId: l.accountId,
      description: l.description ?? '',
      debit: l.debit,
      credit: l.credit,
    })),
  }
}

export default function IdmEditor({
  memo,
  permissions,
}: {
  /** Null for a new standalone memo. */
  memo: IdmDetail | null
  permissions: IdmPermissions
}): React.JSX.Element {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<'save' | 'post' | null>(null)
  const [confirmingPost, setConfirmingPost] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const form = useForm<IdmFormValues>({
    resolver: zodResolver(IdmFormSchema),
    defaultValues: toFormValues(memo),
  })
  const isDraft = !memo || memo.status === 'DRAFT'
  const readOnly = !isDraft || !permissions.canEdit

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['inventory-debit-memos'] })
    router.refresh()
  }

  async function onSave(values: IdmFormValues): Promise<void> {
    setBusy('save')
    const res = await saveInventoryDebitMemo(memo?.id ?? null, values)
    setBusy(null)
    if (!res.success || !res.data) {
      showToast({ title: res.message ?? 'Failed to save', status: 'error' })
      return
    }
    showToast({ title: res.message ?? 'Saved', status: 'success' })
    if (!memo) router.push(`/accounting/debit-memos/inventory/${res.data.id}`)
    else await refresh()
  }

  /** Saves the screen first, so what posts is what is on screen. */
  async function onPost(): Promise<void> {
    if (!memo) return
    setBusy('post')
    // Always saved, not only when dirty: formState.isDirty only tracks once it
    // has been read during render, so checking it here would skip the save.
    const saved = await saveInventoryDebitMemo(memo.id, form.getValues())
    if (!saved.success) {
      setBusy(null)
      setConfirmingPost(false)
      showToast({ title: saved.message ?? 'Failed to save', status: 'error' })
      return
    }
    const res = await postInventoryDebitMemo(memo.id)
    setBusy(null)
    setConfirmingPost(false)
    if (!res.success) {
      showToast({ title: res.message ?? 'Failed to post', status: 'error' })
      return
    }
    showToast({ title: `${memo.memoNumber} posted`, status: 'success' })
    await refresh()
  }

  async function onVoid(reason: string): Promise<boolean> {
    if (!memo) return false
    const res = await voidInventoryDebitMemo(memo.id, reason)
    if (!res.success) {
      showToast({ title: res.message ?? 'Failed to void', status: 'error' })
      return false
    }
    showToast({ title: `${memo.memoNumber} voided`, status: 'success' })
    await refresh()
    return true
  }

  return (
    <FormProvider {...form}>
      <DrShell
        title={memo ? 'Debit memo' : 'New debit memo'}
        chip={memo && <MemoChips memo={memo} />}
        subtitle={subtitle(memo)}
        headerAside={<TotalFigure />}
        status={statusLine(memo)}
        actions={
          <>
            {memo && permissions.canVoid && memo.status !== 'VOID' && (
              <button type="button" onClick={() => setVoiding(true)} className={BTN_GHOST}>
                <span className="flex items-center gap-2 text-[#b42318]">
                  <Ban className="h-4 w-4" />
                  Void
                </span>
              </button>
            )}
            <Link href={BACK_HREF} className={BTN_GHOST}>
              {readOnly ? 'Back to list' : 'Cancel'}
            </Link>
            {!readOnly && (
              <button
                type="button"
                onClick={form.handleSubmit(onSave)}
                disabled={!!busy}
                className={memo && permissions.canPost ? BTN_SECONDARY : BTN_PRIMARY}
              >
                {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}
                {memo ? 'Save draft' : 'Save as draft'}
              </button>
            )}
            {memo && isDraft && permissions.canPost && (
              <button
                type="button"
                onClick={form.handleSubmit(() => setConfirmingPost(true))}
                disabled={!!busy}
                className={BTN_PRIMARY}
              >
                {busy === 'post' && <Loader2 className="h-4 w-4 animate-spin" />}
                Post
              </button>
            )}
          </>
        }
      >
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()} noValidate>
          {memo?.status === 'VOID' && memo.voidReason && (
            <div className="rounded-xl border border-[#f3c9c5] bg-[#fdeceb] px-4 py-3 text-[13px] text-[#8f1c14]">
              <strong>Voided:</strong> {memo.voidReason}
            </div>
          )}
          <MemoHeaderSection memo={memo} readOnly={readOnly} />
          <IdmLinesSection readOnly={readOnly} />
        </form>
      </DrShell>
      {memo && (
        <ConfirmDialog
          open={confirmingPost}
          title={`Post ${memo.memoNumber}?`}
          message={postMessage(memo)}
          confirmLabel="Post"
          loading={busy === 'post'}
          onConfirm={onPost}
          onCancel={() => setConfirmingPost(false)}
        />
      )}
      {memo && (
        <ReasonDialog
          open={voiding}
          title={`Void ${memo.memoNumber}?`}
          description={
            memo.status === 'POSTED'
              ? 'Its journal entry is reversed and any units it took out go back on the shelf. Its delivery receipt is voided too.'
              : 'Nothing has posted yet. Its delivery receipt is voided and the held units go back on the shelf.'
          }
          confirmLabel="Void memo"
          onConfirm={onVoid}
          onClose={() => setVoiding(false)}
        />
      )}
    </FormProvider>
  )
}

function MemoChips({ memo }: { memo: IdmDetail }): React.JSX.Element {
  return (
    <>
      <NumberChip>{memo.memoNumber}</NumberChip>
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-medium ${STATUS_BADGE[memo.status]}`}
      >
        {memo.status === 'DRAFT' ? 'Draft' : memo.status === 'POSTED' ? 'Posted' : 'Void'}
      </span>
    </>
  )
}

function TotalFigure(): React.JSX.Element {
  const lines = useWatch<IdmFormValues, 'lines'>({ name: 'lines' })
  const total = lines.reduce((s, l) => s + (l.debit || 0), 0)
  return <HeaderFigure label="Total debit" value={fmtPeso(total)} />
}

function subtitle(memo: IdmDetail | null): string {
  if (!memo) return 'A memo with no delivery receipt posts its journal entry only — no stock moves.'
  if (memo.deliveryReceipt) {
    return `Drafted by ${memo.deliveryReceipt.drNumber} — ${drPurposeLabel(memo.deliveryReceipt.purpose)}, issued from ${memo.deliveryReceipt.warehouse.name}.`
  }
  return 'Standalone memo — posts its journal entry only.'
}

function statusLine(memo: IdmDetail | null): string {
  if (!memo) return 'The memo number is assigned when you save.'
  if (memo.status === 'POSTED') return `Posted ${fmtDrDate(memo.postedAt)}.`
  if (memo.status === 'VOID') return `Voided ${fmtDrDate(memo.voidedAt)}.`
  return memo.deliveryReceipt
    ? 'Draft — the stock has not moved. Posting moves it and posts the entry together.'
    : 'Draft — nothing has posted yet.'
}

function postMessage(memo: IdmDetail): string {
  if (memo.deliveryReceipt) {
    return `The units on ${memo.deliveryReceipt.drNumber} leave ${memo.deliveryReceipt.warehouse.name} and this journal entry posts — together, or not at all.`
  }
  return 'This journal entry posts. No stock moves.'
}

function MemoHeaderSection({
  memo,
  readOnly,
}: {
  memo: IdmDetail | null
  readOnly: boolean
}): React.JSX.Element {
  const { control, formState } = useFormContext()
  const fromDr = !!memo?.deliveryReceipt
  return (
    <Section title="Memo details">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Debit memo no.">
          <div className={READONLY}>{memo?.memoNumber ?? 'Assigned on save'}</div>
        </Field>
        <Field label="Date" required error={formState.errors.memoDate?.message as string}>
          <Controller
            control={control}
            name="memoDate"
            render={({ field }) => (
              <input {...field} type="date" className={INPUT} disabled={readOnly} />
            )}
          />
        </Field>
        <Field label="Purpose">
          {fromDr || readOnly ? (
            <div className={READONLY}>{memo?.purpose ? drPurposeLabel(memo.purpose) : '—'}</div>
          ) : (
            <Controller
              control={control}
              name="purpose"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  options={PURPOSE_OPTIONS}
                  placeholder="Select purpose…"
                  chrome={CONTROL_CHROME}
                  clearable
                />
              )}
            />
          )}
        </Field>
        <Field label="Branch">
          <div className={READONLY}>{memo?.branch?.name ?? 'Your branch'}</div>
        </Field>
        <Field label="Department">
          <div className={READONLY}>{memo?.department?.name ?? '—'}</div>
        </Field>
        <Field label="Delivery receipt">
          {memo?.deliveryReceipt ? (
            <Link
              href={`/inventory/delivery-receipts/${memo.deliveryReceipt.id}`}
              className="flex h-[38px] w-full items-center rounded-lg border border-[#e4e4e9] bg-white px-3 text-[13px] font-medium text-[#3f1490] hover:underline"
            >
              {memo.deliveryReceipt.drNumber}
            </Link>
          ) : (
            <div className={READONLY}>None — standalone</div>
          )}
        </Field>
        <Field label="Reference">
          <Controller
            control={control}
            name="referenceNo"
            render={({ field }) => (
              <input {...field} className={INPUT} placeholder="e.g. DR000001" disabled={readOnly} />
            )}
          />
        </Field>
        <Field label="Reference date">
          <Controller
            control={control}
            name="referenceDate"
            render={({ field }) => (
              <input {...field} type="date" className={INPUT} disabled={readOnly} />
            )}
          />
        </Field>
      </div>
      <Field label="Reason / details">
        <Controller
          control={control}
          name="reason"
          render={({ field }) => <textarea {...field} className={TEXTAREA} disabled={readOnly} />}
        />
      </Field>
    </Section>
  )
}

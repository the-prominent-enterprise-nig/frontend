'use client'

import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Paperclip, Trash2, Upload } from 'lucide-react'
import { FileAttachments } from '@/src/libs/data/AccountingV2Data'
import { uploadExpenseAttachment } from '../_actions/upload-expense-attachment'
import { showToast } from '@/src/components/ui/toast'
import { ConfirmDialog } from '@/src/components/ui/Modal'

// FileAttachment is polymorphic on (entityType, entityId), so attaching to a
// new record type needs no schema change — just a stable string here. Matches
// the Prisma model name, the way SupplierDebitMemo's waybill panel does.
export const EXPENSE_ENTITY_TYPE = 'BusinessExpense'

// A hint to the file picker, not a rule: POST /files/upload accepts any mime
// type and only enforces MAX_FILE_SIZE_BYTES (10MB by default).
const ACCEPT = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv'

type Props = {
  /** Omitted while the expense is still being created — an attachment needs
   * an entityId, and there is no id until the expense is saved. Without it
   * the panel stages instead: files are held in the parent's state and
   * uploaded right after the expense is created (see
   * uploadStagedExpenseAttachments). */
  expenseId?: string
  readOnly?: boolean
  staged?: File[]
  onStagedChange?: (files: File[]) => void
}

/**
 * Receipts, invoices and approval memos backing a business expense.
 *
 * Uploads immediately when the expense already exists, and stages for
 * upload-after-save when it doesn't — so a receipt can be attached while
 * recording the expense, not only when editing it afterwards.
 */
export default function ExpenseAttachmentsPanel({
  expenseId,
  readOnly,
  staged = [],
  onStagedChange,
}: Props) {
  const [uploading, setUploading] = useState(false)
  // The attachment awaiting its delete confirmation. Held by name as well as
  // id so the dialog can say which file it is about.
  const [detaching, setDetaching] = useState<{ id: string; name: string } | null>(null)
  const [removing, setRemoving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isStaging = !expenseId

  const query = useQuery({
    queryKey: ['expense-attachments', expenseId],
    queryFn: () => FileAttachments.listForEntity(EXPENSE_ENTITY_TYPE, expenseId as string),
    enabled: !!expenseId,
    staleTime: 30_000,
  })
  const attachments = query.data?.data ?? []

  async function onPick(files: FileList) {
    const picked = Array.from(files)
    if (isStaging) {
      onStagedChange?.([...staged, ...picked])
      return
    }

    setUploading(true)
    for (const file of picked) {
      const form = new FormData()
      form.set('file', file)
      const uploaded = await uploadExpenseAttachment(form)
      if (!uploaded.success || !uploaded.data) {
        setUploading(false)
        showToast({
          title: 'Upload failed',
          description: uploaded.message || uploaded.error || 'Could not upload the file',
          status: 'error',
        })
        return
      }
      const linked = await FileAttachments.attach(
        uploaded.data.id,
        EXPENSE_ENTITY_TYPE,
        expenseId as string
      )
      if (!linked.success) {
        setUploading(false)
        showToast({
          title: 'Could not attach',
          description: linked.message || linked.error || 'The file uploaded but was not linked',
          status: 'error',
        })
        return
      }
    }
    setUploading(false)
    showToast({ title: 'Attached', status: 'success' })
    query.refetch()
  }

  async function detach(id: string) {
    setRemoving(true)
    const res = await FileAttachments.detach(id)
    setRemoving(false)
    setDetaching(null)
    if (!res.success) {
      showToast({
        title: 'Could not remove',
        description: res.message || res.error || 'Failed to remove the attachment',
        status: 'error',
      })
      return
    }
    query.refetch()
  }

  const rows = isStaging
    ? staged.map((file, i) => ({
        key: `staged-${i}`,
        name: file.name,
        onRemove: () => onStagedChange?.(staged.filter((_, j) => j !== i)),
        href: undefined,
      }))
    : attachments.map((a) => ({
        key: a.id,
        name: a.file.originalName,
        onRemove: () => setDetaching({ id: a.id, name: a.file.originalName }),
        href: `/api/files/${a.file.id}/download`,
      }))

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-prominent-purple-900">Attachments</h3>
          <p className="text-xs text-zinc-500">
            The receipt, invoice or approval memo backing this expense.
            {isStaging && ' Uploads when you save.'}
          </p>
        </div>
        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) onPick(e.target.files)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Attach
            </button>
          </>
        )}
      </div>

      {!isStaging && query.isLoading ? (
        <p className="text-xs text-zinc-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-zinc-400">Nothing attached yet.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between rounded border border-zinc-100 px-2.5 py-1.5"
            >
              {row.href ? (
                <a
                  href={row.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs text-prominent-purple-700 hover:underline"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {row.name}
                </a>
              ) : (
                <span className="flex items-center gap-2 text-xs text-zinc-700">
                  <Paperclip className="h-3.5 w-3.5 text-zinc-400" />
                  {row.name}
                  <span className="text-zinc-400">(pending save)</span>
                </span>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={row.onRemove}
                  className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove attachment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {detaching && (
        <ConfirmDialog
          open
          title="Remove this attachment?"
          message={
            <p>
              <strong>{detaching.name}</strong> is unlinked from this expense. It is the proof the
              disbursement was legitimate, so remove it only to replace it with a better copy.
            </p>
          }
          confirmLabel="Remove"
          destructive
          loading={removing}
          onCancel={() => setDetaching(null)}
          onConfirm={() => detach(detaching.id)}
        />
      )}
    </div>
  )
}

/** Uploads files staged during creation and links them to the expense that
 * has just been saved. Returns how many failed, so the caller can say so —
 * the expense itself is already created either way, and discarding it because
 * a scan failed to upload would be worse than reporting the gap. */
export async function uploadStagedExpenseAttachments(
  expenseId: string,
  files: File[]
): Promise<number> {
  let failed = 0
  for (const file of files) {
    const form = new FormData()
    form.set('file', file)
    const uploaded = await uploadExpenseAttachment(form)
    if (!uploaded.success || !uploaded.data) {
      failed++
      continue
    }
    const linked = await FileAttachments.attach(uploaded.data.id, EXPENSE_ENTITY_TYPE, expenseId)
    if (!linked.success) failed++
  }
  return failed
}

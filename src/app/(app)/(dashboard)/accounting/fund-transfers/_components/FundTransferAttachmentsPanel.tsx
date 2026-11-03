'use client'

import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Paperclip, Trash2, Upload } from 'lucide-react'
import { FileAttachments } from '@/src/libs/data/AccountingV2Data'
import { showToast } from '@/src/components/ui/toast'
import { uploadFundTransferAttachment } from '../_actions/upload-fund-transfer-attachment'

// FileAttachment is polymorphic on (entityType, entityId), so attaching to a
// new record type needs no schema change — just a stable string here. Matches
// the Prisma model name, the way ExpenseAttachmentsPanel does.
export const FUND_TRANSFER_ENTITY_TYPE = 'FundTransfer'

// A hint to the file picker, not a rule: POST /files/upload accepts any mime
// type and only enforces MAX_FILE_SIZE_BYTES (10MB by default).
const ACCEPT = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv'

type Props = {
  /** Omitted while the transfer is still being created — an attachment needs
   * an entityId, and there is no id until it is saved. Without it the panel
   * stages instead: files are held in the parent's state and uploaded right
   * after the transfer is created (see uploadStagedFundTransferAttachments). */
  transferId?: string
  /** A void transfer, or a user who can't change transfers: look, don't touch. */
  readOnly?: boolean
  title?: React.ReactNode
  staged?: File[]
  onStagedChange?: (files: File[]) => void
}

/**
 * Scenario 72 Part 5 — the bank advice, transfer slip or other document
 * backing an Inter-Account Transfer. Modelled on ExpenseAttachmentsPanel:
 * uploads immediately when the transfer exists and stages for upload-after-save
 * when it doesn't. Flat (no card of its own — both pages lay it out as a
 * section) and removing one asks inline, not in a pop-up.
 */
export default function FundTransferAttachmentsPanel({
  transferId,
  readOnly,
  title,
  staged = [],
  onStagedChange,
}: Props) {
  const [uploading, setUploading] = useState(false)
  // The attachment awaiting its inline "Remove?" answer.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isStaging = !transferId

  const query = useQuery({
    queryKey: ['fund-transfer-attachments', transferId],
    queryFn: () => FileAttachments.listForEntity(FUND_TRANSFER_ENTITY_TYPE, transferId as string),
    enabled: !!transferId,
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
      const uploaded = await uploadFundTransferAttachment(form)
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
        FUND_TRANSFER_ENTITY_TYPE,
        transferId as string
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
    setConfirmingId(null)
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
        id: null as string | null,
        name: file.name,
        onRemove: () => onStagedChange?.(staged.filter((_, j) => j !== i)),
        href: undefined as string | undefined,
      }))
    : attachments.map((a) => ({
        key: a.id,
        id: a.id as string | null,
        name: a.file.originalName,
        onRemove: () => setConfirmingId(a.id),
        href: `/api/files/${a.file.id}/download` as string | undefined,
      }))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <div>
          {title ?? (
            <h2 className="text-xs font-semibold uppercase text-gray-500">Supporting documents</h2>
          )}
          <p className="text-xs text-gray-500">
            The bank advice, transfer slip or other document backing this transfer.
            {isStaging && ' Uploads when you save.'}
            {readOnly && !isStaging && ' This transfer is read-only.'}
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
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Add attachment
            </button>
          </>
        )}
      </div>

      {!isStaging && query.isLoading ? (
        <p className="text-xs text-gray-400">Loading</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-400">Nothing attached yet.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between rounded border border-gray-100 px-2.5 py-1.5"
            >
              {row.href ? (
                <a
                  href={row.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs text-purple-700 hover:underline"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {row.name}
                </a>
              ) : (
                <span className="flex items-center gap-2 text-xs text-gray-700">
                  <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                  {row.name}
                  <span className="text-gray-400">(pending save)</span>
                </span>
              )}
              {!readOnly &&
                (row.id && confirmingId === row.id ? (
                  <span className="flex items-center gap-2 text-xs">
                    <span className="text-gray-600">Remove this attachment?</span>
                    <button
                      type="button"
                      onClick={() => detach(row.id as string)}
                      disabled={removing}
                      className="rounded px-2 py-0.5 font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {removing ? 'Removing' : 'Yes, remove'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      disabled={removing}
                      className="rounded px-2 py-0.5 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={row.onRemove}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove attachment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Uploads files staged during creation and links them to the transfer that
 * has just been saved. Returns how many failed, so the caller can say so —
 * the transfer itself is already posted either way, and an unposted transfer
 * is not something to throw away over a scan that would not upload. */
export async function uploadStagedFundTransferAttachments(
  transferId: string,
  files: File[]
): Promise<number> {
  let failed = 0
  for (const file of files) {
    const form = new FormData()
    form.set('file', file)
    const uploaded = await uploadFundTransferAttachment(form)
    if (!uploaded.success || !uploaded.data) {
      failed++
      continue
    }
    const linked = await FileAttachments.attach(
      uploaded.data.id,
      FUND_TRANSFER_ENTITY_TYPE,
      transferId
    )
    if (!linked.success) failed++
  }
  return failed
}

'use client'

import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Paperclip, Trash2, Upload } from 'lucide-react'
import { FileAttachments } from '@/src/libs/data/AccountingV2Data'
import { uploadWaybillAttachment } from '../_actions/upload-waybill-attachment'
import { showToast } from '@/src/components/ui/toast'
import { ConfirmDialog } from '@/src/components/ui/Modal'

// FileAttachment is polymorphic on (entityType, entityId), so a new document
// type needs no schema change — just a stable string here.
export const WAYBILL_ENTITY_TYPE = 'SupplierDebitMemo'

const ACCEPT = 'image/*,application/pdf'

type Props = {
  /** Omitted while the memo is still being created — an attachment needs an
   * entityId, and the memo has no id until it is saved. Without it the panel
   * switches to staging: files are held in the parent's state and uploaded
   * right after the memo is created (see uploadStagedWaybills). */
  memoId?: string
  readOnly?: boolean
  staged?: File[]
  onStagedChange?: (files: File[]) => void
}

/**
 * Uploads the waybill immediately when the memo already exists, and stages it
 * for upload-after-save when it doesn't — so a waybill can be attached while
 * creating, not only when editing.
 */
export default function WaybillPanel({ memoId, readOnly, staged = [], onStagedChange }: Props) {
  const [uploading, setUploading] = useState(false)
  // The attachment awaiting its delete confirmation. Held by name as well as
  // id so the dialog can say which file it is about.
  const [detaching, setDetaching] = useState<{ id: string; name: string } | null>(null)
  const [removing, setRemoving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isStaging = !memoId

  const query = useQuery({
    queryKey: ['waybill-attachments', memoId],
    queryFn: () => FileAttachments.listForEntity(WAYBILL_ENTITY_TYPE, memoId as string),
    enabled: !!memoId,
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
      const uploaded = await uploadWaybillAttachment(form)
      if (!uploaded.success || !uploaded.data) {
        setUploading(false)
        showToast({
          title: 'Upload failed',
          description: uploaded.message || uploaded.error || 'Could not upload the waybill',
          status: 'error',
        })
        return
      }
      const linked = await FileAttachments.attach(
        uploaded.data.id,
        WAYBILL_ENTITY_TYPE,
        memoId as string
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
    showToast({ title: 'Waybill attached', status: 'success' })
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

  // Deliberately uncoloured when there is nothing attached. A waybill is
  // optional — nothing in create, update or approve asks for one — and a memo
  // is often raised before the goods ship, so an alarm here would be on for
  // every new memo and mean nothing by the time one wasn't.
  return (
    <div className="rounded-xl border border-[#e4e4e9] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-[#17171c]">
            Waybill <span className="font-normal text-[#8b8b9b]">optional</span>
          </h3>
          <p className="text-[11.5px] leading-relaxed text-[#5b5b6b]">
            A photo of the waybill or gate pass that went out with the goods.
            {isStaging && ' Uploads when you save the draft.'}
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
              className="flex shrink-0 items-center gap-2 rounded-lg border border-[#ddd0f7] bg-[#f1ebfb] px-3 py-2 text-xs font-medium text-[#3f1490] hover:bg-[#e9dffa] disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Attach waybill
            </button>
          </>
        )}
      </div>

      {!isStaging && query.isLoading ? (
        <p className="text-xs text-[#8b8b9b]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[#a3a3b2]">None attached.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between rounded-lg border border-[#eeeef1] px-2.5 py-1.5"
            >
              {row.href ? (
                <a
                  href={row.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs text-[#3f1490] hover:underline"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {row.name}
                </a>
              ) : (
                <span className="flex items-center gap-2 text-xs text-[#3d3d4a]">
                  <Paperclip className="h-3.5 w-3.5 text-[#a3a3b2]" />
                  {row.name}
                  <span className="text-[#8b8b9b]">(pending save)</span>
                </span>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={row.onRemove}
                  className="rounded p-1 text-[#a3a3b2] hover:bg-[#fdeceb] hover:text-[#b42318]"
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
              <strong>{detaching.name}</strong> is unlinked from this memo. The waybill is the proof
              the goods left, so remove it only to replace it with a better copy.
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

/** Uploads files staged during creation and links them to the memo that has
 * just been saved. Returns how many failed, so the caller can say so — the
 * memo itself is already created either way, and losing it because an image
 * failed to upload would be worse than reporting the gap. */
export async function uploadStagedWaybills(memoId: string, files: File[]): Promise<number> {
  let failed = 0
  for (const file of files) {
    const form = new FormData()
    form.set('file', file)
    const uploaded = await uploadWaybillAttachment(form)
    if (!uploaded.success || !uploaded.data) {
      failed++
      continue
    }
    const linked = await FileAttachments.attach(uploaded.data.id, WAYBILL_ENTITY_TYPE, memoId)
    if (!linked.success) failed++
  }
  return failed
}

'use client'

import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Paperclip, Trash2, Upload } from 'lucide-react'
import { FileAttachments } from '@/src/libs/data/AccountingV2Data'
import { uploadFile } from '@/src/libs/files/upload-file'
import { showToast } from '@/src/components/ui/toast'
import { ConfirmDialog } from '@/src/components/ui/Modal'

// A hint to the file picker, not a rule: POST /files/upload accepts any mime
// type and only enforces MAX_FILE_SIZE_BYTES (10MB by default).
const ACCEPT = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv'

interface Props {
  /** FileAttachment is polymorphic on (entityType, entityId): the record's
   * Prisma model name, e.g. 'PosDeposit'. */
  entityType: string
  /** Omitted while the record is still being created — files are staged in
   * the parent's state and uploaded after save (uploadStagedAttachments). */
  entityId?: string
  title?: string
  description?: string
  readOnly?: boolean
  staged?: File[]
  onStagedChange?: (files: File[]) => void
  /** After a file is attached or removed — lets the parent refresh counts. */
  onChanged?: () => void
}

/**
 * Scenario 61 Part 5 — attachments for any record: uploads immediately when
 * the record exists, stages for upload-after-save when it doesn't. Shared
 * version of the expense attachments panel.
 */
export default function AttachmentsPanel({
  entityType,
  entityId,
  title = 'Attachments',
  description,
  readOnly,
  staged = [],
  onStagedChange,
  onChanged,
}: Props): React.JSX.Element {
  const [uploading, setUploading] = useState(false)
  const [detaching, setDetaching] = useState<{ id: string; name: string } | null>(null)
  const [removing, setRemoving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isStaging = !entityId

  const query = useQuery({
    queryKey: ['attachments', entityType, entityId],
    queryFn: () => FileAttachments.listForEntity(entityType, entityId as string),
    enabled: !!entityId,
    staleTime: 30_000,
  })
  const attachments = query.data?.data ?? []

  async function onPick(files: FileList): Promise<void> {
    const picked = Array.from(files)
    if (isStaging) {
      onStagedChange?.([...staged, ...picked])
      return
    }
    setUploading(true)
    const failed = await uploadAndAttach(entityType, entityId as string, picked)
    setUploading(false)
    showToast(
      failed
        ? { title: `${failed} file(s) failed to attach`, status: 'error' }
        : { title: 'Attached', status: 'success' }
    )
    await query.refetch()
    onChanged?.()
  }

  async function detach(id: string): Promise<void> {
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
    await query.refetch()
    onChanged?.()
  }

  const rows = isStaging
    ? staged.map((file, i) => ({
        key: `staged-${i}`,
        name: file.name,
        href: undefined,
        onRemove: () => onStagedChange?.(staged.filter((_, j) => j !== i)),
      }))
    : attachments.map((a) => ({
        key: a.id,
        name: a.file.originalName,
        href: `/api/files/${a.file.id}/download`,
        onRemove: () => setDetaching({ id: a.id, name: a.file.originalName }),
      }))

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-prominent-purple-900">
            {title}
            {rows.length > 0 && <span className="ml-1 text-zinc-400">({rows.length})</span>}
          </h3>
          {(description || isStaging) && (
            <p className="text-xs text-zinc-500">
              {description}
              {isStaging && ' Uploads when you save.'}
            </p>
          )}
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
        // Capped and scrollable, so a stack of slips and check images never
        // pushes the dialog's buttons off the screen.
        <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between gap-2 rounded border border-zinc-100 px-2.5 py-1.5"
            >
              {row.href ? (
                <a
                  href={row.href}
                  target="_blank"
                  rel="noreferrer"
                  title={row.name}
                  className="flex min-w-0 items-center gap-2 text-xs text-prominent-purple-700 hover:underline"
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{row.name}</span>
                </a>
              ) : (
                <span
                  title={row.name}
                  className="flex min-w-0 items-center gap-2 text-xs text-zinc-700"
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <span className="truncate">{row.name}</span>
                  <span className="shrink-0 text-zinc-400">(pending save)</span>
                </span>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={row.onRemove}
                  className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
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
              <strong>{detaching.name}</strong> is unlinked from this record. Remove it only to
              replace it with a better copy.
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

/** Uploads files and links each to the record. Returns how many failed, so
 * the caller can say so rather than discard a record over one bad scan. */
export async function uploadAndAttach(
  entityType: string,
  entityId: string,
  files: File[]
): Promise<number> {
  let failed = 0
  for (const file of files) {
    const form = new FormData()
    form.set('file', file)
    const uploaded = await uploadFile(form)
    if (!uploaded.success || !uploaded.data) {
      failed++
      continue
    }
    const linked = await FileAttachments.attach(uploaded.data.id, entityType, entityId)
    if (!linked.success) failed++
  }
  return failed
}

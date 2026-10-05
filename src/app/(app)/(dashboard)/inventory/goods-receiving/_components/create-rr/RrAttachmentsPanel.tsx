'use client'

import { useRef } from 'react'
import { Paperclip, Trash2, Upload } from 'lucide-react'
import { PANEL } from './rrTokens'
import { RR_ATTACHMENT_LABELS, type RrAttachmentKind } from './rrAttachments'

const ACCEPT = 'image/*,application/pdf'

type Props = {
  required: RrAttachmentKind[]
  /** Files picked so far, per kind. Held in the parent and uploaded when the
   * receipt is posted, so nothing is stored for a receipt that never posts. */
  staged: Record<RrAttachmentKind, File[]>
  onChange: (kind: RrAttachmentKind, files: File[]) => void
  showErrors: boolean
}

/** Required UDS / RFS slots for a repossession or repair/return. A slot turns
 * red after a post attempt while it is still empty. */
export function RrAttachmentsPanel({
  required,
  staged,
  onChange,
  showErrors,
}: Props): React.ReactElement {
  return (
    <div className={PANEL}>
      <div className="flex flex-col gap-0.5 border-b border-[#eeeef1] px-4.5 py-3.5">
        <span className="text-[13.5px] font-semibold">
          Attachments <span className="text-[#b42318]">*</span>
        </span>
        <span className="text-[11.5px] text-[#8b8b9b]">
          Scans or photos of the signed documents. Required before the receipt can be created.
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 px-4.5 py-3.5 lg:grid-cols-2">
        {required.map((kind) => (
          <Slot
            key={kind}
            kind={kind}
            files={staged[kind]}
            invalid={showErrors && staged[kind].length === 0}
            onChange={(files) => onChange(kind, files)}
          />
        ))}
      </div>
    </div>
  )
}

function Slot({
  kind,
  files,
  invalid,
  onChange,
}: {
  kind: RrAttachmentKind
  files: File[]
  invalid: boolean
  onChange: (files: File[]) => void
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      className={`rounded-[10px] border p-3 ${
        invalid ? 'border-[#b42318] bg-[#fffbfa]' : 'border-[#e4e4e9] bg-white'
      }`}
      data-invalid={invalid || undefined}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[12.5px] font-medium text-[#17171c]">
          {RR_ATTACHMENT_LABELS[kind]} <span className="text-[#b42318]">*</span>
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onChange([...files, ...Array.from(e.target.files)])
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-[#ddd0f7] bg-[#f1ebfb] px-2.5 py-1.5 text-[12px] font-medium text-[#3f1490] hover:bg-[#e9dffa]"
        >
          <Upload className="h-3.5 w-3.5" />
          Attach {kind}
        </button>
      </div>
      {files.length === 0 ? (
        <p className={`text-[11.5px] ${invalid ? 'text-[#b42318]' : 'text-[#a3a3b2]'}`}>
          {invalid ? `${kind} is required.` : 'Nothing attached yet.'}
        </p>
      ) : (
        <ul className="space-y-1">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded-lg border border-[#eeeef1] px-2.5 py-1.5"
            >
              <span className="flex min-w-0 items-center gap-2 text-[12px] text-[#3d3d4a]">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#a3a3b2]" />
                <span className="truncate">{file.name}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={`Remove ${file.name}`}
                className="rounded p-1 text-[#a3a3b2] hover:bg-[#fdeceb] hover:text-[#b42318]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

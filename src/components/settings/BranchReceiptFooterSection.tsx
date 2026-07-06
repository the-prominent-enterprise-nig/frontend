'use client'

import { useRef, useState, useTransition } from 'react'
import { Pencil, X, Save, Eye, EyeOff } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import { updateBranchReceiptFooter } from '@/src/app/(app)/(dashboard)/settings/branches/[id]/_actions/branch-receipt-footer'

const MAX_LENGTH = 500
const TOKENS = [
  { token: '{{branch_name}}', label: 'Branch name' },
  { token: '{{date}}', label: 'Date' },
]

interface Props {
  branchId: string
  branchName: string
  initialFooterText: string | null
  readOnly?: boolean
}

function resolveTokens(template: string, branchName: string) {
  const today = new Date().toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
  })
  return template.replace(/{{\s*branch_name\s*}}/g, branchName).replace(/{{\s*date\s*}}/g, today)
}

function errorMessage(errorCode: string | undefined, fallback: string) {
  switch (errorCode) {
    case 'BRANCH_NOT_FOUND':
      return 'This branch could not be found.'
    case 'FOOTER_TEXT_TOO_LONG':
      return `Footer text must be ${MAX_LENGTH} characters or fewer.`
    default:
      return fallback
  }
}

export function BranchReceiptFooterSection({
  branchId,
  branchName,
  initialFooterText,
  readOnly = false,
}: Props) {
  const [footerText, setFooterText] = useState(initialFooterText ?? '')
  const [draft, setDraft] = useState(initialFooterText ?? '')
  const [isEditing, setIsEditing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleEdit = () => {
    setDraft(footerText)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setDraft(footerText)
    setIsEditing(false)
  }

  const insertToken = (token: string) => {
    const el = textareaRef.current
    if (!el) {
      setDraft((prev) => prev + token)
      return
    }
    const start = el.selectionStart ?? draft.length
    const end = el.selectionEnd ?? draft.length
    const next = draft.slice(0, start) + token + draft.slice(end)
    setDraft(next.slice(0, MAX_LENGTH))
    requestAnimationFrame(() => {
      el.focus()
      const cursor = start + token.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  const handleSave = () => {
    if (draft === footerText) {
      setIsEditing(false)
      return
    }

    startTransition(async () => {
      const result = await updateBranchReceiptFooter(branchId, draft.trim() ? draft : null)
      if (!result.success) {
        showToast({
          title: errorMessage(result.errorCode, result.error || 'Failed to save receipt footer'),
          status: 'error',
        })
      } else {
        const saved = result.data?.data.footerText ?? null
        setFooterText(saved ?? '')
        setDraft(saved ?? '')
        setIsEditing(false)
        showToast({ title: `Receipt footer saved for ${branchName}`, status: 'success' })
      }
    })
  }

  const displayed = isEditing ? draft : footerText

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          Shown at the bottom of every printed and digital receipt for this branch.
        </span>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending || draft.length > MAX_LENGTH}
                  className="flex items-center gap-1.5 rounded-lg bg-prominent-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-prominent-orange-600 transition-colors disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isPending ? 'Saving…' : 'Save Footer'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleEdit}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
            disabled={isPending}
            rows={4}
            placeholder="Thank you for shopping at {{branch_name}}!"
            className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-prominent-orange-500 focus:outline-none disabled:opacity-50"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {TOKENS.map((t) => (
                <button
                  key={t.token}
                  type="button"
                  onClick={() => insertToken(t.token)}
                  disabled={isPending}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 hover:bg-gray-200 transition-colors disabled:opacity-50"
                  title={`Insert ${t.label.toLowerCase()}`}
                >
                  {t.token}
                </button>
              ))}
            </div>
            <p
              className={`text-[10px] ${draft.length > MAX_LENGTH ? 'text-red-500' : 'text-gray-400'}`}
            >
              {draft.length}/{MAX_LENGTH}
            </p>
          </div>
        </div>
      ) : footerText ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="whitespace-pre-line text-sm text-gray-700">{footerText}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center">
          <p className="text-sm text-gray-400">No custom footer configured for this branch.</p>
        </div>
      )}

      {displayed && (
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {showPreview ? 'Hide preview' : 'Preview Receipt'}
        </button>
      )}

      {showPreview && displayed && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 font-mono text-[11px] text-gray-600">
          <p className="mb-2 text-center font-semibold text-gray-800">{branchName}</p>
          <p className="mb-1 text-center text-gray-400">— sample receipt —</p>
          <div className="my-2 border-t border-dashed border-gray-300" />
          <p className="whitespace-pre-line text-center">{resolveTokens(displayed, branchName)}</p>
        </div>
      )}
    </div>
  )
}

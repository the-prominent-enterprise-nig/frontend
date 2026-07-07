'use client'

import { useState, useRef } from 'react'
import { Upload, X, Save, Loader2, Pencil } from 'lucide-react'
import {
  uploadReceiptLogo,
  updateReceiptBranding,
  type ReceiptBranding,
} from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'

const HEADER_MAX_LENGTH = 200
const FOOTER_MAX_LENGTH = 500
const FOOTER_TOKENS = [
  { token: '{{branch_name}}', label: 'Branch name' },
  { token: '{{date}}', label: 'Date' },
]
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/svg+xml']
const MAX_LOGO_BYTES = 2 * 1024 * 1024

function validateLogoFile(file: File): string | null {
  if (file.size > MAX_LOGO_BYTES) return 'Logo must be under 2 MB.'
  if (!ALLOWED_MIME.includes(file.type)) return 'Logo must be PNG, JPG, or SVG.'
  return null
}

export function ReceiptBrandingSection({ initialBranding }: { initialBranding: ReceiptBranding }) {
  const [branding, setBranding] = useState<ReceiptBranding>(initialBranding)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [headerText, setHeaderText] = useState(initialBranding.receiptHeaderText ?? '')
  const [footerText, setFooterText] = useState(initialBranding.receiptFooterText ?? '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function showSuccess() {
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  function handleEdit() {
    setError('')
    setEditing(true)
  }

  function handleCancel() {
    setHeaderText(branding.receiptHeaderText ?? '')
    setFooterText(branding.receiptFooterText ?? '')
    setError('')
    setEditing(false)
  }

  async function handleLogoUpload(file: File) {
    const validationError = validateLogoFile(file)
    if (validationError) return setError(validationError)

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadReceiptLogo(fd)
    setUploading(false)

    if (!res.success || !res.data) return setError(res.error ?? 'Upload failed.')
    setBranding((b) => ({ ...b, receiptLogoUrl: res.data!.logoUrl }))
  }

  async function handleRemoveLogo() {
    setSaving(true)
    const res = await updateReceiptBranding({ logoUrl: null })
    setSaving(false)
    if (!res.success) return setError(res.error ?? 'Failed to remove logo.')
    setBranding((b) => ({ ...b, receiptLogoUrl: null }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await updateReceiptBranding({
      headerText: headerText || undefined,
      footerText: footerText.trim() ? footerText : null,
    })
    setSaving(false)
    if (!res.success) return setError(res.error ?? 'Failed to save branding.')

    if (res.data) {
      setBranding(res.data)
      setHeaderText(res.data.receiptHeaderText ?? '')
      setFooterText(res.data.receiptFooterText ?? '')
    }
    setEditing(false)
    showSuccess()
  }

  const headerLines = (branding.receiptHeaderText ?? '').split('\n').filter(Boolean)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-500">
          This is the company-wide default logo, header, and footer used on every branch&apos;s
          receipts. A branch can override any of these just for itself under its own settings.
        </p>
        {!editing && (
          <button
            onClick={handleEdit}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Pencil size={12} />
            Edit
          </button>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Receipt branding saved.
        </p>
      )}

      {editing ? (
        <div className="space-y-5 rounded-xl border border-purple-200 bg-white p-5">
          <div>
            <p className="mb-1 text-sm font-semibold text-gray-700">Business Logo</p>
            <p className="mb-3 text-xs text-gray-500">PNG, JPG, or SVG — max 2 MB</p>
            {branding.receiptLogoUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={branding.receiptLogoUrl}
                  alt="Receipt logo"
                  className="h-14 w-auto max-w-35 rounded-lg border border-gray-100 object-contain p-1"
                />
                <button
                  onClick={handleRemoveLogo}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <X size={12} />
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600 disabled:opacity-50"
              >
                {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                <span>{uploading ? 'Uploading…' : 'Click to upload logo'}</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleLogoUpload(file)
                e.target.value = ''
              }}
            />
          </div>

          <div className="border-t border-gray-100 pt-5">
            <p className="mb-1 text-sm font-semibold text-gray-700">Header Text</p>
            <p className="mb-3 text-xs text-gray-500">
              Each line appears separately below the logo.
            </p>
            <textarea
              value={headerText}
              maxLength={HEADER_MAX_LENGTH}
              rows={3}
              placeholder={'SM City\nIloilo City'}
              onChange={(e) => setHeaderText(e.target.value)}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-300"
            />
            <p className="mt-1 text-right text-[10px] text-gray-400">
              {headerText.length}/{HEADER_MAX_LENGTH}
            </p>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <p className="mb-1 text-sm font-semibold text-gray-700">Footer Text</p>
            <p className="mb-3 text-xs text-gray-500">
              Shown at the bottom of every branch&apos;s receipts unless that branch sets its own.
            </p>
            <textarea
              value={footerText}
              maxLength={FOOTER_MAX_LENGTH}
              rows={3}
              placeholder="Thank you for shopping with us!"
              onChange={(e) => setFooterText(e.target.value)}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-300"
            />
            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {FOOTER_TOKENS.map((t) => (
                  <button
                    key={t.token}
                    type="button"
                    onClick={() =>
                      setFooterText((prev) => (prev + t.token).slice(0, FOOTER_MAX_LENGTH))
                    }
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 hover:bg-gray-200"
                  >
                    {t.token}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400">
                {footerText.length}/{FOOTER_MAX_LENGTH}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Logo</p>
            {branding.receiptLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.receiptLogoUrl}
                alt="Receipt logo"
                className="h-12 w-auto max-w-35 rounded-lg border border-gray-100 object-contain p-1"
              />
            ) : (
              <p className="text-sm text-gray-400">No logo set</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Header Text
            </p>
            {headerLines.length > 0 ? (
              headerLines.map((line, i) => (
                <p key={i} className="text-sm text-gray-700">
                  {line}
                </p>
              ))
            ) : (
              <p className="text-sm text-gray-400">No header text set</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Footer Text
            </p>
            {branding.receiptFooterText ? (
              <p className="whitespace-pre-line text-sm text-gray-700">
                {branding.receiptFooterText}
              </p>
            ) : (
              <p className="text-sm text-gray-400">No footer text set</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

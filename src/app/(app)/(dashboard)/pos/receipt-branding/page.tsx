'use client'

import { useState, useEffect, useRef } from 'react'
import {
  FileText,
  Upload,
  X,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Pencil,
} from 'lucide-react'
import {
  getReceiptBranding,
  uploadReceiptLogo,
  updateReceiptBranding,
  type ReceiptBranding,
} from '../_actions/pos-actions'

export default function ReceiptBrandingPage() {
  const [branding, setBranding] = useState<ReceiptBranding | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [editing, setEditing] = useState(false)

  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [headerText, setHeaderText] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getReceiptBranding().then((res) => {
      setLoading(false)
      if (res.success && res.data) {
        const b = res.data
        setBranding(b)
        setLogoUrl(b.receiptLogoUrl)
        setHeaderText(b.receiptHeaderText ?? '')
      }
    })
  }, [])

  function handleEdit() {
    setError('')
    setEditing(true)
  }

  function handleCancel() {
    if (!branding) return
    setLogoUrl(branding.receiptLogoUrl)
    setHeaderText(branding.receiptHeaderText ?? '')
    setError('')
    setEditing(false)
  }

  async function handleLogoUpload(file: File) {
    setError('')
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be under 2 MB.')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      setError('Logo must be PNG, JPG, or SVG.')
      return
    }

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadReceiptLogo(fd)
    setUploading(false)

    if (!res.success || !res.data) {
      setError(res.error ?? 'Upload failed.')
      return
    }
    setLogoUrl(res.data.logoUrl)
  }

  async function handleRemoveLogo() {
    setSaving(true)
    setError('')
    const res = await updateReceiptBranding({ logoUrl: null })
    setSaving(false)
    if (!res.success) {
      setError(res.error ?? 'Failed to remove logo.')
      return
    }
    setLogoUrl(null)
    setBranding((b) => (b ? { ...b, receiptLogoUrl: null } : b))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await updateReceiptBranding({
      headerText: headerText || undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.error ?? 'Failed to save branding.')
      return
    }
    const saved = res.data ?? null
    setBranding(saved)
    if (saved) setHeaderText(saved.receiptHeaderText ?? '')
    setEditing(false)
    showSuccess()
  }

  function showSuccess() {
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-purple-500" />
      </div>
    )
  }

  const savedLines = (branding?.receiptHeaderText ?? '').split('\n').filter(Boolean)
  const previewLines = headerText.split('\n').filter(Boolean)

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <FileText size={18} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Receipt Branding</h1>
              <p className="text-sm text-gray-500">
                Customize the logo and header shown on receipts.
              </p>
            </div>
          </div>

          {!editing && (
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <Pencil size={14} />
              Edit Receipt
            </button>
          )}
        </div>

        {/* Feedback */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 size={14} />
            Receipt branding saved.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Controls (edit mode) or read-only summary */}
          {editing ? (
            <div className="space-y-5 rounded-xl border border-purple-200 bg-white p-6 shadow-sm">
              {/* Logo upload */}
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-700">Business Logo</p>
                <p className="mb-3 text-xs text-gray-500">PNG, JPG, or SVG — max 2 MB</p>

                {logoUrl ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
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
                    {uploading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Upload size={20} />
                    )}
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

              {/* Header text */}
              <div className="border-t border-gray-100 pt-5">
                <p className="mb-1 text-sm font-semibold text-gray-700">Header Text</p>
                <p className="mb-3 text-xs text-gray-500">
                  Each line appears separately below the logo.
                </p>
                <textarea
                  value={headerText}
                  maxLength={200}
                  rows={3}
                  placeholder={'SM City\nIloilo City'}
                  onChange={(e) => setHeaderText(e.target.value)}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-300"
                />
                <p className="mt-1 text-right text-[10px] text-gray-400">{headerText.length}/200</p>
              </div>

              {/* Edit actions */}
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
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              {/* Logo read-only */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Logo
                </p>
                {branding?.receiptLogoUrl ? (
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
              <div className="border-t border-gray-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Header Text
                </p>
                {savedLines.length > 0 ? (
                  <div className="space-y-0.5">
                    {savedLines.map((line, i) => (
                      <p key={i} className="text-sm text-gray-700">
                        {line}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No header text set</p>
                )}
              </div>
            </div>
          )}

          {/* Right: Receipt preview */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Preview</p>
            <div className="mx-auto w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {/* Header */}
              <div className="flex flex-col items-center gap-2 border-b border-gray-100 px-4 py-5">
                {(editing ? logoUrl : branding?.receiptLogoUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(editing ? logoUrl : branding?.receiptLogoUrl) as string}
                    alt="logo"
                    className="h-10 w-auto max-w-30 object-contain"
                  />
                ) : (
                  <span className="text-sm font-bold tracking-wide text-gray-800">
                    Your Business
                  </span>
                )}
                {(editing ? previewLines : savedLines).length > 0 ? (
                  <div className="flex flex-col items-center gap-0.5">
                    {(editing ? previewLines : savedLines).map((line, i) => (
                      <span key={i} className="text-[10px] text-gray-500">
                        {line}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-300">Header text</span>
                )}
              </div>

              {/* Body */}
              <div className="space-y-1 px-4 py-3 text-[10px] text-gray-600">
                <div className="flex justify-between">
                  <span className="text-gray-400">Date</span>
                  <span>Jun 26, 2026</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">TXN #</span>
                  <span>POS-001</span>
                </div>
                <div className="my-2 border-t border-gray-100" />
                <div className="flex justify-between">
                  <span>Item A × 2</span>
                  <span>₱200.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Item B × 1</span>
                  <span>₱150.00</span>
                </div>
                <div className="my-2 border-t border-gray-100" />
                <div className="flex justify-between font-semibold text-gray-800">
                  <span>Total</span>
                  <span>₱350.00</span>
                </div>
                <p className="mt-3 text-center text-[9px] text-gray-400">
                  Thank you for your purchase!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

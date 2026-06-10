'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy, Check, RefreshCw, Clock, CheckCircle2, AlertTriangle } from 'lucide-react'

interface Invite {
  id: string
  link: string
  expiresAt: string
  usedAt: string | null
  createdAt: string
  status: 'pending' | 'expired' | 'used'
}

interface Props {
  enterpriseId: string
  invite: Invite | null
}

function formatExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `Expires in ${h}h ${m}m`
  return `Expires in ${m}m`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function InviteCard({ enterpriseId, invite: initial }: Props) {
  const router = useRouter()
  const [invite, setInvite] = useState<Invite | null>(initial)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  async function copyLink() {
    if (!invite) return
    await navigator.clipboard.writeText(invite.link)
    setCopied(true)
    toast.success('Invite link copied')
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenerate() {
    setRegenerating(true)
    try {
      const res = await fetch(`/api/super-admin/enterprises/${enterpriseId}/invite/regenerate`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message ?? 'Failed to regenerate invite')
      }
      const data = (await res.json()) as Invite
      setInvite(data)
      toast.success('New invite link generated — valid for 24 hours')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setRegenerating(false)
    }
  }

  const isUsed = invite?.status === 'used'
  const isExpired = invite?.status === 'expired'
  const isPending = invite?.status === 'pending'

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-zinc-800">Invite Link</h2>
        {isPending && invite && (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <Clock className="h-3.5 w-3.5" />
            {formatExpiry(invite.expiresAt)}
          </span>
        )}
        {isExpired && (
          <span className="flex items-center gap-1 text-xs text-red-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            Expired
          </span>
        )}
        {isUsed && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Account activated
          </span>
        )}
      </div>

      <div className="p-5 space-y-3">
        {/* No invite yet */}
        {!invite && (
          <>
            <p className="text-xs text-zinc-500">
              No invite link has been generated yet. Generate one to send to the business owner.
            </p>
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? 'Generating…' : 'Generate Invite Link'}
            </button>
          </>
        )}

        {/* Used state */}
        {isUsed && invite && (
          <p className="text-xs text-zinc-500">
            The business owner accepted the invite and set up their account on{' '}
            <span className="font-medium text-zinc-700">{formatDate(invite.usedAt!)}</span>.
          </p>
        )}

        {/* Pending state — show link */}
        {isPending && invite && (
          <>
            <p className="text-xs text-zinc-500">
              Share this link with the business owner. It expires{' '}
              <span className="font-medium text-zinc-700">
                {new Date(invite.expiresAt).toLocaleString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              .
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <span className="flex-1 truncate text-xs text-zinc-600 font-mono">{invite.link}</span>
              <button
                onClick={copyLink}
                className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                title="Copy link"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <button
              onClick={copyLink}
              className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </button>
          </>
        )}

        {/* Expired state — regenerate */}
        {isExpired && invite && (
          <>
            <p className="text-xs text-zinc-500">
              The invite link expired on{' '}
              <span className="font-medium text-zinc-700">{formatDate(invite.expiresAt)}</span>.
              Generate a new one to send to the business owner.
            </p>
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? 'Generating…' : 'Generate New Link'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

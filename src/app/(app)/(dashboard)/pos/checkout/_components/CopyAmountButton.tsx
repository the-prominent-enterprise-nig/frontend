'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'

/**
 * Scenario 70 — a "Copy" beside the checkout Total. It copies the amount as a
 * plain number ("6190.00": no peso sign, no thousands commas), so it pastes
 * straight into Amount received — a number input rejects "₱6,190.00" — or into
 * a card terminal or a payment app.
 */
export default function CopyAmountButton({ amount, testId }: { amount: number; testId?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const copy = async () => {
    const text = (Math.round(amount * 100) / 100).toFixed(2)
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      // No async clipboard (insecure origin, denied permission): fall back to
      // the old selection-based copy so the button still works at the counter.
      const box = document.createElement('textarea')
      box.value = text
      box.setAttribute('readonly', '')
      box.style.position = 'fixed'
      box.style.opacity = '0'
      document.body.appendChild(box)
      box.select()
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
      document.body.removeChild(box)
    }
    if (!ok) {
      showToast({
        title: 'Could not copy — select the amount and copy it by hand',
        status: 'error',
      })
      return
    }
    showToast({ title: `${text} copied`, status: 'success' })
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={copy}
      data-testid={testId}
      aria-label="Copy total"
      className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        copied
          ? 'border-green-300 bg-green-50 text-green-700'
          : 'border-purple-300 bg-white text-purple-700 hover:border-purple-500 hover:bg-purple-50'
      }`}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

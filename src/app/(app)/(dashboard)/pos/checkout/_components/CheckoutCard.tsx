'use client'

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

/** Nov UAT #28 — the checkout is one column of cards, each a step of the sale:
 * Document, Customer and agent, Items and VAT, Payment. A card shows a tick
 * once its part is filled in, and the chips above them say the same at a glance
 * (and jump to the card). The card's content is the section that was always
 * there — only its frame is new. */

export type CheckoutStep = {
  /** The id of the card the chip jumps to. */
  id: string
  label: string
  done: boolean
}

/** The progress chips above the cards: ✓ Document · ✓ Who · ✓ Items · Payment. */
export function CheckoutSteps({ steps }: { steps: CheckoutStep[] }) {
  return (
    <nav
      aria-label="Checkout steps"
      data-testid="checkout-steps"
      className="sticky top-0 z-10 flex flex-wrap gap-2 border-b border-purple-200 bg-purple-50/95 px-5 py-3 backdrop-blur"
    >
      {steps.map((step) => (
        <button
          key={step.id}
          type="button"
          data-testid={`checkout-step-${step.id}`}
          data-done={step.done ? 'true' : 'false'}
          onClick={() =>
            document.getElementById(step.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            step.done
              ? 'border-prominent-purple-200 bg-prominent-purple-100 text-prominent-purple-800 hover:bg-prominent-purple-200'
              : 'border-purple-200 bg-white text-gray-600 hover:bg-purple-50'
          }`}
        >
          {step.done ? '✓ ' : ''}
          {step.label}
        </button>
      ))}
    </nav>
  )
}

export default function CheckoutCard({
  id,
  step,
  title,
  done,
  children,
}: {
  id: string
  /** The step number shown until the card is done. */
  step: number
  title: string
  done: boolean
  children: ReactNode
}) {
  return (
    <section
      id={id}
      data-testid={id}
      data-done={done ? 'true' : 'false'}
      className="mx-5 mt-5 scroll-mt-16 rounded-2xl border border-purple-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            done
              ? 'bg-prominent-purple-600 text-white'
              : 'bg-prominent-purple-100 text-prominent-purple-700'
          }`}
        >
          {done ? <Check size={14} strokeWidth={3} /> : step}
        </span>
        <h2 className="text-[15px] font-bold text-prominent-purple-900">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

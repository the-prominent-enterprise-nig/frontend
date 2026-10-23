'use client'

import { INPUT, INPUT_BAD } from './returnTokens'

type Props = {
  /** Only ever the three that hold a unit back. */
  disposition: 'quarantine' | 'repair' | 'scrap'
  value: string
  onChange: (value: string) => void
  showError: boolean
}

/**
 * What is actually wrong with it, asked only where somebody downstream has to
 * act on the answer.
 *
 * Three different people read this field and they need different things from
 * it: a technician needs the fault, an inspector needs what to look for, and
 * whoever signs off a write-off needs the justification. So the card says
 * which of the three this is, rather than offering one neutral "Notes" box
 * that gets filled in with "damaged" regardless.
 *
 * Restock and exchange do not ask. Nothing is held back, so there is nothing
 * for anyone to act on.
 */
const COPY = {
  scrap: {
    title: 'Writing this unit off',
    body: 'The unit leaves stock permanently and the cost is written off.',
    placeholder: 'Why it is being written off',
  },
  repair: {
    title: 'Going to service',
    body: 'No refund is raised — the customer is waiting on this unit.',
    placeholder: 'Fault for the technician',
  },
  quarantine: {
    title: 'Held for inspection',
    body: 'The unit sits out of sellable stock until someone inspects it.',
    placeholder: 'What to look for',
  },
} as const

export default function FaultNoteCard({ disposition, value, onChange, showError }: Props) {
  const copy = COPY[disposition]
  const severe = disposition === 'scrap'
  const missing = showError && !value.trim()

  return (
    <div
      className={`flex flex-col gap-[9px] rounded-[10px] border px-[14px] py-3 ${
        severe ? 'border-[#f3c9c5] bg-[#fffbfb]' : 'border-[#f5e2c6] bg-[#fffdf8]'
      }`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className={`text-[12.5px] font-semibold ${severe ? 'text-[#b42318]' : 'text-[#8a4b06]'}`}
        >
          {copy.title}
        </span>
        <span className="text-[11.5px] leading-[1.45] text-[#3d3d4a]">{copy.body}</span>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={copy.placeholder}
        aria-label={copy.title}
        maxLength={400}
        className={`w-full ${missing ? INPUT_BAD : INPUT}`}
      />
    </div>
  )
}

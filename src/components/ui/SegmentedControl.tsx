'use client'

export type SegmentedControlOption<T extends string> = {
  value: T
  label: string
}

/** A 2-4 option picker for a single mutually-exclusive choice, shown as one
 * pill-shaped track with a solid "selected" segment — every option visible
 * at once, one tap to switch. Use this instead of a `<select>` wherever the
 * choice is binary/small and always relevant (e.g. Receipt Type, Cleared),
 * since a dropdown menu adds an open-then-choose step a glance-and-tap
 * control doesn't need. */
export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  name,
}: {
  value: T
  onChange: (value: T) => void
  options: SegmentedControlOption<T>[]
  name?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="inline-flex w-full rounded-lg bg-gray-100 p-1"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors ${
              active
                ? 'bg-white text-prominent-purple-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

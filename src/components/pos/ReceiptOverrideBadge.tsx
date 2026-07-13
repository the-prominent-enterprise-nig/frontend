export function ReceiptOverrideBadge({ overridden }: { overridden: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
        overridden ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-400'
      }`}
    >
      {overridden ? 'Custom' : 'Using default'}
    </span>
  )
}

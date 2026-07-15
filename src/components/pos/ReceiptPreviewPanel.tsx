interface Props {
  title: string
  logoUrl: string | null
  headerText: string
  footerText: string
}

export function ReceiptPreviewPanel({ title, logoUrl, headerText, footerText }: Props) {
  const headerLines = headerText.split('\n').filter(Boolean)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="mx-auto w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col items-center gap-2 border-b border-gray-100 px-4 py-5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="logo" className="h-10 w-auto max-w-30 object-contain" />
          ) : (
            <span className="text-sm font-bold tracking-wide text-gray-800">Your Business</span>
          )}
          {headerLines.length > 0 ? (
            <div className="flex flex-col items-center gap-0.5">
              {headerLines.map((line, i) => (
                <span key={i} className="text-[10px] text-gray-500">
                  {line}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-gray-300">Header text</span>
          )}
        </div>

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
          <p className="mt-3 whitespace-pre-line text-center text-[9px] text-gray-400">
            {footerText}
          </p>
        </div>
      </div>
    </div>
  )
}

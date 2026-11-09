import { FileX2 } from 'lucide-react'

type Props = {
  title: string
  body: string
  /** Optional retry for a failure that may pass, e.g. a network blip. */
  onRetry?: () => void
}

/** A document (RR, PO…) that couldn't be shown, explained in plain words. */
export function DocumentUnavailable({ title, body, onRetry }: Props): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-2 rounded-xl border border-[#e4e4e9] bg-white px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f1ebfb]">
        <FileX2 className="h-5 w-5 text-[#5b21b6]" aria-hidden />
      </div>
      <p className="mt-1 text-[15px] font-semibold text-[#17171c]">{title}</p>
      <p className="max-w-md text-[13px] leading-[1.55] text-ink-muted">{body}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-lg border border-[#d3d3db] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#17171c] hover:bg-[#f6f6f8]"
        >
          Try again
        </button>
      )}
    </div>
  )
}

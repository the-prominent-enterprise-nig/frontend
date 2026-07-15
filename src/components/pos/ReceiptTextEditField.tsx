import type { ReactNode, RefObject } from 'react'

interface Token {
  token: string
  label: string
}

interface Props {
  label: string
  helperText: string
  value: string
  onChange: (value: string) => void
  maxLength: number
  rows: number
  placeholder?: string
  badge?: ReactNode
  tokens?: Token[]
  onInsertToken?: (token: string) => void
  textareaRef?: RefObject<HTMLTextAreaElement | null>
}

export function ReceiptTextEditField({
  label,
  helperText,
  value,
  onChange,
  maxLength,
  rows,
  placeholder,
  badge,
  tokens,
  onInsertToken,
  textareaRef,
}: Props) {
  return (
    <div className="border-t border-gray-100 pt-5">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">{label}</p>
        {badge}
      </div>
      <p className="mb-3 text-xs text-gray-500">{helperText}</p>
      <textarea
        ref={textareaRef}
        value={value}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-300"
      />
      <div className="mt-1 flex items-center justify-between">
        {tokens && onInsertToken ? (
          <div className="flex items-center gap-1.5">
            {tokens.map((t) => (
              <button
                key={t.token}
                type="button"
                onClick={() => onInsertToken(t.token)}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 hover:bg-gray-200"
              >
                {t.token}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <p className="text-[10px] text-gray-400">
          {value.length}/{maxLength}
        </p>
      </div>
    </div>
  )
}

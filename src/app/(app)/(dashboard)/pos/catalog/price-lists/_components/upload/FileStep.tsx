'use client'

import { useRef } from 'react'
import { Download, FileText, Loader2, Upload } from 'lucide-react'
import { downloadUploadTemplate } from '../../_lib/upload-template'
import { MONO } from '@/src/libs/design/plex'

type Props = {
  file: File | null
  isBusy: boolean
  onFile: (file: File) => void
}

export function FileStep({ file, isBusy, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    // Reset so choosing the same file again (after fixing it) re-triggers.
    e.target.value = ''
    if (picked) onFile(picked)
  }

  return (
    <section className="rounded-xl border border-[#e4e4e9] bg-white p-5">
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-prominent-purple-900">1. Choose your CSV</h2>
          <p className="mt-1 text-sm text-[#5b5b6b]">
            Export your sheet as CSV (File → Download → Comma-separated values). You will see what
            would change before anything is saved.
          </p>
        </div>

        <button
          type="button"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#d3d3db] py-10 text-sm text-[#5b5b6b] hover:border-[#5b21b6] hover:bg-[#f1ebfb] hover:text-[#3f1490] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {isBusy ? 'Reading your file…' : file ? 'Choose a different file' : 'Choose CSV file'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv"
          className="hidden"
          onChange={handleChange}
          data-testid="price-list-upload-input"
        />

        {file && (
          <div className="flex items-center gap-2 rounded-lg border border-[#d7ebe2] bg-[#eef7f2] px-4 py-3">
            <FileText className="h-4 w-4 shrink-0 text-[#0b6644]" />
            <span className="truncate text-sm text-[#0b6644]">{file.name}</span>
            <span className={`${MONO} ml-auto shrink-0 text-xs text-[#5b5b6b]`}>
              {(file.size / 1024).toFixed(1)} KB
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={downloadUploadTemplate}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5b21b6] hover:text-[#3f1490]"
        >
          <Download className="h-4 w-4" />
          Download CSV template
        </button>
      </div>
    </section>
  )
}

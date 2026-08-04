'use client'

function escapeCsvCell(value: string | number | undefined): string {
  const str = String(value ?? '')
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

/** Triggers a browser download of a client-built CSV — used for exporting
 * transient results (e.g. row errors) that only exist in the current
 * response, not anywhere the user could otherwise get back to. */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | undefined)[][]
): void {
  const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

type TableRowData = Record<string, string>

type TablePreviewData = {
  columns: string[]
  rows: TableRowData[]
}

type DashboardTablePreviewProps = {
  data: TablePreviewData
  emptyMessage?: string
}

export default function DashboardTablePreview({
  data,
  emptyMessage = 'No data available.',
}: DashboardTablePreviewProps) {
  if (data.rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-500">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              {data.columns.map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-zinc-50">
                {data.columns.map((col) => (
                  <td key={col} className="whitespace-nowrap px-5 py-3.5 text-zinc-700">
                    {row[col] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

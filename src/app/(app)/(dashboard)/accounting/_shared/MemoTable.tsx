'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

/**
 * The one table every memo screen uses — customer credit, customer debit,
 * supplier debit, supplier adjustment. They were four hand-rolled tables with
 * four different paddings, palettes and corner radii; the columns differ but
 * the shape never did (expandable row, status badge, row actions).
 *
 * Pairs with ListShell, which supplies the page frame and already renders the
 * bordered container this fills.
 */

export type MemoColumn<T> = {
  key: string
  header: string
  align?: 'left' | 'right'
  /** Optional per-cell classes — e.g. `font-mono` for a reference number. */
  cellClassName?: string
  render: (row: T) => ReactNode
}

type Props<T> = {
  rows: T[]
  columns: MemoColumn<T>[]
  getRowId: (row: T) => string
  loading?: boolean
  /** Shown in place of rows when there are none. */
  emptyState?: ReactNode
  /** When given, each row gets a chevron that reveals this underneath it. */
  renderExpanded?: (row: T) => ReactNode
  /** Right-most cell. Clicks inside it never toggle the row. */
  renderActions?: (row: T) => ReactNode
}

const headCell = 'px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500'

export function MemoTable<T>({
  rows,
  columns,
  getRowId,
  loading,
  emptyState,
  renderExpanded,
  renderActions,
}: Props<T>) {
  const [expanded, setExpanded] = useState<string | null>(null)

  // Chevron column + data columns + actions column.
  const colSpan = columns.length + (renderExpanded ? 1 : 0) + (renderActions ? 1 : 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-left">
          <tr>
            {renderExpanded && <th className={`${headCell} w-8`} />}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${headCell} ${col.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {col.header}
              </th>
            ))}
            {renderActions && <th className={`${headCell} text-right`}>Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {loading && (
            <tr>
              <td colSpan={colSpan} className="px-4 py-10 text-center text-zinc-400">
                Loading…
              </td>
            </tr>
          )}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="px-4 py-12 text-center">
                {emptyState ?? <span className="text-sm text-zinc-500">Nothing to show.</span>}
              </td>
            </tr>
          )}

          {!loading &&
            rows.map((row) => {
              const id = getRowId(row)
              const isOpen = expanded === id
              return (
                <Fragment key={id}>
                  <tr className="hover:bg-zinc-50">
                    {renderExpanded && (
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : id)}
                          className="rounded p-1 text-zinc-400 hover:bg-zinc-100"
                          aria-label={isOpen ? 'Collapse row' : 'Expand row'}
                          aria-expanded={isOpen}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 ${col.align === 'right' ? 'text-right tabular-nums' : ''} ${col.cellClassName ?? 'text-zinc-700'}`}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                    {renderActions && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {renderActions(row)}
                        </div>
                      </td>
                    )}
                  </tr>
                  {isOpen && renderExpanded && (
                    <tr className="bg-zinc-50/60">
                      <td colSpan={colSpan} className="px-12 py-3">
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
        </tbody>
      </table>
    </div>
  )
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
  APPROVED: 'bg-amber-50 text-amber-700 ring-amber-200',
  FINAL: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ISSUED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  VOID: 'bg-gray-100 text-gray-500 ring-gray-200',
}

/** One badge style across every memo screen. `ISSUED` is here because the
 * customer-side memos still use it — only the supplier ones gained the
 * draft/approve lifecycle. */
export function MemoStatusBadge({ status, title }: { status: string; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STATUS_BADGE[status] ?? STATUS_BADGE.DRAFT
      }`}
    >
      {status}
    </span>
  )
}

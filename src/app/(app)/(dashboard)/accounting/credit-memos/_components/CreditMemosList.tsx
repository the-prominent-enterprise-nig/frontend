'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Ban } from 'lucide-react'
import {
  CreditMemos,
  type CreditMemo,
  type CreditMemoType,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'
import Tooltip from '@/src/components/ui/Tooltip'
import { hasPermission } from '@/src/hooks/usePermission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import CreditMemoDialog from '../../_shared/CreditMemoDialog'
import { showToast } from '@/src/components/ui/toast'
import { ListShell } from '../../_shared/ListShell'
import { MemoStatusBadge, MemoTable, type MemoColumn } from '@/src/components/accounting/MemoTable'

const TYPE_LABELS: Record<CreditMemoType, string> = {
  sales_return: 'Sales Return',
  billing_adjustment: 'Billing Adjustment',
  goodwill: 'Goodwill',
}

/**
 * Customer-side credit memos — reduces what a customer owes on an AR invoice.
 * Rebuilt onto ListShell + MemoTable to match its sibling memo screens.
 */
export default function CreditMemosList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, ACCOUNTING_PERMISSIONS.CREDIT_MEMOS_CREATE)
  const [search, setSearch] = useState('')
  const [voiding, setVoiding] = useState<string | null>(null)
  const [raising, setRaising] = useState(false)

  const query = useQuery({
    queryKey: ['customer-credit-memos', search],
    queryFn: () => CreditMemos.list(search ? { search } : undefined),
    staleTime: 30_000,
  })
  const memos = query.data?.data?.items ?? []

  async function voidMemo(id: string) {
    if (
      !confirm(
        'Void this credit memo? This reverses its journal entry and restores the invoice balance.'
      )
    ) {
      return
    }
    setVoiding(id)
    const res = await CreditMemos.void(id)
    setVoiding(null)
    if (!res.success) {
      showToast({
        title: 'Could not void',
        description: res.message || res.error || 'Failed to void credit memo',
        status: 'error',
      })
      return
    }
    showToast({ title: 'Memo voided', status: 'success' })
    query.refetch()
  }

  const columns: MemoColumn<CreditMemo>[] = [
    {
      key: 'memoNumber',
      header: 'Memo No.',
      cellClassName: 'font-mono text-xs text-zinc-700',
      render: (m) => m.memoNumber,
    },
    { key: 'memoDate', header: 'Issue Date', render: (m) => fmtDate(m.memoDate) },
    { key: 'customer', header: 'Customer', render: (m) => m.customer?.name ?? '—' },
    {
      key: 'invoice',
      header: 'Invoice',
      render: (m) =>
        m.arInvoice ? (
          <Link
            href={`/accounting/ar-invoices/${m.arInvoice.id}`}
            className="font-mono text-prominent-purple-700 hover:underline"
          >
            {m.arInvoice.invoiceNumber}
          </Link>
        ) : (
          '—'
        ),
    },
    { key: 'type', header: 'Type', render: (m) => TYPE_LABELS[m.type] ?? m.type },
    {
      key: 'origin',
      header: 'Origin',
      render: (m) =>
        m.sourceReturnRequestId ? (
          <span className="text-xs text-amber-700" title={m.sourceReturnRequestId}>
            Auto — POS return
          </span>
        ) : (
          <span className="text-xs text-zinc-400">Manual</span>
        ),
    },
    {
      key: 'amount',
      header: 'Total',
      align: 'right',
      cellClassName: 'font-medium text-zinc-900',
      render: (m) => fmtMoney(m.amount),
    },
    { key: 'status', header: 'Status', render: (m) => <MemoStatusBadge status={m.status} /> },
  ]

  return (
    <ListShell
      title="Credit Memos"
      description="Every credit memo issued against an AR invoice — manual or auto-created from an approved POS return."
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search memo no. or reason…"
      onRefresh={() => query.refetch()}
      isFetching={query.isFetching}
      onAdd={() => setRaising(true)}
      addLabel="New Credit Memo"
      canAdd={canCreate}
    >
      <MemoTable
        rows={memos}
        columns={columns}
        getRowId={(m) => m.id}
        loading={query.isLoading}
        emptyState={<span className="text-sm text-zinc-500">No credit memos found.</span>}
        renderExpanded={(memo) => (
          <>
            {memo.reason && (
              <div className="mb-2 text-xs text-zinc-600">
                <span className="font-medium">Reason: </span>
                {memo.reason}
              </div>
            )}
            {memo.lines.length === 0 ? (
              <p className="text-xs text-zinc-400">No line items.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-left text-zinc-500">
                  <tr>
                    <th className="py-1">Item</th>
                    <th className="py-1">Serial</th>
                    <th className="py-1 text-right">Qty</th>
                    <th className="py-1 text-right">Unit Price</th>
                    <th className="py-1 text-right">Deduction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {memo.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="py-1.5 text-zinc-800">{l.itemName ?? l.itemId}</td>
                      <td className="py-1.5 text-zinc-600">
                        {l.serialNumber?.serialNumber ?? '—'}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{l.quantity}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtMoney(l.unitPrice)}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {fmtMoney(l.deductionAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
        renderActions={(memo) =>
          memo.status === 'ISSUED' ? (
            <Tooltip label="Void credit memo">
              <button
                type="button"
                onClick={() => voidMemo(memo.id)}
                disabled={voiding === memo.id}
                aria-label="Void credit memo"
                className="rounded p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
              </button>
            </Tooltip>
          ) : null
        }
      />
      {/* No invoice is chosen up front — the dialog asks for it as its first
          field, so the form is visible while the choice is being made. */}
      {raising && (
        <CreditMemoDialog
          onClose={() => setRaising(false)}
          onSaved={() => {
            setRaising(false)
            query.refetch()
          }}
        />
      )}
    </ListShell>
  )
}

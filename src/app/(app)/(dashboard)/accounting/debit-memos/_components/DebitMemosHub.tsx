'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Ban } from 'lucide-react'
import {
  DebitMemos,
  SupplierDebitMemos,
  fmtDate,
  fmtMoney,
  type DebitMemo,
  type DebitMemoType,
  type SupplierDebitMemo,
} from '@/src/libs/data/AccountingV2Data'
import { hasPermission } from '@/src/hooks/usePermission'
import DebitMemoDialog from '../../_shared/DebitMemoDialog'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import Tooltip from '@/src/components/ui/Tooltip'
import { showToast } from '@/src/components/ui/toast'
import { ListShell } from '../../_shared/ListShell'
import { MemoStatusBadge, MemoTable, type MemoColumn } from '@/src/components/accounting/MemoTable'
import { SupplierDebitMemoDetail } from '@/src/components/accounting/SupplierDebitMemoDetail'

const CUSTOMER_TYPE_LABELS: Record<DebitMemoType, string> = {
  unit_replacement: 'Unit Replacement',
  billing_adjustment: 'Billing Adjustment',
}

/** One row shape covering both sides, so a single table can list them. The
 * original record rides along for the detail panel and row actions, which
 * genuinely differ between the two. */
type Row = {
  id: string
  kind: 'customer' | 'supplier'
  memoNumber: string
  memoDate: string
  partyName: string
  invoiceNumber: string
  amount: number
  status: string
  customer?: DebitMemo
  supplier?: SupplierDebitMemo
}

/**
 * Every debit memo in one table — customer-side (raises an AR invoice) and
 * supplier-side (reduces an AP bill) together, told apart by a Party column
 * rather than by separate tabs.
 *
 * Credit memos keep their own screen: credit vs debit is the split accounting
 * thinks in, so collapsing those together would bury it.
 *
 * Supplier support and sponsorship are not separate documents — they are
 * non-inventory lines on a supplier debit memo, raised from Inventory.
 */
export function DebitMemosHub({ session }: { session: SessionUser }) {
  const canReadCustomer = hasPermission(session, ACCOUNTING_PERMISSIONS.DEBIT_MEMOS_READ)
  const canReadSupplier = hasPermission(session, ACCOUNTING_PERMISSIONS.SUPPLIER_DEBIT_MEMOS_READ)
  const canVoidCustomer = hasPermission(session, ACCOUNTING_PERMISSIONS.DEBIT_MEMOS_VOID)
  // Customer-side only. A supplier debit memo needs the warehouse, the items,
  // the DR number and the waybill — all of which live with the goods, so it
  // is raised in Inventory and only ever read here.
  const canCreateCustomer = hasPermission(session, ACCOUNTING_PERMISSIONS.DEBIT_MEMOS_CREATE)

  const [search, setSearch] = useState('')
  const [voiding, setVoiding] = useState<string | null>(null)
  const [raising, setRaising] = useState(false)

  // Arriving from an AP bill's row — narrow to that invoice's memos, which are
  // necessarily supplier-side.
  const apBillId = useSearchParams().get('apBillId') ?? undefined

  const customerQuery = useQuery({
    queryKey: ['customer-debit-memos', search],
    queryFn: () => DebitMemos.list(search ? { search } : undefined),
    enabled: canReadCustomer && !apBillId,
    staleTime: 30_000,
  })

  const supplierQuery = useQuery({
    queryKey: ['accounting-supplier-debit-memos', search, apBillId],
    queryFn: () =>
      SupplierDebitMemos.list({
        // Accounting only deals in finished memos; a draft still being decided
        // in Inventory is not their business.
        status: 'FINAL',
        ...(search && { search }),
        ...(apBillId && { apBillId }),
      }),
    enabled: canReadSupplier,
    staleTime: 30_000,
  })

  const rows: Row[] = useMemo(() => {
    const customer: Row[] = (customerQuery.data?.data?.items ?? []).map((m) => ({
      id: m.id,
      kind: 'customer' as const,
      memoNumber: m.memoNumber,
      memoDate: m.memoDate,
      partyName: m.customer?.name ?? '—',
      invoiceNumber: m.arInvoice?.invoiceNumber ?? '—',
      amount: m.amount,
      status: m.status,
      customer: m,
    }))
    const supplier: Row[] = (supplierQuery.data?.data?.items ?? []).map((m) => ({
      id: m.id,
      kind: 'supplier' as const,
      memoNumber: m.memoNumber,
      memoDate: m.memoDate,
      partyName: m.supplier?.name ?? '—',
      invoiceNumber: m.apBill?.billNumber ?? '—',
      amount: m.amount,
      status: m.status,
      supplier: m,
    }))
    // Both sides in one list, newest first — the Party column tells them
    // apart, which is the whole reason the two lists were merged.
    return [...customer, ...supplier].sort((a, b) => b.memoDate.localeCompare(a.memoDate))
  }, [customerQuery.data, supplierQuery.data])

  async function voidCustomerMemo(id: string) {
    if (
      !confirm(
        'Void this debit memo? This reverses its journal entry and restores the invoice balance.'
      )
    ) {
      return
    }
    setVoiding(id)
    const res = await DebitMemos.void(id)
    setVoiding(null)
    if (!res.success) {
      showToast({
        title: 'Could not void',
        description: res.message || res.error || 'Failed to void debit memo',
        status: 'error',
      })
      return
    }
    showToast({ title: 'Memo voided', status: 'success' })
    customerQuery.refetch()
  }

  const columns: MemoColumn<Row>[] = [
    {
      key: 'memoNumber',
      header: 'Memo No.',
      cellClassName: 'font-mono text-xs text-zinc-700',
      render: (r) => r.memoNumber,
    },
    { key: 'memoDate', header: 'Issue Date', render: (r) => fmtDate(r.memoDate) },
    {
      key: 'kind',
      header: 'Party',
      render: (r) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
            r.kind === 'customer'
              ? 'bg-sky-50 text-sky-700 ring-sky-200'
              : 'bg-violet-50 text-violet-700 ring-violet-200'
          }`}
        >
          {r.kind === 'customer' ? 'Customer' : 'Supplier'}
        </span>
      ),
    },
    { key: 'party', header: 'Name', render: (r) => r.partyName },
    { key: 'invoice', header: 'Invoice', render: (r) => r.invoiceNumber },
    {
      key: 'amount',
      header: 'Total',
      align: 'right',
      cellClassName: 'font-medium text-zinc-900',
      render: (r) => fmtMoney(r.amount),
    },
    { key: 'status', header: 'Status', render: (r) => <MemoStatusBadge status={r.status} /> },
  ]

  const isLoading =
    (customerQuery.isLoading && canReadCustomer && !apBillId) ||
    (supplierQuery.isLoading && canReadSupplier)

  return (
    <ListShell
      title="Debit Memos"
      description="Everything that raises what a customer owes us, or lowers what we owe a supplier."
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search memo no. or reason…"
      onRefresh={() => {
        customerQuery.refetch()
        supplierQuery.refetch()
      }}
      isFetching={customerQuery.isFetching || supplierQuery.isFetching}
      onAdd={() => setRaising(true)}
      addLabel="New Debit Memo"
      canAdd={canCreateCustomer}
      filters={
        apBillId ? (
          <a href="/accounting/debit-memos" className="text-xs text-prominent-purple-700 underline">
            Filtered to one invoice — show all
          </a>
        ) : null
      }
    >
      <MemoTable
        rows={rows}
        columns={columns}
        getRowId={(r) => `${r.kind}-${r.id}`}
        loading={isLoading}
        emptyState={<span className="text-sm text-zinc-500">No debit memos.</span>}
        renderExpanded={(r) =>
          r.kind === 'customer' ? (
            <CustomerDetail memo={r.customer!} />
          ) : (
            <SupplierDebitMemoDetail memo={r.supplier!} />
          )
        }
        renderActions={(r) =>
          // Supplier memos are read-only here — approve, finalize and void all
          // belong to Inventory, where the physical return is handled.
          r.kind === 'customer' && r.status === 'ISSUED' && canVoidCustomer ? (
            <Tooltip label="Void debit memo">
              <button
                type="button"
                onClick={() => voidCustomerMemo(r.id)}
                disabled={voiding === r.id}
                aria-label="Void debit memo"
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
        <DebitMemoDialog
          onClose={() => setRaising(false)}
          onSaved={() => {
            setRaising(false)
            customerQuery.refetch()
          }}
        />
      )}
    </ListShell>
  )
}

function CustomerDetail({ memo }: { memo: DebitMemo }) {
  return (
    <>
      <dl className="mb-3 grid gap-x-8 gap-y-1 text-xs sm:grid-cols-3">
        <div className="flex gap-2">
          <dt className="text-zinc-500">Type</dt>
          <dd className="text-zinc-800">{CUSTOMER_TYPE_LABELS[memo.type] ?? memo.type}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-zinc-500">Invoice</dt>
          <dd className="text-zinc-800">
            {memo.arInvoice ? (
              <Link
                href={`/accounting/ar-invoices/${memo.arInvoice.id}`}
                className="font-mono text-prominent-purple-700 hover:underline"
              >
                {memo.arInvoice.invoiceNumber}
              </Link>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-zinc-500">Reason</dt>
          <dd className="text-zinc-800">{memo.reason ?? '—'}</dd>
        </div>
      </dl>
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
              <th className="py-1 text-right">Addition</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {memo.lines.map((l) => (
              <tr key={l.id}>
                <td className="py-1.5 text-zinc-800">{l.itemName ?? l.itemId}</td>
                <td className="py-1.5 text-zinc-600">{l.serialNumber?.serialNumber ?? '—'}</td>
                <td className="py-1.5 text-right tabular-nums">{l.quantity}</td>
                <td className="py-1.5 text-right tabular-nums">{fmtMoney(l.unitPrice)}</td>
                <td className="py-1.5 text-right tabular-nums">{fmtMoney(l.additionAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

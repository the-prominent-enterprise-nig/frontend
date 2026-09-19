'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw } from 'lucide-react'
import { getItems } from '../../items/_actions/get-items'
import { getAccounts } from '@/src/libs/data/AccountingData'
import { createSupplier } from '../_actions/create-supplier'
import { updateSupplier } from '../_actions/update-supplier'
import { hasPermission } from '@/src/hooks/usePermission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { showToast } from '@/src/components/ui/toast'
import { PLEX } from '@/src/libs/design/plex'
import type { CreateSupplierFormValues, SupplierDetail } from '@/src/schema/inventory/suppliers'
import { useSuppliers, type StatusFilter } from '../_hooks/useSuppliers'
import SupplierList from './SupplierList'
import SupplierDetailPanel from './SupplierDetailPanel'
import { SupplierFormModal } from './SupplierFormModal'

/**
 * The Suppliers screen: who we buy from, the terms we buy on, and the items
 * they carry.
 *
 * Master/detail rather than a table, because a supplier is read one at a time —
 * the questions asked here ("are they cleared to use", "what do they carry",
 * "where do we pay them") are all about one row, and none of them fit a column.
 */
export default function SupplierDirectory({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, PROCUREMENT_PERMISSIONS.SUPPLIERS_CREATE)
  const canUpdate = hasPermission(session, PROCUREMENT_PERMISSIONS.SUPPLIERS_UPDATE)
  // Procurement gates its "+ New Purchase" on PR_CREATE, because creating
  // there drafts a purchase request rather than a live PO. The shortcut from
  // here lands on that same form, so it answers to the same permission.
  const canBuy = hasPermission(session, PROCUREMENT_PERMISSIONS.PR_CREATE)

  const queryClient = useQueryClient()
  const {
    suppliers,
    allSuppliers,
    stats,
    filters,
    setFilters,
    resetFilters,
    hasActiveFilters,
    selected,
    selectedId,
    select,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useSuppliers()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierDetail | null>(null)

  // On a wide screen the panel has a column of its own, so leaving it empty
  // wastes it — the first supplier opens itself. On a phone the two share the
  // screen, and auto-opening one would hide the list before it was read.
  const autoSelected = useRef(false)
  useEffect(() => {
    if (autoSelected.current || selectedId || suppliers.length === 0) return
    if (!window.matchMedia('(min-width: 1024px)').matches) return
    autoSelected.current = true
    select(suppliers[0].id)
  }, [suppliers, selectedId, select])

  const itemsQuery = useQuery({
    queryKey: ['inventory-items-lookup-active'],
    queryFn: () => getItems({ limit: 500, lifecycle: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  // Scenario 33 — GL account options for defaultPayableAccountId /
  // defaultExpenseAccountId, on the form and read back on the Profile tab.
  const accountsQuery = useQuery({
    queryKey: ['accounting-accounts-lookup'],
    queryFn: () => getAccounts({ limit: 500 }),
    staleTime: 5 * 60 * 1000,
  })

  const itemOptions = (itemsQuery.data?.data?.data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
  }))
  const accountOptions = ((accountsQuery.data?.data as { items?: unknown })?.items ??
    accountsQuery.data?.data ??
    []) as { id: string; name: string; number?: string }[]

  const saveMutation = useMutation({
    mutationFn: async (data: CreateSupplierFormValues) =>
      editing ? updateSupplier(editing.id, data) : createSupplier(data),
  })

  async function handleSubmit(data: CreateSupplierFormValues) {
    const wasEditing = editing
    const result = await saveMutation.mutateAsync(data)

    if (!result.success) {
      showToast({
        title: wasEditing ? 'Could not save the supplier' : 'Could not create the supplier',
        description: result.message || result.error,
        status: 'error',
      })
      return
    }

    showToast({
      title: wasEditing ? 'Supplier updated' : 'Supplier created',
      description: wasEditing
        ? 'New purchase orders will use the updated terms.'
        : 'It can be picked on purchase orders and receiving reports now.',
      status: 'success',
    })

    queryClient.invalidateQueries({ queryKey: ['suppliers-directory'] })
    if (wasEditing) {
      queryClient.invalidateQueries({ queryKey: ['supplier', wasEditing.id] })
    } else if (result.data?.id) {
      // Open what was just created — the whole reason for adding it is to work
      // on it next (link its items, finish its onboarding).
      select(result.data.id)
    }

    setFormOpen(false)
    setEditing(null)
  }

  const pills: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: stats.total },
    { value: 'active', label: 'Active', count: stats.active },
    { value: 'inactive', label: 'Inactive', count: stats.inactive },
    // Only worth a pill once something is actually barred.
    ...(stats.blacklisted > 0
      ? [{ value: 'blacklisted' as StatusFilter, label: 'Blacklisted', count: stats.blacklisted }]
      : []),
  ]

  return (
    <div className={`min-h-full w-full bg-zinc-50 p-4 md:p-6 lg:p-8 ${PLEX}`}>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-[#17171c] md:text-3xl">Suppliers</h1>
            <p className="mt-1 text-sm text-[#5b5b6b]">
              Who you buy from, the terms you buy on, and the items they carry.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh"
              className="flex items-center gap-2 rounded-lg border border-[#e4e4e9] bg-white px-3 py-2 text-sm font-medium text-[#3d3d4a] hover:border-[#d3d3db] hover:bg-[#fbfbfc] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
                className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-3 py-2 text-sm font-medium text-white hover:bg-[#4a189b] sm:px-4"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New supplier</span>
                <span className="sm:hidden">New</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {pills.map((pill) => {
            const isOn = filters.status === pill.value
            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => setFilters({ status: pill.value })}
                aria-pressed={isOn}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  isOn
                    ? 'border-[#5b21b6] bg-[#5b21b6] text-white'
                    : 'border-[#e4e4e9] bg-white text-[#3d3d4a] hover:border-[#d3d3db]'
                }`}
              >
                {pill.label}
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${
                    isOn ? 'bg-white/20' : 'bg-[#f1f1f4] text-[#5b5b6b]'
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            )
          })}

          {/* Not a status — the queue of suppliers somebody still has to clear. */}
          <button
            type="button"
            onClick={() => setFilters({ needsAttention: !filters.needsAttention })}
            aria-pressed={filters.needsAttention}
            title="Onboarding not yet approved"
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
              filters.needsAttention
                ? 'border-[#8a4b06] bg-[#8a4b06] text-white'
                : 'border-[#f5e2c6] bg-[#fffdf8] text-[#8a4b06] hover:border-[#d9bb84]'
            }`}
          >
            Needs attention
            <span
              className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${
                filters.needsAttention ? 'bg-white/20' : 'bg-[#fdf3e7]'
              }`}
            >
              {stats.needsAttention}
            </span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#3f1490] hover:bg-[#f1ebfb]"
            >
              Clear filters
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-[#f3c9c5] bg-[#fdeceb] p-4">
            <p className="text-sm font-medium text-[#8f1c14]">Failed to load suppliers</p>
          </div>
        )}

        {/* Master / detail */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-stretch">
          {/* The column is `relative` and the list inside it `absolute`, so the
              list contributes no height of its own: the row is sized by the
              panel beside it and the list fills exactly that, however many
              hundred suppliers are on file. Floored so a short panel — the
              empty state, a supplier with two linked items — still leaves a
              list worth scrolling. */}
          <div className={`${selected ? 'hidden lg:block' : 'block'} relative lg:min-h-[30rem]`}>
            <div className="flex min-h-0 flex-col overflow-hidden lg:absolute lg:inset-0">
              <SupplierList
                suppliers={suppliers}
                totalCount={allSuppliers.length}
                selectedId={selectedId}
                query={filters.query}
                onQueryChange={(query) => setFilters({ query })}
                onSelect={select}
                isLoading={isLoading}
                onClearFilters={resetFilters}
              />
            </div>
          </div>

          <div className={selected ? 'block' : 'hidden lg:block'}>
            {selected ? (
              <SupplierDetailPanel
                key={selected.id}
                supplierId={selected.id}
                itemOptions={itemOptions}
                accountOptions={accountOptions}
                canUpdate={canUpdate}
                canBuy={canBuy}
                onEdit={(supplier) => {
                  setEditing(supplier)
                  setFormOpen(true)
                }}
                onBack={() => select(null)}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-[#d3d3db] bg-white px-6 py-20 text-center">
                <p className="text-sm font-medium text-[#3d3d4a]">Pick a supplier</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#5b5b6b]">
                  Their terms, their onboarding and the items they carry all read from here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <SupplierFormModal
        open={formOpen}
        mode={editing ? 'edit' : 'create'}
        initialData={editing}
        accountOptions={accountOptions}
        existingCodes={allSuppliers
          .filter((s) => s.id !== editing?.id)
          .map((s) => s.code.toLowerCase())}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        isSubmitting={saveMutation.isPending}
      />
    </div>
  )
}

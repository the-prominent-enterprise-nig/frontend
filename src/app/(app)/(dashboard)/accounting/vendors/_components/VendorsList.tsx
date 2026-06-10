'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Search, RefreshCw, Pencil, Trash2 } from 'lucide-react'
import {
  getVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  Vendor,
  VENDOR_TYPES,
  VendorType,
} from '@/src/libs/data/AccountingData'
import { SessionUser, can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import VendorFormDialog from './VendorFormDialog'

interface Props {
  session: SessionUser
}

export default function VendorsList({ session }: Props) {
  const user = session
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)

  const canCreate = can(user, ACCOUNTING_PERMISSIONS.VENDOR_CREATE)
  const canUpdate = can(user, ACCOUNTING_PERMISSIONS.VENDOR_UPDATE)
  const canDelete = can(user, ACCOUNTING_PERMISSIONS.VENDOR_DELETE)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getVendors({ search })
    if (res.success && res.data) {
      const items = Array.isArray(res.data)
        ? res.data
        : ((res.data as { items: Vendor[] }).items ?? [])
      setVendors(items)
    }
    setLoading(false)
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async (data: Partial<Vendor>) => {
    if (editing) {
      await updateVendor(editing.id, data)
    } else {
      await createVendor(data)
    }
    setDialogOpen(false)
    setEditing(null)
    load()
  }

  const handleDelete = async (v: Vendor) => {
    if (!confirm(`Delete vendor "${v.name}"?`)) return
    await updateVendor(v.id, { visibility: false })
    load()
  }

  return (
    <div className="w-full h-full p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Vendors</h2>
            <p className="text-sm text-gray-500 mt-1">Manage vendor master records</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 rounded-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {canCreate && (
              <button
                onClick={() => {
                  setEditing(null)
                  setDialogOpen(true)
                }}
                className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
              >
                <Plus className="h-4 w-4" /> Add Vendor
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Contact
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    TIN
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Tax Rate
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : vendors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      No vendors found
                    </td>
                  </tr>
                ) : (
                  vendors.map((v) => (
                    <tr key={v.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{v.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 text-xs font-medium">
                          {v.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        <div>{v.contactPerson || '-'}</div>
                        <div className="text-xs text-zinc-500">{v.contactNumber || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{v.taxIdNumber || '-'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{v.taxRate || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => {
                                setEditing(v)
                                setDialogOpen(true)
                              }}
                              className="p-1.5 text-purple-700 hover:bg-purple-50 rounded"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(v)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {dialogOpen && (
        <VendorFormDialog
          vendor={editing}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
          onSave={handleSave}
          types={VENDOR_TYPES as VendorType[]}
        />
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import { RowActionsMenu } from '@/src/components/ui/RowActionsMenu'
import { Modal, ConfirmDialog } from '@/src/components/ui/Modal'
import { showToast } from '@/src/components/ui/toast'
import {
  EditSerialFormSchema,
  type EditSerialFormInput,
} from '@/src/schema/inventory/serial-numbers'
import {
  editSerialNumber,
  deleteSerialNumber,
  checkSerialDeletable,
} from '../_actions/edit-delete-serial'

type Serial = { id: string; serialNumber: string }

const FIELD_CLASS =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

function useRefreshSerials(): () => void {
  const queryClient = useQueryClient()
  return (): void => {
    queryClient.invalidateQueries({ queryKey: ['inventory-serial-numbers'] })
    queryClient.invalidateQueries({ queryKey: ['inventory-caravan-group-serials'] })
  }
}

/** The row's ⋮ menu (last column of the stock book) — Edit and Delete, for the
 * Business Owner and the Inventory/EDP Head at Mabini. */
export default function SerialOwnerActions({ serial }: { serial: Serial }): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <Tooltip label="Edit or delete this serial" align="end">
        <RowActionsMenu
          items={[
            { label: 'Edit serial number', icon: Pencil, onClick: () => setEditing(true) },
            {
              label: 'Delete serial number',
              icon: Trash2,
              variant: 'danger',
              onClick: () => setDeleting(true),
            },
          ]}
        />
      </Tooltip>
      {editing && <EditSerialModal serial={serial} onClose={() => setEditing(false)} />}
      {deleting && (
        <DeleteSerialDialog
          serial={serial}
          onClose={() => setDeleting(false)}
          onEditInstead={() => {
            setDeleting(false)
            setEditing(true)
          }}
        />
      )}
    </div>
  )
}

function EditSerialModal({
  serial,
  onClose,
}: {
  serial: Serial
  onClose: () => void
}): React.JSX.Element {
  const refresh = useRefreshSerials()
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditSerialFormInput>({
    resolver: zodResolver(EditSerialFormSchema),
    defaultValues: { serialNumber: serial.serialNumber },
  })

  async function onSubmit(data: EditSerialFormInput): Promise<void> {
    const result = await editSerialNumber(serial.id, data)
    if (!result.success) {
      showToast({ title: 'Could not update', description: result.message, status: 'error' })
      return
    }
    showToast({ title: 'Serial number updated', status: 'success' })
    refresh()
    onClose()
  }

  return (
    <Modal
      open
      title="Edit Serial Number"
      description="Fix a typo. The unit keeps its full history."
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-serial-form"
            disabled={isSubmitting || !isDirty}
            className="rounded-lg bg-prominent-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      }
    >
      <form id="edit-serial-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Serial number</label>
        <Controller
          name="serialNumber"
          control={control}
          render={({ field }) => <input {...field} autoFocus className={FIELD_CLASS} />}
        />
        {errors.serialNumber && (
          <p className="mt-1 text-xs text-red-600">{errors.serialNumber.message}</p>
        )}
      </form>
    </Modal>
  )
}

function DeleteSerialDialog({
  serial,
  onClose,
  onEditInstead,
}: {
  serial: Serial
  onClose: () => void
  onEditInstead: () => void
}): React.JSX.Element {
  const refresh = useRefreshSerials()
  const [loading, setLoading] = useState(false)
  const check = useQuery({
    queryKey: ['serial-delete-check', serial.id],
    queryFn: () => checkSerialDeletable(serial.id),
    staleTime: 0,
  })
  const blocked = check.data?.deletable === false

  async function onConfirm(): Promise<void> {
    setLoading(true)
    const result = await deleteSerialNumber(serial.id)
    setLoading(false)
    if (!result.success) {
      showToast({ title: 'Could not delete', description: result.message, status: 'error' })
      return
    }
    showToast({ title: `${serial.serialNumber} deleted`, status: 'success' })
    refresh()
    onClose()
  }

  return (
    <ConfirmDialog
      open
      title="Delete Serial Number"
      destructive
      loading={loading}
      confirmLabel="Delete"
      confirmDisabled={check.isPending || blocked}
      onConfirm={onConfirm}
      onCancel={onClose}
      message={
        <DeleteSerialMessage
          serialNumber={serial.serialNumber}
          checking={check.isPending}
          blockers={check.data?.blockers ?? []}
          onEditInstead={onEditInstead}
        />
      }
    />
  )
}

function DeleteSerialMessage({
  serialNumber,
  checking,
  blockers,
  onEditInstead,
}: {
  serialNumber: string
  checking: boolean
  blockers: string[]
  onEditInstead: () => void
}): React.JSX.Element {
  const serial = <span className="font-mono font-semibold text-zinc-900">{serialNumber}</span>
  if (checking) return <p>Checking whether {serial} is on any document…</p>
  if (blockers.length === 0) {
    return (
      <p>
        Delete {serial}? It isn&apos;t on any document, so it can go. This can&apos;t be undone.
      </p>
    )
  }
  return (
    <>
      <p>{serial} can&apos;t be deleted. It already appears on:</p>
      <ul className="list-disc space-y-0.5 rounded-lg bg-red-50 py-2 pl-8 pr-3 text-red-700">
        {blockers.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <p>
        Units with history must stay on record. If the serial is just mistyped,{' '}
        <button
          type="button"
          onClick={onEditInstead}
          className="font-medium text-prominent-purple-600 underline hover:text-prominent-purple-700"
        >
          edit it instead
        </button>
        .
      </p>
    </>
  )
}

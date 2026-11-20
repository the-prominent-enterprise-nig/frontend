'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import { Modal, ConfirmDialog } from '@/src/components/ui/Modal'
import { showToast } from '@/src/components/ui/toast'
import {
  EditSerialFormSchema,
  type EditSerialFormInput,
} from '@/src/schema/inventory/serial-numbers'
import { editSerialNumber, deleteSerialNumber } from '../_actions/edit-delete-serial'

type Serial = { id: string; serialNumber: string }

const ICON_BUTTON =
  'flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-ink-subtle disabled:opacity-40'

const FIELD_CLASS =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

function useRefreshSerials(): () => void {
  const queryClient = useQueryClient()
  return (): void => {
    queryClient.invalidateQueries({ queryKey: ['inventory-serial-numbers'] })
    queryClient.invalidateQueries({ queryKey: ['inventory-caravan-group-serials'] })
  }
}

/** Edit and Delete on one stock book row — rendered for the Business Owner and Head Office. */
export default function SerialOwnerActions({ serial }: { serial: Serial }): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <Tooltip label="Edit serial number" align="start">
        <button
          type="button"
          aria-label={`Edit ${serial.serialNumber}`}
          onClick={() => setEditing(true)}
          className={`${ICON_BUTTON} hover:bg-[#f1ebfb] hover:text-[#3f1490]`}
        >
          <Pencil className="h-3 w-3" />
        </button>
      </Tooltip>
      <Tooltip label="Delete serial number" align="start">
        <button
          type="button"
          aria-label={`Delete ${serial.serialNumber}`}
          onClick={() => setDeleting(true)}
          className={`${ICON_BUTTON} hover:bg-red-50 hover:text-red-600`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </Tooltip>
      {editing && <EditSerialModal serial={serial} onClose={() => setEditing(false)} />}
      <DeleteSerialDialog serial={serial} open={deleting} onClose={() => setDeleting(false)} />
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
  open,
  onClose,
}: {
  serial: Serial
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const refresh = useRefreshSerials()
  const [loading, setLoading] = useState(false)

  async function onConfirm(): Promise<void> {
    setLoading(true)
    const result = await deleteSerialNumber(serial.id)
    setLoading(false)
    if (!result.success) {
      showToast({ title: 'Could not delete', description: result.message, status: 'error' })
      return
    }
    showToast({ title: 'Serial number deleted', status: 'success' })
    refresh()
    onClose()
  }

  return (
    <ConfirmDialog
      open={open}
      title="Delete Serial Number"
      destructive
      loading={loading}
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onClose}
      message={
        <>
          <p>
            Delete{' '}
            <span className="font-mono font-semibold text-zinc-900">{serial.serialNumber}</span>?
            This can&apos;t be undone.
          </p>
          <p>
            Only a unit registered by mistake can be deleted. A unit that already appears on a sale,
            transfer or other document must stay on record.
          </p>
        </>
      }
    />
  )
}

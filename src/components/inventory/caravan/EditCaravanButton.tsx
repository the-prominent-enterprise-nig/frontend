'use client'

import { useState } from 'react'
import { useForm, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/src/components/ui/Modal'
import Tooltip from '@/src/components/ui/Tooltip'
import { showToast } from '@/src/components/ui/toast'
import { updateCaravan } from '@/src/app/(app)/(dashboard)/inventory/transfers/_actions/update-caravan'
import {
  NewCaravanFields,
  caravanFormValues,
  type CaravanFieldsForm,
} from '@/src/app/(app)/(dashboard)/inventory/transfers/_components/CaravanDestinationFields'
import { NewCaravanFormSchema, type NewCaravanFormValues } from '@/src/schema/inventory/transfers'
import type { WarehouseBranch } from '@/src/schema/inventory/warehouses'
import { CARAVAN_QUERIES } from './CloseCaravanButton'

const EditCaravanFormSchema = z.object({ newCaravan: NewCaravanFormSchema })
type EditCaravanForm = z.infer<typeof EditCaravanFormSchema>

type Props = {
  caravan: WarehouseBranch
  hostBranchOptions: { value: string; label: string }[]
  // A branch-scoped user keeps the caravan at their own branch.
  hostLocked: boolean
  className: string
}

function useUpdateCaravan(
  caravanId: string,
  onDone: () => void
): {
  save: (data: NewCaravanFormValues) => void
  isSaving: boolean
} {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (data: NewCaravanFormValues) => updateCaravan(caravanId, data),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
        return
      }
      showToast({ title: 'Caravan updated', status: 'success' })
      CARAVAN_QUERIES.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
      onDone()
    },
  })
  return { save: mutation.mutate, isSaving: mutation.isPending }
}

/**
 * The host branch (or head office) edits a caravan's event name, location,
 * dates or host straight from the Caravan tab, at any point until it is
 * closed — not only from a transfer's Edit Request.
 */
export default function EditCaravanButton({
  caravan,
  hostBranchOptions,
  hostLocked,
  className,
}: Props): React.ReactElement {
  const [open, setOpen] = useState(false)
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditCaravanForm>({ resolver: zodResolver(EditCaravanFormSchema) })
  const { save, isSaving } = useUpdateCaravan(caravan.id, () => setOpen(false))

  const openForm = (): void => {
    reset({ newCaravan: caravanFormValues(caravan) })
    setOpen(true)
  }
  const submit = handleSubmit((data) => save(data.newCaravan))

  return (
    <>
      <Tooltip label="Edit caravan" side="bottom" align="end">
        <button type="button" onClick={openForm} aria-label="Edit caravan" className={className}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
      <Modal
        open={open}
        title="Edit caravan"
        onClose={() => setOpen(false)}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isSaving}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={isSaving}
              className="rounded-lg bg-prominent-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        }
      >
        <NewCaravanFields
          control={control as unknown as Control<CaravanFieldsForm>}
          errors={errors}
          hostBranchOptions={hostBranchOptions}
          hostLocked={hostLocked}
        />
      </Modal>
    </>
  )
}

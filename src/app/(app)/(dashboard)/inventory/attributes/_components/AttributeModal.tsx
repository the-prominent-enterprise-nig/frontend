'use client'

import { useEffect } from 'react'
import { useForm, Controller, useWatch, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  AttributeDefinitionFormSchema,
  type AttributeDefinitionFormValues,
  type AttributeDefinition,
} from '@/src/schema/inventory/attributes'
import type { ApiResponse } from '@/src/libs/api/client'

type CategoryOption = { id: string; name: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: AttributeDefinitionFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  categories: CategoryOption[]
  editTarget?: AttributeDefinition | null
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'
const readonlyClass =
  'w-full rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 cursor-default'

const emptyDefaults: AttributeDefinitionFormValues = {
  categoryId: '',
  attributeKey: '',
  displayName: '',
  dataType: 'text',
  isRequired: false,
  defaultValue: '',
  options: [],
  displayOrder: 0,
}

export default function AttributeModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  categories,
  editTarget,
}: Props) {
  const isEdit = !!editTarget

  const {
    control,
    handleSubmit,
    reset,
    register,
    formState: { errors },
  } = useForm<AttributeDefinitionFormValues>({
    resolver: zodResolver(AttributeDefinitionFormSchema),
    defaultValues: emptyDefaults,
  })

  const dataType = useWatch({ control, name: 'dataType' })
  const needsOptions = dataType === 'dropdown' || dataType === 'multi_select'

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'options' as never,
  })

  useEffect(() => {
    if (isOpen && editTarget) {
      reset({
        categoryId: editTarget.categoryId,
        attributeKey: editTarget.attributeKey,
        displayName: editTarget.displayName,
        dataType: editTarget.dataType,
        isRequired: editTarget.isRequired,
        defaultValue: editTarget.defaultValue ?? '',
        options: editTarget.options ?? [],
        displayOrder: editTarget.displayOrder,
      })
    } else if (!isOpen) {
      reset(emptyDefaults)
    }
  }, [isOpen, editTarget, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: AttributeDefinitionFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {isEdit ? 'Edit Attribute' : 'New Attribute Definition'}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {isEdit
                ? 'Update attribute settings. Key and category cannot be changed.'
                : 'Add a custom attribute to an item category.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          <div className="space-y-5 px-6 py-5">
            {/* Category — read-only in edit mode */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Category {!isEdit && <span className="text-red-500">*</span>}
              </label>
              {isEdit ? (
                <p className={readonlyClass}>
                  {categories.find((c) => c.id === editTarget?.categoryId)?.name ??
                    editTarget?.categoryId}
                </p>
              ) : (
                <Controller
                  name="categoryId"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="">Select category…</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
              )}
              {errors.categoryId && (
                <p className="mt-1 text-xs text-red-600">{errors.categoryId.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="displayName"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="e.g. Material"
                      className={fieldClass}
                    />
                  )}
                />
                {errors.displayName && (
                  <p className="mt-1 text-xs text-red-600">{errors.displayName.message}</p>
                )}
              </div>

              {/* Attribute Key — read-only in edit mode */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Attribute Key {!isEdit && <span className="text-red-500">*</span>}
                </label>
                {isEdit ? (
                  <p className={readonlyClass}>{editTarget?.attributeKey}</p>
                ) : (
                  <Controller
                    name="attributeKey"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        placeholder="e.g. material"
                        className={fieldClass}
                      />
                    )}
                  />
                )}
                {errors.attributeKey && (
                  <p className="mt-1 text-xs text-red-600">{errors.attributeKey.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Data Type <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="dataType"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="date">Date</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="multi_select">Multi Select</option>
                    </select>
                  )}
                />
                {errors.dataType && (
                  <p className="mt-1 text-xs text-red-600">{errors.dataType.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Display Order
                </label>
                <Controller
                  name="displayOrder"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      step="1"
                      placeholder="0"
                      className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                      }
                    />
                  )}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Default Value{' '}
                <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="defaultValue"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="Default value…"
                    className={fieldClass}
                  />
                )}
              />
            </div>

            {needsOptions && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-700">
                    Options <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => append('')}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                  >
                    <Plus className="h-3 w-3" />
                    Add option
                  </button>
                </div>
                {fields.length === 0 && (
                  <p className="text-xs text-zinc-400">
                    No options yet — click "Add option" to add choices.
                  </p>
                )}
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2">
                      <input
                        {...register(`options.${index}`)}
                        type="text"
                        placeholder={`Option ${index + 1}`}
                        className={fieldClass}
                      />
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {errors.options && (
                  <p className="mt-1 text-xs text-red-600">All options must have a value.</p>
                )}
              </div>
            )}

            <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
              <Controller
                name="isRequired"
                control={control}
                render={({ field }) => (
                  <input
                    type="checkbox"
                    id="isRequired"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-prominent-purple-700"
                  />
                )}
              />
              <label htmlFor="isRequired" className="text-sm">
                <span className="font-medium text-zinc-800">Required field</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  Items in this category must provide a value for this attribute.
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Attribute'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

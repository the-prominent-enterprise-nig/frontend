'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, Upload, ImageOff } from 'lucide-react'
import {
  CreateCategoryFormSchema,
  CreateCategoryFormValues,
  UpdateCategoryFormSchema,
  UpdateCategoryFormValues,
  FlatCategory,
} from '@/src/schema/inventory/categories'
import type { CategoryNode } from '@/src/schema/inventory/categories'
import type { ApiResponse } from '@/src/libs/api/client'
import { uploadCategoryFile } from '../_actions/category-cover'
import { showToast } from '@/src/components/ui/toast'

type CreateProps = {
  mode: 'create'
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateCategoryFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  parentPreset?: CategoryNode | null
  flatCategories: FlatCategory[]
}

type EditProps = {
  mode: 'edit'
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: UpdateCategoryFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  node: CategoryNode
  flatCategories: FlatCategory[]
}

type Props = CreateProps | EditProps

function coverUrl(fileId: string) {
  return `/api/files/${fileId}/download`
}

export default function CategoryFormModal(props: Props) {
  const { isOpen, onClose, isSubmitting, flatCategories } = props

  const isEdit = props.mode === 'edit'

  const {
    control,
    handleSubmit,
    reset,
    register,
    setValue,
    formState: { errors },
  } = useForm<CreateCategoryFormValues>({
    resolver: zodResolver(isEdit ? UpdateCategoryFormSchema : CreateCategoryFormSchema),
    defaultValues: isEdit
      ? {
          name: props.node.name,
          description: props.node.description ?? undefined,
          parentCategoryId: props.node.parentCategoryId ?? undefined,
          displayOrder: props.node.displayOrder ?? 0,
          status: props.node.status ?? 'active',
          color: props.node.color ?? undefined,
          allowsCustomAttributes: false,
          coverImageFileId: props.node.coverImageFileId ?? undefined,
        }
      : {
          parentCategoryId:
            props.mode === 'create' ? (props.parentPreset?.id ?? undefined) : undefined,
          displayOrder: 0,
          status: 'active',
          allowsCustomAttributes: false,
          coverImageFileId: undefined,
        },
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(
    isEdit && props.node.coverImage ? coverUrl(props.node.coverImage.id) : null
  )
  const [coverFileName, setCoverFileName] = useState<string | null>(
    isEdit ? (props.node.coverImage?.originalName ?? null) : null
  )
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [coverImgError, setCoverImgError] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      reset()
      setCoverPreviewUrl(null)
      setCoverFileName(null)
      setCoverImgError(false)
    }
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingCover(true)
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadCategoryFile(fd)
    setIsUploadingCover(false)
    e.target.value = ''

    if (!result.success || !result.data) {
      showToast({ title: 'Upload failed', description: result.message, status: 'error' })
      return
    }

    setValue('coverImageFileId', result.data.id)
    setCoverPreviewUrl(coverUrl(result.data.id))
    setCoverFileName(result.data.originalName)
    setCoverImgError(false)
  }

  function handleRemoveCover() {
    setValue('coverImageFileId', undefined)
    setCoverPreviewUrl(null)
    setCoverFileName(null)
    setCoverImgError(false)
  }

  async function handleFormSubmit(data: CreateCategoryFormValues) {
    const result = await (
      props.onSubmit as (d: CreateCategoryFormValues) => Promise<ApiResponse<unknown>>
    )(data)
    if (result.success) {
      onClose()
    }
  }

  const selfId = isEdit ? props.node.id : null
  const parentOptions = flatCategories.filter((c) => c.id !== selfId)

  const title = isEdit
    ? `Edit "${props.node.name}"`
    : props.mode === 'create' && props.parentPreset
      ? `Add sub-category under "${props.parentPreset.name}"`
      : 'Add Category'

  const fieldClass =
    'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {isEdit ? 'Update category details.' : 'Create a new category or sub-category.'}
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
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Name <span className="text-red-500">*</span>
              </label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. Electronics"
                    className={fieldClass}
                  />
                )}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">Description</label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={2}
                    placeholder="Optional description"
                    className={`${fieldClass} resize-none`}
                  />
                )}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Parent Category
              </label>
              <Controller
                name="parentCategoryId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || undefined)}
                    className={`${fieldClass} bg-white`}
                  >
                    <option value="">— None (top-level) —</option>
                    {parentOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Display Order</label>
              <Controller
                name="displayOrder"
                control={control}
                render={({ field }) => (
                  <input
                    type="number"
                    min={0}
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    className={fieldClass}
                  />
                )}
              />
              {errors.displayOrder && (
                <p className="mt-1 text-xs text-red-600">{errors.displayOrder.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Status</label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <select {...field} className={`${fieldClass} bg-white`}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                )}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Color</label>
              <Controller
                name="color"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={field.value ?? ''}
                    type="text"
                    placeholder="e.g. #3b82f6"
                    className={`${fieldClass} font-mono`}
                  />
                )}
              />
            </div>

            {/* Hidden field — ensures coverImageFileId is included in submit payload */}
            <input type="hidden" {...register('coverImageFileId')} />

            <div className="flex items-center gap-2 sm:col-span-2">
              <Controller
                name="allowsCustomAttributes"
                control={control}
                render={({ field }) => (
                  <input
                    id="allowsCustomAttributes"
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-600 focus:ring-prominent-purple-500"
                  />
                )}
              />
              <label htmlFor="allowsCustomAttributes" className="text-sm text-zinc-700">
                Allow custom attributes on items in this category
              </label>
            </div>

            {/* Cover Image */}
            <div className="sm:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700">
                  Cover Image
                  <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>
                </label>
                {!coverPreviewUrl && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingCover || isSubmitting}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {isUploadingCover ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {isUploadingCover ? 'Uploading…' : 'Upload'}
                  </button>
                )}
              </div>

              {coverPreviewUrl ? (
                <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                    {coverImgError ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageOff className="h-5 w-5 text-zinc-300" />
                      </div>
                    ) : (
                      <img
                        src={coverPreviewUrl}
                        alt="Cover preview"
                        className="h-full w-full object-cover"
                        onError={() => setCoverImgError(true)}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {coverFileName && (
                      <p className="truncate text-xs text-zinc-600">{coverFileName}</p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingCover || isSubmitting}
                        className="text-xs font-medium text-prominent-purple-700 hover:underline disabled:opacity-50"
                      >
                        Change
                      </button>
                      <span className="text-zinc-300">·</span>
                      <button
                        type="button"
                        onClick={handleRemoveCover}
                        disabled={isSubmitting}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingCover || isSubmitting}
                  className="w-full rounded-lg border-2 border-dashed border-zinc-200 py-4 text-center text-xs text-zinc-400 hover:border-prominent-purple-300 hover:bg-prominent-purple-50 hover:text-prominent-purple-600 disabled:opacity-50"
                >
                  {isUploadingCover ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading…
                    </span>
                  ) : (
                    'Click to upload cover image'
                  )}
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverSelect}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isUploadingCover}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingCover}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

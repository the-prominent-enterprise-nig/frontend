'use client'

import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Crown, Trash2, Upload, ImageOff, Info } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import {
  listItemImages,
  addItemImage,
  updateItemImage,
  removeItemImage,
  uploadItemFile,
  getVariantImages,
  type ItemImage,
} from '../_actions/item-images'

interface Props {
  itemId: string
  variantId?: string
}

function imageUrl(fileId: string) {
  return `/api/files/${fileId}/download`
}

function Thumbnail({
  image,
  onSetPrimary,
  onDelete,
  isPending,
}: {
  image: ItemImage
  onSetPrimary: () => void
  onDelete: () => void
  isPending: boolean
}) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
      {imgError ? (
        <div className="flex h-full w-full items-center justify-center">
          <ImageOff className="h-6 w-6 text-zinc-300" />
        </div>
      ) : (
        <img
          src={imageUrl(image.fileId)}
          alt={image.file.originalName}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      )}

      {image.isPrimary && (
        <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-prominent-purple-700 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
          <Crown className="h-2.5 w-2.5" />
          Primary
        </div>
      )}

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        {!image.isPrimary && (
          <button
            type="button"
            onClick={onSetPrimary}
            disabled={isPending}
            className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-zinc-800 shadow hover:bg-prominent-purple-50 hover:text-prominent-purple-700 disabled:opacity-50"
          >
            Set Primary
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          className="rounded-lg bg-red-600 p-1.5 text-white shadow hover:bg-red-700 disabled:opacity-50"
          aria-label="Remove image"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-prominent-purple-600" />
        </div>
      )}
    </div>
  )
}

export default function ItemImageGallery({ itemId, variantId }: Props) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pendingImageId, setPendingImageId] = useState<string | null>(null)

  const itemImagesKey = ['item-images', itemId]
  const variantImagesKey = ['item-images-variant', itemId, variantId]

  const itemImagesQuery = useQuery({
    queryKey: itemImagesKey,
    queryFn: () => listItemImages(itemId),
    enabled: !!itemId && !variantId,
    staleTime: 30 * 1000,
  })

  const variantImagesQuery = useQuery({
    queryKey: variantImagesKey,
    queryFn: () => getVariantImages(itemId, variantId!),
    enabled: !!itemId && !!variantId,
    staleTime: 30 * 1000,
  })

  const isLoading = variantId ? variantImagesQuery.isLoading : itemImagesQuery.isLoading

  const variantData = variantImagesQuery.data?.data
  const images: ItemImage[] = variantId
    ? (variantData?.images ?? [])
    : (itemImagesQuery.data?.data ?? [])
  const inheritedFromParent = variantId && variantData?.source === 'item'

  const activeQueryKey = variantId ? variantImagesKey : itemImagesKey

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const uploadResult = await uploadItemFile(formData)
      if (!uploadResult.success || !uploadResult.data) {
        showToast({ title: 'Upload failed', description: uploadResult.message, status: 'error' })
        return
      }

      const addResult = await addItemImage(itemId, {
        fileId: uploadResult.data.id,
        ...(variantId ? { variantId } : {}),
      })

      if (!addResult.success) {
        showToast({
          title: 'Failed to attach image',
          description: addResult.message,
          status: 'error',
        })
        return
      }

      queryClient.invalidateQueries({ queryKey: activeQueryKey })
      showToast({ title: 'Image added', status: 'success' })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleSetPrimary(imageId: string) {
    setPendingImageId(imageId)
    const result = await updateItemImage(itemId, imageId, { isPrimary: true })
    setPendingImageId(null)
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: activeQueryKey })
    } else {
      showToast({ title: 'Failed to update image', description: result.message, status: 'error' })
    }
  }

  async function handleDelete(imageId: string) {
    setPendingImageId(imageId)
    const result = await removeItemImage(itemId, imageId)
    setPendingImageId(null)
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: activeQueryKey })
      showToast({ title: 'Image removed', status: 'success' })
    } else {
      showToast({ title: 'Failed to remove image', description: result.message, status: 'error' })
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-xl bg-zinc-100" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {inheritedFromParent && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
          <p className="text-xs text-blue-700">
            Showing {images.length} inherited image{images.length !== 1 ? 's' : ''} from the parent
            item. Upload below to add variant-specific images.
          </p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {images.map((img) => (
          <Thumbnail
            key={img.id}
            image={img}
            onSetPrimary={() => handleSetPrimary(img.id)}
            onDelete={() => handleDelete(img.id)}
            isPending={pendingImageId === img.id}
          />
        ))}

        {/* Upload cell */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 transition-colors hover:border-prominent-purple-400 hover:bg-prominent-purple-50 hover:text-prominent-purple-600 disabled:opacity-50"
        >
          {uploading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-prominent-purple-600" />
          ) : (
            <>
              <Upload className="h-5 w-5" />
              <span className="text-[10px] font-medium">Add Image</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2 } from 'lucide-react'
import {
  ConsignToBranchFormSchema,
  type ConsignToBranchFormValues,
} from '@/src/schema/inventory/serial-numbers'
import type { ApiResponse } from '@/src/libs/api/client'
import SearchableSelect from '@/src/components/ui/SearchableSelect'

type BranchOption = { id: string; name: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ConsignToBranchFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  selectedCount: number
  branches: BranchOption[]
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

export default function ConsignToBranchModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  selectedCount,
  branches,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ConsignToBranchFormValues>({
    resolver: zodResolver(ConsignToBranchFormSchema),
    defaultValues: {
      destinationKind: 'branch',
      hostBranchId: '',
      venue: '',
      eventName: '',
      eventStartDate: '',
      eventEndDate: '',
    },
  })

  const destinationKind = useWatch({ control, name: 'destinationKind' })
  const isVenue = destinationKind === 'venue'

  useEffect(() => {
    if (!isOpen) {
      reset({
        destinationKind: 'branch',
        hostBranchId: '',
        venue: '',
        eventName: '',
        eventStartDate: '',
        eventEndDate: '',
      })
    }
  }, [isOpen, reset])

  if (!isOpen) return null

  async function handleFormSubmit(data: ConsignToBranchFormValues) {
    const result = await onSubmit(data)
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Consign for a Caravan</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {selectedCount} serial{selectedCount !== 1 ? 's' : ''} —{' '}
              {isVenue
                ? 'physically goes out to the venue; it stays on your books and you keep selling it.'
                : 'physically moves to the host branch for a caravan event; ownership stays here.'}
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
            {/* Two genuinely different things, not two spellings of one:
                a host branch takes the stock over and sells it, while a
                venue is only a place the stock sits — which is why the
                helper copy and the ownership story change with it. */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Going to</label>
              <Controller
                name="destinationKind"
                control={control}
                render={({ field }) => (
                  <div className="mt-1 flex gap-2">
                    {(
                      [
                        { value: 'branch', label: 'One of our branches' },
                        { value: 'venue', label: 'Somewhere else' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                          field.value === opt.value
                            ? 'border-prominent-purple-500 bg-prominent-purple-50 text-prominent-purple-800'
                            : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            {isVenue ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Venue <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="venue"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      type="text"
                      placeholder="e.g. Lemery Town Fair"
                      className={fieldClass}
                    />
                  )}
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Any place with no branch of ours — a fair, a dealer&apos;s floor, a town. These
                  units stay on your books and stay sellable here while they&apos;re out.
                </p>
                {errors.venue && (
                  <p className="mt-1 text-xs text-red-600">{errors.venue.message}</p>
                )}
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Host Branch <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="hostBranchId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Search host branch…"
                      options={branches.map((b) => ({ value: b.id, label: b.name }))}
                    />
                  )}
                />
                <p className="mt-1 text-xs text-zinc-500">
                  The host sells these units while they&apos;re there; ownership stays with you.
                </p>
                {errors.hostBranchId && (
                  <p className="mt-1 text-xs text-red-600">{errors.hostBranchId.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Event Name <span className="text-zinc-400">(optional)</span>
              </label>
              <Controller
                name="eventName"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. Summer Caravan 2026 — SM Cebu"
                    className={fieldClass}
                  />
                )}
              />
              {errors.eventName && (
                <p className="mt-1 text-xs text-red-600">{errors.eventName.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Event Start <span className="text-zinc-400">(optional)</span>
                </label>
                <Controller
                  name="eventStartDate"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Event End <span className="text-zinc-400">(optional)</span>
                </label>
                <Controller
                  name="eventEndDate"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
                {errors.eventEndDate && (
                  <p className="mt-1 text-xs text-red-600">{errors.eventEndDate.message}</p>
                )}
              </div>
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
              {isSubmitting
                ? 'Consigning…'
                : `Consign ${selectedCount} Serial${selectedCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

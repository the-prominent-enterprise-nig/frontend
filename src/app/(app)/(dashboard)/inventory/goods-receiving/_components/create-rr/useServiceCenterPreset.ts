import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UseFormSetValue } from 'react-hook-form'
import type { ReceiveStockFormValues } from '@/src/schema/inventory/goods-receiving'
import type { ServiceCenterUnit } from '@/src/schema/inventory/goods-receiving/service-center-units'
import { getServiceCenterUnits } from '../../_actions/service-center-units'

/** A receipt opened for one repair ticket's units coming back (the UDS list's
 * "Receive Back"): the service center and the units to tick. */
export type ServiceCenterPreset = { serviceCenterId: string; serialNumberIds: string[] }

type Args = {
  isOpen: boolean
  preset: ServiceCenterPreset | null | undefined
  fromServiceCenter: boolean
  serviceCenterId: string | undefined
  setValue: UseFormSetValue<ReceiveStockFormValues>
  onUnits: (units: ServiceCenterUnit[]) => void
}

/**
 * Fills Repair/Return → From Service Center → the center → its units, one
 * step per render. Switching Origin clears the service center and switching
 * the center clears the ticked units (the modal's own effects), so each step
 * waits for the previous one to settle. Must be called after those effects so
 * it runs after them in the same commit.
 */
export function useServiceCenterPreset(args: Args): void {
  const { isOpen, preset, fromServiceCenter, serviceCenterId, setValue, onUnits } = args
  const done = useRef(false)
  const centerReady = !!preset && fromServiceCenter && serviceCenterId === preset.serviceCenterId
  const units = useQuery({
    queryKey: ['service-center-units', preset?.serviceCenterId ?? ''],
    queryFn: () => getServiceCenterUnits(preset?.serviceCenterId ?? ''),
    enabled: isOpen && centerReady,
  })

  useEffect(() => {
    if (!isOpen) done.current = false
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !preset || done.current) return
    const opts = { shouldValidate: false }
    if (!fromServiceCenter) {
      setValue('reason', 'repair_return', opts)
      setValue('origin', 'service_center', opts)
      return
    }
    if (!centerReady) {
      setValue('serviceCenterId', preset.serviceCenterId, opts)
      return
    }
    const listed = units.data?.data
    if (!listed) return
    done.current = true
    onUnits(listed.filter((u) => preset.serialNumberIds.includes(u.serialNumberId)))
  })
}

'use client'

import { useEffect, useState } from 'react'
import { fetchBarangays, fetchCities, fetchProvinces } from '@/src/libs/data/ph-address'

/**
 * Renders a stored address.
 *
 * `PhilippineAddressPicker` composes the WHOLE address into the `address`
 * column — street, barangay, city, province, region, country — so in almost
 * every case there is nothing to resolve and this just prints it. An earlier
 * version assumed `address` held only the street line and appended the
 * barangay, city and province resolved from `barangayCode`, which printed
 * each of them twice ("…Atabay, Alimodian, Iloilo, Region VI…, Atabay,
 * Alimodian, Iloilo").
 *
 * The PSGC lookup is kept for the one case it is needed: a record that has a
 * barangay code but no address line, which is possible for rows written by
 * other paths. Nothing is fetched otherwise, so the usual detail view costs
 * no dataset downloads at all.
 */
export function PhAddressText({
  address,
  barangayCode,
  className = '',
  emptyText = '—',
}: {
  address?: string | null
  barangayCode?: string | null
  className?: string
  emptyText?: string
}) {
  const needsLookup = !address && !!barangayCode
  const [resolved, setResolved] = useState<string | null>(null)

  useEffect(() => {
    if (!needsLookup || !barangayCode) return
    let cancelled = false
    Promise.all([fetchBarangays(), fetchCities(), fetchProvinces()])
      .then(([barangays, cities, provinces]) => {
        if (cancelled) return
        const barangay = barangays.find((b) => b.brgy_code === barangayCode)
        const city = barangay ? cities.find((c) => c.city_code === barangay.city_code) : undefined
        const province = city
          ? provinces.find((p) => p.province_code === city.province_code)
          : undefined
        setResolved(
          [barangay?.brgy_name, city?.city_name, province?.province_name]
            .filter(Boolean)
            .join(', ') || null
        )
      })
      .catch(() => {
        if (!cancelled) setResolved(null)
      })
    return () => {
      cancelled = true
    }
  }, [needsLookup, barangayCode])

  const text = address || resolved
  return <span className={className}>{text || emptyText}</span>
}

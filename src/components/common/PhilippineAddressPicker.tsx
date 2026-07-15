'use client'

import { useEffect, useState } from 'react'
import {
  regions,
  provinces,
  cities,
  barangays,
  type PhRegion,
  type PhProvince,
  type PhCity,
  type PhBarangay,
} from 'select-philippines-address'
import SearchableSelect from '@/src/components/ui/SearchableSelect'

/** Cash-register-style Philippine address picker — Region → Province →
 * City/Municipality → Barangay, each a searchable (type-to-filter) select
 * like Shopee/Lazada's address forms, plus a street/building line, composed
 * into one formatted string (the shape Customer.shippingAddress expects —
 * a single free-text field, not structured columns). */
export default function PhilippineAddressPicker({
  onChange,
}: {
  onChange: (formattedAddress: string) => void
}) {
  const [regionList, setRegionList] = useState<PhRegion[]>([])
  const [provinceList, setProvinceList] = useState<PhProvince[]>([])
  const [cityList, setCityList] = useState<PhCity[]>([])
  const [barangayList, setBarangayList] = useState<PhBarangay[]>([])

  const [regionCode, setRegionCode] = useState('')
  const [provinceCode, setProvinceCode] = useState('')
  const [cityCode, setCityCode] = useState('')
  const [barangayName, setBarangayName] = useState('')
  const [street, setStreet] = useState('')

  const [loadingRegions, setLoadingRegions] = useState(true)
  const [loadingProvinces, setLoadingProvinces] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)
  const [loadingBarangays, setLoadingBarangays] = useState(false)

  useEffect(() => {
    regions()
      .then((r) => setRegionList(Array.isArray(r) ? r : []))
      .finally(() => setLoadingRegions(false))
  }, [])

  useEffect(() => {
    setProvinceList([])
    setProvinceCode('')
    setCityList([])
    setCityCode('')
    setBarangayList([])
    setBarangayName('')
    if (!regionCode) return
    setLoadingProvinces(true)
    provinces(regionCode)
      .then((p) => setProvinceList(Array.isArray(p) ? p : []))
      .finally(() => setLoadingProvinces(false))
  }, [regionCode])

  useEffect(() => {
    setCityList([])
    setCityCode('')
    setBarangayList([])
    setBarangayName('')
    if (!provinceCode) return
    setLoadingCities(true)
    cities(provinceCode)
      .then((c) => setCityList(Array.isArray(c) ? c : []))
      .finally(() => setLoadingCities(false))
  }, [provinceCode])

  useEffect(() => {
    setBarangayList([])
    setBarangayName('')
    if (!cityCode) return
    setLoadingBarangays(true)
    barangays(cityCode)
      .then((b) => setBarangayList(Array.isArray(b) ? b : []))
      .finally(() => setLoadingBarangays(false))
  }, [cityCode])

  // Compose and bubble up the formatted address whenever any part changes.
  // Fires with '' (not a bare "Philippines") until the user has actually
  // entered something — callers editing an existing address can ignore
  // empty callbacks to avoid clobbering a pre-filled value before the user
  // has touched this picker.
  useEffect(() => {
    const region = regionList.find((r) => r.region_code === regionCode)?.region_name
    const province = provinceList.find((p) => p.province_code === provinceCode)?.province_name
    const city = cityList.find((c) => c.city_code === cityCode)?.city_name
    const realParts = [street, barangayName, city, province, region].filter(Boolean)
    onChange(realParts.length === 0 ? '' : [...realParts, 'Philippines'].join(', '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [street, regionCode, provinceCode, cityCode, barangayName])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[13px] font-medium text-gray-700">Region</label>
          <SearchableSelect
            className="mt-1"
            value={regionCode}
            onChange={setRegionCode}
            loading={loadingRegions}
            loadingLabel="Loading regions…"
            placeholder="Type to search region"
            options={regionList.map((r) => ({ value: r.region_code, label: r.region_name }))}
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-gray-700">Province</label>
          <SearchableSelect
            className="mt-1"
            value={provinceCode}
            onChange={setProvinceCode}
            disabled={!regionCode}
            loading={loadingProvinces}
            loadingLabel="Loading provinces…"
            placeholder="Type to search province"
            options={provinceList.map((p) => ({
              value: p.province_code,
              label: p.province_name,
            }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[13px] font-medium text-gray-700">City / Municipality</label>
          <SearchableSelect
            className="mt-1"
            value={cityCode}
            onChange={setCityCode}
            disabled={!provinceCode}
            loading={loadingCities}
            loadingLabel="Loading cities…"
            placeholder="Type to search city"
            options={cityList.map((c) => ({ value: c.city_code, label: c.city_name }))}
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-gray-700">Barangay</label>
          <SearchableSelect
            className="mt-1"
            value={barangayName}
            onChange={setBarangayName}
            disabled={!cityCode}
            loading={loadingBarangays}
            loadingLabel="Loading barangays…"
            placeholder="Type to search barangay"
            options={barangayList.map((b) => ({ value: b.brgy_name, label: b.brgy_name }))}
          />
        </div>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-gray-700">
          House / Unit / Street / Building
        </label>
        <input
          value={street}
          maxLength={200}
          onChange={(e) => setStreet(e.target.value)}
          placeholder="e.g. Blk 3 Lot 12, Mabuhay St."
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none"
        />
      </div>
    </div>
  )
}

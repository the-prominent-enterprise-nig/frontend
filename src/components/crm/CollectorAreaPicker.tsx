'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import {
  fetchRegions,
  fetchProvinces,
  fetchCities,
  fetchBarangays,
  type PhRegion,
  type PhProvince,
  type PhCity,
  type PhBarangay,
} from '@/src/libs/data/ph-address'

/**
 * Multi-select coverage picker for a Collector's assigned barangays
 * (Scenario 24 Part 3) — same cascading Region/Province/City/Barangay
 * dataset as PhilippineAddressPicker, but accumulates a *list* of
 * barangays (a collector's coverage can span multiple cities) instead of
 * composing one formatted address. Picking a barangay adds it and resets
 * only the barangay field, so several barangays from the same city can be
 * added in a row without re-picking Region/Province/City each time.
 */
export default function CollectorAreaPicker({
  value,
  onChange,
}: {
  /** barangayCode[] — the full current coverage set */
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [regionList, setRegionList] = useState<PhRegion[]>([])
  const [provinceList, setProvinceList] = useState<PhProvince[]>([])
  const [cityList, setCityList] = useState<PhCity[]>([])
  const [barangayList, setBarangayList] = useState<PhBarangay[]>([])
  // Unfiltered lookups — resolve display labels for already-picked codes
  // that may belong to a city other than whatever's selected in the
  // cascade above right now.
  const [allCities, setAllCities] = useState<PhCity[]>([])
  const [allBarangays, setAllBarangays] = useState<PhBarangay[]>([])

  const [regionCode, setRegionCode] = useState('')
  const [provinceCode, setProvinceCode] = useState('')
  const [cityCode, setCityCode] = useState('')
  const [barangayCode, setBarangayCode] = useState('')

  const [loadingRegions, setLoadingRegions] = useState(true)
  const [loadingProvinces, setLoadingProvinces] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)
  const [loadingBarangays, setLoadingBarangays] = useState(false)

  useEffect(() => {
    fetchRegions()
      .then((r) => setRegionList(Array.isArray(r) ? r : []))
      .finally(() => setLoadingRegions(false))
    fetchCities().then((c) => setAllCities(Array.isArray(c) ? c : []))
    fetchBarangays().then((b) => setAllBarangays(Array.isArray(b) ? b : []))
  }, [])

  useEffect(() => {
    setProvinceList([])
    setProvinceCode('')
    setCityList([])
    setCityCode('')
    setBarangayList([])
    setBarangayCode('')
    if (!regionCode) return
    setLoadingProvinces(true)
    fetchProvinces()
      .then((all) => setProvinceList(all.filter((p) => p.region_code === regionCode)))
      .finally(() => setLoadingProvinces(false))
  }, [regionCode])

  useEffect(() => {
    setCityList([])
    setCityCode('')
    setBarangayList([])
    setBarangayCode('')
    if (!provinceCode) return
    setLoadingCities(true)
    fetchCities()
      .then((all) => setCityList(all.filter((c) => c.province_code === provinceCode)))
      .finally(() => setLoadingCities(false))
  }, [provinceCode])

  useEffect(() => {
    setBarangayList([])
    setBarangayCode('')
    if (!cityCode) return
    setLoadingBarangays(true)
    fetchBarangays()
      .then((all) => setBarangayList(all.filter((b) => b.city_code === cityCode)))
      .finally(() => setLoadingBarangays(false))
  }, [cityCode])

  function addBarangay() {
    if (!barangayCode || value.includes(barangayCode)) return
    onChange([...value, barangayCode])
    setBarangayCode('')
  }

  function removeBarangay(code: string) {
    onChange(value.filter((c) => c !== code))
  }

  const entries = useMemo(
    () =>
      value.map((code) => {
        const b = allBarangays.find((x) => x.brgy_code === code)
        const city = b ? allCities.find((c) => c.city_code === b.city_code) : undefined
        return {
          code,
          label: b ? `${b.brgy_name}${city ? `, ${city.city_name}` : ''}` : code,
        }
      }),
    [value, allBarangays, allCities]
  )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="block text-[13px] font-medium text-gray-700">Region</label>
          <SearchableSelect
            className="mt-1"
            value={regionCode}
            onChange={setRegionCode}
            loading={loadingRegions}
            loadingLabel="Loading regions…"
            placeholder="Region"
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
            loadingLabel="Loading…"
            placeholder="Province"
            options={provinceList.map((p) => ({
              value: p.province_code,
              label: p.province_name,
            }))}
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-gray-700">City / Municipality</label>
          <SearchableSelect
            className="mt-1"
            value={cityCode}
            onChange={setCityCode}
            disabled={!provinceCode}
            loading={loadingCities}
            loadingLabel="Loading…"
            placeholder="City"
            options={cityList.map((c) => ({ value: c.city_code, label: c.city_name }))}
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-gray-700">Barangay</label>
          <div className="mt-1 flex gap-1.5">
            <SearchableSelect
              className="flex-1"
              value={barangayCode}
              onChange={setBarangayCode}
              disabled={!cityCode}
              loading={loadingBarangays}
              loadingLabel="Loading…"
              placeholder="Barangay"
              options={barangayList.map((b) => ({ value: b.brgy_code, label: b.brgy_name }))}
            />
            <button
              type="button"
              onClick={addBarangay}
              disabled={!barangayCode}
              className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-gray-700">
          Areas covered ({entries.length})
        </label>
        {entries.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-gray-400">No areas assigned yet.</p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {entries.map((e) => (
              <li
                key={e.code}
                className="inline-flex items-center gap-1 rounded-full bg-prominent-purple-50 py-1 pl-3 pr-1.5 text-[12px] font-medium text-prominent-purple-700 ring-1 ring-inset ring-prominent-purple-200"
              >
                {e.label}
                <button
                  type="button"
                  onClick={() => removeBarangay(e.code)}
                  aria-label={`Remove ${e.label}`}
                  className="rounded-full p-0.5 text-prominent-purple-500 hover:bg-prominent-purple-100 hover:text-prominent-purple-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

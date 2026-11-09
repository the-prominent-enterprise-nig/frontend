'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import {
  fetchRegions,
  fetchProvinces,
  fetchCities,
  PH_DEFAULT_REGION_CODE,
  type PhRegion,
  type PhProvince,
  type PhCity,
} from '@/src/libs/data/ph-address'

export interface CollectorTown {
  cityCode: string
  cityName: string
}

/**
 * Multi-select coverage picker for the towns/cities a Collector covers
 * (Ticket #31) — the client's collector list is town-based, and a new
 * installment account is matched to its collector on the customer's town when
 * no collector covers their barangay. Same cascading Region/Province/City
 * dataset as CollectorAreaPicker, one level coarser: picking a city adds it and
 * resets only the city field, so several towns of one province can be added in a
 * row. Region VI is pre-selected, as on the other address forms.
 */
export default function CollectorTownPicker({
  value,
  onChange,
}: {
  value: CollectorTown[]
  onChange: (next: CollectorTown[]) => void
}) {
  const [regionList, setRegionList] = useState<PhRegion[]>([])
  const [allProvinces, setAllProvinces] = useState<PhProvince[]>([])
  const [allCities, setAllCities] = useState<PhCity[]>([])
  const [loading, setLoading] = useState(true)

  const [regionCode, setRegionCode] = useState(PH_DEFAULT_REGION_CODE)
  const [provinceCode, setProvinceCode] = useState('')
  const [cityCode, setCityCode] = useState('')

  useEffect(() => {
    Promise.all([fetchRegions(), fetchProvinces(), fetchCities()])
      .then(([r, p, c]) => {
        setRegionList(Array.isArray(r) ? r : [])
        setAllProvinces(Array.isArray(p) ? p : [])
        setAllCities(Array.isArray(c) ? c : [])
      })
      .finally(() => setLoading(false))
  }, [])

  // The lists narrow from what the levels above picked; changing a level clears
  // the ones below it in the handlers (not an effect), so nothing stale lingers.
  const provinceList = useMemo(
    () => allProvinces.filter((p) => p.region_code === regionCode),
    [allProvinces, regionCode]
  )
  const cityList = useMemo(
    () => allCities.filter((c) => c.province_code === provinceCode),
    [allCities, provinceCode]
  )

  function pickRegion(code: string) {
    setRegionCode(code)
    setProvinceCode('')
    setCityCode('')
  }

  function pickProvince(code: string) {
    setProvinceCode(code)
    setCityCode('')
  }

  function addTown() {
    const city = cityList.find((c) => c.city_code === cityCode)
    if (!city || value.some((t) => t.cityCode === city.city_code)) return
    onChange([...value, { cityCode: city.city_code, cityName: city.city_name }])
    setCityCode('')
  }

  function removeTown(code: string) {
    onChange(value.filter((t) => t.cityCode !== code))
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[13px] font-medium text-gray-700">Region</label>
          <SearchableSelect
            className="mt-1"
            value={regionCode}
            onChange={pickRegion}
            loading={loading}
            loadingLabel="Loading regions…"
            placeholder="Select region"
            options={regionList.map((r) => ({ value: r.region_code, label: r.region_name }))}
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-gray-700">Province</label>
          <SearchableSelect
            className="mt-1"
            value={provinceCode}
            onChange={pickProvince}
            disabled={!regionCode}
            loading={loading}
            loadingLabel="Loading…"
            placeholder="Select province"
            options={provinceList.map((p) => ({
              value: p.province_code,
              label: p.province_name,
            }))}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[13px] font-medium text-gray-700">City / Municipality</label>
          <div className="mt-1 flex gap-1.5">
            <SearchableSelect
              className="flex-1"
              value={cityCode}
              onChange={setCityCode}
              disabled={!provinceCode}
              loading={loading}
              loadingLabel="Loading…"
              placeholder="Select city / municipality"
              options={cityList.map((c) => ({ value: c.city_code, label: c.city_name }))}
            />
            <button
              type="button"
              onClick={addTown}
              disabled={!cityCode}
              className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add town
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-gray-700">
          Towns covered ({value.length})
        </label>
        {value.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-gray-400">No towns assigned yet.</p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {value.map((t) => (
              <li
                key={t.cityCode}
                className="inline-flex items-center gap-1 rounded-full bg-prominent-purple-50 py-1 pl-3 pr-1.5 text-[12px] font-medium text-prominent-purple-700 ring-1 ring-inset ring-prominent-purple-200"
              >
                {t.cityName}
                <button
                  type="button"
                  onClick={() => removeTown(t.cityCode)}
                  aria-label={`Remove ${t.cityName}`}
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

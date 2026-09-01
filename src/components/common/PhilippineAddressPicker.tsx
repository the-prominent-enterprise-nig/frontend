'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, AlertTriangle } from 'lucide-react'
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

/** Cash-register-style Philippine address picker — Region → Province →
 * City/Municipality → Barangay, each a searchable (type-to-filter) select
 * like Shopee/Lazada's address forms, plus a street/building line, composed
 * into one formatted string (the shape Customer.address expects — a single
 * free-text field, not structured columns) AND the selected barangay's own
 * brgy_code (Scenario 24 Part 2 — barangay names repeat across different
 * cities/provinces nationwide, e.g. multiple "San Isidro"s, so a name alone
 * can't be used as a reliable area key downstream; the code can). */
export default function PhilippineAddressPicker({
  onChange,
  initialBarangayCode,
  initialAddress,
}: {
  onChange: (value: { address: string; barangayCode: string }) => void
  /** Edit-only: the customer's already-saved barangay code. Resolved once
   * (client-side, from the same cached datasets used for normal picking)
   * up through city/province/region so an editor sees where the customer
   * is actually located instead of four blank dropdowns. */
  initialBarangayCode?: string
  /** The already-saved free-text address, used only to best-effort recover
   * the street/building line — everything else in it is redundant with the
   * resolved region/province/city/barangay names and gets stripped off the
   * end. Best-effort because the address is just a flat string, not
   * structured columns; if it doesn't end with the resolved chain (e.g. it
   * predates barangayCode, or was hand-edited), whatever's left over is
   * used as-is rather than guessed at further. */
  initialAddress?: string
}) {
  const [regionList, setRegionList] = useState<PhRegion[]>([])
  const [provinceList, setProvinceList] = useState<PhProvince[]>([])
  const [cityList, setCityList] = useState<PhCity[]>([])
  const [barangayList, setBarangayList] = useState<PhBarangay[]>([])

  const [regionCode, setRegionCode] = useState('')
  const [provinceCode, setProvinceCode] = useState('')
  const [cityCode, setCityCode] = useState('')
  // Tracks the barangay's brgy_code, not its name — within one already
  // city-filtered barangayList this is unambiguous, and it's what actually
  // gets emitted upstream (see the composing effect below).
  const [barangayCode, setBarangayCode] = useState('')
  const [street, setStreet] = useState('')

  const [loadingRegions, setLoadingRegions] = useState(true)
  const [loadingProvinces, setLoadingProvinces] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)
  const [loadingBarangays, setLoadingBarangays] = useState(false)

  // Resolved once from initialBarangayCode, then consumed level by level by
  // the three cascading effects below (each auto-selects the matching code
  // once it appears in that level's freshly-loaded list) — applying it this
  // way, rather than setting all four codes directly, means it can't race
  // ahead of (and get reset by) the very effects that load each level's
  // options. Left in place after use: harmless, since a later normal
  // cascading reset only ever short-circuits into it when the new list
  // still happens to contain the matching code anyway.
  const [target, setTarget] = useState<{
    regionCode: string
    provinceCode: string
    cityCode: string
    barangayCode: string
  } | null>(null)
  const hydratingFor = useRef<string | null>(null)

  useEffect(() => {
    fetchRegions()
      .then((r) => setRegionList(Array.isArray(r) ? r : []))
      .finally(() => setLoadingRegions(false))
  }, [])

  useEffect(() => {
    if (!initialBarangayCode || hydratingFor.current === initialBarangayCode) return
    hydratingFor.current = initialBarangayCode
    Promise.all([fetchRegions(), fetchProvinces(), fetchCities(), fetchBarangays()]).then(
      ([regions, provinces, cities, barangays]) => {
        const brgy = barangays.find((b) => b.brgy_code === initialBarangayCode)
        const city = brgy && cities.find((c) => c.city_code === brgy.city_code)
        const province = city && provinces.find((p) => p.province_code === city.province_code)
        const region = province && regions.find((r) => r.region_code === province.region_code)
        if (!brgy || !city || !province || !region) return

        setTarget({
          regionCode: region.region_code,
          provinceCode: province.province_code,
          cityCode: city.city_code,
          barangayCode: brgy.brgy_code,
        })
        setRegionCode(region.region_code)

        if (initialAddress) {
          // The composed string is `[street, brgy, city, province, region,
          // "Philippines"].join(', ')` — strip that known tail off the end
          // (in order) to recover whatever street portion was typed.
          let remainder = initialAddress
          for (const part of [
            'Philippines',
            region.region_name,
            province.province_name,
            city.city_name,
            brgy.brgy_name,
          ]) {
            const suffix = `, ${part}`
            if (!remainder.endsWith(suffix)) break
            remainder = remainder.slice(0, -suffix.length)
          }
          setStreet(remainder)
        }
      }
    )
  }, [initialBarangayCode, initialAddress])

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
      .then((all) => {
        const filtered = all.filter((p) => p.region_code === regionCode)
        setProvinceList(filtered)
        if (target && filtered.some((p) => p.province_code === target.provinceCode)) {
          setProvinceCode(target.provinceCode)
        }
      })
      .finally(() => setLoadingProvinces(false))
  }, [regionCode, target])

  useEffect(() => {
    setCityList([])
    setCityCode('')
    setBarangayList([])
    setBarangayCode('')
    if (!provinceCode) return
    setLoadingCities(true)
    fetchCities()
      .then((all) => {
        const filtered = all.filter((c) => c.province_code === provinceCode)
        setCityList(filtered)
        if (target && filtered.some((c) => c.city_code === target.cityCode)) {
          setCityCode(target.cityCode)
        }
      })
      .finally(() => setLoadingCities(false))
  }, [provinceCode, target])

  useEffect(() => {
    setBarangayList([])
    setBarangayCode('')
    if (!cityCode) return
    setLoadingBarangays(true)
    fetchBarangays()
      .then((all) => {
        const filtered = all.filter((b) => b.city_code === cityCode)
        setBarangayList(filtered)
        if (target && filtered.some((b) => b.brgy_code === target.barangayCode)) {
          setBarangayCode(target.barangayCode)
        }
      })
      .finally(() => setLoadingBarangays(false))
  }, [cityCode, target])

  // Compose and bubble up the formatted address (plus the raw barangayCode,
  // for area-based collector assignment) whenever any part changes. Fires
  // with '' (not a bare "Philippines") until the user has actually entered
  // something — callers editing an existing address can ignore empty
  // callbacks to avoid clobbering a pre-filled value before the user has
  // touched this picker.
  useEffect(() => {
    const region = regionList.find((r) => r.region_code === regionCode)?.region_name
    const province = provinceList.find((p) => p.province_code === provinceCode)?.province_name
    const city = cityList.find((c) => c.city_code === cityCode)?.city_name
    const barangayName = barangayList.find((b) => b.brgy_code === barangayCode)?.brgy_name
    const realParts = [street, barangayName, city, province, region].filter(Boolean)
    onChange({
      address: realParts.length === 0 ? '' : [...realParts, 'Philippines'].join(', '),
      barangayCode,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [street, regionCode, provinceCode, cityCode, barangayCode])

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
            value={barangayCode}
            onChange={setBarangayCode}
            disabled={!cityCode}
            loading={loadingBarangays}
            loadingLabel="Loading barangays…"
            placeholder="Type to search barangay"
            options={barangayList.map((b) => ({ value: b.brgy_code, label: b.brgy_name }))}
          />
        </div>
      </div>

      {/* A typed street value and an actually-picked barangay can render
       * identically once composed into the flat address string below (e.g.
       * a real barangay literally named "PHHC Block 17" reads exactly like
       * someone typing a street name) — found live, twice, as customers
       * silently ending up with no barangayCode despite a complete-looking
       * address. This makes which one actually happened unambiguous. */}
      {cityCode && (
        <p
          className={`flex items-center gap-1.5 text-[12px] ${
            barangayCode ? 'text-emerald-600' : 'text-amber-600'
          }`}
        >
          {barangayCode ? (
            <>
              <Check className="h-3.5 w-3.5 shrink-0" />
              Barangay selected: {barangayList.find((b) => b.brgy_code === barangayCode)?.brgy_name}
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              No barangay picked yet — select one above; typing it into the street line below
              won&apos;t match it to a collector area.
            </>
          )}
        </p>
      )}

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

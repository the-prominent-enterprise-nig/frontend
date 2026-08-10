export interface PhRegion {
  region_code: string
  region_name: string
}
export interface PhProvince {
  province_code: string
  province_name: string
  region_code: string
}
export interface PhCity {
  city_code: string
  city_name: string
  province_code: string
}
export interface PhBarangay {
  brgy_code: string
  brgy_name: string
  city_code: string
}

// Self-hosted under public/data/ph-address (see that folder) instead of the
// select-philippines-address package, which hit a third-party GitHub Pages
// host with no caching — 8-10s per level, even for the 2KB region file.
// Each dataset is fetched once per page session (module-level cache, shared
// across every consumer, not per-component-instance) and filtered
// client-side for every subsequent selection. Shared here (rather than
// living inside PhilippineAddressPicker) since Scenario 24 Part 3's
// collector coverage picker needs the exact same cascading data.
let regionsCache: Promise<PhRegion[]> | null = null
let provincesCache: Promise<PhProvince[]> | null = null
let citiesCache: Promise<PhCity[]> | null = null
let barangaysCache: Promise<PhBarangay[]> | null = null

export function fetchRegions(): Promise<PhRegion[]> {
  regionsCache ??= fetch('/data/ph-address/region.json').then((r) => r.json())
  return regionsCache
}
export function fetchProvinces(): Promise<PhProvince[]> {
  provincesCache ??= fetch('/data/ph-address/province.json').then((r) => r.json())
  return provincesCache
}
export function fetchCities(): Promise<PhCity[]> {
  citiesCache ??= fetch('/data/ph-address/city.json').then((r) => r.json())
  return citiesCache
}
export function fetchBarangays(): Promise<PhBarangay[]> {
  barangaysCache ??= fetch('/data/ph-address/barangay.json').then((r) => r.json())
  return barangaysCache
}

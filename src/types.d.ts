declare module '*.css' {
  const content: Record<string, string>
  export default content
}

declare module 'select-philippines-address' {
  export interface PhRegion {
    id: number
    psgc_code: string
    region_name: string
    region_code: string
  }
  export interface PhProvince {
    psgc_code: string
    province_name: string
    province_code: string
    region_code: string
  }
  export interface PhCity {
    city_name: string
    city_code: string
    province_code: string
    region_desc: string
  }
  export interface PhBarangay {
    brgy_name: string
    brgy_code: string
    province_code: string
    region_code: string
  }
  export function regions(): Promise<PhRegion[]>
  export function provinces(regionCode: string): Promise<PhProvince[]>
  export function cities(provinceCode: string): Promise<PhCity[]>
  export function barangays(cityCode: string): Promise<PhBarangay[]>
}

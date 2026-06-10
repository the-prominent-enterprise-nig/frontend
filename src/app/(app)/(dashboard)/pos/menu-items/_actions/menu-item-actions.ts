'use server'

import { api } from '@/src/libs/api/client'

export interface MenuItem {
  id: string
  name: string
  sku: string | null
  sellingPrice: number | null
  lifecycle: string
  baseUnitId: string | null
  source: 'pos' | 'inventory' // 'pos' = new pos_menu_items table, 'inventory' = legacy bundle
  ingredients?: MenuItemIngredient[]
}

export interface MenuItemIngredient {
  id: string
  menuItemId: string
  inventoryItemId: string
  quantity: number
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getMenuItems(): Promise<MenuItem[]> {
  const [posRes, invRes] = await Promise.all([
    api.get<MenuItem[]>('/pos/menu-items'),
    api.get<{ data: Record<string, unknown>[] } | Record<string, unknown>[]>('/inventory/items', {
      isBundle: true,
      limit: 200,
      lifecycle: 'active',
    }),
  ])

  const posItems: MenuItem[] =
    posRes.success && posRes.data
      ? (Array.isArray(posRes.data) ? posRes.data : []).map((i) => ({
          ...i,
          source: 'pos' as const,
        }))
      : []

  const raw =
    invRes.success && invRes.data
      ? Array.isArray(invRes.data)
        ? invRes.data
        : ((invRes.data as { data?: Record<string, unknown>[] }).data ?? [])
      : []

  const invItems: MenuItem[] = (raw as Record<string, unknown>[])
    .filter((i) => (i.primaryCategory as { name?: string } | null)?.name === 'POS Menu Items')
    .map((i) => ({
      id: i.id as string,
      name: i.name as string,
      sku: (i.sku as string | null) ?? null,
      sellingPrice: i.sellingPrice != null ? Number(i.sellingPrice) : null,
      lifecycle: (i.lifecycle as string) ?? 'active',
      baseUnitId: (i.baseUnit as { id?: string } | null)?.id ?? null,
      source: 'inventory' as const,
    }))

  return [...posItems, ...invItems]
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createMenuItem(data: {
  name: string
  sku?: string
  sellingPrice?: number
  baseUnitId?: string
}): Promise<{ success: boolean; data?: MenuItem; error?: string }> {
  const res = await api.post<MenuItem>('/pos/menu-items', {
    name: data.name,
    ...(data.sku ? { sku: data.sku } : {}),
    ...(data.sellingPrice != null ? { sellingPrice: data.sellingPrice } : {}),
    ...(data.baseUnitId ? { baseUnitId: data.baseUnitId } : {}),
  })
  if (!res.success) return { success: false, error: res.message ?? res.error }
  return { success: true, data: res.data ? { ...res.data, source: 'pos' } : undefined }
}

// ─── Update price ─────────────────────────────────────────────────────────────

export async function updateMenuItemPrice(
  id: string,
  sellingPrice: number,
  source: 'pos' | 'inventory' = 'pos'
): Promise<{ success: boolean; error?: string }> {
  const endpoint = source === 'inventory' ? `/inventory/items/${id}` : `/pos/menu-items/${id}`
  const res = await api.patch(endpoint, { sellingPrice })
  if (!res.success) return { success: false, error: res.message ?? res.error }
  return { success: true }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteMenuItem(
  id: string,
  source: 'pos' | 'inventory' = 'pos'
): Promise<{ success: boolean; error?: string }> {
  const endpoint = source === 'inventory' ? `/inventory/items/${id}` : `/pos/menu-items/${id}`
  const res = await api.delete(endpoint)
  if (!res.success) return { success: false, error: res.message ?? res.error }
  return { success: true }
}

// ─── Ingredients (new pos_menu_items only) ────────────────────────────────────

export async function getIngredients(menuItemId: string): Promise<MenuItemIngredient[]> {
  const res = await api.get<MenuItemIngredient[]>(`/pos/menu-items/${menuItemId}/ingredients`)
  if (!res.success || !res.data) return []
  return Array.isArray(res.data) ? res.data : []
}

export async function addIngredient(
  menuItemId: string,
  inventoryItemId: string,
  quantity: number
): Promise<{ success: boolean; error?: string }> {
  const res = await api.post(`/pos/menu-items/${menuItemId}/ingredients`, {
    inventoryItemId,
    quantity,
  })
  if (!res.success) return { success: false, error: res.message ?? res.error }
  return { success: true }
}

export async function removeIngredient(
  menuItemId: string,
  ingredientId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await api.delete(`/pos/menu-items/${menuItemId}/ingredients/${ingredientId}`)
  if (!res.success) return { success: false, error: res.message ?? res.error }
  return { success: true }
}

// ─── Legacy inventory bundle ingredients ──────────────────────────────────────

export interface BundleComponent {
  id?: string
  componentItemId?: string
  quantityPerBundle: number
  availableStock?: number | null
  componentItem?: { id: string; name: string; sku: string } | null
}

export async function getBundleComponents(itemId: string): Promise<BundleComponent[]> {
  const res = await api.get<{ components: BundleComponent[] }>(
    `/inventory/items/${itemId}/bundle-components`
  )
  if (!res.success || !res.data) return []
  return res.data.components ?? []
}

export async function addBundleComponent(
  itemId: string,
  componentItemId: string,
  quantityPerBundle: number
): Promise<{ success: boolean; error?: string }> {
  const res = await api.post(`/inventory/items/${itemId}/bundle-components`, {
    componentItemId,
    quantityPerBundle,
  })
  if (!res.success) return { success: false, error: res.message ?? res.error }
  return { success: true }
}

export async function removeBundleComponent(
  itemId: string,
  componentId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await api.delete(`/inventory/items/${itemId}/bundle-components/${componentId}`)
  if (!res.success) return { success: false, error: res.message ?? res.error }
  return { success: true }
}

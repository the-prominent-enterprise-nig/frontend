'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  CategoryOption,
  CategoryListResponseSchema,
  UomOption,
  UomListResponseSchema,
  ItemGroupOption,
  ItemSubgroupOption,
  ClassificationOption,
} from '@/src/schema/inventory/items'

export async function getCategories(params?: {
  search?: string
  status?: 'active' | 'inactive'
}): Promise<ApiResponse<{ data: CategoryOption[] }>> {
  try {
    const result = await api.get(
      '/inventory/categories',
      {
        status: params?.status ?? 'active',
        limit: 200,
        ...params,
      },
      {
        tags: ['inventory-categories'],
      }
    )

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch categories',
        message: result.message,
      }
    }

    const validated = CategoryListResponseSchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as { data: CategoryOption[] } }
    }

    return { success: true, data: validated.data as { data: CategoryOption[] } }
  } catch (error) {
    console.error('Error fetching categories:', error)
    return {
      success: false,
      error: 'Failed to fetch categories',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function getUnitsOfMeasure(params?: {
  search?: string
}): Promise<ApiResponse<{ data: UomOption[] }>> {
  try {
    const result = await api.get(
      '/inventory/uom',
      {
        limit: 200,
        ...params,
      },
      {
        tags: ['inventory-uom'],
      }
    )

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch UOM',
        message: result.message,
      }
    }

    const validated = UomListResponseSchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as { data: UomOption[] } }
    }

    return { success: true, data: validated.data as { data: UomOption[] } }
  } catch (error) {
    console.error('Error fetching units of measure:', error)
    return {
      success: false,
      error: 'Failed to fetch units of measure',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function getItemGroups(): Promise<ApiResponse<ItemGroupOption[]>> {
  try {
    const result = await api.get(
      '/inventory/classification/groups',
      {},
      { tags: ['inventory-item-groups'] }
    )
    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch item groups',
        message: result.message,
      }
    }
    return { success: true, data: result.data as ItemGroupOption[] }
  } catch (error) {
    console.error('Error fetching item groups:', error)
    return {
      success: false,
      error: 'Failed to fetch item groups',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function getItemSubgroups(
  groupId?: string
): Promise<ApiResponse<ItemSubgroupOption[]>> {
  try {
    const result = await api.get(
      '/inventory/classification/subgroups',
      groupId ? { groupId } : {},
      { tags: ['inventory-item-subgroups'] }
    )
    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch item subgroups',
        message: result.message,
      }
    }
    return { success: true, data: result.data as ItemSubgroupOption[] }
  } catch (error) {
    console.error('Error fetching item subgroups:', error)
    return {
      success: false,
      error: 'Failed to fetch item subgroups',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function getItemBrands(): Promise<ApiResponse<ClassificationOption[]>> {
  try {
    const result = await api.get(
      '/inventory/classification/brands',
      {},
      { tags: ['inventory-item-brands'] }
    )
    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch item brands',
        message: result.message,
      }
    }
    return { success: true, data: result.data as ClassificationOption[] }
  } catch (error) {
    console.error('Error fetching item brands:', error)
    return {
      success: false,
      error: 'Failed to fetch item brands',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function getItemTypes(): Promise<ApiResponse<ClassificationOption[]>> {
  try {
    const result = await api.get(
      '/inventory/classification/types',
      {},
      { tags: ['inventory-item-types'] }
    )
    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch item types',
        message: result.message,
      }
    }
    return { success: true, data: result.data as ClassificationOption[] }
  } catch (error) {
    console.error('Error fetching item types:', error)
    return {
      success: false,
      error: 'Failed to fetch item types',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

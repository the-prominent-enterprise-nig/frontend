'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getCategoriesFlat } from '../_actions/get-categories-flat'
import { createCategory } from '../_actions/create-category'
import { updateCategory } from '../_actions/update-category'
import { deleteCategory } from '../_actions/delete-category'
import type {
  CategoryNode,
  FlatCategory,
  CreateCategoryFormValues,
  UpdateCategoryFormValues,
} from '@/src/schema/inventory/categories'

function buildTree(flat: FlatCategory[], statusFilter?: 'active' | 'inactive'): CategoryNode[] {
  const filtered = statusFilter ? flat.filter((c) => c.status === statusFilter) : flat
  const map = new Map<string, CategoryNode>()
  const roots: CategoryNode[] = []

  for (const c of filtered) {
    map.set(c.id, { ...c, children: [] })
  }

  for (const node of map.values()) {
    const parentId = node.parentCategoryId
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children!.push(node)
    } else {
      roots.push(node)
    }
  }

  function sort(nodes: CategoryNode[]) {
    nodes.sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name)
    )
    for (const n of nodes) if (n.children?.length) sort(n.children)
  }

  sort(roots)
  return roots
}

export function useCategoryManager() {
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | undefined>(undefined)
  const [editingNode, setEditingNode] = useState<CategoryNode | null>(null)
  const [parentForNew, setParentForNew] = useState<CategoryNode | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null)

  const flatQuery = useQuery({
    queryKey: ['inventory-categories-flat'],
    queryFn: () => getCategoriesFlat({ limit: 500 }),
    staleTime: 60 * 1000,
  })

  const flatCategories = flatQuery.data?.data?.data ?? []

  const tree = useMemo(
    () => buildTree(flatCategories, statusFilter),
    [flatCategories, statusFilter]
  )

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['inventory-categories-flat'] })
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryFormValues) => createCategory(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Category created', description: result.message, status: 'success' })
        invalidate()
        setShowCreateModal(false)
        setParentForNew(null)
      } else {
        showToast({
          title: 'Failed to create category',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryFormValues }) =>
      updateCategory(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Category updated', description: result.message, status: 'success' })
        invalidate()
        setEditingNode(null)
      } else {
        showToast({
          title: 'Failed to update category',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Category deleted', description: result.message, status: 'success' })
        invalidate()
        setDeleteTarget(null)
      } else {
        showToast({
          title: 'Failed to delete category',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  return {
    tree,
    flatCategories,
    isLoading: flatQuery.isLoading,
    isFetching: flatQuery.isFetching,
    error: flatQuery.error,

    statusFilter,
    setStatusFilter: (v: typeof statusFilter) => setStatusFilter(v),

    editingNode,
    setEditingNode,
    parentForNew,
    setParentForNew,
    showCreateModal,
    setShowCreateModal: (v: boolean) => {
      setShowCreateModal(v)
      if (!v) setParentForNew(null)
    },
    openCreateChild: (parent: CategoryNode) => {
      setParentForNew(parent)
      setShowCreateModal(true)
    },

    deleteTarget,
    setDeleteTarget,

    createCategory: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateCategory: (id: string, data: UpdateCategoryFormValues) =>
      updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,

    deleteCategory: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  }
}

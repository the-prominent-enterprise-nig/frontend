import type { FlatCategory } from '@/src/schema/inventory/categories'
import type { CategorySelectOption } from '@/src/components/ui/CategorySelect'

export function flatToCategorySelectOptions(flat: FlatCategory[]): CategorySelectOption[] {
  const map = new Map<string, FlatCategory & { children: FlatCategory[] }>()
  const roots: (FlatCategory & { children: FlatCategory[] })[] = []

  for (const c of flat) map.set(c.id, { ...c, children: [] })

  for (const node of map.values()) {
    const parent = node.parentCategoryId ? map.get(node.parentCategoryId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  function sort(nodes: (FlatCategory & { children: FlatCategory[] })[]) {
    nodes.sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name)
    )
  }

  const result: CategorySelectOption[] = []
  function traverse(nodes: (FlatCategory & { children: FlatCategory[] })[], depth: number) {
    sort(nodes)
    for (const n of nodes) {
      result.push({ id: n.id, name: n.name, depth })
      if (n.children.length)
        traverse(n.children as (FlatCategory & { children: FlatCategory[] })[], depth + 1)
    }
  }
  traverse(roots, 0)
  return result
}

'use client'

import { useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Tag,
  Plus,
  Pencil,
  Trash2,
  Layers,
  PackageSearch,
  ImageOff,
} from 'lucide-react'
import type { CategoryNode } from '@/src/schema/inventory/categories'

type Props = {
  nodes: CategoryNode[]
  depth?: number
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  onAddChild: (parent: CategoryNode) => void
  onEdit: (node: CategoryNode) => void
  onDelete: (node: CategoryNode) => void
}

function coverUrl(fileId: string) {
  return `/api/files/${fileId}/download`
}

function ColorDot({ color }: { color?: string | null }) {
  if (!color) return null
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-zinc-200"
      style={{ backgroundColor: color }}
    />
  )
}

function StatusBadge({ status }: { status?: 'active' | 'inactive' }) {
  if (!status || status === 'active') return null
  return (
    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
      inactive
    </span>
  )
}

function CoverThumb({ node }: { node: CategoryNode }) {
  const [imgError, setImgError] = useState(false)

  if (!node.coverImage) {
    return <Tag className="h-3.5 w-3.5 shrink-0 text-prominent-purple-400" />
  }

  if (imgError) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-200 bg-zinc-100">
        <ImageOff className="h-3 w-3 text-zinc-400" />
      </span>
    )
  }

  return (
    <span className="inline-block h-6 w-6 shrink-0 overflow-hidden rounded border border-zinc-200 bg-zinc-50">
      <img
        src={coverUrl(node.coverImage.id)}
        alt={node.coverImage.originalName}
        className="h-full w-full object-cover"
        onError={() => setImgError(true)}
      />
    </span>
  )
}

function CategoryRow({
  node,
  depth,
  canCreate,
  canUpdate,
  canDelete,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: CategoryNode
  depth: number
} & Omit<Props, 'nodes' | 'depth'>) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = (node.children?.length ?? 0) > 0
  const itemCount = node._count?.itemAssignments ?? 0
  const childCount = node._count?.children ?? node.children?.length ?? 0

  return (
    <div>
      <div
        className="group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-zinc-50"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 hover:text-zinc-600 ${!hasChildren ? 'invisible' : ''}`}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        <ColorDot color={node.color} />

        <CoverThumb node={node} />

        <span className="flex-1 truncate text-[13.5px] font-medium text-zinc-800">{node.name}</span>

        <StatusBadge status={node.status} />

        {itemCount > 0 && (
          <span className="flex items-center gap-0.5 text-[11px] text-zinc-400">
            <PackageSearch className="h-3 w-3" />
            {itemCount}
          </span>
        )}

        {childCount > 0 && (
          <span className="flex items-center gap-0.5 text-[11px] text-zinc-400">
            <Layers className="h-3 w-3" />
            {childCount}
          </span>
        )}

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {canCreate && (
            <button
              type="button"
              onClick={() => onAddChild(node)}
              title="Add sub-category"
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-prominent-purple-600"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          {canUpdate && (
            <button
              type="button"
              onClick={() => onEdit(node)}
              title="Edit"
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(node)}
              title="Delete"
              className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <CategoryTreeInner
          nodes={node.children!}
          depth={depth + 1}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}

function CategoryTreeInner({ nodes, depth = 0, ...rest }: Props) {
  return (
    <div>
      {nodes.map((node) => (
        <CategoryRow key={node.id} node={node} depth={depth} {...rest} />
      ))}
    </div>
  )
}

export default function CategoryTree(props: Props) {
  return <CategoryTreeInner {...props} depth={props.depth ?? 0} />
}

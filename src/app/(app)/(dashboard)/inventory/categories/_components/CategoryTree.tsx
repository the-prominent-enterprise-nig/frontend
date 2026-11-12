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
import { formatClassificationLabel } from '@/src/libs/format/text'
import Tooltip from '@/src/components/ui/Tooltip'
import { StatusPill } from '../../master-data/_components/masterDataChrome'

const TREE_ACTION = 'rounded-md p-1 text-ink-faint hover:bg-[#f0e9fc] hover:text-[#5b21b6]'
const TREE_DANGER = 'rounded-md p-1 text-ink-faint hover:bg-[#fdeceb] hover:text-[#b42318]'

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

function StatusBadge({ status }: { status?: 'active' | 'inactive' }): React.ReactNode {
  if (!status || status === 'active') return null
  return <StatusPill status={status} />
}

function CoverThumb({ node }: { node: CategoryNode }) {
  const [imgError, setImgError] = useState(false)

  if (!node.coverImage) {
    return <Tag className="h-3.5 w-3.5 shrink-0 text-[#8b5cf6]" />
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
        className="group flex items-center gap-1.5 rounded-md px-2 py-2 hover:bg-[#fbfbfc]"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint hover:text-[#5b21b6] ${!hasChildren ? 'invisible' : ''}`}
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

        <span className="flex-1 truncate text-[13px] font-medium text-[#1d1d26]">
          {formatClassificationLabel(node.name)}
        </span>

        <StatusBadge status={node.status} />

        {itemCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f1f4] px-2 py-0.5 text-[11.5px] font-medium tabular-nums text-[#3d3d4a]">
            <PackageSearch className="h-3 w-3" />
            {itemCount}
          </span>
        )}

        {childCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f1f4] px-2 py-0.5 text-[11.5px] font-medium tabular-nums text-[#3d3d4a]">
            <Layers className="h-3 w-3" />
            {childCount}
          </span>
        )}

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {canCreate && (
            <Tooltip label="Add sub-category" align="end">
              <button
                type="button"
                onClick={() => onAddChild(node)}
                aria-label="Add sub-category"
                className={TREE_ACTION}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
          {canUpdate && (
            <Tooltip label="Edit category" align="end">
              <button
                type="button"
                onClick={() => onEdit(node)}
                aria-label="Edit category"
                className={TREE_ACTION}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip label="Delete category" align="end">
              <button
                type="button"
                onClick={() => onDelete(node)}
                aria-label="Delete category"
                className={TREE_DANGER}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
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

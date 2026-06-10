'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import { leadsApi } from '@/src/libs/api/crm'
import type { Lead, PipelineColumn } from '@/src/schema/crm/types'

export default function PipelineView() {
  const [columns, setColumns] = useState<PipelineColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeLead, setActiveLead] = useState<Lead | null>(null)

  useEffect(() => {
    leadsApi.pipeline().then((res) => {
      if (res.success && res.data) setColumns(res.data)
      else setError(res.error ?? 'Failed to load pipeline')
      setLoading(false)
    })
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Three-way split: open pipeline is the forecast (still in motion),
  // wins are realized revenue, losses subtract from the net outlook.
  const totals = columns.reduce(
    (acc, col) => {
      if (col.isWonStage) {
        acc.won += col.totalValue
        acc.wonCount += col.leadCount
      } else if (col.isLostStage) {
        acc.lost += col.totalValue
        acc.lostCount += col.leadCount
      } else {
        acc.forecast += col.totalValue
        acc.forecastCount += col.leadCount
      }
      return acc
    },
    { forecast: 0, forecastCount: 0, won: 0, wonCount: 0, lost: 0, lostCount: 0 }
  )

  // Net potential = what's in flight + what's already won − what we've lost.
  const net = totals.forecast + totals.won - totals.lost

  function onDragStart(event: DragStartEvent) {
    const leadId = event.active.id as string
    const lead = columns.flatMap((c) => c.leads).find((l) => l.id === leadId)
    setActiveLead(lead ?? null)
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveLead(null)
    const leadId = event.active.id as string
    const targetStageId = event.over?.id as string | undefined
    if (!targetStageId) return

    // Find the lead and its current column
    const sourceCol = columns.find((c) => c.leads.some((l) => l.id === leadId))
    if (!sourceCol || sourceCol.stageId === targetStageId) return

    const targetCol = columns.find((c) => c.stageId === targetStageId)
    if (!targetCol) return

    const lead = sourceCol.leads.find((l) => l.id === leadId)!
    const value = lead.estimatedValue ? Number(lead.estimatedValue) : 0

    // Keep status in sync with terminal stages. Active columns reset status
    // to 'active' so a lead dragged out of Won/Lost re-enters the funnel.
    const nextStatus: Lead['status'] = targetCol.isWonStage
      ? 'won'
      : targetCol.isLostStage
        ? 'lost'
        : 'active'

    // Optimistic update
    const prev = columns
    setColumns((cols) =>
      cols.map((c) => {
        if (c.stageId === sourceCol.stageId) {
          return {
            ...c,
            leads: c.leads.filter((l) => l.id !== leadId),
            leadCount: c.leadCount - 1,
            totalValue: c.totalValue - value,
          }
        }
        if (c.stageId === targetStageId) {
          return {
            ...c,
            leads: [{ ...lead, stageId: targetStageId, status: nextStatus }, ...c.leads],
            leadCount: c.leadCount + 1,
            totalValue: c.totalValue + value,
          }
        }
        return c
      })
    )

    // Persist both fields so the backend's stage-filter sees the lead in the
    // right column on the next fetch.
    const res = await leadsApi.update(leadId, {
      stageId: targetStageId,
      status: nextStatus,
    })
    if (!res.success) {
      // Rollback
      setColumns(prev)
      setError(res.error ?? 'Failed to move lead')
      setTimeout(() => setError(null), 3000)
    }
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Pipeline</h1>
          <p className="mt-1 text-sm text-gray-500">
            Drag lead cards between stages to move them through the funnel.
          </p>
        </div>
        {!loading && !error && (
          <div className="text-right">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Net outlook
            </div>
            <div className="text-2xl font-semibold text-gray-900">₱{net.toLocaleString()}</div>
            <div className="mt-1 flex flex-wrap items-baseline justify-end gap-x-3 gap-y-0.5 text-[12px]">
              <span className="text-gray-500">
                Forecast{' '}
                <span className="font-semibold text-gray-800">
                  ₱{totals.forecast.toLocaleString()}
                </span>
                <span className="ml-1 text-gray-400">({totals.forecastCount})</span>
              </span>
              <span className="text-gray-500">
                Wins{' '}
                <span className="font-semibold text-green-600">
                  +₱{totals.won.toLocaleString()}
                </span>
                <span className="ml-1 text-gray-400">({totals.wonCount})</span>
              </span>
              <span className="text-gray-500">
                Lost{' '}
                <span className="font-semibold text-red-600">−₱{totals.lost.toLocaleString()}</span>
                <span className="ml-1 text-gray-400">({totals.lostCount})</span>
              </span>
            </div>
          </div>
        )}
      </header>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">
          Loading pipeline…
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {columns.map((col) => (
              <DroppableColumn key={col.stageId} column={col} />
            ))}
            {columns.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
                No pipeline stages yet. Configure stages in{' '}
                <Link
                  href="/crm/settings"
                  className="font-semibold text-prominent-orange-700 hover:underline"
                >
                  CRM settings
                </Link>
                .
              </div>
            )}
          </div>

          <DragOverlay>{activeLead ? <LeadCard lead={activeLead} isDragging /> : null}</DragOverlay>
        </DndContext>
      )}
    </div>
  )
}

function DroppableColumn({ column }: { column: PipelineColumn }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stageId })

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[200px] shrink-0 flex-col rounded-xl border bg-white transition-colors ${
        isOver ? 'border-prominent-orange-400 bg-prominent-orange-50/30' : 'border-gray-200'
      }`}
    >
      <header className="border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-gray-900">{column.stageName}</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {column.leadCount}
          </span>
        </div>
        <div
          className={`mt-1 text-[12px] font-medium ${
            column.isLostStage
              ? 'text-red-600'
              : column.isWonStage
                ? 'text-green-600'
                : 'text-gray-500'
          }`}
        >
          {column.isLostStage ? '−' : ''}₱{column.totalValue.toLocaleString()}
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-200px)] flex-1 flex-col gap-2 overflow-y-auto p-3">
        {column.leads.length === 0 && (
          <p
            className={`py-4 text-center text-[12px] ${
              isOver ? 'text-prominent-orange-600' : 'text-gray-400'
            }`}
          >
            {isOver ? 'Drop here' : 'No leads in this stage'}
          </p>
        )}
        {column.leads.map((lead) => (
          <DraggableLeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  )
}

function DraggableLeadCard({ lead }: { lead: Lead }) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
  })

  // Hide the original card while dragging — the DragOverlay renders a clone.
  if (isDragging) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 opacity-50">
        <div className="text-[13px] font-medium text-gray-400">
          {[lead.firstName, lead.lastName].filter(Boolean).join(' ')}
        </div>
      </div>
    )
  }

  // The PointerSensor's 5px activation distance lets a no-movement
  // pointer-up fall through to onClick; a real drag suppresses it.
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => router.push(`/crm/leads/${lead.id}`)}
      className="touch-none"
    >
      <LeadCard lead={lead} />
    </div>
  )
}

function LeadCard({ lead, isDragging = false }: { lead: Lead; isDragging?: boolean }) {
  return (
    <div
      className={`block cursor-grab rounded-lg border bg-gray-50 px-3 py-2.5 transition-colors active:cursor-grabbing ${
        isDragging
          ? 'border-prominent-orange-300 bg-white shadow-lg rotate-2'
          : 'border-gray-100 hover:border-prominent-orange-200 hover:bg-prominent-orange-50/40'
      }`}
    >
      <div className="text-[13px] font-medium text-gray-900">
        {[lead.firstName, lead.lastName].filter(Boolean).join(' ')}
      </div>
      {lead.company && <div className="text-[11.5px] text-gray-500">{lead.company}</div>}
      {lead.estimatedValue && (
        <div className="mt-1 text-[11.5px] font-medium text-gray-700">
          ₱{Number(lead.estimatedValue).toLocaleString()}
        </div>
      )}
    </div>
  )
}

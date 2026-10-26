'use client'

import React from 'react'
import type { Agent } from '@/src/schema/crm/types'
import type { CreateAgentInput } from '@/src/schema/crm/agent'

const FIELD_LIMITS = { name: 255, phone: 50, email: 255 } as const

export type AgentFormState = Partial<CreateAgentInput>

/** The form's starting values — blank for Add Agent, the agent's own for Edit. */
export function agentFormState(agent?: Agent | null): AgentFormState {
  return {
    name: agent?.name ?? '',
    phone: agent?.phone ?? '',
    email: agent?.email ?? '',
    // Number() — the API sends Agent.commissionRate (a Prisma Decimal) as a
    // string, and the update DTO is @IsNumber(), so saving it back untouched
    // would be refused.
    commissionRate: agent?.commissionRate != null ? Number(agent.commissionRate) : null,
    branchId: agent?.branchId ?? null,
  }
}

/** The agent fields, shared by the list's Add Agent dialog and the agent
 * page's inline Edit so the two can't drift apart. */
export function AgentFormFields({
  form,
  onChange,
  branches,
}: {
  form: AgentFormState
  onChange: (form: AgentFormState) => void
  branches: { id: string; name: string }[]
}) {
  const set = <K extends keyof CreateAgentInput>(k: K, v: CreateAgentInput[K]) =>
    onChange({ ...form, [k]: v })

  return (
    <>
      <Field label="Name *">
        <input
          required
          maxLength={FIELD_LIMITS.name}
          value={form.name ?? ''}
          onChange={(e) => set('name', e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Phone">
        <input
          maxLength={FIELD_LIMITS.phone}
          value={form.phone ?? ''}
          onChange={(e) => set('phone', e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Email">
        <input
          type="email"
          maxLength={FIELD_LIMITS.email}
          value={form.email ?? ''}
          onChange={(e) => set('email', e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Branch">
        <select
          value={form.branchId ?? ''}
          onChange={(e) => set('branchId', e.target.value || null)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        >
          <option value="">All branches (tenant-wide)</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Commission Rate (%)">
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          placeholder="e.g. 5 for 5%. Leave blank for no commission."
          value={form.commissionRate != null ? form.commissionRate * 100 : ''}
          onChange={(e) =>
            set('commissionRate', e.target.value === '' ? null : Number(e.target.value) / 100)
          }
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </Field>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

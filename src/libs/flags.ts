'use client'

const FLAGS = {
  ITEM_360_DRAWER: true,
  COMMAND_PALETTE: true,
  ACTIVE_OPS_BAR: false,
  WORKFLOW_PANELS: false,
  DATA_TABLE_V2: false,
} as const

type FlagKey = keyof typeof FLAGS

function getOverride(key: FlagKey): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const val = localStorage.getItem(`ff:${key}`)
    if (val === 'true') return true
    if (val === 'false') return false
  } catch {}
  return null
}

export function flag(key: FlagKey): boolean {
  const override = getOverride(key)
  return override !== null ? override : FLAGS[key]
}

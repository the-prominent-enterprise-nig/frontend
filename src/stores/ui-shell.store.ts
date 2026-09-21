import { create } from 'zustand'

export type Panel = {
  type: 'item360'
  itemId: string
  itemName?: string
  // Scopes which tabs the drawer shows — 'catalog' (Overview, product
  // definition) vs 'stock' (Stock/Serials/Movements/History, operational).
  // Falls back to 'stock' when omitted so pre-existing call sites keep
  // their current (operational) tab set until updated.
  context?: 'catalog' | 'stock'
  // Scenario 50 — the location filter that was active on the list this
  // drawer was opened from, as branch:/warehouse: tokens (see
  // libs/inventory/location-tokens). The drawer scopes its Stock and Serials
  // tabs to the same places: opening an item from a list filtered to Ajuy
  // and Alimodian and then being shown every other branch's stock is the
  // filter leak the client reported. Empty/omitted means no filter was
  // active, so the drawer shows every location.
  locations?: string[]
  // Scenario 56 — the list's Operations (region) filter, carried along with
  // `locations` so picking "Panay" doesn't show Negros stock in the drawer.
  region?: 'panay' | 'negros'
}

interface UIShellStore {
  panelStack: Panel[]
  pushPanel: (panel: Panel) => void
  popPanel: () => void
  replacePanel: (panel: Panel) => void
  clearPanels: () => void
  commandPaletteOpen: boolean
  openCommandPalette: () => void
  closeCommandPalette: () => void
}

export const useUIShell = create<UIShellStore>((set) => ({
  panelStack: [],
  pushPanel: (panel) =>
    set((s) => ({
      panelStack:
        s.panelStack.length >= 3 ? [...s.panelStack.slice(1), panel] : [...s.panelStack, panel],
    })),
  popPanel: () => set((s) => ({ panelStack: s.panelStack.slice(0, -1) })),
  replacePanel: (panel) =>
    set((s) => ({
      panelStack: s.panelStack.length === 0 ? [panel] : [...s.panelStack.slice(0, -1), panel],
    })),
  clearPanels: () => set({ panelStack: [] }),
  commandPaletteOpen: false,
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
}))

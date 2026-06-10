import { create } from 'zustand'

export type Panel = { type: 'item360'; itemId: string; itemName?: string }

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

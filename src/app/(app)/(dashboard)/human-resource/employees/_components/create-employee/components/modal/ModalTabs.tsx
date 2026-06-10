'use client'

import { Button } from 'react-aria-components'
import { TabId, TabDefinition } from '../../types'
import { TAB_ORDER } from '../../constants'

interface ModalTabsProps {
  tabs: TabDefinition[]
  activeTab: TabId
  onSelect: (tab: TabId) => void
  hasError: (tab: TabId) => boolean
}

export function ModalTabs({ tabs, activeTab, onSelect, hasError }: ModalTabsProps) {
  const activeIndex = TAB_ORDER.indexOf(activeTab)

  return (
    <>
      {/* Desktop tab bar */}
      <div className="hidden sm:flex border-b border-gray-100 bg-white px-6 pt-3 gap-1 shrink-0">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            className={[
              'relative pb-3 px-4 text-sm font-semibold transition-colors flex items-center gap-1.5',
              activeTab === tab.id ? 'text-purple-700' : 'text-gray-400 hover:text-gray-600',
            ].join(' ')}
          >
            {tab.icon}
            {tab.label}
            {hasError(tab.id) && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            )}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-purple-600" />
            )}
          </Button>
        ))}
      </div>

      {/* Mobile step label */}
      <div className="flex sm:hidden items-center justify-between px-4 pt-3 pb-1 shrink-0">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 uppercase tracking-wide">
          {tabs.find((t) => t.id === activeTab)?.icon}
          {tabs.find((t) => t.id === activeTab)?.label}
        </span>
        <span className="text-xs text-gray-400">
          Step {activeIndex + 1} of {tabs.length}
        </span>
      </div>
    </>
  )
}

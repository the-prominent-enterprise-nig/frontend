'use client'

import { ArrowLeft, ArrowRight, UserPlus, Loader2 } from 'lucide-react'
import { Button } from 'react-aria-components'
import { TabId } from '../../types'
import { TAB_ORDER } from '../../constants'

interface ModalFooterProps {
  activeTab: TabId
  onNext: () => void
  onPrev: () => void
  onClose: () => void
  onSubmit: () => void
  isPending?: boolean
}

export function ModalFooter({
  activeTab,
  onNext,
  onPrev,
  onClose,
  onSubmit,
  isPending = false,
}: ModalFooterProps) {
  const activeIndex = TAB_ORDER.indexOf(activeTab)
  const isLast = activeTab === TAB_ORDER[TAB_ORDER.length - 1]

  return (
    <div className="shrink-0 border-t border-gray-100 bg-gray-50/70 px-4 sm:px-6 pb-safe lg:mb-1 mb-20">
      <div className="flex items-center justify-between py-3 sm:py-4">
        {/* Left side */}
        <div>
          <p className="hidden sm:block text-xs text-gray-400">
            Fields marked <span className="text-purple-600 font-bold">*</span> are required
          </p>

          {/* Mobile: back or cancel */}
          {activeIndex > 0 ? (
            <Button
              onPress={onPrev}
              className="sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-white border border-gray-200 active:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Button>
          ) : (
            <Button
              onPress={onClose}
              className="sm:hidden px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-white border border-gray-200 active:bg-gray-100 transition-colors"
            >
              Cancel
            </Button>
          )}
        </div>

        {/* Right side */}
        <div className="flex gap-2.5">
          {/* Desktop cancel */}
          <Button
            onPress={onClose}
            className="hidden sm:block px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </Button>

          {/* Next — shown when not on last tab */}
          {!isLast && (
            <Button
              onPress={onNext}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 border border-purple-200 transition-colors"
            >
              Next
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}

          {/* Submit — desktop: always visible; mobile: only on the last tab */}
          <Button
            onPress={onSubmit}
            type="submit"
            isDisabled={isPending}
            className="hidden sm:flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6b21a8)' }}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Add Employee
              </>
            )}
          </Button>
          {isLast && (
            <Button
              onPress={onSubmit}
              type="submit"
              isDisabled={isPending}
              className="sm:hidden flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6b21a8)' }}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Add Employee
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

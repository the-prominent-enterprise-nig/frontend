'use client'

import { UserPlus, X } from 'lucide-react'
import { Button } from 'react-aria-components'

interface ModalHeaderProps {
  onClose: () => void
}

export function ModalHeader({ onClose }: ModalHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 shrink-0"
      style={{ background: 'linear-gradient(135deg, #6b21a8 0%, #7c3aed 100%)' }}
    >
      {/* Drag handle — mobile only */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/30 sm:hidden" />

      <div className="flex items-center gap-3">
        <div className="bg-white/15 rounded-xl p-2">
          <UserPlus className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
            Add New Employee
          </h2>
          <p className="text-purple-200 text-xs mt-0.5 hidden sm:block">
            Fill in the details to create an employee record
          </p>
        </div>
      </div>

      <Button
        onPress={onClose}
        className="text-purple-200 hover:text-white hover:bg-white/15 rounded-lg p-2 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </Button>
    </div>
  )
}

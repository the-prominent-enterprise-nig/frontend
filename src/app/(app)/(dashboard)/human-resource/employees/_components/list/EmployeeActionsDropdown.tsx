'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react'

interface EmployeeActionsDropdownProps {
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

interface DropdownItem {
  label: string
  icon: React.ReactNode
  onClick: () => void
  className: string
}

export function EmployeeActionsDropdown({
  onView,
  onEdit,
  onDelete,
}: EmployeeActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const items: DropdownItem[] = [
    {
      label: 'View',
      icon: <Eye className="w-3.5 h-3.5" color="gray" />,
      onClick: () => {
        setIsOpen(false)
        onView?.()
      },
      className: 'text-gray-500 hover:bg-gray-50',
    },
    {
      label: 'Edit',
      icon: <Pencil className="w-3.5 h-3.5" color="gray" />,
      onClick: () => {
        setIsOpen(false)
        onEdit?.()
      },
      className: 'text-gray-500 hover:bg-gray-50',
    },
    {
      label: 'Delete',
      icon: <Trash2 className="w-3.5 h-3.5" color="red" />,
      onClick: () => {
        setIsOpen(false)
        onDelete?.()
      },
      className: 'text-red-600 hover:bg-red-50',
    },
  ]

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen((prev) => !prev)
        }}
        className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
      >
        <MoreHorizontal className="w-4.5 h-4.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-1 w-40 rounded-md bg-white shadow-lg border border-gray-200">
          <div className="flex flex-col py-1">
            {items.map(({ label, icon, onClick, className }) => (
              <button
                key={label}
                onClick={(e) => {
                  e.stopPropagation()
                  onClick()
                }}
                className={`flex items-center gap-2 w-full text-left font-medium px-4 py-2 text-sm transition-colors cursor-pointer ${className}`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4.5" />,
        info: <InfoIcon className="size-4.5" />,
        warning: <TriangleAlertIcon className="size-4.5" />,
        error: <OctagonXIcon className="size-4.5" />,
        loading: <Loader2Icon className="size-4.5 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast flex gap-3 rounded-lg px-4 py-3 shadow-md',
          icon: 'mt-0.5 shrink-0',
          content: 'flex flex-col gap-1 min-w-0',
          title: 'text-sm font-semibold leading-5',
          description: 'text-xs leading-5 opacity-90',
          success: 'bg-emerald-50 text-emerald-900 border border-emerald-200',
          warning: 'bg-amber-50 text-amber-900 border border-amber-200',
          error: 'bg-red-50 text-red-900 border border-red-200',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

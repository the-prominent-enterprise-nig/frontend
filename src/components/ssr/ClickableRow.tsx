'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'

/**
 * A table row that navigates on click while its cells stay server-rendered
 * (they are passed in as children). Clicks on a link or button inside the row
 * keep their own behavior. Give the row's main cell a real <Link> as well, so
 * keyboard and middle-click users are not left out.
 */
export function ClickableRow({
  href,
  className = '',
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}): React.JSX.Element {
  const router = useRouter()

  return (
    <tr
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('a, button')) return
        router.push(href)
      }}
      className={`cursor-pointer ${className}`}
    >
      {children}
    </tr>
  )
}

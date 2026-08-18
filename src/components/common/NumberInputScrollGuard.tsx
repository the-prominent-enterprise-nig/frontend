'use client'

import { useEffect } from 'react'

// Browsers change a focused <input type="number">'s value when the mouse
// wheel scrolls over it — easy to trigger by accident while scrolling past
// one on a long form, silently mutating the amount. Blurring the input on
// wheel (before the browser's native spin-adjustment applies) stops that
// without touching every number input individually. Paired with the
// spinner-arrow removal in globals.css.
export default function NumberInputScrollGuard() {
  useEffect(() => {
    function handleWheel(e: WheelEvent) {
      const target = e.target
      if (
        target instanceof HTMLInputElement &&
        target.type === 'number' &&
        document.activeElement === target
      ) {
        target.blur()
      }
    }
    document.addEventListener('wheel', handleWheel, { passive: true })
    return () => document.removeEventListener('wheel', handleWheel)
  }, [])

  return null
}

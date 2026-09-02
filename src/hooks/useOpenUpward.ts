'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * For a popover anchored to `anchorRef` that normally opens downward from
 * `top-full` — flips it to open upward from `bottom-full` instead when
 * there isn't enough room below the anchor in the viewport but there's more
 * room above. Without this, a popup opened near the bottom of the visible
 * viewport silently renders past the fold with no indication it's cut off.
 *
 * Measures the popup's own rendered height via `popupRef` rather than a
 * guessed constant, so it works regardless of option count/search bar/etc.
 * Runs in a layout effect so the flip (if any) happens before paint — no
 * visible flicker from rendering downward first, then jumping upward.
 */
export function useOpenUpward(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  popupRef: RefObject<HTMLElement | null>
): boolean {
  const [openUpward, setOpenUpward] = useState(false)

  useLayoutEffect(() => {
    if (!open) {
      setOpenUpward(false)
      return
    }
    const anchorRect = anchorRef.current?.getBoundingClientRect()
    const popupHeight = popupRef.current?.getBoundingClientRect().height ?? 0
    if (!anchorRect) return
    const spaceBelow = window.innerHeight - anchorRect.bottom
    const spaceAbove = anchorRect.top
    setOpenUpward(spaceBelow < popupHeight && spaceAbove > spaceBelow)
  }, [open, anchorRef, popupRef])

  return openUpward
}

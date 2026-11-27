import { useCallback, useEffect, useRef, type RefObject } from 'react'

/**
 * Keeps a line list's add control (placed below the list) on screen: each new
 * line pushes it down, so after an add the user would have to scroll to reach it
 * again. Call `reveal` in the add handler and put `ref` on the control's wrapper.
 * Only an explicit add scrolls — loading a saved record's lines does not.
 */
export function useRevealOnAdd<T extends HTMLElement = HTMLDivElement>(
  count: number
): { ref: RefObject<T | null>; reveal: () => void } {
  const ref = useRef<T>(null)
  const pending = useRef(false)

  useEffect(() => {
    if (!pending.current) return
    pending.current = false
    // Next frame: after react-hook-form has focused the new row, which scrolls too.
    requestAnimationFrame(() => ref.current?.scrollIntoView({ block: 'nearest' }))
  }, [count])

  const reveal = useCallback((): void => {
    pending.current = true
  }, [])

  return { ref, reveal }
}

'use client'

import { useEffect, useState } from 'react'

/** `value`, but only once it has stopped changing for `delayMs` — for a search
 * box that asks the server, so each keystroke isn't a request. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

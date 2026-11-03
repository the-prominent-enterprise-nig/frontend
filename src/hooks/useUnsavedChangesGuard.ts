'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Guards against silently losing unsaved work on three separate exit paths —
 * shared between Manage Access and Create Role, which both edit a large form
 * with no autosave.
 *
 * 1. In-app navigation (a Back/Cancel button calling handleLeave): shows the
 *    confirmation modal itself, caller renders it.
 * 2. Browser-level exits (closing the tab, refreshing, typing a new URL):
 *    the native beforeunload prompt — browsers hard-lock its text to a
 *    generic message, no way to customize it, but it does fire.
 * 3. The browser/mouse back button: goes through the native History API
 *    directly, bypassing #1's onClick handler entirely, and it's a
 *    client-side route change within this SPA, so it never fires
 *    beforeunload either — confirmed live, the warning didn't fire from a
 *    real back-button press before this existed. The platform gives no way
 *    to cancel a back-navigation in progress, only to react after it
 *    already happened — so this pushes a same-URL history entry as a
 *    buffer the moment there's something to protect. A back-press consumes
 *    that buffer (landing back on this exact URL, nothing visibly changes)
 *    and fires popstate, the only hook available to catch it; from there it
 *    re-arms the buffer and asks, instead of forwarding the browser two
 *    steps back to the real previous entry.
 */
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean, leaveTo: string) {
  const router = useRouter()
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  useEffect(() => {
    if (!hasUnsavedChanges) return
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (!hasUnsavedChanges) return
    window.history.pushState(null, '', window.location.href)
    function handlePopState() {
      window.history.pushState(null, '', window.location.href)
      setShowLeaveConfirm(true)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [hasUnsavedChanges])

  function handleLeave() {
    if (hasUnsavedChanges) {
      setShowLeaveConfirm(true)
      return
    }
    router.push(leaveTo)
  }

  function confirmLeave() {
    router.push(leaveTo)
  }

  return { showLeaveConfirm, setShowLeaveConfirm, handleLeave, confirmLeave }
}

import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook to warn users about unsaved changes when navigating away.
 * Attaches a `beforeunload` listener when `isDirty` is true.
 *
 * Note: In-app navigation (React Router) blocking requires the data router
 * (`createBrowserRouter`), which this app doesn't use. This hook only
 * handles browser-level navigation (refresh, close tab, browser back).
 *
 * @param isDirty - Whether there are unsaved changes
 */
export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Modern browsers ignore custom messages but returnValue is still required
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])
}

/**
 * Creates a stable snapshot comparator for detecting dirty state.
 * Returns `isDirty` (boolean) and a `markClean` callback to reset after save.
 *
 * @param currentValue - The current editor state to compare
 * @returns [isDirty, markClean]
 */
export function useDirtyState<T>(currentValue: T): [boolean, () => void] {
  const cleanSnapshot = useRef<string>(JSON.stringify(currentValue))
  // Track whether this is the first render (never dirty on mount)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      cleanSnapshot.current = JSON.stringify(currentValue)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const markClean = useCallback(() => {
    cleanSnapshot.current = JSON.stringify(currentValue)
  }, [currentValue])

  const isDirty = !isFirstRender.current && JSON.stringify(currentValue) !== cleanSnapshot.current

  return [isDirty, markClean]
}

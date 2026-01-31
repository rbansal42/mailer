import { useEffect, useCallback } from 'react'

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  preventDefault?: boolean
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Allow Ctrl+S even in inputs
      if (!(e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey))) {
        return
      }
    }

    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey)
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
      const altMatch = shortcut.alt ? e.altKey : !e.altKey
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
      
      if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
        if (shortcut.preventDefault !== false) {
          e.preventDefault()
        }
        shortcut.action()
        return
      }
    }
  }, [shortcuts])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

// Predefined shortcut creators for common actions
export const createSaveShortcut = (action: () => void): ShortcutConfig => ({
  key: 's',
  ctrl: true,
  action,
})

export const createUndoShortcut = (action: () => void): ShortcutConfig => ({
  key: 'z',
  ctrl: true,
  action,
})

export const createRedoShortcut = (action: () => void): ShortcutConfig => ({
  key: 'z',
  ctrl: true,
  shift: true,
  action,
})

export const createDuplicateShortcut = (action: () => void): ShortcutConfig => ({
  key: 'd',
  ctrl: true,
  action,
})

export const createDeleteShortcut = (action: () => void): ShortcutConfig => ({
  key: 'Delete',
  action,
})

# Phase 5: UI/UX Polish - Implementation Plan

**Date:** January 31, 2026
**Branch:** `feature/phase-5-ui`
**Worktree:** `/Volumes/Code/mailer/.worktrees/phase-5`

## Overview

Improve the template editor with undo/redo, keyboard shortcuts, better preview experience, and accessibility enhancements.

## Tasks

### Task 1: Undo/Redo State Management
**Priority:** High | **Parallelizable:** Yes

Create a history store for undo/redo functionality.

**File to create:** `frontend/src/stores/history.ts`

```typescript
import { create } from 'zustand'

interface HistoryState<T> {
  past: T[]
  present: T | null
  future: T[]
  canUndo: boolean
  canRedo: boolean
  set: (state: T) => void
  undo: () => void
  redo: () => void
  clear: () => void
}

export function createHistoryStore<T>(maxHistory = 50) {
  return create<HistoryState<T>>((set, get) => ({
    past: [],
    present: null,
    future: [],
    canUndo: false,
    canRedo: false,
    
    set: (newState: T) => {
      const { past, present } = get()
      if (present === null) {
        set({ present: newState })
        return
      }
      // Don't record if state is identical
      if (JSON.stringify(present) === JSON.stringify(newState)) return
      
      const newPast = [...past, present].slice(-maxHistory)
      set({
        past: newPast,
        present: newState,
        future: [], // Clear redo stack on new action
        canUndo: true,
        canRedo: false,
      })
    },
    
    undo: () => {
      const { past, present, future } = get()
      if (past.length === 0) return
      
      const previous = past[past.length - 1]
      const newPast = past.slice(0, -1)
      
      set({
        past: newPast,
        present: previous,
        future: present ? [present, ...future] : future,
        canUndo: newPast.length > 0,
        canRedo: true,
      })
    },
    
    redo: () => {
      const { past, present, future } = get()
      if (future.length === 0) return
      
      const next = future[0]
      const newFuture = future.slice(1)
      
      set({
        past: present ? [...past, present] : past,
        present: next,
        future: newFuture,
        canUndo: true,
        canRedo: newFuture.length > 0,
      })
    },
    
    clear: () => set({
      past: [],
      present: null,
      future: [],
      canUndo: false,
      canRedo: false,
    }),
  }))
}
```

**Acceptance Criteria:**
- [ ] History store with undo/redo
- [ ] Max 50 entries
- [ ] Clear redo on new action
- [ ] TypeScript compiles

---

### Task 2: Keyboard Shortcuts Hook
**Priority:** High | **Parallelizable:** Yes (with T1)

Create a hook for global keyboard shortcuts.

**File to create:** `frontend/src/hooks/useKeyboardShortcuts.ts`

```typescript
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
```

**Acceptance Criteria:**
- [ ] Hook detects Ctrl/Cmd, Shift, Alt modifiers
- [ ] Supports Mac Cmd key
- [ ] Prevents default when needed
- [ ] TypeScript compiles

---

### Task 3: Undo/Redo Toolbar Buttons
**Priority:** High | **Parallelizable:** No (after T1)

Add undo/redo buttons to Templates.tsx toolbar.

**File to modify:** `frontend/src/pages/Templates.tsx`

- Import history store and useKeyboardShortcuts
- Add Undo/Redo buttons to toolbar
- Wire up keyboard shortcuts:
  - Ctrl+Z = Undo
  - Ctrl+Shift+Z = Redo
  - Ctrl+S = Save
- Show disabled state when can't undo/redo

**Acceptance Criteria:**
- [ ] Undo button works
- [ ] Redo button works
- [ ] Keyboard shortcuts work
- [ ] Buttons disabled when history empty
- [ ] TypeScript compiles

---

### Task 4: Block Duplication
**Priority:** Medium | **Parallelizable:** Yes (with T3)

Add duplicate button on block hover.

**File to modify:** `frontend/src/pages/Templates.tsx`

- Add "Duplicate" button to block actions (next to delete)
- Keyboard shortcut: Ctrl+D when block selected
- Insert duplicate immediately after original
- Generate new unique ID for duplicate

**Acceptance Criteria:**
- [ ] Duplicate button visible on hover
- [ ] Creates copy with new ID
- [ ] Ctrl+D shortcut works
- [ ] TypeScript compiles

---

### Task 5: Preview Mode Toggle
**Priority:** Medium | **Parallelizable:** Yes

Add desktop/mobile/dark mode toggles to preview.

**File to modify:** `frontend/src/pages/Templates.tsx` or create preview component

- Add toggle buttons: [Desktop] [Mobile] [Dark]
- Desktop mode: 600px width
- Mobile mode: 320px width in phone frame
- Dark mode: Invert background colors
- Add "View Source" button to show raw HTML

**Acceptance Criteria:**
- [ ] Desktop/Mobile width toggle
- [ ] Dark mode toggle
- [ ] HTML source view
- [ ] TypeScript compiles

---

### Task 6: Improved Drag-and-Drop
**Priority:** Medium | **Parallelizable:** Yes
**Status:** DEFERRED - Will be implemented in a future iteration

Enhance drag-and-drop with visual indicators.

**File to modify:** `frontend/src/pages/Templates.tsx`

- Add visual drop indicator (line between blocks)
- Add ghost preview with reduced opacity
- Smooth animation on drag start/end
- Auto-scroll when near edges

Using existing @dnd-kit library.

**Deferral Rationale:**
This task requires integration with @dnd-kit library and careful UX testing. The basic block reordering via Move Up/Down buttons is functional. Visual DnD enhancements will be addressed when there's dedicated time for polish.

**Acceptance Criteria:**
- [ ] Drop indicator line visible
- [ ] Ghost preview at 50% opacity
- [ ] Smooth animations
- [ ] TypeScript compiles

---

### Task 7: Accessibility Improvements
**Priority:** Medium | **Parallelizable:** Yes

Add ARIA labels and keyboard navigation.

**Files to modify:** Multiple components

- Add aria-label to all buttons/inputs
- Add role="status" and aria-live for notifications
- Add visible focus rings (2px outline)
- Add skip link "Skip to main content"
- Respect prefers-reduced-motion

**Acceptance Criteria:**
- [ ] ARIA labels on interactive elements
- [ ] Visible focus indicators
- [ ] Skip link for keyboard users
- [ ] Reduced motion support
- [ ] TypeScript compiles

---

### Task 8: Mobile Responsive Layout
**Priority:** Medium | **Parallelizable:** Yes

Make layout responsive for mobile/tablet.

**Files to modify:** `frontend/src/components/Layout.tsx`, pages

- Add hamburger menu for mobile (< 640px)
- Stack composer sections on tablet (640-1024px)
- 44px minimum tap targets
- Collapsible sidebar

**Acceptance Criteria:**
- [ ] Hamburger menu on mobile
- [ ] Stacked layout on tablet
- [ ] Touch-friendly buttons
- [ ] TypeScript compiles

---

### Task 9: Build and Verify
**Priority:** High | **Parallelizable:** No (after all)

Verify frontend builds and works.

```bash
cd frontend
bun run build
```

**Acceptance Criteria:**
- [ ] TypeScript compiles
- [ ] Vite build succeeds
- [ ] No runtime errors
- [ ] Features work in browser

---

## Execution Plan

### Parallel Group 1
- **Task 1:** History store
- **Task 2:** Keyboard shortcuts hook

### Parallel Group 2 (after Group 1)
- **Task 3:** Undo/Redo toolbar
- **Task 4:** Block duplication
- **Task 5:** Preview mode toggle
- **Task 6:** Improved drag-and-drop
- **Task 7:** Accessibility
- **Task 8:** Mobile responsive

### Final
- **Task 9:** Build and verify

---

## Files to Create/Modify

| File | Action | Task |
|------|--------|------|
| `frontend/src/stores/history.ts` | Create | T1 |
| `frontend/src/hooks/useKeyboardShortcuts.ts` | Create | T2 |
| `frontend/src/pages/Templates.tsx` | Modify | T3, T4, T5, T6 |
| `frontend/src/components/Layout.tsx` | Modify | T7, T8 |
| `frontend/src/index.css` | Modify | T7 |

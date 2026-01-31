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
      // Don't record if state is identical (shallow compare via JSON)
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

    clear: () =>
      set({
        past: [],
        present: null,
        future: [],
        canUndo: false,
        canRedo: false,
      }),
  }))
}

// Create a specific history store for template blocks
export interface Block {
  id: string
  type: string
  props: Record<string, unknown>
}

export const useBlockHistory = createHistoryStore<Block[]>()

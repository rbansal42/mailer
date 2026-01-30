import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark'
export type ThemeColor = 'blue' | 'indigo' | 'violet' | 'rose' | 'orange' | 'emerald' | 'cyan' | 'slate'

interface ThemeState {
  mode: ThemeMode
  primaryColor: ThemeColor
  toggleMode: () => void
  setMode: (mode: ThemeMode) => void
  setPrimaryColor: (color: ThemeColor) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      primaryColor: 'blue',
      toggleMode: () => set((state) => ({ mode: state.mode === 'dark' ? 'light' : 'dark' })),
      setMode: (mode: ThemeMode) => set({ mode }),
      setPrimaryColor: (primaryColor: ThemeColor) => set({ primaryColor }),
    }),
    {
      name: 'mailer-theme',
    }
  )
)

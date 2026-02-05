import { ThemeColor, ThemeMode } from '../hooks/useThemeStore'

interface ColorValues {
  primary: string
  primaryForeground: string
  ring: string
}

interface ColorPreset {
  name: string
  light: ColorValues
  dark: ColorValues
  swatch: string // Color for the swatch preview
}

// Tailwind-based color presets with high readability
// Each color is tuned for good contrast in both light and dark modes
export const COLOR_PRESETS: Record<ThemeColor, ColorPreset> = {
  blue: {
    name: 'Blue',
    swatch: '#3b82f6',
    light: {
      primary: '221 83% 53%',
      primaryForeground: '210 40% 98%',
      ring: '221 83% 53%',
    },
    dark: {
      primary: '217 91% 60%',
      primaryForeground: '222 47% 11%',
      ring: '217 91% 60%',
    },
  },
  indigo: {
    name: 'Indigo',
    swatch: '#6366f1',
    light: {
      primary: '239 84% 67%',
      primaryForeground: '210 40% 98%',
      ring: '239 84% 67%',
    },
    dark: {
      primary: '239 84% 67%',
      primaryForeground: '222 47% 11%',
      ring: '239 84% 67%',
    },
  },
  violet: {
    name: 'Violet',
    swatch: '#8b5cf6',
    light: {
      primary: '263 70% 58%',
      primaryForeground: '210 40% 98%',
      ring: '263 70% 58%',
    },
    dark: {
      primary: '263 70% 58%',
      primaryForeground: '222 47% 11%',
      ring: '263 70% 58%',
    },
  },
  rose: {
    name: 'Rose',
    swatch: '#f43f5e',
    light: {
      primary: '350 89% 60%',
      primaryForeground: '210 40% 98%',
      ring: '350 89% 60%',
    },
    dark: {
      primary: '350 89% 60%',
      primaryForeground: '210 40% 98%',
      ring: '350 89% 60%',
    },
  },
  orange: {
    name: 'Orange',
    swatch: '#f97316',
    light: {
      primary: '25 95% 53%',
      primaryForeground: '210 40% 98%',
      ring: '25 95% 53%',
    },
    dark: {
      primary: '25 95% 53%',
      primaryForeground: '222 47% 11%',
      ring: '25 95% 53%',
    },
  },
  emerald: {
    name: 'Emerald',
    swatch: '#10b981',
    light: {
      primary: '160 84% 39%',
      primaryForeground: '210 40% 98%',
      ring: '160 84% 39%',
    },
    dark: {
      primary: '160 84% 45%',
      primaryForeground: '222 47% 11%',
      ring: '160 84% 45%',
    },
  },
  cyan: {
    name: 'Cyan',
    swatch: '#06b6d4',
    light: {
      primary: '189 94% 43%',
      primaryForeground: '210 40% 98%',
      ring: '189 94% 43%',
    },
    dark: {
      primary: '189 94% 43%',
      primaryForeground: '222 47% 11%',
      ring: '189 94% 43%',
    },
  },
  slate: {
    name: 'Slate',
    swatch: '#64748b',
    light: {
      primary: '215 16% 47%',
      primaryForeground: '210 40% 98%',
      ring: '215 16% 47%',
    },
    dark: {
      primary: '215 20% 55%',
      primaryForeground: '222 47% 11%',
      ring: '215 20% 55%',
    },
  },
}

export const THEME_COLORS = Object.keys(COLOR_PRESETS) as ThemeColor[]

export function applyTheme(mode: ThemeMode, color: ThemeColor): void {
  const root = document.documentElement
  const preset = COLOR_PRESETS[color]
  const values = mode === 'dark' ? preset.dark : preset.light

  // Toggle dark class
  root.classList.toggle('dark', mode === 'dark')

  // Apply color variables
  root.style.setProperty('--primary', values.primary)
  root.style.setProperty('--primary-foreground', values.primaryForeground)
  root.style.setProperty('--ring', values.ring)
}

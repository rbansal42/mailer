// Shared types for all certificate templates
// This eliminates the interface duplication across 9 template files

export interface Signatory {
  name: string
  designation: string
  organization?: string
  signatureUrl?: string
}

export interface Logo {
  url: string
  height?: number
}

export interface BaseTemplateProps {
  title: string
  subtitle?: string
  recipientName: string
  description: string
  logos?: Logo[]
  signatories?: Signatory[]
  certificateId?: string
}

// Color palette type for templates that define custom colors
export interface ColorPalette {
  background: string
  primary: string
  secondary: string
  accent: string
  text: string
  muted: string
  border?: string
}

// Common predefined palettes that can be reused
export const PALETTES = {
  light: {
    background: '#ffffff',
    primary: '#1e293b',
    secondary: '#64748b',
    accent: '#0ea5e9',
    text: '#1e293b',
    muted: '#94a3b8',
    border: '#e2e8f0',
  },
  dark: {
    background: '#1e293b',
    primary: '#fbbf24',
    secondary: '#f1f5f9',
    accent: '#fbbf24',
    text: '#f1f5f9',
    muted: '#94a3b8',
    border: '#475569',
  },
  tech: {
    background: '#0f172a',
    primary: '#22d3ee',
    secondary: '#94a3b8',
    accent: '#10b981',
    text: '#f1f5f9',
    muted: '#64748b',
    border: '#1e293b',
  },
  corporate: {
    background: '#1a365d',
    primary: '#c9a227',
    secondary: '#e2e8f0',
    accent: '#c9a227',
    text: '#f7fafc',
    muted: '#a0aec0',
    border: '#2c5282',
  },
} as const satisfies Record<string, ColorPalette>

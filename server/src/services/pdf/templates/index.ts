export { ModernClean } from './modern-clean'
export { DarkElegant } from './dark-elegant'
export { CleanMinimal } from './clean-minimal'
export { WaveAccent } from './wave-accent'

// Template registry for dynamic selection
export const templates = {
  'modern-clean': 'ModernClean',
  'dark-elegant': 'DarkElegant',
  'clean-minimal': 'CleanMinimal',
  'wave-accent': 'WaveAccent',
} as const

export type TemplateId = keyof typeof templates

export { ModernClean } from './modern-clean'
export { DarkElegant } from './dark-elegant'
export { CleanMinimal } from './clean-minimal'
export { WaveAccent } from './wave-accent'
export { AcademicFormal } from './academic-formal'
export { CorporateProfessional } from './corporate-professional'
export { CreativeArtistic } from './creative-artistic'
export { TechDigital } from './tech-digital'
export { EventAchievement } from './event-achievement'

// Template registry for dynamic selection
export const templates = {
  'modern-clean': 'ModernClean',
  'dark-elegant': 'DarkElegant',
  'clean-minimal': 'CleanMinimal',
  'wave-accent': 'WaveAccent',
  'academic-formal': 'AcademicFormal',
  'corporate-professional': 'CorporateProfessional',
  'creative-artistic': 'CreativeArtistic',
  'tech-digital': 'TechDigital',
  'event-achievement': 'EventAchievement',
} as const

export type TemplateId = keyof typeof templates

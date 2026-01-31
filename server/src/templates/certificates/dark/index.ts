// Dark premium certificate templates
export { galaxyNightTemplate, renderGalaxyNight } from './galaxy-night'
export { navyGoldTemplate, renderNavyGold } from './navy-gold'
export { techCyanTemplate, renderTechCyan } from './tech-cyan'

// Re-export all templates as a collection
import { galaxyNightTemplate, renderGalaxyNight } from './galaxy-night'
import { navyGoldTemplate, renderNavyGold } from './navy-gold'
import { techCyanTemplate, renderTechCyan } from './tech-cyan'
import { registerTemplate } from '../../../services/certificate-templates'

export const darkTemplates = [
  galaxyNightTemplate,
  navyGoldTemplate,
  techCyanTemplate,
]

export function registerDarkTemplates(): void {
  registerTemplate(galaxyNightTemplate, renderGalaxyNight)
  registerTemplate(navyGoldTemplate, renderNavyGold)
  registerTemplate(techCyanTemplate, renderTechCyan)
}

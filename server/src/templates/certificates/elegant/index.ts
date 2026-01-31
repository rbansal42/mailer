import { registerTemplate } from '../../../services/certificate-templates'

import { pinkWatercolorTemplate, render as renderPinkWatercolor } from './pink-watercolor'
import { lavenderFloralTemplate, render as renderLavenderFloral } from './lavender-floral'
import { creamClassicTemplate, render as renderCreamClassic } from './cream-classic'

// Register all elegant templates
export function registerElegantTemplates(): void {
  registerTemplate(pinkWatercolorTemplate, renderPinkWatercolor)
  registerTemplate(lavenderFloralTemplate, renderLavenderFloral)
  registerTemplate(creamClassicTemplate, renderCreamClassic)
}

// Export individual templates and renderers for direct access
export {
  pinkWatercolorTemplate,
  renderPinkWatercolor,
  lavenderFloralTemplate,
  renderLavenderFloral,
  creamClassicTemplate,
  renderCreamClassic,
}

// Export all template metadata
export const elegantTemplates = [
  pinkWatercolorTemplate,
  lavenderFloralTemplate,
  creamClassicTemplate,
]

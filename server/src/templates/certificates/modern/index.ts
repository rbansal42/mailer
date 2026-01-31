import { registerTemplate } from '../../../services/certificate-templates'
import { abhigyaanTemplate, renderAbhigyaan } from './abhigyaan'
import { geometricPurpleTemplate, renderGeometricPurple } from './geometric-purple'
import { tealMedicalTemplate, renderTealMedical } from './teal-medical'

// Export templates for direct access
export { abhigyaanTemplate, renderAbhigyaan } from './abhigyaan'
export { geometricPurpleTemplate, renderGeometricPurple } from './geometric-purple'
export { tealMedicalTemplate, renderTealMedical } from './teal-medical'

// Register all modern templates
export function registerModernTemplates(): void {
  registerTemplate(abhigyaanTemplate, renderAbhigyaan)
  registerTemplate(geometricPurpleTemplate, renderGeometricPurple)
  registerTemplate(tealMedicalTemplate, renderTealMedical)
}

import { registerTemplate } from '../../../services/certificate-templates'
import { whiteModernTemplate, renderWhiteModern } from './white-modern'
import { blueGeometricTemplate, renderBlueGeometric } from './blue-geometric'
import { gradientWaveTemplate, renderGradientWave } from './gradient-wave'

// Register all minimal templates
export function registerMinimalTemplates(): void {
  registerTemplate(whiteModernTemplate, renderWhiteModern)
  registerTemplate(blueGeometricTemplate, renderBlueGeometric)
  registerTemplate(gradientWaveTemplate, renderGradientWave)
}

// Export individual templates for direct access
export { whiteModernTemplate, renderWhiteModern } from './white-modern'
export { blueGeometricTemplate, renderBlueGeometric } from './blue-geometric'
export { gradientWaveTemplate, renderGradientWave } from './gradient-wave'

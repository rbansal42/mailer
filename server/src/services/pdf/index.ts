// React PDF Generator
export {
  generateReactPdf,
  generateCertificateId,
  isReactPdfTemplate,
  getReactPdfTemplateIds,
  type CertificateProps,
} from './generator'

// Templates
export {
  ModernClean,
  DarkElegant,
  CleanMinimal,
  WaveAccent,
  templates,
  type TemplateId,
} from './templates'

// Components (for custom template composition)
export { Certificate, LogoBar, Signatories } from './components'

// Styles (for custom template styling)
export { colors, typography, baseStyles, getNameFontSize } from './styles'

// Worker Pool for parallel PDF generation
export {
  PdfWorkerPool,
  getPdfWorkerPool,
  shutdownPdfWorkerPool,
  type PoolStats,
} from './worker-pool'

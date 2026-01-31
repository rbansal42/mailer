import { registerModernTemplates } from './modern'
import { registerDarkTemplates } from './dark'
import { registerElegantTemplates } from './elegant'
import { registerMinimalTemplates } from './minimal'

export function registerAllTemplates(): void {
  registerModernTemplates()
  registerDarkTemplates()
  registerElegantTemplates()
  registerMinimalTemplates()
}

// Re-export for convenience
export * from './modern'
export * from './dark'
export * from './elegant'
export * from './minimal'

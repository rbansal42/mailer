# React-PDF Migration Plan

## Overview
Migrate certificate PDF generation from Puppeteer to @react-pdf/renderer for better reliability and unified preview/generation.

## Decisions
- **Preview**: Unified React with PDFViewer component
- **Design Style**: Elegant Minimal (clean typography, subtle borders, solid colors)
- **Templates**: 4 initial (modern-clean, dark-elegant, clean-minimal, wave-accent)
- **Puppeteer**: Remove entirely

## Phases

### Phase 1: Setup & Infrastructure
**Tasks (can run in parallel):**
1. Install dependencies (`@react-pdf/renderer`)
2. Download and add font files
3. Create directory structure

### Phase 2: Core Components
**Tasks (can run in parallel):**
1. Font registration module (`fonts.ts`)
2. Shared styles (`styles.ts`)
3. Base Certificate component
4. LogoBar component
5. Signatories component

### Phase 3: Templates
**Tasks (can run in parallel):**
1. modern-clean.tsx (abhigyaan replacement)
2. dark-elegant.tsx (galaxy-night replacement)
3. clean-minimal.tsx (white-modern replacement)
4. wave-accent.tsx (gradient-wave replacement)

### Phase 4: Integration
**Tasks (sequential):**
1. Create generator service
2. Update certificate routes
3. Update frontend with PDFViewer

### Phase 5: Cleanup
**Tasks:**
1. Remove Puppeteer dependency
2. Remove old HTML templates
3. Update documentation

## File Structure

```
server/src/services/pdf/
├── index.ts              # Main exports
├── generator.ts          # renderToBuffer wrapper
├── fonts.ts              # Font.register calls
├── styles.ts             # Shared StyleSheet
├── components/
│   ├── Certificate.tsx   # Base wrapper
│   ├── LogoBar.tsx
│   ├── Signatories.tsx
│   └── index.ts
└── templates/
    ├── index.ts          # Template registry
    ├── modern-clean.tsx
    ├── dark-elegant.tsx
    ├── clean-minimal.tsx
    └── wave-accent.tsx

server/assets/fonts/
├── Montserrat-Regular.ttf
├── Montserrat-Bold.ttf
├── Montserrat-SemiBold.ttf
├── GreatVibes-Regular.ttf
├── PlayfairDisplay-Regular.ttf
└── PlayfairDisplay-Bold.ttf
```

## Template Designs

### modern-clean (replaces abhigyaan)
- Double border (outer solid, inner subtle)
- Accent color bar at bottom
- Solid primary color for title
- Clean typography hierarchy

### dark-elegant (replaces galaxy-night)
- Dark slate background (#1e293b)
- Gold accent color (#fbbf24)
- White text for content
- Dashed inner border

### clean-minimal (replaces white-modern)
- White background
- Single accent line at bottom
- Generous whitespace
- Subtle gray secondary text

### wave-accent (replaces gradient-wave)
- Layered solid color bars at bottom
- Primary + secondary + accent layers
- Clean content area above

# More Templates Design Document

**Date:** 2026-02-02  
**Status:** Approved  
**Goal:** Expand template library with 5 certificate PDF templates and 16 email templates

## Overview

This design adds comprehensive template coverage for both certificate generation and email campaigns, enabling users to find suitable starting points for most common use cases.

## Certificate PDF Templates (5 new)

Each template is a React component using `@react-pdf/renderer`, following the existing pattern in `server/src/services/pdf/templates/`.

### 1. Academic/Formal (`academic-formal`)

Classic diploma aesthetic for educational institutions and formal certifications.

**Visual Elements:**
- Thick ornate double border with corner flourishes (SVG paths)
- Serif typography (Playfair Display for titles)
- Parchment-tinted background (`#faf7f0`)
- Optional seal/emblem placeholder in bottom corner
- Horizontal decorative line separators between sections
- Formal signature block with "Authorized Signature" labels

**Color Palette:**
- Primary: `#1a365d` (deep navy)
- Secondary: `#4a5568` (slate gray)
- Accent: `#b7791f` (gold/bronze)
- Background: `#faf7f0` (parchment)

### 2. Corporate/Professional (`corporate-professional`)

Clean business look for corporate training, professional certifications.

**Visual Elements:**
- Single-color accent bar across top (10px height)
- Company logo prominently placed top-center
- Sans-serif throughout (Inter)
- Gray horizontal rule under title
- Two-column signatory layout for multiple signers
- Clean footer with certificate ID and date

**Color Palette:**
- Primary: `#1e40af` (corporate blue)
- Secondary: `#374151` (gray)
- Accent: `#1e40af` (matches primary)

### 3. Creative/Artistic (`creative-artistic`)

Colorful and modern for workshops, art courses, creative programs.

**Visual Elements:**
- Asymmetric layout with large abstract shape in corner
- Bold, playful typography mixing weights
- Gradient-capable accent colors (simulated with overlapping shapes)
- Recipient name in oversized display font
- Minimal borders, relying on color and shape for visual interest

**Color Palette:**
- Primary: `#7c3aed` (purple)
- Secondary: `#ec4899` (pink)
- Accent: `#f59e0b` (amber)

### 4. Tech/Digital (`tech-digital`)

Developer certification aesthetic for tech training, coding bootcamps.

**Visual Elements:**
- Dark mode background (`#0f172a`)
- Monospace font for certificate ID
- Code-bracket decorative elements `{ }` as SVG
- Cyan/green tech accent colors
- Subtle grid pattern in background
- QR code placeholder for verification URL

**Color Palette:**
- Primary: `#22d3ee` (cyan)
- Secondary: `#94a3b8` (slate)
- Accent: `#10b981` (emerald green)
- Background: `#0f172a` (dark slate)

### 5. Event/Achievement (`event-achievement`)

Celebratory award style for competitions, achievements, participation.

**Visual Elements:**
- Ribbon/badge graphic at top center (SVG)
- Star or laurel decorative elements
- Bold "CERTIFICATE OF ACHIEVEMENT" header
- Gold/bronze/silver color variants
- Trophy/podium subtle watermark
- Emphasis on achievement title

**Color Palette:**
- Primary: `#b45309` (bronze/gold)
- Secondary: `#1f2937` (dark gray)
- Accent: `#fbbf24` (bright gold)

---

## Email Templates (16 new)

All templates use the existing block system with `is_default=1` flag. Added to `seedDefaultTemplates()` in `server/src/db/index.ts`.

### Transactional (4)

| ID | Name | Description |
|----|------|-------------|
| 1 | Order Confirmation | Order summary with items, total, shipping address, track button |
| 2 | Shipping Update | Tracking number, carrier, estimated delivery, track package button |
| 3 | Password Reset | Security-focused, single CTA, expiry notice, "didn't request" text |
| 4 | Receipt/Invoice | Formal invoice layout with line items, subtotal, tax, total |

### Re-engagement (3)

| ID | Name | Description |
|----|------|-------------|
| 5 | We Miss You | Friendly win-back with value reminder and soft CTA |
| 6 | Inactive Warning | Account deactivation warning with deadline and keep-active CTA |
| 7 | Win-back Offer | Promotional discount to encourage return |

### Survey/Feedback (3)

| ID | Name | Description |
|----|------|-------------|
| 8 | Feedback Request | Star rating visual with submit button |
| 9 | NPS Survey | 0-10 scale horizontal layout |
| 10 | Review Request | Product focus with external review platform CTA |

### Onboarding (3)

| ID | Name | Description |
|----|------|-------------|
| 11 | Welcome Day 1 | Quick wins, get started CTA, support contact |
| 12 | Feature Highlight Day 3 | Single feature focus with try-it button |
| 13 | Tips & Tricks Day 7 | Pro tips list with explore-more CTA |

### Holiday/Seasonal (3)

| ID | Name | Description |
|----|------|-------------|
| 14 | Holiday Greeting | Warm message, optional team photo, gratitude |
| 15 | New Year | Fresh start energy, coming-soon preview |
| 16 | Year in Review | Stats/metrics, personalized highlights, Wrapped-style |

---

## Implementation Approach

### Certificate Templates

1. Create new `.tsx` file in `server/src/services/pdf/templates/`
2. Export component following existing props interface
3. Register in `server/src/services/pdf/templates/index.ts`
4. Add to templates registry

### Email Templates

1. Add template objects to `defaultTemplates` array in `seedDefaultTemplates()`
2. Each template needs: `name`, `description`, `blocks[]`
3. Blocks use existing types: `header`, `text`, `image`, `button`, `divider`, `spacer`, `footer`

---

## Phases

| Phase | Templates | Agents |
|-------|-----------|--------|
| 1 | 5 certificate PDF templates | 5 |
| 2 | 4 Transactional + 3 Re-engagement emails | 7 |
| 3 | 3 Survey + 3 Onboarding emails | 6 |
| 4 | 3 Holiday/Seasonal emails | 3 |

Each phase follows: Implement -> Commit -> Code Review -> Fix -> Push -> PR -> Merge

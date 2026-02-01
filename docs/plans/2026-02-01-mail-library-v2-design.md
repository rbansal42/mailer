# Mail Library v2 Design

## Overview

Enhance the mailer's template system with three major features:
1. Rich text editor with full formatting
2. Image editing with object-fit and crop controls
3. Reorganize into "Mails" (saved designs) and "Templates" (reusable starters)

## Feature 1: Rich Text Editor

### Library Choice: TipTap

TipTap is built on ProseMirror, has excellent React integration, and outputs clean HTML.

### Features

- Bold, italic, underline, strikethrough
- Links (with URL input)
- Headings (H1, H2, H3)
- Lists (bullet, numbered)
- Text alignment (left, center, right)
- Text color picker
- Highlight/background color
- Font size (small, normal, large)
- Blockquotes

### Toolbar Approach

- Floating bubble menu on text selection for inline formatting
- Fixed toolbar at top for block-level formatting (headings, lists, alignment)

### HTML Handling

- TipTap outputs clean HTML
- Sanitize with DOMPurify before saving
- `template-compiler.ts` passes through sanitized HTML
- Preview uses `dangerouslySetInnerHTML` with sanitized content

### Migration

Existing text blocks with plain text render as unformatted paragraphs - no migration needed.

---

## Feature 2: Image Editing

### Object-Fit Options

Added to image block properties:
- `contain` - Show whole image, may have letterboxing
- `cover` - Fill container, may crop edges  
- `fill` - Stretch to fill (distorts if aspect ratio differs)

### Manual Crop Tool

- Use `react-image-crop` library
- Click "Crop" on image block → opens modal with crop UI
- User drags to select crop area
- Save crop coordinates to block props: `cropX`, `cropY`, `cropWidth`, `cropHeight`
- Apply crop when rendering preview and compiling email

### Location

Crop tool lives in template editor only (not media library). Same image can have different crops in different templates.

---

## Feature 3: Mails vs Templates Organization

### Database Schema

```sql
-- Existing templates table (repurposed for reusable templates)
-- Add is_default column for built-in starter templates
ALTER TABLE templates ADD COLUMN is_default BOOLEAN DEFAULT 0;

-- New mails table
CREATE TABLE mails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  blocks TEXT NOT NULL DEFAULT '[]',
  template_id INTEGER,
  campaign_id INTEGER,
  status TEXT DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);
```

### UI Changes

- Rename "Templates" page to "Mail Library"
- Two tabs: **Mails** | **Templates**
- **Mails tab**: Shows saved mail designs (drafts + sent)
- **Templates tab**: Shows reusable starter templates

### Workflows

| Action | Flow |
|--------|------|
| Create new mail | "New Mail" → Choose template (or blank) → Editor → Save to Mails |
| Save as Template | From editor, "Save as Template" → Copies to templates |
| Edit template | Opens in editor, saves to templates table |
| Start campaign | Pick from Mails library |

### Migration

Existing templates become mails. Add a few built-in starter templates.

---

## Implementation Phases

### Phase 1: Rich Text Editor
Replace textarea with TipTap, add all formatting features, update template compiler.

### Phase 2: Image Editing  
Add object-fit dropdown, implement crop modal with react-image-crop.

### Phase 3: Mails vs Templates
Database migration, API routes, UI tabs, workflows.

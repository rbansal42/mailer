# Email Templates Library Design

## Overview

Add pre-built email templates that users can choose from when creating campaigns. Templates are professionally designed starting points for common email types.

## Template Categories

1. **Newsletter** - Multi-section content layout
2. **Announcement** - Single-focus message with CTA
3. **Welcome** - Onboarding/welcome email
4. **Promotion** - Sale/discount focused
5. **Event Invite** - Date, time, location focused

## Implementation

### Approach: Seed Default Templates

Add built-in templates to the existing `templates` table with `is_default = true`. These are read-only and cannot be deleted by users.

### Template Structure

Each template consists of blocks (existing Block type):
- header (logo, title)
- text (body content with merge fields)
- button (CTA)
- image (hero image)
- divider
- footer

### Default Templates Data

Templates will be seeded in `server/src/db/index.ts` with the `seedDefaultTemplates()` function.

## Features

1. **View Templates** - Existing Templates page shows default + user templates
2. **Use Template** - Select template when creating new campaign
3. **Clone Template** - Copy default template to edit (already exists as "Save as Template")
4. **Cannot Delete Default** - Prevent deletion of is_default templates

## UI Changes

1. Templates page shows badge for "Built-in" templates
2. Filter to show "All" / "Built-in" / "Custom"
3. Default templates have lock icon, no delete button

## Files to Modify

- `server/src/db/index.ts` - Seed default templates
- `server/src/routes/templates.ts` - Prevent delete of defaults
- `frontend/src/pages/Templates.tsx` - Show badges, filter, hide delete

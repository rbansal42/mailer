# Mailer Lists - Design Document

**Date:** 2026-02-01  
**Status:** Approved

## Overview

Add ability to create and manage reusable contact lists for email campaigns. Includes a table view UI for managing contacts and integration with the campaign composer.

## Goals

1. **Recurring audiences** - Save contact lists for reuse across campaigns
2. **List management** - Add/remove contacts, import/export CSV
3. **Table view UI** - Readable, user-friendly contact management
4. **Simplified campaign composer** - Pick a list instead of pasting CSV

## Data Model

### Contacts Table

Central contact storage with standardized fields. Contacts are deduplicated by email across the entire system.

```sql
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  phone TEXT,
  country TEXT,
  custom_fields TEXT DEFAULT '{}',  -- JSON key/value pairs
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Lists Table

Named collections of contacts.

```sql
CREATE TABLE lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### List Memberships (Junction Table)

Many-to-many relationship between lists and contacts.

```sql
CREATE TABLE list_contacts (
  list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (list_id, contact_id)
);
```

### Key Behaviors

- Contacts are deduplicated by email globally
- A contact can belong to multiple lists
- Importing CSV with existing email upserts (updates) that contact
- Custom fields stored as JSON for flexibility
- Deleting a list removes memberships but keeps contacts
- Deleting a contact removes all its list memberships

## API Endpoints

### Lists

```
GET    /api/contacts/lists              - List all lists (with contact counts)
POST   /api/contacts/lists              - Create new list
GET    /api/contacts/lists/:id          - Get list details
PUT    /api/contacts/lists/:id          - Update list name/description
DELETE /api/contacts/lists/:id          - Delete list
```

### List Members

```
GET    /api/contacts/lists/:id/members         - Get contacts in list (paginated)
POST   /api/contacts/lists/:id/members         - Add contacts to list (upsert)
DELETE /api/contacts/lists/:id/members/:cid    - Remove contact from list
POST   /api/contacts/lists/:id/import          - Import CSV with column mapping
GET    /api/contacts/lists/:id/export          - Export list as CSV
```

### Contacts (Global)

```
GET    /api/contacts                    - List all contacts (paginated)
GET    /api/contacts/:id                - Get contact with list memberships
PUT    /api/contacts/:id                - Update contact fields
DELETE /api/contacts/:id                - Delete contact entirely
```

### Campaign Integration

- `POST /api/send` accepts `list_id` OR `recipients[]` (for one-off)
- Draft endpoints store `list_id` when a list is selected

## UI Design

### New Page: `/lists`

Accessible from sidebar navigation.

#### List Index View

| Column | Description |
|--------|-------------|
| Name | List name (clickable) |
| Description | Optional description |
| Contacts | Contact count |
| Created | Creation date |
| Actions | Edit, Delete, Export |

- Search/filter by name
- "Create List" button

#### List Detail View

**Header:**
- List name (editable inline)
- Description (editable inline)
- Contact count

**Contacts Table:**

| Column | Description |
|--------|-------------|
| Checkbox | For bulk selection |
| Email | Contact email |
| Name | Full name |
| Company | Company name |
| Phone | Phone number |
| Country | Country |
| Actions | Edit, Remove |

Custom fields appear as additional columns.

**Toolbar:**
- Add contacts (manual or import)
- Bulk actions: Remove selected, Export selected
- Search within list

#### Import Modal

1. CSV file upload or paste textarea
2. Column mapping preview (auto-detect standard fields)
3. Preview: "X new contacts, Y existing (will update)"
4. Confirm button

#### Contact Edit

- Slide-out panel or modal
- Form with standard fields
- Custom fields as editable key/value pairs
- Changes apply globally (all lists)

### Campaign Composer Changes

**List Picker:**
- Replaces textarea as primary input
- Dropdown/combobox to select a list
- Shows list name + contact count
- "Preview recipients" button opens table modal

**One-Off Paste:**
- Link: "Or paste recipients manually"
- Reveals familiar textarea
- After valid paste, prompt: "Save these X contacts as a new list?"
  - Yes → name modal → saves and auto-selects
  - No → one-off send (not persisted)

**Variable Substitution:**
- Works same as today: `{{name}}`, `{{company}}`, etc.
- Custom fields available as variables
- Preview shows available variables from selected list

**Draft Saving:**
- Drafts store `list_id` when list selected
- One-off recipients stored as JSON (backward compatible)

## Migration Notes

- Existing drafts with `recipients` JSON continue to work
- No migration of existing data needed
- New tables created on startup

## Out of Scope (Future)

- Filter-based dynamic segments
- Behavioral segmentation (opens/clicks)
- Folders/groups for organizing lists
- Contact merge/deduplication tools
- Subscription/unsubscribe management

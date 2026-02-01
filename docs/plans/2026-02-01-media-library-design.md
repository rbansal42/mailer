# Media Library for Email Templates

## Overview

Add ability to upload images from system for email templates via a global media library. Images are uploaded to Uploadthing and stored with metadata in SQLite.

## Architecture

### New Components

```
Frontend:
├── components/
│   └── media-library/
│       ├── MediaLibrarySidebar.tsx   # Collapsible sidebar panel
│       ├── MediaGrid.tsx             # Gallery grid of images
│       ├── MediaUploader.tsx         # Uploadthing drop zone
│       └── MediaItem.tsx             # Single image card with actions

Server:
├── routes/
│   └── media.ts                      # CRUD API for media records
├── lib/
│   └── uploadthing.ts                # Uploadthing server config
├── db/
│   └── migrations/
│       └── 001_create_media_table.sql
```

### Data Flow

1. User opens template editor → sidebar shows media library
2. User drops/selects file → Uploadthing React SDK uploads directly to cloud
3. On upload complete → frontend calls `POST /api/media` to save record in SQLite
4. User clicks image → URL inserted into block's `url` or `imageUrl` prop
5. Soft delete → sets `deleted_at` timestamp, hides from library, URL keeps working

### Database Schema

```sql
CREATE TABLE media (
  id TEXT PRIMARY KEY,
  uploadthing_key TEXT NOT NULL,    -- Uploadthing file key
  url TEXT NOT NULL,                 -- Public URL from Uploadthing
  filename TEXT NOT NULL,            -- Original filename
  alt_text TEXT DEFAULT '',          -- User-editable alt text
  size_bytes INTEGER,                -- File size for display
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT DEFAULT NULL       -- Soft delete timestamp
);
```

## Uploadthing Integration

### Server Setup

```typescript
// server/src/lib/uploadthing.ts
import { createUploadthing } from "uploadthing/express";

const f = createUploadthing();

export const uploadRouter = {
  mediaUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .onUploadComplete(({ file }) => {
      return { url: file.url, key: file.key, name: file.name, size: file.size };
    }),
};
```

### Express Route

```typescript
// server/src/routes/uploadthing.ts
import { createRouteHandler } from "uploadthing/express";
import { uploadRouter } from "../lib/uploadthing";

export const uploadthingHandler = createRouteHandler({ router: uploadRouter });
```

### Frontend Setup

```typescript
// frontend/src/lib/uploadthing.ts
import { generateReactHelpers } from "@uploadthing/react";

export const { useUploadThing, uploadFiles } = generateReactHelpers({
  url: "/api/uploadthing",
});
```

### Environment

```bash
UPLOADTHING_TOKEN='...'  # Server-side only
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/media` | List all non-deleted media |
| GET | `/api/media?deleted=true` | List soft-deleted media |
| GET | `/api/media/:id` | Get single media item |
| POST | `/api/media` | Create record after Uploadthing upload |
| PATCH | `/api/media/:id` | Update filename/alt_text |
| DELETE | `/api/media/:id` | Soft delete (set deleted_at) |
| POST | `/api/media/:id/restore` | Restore soft-deleted item |
| GET | `/api/media/:id/usage` | Get templates using this image |

## UI Design

### Sidebar Panel

- Collapsible panel on right side of template editor
- Header: "Media Library" + collapse button
- Tabs: "Library" | "Deleted"
- Search/filter input at top

### Media Grid

- Responsive grid of image thumbnails
- Each item shows: thumbnail, filename, size
- Hover: overlay with Select/Edit/Delete buttons
- Empty state: "No images yet"

### Media Uploader

- Uploadthing drop zone at top
- "Drop image or click to upload"
- Progress indicator
- Accepts: jpg, png, gif, webp

### Selection Flow

1. User editing image/header block
2. Block properties shows URL + "Browse Media" button
3. Click → sidebar opens with selection mode
4. Click image → URL populated into block prop

## Reference Tracking

```typescript
// Scan template blocks for URL matches
const templates = db.query("SELECT id, name, blocks FROM templates").all();
const usage = templates.filter(t => {
  const blocks = JSON.parse(t.blocks);
  return blocks.some(b => 
    b.props?.url === mediaUrl || b.props?.imageUrl === mediaUrl
  );
});
```

## Decisions

- **Global media library** - shared across all templates
- **Frontend direct upload** - faster, Uploadthing handles auth
- **Simple media table** - no junction table, reference tracking via URL scan
- **Soft delete** - hide from library but keep URLs working

# Media Library Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a global media library with Uploadthing integration for uploading and managing images in email templates.

**Architecture:** Frontend sidebar panel with Uploadthing React SDK for direct browser-to-cloud uploads. Express backend stores metadata in SQLite. Soft delete preserves URLs while hiding from library.

**Tech Stack:** Bun, React, Uploadthing (@uploadthing/react, uploadthing), Express, SQLite, TailwindCSS, shadcn/ui

---

## Phase 1: Backend Foundation

### Task 1.1: Create Database Migration

**Files:**
- Create: `server/src/db/migrations/001_create_media_table.sql`
- Modify: `server/src/db/index.ts`

**Step 1: Create migration file**

Create `server/src/db/migrations/001_create_media_table.sql`:

```sql
-- Media library table for uploaded images
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  uploadthing_key TEXT NOT NULL,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  alt_text TEXT DEFAULT '',
  size_bytes INTEGER,
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT DEFAULT NULL
);

-- Index for listing non-deleted media
CREATE INDEX IF NOT EXISTS idx_media_deleted_at ON media(deleted_at);
```

**Step 2: Add migration runner to db/index.ts**

Add migration runner function that reads and executes SQL files from `migrations/` directory on startup. Check if table exists before running.

**Step 3: Verify migration runs**

Run: `bun run dev` (briefly) and check that media table exists.

**Step 4: Commit**

```bash
git add server/src/db/migrations/ server/src/db/index.ts
git commit -m "feat(db): add media table migration"
```

---

### Task 1.2: Install Uploadthing Dependencies

**Files:**
- Modify: `server/package.json`

**Step 1: Install server dependencies**

```bash
cd server && bun add uploadthing
```

**Step 2: Commit**

```bash
git add server/package.json server/bun.lockb
git commit -m "chore: add uploadthing server dependency"
```

---

### Task 1.3: Create Uploadthing Server Configuration

**Files:**
- Create: `server/src/lib/uploadthing.ts`
- Create: `server/src/routes/uploadthing.ts`
- Modify: `server/src/index.ts`

**Step 1: Create uploadthing config**

Create `server/src/lib/uploadthing.ts`:

```typescript
import { createUploadthing, type FileRouter } from "uploadthing/express";

const f = createUploadthing();

export const uploadRouter = {
  mediaUploader: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  }).onUploadComplete(({ file }) => {
    console.log("Upload complete:", file.name);
    return {
      url: file.ufsUrl,
      key: file.key,
      name: file.name,
      size: file.size,
    };
  }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
```

**Step 2: Create uploadthing route handler**

Create `server/src/routes/uploadthing.ts`:

```typescript
import { createRouteHandler } from "uploadthing/express";
import { uploadRouter } from "../lib/uploadthing";

export const { GET: uploadthingGet, POST: uploadthingPost } = createRouteHandler({
  router: uploadRouter,
});
```

**Step 3: Mount routes in index.ts**

Add to `server/src/index.ts`:

```typescript
import { uploadthingGet, uploadthingPost } from "./routes/uploadthing";

// Mount uploadthing routes
app.get("/api/uploadthing", uploadthingGet);
app.post("/api/uploadthing", uploadthingPost);
```

**Step 4: Add UPLOADTHING_TOKEN to .env.example**

Add `UPLOADTHING_TOKEN=` to `.env.example` if it exists, or document in README.

**Step 5: Commit**

```bash
git add server/src/lib/uploadthing.ts server/src/routes/uploadthing.ts server/src/index.ts
git commit -m "feat(api): add uploadthing route handler"
```

---

### Task 1.4: Create Media API Routes

**Files:**
- Create: `server/src/routes/media.ts`
- Modify: `server/src/index.ts`

**Step 1: Create media routes**

Create `server/src/routes/media.ts`:

```typescript
import { Router } from "express";
import { db } from "../db";
import { nanoid } from "nanoid";

const router = Router();

// List media (with optional deleted filter)
router.get("/", (req, res) => {
  const showDeleted = req.query.deleted === "true";
  
  const query = showDeleted
    ? "SELECT * FROM media WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"
    : "SELECT * FROM media WHERE deleted_at IS NULL ORDER BY uploaded_at DESC";
  
  const media = db.query(query).all();
  res.json(media);
});

// Get single media item
router.get("/:id", (req, res) => {
  const media = db.query("SELECT * FROM media WHERE id = ?").get(req.params.id);
  if (!media) {
    return res.status(404).json({ error: "Media not found" });
  }
  res.json(media);
});

// Create media record (after Uploadthing upload)
router.post("/", (req, res) => {
  const { uploadthing_key, url, filename, size_bytes } = req.body;
  
  if (!uploadthing_key || !url || !filename) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  const id = nanoid();
  db.run(
    `INSERT INTO media (id, uploadthing_key, url, filename, size_bytes) 
     VALUES (?, ?, ?, ?, ?)`,
    [id, uploadthing_key, url, filename, size_bytes || null]
  );
  
  const media = db.query("SELECT * FROM media WHERE id = ?").get(id);
  res.status(201).json(media);
});

// Update media (filename, alt_text)
router.patch("/:id", (req, res) => {
  const { filename, alt_text } = req.body;
  const media = db.query("SELECT * FROM media WHERE id = ?").get(req.params.id);
  
  if (!media) {
    return res.status(404).json({ error: "Media not found" });
  }
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (filename !== undefined) {
    updates.push("filename = ?");
    values.push(filename);
  }
  if (alt_text !== undefined) {
    updates.push("alt_text = ?");
    values.push(alt_text);
  }
  
  if (updates.length > 0) {
    values.push(req.params.id);
    db.run(`UPDATE media SET ${updates.join(", ")} WHERE id = ?`, values);
  }
  
  const updated = db.query("SELECT * FROM media WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// Soft delete
router.delete("/:id", (req, res) => {
  const media = db.query("SELECT * FROM media WHERE id = ?").get(req.params.id);
  
  if (!media) {
    return res.status(404).json({ error: "Media not found" });
  }
  
  db.run(
    "UPDATE media SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
    [req.params.id]
  );
  
  res.status(204).send();
});

// Restore soft-deleted item
router.post("/:id/restore", (req, res) => {
  const media = db.query("SELECT * FROM media WHERE id = ?").get(req.params.id);
  
  if (!media) {
    return res.status(404).json({ error: "Media not found" });
  }
  
  db.run("UPDATE media SET deleted_at = NULL WHERE id = ?", [req.params.id]);
  
  const restored = db.query("SELECT * FROM media WHERE id = ?").get(req.params.id);
  res.json(restored);
});

// Get usage (which templates use this image)
router.get("/:id/usage", (req, res) => {
  const media = db.query("SELECT * FROM media WHERE id = ?").get(req.params.id) as { url: string } | null;
  
  if (!media) {
    return res.status(404).json({ error: "Media not found" });
  }
  
  const templates = db.query("SELECT id, name, blocks FROM templates").all() as Array<{
    id: string;
    name: string;
    blocks: string;
  }>;
  
  const usage = templates.filter((t) => {
    try {
      const blocks = JSON.parse(t.blocks);
      return blocks.some((b: any) => 
        b.props?.url === media.url || b.props?.imageUrl === media.url
      );
    } catch {
      return false;
    }
  }).map((t) => ({ id: t.id, name: t.name }));
  
  res.json(usage);
});

export default router;
```

**Step 2: Mount in index.ts**

Add to `server/src/index.ts`:

```typescript
import mediaRoutes from "./routes/media";

app.use("/api/media", mediaRoutes);
```

**Step 3: Commit**

```bash
git add server/src/routes/media.ts server/src/index.ts
git commit -m "feat(api): add media CRUD routes"
```

---

## Phase 2: Frontend Foundation

### Task 2.1: Install Frontend Uploadthing Dependencies

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install dependencies**

```bash
cd frontend && bun add @uploadthing/react uploadthing
```

**Step 2: Commit**

```bash
git add frontend/package.json frontend/bun.lockb
git commit -m "chore: add uploadthing frontend dependencies"
```

---

### Task 2.2: Create Frontend Uploadthing Config

**Files:**
- Create: `frontend/src/lib/uploadthing.ts`

**Step 1: Create uploadthing helpers**

Create `frontend/src/lib/uploadthing.ts`:

```typescript
import { generateReactHelpers } from "@uploadthing/react";
import type { UploadRouter } from "../../../server/src/lib/uploadthing";

export const { useUploadThing, uploadFiles } = generateReactHelpers<UploadRouter>({
  url: "/api/uploadthing",
});
```

**Step 2: Commit**

```bash
git add frontend/src/lib/uploadthing.ts
git commit -m "feat(frontend): add uploadthing react helpers"
```

---

### Task 2.3: Add Media Types to API Client

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add Media interface and API methods**

Add to `frontend/src/lib/api.ts`:

```typescript
export interface Media {
  id: string;
  uploadthing_key: string;
  url: string;
  filename: string;
  alt_text: string;
  size_bytes: number | null;
  uploaded_at: string;
  deleted_at: string | null;
}

export interface MediaUsage {
  id: string;
  name: string;
}

// Media API
export async function getMedia(showDeleted = false): Promise<Media[]> {
  const url = showDeleted ? "/api/media?deleted=true" : "/api/media";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch media");
  return res.json();
}

export async function createMedia(data: {
  uploadthing_key: string;
  url: string;
  filename: string;
  size_bytes?: number;
}): Promise<Media> {
  const res = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create media");
  return res.json();
}

export async function updateMedia(
  id: string,
  data: { filename?: string; alt_text?: string }
): Promise<Media> {
  const res = await fetch(`/api/media/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update media");
  return res.json();
}

export async function deleteMedia(id: string): Promise<void> {
  const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete media");
}

export async function restoreMedia(id: string): Promise<Media> {
  const res = await fetch(`/api/media/${id}/restore`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to restore media");
  return res.json();
}

export async function getMediaUsage(id: string): Promise<MediaUsage[]> {
  const res = await fetch(`/api/media/${id}/usage`);
  if (!res.ok) throw new Error("Failed to get media usage");
  return res.json();
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): add media API client methods"
```

---

## Phase 3: Media Library UI Components

### Task 3.1: Create MediaUploader Component

**Files:**
- Create: `frontend/src/components/media-library/MediaUploader.tsx`

**Step 1: Create uploader component**

Create `frontend/src/components/media-library/MediaUploader.tsx`:

```tsx
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2 } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing";
import { createMedia } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MediaUploaderProps {
  onUploadComplete: () => void;
}

export function MediaUploader({ onUploadComplete }: MediaUploaderProps) {
  const { startUpload, isUploading } = useUploadThing("mediaUploader", {
    onClientUploadComplete: async (res) => {
      if (res?.[0]) {
        const file = res[0];
        await createMedia({
          uploadthing_key: file.key,
          url: file.ufsUrl,
          filename: file.name,
          size_bytes: file.size,
        });
        onUploadComplete();
      }
    },
    onUploadError: (error) => {
      console.error("Upload error:", error);
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        startUpload(acceptedFiles);
      }
    },
    [startUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/gif": [".gif"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50",
        isUploading && "opacity-50 cursor-not-allowed"
      )}
    >
      <input {...getInputProps()} />
      {isUploading ? (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Uploading...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Upload className="h-6 w-6" />
          <span className="text-sm">
            {isDragActive ? "Drop image here" : "Drop image or click to upload"}
          </span>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Install react-dropzone if not present**

```bash
cd frontend && bun add react-dropzone
```

**Step 3: Commit**

```bash
git add frontend/src/components/media-library/MediaUploader.tsx frontend/package.json
git commit -m "feat(ui): add MediaUploader component"
```

---

### Task 3.2: Create MediaItem Component

**Files:**
- Create: `frontend/src/components/media-library/MediaItem.tsx`

**Step 1: Create media item component**

Create `frontend/src/components/media-library/MediaItem.tsx`:

```tsx
import { useState } from "react";
import { Check, Pencil, Trash2, RotateCcw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Media, MediaUsage, updateMedia, getMediaUsage } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MediaItemProps {
  media: Media;
  isDeleted?: boolean;
  selectionMode?: boolean;
  onSelect?: (url: string) => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onUpdate?: () => void;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaItem({
  media,
  isDeleted,
  selectionMode,
  onSelect,
  onDelete,
  onRestore,
  onUpdate,
}: MediaItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editFilename, setEditFilename] = useState(media.filename);
  const [editAltText, setEditAltText] = useState(media.alt_text);
  const [usage, setUsage] = useState<MediaUsage[] | null>(null);
  const [showUsage, setShowUsage] = useState(false);

  const handleSave = async () => {
    await updateMedia(media.id, {
      filename: editFilename,
      alt_text: editAltText,
    });
    setIsEditing(false);
    onUpdate?.();
  };

  const handleShowUsage = async () => {
    const data = await getMediaUsage(media.id);
    setUsage(data);
    setShowUsage(true);
  };

  return (
    <>
      <div
        className={cn(
          "group relative rounded-lg border bg-card overflow-hidden",
          selectionMode && "cursor-pointer hover:ring-2 hover:ring-primary"
        )}
        onClick={() => selectionMode && onSelect?.(media.url)}
      >
        <div className="aspect-square bg-muted">
          <img
            src={media.url}
            alt={media.alt_text || media.filename}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="p-2">
          <p className="text-sm font-medium truncate">{media.filename}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(media.size_bytes)}
          </p>
        </div>

        {/* Action overlay */}
        {!selectionMode && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            {isDeleted ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="secondary" onClick={onRestore}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restore</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={handleShowUsage}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Where used</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={onDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        )}

        {/* Selection indicator */}
        {selectionMode && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100">
            <div className="bg-primary text-primary-foreground rounded-full p-1">
              <Check className="h-4 w-4" />
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Media</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <img
                src={media.url}
                alt={media.alt_text || media.filename}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filename">Filename</Label>
              <Input
                id="filename"
                value={editFilename}
                onChange={(e) => setEditFilename(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alt_text">Alt Text</Label>
              <Input
                id="alt_text"
                value={editAltText}
                onChange={(e) => setEditAltText(e.target.value)}
                placeholder="Describe this image..."
              />
            </div>
            <Button onClick={handleSave} className="w-full">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Usage Dialog */}
      <Dialog open={showUsage} onOpenChange={setShowUsage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Where Used</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {usage?.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                This image is not used in any templates.
              </p>
            ) : (
              <ul className="space-y-1">
                {usage?.map((t) => (
                  <li key={t.id} className="text-sm">
                    {t.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/media-library/MediaItem.tsx
git commit -m "feat(ui): add MediaItem component with edit/delete/usage"
```

---

### Task 3.3: Create MediaGrid Component

**Files:**
- Create: `frontend/src/components/media-library/MediaGrid.tsx`

**Step 1: Create media grid component**

Create `frontend/src/components/media-library/MediaGrid.tsx`:

```tsx
import { Media } from "@/lib/api";
import { MediaItem } from "./MediaItem";
import { ImageIcon } from "lucide-react";

interface MediaGridProps {
  media: Media[];
  isDeleted?: boolean;
  selectionMode?: boolean;
  onSelect?: (url: string) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onUpdate?: () => void;
}

export function MediaGrid({
  media,
  isDeleted,
  selectionMode,
  onSelect,
  onDelete,
  onRestore,
  onUpdate,
}: MediaGridProps) {
  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">
          {isDeleted ? "No deleted images" : "No images yet"}
        </p>
        {!isDeleted && (
          <p className="text-xs mt-1">Upload your first image above</p>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {media.map((item) => (
        <MediaItem
          key={item.id}
          media={item}
          isDeleted={isDeleted}
          selectionMode={selectionMode}
          onSelect={onSelect}
          onDelete={() => onDelete?.(item.id)}
          onRestore={() => onRestore?.(item.id)}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/media-library/MediaGrid.tsx
git commit -m "feat(ui): add MediaGrid component"
```

---

### Task 3.4: Create MediaLibrarySidebar Component

**Files:**
- Create: `frontend/src/components/media-library/MediaLibrarySidebar.tsx`
- Create: `frontend/src/components/media-library/index.ts`

**Step 1: Create sidebar component**

Create `frontend/src/components/media-library/MediaLibrarySidebar.tsx`:

```tsx
import { useState, useEffect } from "react";
import { X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MediaUploader } from "./MediaUploader";
import { MediaGrid } from "./MediaGrid";
import { Media, getMedia, deleteMedia, restoreMedia } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MediaLibrarySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectionMode?: boolean;
  onSelect?: (url: string) => void;
}

export function MediaLibrarySidebar({
  isOpen,
  onClose,
  selectionMode,
  onSelect,
}: MediaLibrarySidebarProps) {
  const [media, setMedia] = useState<Media[]>([]);
  const [deletedMedia, setDeletedMedia] = useState<Media[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("library");

  const fetchMedia = async () => {
    const [active, deleted] = await Promise.all([
      getMedia(false),
      getMedia(true),
    ]);
    setMedia(active);
    setDeletedMedia(deleted);
  };

  useEffect(() => {
    if (isOpen) {
      fetchMedia();
    }
  }, [isOpen]);

  const handleDelete = async (id: string) => {
    await deleteMedia(id);
    fetchMedia();
  };

  const handleRestore = async (id: string) => {
    await restoreMedia(id);
    fetchMedia();
  };

  const filteredMedia = media.filter(
    (m) =>
      m.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.alt_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDeletedMedia = deletedMedia.filter(
    (m) =>
      m.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.alt_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-full w-80 bg-background border-l shadow-lg transform transition-transform duration-200 z-50",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Media Library</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Uploader */}
        <div className="p-4 border-b">
          <MediaUploader onUploadComplete={fetchMedia} />
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="mx-4 mt-2">
            <TabsTrigger value="library" className="flex-1">
              Library ({media.length})
            </TabsTrigger>
            <TabsTrigger value="deleted" className="flex-1">
              Deleted ({deletedMedia.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 p-4">
            <TabsContent value="library" className="mt-0">
              <MediaGrid
                media={filteredMedia}
                selectionMode={selectionMode}
                onSelect={onSelect}
                onDelete={handleDelete}
                onUpdate={fetchMedia}
              />
            </TabsContent>
            <TabsContent value="deleted" className="mt-0">
              <MediaGrid
                media={filteredDeletedMedia}
                isDeleted
                onRestore={handleRestore}
                onUpdate={fetchMedia}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}
```

**Step 2: Create index barrel export**

Create `frontend/src/components/media-library/index.ts`:

```typescript
export { MediaLibrarySidebar } from "./MediaLibrarySidebar";
export { MediaUploader } from "./MediaUploader";
export { MediaGrid } from "./MediaGrid";
export { MediaItem } from "./MediaItem";
```

**Step 3: Commit**

```bash
git add frontend/src/components/media-library/
git commit -m "feat(ui): add MediaLibrarySidebar component"
```

---

## Phase 4: Integration with Template Editor

### Task 4.1: Add Media Library to Templates Page

**Files:**
- Modify: `frontend/src/pages/Templates.tsx`

**Step 1: Import MediaLibrarySidebar**

Add import at top of file:

```typescript
import { MediaLibrarySidebar } from "@/components/media-library";
```

**Step 2: Add sidebar state**

Add state variables in the Templates component:

```typescript
const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
const [mediaSelectionTarget, setMediaSelectionTarget] = useState<{
  blockId: string;
  prop: "url" | "imageUrl";
} | null>(null);
```

**Step 3: Add "Browse Media" button to image block properties**

In the BlockProperties component, find the image URL input section and add a button next to it:

```tsx
<div className="flex gap-2">
  <Input
    value={block.props.url || ""}
    onChange={(e) => updateBlockProp(block.id, "url", e.target.value)}
    placeholder="Image URL"
  />
  <Button
    variant="outline"
    size="icon"
    onClick={() => {
      setMediaSelectionTarget({ blockId: block.id, prop: "url" });
      setMediaLibraryOpen(true);
    }}
  >
    <ImageIcon className="h-4 w-4" />
  </Button>
</div>
```

Do the same for header block's imageUrl prop.

**Step 4: Add selection handler**

```typescript
const handleMediaSelect = (url: string) => {
  if (mediaSelectionTarget) {
    updateBlockProp(
      mediaSelectionTarget.blockId,
      mediaSelectionTarget.prop,
      url
    );
    setMediaLibraryOpen(false);
    setMediaSelectionTarget(null);
  }
};
```

**Step 5: Render MediaLibrarySidebar**

Add at the end of the component's return, before closing fragment:

```tsx
<MediaLibrarySidebar
  isOpen={mediaLibraryOpen}
  onClose={() => {
    setMediaLibraryOpen(false);
    setMediaSelectionTarget(null);
  }}
  selectionMode={!!mediaSelectionTarget}
  onSelect={handleMediaSelect}
/>
```

**Step 6: Commit**

```bash
git add frontend/src/pages/Templates.tsx
git commit -m "feat(templates): integrate media library sidebar"
```

---

## Phase 5: Final Steps

### Task 5.1: Build and Test

**Step 1: Run build**

```bash
bun run build
```

**Step 2: Start dev server and test manually**

```bash
bun run dev
```

Test:
1. Open template editor
2. Click image block → see "Browse Media" button
3. Click button → sidebar opens
4. Upload an image → appears in grid
5. Click image → URL populated in block
6. Edit image metadata
7. Delete image → appears in Deleted tab
8. Restore image → back in Library

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during testing"
```

---

### Task 5.2: Documentation

**Step 1: Update AGENTS.md if needed**

Add any new gotchas or important notes discovered during implementation.

**Step 2: Final commit**

```bash
git add -A
git commit -m "docs: update documentation for media library"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1.1-1.4 | Backend: DB migration, Uploadthing setup, Media API |
| 2 | 2.1-2.3 | Frontend foundation: Uploadthing SDK, API client |
| 3 | 3.1-3.4 | UI components: Uploader, Item, Grid, Sidebar |
| 4 | 4.1 | Integration with template editor |
| 5 | 5.1-5.2 | Build, test, documentation |

**Estimated time:** 2-3 hours

**Dependencies between phases:**
- Phase 2 depends on Phase 1 (API must exist)
- Phase 3 depends on Phase 2 (needs API client)
- Phase 4 depends on Phase 3 (needs sidebar component)
- Phase 5 depends on all previous phases

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

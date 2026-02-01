import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { db } from "../db";
import { nanoid } from "nanoid";
import { join } from "path";
import { existsSync, mkdirSync, unlinkSync } from "fs";

const router = Router();

// Use same DATA_DIR as db module for consistency
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const MEDIA_DIR = join(DATA_DIR, "media");
if (!existsSync(MEDIA_DIR)) {
  mkdirSync(MEDIA_DIR, { recursive: true });
}

// Configure multer for memory storage (we'll process with sharp before saving)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed."));
    }
  },
});

// Upload and optimize image
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const id = nanoid();
    const originalName = req.file.originalname;
    const ext = ".webp"; // Always save as WebP
    const filename = `${id}${ext}`;
    const filepath = join(MEDIA_DIR, filename);

    // Process image with Sharp - convert to WebP and optimize
    await sharp(req.file.buffer)
      .webp({ quality: 85 })
      .resize(2000, 2000, { 
        fit: "inside", 
        withoutEnlargement: true 
      })
      .toFile(filepath);

    // Get file size after optimization
    const stats = await sharp(filepath).metadata();
    const optimizedBuffer = await sharp(filepath).toBuffer();
    const sizeBytes = optimizedBuffer.length;

    // Generate public URL
    const url = `/media/${filename}`;

    // Save to database
    db.run(
      `INSERT INTO media (id, url, filename, original_filename, size_bytes) 
       VALUES (?, ?, ?, ?, ?)`,
      [id, url, filename, originalName, sizeBytes]
    );

    const media = db.query("SELECT * FROM media WHERE id = ?").get(id);
    res.status(201).json(media);
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to process image" });
  }
});

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
    updates.push("original_filename = ?");
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

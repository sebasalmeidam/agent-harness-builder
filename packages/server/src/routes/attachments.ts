import { Router } from "express";
import { readdir, stat, mkdir, unlink, copyFile } from "node:fs/promises";
import { join, basename } from "node:path";
import * as projectService from "../services/project-service.js";
import multer from "multer";

const router = Router({ mergeParams: true });

function getParam(
  params: Record<string, string | string[]>,
  key: string
): string {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

async function getAttachmentsDir(projectId: string): Promise<string | null> {
  const project = await projectService.get(projectId);
  if (!project || !project.path) return null;
  const dir = join(project.path, "attachments");
  await mkdir(dir, { recursive: true });
  return dir;
}

// Configure multer for file uploads
const upload = multer({ dest: "/tmp/harness-uploads/" });

// GET /api/projects/:id/attachments - List attachments
router.get("/", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");
    const dir = await getAttachmentsDir(projectId);
    if (!dir) {
      res.status(404).json({ error: "Project not found or no path set" });
      return;
    }

    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      res.json([]);
      return;
    }

    const attachments = await Promise.all(
      files.map(async (name) => {
        try {
          const s = await stat(join(dir, name));
          return { name, size: s.size, modifiedAt: s.mtime.toISOString() };
        } catch {
          return null;
        }
      })
    );

    res.json(attachments.filter(Boolean));
  } catch (err) {
    console.error("Failed to list attachments:", err);
    res.status(500).json({ error: "Failed to list attachments" });
  }
});

// POST /api/projects/:id/attachments - Upload attachment
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");
    const dir = await getAttachmentsDir(projectId);
    if (!dir) {
      res.status(404).json({ error: "Project not found or no path set" });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const safeName = basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    const destPath = join(dir, safeName);
    await copyFile(file.path, destPath);
    // Clean up temp file
    await unlink(file.path).catch(() => {});

    const s = await stat(destPath);
    res.status(201).json({ name: safeName, size: s.size, modifiedAt: s.mtime.toISOString() });
  } catch (err) {
    console.error("Failed to upload attachment:", err);
    res.status(500).json({ error: "Failed to upload attachment" });
  }
});

// DELETE /api/projects/:id/attachments/:filename - Delete attachment
router.delete("/:filename", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");
    const filename = getParam(req.params, "filename");
    const dir = await getAttachmentsDir(projectId);
    if (!dir) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const safeName = basename(filename);
    await unlink(join(dir, safeName));
    res.status(204).send();
  } catch (err) {
    console.error("Failed to delete attachment:", err);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
});

export { router as attachmentsRouter };

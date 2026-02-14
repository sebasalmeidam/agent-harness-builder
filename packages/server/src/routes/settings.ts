import { Router } from "express";
import * as configService from "../services/config-service.js";

const router = Router();

// GET /api/settings - Get current settings
router.get("/", async (_req, res) => {
  try {
    const settings = await configService.getSettings();
    res.json(settings);
  } catch (err) {
    console.error("Failed to get settings:", err);
    res.status(500).json({ error: "Failed to get settings" });
  }
});

// PUT /api/settings - Update settings
router.put("/", async (req, res) => {
  const { apiKey, defaultModel } = req.body as {
    apiKey?: string;
    defaultModel?: string;
  };

  // Validate that at least one field is provided
  if (apiKey === undefined && defaultModel === undefined) {
    res.status(400).json({ error: "At least one field must be provided for update" });
    return;
  }

  // Validate apiKey if provided (can be empty string to clear)
  if (apiKey !== undefined && typeof apiKey !== "string") {
    res.status(400).json({ error: "API key must be a string" });
    return;
  }

  // Validate defaultModel if provided
  if (defaultModel !== undefined) {
    if (typeof defaultModel !== "string") {
      res.status(400).json({ error: "Default model must be a string" });
      return;
    }
    
    const validModels = [
      "claude-sonnet-4-20250514",
      "claude-opus-4-0-20250115",
      "claude-haiku-3-5-20241022",
    ];
    
    if (!validModels.includes(defaultModel)) {
      res.status(400).json({ 
        error: `Invalid model. Must be one of: ${validModels.join(", ")}` 
      });
      return;
    }
  }

  try {
    await configService.updateSettings({ apiKey, defaultModel });
    const settings = await configService.getSettings();
    res.json(settings);
  } catch (err) {
    console.error("Failed to update settings:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// POST /api/settings/test - Test API key connection
router.post("/test", async (_req, res) => {
  try {
    const result = await configService.testApiKey();
    
    if (result.valid) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err) {
    console.error("Failed to test API key:", err);
    res.status(500).json({ success: false, error: "Failed to test connection" });
  }
});

// GET /api/settings/status - Check if API key is configured
router.get("/status", async (_req, res) => {
  try {
    const hasKey = await configService.hasApiKey();
    res.json({ hasApiKey: hasKey });
  } catch (err) {
    console.error("Failed to check API key status:", err);
    res.status(500).json({ error: "Failed to check status" });
  }
});

export { router as settingsRouter };

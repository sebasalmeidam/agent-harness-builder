import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// --- Config types ---

export interface AppConfig {
  apiKey: string;
  defaultModel: string;
}

// --- Private state ---

let cachedConfig: AppConfig | null = null;

// --- Path helpers ---

function getConfigDir(): string {
  const baseDir = process.env["HARNESS_DATA_DIR"] ?? join(homedir(), ".agent-harness");
  return baseDir;
}

function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

// --- Config operations ---

/**
 * Ensures the config directory exists and creates it if needed.
 */
async function ensureConfigDir(): Promise<void> {
  const configDir = getConfigDir();
  await mkdir(configDir, { recursive: true });
}

/**
 * Loads the config from disk.
 * Returns default config if file doesn't exist.
 */
async function loadConfig(): Promise<AppConfig> {
  const configPath = getConfigPath();
  
  try {
    const content = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(content) as Partial<AppConfig>;
    return {
      apiKey: parsed.apiKey ?? "",
      defaultModel: parsed.defaultModel ?? "claude-sonnet-4-20250514",
    };
  } catch {
    // File doesn't exist or is invalid - return defaults
    return {
      apiKey: "",
      defaultModel: "claude-sonnet-4-20250514",
    };
  }
}

/**
 * Saves config to disk with chmod 600 for security.
 */
async function saveConfig(config: AppConfig): Promise<void> {
  await ensureConfigDir();
  const configPath = getConfigPath();
  
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
  
  // Set file permissions to 600 (owner read/write only)
  await chmod(configPath, 0o600);
  
  // Update cache
  cachedConfig = config;
}

/**
 * Gets the current config, loading from disk if needed.
 */
async function getConfig(): Promise<AppConfig> {
  if (!cachedConfig) {
    cachedConfig = await loadConfig();
  }
  return cachedConfig;
}

// --- Public API ---

/**
 * Gets the API key to use.
 * Environment variable takes precedence over config file.
 */
export async function getApiKey(): Promise<string> {
  // Environment variable takes precedence
  const envKey = process.env["ANTHROPIC_API_KEY"];
  if (envKey) {
    return envKey;
  }
  
  const config = await getConfig();
  return config.apiKey;
}

/**
 * Gets the default model to use.
 */
export async function getDefaultModel(): Promise<string> {
  const config = await getConfig();
  return config.defaultModel || "claude-sonnet-4-20250514";
}

/**
 * Gets the full config with the API key masked for display.
 */
export async function getSettings(): Promise<{ apiKey: string; defaultModel: string; hasEnvKey: boolean }> {
  const config = await getConfig();
  const envKey = process.env["ANTHROPIC_API_KEY"];
  
  // Use env key if available, otherwise config key
  const activeKey = envKey || config.apiKey;
  
  return {
    apiKey: maskApiKey(activeKey),
    defaultModel: config.defaultModel || "claude-sonnet-4-20250514",
    hasEnvKey: !!envKey,
  };
}

/**
 * Updates the settings.
 * Only updates fields that are provided.
 */
export async function updateSettings(updates: Partial<AppConfig>): Promise<void> {
  const config = await getConfig();
  
  const newConfig: AppConfig = {
    apiKey: updates.apiKey !== undefined ? updates.apiKey : config.apiKey,
    defaultModel: updates.defaultModel !== undefined ? updates.defaultModel : config.defaultModel,
  };
  
  await saveConfig(newConfig);
}

/**
 * Tests if the API key is valid by making a lightweight API call.
 * Returns true if the key works, false otherwise.
 */
export async function testApiKey(): Promise<{ valid: boolean; error?: string }> {
  const apiKey = await getApiKey();
  
  if (!apiKey) {
    return { valid: false, error: "No API key configured" };
  }
  
  try {
    // Import Anthropic SDK dynamically
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });
    
    // Make a minimal API call to test the key
    await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1,
      messages: [{ role: "user", content: "Hi" }],
    });
    
    return { valid: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("401") || err.message.includes("authentication") || err.message.includes("invalid")) {
        return { valid: false, error: "Invalid API key" };
      }
      return { valid: false, error: err.message };
    }
    return { valid: false, error: "Unknown error" };
  }
}

/**
 * Checks if an API key is configured (either via env or config).
 */
export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return key.length > 0;
}

// --- Utilities ---

/**
 * Masks an API key for display, showing only first 5 and last 3 characters.
 * Example: "sk-ant-api03-xxx...xxx"
 */
function maskApiKey(key: string): string {
  if (!key || key.length < 12) {
    return key ? "***" : "";
  }
  
  const prefix = key.slice(0, 5);
  const suffix = key.slice(-3);
  return `${prefix}...${suffix}`;
}

/**
 * Clears the config cache. Useful for testing.
 */
export function _clearCache(): void {
  cachedConfig = null;
}
